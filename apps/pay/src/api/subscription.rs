use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use tracing::debug;
use uuid::Uuid;

use crate::core::auth::{AuthenticatedUser, ProjectIdQuery, resolve_project_id};
use crate::types::SubscriptionStatus;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Subscription {
    pub id: Uuid,
    #[sqlx(rename = "projectId")]
    pub project_id: Uuid,
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
    path = "/subscriptions",
    tag = "subscription",
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
    auth: AuthenticatedUser,
    Query(query): Query<ProjectIdQuery>,
) -> Result<Json<Vec<Subscription>>, (StatusCode, String)> {
    let project_id = resolve_project_id(&state.pool, &auth, query.project_id).await?;

    debug!("Listing subscriptions for project_id={}", project_id);

    let subscriptions = sqlx::query_as!(
        Subscription,
        r#"
        SELECT id, "projectId" as project_id, "productId" as product_id,
               "productPriceId" as product_price_id, "customerId" as customer_id,
               "processorSubscriptionId" as processor_subscription_id,
               "processorCustomerId" as processor_customer_id,
               "createdAt" as created_at, "deletedAt" as deleted_at,
               "currentPeriodStart" as current_period_start,
               "currentPeriodEnd" as current_period_end,
               "canceledAt" as canceled_at, "endedAt" as ended_at,
               status as "status: SubscriptionStatus"
        FROM subscription
        WHERE "projectId" = $1
        ORDER BY "createdAt" DESC
        "#,
        project_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok(Json(subscriptions))
}
