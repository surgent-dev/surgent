use argon2::{
    Argon2, PasswordHasher,
    password_hash::{SaltString, rand_core::OsRng},
};
use axum::{Json, extract::State, http::StatusCode};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::AuthenticatedApiKey;

#[derive(Debug, Clone, FromRow)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    #[sqlx(rename = "createdBy")]
    pub created_by: Option<String>,
    #[sqlx(rename = "platformFeePercent")]
    pub platform_fee_percent: Option<i32>,
    #[sqlx(rename = "platformFeeFixed")]
    pub platform_fee_fixed: Option<i32>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateOrganizationRequest {
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreateOrganizationResponse {
    pub id: Uuid,
    pub api_key: String,
}

fn generate_api_key() -> (String, String, String) {
    use rand::Rng;
    let mut rng = rand::rng();

    let prefix: String = (0..8)
        .map(|_| rng.sample(rand::distr::Alphanumeric) as char)
        .collect::<String>()
        .to_lowercase();

    let secret: String = (0..32)
        .map(|_| rng.sample(rand::distr::Alphanumeric) as char)
        .collect();

    let full_key = format!("sp_org_{}_{}", prefix, secret);
    (full_key, prefix, secret)
}

/// Create a new organization
#[utoipa::path(
    post,
    path = "/organization",
    tag = "organization",
    request_body = CreateOrganizationRequest,
    responses(
        (status = 200, description = "Organization created", body = CreateOrganizationResponse),
        (status = 401, description = "Unauthorized - invalid or missing master API key"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("master_key" = [])
    )
)]
pub async fn create_organization(
    State(pool): State<PgPool>,
    api_key: AuthenticatedApiKey,
    Json(req): Json<CreateOrganizationRequest>,
) -> Result<Json<CreateOrganizationResponse>, (StatusCode, String)> {
    let org_id = Uuid::new_v4();

    let (key_full, prefix, secret) = generate_api_key();

    let salt = SaltString::generate(&mut OsRng);
    let secret_hash = Argon2::default()
        .hash_password(secret.as_bytes(), &salt)
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Hash error: {}", e),
            )
        })?
        .to_string();

    sqlx::query!(
        r#"
        INSERT INTO organization (
            id,
            name,
            slug,
            "createdBy"
        )
        VALUES ($1, $2, $3, $4)
        "#,
        org_id,
        req.name,
        req.slug,
        req.name
    )
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let apikey_id = Uuid::new_v4();

    sqlx::query!(
        r#"
        INSERT INTO apikey (
            id,
            name,
            "key",
            prefix,
            "userId",
            "organizationId",
            "createdAt",
            "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        "#,
        apikey_id,
        format!("{} API Key", req.name),
        secret_hash,
        prefix,
        api_key.user_id,
        org_id
    )
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok(Json(CreateOrganizationResponse {
        id: org_id,
        api_key: key_full,
    }))
}
