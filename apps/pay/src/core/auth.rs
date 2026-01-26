use axum::{
    extract::{FromRef, FromRequestParts},
    http::{StatusCode, header::AUTHORIZATION, header::COOKIE, request::Parts},
};
use base64::{
    Engine,
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use subtle::ConstantTimeEq;
use uuid::Uuid;

use super::Config;

type HmacSha256 = Hmac<Sha256>;

pub struct AuthenticatedProject {
    pub project_id: Uuid,
    pub organization_id: Uuid,
    pub user_id: Uuid,
}

fn hash_api_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn extract_api_key(parts: &Parts) -> Option<&str> {
    // Try Authorization: Bearer <key>
    if let Some(auth) = parts.headers.get(AUTHORIZATION) {
        if let Ok(s) = auth.to_str() {
            if let Some(token) = s.strip_prefix("Bearer ") {
                return Some(token);
            }
        }
    }
    // Try x-api-key header
    if let Some(key) = parts.headers.get("x-api-key") {
        if let Ok(s) = key.to_str() {
            return Some(s);
        }
    }
    None
}

impl<S> FromRequestParts<S> for AuthenticatedProject
where
    S: Send + Sync,
    PgPool: FromRef<S>,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let token = extract_api_key(parts).ok_or((StatusCode::UNAUTHORIZED, "Missing API key"))?;

        let hashed = hash_api_key(token);
        let pool = PgPool::from_ref(state);

        let row = sqlx::query!(
            r#"
            SELECT "userId", "projectId", "organizationId", enabled, "expiresAt"
            FROM apikey
            WHERE key = $1
            "#,
            hashed
        )
        .fetch_optional(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid API key"))?;

        if !row.enabled {
            return Err((StatusCode::UNAUTHORIZED, "API key disabled"));
        }

        if let Some(expires) = row.expiresAt {
            if expires < chrono::Utc::now() {
                return Err((StatusCode::UNAUTHORIZED, "API key expired"));
            }
        }

        let project_id = row.projectId.ok_or((
            StatusCode::UNAUTHORIZED,
            "API key not associated with a project",
        ))?;
        let organization_id = row.organizationId.ok_or((
            StatusCode::UNAUTHORIZED,
            "API key not associated with an organization",
        ))?;

        Ok(AuthenticatedProject {
            project_id,
            organization_id,
            user_id: row.userId,
        })
    }
}

pub struct AuthenticatedUser {
    pub user_id: Uuid,
    pub organization_id: Option<Uuid>,
}

fn verify_cookie_signature(token: &str, signature: &str, secret: &str) -> bool {
    // URL-decode the signature (browser URL-encodes cookie values)
    let Ok(decoded_sig) = urlencoding::decode(signature) else {
        return false;
    };

    let Ok(mut mac) = HmacSha256::new_from_slice(secret.as_bytes()) else {
        return false;
    };
    mac.update(token.as_bytes());
    // better-auth uses standard base64 with padding
    let expected = STANDARD.encode(mac.finalize().into_bytes());
    expected.as_bytes().ct_eq(decoded_sig.as_bytes()).into()
}

fn extract_session_token(parts: &Parts) -> Option<&str> {
    let cookie_header = parts.headers.get(COOKIE)?.to_str().ok()?;
    for cookie in cookie_header.split(';') {
        let cookie = cookie.trim();
        if let Some(value) = cookie.strip_prefix("better-auth.session_token=") {
            return Some(value);
        }
    }
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
        let cookie_value = extract_session_token(parts).ok_or_else(|| {
            tracing::warn!("No session cookie found");
            (StatusCode::UNAUTHORIZED, "Missing session")
        })?;
        tracing::debug!("Session cookie value length: {}", cookie_value.len());

        let (token, signature) = cookie_value.rsplit_once('.').ok_or_else(|| {
            tracing::warn!("Invalid session format - no dot separator");
            (StatusCode::UNAUTHORIZED, "Invalid session format")
        })?;
        tracing::debug!(
            "Token length: {}, Signature length: {}",
            token.len(),
            signature.len()
        );

        let config = Config::from_ref(state);
        if !verify_cookie_signature(token, signature, &config.better_auth_secret) {
            tracing::warn!("Session signature verification failed");
            return Err((StatusCode::UNAUTHORIZED, "Invalid session signature"));
        }
        tracing::debug!("Signature verified successfully");

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
            tracing::error!("Database error: {:?}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Database error")
        })?
        .ok_or_else(|| {
            tracing::warn!("Session not found or expired for token");
            (StatusCode::UNAUTHORIZED, "Session not found or expired")
        })?;

        tracing::debug!("Session authenticated for user: {}", row.userId);
        Ok(AuthenticatedUser {
            user_id: row.userId,
            organization_id: row.activeOrganizationId,
        })
    }
}

pub async fn verify_project_access(
    pool: &PgPool,
    user_id: Uuid,
    project_id: Uuid,
) -> Result<(), (StatusCode, String)> {
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
    .map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database error".to_string(),
        )
    })?;

    if exists.is_some() {
        Ok(())
    } else {
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
