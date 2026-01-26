use axum::{Json, extract::State, http::StatusCode};
use chrono;
use serde::Serialize;
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::AuthenticatedProject;
use crate::types::SubscriptionStatus;

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Subscription {
    pub id: Uuid,
    #[sqlx(rename = "projectId")]
    pub project_id: Option<Uuid>,
    #[sqlx(rename = "productId")]
    pub product_id: Option<Uuid>,
    #[sqlx(rename = "productPriceId")]
    pub product_price_id: Option<Uuid>,
    #[sqlx(rename = "customerId")]
    pub customer_id: Option<Uuid>,
    #[sqlx(rename = "processorSubscriptionId")]
    pub processor_subscription_id: Option<String>,
    #[sqlx(rename = "processorCustomerId")]
    pub processor_customer_id: Option<String>,
    #[sqlx(rename = "createdAt")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[sqlx(rename = "deletedAt")]
    pub deleted_at: Option<chrono::DateTime<chrono::Utc>>,
    #[sqlx(rename = "currentPeriodStart")]
    pub current_period_start: Option<chrono::DateTime<chrono::Utc>>,
    #[sqlx(rename = "currentPeriodEnd")]
    pub current_period_end: Option<chrono::DateTime<chrono::Utc>>,
    #[sqlx(rename = "canceledAt")]
    pub canceled_at: Option<chrono::DateTime<chrono::Utc>>,
    #[sqlx(rename = "endedAt")]
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
        ("project_key" = [])
    )
)]
pub async fn list_subscriptions(
    State(state): State<crate::AppState>,
    auth: AuthenticatedProject,
) -> Result<Json<Vec<Subscription>>, (StatusCode, String)> {
    let pool = &state.pool;

    let subscriptions = sqlx::query_as::<_, Subscription>(
        r#"
        SELECT id, "projectId", "productId", "productPriceId", "customerId",
               "processorSubscriptionId", "processorCustomerId",
               "createdAt", "deletedAt", "currentPeriodStart", "currentPeriodEnd",
               "canceledAt", "endedAt", status as "status: SubscriptionStatus"
        FROM subscription
        WHERE "projectId" = $1
        ORDER BY "createdAt" DESC
        "#,
    )
    .bind(auth.project_id)
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
