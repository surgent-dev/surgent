use axum::{
    extract::{FromRef, FromRequestParts},
    http::{StatusCode, header::AUTHORIZATION, request::Parts},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

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
