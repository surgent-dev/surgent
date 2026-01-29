use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use chrono;
use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::{AuthenticatedUser, ProjectIdQuery, resolve_project_id};
use crate::types::TransactionType;

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    pub id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    #[serde(rename = "type")]
    pub type_: TransactionType,
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
    pub project_id: Uuid,
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
    path = "/transactions",
    tag = "transaction",
    responses(
        (status = 200, description = "List of transactions", body = Vec<Transaction>),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("project_key" = [])
    )
)]
pub async fn list_transactions(
    State(state): State<crate::AppState>,
    auth: AuthenticatedUser,
    Query(query): Query<ProjectIdQuery>,
) -> Result<Json<Vec<Transaction>>, (StatusCode, String)> {
    let project_id = resolve_project_id(&state.pool, &auth, query.project_id).await?;

    tracing::debug!("Listing transactions for project_id={}", project_id);

    let rows = sqlx::query!(
        r#"
        SELECT
            id,
            "createdAt",
            type as "type_!: TransactionType",
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

    let transactions = rows
        .into_iter()
        .map(|r| Transaction {
            id: r.id,
            created_at: r.createdAt,
            type_: r.type_,
            amount: r.amount,
            currency: r.currency,
            tax_amount: r.taxAmount,
            account_id: r.accountId,
            account_amount: r.accountAmount,
            account_currency: r.accountCurrency,
            presentment_amount: r.presentmentAmount,
            presentment_currency: r.presentmentCurrency,
            presentment_tax_amount: r.presentmentTaxAmount,
            tax_filing_amount: r.taxFilingAmount,
            tax_filing_currency: r.taxFilingCurrency,
            tax_country: r.taxCountry,
            tax_state: r.taxState,
            processor: r.processor,
            charge_id: r.chargeId,
            transfer_id: r.transferId,
            refund_id: r.refundId,
            payout_id: r.payoutId,
            payment_transaction_id: r.paymentTransactionId,
            incurred_by_transaction_id: r.incurredByTransactionId,
            payout_transaction_id: r.payoutTransactionId,
            project_id: r.projectId,
            customer_id: r.customerId,
            product_id: r.productId,
            product_price_id: r.productPriceId,
            subscription_id: r.subscriptionId,
            checkout_session_id: r.checkoutSessionId,
            processor_invoice_id: r.processorInvoiceId,
            metadata: r.metadata,
            succeeded_at: r.succeededAt,
            refunded_at: r.refundedAt,
        })
        .collect();

    Ok(Json(transactions))
}
