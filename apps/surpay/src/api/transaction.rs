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
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: Uuid,
    #[sqlx(rename = "createdAt")]
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "type")]
    pub type_: String,
    pub amount: i64,
    pub currency: String,
    #[sqlx(rename = "taxAmount")]
    pub tax_amount: Option<i64>,
    #[sqlx(rename = "accountId")]
    pub account_id: Option<Uuid>,
    #[sqlx(rename = "accountAmount")]
    pub account_amount: Option<i64>,
    #[sqlx(rename = "accountCurrency")]
    pub account_currency: Option<String>,
    #[sqlx(rename = "presentmentAmount")]
    pub presentment_amount: Option<i64>,
    #[sqlx(rename = "presentmentCurrency")]
    pub presentment_currency: Option<String>,
    #[sqlx(rename = "presentmentTaxAmount")]
    pub presentment_tax_amount: Option<i64>,
    #[sqlx(rename = "taxFilingAmount")]
    pub tax_filing_amount: Option<i64>,
    #[sqlx(rename = "taxFilingCurrency")]
    pub tax_filing_currency: Option<String>,
    #[sqlx(rename = "taxCountry")]
    pub tax_country: Option<String>,
    #[sqlx(rename = "taxState")]
    pub tax_state: Option<String>,
    pub processor: String,
    #[sqlx(rename = "chargeId")]
    pub charge_id: Option<String>,
    #[sqlx(rename = "transferId")]
    pub transfer_id: Option<String>,
    #[sqlx(rename = "refundId")]
    pub refund_id: Option<Uuid>,
    #[sqlx(rename = "payoutId")]
    pub payout_id: Option<Uuid>,
    #[sqlx(rename = "paymentTransactionId")]
    pub payment_transaction_id: Option<Uuid>,
    #[sqlx(rename = "incurredByTransactionId")]
    pub incurred_by_transaction_id: Option<Uuid>,
    #[sqlx(rename = "payoutTransactionId")]
    pub payout_transaction_id: Option<Uuid>,
    #[sqlx(rename = "projectId")]
    pub project_id: Option<Uuid>,
    #[sqlx(rename = "customerId")]
    pub customer_id: Option<Uuid>,
    #[sqlx(rename = "productId")]
    pub product_id: Option<Uuid>,
    #[sqlx(rename = "productPriceId")]
    pub product_price_id: Option<Uuid>,
    #[sqlx(rename = "subscriptionId")]
    pub subscription_id: Option<Uuid>,
    #[sqlx(rename = "checkoutSessionId")]
    pub checkout_session_id: Option<Uuid>,
    #[sqlx(rename = "processorInvoiceId")]
    pub processor_invoice_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
    #[sqlx(rename = "succeededAt")]
    pub succeeded_at: Option<chrono::DateTime<chrono::Utc>>,
    #[sqlx(rename = "refundedAt")]
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

    let transactions = sqlx::query_as::<_, Transaction>(
        r#"
        SELECT
            id,
            "createdAt",
            type as "type_!: String",
            amount,
            currency,
            "taxAmount",
            "accountId",
            "accountAmount",
            "accountCurrency",
            "presentmentAmount",
            "presentmentCurrency",
            "presentmentTaxAmount",
            "taxFilingAmount",
            "taxFilingCurrency",
            "taxCountry",
            "taxState",
            processor,
            "chargeId",
            "transferId",
            "refundId",
            "payoutId",
            "paymentTransactionId",
            "incurredByTransactionId",
            "payoutTransactionId",
            "projectId",
            "customerId",
            "productId",
            "productPriceId",
            "subscriptionId",
            "checkoutSessionId",
            "processorInvoiceId",
            metadata,
            "succeededAt",
            "refundedAt"
        FROM transaction
        WHERE "projectId" = $1 AND type = 'payment'
        ORDER BY "createdAt" DESC
        "#,
    )
    .bind(project_id)
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
