use argon2::{Argon2, PasswordHash, PasswordVerifier};
use axum::{
    extract::{FromRef, FromRequestParts},
    http::{StatusCode, header::AUTHORIZATION, request::Parts},
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::api::Organization;

pub struct AuthenticatedApiKey {
    pub user_id: Uuid,
}

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

        let api_key = sqlx::query!(
            r#"
            SELECT
                "key",
                prefix,
                "userId"
            FROM apikey
            WHERE prefix = $1
              AND "organizationId" IS NULL
              AND "projectId" IS NULL
              AND enabled = true
            "#,
            parsed.prefix
        )
        .fetch_optional(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid API key"))?;

        // Verify the secret against the stored hash
        let stored_hash = api_key.key;

        let parsed_hash = PasswordHash::new(&stored_hash)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid stored hash"))?;

        Argon2::default()
            .verify_password(parsed.secret.as_bytes(), &parsed_hash)
            .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid API key"))?;

        Ok(AuthenticatedApiKey {
            user_id: api_key.userId,
        })
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

        let organization = sqlx::query!(
            r#"
            SELECT
                o.id,
                o.name,
                o.slug,
                o."createdBy",
                o."platformFeePercent",
                o."platformFeeFixed",
                a."key"
            FROM organization o
            JOIN apikey a ON a."organizationId" = o.id
            WHERE a.prefix = $1
            "#,
            parsed.prefix
        )
        .fetch_optional(&pool)
        .await
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Database error"))?
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid API key"))?;

        let stored_hash = organization.key;

        let parsed_hash = PasswordHash::new(&stored_hash)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid stored hash"))?;

        Argon2::default()
            .verify_password(parsed.secret.as_bytes(), &parsed_hash)
            .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid API key"))?;

        Ok(AuthenticatedOrganization {
            organization: Organization {
                id: organization.id,
                name: organization.name,
                slug: organization.slug,
                created_by: organization.createdBy,
                platform_fee_percent: organization.platformFeePercent,
                platform_fee_fixed: organization.platformFeeFixed,
            },
        })
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
          AND "organizationId" = $2
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
