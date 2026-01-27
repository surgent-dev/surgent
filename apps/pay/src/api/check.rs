use axum::{Json, extract::State, http::StatusCode};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use utoipa::ToSchema;

use crate::core::auth::AuthenticatedProject;
use crate::types::SubscriptionStatus;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CheckRequest {
    pub customer_id: String,
    pub product_id: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CheckResponse {
    pub allowed: bool,
}

/// Check if a customer has an active subscription to a product
#[utoipa::path(
    post,
    path = "/check",
    tag = "check",
    request_body = CheckRequest,
    responses(
        (status = 200, description = "Subscription check result", body = CheckResponse),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 404, description = "Product not found"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("project_key" = [])
    )
)]
pub async fn check(
    State(pool): State<PgPool>,
    auth: AuthenticatedProject,
    Json(req): Json<CheckRequest>,
) -> Result<Json<CheckResponse>, (StatusCode, String)> {
    // Look up customer by (project_id, external_id)
    let customer = sqlx::query!(
        r#"
        SELECT id
        FROM customer
        WHERE "projectId" = $1 AND "externalId" = $2
        "#,
        auth.project_id,
        req.customer_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    // Customer not found -> return allowed: false (not an error)
    let customer = match customer {
        Some(c) => c,
        None => return Ok(Json(CheckResponse { allowed: false })),
    };

    // Look up product by slug + project_id
    let product = sqlx::query!(
        r#"
        SELECT id
        FROM product
        WHERE slug = $1 AND "projectId" = $2
        "#,
        req.product_id,
        auth.project_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    // Product not found -> return error
    let product = product.ok_or((
        StatusCode::NOT_FOUND,
        "Product not found or does not belong to this project".to_string(),
    ))?;

    // Query for active or trialing subscription
    let subscription = sqlx::query!(
        r#"
        SELECT id
        FROM subscription
        WHERE "customerId" = $1
          AND "productId" = $2
          AND status = ANY($3::subscription_status[])
        LIMIT 1
        "#,
        customer.id,
        product.id,
        &[SubscriptionStatus::Active, SubscriptionStatus::Trialing] as &[SubscriptionStatus]
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok(Json(CheckResponse {
        allowed: subscription.is_some(),
    }))
}
