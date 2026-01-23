use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono;
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::AuthenticatedOrganization;
use crate::types::{SubscriptionStatus, TransactionType};

use super::subscription::Subscription;

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    pub id: Uuid,
    #[sqlx(rename = "projectId")]
    pub project_id: Option<Uuid>,
    pub email: String,
    pub name: Option<String>,
    #[sqlx(rename = "processorCustomerId")]
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
    pub project_id: Option<Uuid>,
    pub email: String,
    pub name: Option<String>,
    pub processor_customer_id: Option<String>,
    pub transactions: Vec<TransactionSummary>,
    pub subscriptions: Vec<SubscriptionSummary>,
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
        ("org_key" = [])
    )
)]
pub async fn list_customers(
    State(pool): State<PgPool>,
    AuthenticatedOrganization {
        organization: org, ..
    }: AuthenticatedOrganization,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<Customer>>, (StatusCode, String)> {
    let customers = sqlx::query_as::<_, Customer>(
        r#"
        SELECT
            c.id,
            c."projectId",
            c.email,
            c.name,
            c."processorCustomerId"
        FROM customer c
        INNER JOIN project p ON c."projectId" = p.id
        WHERE c."projectId" = $1
          AND p."organizationId" = $2
        "#,
    )
    .bind(project_id)
    .bind(org.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok(Json(customers))
}

/// Get customer with details
#[utoipa::path(
    get,
    path = "/project/{project_id}/customer/{id}",
    tag = "customer",
    params(
        ("project_id" = Uuid, Path, description = "Project ID"),
        ("id" = Uuid, Path, description = "Customer ID")
    ),
    responses(
        (status = 200, description = "Customer with transactions and subscriptions", body = CustomerWithDetails),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 404, description = "Customer not found"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("org_key" = [])
    )
)]
pub async fn get_customer(
    State(pool): State<PgPool>,
    AuthenticatedOrganization {
        organization: org, ..
    }: AuthenticatedOrganization,
    Path((project_id, customer_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<CustomerWithDetails>, (StatusCode, String)> {
    let customer = sqlx::query_as::<_, Customer>(
        r#"
        SELECT
            c.id,
            c."projectId",
            c.email,
            c.name,
            c."processorCustomerId"
        FROM customer c
        INNER JOIN project p ON c."projectId" = p.id
        WHERE c.id = $1
          AND c."projectId" = $2
          AND p."organizationId" = $3
        "#,
    )
    .bind(customer_id)
    .bind(project_id)
    .bind(org.id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let customer = customer.ok_or((StatusCode::NOT_FOUND, "Customer not found".to_string()))?;

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
        customer_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let subscriptions = sqlx::query_as::<_, Subscription>(
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
    )
    .bind(customer_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

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
