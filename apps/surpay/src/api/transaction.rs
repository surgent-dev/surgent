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

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct Transaction {
    pub id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "type")]
    pub type_: String,
    pub amount: i64,
    pub currency: String,
    pub tax_amount: Option<i64>,
    pub account_id: Option<Uuid>,
    pub account_amount: Option<i64>,
    pub account_currency: Option<String>,
    pub presentment_amount: Option<i64>,
    pub presentment_currency: Option<String>,
    pub presentment_tax_amount: Option<i64>,
    pub tax_filing_amount: Option<i64>,
    pub tax_filing_currency: Option<String>,
    pub tax_country: Option<String>,
    pub tax_state: Option<String>,
    pub processor: String,
    pub charge_id: Option<String>,
    pub transfer_id: Option<String>,
    pub refund_id: Option<Uuid>,
    pub payout_id: Option<Uuid>,
    pub payment_transaction_id: Option<Uuid>,
    pub incurred_by_transaction_id: Option<Uuid>,
    pub payout_transaction_id: Option<Uuid>,
    pub project_id: Option<Uuid>,
    pub customer_id: Option<Uuid>,
    pub product_id: Option<Uuid>,
    pub product_price_id: Option<Uuid>,
    pub subscription_id: Option<Uuid>,
    pub checkout_session_id: Option<Uuid>,
    pub processor_invoice_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub succeeded_at: Option<chrono::DateTime<chrono::Utc>>,
    pub refunded_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// List transactions for a project
#[utoipa::path(
    get,
    path = "/project/{project_id}/transactions",
    tag = "transaction",
    params(
        ("project_id" = Uuid, Path, description = "Project ID")
    ),
    responses(
        (status = 200, description = "List of transactions", body = Vec<Transaction>),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("org_key" = [])
    )
)]
pub async fn list_transactions(
    State(state): State<crate::AppState>,
    AuthenticatedOrganization {
        organization: org, ..
    }: AuthenticatedOrganization,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<Transaction>>, (StatusCode, String)> {
    let pool = &state.pool;
    validate_project_ownership(pool, project_id, &org).await?;

    let transactions = sqlx::query_as!(
        Transaction,
        r#"
        SELECT
            id,
            created_at,
            type as "type_!: String",
            amount,
            currency,
            tax_amount,
            account_id,
            account_amount,
            account_currency,
            presentment_amount,
            presentment_currency,
            presentment_tax_amount,
            tax_filing_amount,
            tax_filing_currency,
            tax_country,
            tax_state,
            processor,
            charge_id,
            transfer_id,
            refund_id,
            payout_id,
            payment_transaction_id,
            incurred_by_transaction_id,
            payout_transaction_id,
            project_id,
            customer_id,
            product_id,
            product_price_id,
            subscription_id,
            checkout_session_id,
            processor_invoice_id,
            metadata,
            succeeded_at,
            refunded_at
        FROM transaction
        WHERE project_id = $1 AND type = 'payment'
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

    Ok(Json(transactions))
}
