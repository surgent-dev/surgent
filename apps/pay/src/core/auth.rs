use axum::{
    extract::{FromRef, FromRequestParts},
    http::{StatusCode, header::AUTHORIZATION, header::COOKIE, request::Parts},
};
use base64::{
    Engine,
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
};
use hmac::{Hmac, Mac};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use subtle::ConstantTimeEq;
use uuid::Uuid;

use super::Config;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectIdQuery {
    pub project_id: Option<Uuid>,
}

type HmacSha256 = Hmac<Sha256>;

fn hash_api_key(key: &str) -> String {
    let prefix = if key.len() >= 8 {
        format!("{}...{}", &key[..4], &key[key.len() - 4..])
    } else {
        "***".to_string()
    };
    tracing::debug!(key_hint = %prefix, "Hashing API key");
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn extract_api_key(parts: &Parts) -> Option<&str> {
    tracing::debug!("Attempting to extract API key from request headers");
    // Try Authorization: Bearer <key>
    if let Some(auth) = parts.headers.get(AUTHORIZATION) {
        tracing::debug!("Found Authorization header");
        if let Ok(s) = auth.to_str() {
            if let Some(token) = s.strip_prefix("Bearer ") {
                tracing::debug!(
                    key_length = token.len(),
                    "Extracted API key from Authorization Bearer header"
                );
                return Some(token);
            }
            tracing::debug!("Authorization header does not have Bearer prefix");
        } else {
            tracing::debug!("Authorization header is not valid UTF-8");
        }
    } else {
        tracing::debug!("No Authorization header found");
    }
    // Try x-api-key header
    if let Some(key) = parts.headers.get("x-api-key") {
        tracing::debug!("Found x-api-key header");
        if let Ok(s) = key.to_str() {
            tracing::debug!(
                key_length = s.len(),
                "Extracted API key from x-api-key header"
            );
            return Some(s);
        }
        tracing::debug!("x-api-key header is not valid UTF-8");
    } else {
        tracing::debug!("No x-api-key header found");
    }
    tracing::debug!("No API key found in any header");
    None
}

pub struct AuthenticatedUser {
    pub user_id: Uuid,
    pub organization_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
}

fn verify_cookie_signature(token: &str, signature: &str, secret: &str) -> bool {
    tracing::debug!(
        token_length = token.len(),
        signature_length = signature.len(),
        "verify_cookie_signature: Starting signature verification"
    );

    // URL-decode the signature (browser URL-encodes cookie values)
    let Ok(decoded_sig) = urlencoding::decode(signature) else {
        tracing::debug!("verify_cookie_signature: URL decode of signature failed");
        return false;
    };
    tracing::debug!(
        decoded_signature_length = decoded_sig.len(),
        "verify_cookie_signature: URL decode succeeded"
    );

    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        tracing::debug!("verify_cookie_signature: HMAC creation failed");
        return false;
    };
    tracing::debug!("verify_cookie_signature: HMAC created successfully");

    mac.update(token.as_bytes());
    // better-auth uses standard base64 with padding
    let expected = STANDARD.encode(mac.finalize().into_bytes());
    let is_valid: bool = expected.as_bytes().ct_eq(decoded_sig.as_bytes()).into();

    if is_valid {
        tracing::debug!("verify_cookie_signature: Signature verification succeeded");
    } else {
        tracing::debug!("verify_cookie_signature: Signature verification failed (mismatch)");
    }

    is_valid
}

fn extract_session_token(parts: &Parts) -> Option<&str> {
    tracing::debug!("extract_session_token: Attempting to extract session token from cookies");

    let Some(cookie_header_value) = parts.headers.get(COOKIE) else {
        tracing::debug!("extract_session_token: No Cookie header found");
        return None;
    };

    let Ok(cookie_header) = cookie_header_value.to_str() else {
        tracing::debug!("extract_session_token: Cookie header is not valid UTF-8");
        return None;
    };

    tracing::debug!(
        cookie_count = cookie_header.split(';').count(),
        "extract_session_token: Cookie header found, parsing cookies"
    );

    for cookie in cookie_header.split(';') {
        let cookie = cookie.trim();
        // Check both regular and __Secure- prefixed cookie names
        // Better Auth uses __Secure- prefix when crossSubDomainCookies is enabled on HTTPS
        if let Some(value) = cookie
            .strip_prefix("__Secure-better-auth.session_token=")
            .or_else(|| cookie.strip_prefix("better-auth.session_token="))
        {
            tracing::debug!(
                token_length = value.len(),
                "extract_session_token: Found session token cookie"
            );
            return Some(value);
        }
    }

    tracing::debug!("extract_session_token: session token cookie not found");
    None
}

impl<S> FromRequestParts<S> for AuthenticatedUser
where
    S: Send + Sync,
    PgPool: FromRef<S>,
    Config: FromRef<S>,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        tracing::debug!("AuthenticatedUser: Starting authentication");

        // Try API key authentication first
        if let Some(token) = extract_api_key(parts) {
            tracing::debug!("AuthenticatedUser: API key found, attempting API key auth");

            let hashed = hash_api_key(token);
            let pool = PgPool::from_ref(state);

            match sqlx::query!(
                r#"
                SELECT "userId", "projectId", "organizationId", enabled, "expiresAt"
                FROM apikey
                WHERE key = $1
                "#,
                hashed
            )
            .fetch_optional(&pool)
            .await
            {
                Ok(Some(row)) => {
                    tracing::debug!(
                        user_id = %row.userId,
                        organization_id = ?row.organizationId,
                        enabled = row.enabled,
                        "AuthenticatedUser: API key found in database"
                    );

                    // Validate API key is enabled
                    if !row.enabled {
                        tracing::debug!(
                            "AuthenticatedUser: API key disabled, falling back to cookie auth"
                        );
                    } else if let Some(expires) = row.expiresAt {
                        let now = chrono::Utc::now();
                        if expires < now {
                            tracing::debug!(
                                expires_at = %expires,
                                "AuthenticatedUser: API key expired, falling back to cookie auth"
                            );
                        } else {
                            tracing::debug!(
                                user_id = %row.userId,
                                organization_id = ?row.organizationId,
                                project_id = ?row.projectId,
                                "AuthenticatedUser: API key authentication successful"
                            );
                            return Ok(AuthenticatedUser {
                                user_id: row.userId,
                                organization_id: row.organizationId,
                                project_id: row.projectId,
                            });
                        }
                    } else {
                        // No expiration set, key is valid
                        tracing::debug!(
                            user_id = %row.userId,
                            organization_id = ?row.organizationId,
                            project_id = ?row.projectId,
                            "AuthenticatedUser: API key authentication successful (no expiration)"
                        );
                        return Ok(AuthenticatedUser {
                            user_id: row.userId,
                            organization_id: row.organizationId,
                            project_id: row.projectId,
                        });
                    }
                }
                Ok(None) => {
                    tracing::debug!(
                        "AuthenticatedUser: API key not found in database, falling back to cookie auth"
                    );
                }
                Err(e) => {
                    tracing::debug!(error = ?e, "AuthenticatedUser: API key database lookup failed, falling back to cookie auth");
                }
            }
        } else {
            tracing::debug!("AuthenticatedUser: No API key found, trying cookie auth");
        }

        // Fall back to cookie-based session authentication
        let cookie_value = extract_session_token(parts).ok_or_else(|| {
            tracing::warn!("AuthenticatedUser: No session cookie found and no valid API key");
            (StatusCode::UNAUTHORIZED, "Missing authentication")
        })?;

        let (token, signature) = cookie_value.rsplit_once('.').ok_or_else(|| {
            tracing::warn!("AuthenticatedUser: Invalid session format - no dot separator");
            (StatusCode::UNAUTHORIZED, "Invalid session format")
        })?;

        let config = Config::from_ref(state);
        if !verify_cookie_signature(token, signature, &config.better_auth_secret) {
            tracing::warn!("AuthenticatedUser: Session signature verification failed");
            return Err((StatusCode::UNAUTHORIZED, "Invalid session signature"));
        }
        tracing::debug!("AuthenticatedUser: Cookie signature verified");

        let pool = PgPool::from_ref(state);
        let row = sqlx::query!(
            r#"
            SELECT s."userId", s."activeOrganizationId"
            FROM session s
            WHERE s.token = $1 AND s."expiresAt" > NOW()
            "#,
            token
        )
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            tracing::error!(error = ?e, "AuthenticatedUser: Database error during session lookup");
            (StatusCode::INTERNAL_SERVER_ERROR, "Database error")
        })?
        .ok_or_else(|| {
            tracing::warn!("AuthenticatedUser: Session not found or expired");
            (StatusCode::UNAUTHORIZED, "Session not found or expired")
        })?;

        tracing::debug!(
            user_id = %row.userId,
            organization_id = ?row.activeOrganizationId,
            "AuthenticatedUser: Cookie session authentication successful"
        );

        Ok(AuthenticatedUser {
            user_id: row.userId,
            organization_id: row.activeOrganizationId,
            project_id: None,
        })
    }
}

/// Resolves project_id from auth context or query parameter.
/// - API key auth: returns `auth.project_id` directly
/// - Session auth: requires `query_project_id` and verifies user access
pub async fn resolve_project_id(
    pool: &PgPool,
    auth: &AuthenticatedUser,
    query_project_id: Option<Uuid>,
) -> Result<Uuid, (StatusCode, String)> {
    match auth.project_id {
        Some(id) => Ok(id),
        None => {
            let id = query_project_id.ok_or((
                StatusCode::BAD_REQUEST,
                "project_id query parameter required for session auth".to_string(),
            ))?;
            verify_project_access(pool, auth.user_id, id).await?;
            Ok(id)
        }
    }
}

pub async fn verify_project_access(
    pool: &PgPool,
    user_id: Uuid,
    project_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    tracing::debug!(
        user_id = %user_id,
        project_id = %project_id,
        "verify_project_access: Checking user access to project"
    );

    let exists = sqlx::query!(
        r#"
        SELECT p.id FROM project p
        INNER JOIN member m ON m."organizationId" = p."organizationId"
        WHERE p.id = $1 AND m."userId" = $2
        "#,
        project_id,
        user_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::warn!(
            error = ?e,
            user_id = %user_id,
            project_id = %project_id,
            "verify_project_access: Database query failed"
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database error".to_string(),
        )
    })?;

    if exists.is_some() {
        tracing::debug!(
            user_id = %user_id,
            project_id = %project_id,
            "verify_project_access: Access granted"
        );
        Ok(())
    } else {
        tracing::warn!(
            user_id = %user_id,
            project_id = %project_id,
            "verify_project_access: Access denied - user is not a member of project's organization"
        );
        Err((StatusCode::FORBIDDEN, "Access denied".to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sign_token(token: &str, secret: &str) -> String {
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(token.as_bytes());
        STANDARD.encode(mac.finalize().into_bytes())
    }

    #[test]
    fn test_verify_valid_signature() {
        let secret = "test-secret";
        let token = "test-token-123";
        let signature = sign_token(token, secret);
        assert!(verify_cookie_signature(token, &signature, secret));
    }

    #[test]
    fn test_verify_invalid_signature() {
        let secret = "test-secret";
        let token = "test-token-123";
        assert!(!verify_cookie_signature(token, "invalid-sig", secret));
    }

    #[test]
    fn test_verify_wrong_secret() {
        let secret = "test-secret";
        let token = "test-token-123";
        let signature = sign_token(token, secret);
        assert!(!verify_cookie_signature(token, &signature, "wrong-secret"));
    }
}
