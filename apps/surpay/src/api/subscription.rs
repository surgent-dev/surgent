use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono;
use serde::Serialize;
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::{AuthenticatedOrganization, validate_project_ownership};
use crate::types::SubscriptionStatus;

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct Subscription {
    pub id: Uuid,
    pub project_id: Option<Uuid>,
    pub product_id: Option<Uuid>,
    pub product_price_id: Option<Uuid>,
    pub customer_id: Option<Uuid>,
    pub processor_subscription_id: Option<String>,
    pub processor_customer_id: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub deleted_at: Option<chrono::DateTime<chrono::Utc>>,
    pub current_period_start: Option<chrono::DateTime<chrono::Utc>>,
    pub current_period_end: Option<chrono::DateTime<chrono::Utc>>,
    pub canceled_at: Option<chrono::DateTime<chrono::Utc>>,
    pub ended_at: Option<chrono::DateTime<chrono::Utc>>,
    pub status: SubscriptionStatus,
}

/// List subscriptions for a project
#[utoipa::path(
    get,
    path = "/project/{project_id}/subscriptions",
    tag = "subscription",
    params(
        ("project_id" = Uuid, Path, description = "Project ID")
    ),
    responses(
        (status = 200, description = "List of subscriptions", body = Vec<Subscription>),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("org_key" = [])
    )
)]
pub async fn list_subscriptions(
    State(state): State<crate::AppState>,
    AuthenticatedOrganization {
        organization: org, ..
    }: AuthenticatedOrganization,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<Subscription>>, (StatusCode, String)> {
    let pool = &state.pool;
    validate_project_ownership(pool, project_id, &org).await?;

    let subscriptions = sqlx::query_as!(
        Subscription,
        r#"
        SELECT id, project_id, product_id, product_price_id, customer_id,
               processor_subscription_id, processor_customer_id,
               created_at, deleted_at, current_period_start, current_period_end,
               canceled_at, ended_at, status as "status: SubscriptionStatus"
        FROM subscription
        WHERE project_id = $1
        ORDER BY created_at DESC
        "#,
        project_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok(Json(subscriptions))
}
