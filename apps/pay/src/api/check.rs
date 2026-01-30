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
use crate::types::{CheckoutMode, CheckoutStatus, SubscriptionStatus};

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

/// Check if a customer has access to a product (active subscription or completed purchase)
#[utoipa::path(
    post,
    path = "/check",
    tag = "check",
    request_body = CheckRequest,
    responses(
        (status = 200, description = "Product access check result", body = CheckResponse),
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
          AND "projectId" = $4
        LIMIT 1
        "#,
        customer.id,
        product.id,
        &[SubscriptionStatus::Active, SubscriptionStatus::Trialing] as &[SubscriptionStatus],
        project_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    // Short-circuit: if subscription found, return allowed
    if subscription.is_some() {
        let response = CheckResponse { allowed: true };
        tracing::debug!(?response, "Returning check response (subscription)");
        return Ok(Json(response));
    }

    // Check for completed one-time purchase
    let purchase = sqlx::query!(
        r#"
        SELECT id
        FROM checkout_session
        WHERE "customerId" = $1
          AND "productId" = $2
          AND mode = $3
          AND status = $4
          AND "projectId" = $5
        LIMIT 1
        "#,
        customer.id,
        product.id,
        CheckoutMode::Payment as CheckoutMode,
        CheckoutStatus::Complete as CheckoutStatus,
        project_id
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
        allowed: purchase.is_some(),
    };
    tracing::debug!(?response, "Returning check response");

    Ok(Json(response))
}
