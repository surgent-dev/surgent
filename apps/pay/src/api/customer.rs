use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use chrono;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::AppState;
use crate::core::auth::{AuthenticatedUser, verify_project_access};
use crate::types::{SubscriptionStatus, TransactionType};

use super::subscription::Subscription;

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    pub id: Uuid,
    pub project_id: Uuid,
    pub email: String,
    pub name: Option<String>,
    pub processor_customer_id: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TransactionSummary {
    id: Uuid,
    created_at: chrono::DateTime<chrono::Utc>,
    type_: TransactionType,
    amount: i64,
    currency: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SubscriptionSummary {
    id: Uuid,
    created_at: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "currentPeriodStart")]
    current_period_start: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(rename = "currentPeriodEnd")]
    current_period_end: Option<chrono::DateTime<chrono::Utc>>,
    status: SubscriptionStatus,
    #[serde(rename = "processorSubscriptionId")]
    processor_subscription_id: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CustomerWithDetails {
    pub id: Uuid,
    pub project_id: Uuid,
    pub email: String,
    pub name: Option<String>,
    pub processor_customer_id: Option<String>,
    pub transactions: Vec<TransactionSummary>,
    pub subscriptions: Vec<SubscriptionSummary>,
}

#[derive(Debug, Deserialize)]
pub struct ListCustomersQuery {
    pub project_id: Uuid,
}

/// List customers for a project
#[utoipa::path(
    get,
    path = "/project/{project_id}/customers",
    tag = "customer",
    params(
        ("project_id" = Uuid, Path, description = "Project ID")
    ),
    responses(
        (status = 200, description = "List of customers", body = Vec<Customer>),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("project_key" = [])
    )
)]
pub async fn list_customers(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(query): Query<ListCustomersQuery>,
) -> Result<Json<Vec<Customer>>, (StatusCode, String)> {
    verify_project_access(&state.pool, auth.user_id, query.project_id).await?;

    let rows = sqlx::query!(
        r#"
        SELECT
            c.id,
            c."projectId",
            c.email,
            c.name,
            c."processorCustomerId"
        FROM customer c
        WHERE c."projectId" = $1
        "#,
        query.project_id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let customers = rows
        .into_iter()
        .map(|r| Customer {
            id: r.id,
            project_id: r.projectId,
            email: r.email,
            name: r.name,
            processor_customer_id: r.processorCustomerId,
        })
        .collect();

    Ok(Json(customers))
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct GetCustomerParams {
    #[allow(dead_code)]
    project_id: Uuid,
    id: Uuid,
}

/// Get customer with details
#[utoipa::path(
    get,
    path = "/project/{project_id}/customer/{id}",
    tag = "customer",
    params(GetCustomerParams),
    responses(
        (status = 200, description = "Customer with transactions and subscriptions", body = CustomerWithDetails),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 404, description = "Customer not found"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("project_key" = [])
    )
)]
pub async fn get_customer(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(params): Path<GetCustomerParams>,
) -> Result<Json<CustomerWithDetails>, (StatusCode, String)> {
    let row = sqlx::query!(
        r#"
        SELECT
            c.id,
            c."projectId",
            c.email,
            c.name,
            c."processorCustomerId"
        FROM customer c
        WHERE c.id = $1
        "#,
        params.id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let row = row.ok_or((StatusCode::NOT_FOUND, "Customer not found".to_string()))?;
    let customer = Customer {
        id: row.id,
        project_id: row.projectId,
        email: row.email,
        name: row.name,
        processor_customer_id: row.processorCustomerId,
    };

    // Verify access via customer's project
    verify_project_access(&state.pool, auth.user_id, row.projectId).await?;

    let transactions = sqlx::query!(
        r#"
        SELECT
            t.id,
            t."createdAt",
            t.type as "type_: TransactionType",
            t.amount,
            t.currency
        FROM transaction t
        WHERE t."customerId" = $1
          AND t.type = 'payment'
        ORDER BY t."createdAt" DESC
        "#,
        params.id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let subscription_rows = sqlx::query!(
        r#"
        SELECT
            s.id,
            s."projectId",
            s."productId",
            s."productPriceId",
            s."customerId",
            s."processorSubscriptionId",
            s."processorCustomerId",
            s."createdAt",
            s."deletedAt",
            s."currentPeriodStart",
            s."currentPeriodEnd",
            s."canceledAt",
            s."endedAt",
            s.status as "status: SubscriptionStatus"
        FROM subscription s
        WHERE s."customerId" = $1
        ORDER BY s."createdAt" DESC
        "#,
        params.id
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let subscriptions: Vec<Subscription> = subscription_rows
        .into_iter()
        .map(|r| Subscription {
            id: r.id,
            project_id: r.projectId,
            product_id: r.productId,
            product_price_id: r.productPriceId,
            customer_id: r.customerId,
            processor_subscription_id: r.processorSubscriptionId,
            processor_customer_id: r.processorCustomerId,
            created_at: r.createdAt,
            deleted_at: r.deletedAt,
            current_period_start: r.currentPeriodStart,
            current_period_end: r.currentPeriodEnd,
            canceled_at: r.canceledAt,
            ended_at: r.endedAt,
            status: r.status,
        })
        .collect();

    Ok(Json(CustomerWithDetails {
        id: customer.id,
        project_id: customer.project_id,
        email: customer.email,
        name: customer.name,
        processor_customer_id: customer.processor_customer_id,
        transactions: transactions
            .into_iter()
            .map(|t| TransactionSummary {
                id: t.id,
                created_at: t.createdAt,
                type_: t.type_,
                amount: t.amount,
                currency: t.currency,
            })
            .collect(),
        subscriptions: subscriptions
            .into_iter()
            .map(|s| SubscriptionSummary {
                id: s.id,
                created_at: s.created_at,
                current_period_start: s.current_period_start,
                current_period_end: s.current_period_end,
                status: s.status,
                processor_subscription_id: s.processor_subscription_id,
            })
            .collect(),
    }))
}
