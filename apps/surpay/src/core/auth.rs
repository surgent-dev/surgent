use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::{
    extract::{FromRef, FromRequestParts},
    http::{StatusCode, header::AUTHORIZATION, request::Parts},
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::api::{ApiKey, Organization};

pub struct AuthenticatedApiKey(pub ApiKey);
pub struct AuthenticatedOrganization {
    pub organization: Organization,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ApiKeyType {
    Master,
    Organization,
}

struct ParsedApiKey<'a> {
    key_type: ApiKeyType,
    prefix: &'a str,
    secret: &'a str,
}

fn parse_api_key(token: &str) -> Option<ParsedApiKey<'_>> {
    // Format: sp_<type>_<prefix>_<secret>
    let parts: Vec<&str> = token.splitn(4, '_').collect();
    if parts.len() != 4 || parts[0] != "sp" {
        return None;
    }

    let key_type = match parts[1] {
        "master" => ApiKeyType::Master,
        "org" => ApiKeyType::Organization,
        _ => return None,
    };

    Some(ParsedApiKey {
        key_type,
        prefix: parts[2],
        secret: parts[3],
    })
}

// We search by prefix, then validate against our stored hash
// this is similar to how passwords are handled
impl<S> FromRequestParts<S> for AuthenticatedApiKey
where
    S: Send + Sync,
    PgPool: FromRef<S>,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or((StatusCode::UNAUTHORIZED, "Missing Authorization header"))?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or((StatusCode::UNAUTHORIZED, "Invalid Authorization scheme"))?;

        let parsed =
            parse_api_key(token).ok_or((StatusCode::UNAUTHORIZED, "Invalid API key format"))?;
        if parsed.key_type != ApiKeyType::Master {
            return Err((StatusCode::UNAUTHORIZED, "Invalid API key"));
        }

        let pool = PgPool::from_ref(state);

        let api_key = sqlx::query_as!(
            ApiKey,
            r#"
            SELECT
                id,
                name,
                slug,
                api_key,
                api_key_prefix
            FROM api_key
            WHERE api_key_prefix = $1
            "#,
            parsed.prefix
        )
        .fetch_optional(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid API key"))?;

        // Verify the secret against the stored hash
        let stored_hash = api_key
            .api_key
            .as_ref()
            .ok_or((StatusCode::UNAUTHORIZED, "Invalid API key"))?;

        let parsed_hash = PasswordHash::new(stored_hash)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid stored hash"))?;

        Argon2::default()
            .verify_password(parsed.secret.as_bytes(), &parsed_hash)
            .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid API key"))?;

        Ok(AuthenticatedApiKey(api_key))
    }
}

impl<S> FromRequestParts<S> for AuthenticatedOrganization
where
    S: Send + Sync,
    PgPool: FromRef<S>,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or((StatusCode::UNAUTHORIZED, "Missing Authorization header"))?;

        let token = auth_header
            .strip_prefix("Bearer ")
            .ok_or((StatusCode::UNAUTHORIZED, "Invalid Authorization scheme"))?;

        let parsed =
            parse_api_key(token).ok_or((StatusCode::UNAUTHORIZED, "Invalid API key format"))?;
        if parsed.key_type != ApiKeyType::Organization {
            return Err((StatusCode::UNAUTHORIZED, "Invalid API key"));
        }

        let pool = PgPool::from_ref(state);

        let organization = sqlx::query_as!(
            Organization,
            r#"
            SELECT
                id,
                name,
                slug,
                created_by,
                api_key,
                api_key_prefix,
                platform_fee_percent,
                platform_fee_fixed
            FROM organization
            WHERE api_key_prefix = $1
            "#,
            parsed.prefix
        )
        .fetch_optional(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid API key"))?;

        let stored_hash = organization
            .api_key
            .as_ref()
            .ok_or((StatusCode::UNAUTHORIZED, "Invalid API key"))?;

        let parsed_hash = PasswordHash::new(stored_hash)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid stored hash"))?;

        Argon2::default()
            .verify_password(parsed.secret.as_bytes(), &parsed_hash)
            .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid API key"))?;

        Ok(AuthenticatedOrganization { organization })
    }
}

/// Validates that a project belongs to the authenticated organization.
///
/// Returns an error if the project does not exist or does not belong to the organization.
pub async fn validate_project_ownership(
    pool: &PgPool,
    project_id: Uuid,
    org: &Organization,
) -> Result<(), (StatusCode, String)> {
    let project = sqlx::query!(
        r#"
        SELECT id
        FROM project
        WHERE id = $1
          AND organization_id = $2
        "#,
        project_id,
        org.id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    if project.is_none() {
        return Err((StatusCode::UNAUTHORIZED, "Invalid project".to_string()));
    }

    Ok(())
}
