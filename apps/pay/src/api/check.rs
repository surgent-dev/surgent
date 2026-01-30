use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::{AuthenticatedUser, ProjectIdQuery, resolve_project_id};
use crate::types::SubscriptionStatus;

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CheckRequest {
    pub customer_id: String,
    /// Product identifier - can be UUID or slug
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
        ("session_cookie" = [])
    )
)]
pub async fn check(
    State(pool): State<PgPool>,
    auth: AuthenticatedUser,
    Query(query): Query<ProjectIdQuery>,
    Json(req): Json<CheckRequest>,
) -> Result<Json<CheckResponse>, (StatusCode, String)> {
    tracing::debug!(?req, "Received check request");

    let project_id = resolve_project_id(&pool, &auth, query.project_id).await?;

    // Look up customer by (project_id, external_id)
    let customer = sqlx::query!(
        r#"
        SELECT id
        FROM customer
        WHERE "projectId" = $1 AND "externalId" = $2
        "#,
        project_id,
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

    // Look up product by priority: UUID match > slug match
    let product_uuid = Uuid::parse_str(&req.product_id).ok();
    let product = sqlx::query!(
        r#"
        SELECT id
        FROM product
        WHERE "projectId" = $1
          AND (id = $2 OR slug = $3)
        ORDER BY (id = $2)::int DESC
        LIMIT 1
        "#,
        project_id,
        product_uuid,
        req.product_id
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

    let response = CheckResponse {
        allowed: subscription.is_some(),
    };
    tracing::debug!(?response, "Returning check response");

    Ok(Json(response))
}
