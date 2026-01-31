use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;
use std::time::Duration;
use tokio::time::sleep;
use uuid::Uuid;

use crate::core::config::Config;
use crate::integrations::stripe::fetch_customer_subscriptions_with_payment_means;
use crate::integrations::types::NormalizedEvent;
use crate::types::{CheckoutMode, CheckoutStatus, RefundStatus, SubscriptionStatus};

struct CreateSubscriptionParams<'a> {
    project_id: Uuid,
    product_id: Option<Uuid>,
    price_id: Option<Uuid>,
    customer_id: Uuid,
    processor: &'a str,
    processor_subscription_id: &'a str,
    processor_customer_id: Option<&'a str>,
}

/// Validates processor name to prevent injection attacks
/// Rules: 1-32 chars, lowercase a-z, digits 0-9, underscores, must start with letter
pub fn is_valid_processor_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 32 {
        return false;
    }

    let mut chars = name.chars();

    // First character must be a lowercase letter
    match chars.next() {
        Some(c) if c.is_ascii_lowercase() => {}
        _ => return false,
    }

    // Remaining characters: lowercase letters, digits, or underscores
    chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

/// Webhook errors
#[derive(Debug)]
pub enum WebhookError {
    MissingHeader,
    VerificationFailed,
    MissingEventId,
    EnqueueFailed,
}

impl axum::response::IntoResponse for WebhookError {
    fn into_response(self) -> axum::response::Response {
        match self {
            WebhookError::MissingHeader => (StatusCode::BAD_REQUEST, "Bad request").into_response(),
            WebhookError::VerificationFailed => {
                (StatusCode::UNAUTHORIZED, "Unauthorized").into_response()
            }
            WebhookError::MissingEventId => {
                (StatusCode::BAD_REQUEST, "Missing event id in payload").into_response()
            }
            WebhookError::EnqueueFailed => {
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error").into_response()
            }
        }
    }
}

const VISIBILITY_TIMEOUT_SECS: i32 = 120;
const MAX_QUEUE_ERRORS: i32 = 5;

// lifetime here is required because it contains 2 borrowed Strings
// thus they cannot outlive the original objects
struct PaymentTransactionParams<'a> {
    project_id: Uuid,
    customer_id: Uuid,
    product_id: Option<Uuid>,
    price_id: Option<Uuid>,
    checkout_id: Uuid,
    charge_id: &'a str,
    amount: i64,
    currency: &'a str,
    processor: &'a str,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookMessage {
    pub processor: String,
    pub event_id: String,
    pub event: NormalizedEvent,
    pub raw_payload: Value,
    pub received_at: DateTime<Utc>,
}

// Processor agnostic webhook handler
pub async fn webhook_handler(
    Path(processor): Path<String>,
    State(state): State<crate::AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, WebhookError> {
    tracing::info!("webhook_handler called for processor: {}", processor);

    if !is_valid_processor_name(&processor) {
        tracing::error!("Invalid processor name: {}", processor);
        return Err(WebhookError::VerificationFailed);
    }

    let p = state.registry.get(&processor).await.ok_or_else(|| {
        tracing::error!("Processor not found in registry: {}", processor);
        WebhookError::VerificationFailed
    })?;

    let signature = get_signature_header(&headers, &processor)?;

    let is_valid = p.verify_webhook(&body, &signature).map_err(|e| {
        tracing::error!(
            "Webhook signature verification failed for processor {}: {}",
            processor,
            e
        );
        WebhookError::VerificationFailed
    })?;

    if !is_valid {
        tracing::error!("Invalid webhook signature for processor: {}", processor);
        return Err(WebhookError::VerificationFailed);
    }

    let payload: Value = serde_json::from_slice(&body).map_err(|e| {
        tracing::error!(
            "Failed to parse webhook JSON payload for processor {}: {}",
            processor,
            e
        );
        WebhookError::VerificationFailed
    })?;

    let event = p.parse_webhook_event(&payload).map_err(|e| {
        tracing::error!(
            "Failed to parse webhook event for processor {}: {}",
            processor,
            e
        );
        WebhookError::VerificationFailed
    })?;

    let event_id = extract_event_id(&payload, &processor).map_err(|e| {
        tracing::error!(
            "Failed to extract event id for processor {}: {}",
            processor,
            e
        );
        WebhookError::MissingEventId
    })?;

    let message = WebhookMessage {
        processor: processor.clone(),
        event_id: event_id.clone(),
        event,
        raw_payload: payload,
        received_at: Utc::now(),
    };

    crate::core::sqs::send_message(
        &state.sqs_client,
        &state.config.sqs_webhooks_queue_url,
        &message,
    )
    .await
    .map_err(|e| {
        tracing::error!(
            "Failed to enqueue webhook for processor {} (event: {}, queue: {}): {}",
            processor,
            event_id,
            state.config.sqs_webhooks_queue_url,
            e
        );
        WebhookError::EnqueueFailed
    })?;

    tracing::info!(
        "Enqueued webhook event {} for processor {}",
        event_id,
        processor
    );
    Ok(StatusCode::OK)
}

fn get_signature_header(headers: &HeaderMap, processor: &str) -> Result<String, WebhookError> {
    match processor {
        "stripe" => headers
            .get("stripe-signature")
            .and_then(|h| h.to_str().ok())
            .map(String::from)
            .ok_or(WebhookError::MissingHeader),
        "whop" => {
            // Whop uses Standard Webhooks v1.0.0 spec with 3 headers
            let webhook_id = headers
                .get("webhook-id")
                .and_then(|h| h.to_str().ok())
                .ok_or(WebhookError::MissingHeader)?;
            let webhook_timestamp = headers
                .get("webhook-timestamp")
                .and_then(|h| h.to_str().ok())
                .ok_or(WebhookError::MissingHeader)?;
            let webhook_signature = headers
                .get("webhook-signature")
                .and_then(|h| h.to_str().ok())
                .ok_or(WebhookError::MissingHeader)?;
            Ok(format!(
                "{};{};{}",
                webhook_id, webhook_timestamp, webhook_signature
            ))
        }
        _ => Err(WebhookError::VerificationFailed),
    }
}

fn extract_event_id(payload: &Value, processor: &str) -> Result<String, String> {
    payload["id"]
        .as_str()
        .ok_or_else(|| format!("Missing event id in payload for processor {}", processor))
        .map(|s| s.to_string())
}

fn get_event_type_name(event: &NormalizedEvent) -> String {
    match event {
        NormalizedEvent::AccountUpdated { .. } => "account_updated".to_string(),
        NormalizedEvent::AccountDeauthorized { .. } => "account_deauthorized".to_string(),
        NormalizedEvent::PaymentSucceeded { .. } => "payment_succeeded".to_string(),
        NormalizedEvent::PaymentFailed { .. } => "payment_failed".to_string(),
        NormalizedEvent::CheckoutCompleted { .. } => "checkout_completed".to_string(),
        NormalizedEvent::CheckoutExpired { .. } => "checkout_expired".to_string(),
        NormalizedEvent::SubscriptionCreated { .. } => "subscription_created".to_string(),
        NormalizedEvent::SubscriptionUpdated { .. } => "subscription_updated".to_string(),
        NormalizedEvent::SubscriptionCanceled { .. } => "subscription_canceled".to_string(),
        NormalizedEvent::PayoutCompleted { .. } => "payout_completed".to_string(),
        NormalizedEvent::PayoutFailed { .. } => "payout_failed".to_string(),
        NormalizedEvent::DisputeCreated { .. } => "dispute_created".to_string(),
        NormalizedEvent::DisputeClosed { .. } => "dispute_closed".to_string(),
        NormalizedEvent::InvoicePaid { .. } => "invoice_paid".to_string(),
        NormalizedEvent::InvoicePaymentFailed { .. } => "invoice_payment_failed".to_string(),
        NormalizedEvent::TransferCreated { .. } => "transfer_created".to_string(),
        NormalizedEvent::TransferPaid { .. } => "transfer_paid".to_string(),
        NormalizedEvent::TransferReversed { .. } => "transfer_reversed".to_string(),
        NormalizedEvent::ChargeRefunded { .. } => "charge_refunded".to_string(),
        NormalizedEvent::Unknown { event_type } => event_type.clone(),
    }
}

pub struct WebhookWorker {
    pool: PgPool,
    sqs_client: aws_sdk_sqs::Client,
    webhooks_queue_url: String,
    config: Config,
}

impl WebhookWorker {
    pub async fn new(pool: PgPool, sqs_client: aws_sdk_sqs::Client, config: Config) -> Self {
        Self {
            pool,
            sqs_client,
            webhooks_queue_url: config.sqs_webhooks_queue_url.clone(),
            config,
        }
    }

    pub async fn run(&self) -> Result<(), String> {
        tracing::info!("Starting webhook worker");
        let mut consecutive_queue_errors = 0;

        loop {
            let msg_result = crate::core::sqs::receive_messages(
                &self.sqs_client,
                &self.webhooks_queue_url,
                VISIBILITY_TIMEOUT_SECS,
                1,
            )
            .await;

            match msg_result {
                Ok(messages) => {
                    consecutive_queue_errors = 0;
                    if let Some(msg) = messages.first() {
                        if let Some(message_id) = msg.message_id() {
                            tracing::debug!("Received webhook message from queue: {}", message_id);
                        }
                        if let Err(e) = self.process_message_with_retry(msg.clone()).await {
                            tracing::error!("Error processing webhook message: {}", e);
                        }
                    } else {
                        sleep(Duration::from_secs(1)).await;
                    }
                }
                Err(e) => {
                    consecutive_queue_errors += 1;
                    tracing::error!(
                        "Error receiving from queue {} (attempt {}): {}",
                        self.webhooks_queue_url,
                        consecutive_queue_errors,
                        e
                    );
                    if consecutive_queue_errors >= MAX_QUEUE_ERRORS {
                        return Err(format!(
                            "Fatal: {} consecutive queue read failures from {}: {}",
                            MAX_QUEUE_ERRORS, self.webhooks_queue_url, e
                        ));
                    }
                    sleep(Duration::from_secs(1)).await;
                }
            }
        }
    }

    async fn process_message(&self, msg: &aws_sdk_sqs::types::Message) -> Result<(), String> {
        let payload: WebhookMessage = serde_json::from_str(msg.body().unwrap_or_default())
            .map_err(|e| format!("Failed to parse message body: {}", e))?;

        // Atomic idempotency check: INSERT returns row only if we won the race
        let inserted = sqlx::query!(
            r#"
            INSERT INTO processed_webhook_event (processor, "processorEventId", "eventType", "processedAt")
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (processor, "processorEventId") DO NOTHING
            RETURNING "processorEventId"
            "#,
            &payload.processor,
            &payload.event_id,
            &get_event_type_name(&payload.event)
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        if inserted.is_none() {
            tracing::info!("Event {} already processed, skipping", payload.event_id);
            let receipt_handle = msg.receipt_handle().ok_or("Missing receipt handle")?;
            self.delete_message(receipt_handle).await;
            return Ok(());
        }

        // Process the normalized event (we won the race)
        handle_normalized_event(
            &self.pool,
            &self.config,
            &payload.processor,
            &payload.event,
            &payload.raw_payload,
        )
        .await?;

        tracing::debug!("Successfully processed webhook event {}", payload.event_id);
        let receipt_handle = msg.receipt_handle().ok_or("Missing receipt handle")?;
        self.delete_message(receipt_handle).await;
        Ok(())
    }

    async fn delete_message(&self, receipt_handle: &str) {
        if let Err(e) = crate::core::sqs::delete_message(
            &self.sqs_client,
            &self.webhooks_queue_url,
            receipt_handle,
        )
        .await
        {
            tracing::error!(
                "Failed to delete message from queue {}: {}",
                self.webhooks_queue_url,
                e
            );
        }
    }

    async fn process_message_with_retry(
        &self,
        msg: aws_sdk_sqs::types::Message,
    ) -> Result<(), String> {
        match self.process_message(&msg).await {
            Ok(()) => Ok(()),
            Err(e) => {
                // Don't delete - SQS will retry based on visibility timeout
                // After maxReceiveCount, SQS moves to DLQ automatically
                Err(e)
            }
        }
    }
}

/// Process a webhook message directly (for testing - bypasses queue)
pub async fn process_webhook_message_directly(
    pool: &PgPool,
    config: &Config,
    msg: WebhookMessage,
) -> Result<(), String> {
    // Atomic idempotency check: INSERT returns row only if we won the race
    let inserted = sqlx::query!(
        r#"
        INSERT INTO processed_webhook_event (processor, "processorEventId", "eventType", "processedAt")
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (processor, "processorEventId") DO NOTHING
        RETURNING "processorEventId"
        "#,
        &msg.processor,
        &msg.event_id,
        &get_event_type_name(&msg.event)
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if inserted.is_none() {
        return Ok(());
    }

    // Process the normalized event (we won the race)
    handle_normalized_event(pool, config, &msg.processor, &msg.event, &msg.raw_payload).await
}

fn extract_customer_id_from_payload(payload: &Value) -> Result<&str, String> {
    payload["data"]["object"]["customer"]
        .as_str()
        .ok_or_else(|| "Missing customer_id in payload".to_string())
}

async fn handle_normalized_event(
    pool: &PgPool,
    config: &Config,
    processor: &str,
    event: &NormalizedEvent,
    raw_payload: &Value,
) -> Result<(), String> {
    match event {
        NormalizedEvent::CheckoutCompleted { session_id: _, .. } => {
            // Use raw_payload for full data extraction (existing logic)
            handle_checkout_completed(pool, processor, raw_payload).await
        }
        NormalizedEvent::CheckoutExpired { session_id: _ } => {
            handle_checkout_expired(pool, raw_payload).await
        }
        NormalizedEvent::SubscriptionCreated { customer_id: _, .. }
        | NormalizedEvent::SubscriptionUpdated { customer_id: _, .. }
        | NormalizedEvent::SubscriptionCanceled { .. } => {
            // Extract customer_id from raw payload for sync
            if processor == "stripe" {
                if let Ok(cust_id) = extract_customer_id_from_payload(raw_payload) {
                    sync_stripe_customer_data(pool, config, cust_id).await
                } else {
                    tracing::warn!("Could not extract customer_id for subscription event");
                    Ok(())
                }
            } else {
                tracing::debug!("Skipping Stripe sync for processor: {}", processor);
                Ok(())
            }
        }
        NormalizedEvent::InvoicePaid { customer_id, .. } => {
            // First handle invoice-specific logic, then sync customer data
            handle_invoice_paid(pool, processor, raw_payload).await?;
            if processor == "stripe" {
                sync_stripe_customer_data(pool, config, customer_id).await
            } else {
                tracing::debug!("Skipping Stripe sync for processor: {}", processor);
                Ok(())
            }
        }
        NormalizedEvent::InvoicePaymentFailed { customer_id, .. } => {
            if processor == "stripe" {
                sync_stripe_customer_data(pool, config, customer_id).await
            } else {
                tracing::debug!("Skipping Stripe sync for processor: {}", processor);
                Ok(())
            }
        }
        NormalizedEvent::PaymentSucceeded { .. } | NormalizedEvent::PaymentFailed { .. } => {
            // Extract customer_id from raw payload for sync
            if processor == "stripe" {
                if let Ok(cust_id) = extract_customer_id_from_payload(raw_payload) {
                    sync_stripe_customer_data(pool, config, cust_id).await
                } else {
                    tracing::debug!("No customer_id in payment event, skipping sync");
                    Ok(())
                }
            } else {
                tracing::debug!("Skipping Stripe sync for processor: {}", processor);
                Ok(())
            }
        }
        NormalizedEvent::AccountUpdated {
            account_id,
            capabilities,
            details_submitted,
            charges_enabled,
            payouts_enabled,
        } => {
            let result = sqlx::query!(
                r#"
                UPDATE connect_account
                SET "chargesEnabled" = $1,
                    "detailsSubmitted" = $2,
                    "isPayoutsEnabled" = $3,
                    status = CASE
                        WHEN $1 AND $3 AND $4 AND $5 THEN 'active'
                        ELSE status
                    END
                WHERE "processorAccountId" = $6
                "#,
                charges_enabled,
                details_submitted,
                payouts_enabled,
                capabilities.card_payments,
                capabilities.transfers,
                account_id
            )
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to update account: {}", e))?;

            if result.rows_affected() == 0 {
                tracing::warn!("Account {} not found for AccountUpdated event", account_id);
            } else {
                tracing::info!(
                    "Updated account {} with charges_enabled={}",
                    account_id,
                    charges_enabled
                );
            }
            Ok(())
        }
        NormalizedEvent::AccountDeauthorized { account_id } => {
            let result = sqlx::query!(
                r#"UPDATE connect_account SET status = 'deauthorized' WHERE "processorAccountId" = $1"#,
                account_id
            )
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to update account: {}", e))?;

            if result.rows_affected() == 0 {
                tracing::warn!(
                    "Account {} not found for AccountDeauthorized event",
                    account_id
                );
            } else {
                tracing::info!("Deauthorized account {}", account_id);
            }
            Ok(())
        }
        NormalizedEvent::PayoutCompleted {
            payout_id,
            account_id: _,
        } => {
            let result = sqlx::query!(
                r#"
                UPDATE payout
                SET status = 'paid'::payout_status,
                    "paidAt" = NOW()
                WHERE "processorPayoutId" = $1
                "#,
                payout_id
            )
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to update payout: {}", e))?;

            if result.rows_affected() == 0 {
                tracing::warn!("Payout {} not found for PayoutCompleted event", payout_id);
            } else {
                tracing::info!("Marked payout {} as paid", payout_id);
            }
            Ok(())
        }
        NormalizedEvent::PayoutFailed { payout_id, error } => {
            let result = sqlx::query!(
                r#"
                UPDATE payout
                SET status = 'failed'::payout_status
                WHERE "processorPayoutId" = $1 AND status != 'paid'
                "#,
                payout_id
            )
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to update payout: {}", e))?;

            if result.rows_affected() == 0 {
                tracing::warn!("Payout {} not found for PayoutFailed event", payout_id);
            } else {
                tracing::warn!("Payout {} failed: {}", payout_id, error);
            }
            Ok(())
        }
        NormalizedEvent::TransferCreated { transfer_id, .. } => {
            tracing::info!("Transfer created event received: {}", transfer_id);
            Ok(())
        }
        NormalizedEvent::TransferPaid { transfer_id } => {
            let result = sqlx::query!(
                r#"
                UPDATE transfer
                SET status = 'paid'
                WHERE "processorTransferId" = $1 AND status != 'reversed'
                "#,
                transfer_id
            )
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to update transfer: {}", e))?;

            if result.rows_affected() == 0 {
                tracing::warn!("Transfer {} not found for TransferPaid event", transfer_id);
            } else {
                tracing::info!("Marked transfer {} as paid", transfer_id);
            }
            Ok(())
        }
        NormalizedEvent::TransferReversed {
            transfer_id,
            reversal_id,
        } => {
            let result = sqlx::query!(
                r#"
                UPDATE transfer
                SET status = 'reversed',
                    "reversalId" = $1,
                    "reversedAt" = NOW()
                WHERE "processorTransferId" = $2
                "#,
                reversal_id,
                transfer_id
            )
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to update transfer: {}", e))?;

            if result.rows_affected() == 0 {
                tracing::warn!(
                    "Transfer {} not found for TransferReversed event",
                    transfer_id
                );
            } else {
                tracing::info!("Marked transfer {} as reversed", transfer_id);
            }
            Ok(())
        }
        NormalizedEvent::DisputeCreated { dispute_id, .. } => {
            tracing::info!("Dispute created event received: {}", dispute_id);
            Ok(())
        }
        NormalizedEvent::DisputeClosed { dispute_id, .. } => {
            tracing::info!("Dispute closed event received: {}", dispute_id);
            Ok(())
        }
        NormalizedEvent::ChargeRefunded { .. } => {
            handle_charge_refunded(pool, processor, event).await
        }
        NormalizedEvent::Unknown { event_type } => {
            // Catch-all for Stripe subscription/invoice/payment events not explicitly mapped
            // These trigger a full customer data sync from Stripe (legacy behavior)
            if processor == "stripe"
                && (event_type.starts_with("customer.subscription.")
                    || event_type.starts_with("invoice.")
                    || event_type.starts_with("payment_intent."))
                && let Ok(cust_id) = extract_customer_id_from_payload(raw_payload)
            {
                tracing::info!(
                    "Unknown event {} triggering customer sync for {}",
                    event_type,
                    cust_id
                );
                return sync_stripe_customer_data(pool, config, cust_id).await;
            }
            tracing::debug!("Ignoring unknown event type: {}", event_type);
            Ok(())
        }
    }
}

async fn handle_invoice_paid(
    pool: &PgPool,
    processor: &str,
    raw_payload: &Value,
) -> Result<(), String> {
    let object = &raw_payload["data"]["object"];

    let stripe_invoice_id = object["id"].as_str().ok_or("Missing invoice id")?;
    let processor_customer_id = object["customer"].as_str().ok_or("Missing customer id")?;
    let processor_subscription_id = object["subscription"].as_str();
    let amount = object["amount_paid"].as_i64().unwrap_or(0);
    let currency = object["currency"].as_str().unwrap_or("usd");
    let hosted_url = object["hosted_invoice_url"].as_str();
    let period_start = object["period_start"]
        .as_i64()
        .and_then(|ts| DateTime::from_timestamp(ts, 0));
    let period_end = object["period_end"]
        .as_i64()
        .and_then(|ts| DateTime::from_timestamp(ts, 0));
    let items = if object["lines"]["data"].is_array() {
        object["lines"]["data"].clone()
    } else {
        Value::Array(vec![])
    };

    // Single query: customer + subscription via LEFT JOIN
    let row = sqlx::query!(
        r#"
        SELECT c.id as customer_id, c."projectId" as project_id,
               s.id as "subscription_id?", s."productId" as "product_id?", s."productPriceId" as "price_id?"
        FROM customer c
        LEFT JOIN subscription s ON s."processorSubscriptionId" = $2
        WHERE c."processorCustomerId" = $1
        "#,
        processor_customer_id,
        processor_subscription_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to fetch customer: {}", e))?;

    let Some(row) = row else {
        tracing::warn!(
            "Customer {} not found, skipping invoice_paid",
            processor_customer_id
        );
        return Ok(());
    };

    let result = sqlx::query!(
        r#"
        INSERT INTO transaction (id, "createdAt", type, amount, currency, processor,
            "projectId", "customerId", "productId", "productPriceId",
            "subscriptionId", "processorInvoiceId", "succeededAt")
        VALUES (gen_random_uuid(), NOW(), 'payment', $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT ("processorInvoiceId") WHERE "processorInvoiceId" IS NOT NULL AND "type" = 'payment' DO NOTHING
        "#,
        amount,
        currency,
        processor,
        row.project_id,
        row.customer_id,
        row.product_id,
        row.price_id,
        row.subscription_id,
        stripe_invoice_id
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create transaction: {}", e))?;

    if result.rows_affected() == 0 {
        tracing::info!(
            "Transaction for invoice {} already exists, skipping",
            stripe_invoice_id
        );
    }

    // Upsert invoice
    sqlx::query!(
        r#"
        INSERT INTO invoice (id, "customerId", "subscriptionId", "stripeId", status,
            "hostedInvoiceUrl", total, currency, items, "periodStart", "periodEnd", "paidAt", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, 'paid', $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT ("stripeId") DO UPDATE SET
            status = 'paid', "paidAt" = NOW(), total = $5,
            "hostedInvoiceUrl" = $4, "periodStart" = $8, "periodEnd" = $9, items = $7
        "#,
        row.customer_id,
        row.subscription_id,
        stripe_invoice_id,
        hosted_url,
        amount,
        currency,
        items,
        period_start,
        period_end
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to upsert invoice: {}", e))?;

    tracing::info!("Processed invoice_paid for {}", stripe_invoice_id);
    Ok(())
}

async fn handle_charge_refunded(
    pool: &PgPool,
    processor: &str,
    event: &NormalizedEvent,
) -> Result<(), String> {
    let (charge_id, refund_id, amount, currency, status, reason, processor_customer_id) =
        match event {
            NormalizedEvent::ChargeRefunded {
                charge_id,
                refund_id,
                amount,
                currency,
                status,
                reason,
                customer_id,
            } => (
                charge_id.as_str(),
                refund_id.as_str(),
                *amount,
                currency.as_str(),
                *status,
                reason.as_deref(),
                customer_id.as_deref(),
            ),
            _ => return Err("Expected ChargeRefunded event".to_string()),
        };

    // Try to look up customer by processorCustomerId
    let customer_lookup: Option<(Uuid, Uuid)> = if let Some(cust_id) = processor_customer_id {
        sqlx::query!(
            r#"SELECT id, "projectId" FROM customer WHERE "processorCustomerId" = $1"#,
            cust_id
        )
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Failed to fetch customer: {}", e))?
        .map(|row| (row.id, row.projectId))
    } else {
        None
    };

    // If customer lookup failed, try to find project_id from transaction by charge_id
    let (customer_id, project_id) = match customer_lookup {
        Some((cid, pid)) => (Some(cid), Some(pid)),
        None => {
            let tx_row = sqlx::query!(
                r#"SELECT "customerId", "projectId" FROM transaction WHERE "chargeId" = $1"#,
                charge_id
            )
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Failed to fetch transaction: {}", e))?;

            match tx_row {
                Some(row) => (row.customerId, Some(row.projectId)),
                None => (None, None),
            }
        }
    };

    let project_id = match project_id {
        Some(pid) => pid,
        None => {
            tracing::warn!(
                "Could not determine project_id for refund {}, skipping",
                refund_id
            );
            return Ok(());
        }
    };

    let result = sqlx::query!(
        r#"
        INSERT INTO refund (id, "createdAt", amount, currency, reason, status, processor, "processorId", "projectId", "customerId")
        VALUES (gen_random_uuid(), NOW(), $1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT ("processorId") WHERE "processorId" IS NOT NULL DO NOTHING
        "#,
        amount,
        currency,
        reason,
        status as RefundStatus,
        processor,
        refund_id,
        project_id,
        customer_id
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to insert refund: {}", e))?;

    if result.rows_affected() == 0 {
        tracing::info!("Refund {} already exists, skipping", refund_id);
        return Ok(());
    }

    tracing::info!(
        "Created refund {} for charge {} (project: {})",
        refund_id,
        charge_id,
        project_id
    );

    Ok(())
}

async fn handle_checkout_expired(pool: &PgPool, payload: &Value) -> Result<(), String> {
    let session_id = payload["data"]["object"]["id"]
        .as_str()
        .ok_or("Missing session id")?;

    sqlx::query!(
        r#"UPDATE checkout_session SET status = 'expired' WHERE "processorCheckoutId" = $1 AND status != 'complete'"#,
        session_id
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update checkout session: {}", e))?;

    tracing::info!("Marked checkout session {} as expired", session_id);
    Ok(())
}

struct CheckoutData<'a> {
    processor_checkout_id: &'a str,
    customer_email: Option<&'a str>,
    customer_name: Option<&'a str>,
    processor_customer_id: Option<&'a str>,
    mode: CheckoutMode,
    payment_intent: Option<&'a str>,
    subscription: Option<&'a str>,
    amount_total: i64,
    currency: &'a str,
}

fn parse_checkout_data(payload: &Value) -> Result<CheckoutData<'_>, String> {
    let object = &payload["data"]["object"];
    let mode_str = object["mode"].as_str().ok_or("Missing mode")?;
    let mode = match mode_str {
        "payment" => CheckoutMode::Payment,
        "subscription" => CheckoutMode::Subscription,
        "setup" => CheckoutMode::Setup,
        _ => return Err(format!("Unknown checkout mode: {}", mode_str)),
    };

    Ok(CheckoutData {
        processor_checkout_id: object["id"].as_str().ok_or("Missing session id")?,
        customer_email: object["customer_email"]
            .as_str()
            .or_else(|| object["customer_details"]["email"].as_str()),
        customer_name: object["customer_details"]["name"].as_str(),
        processor_customer_id: object["customer"].as_str(),
        mode,
        payment_intent: object["payment_intent"].as_str(),
        subscription: object["subscription"].as_str(),
        amount_total: object["amount_total"].as_i64().unwrap_or(0),
        currency: object["currency"].as_str().unwrap_or("usd"),
    })
}

async fn create_payment_transaction(
    pool: &PgPool,
    params: PaymentTransactionParams<'_>,
) -> Result<Uuid, String> {
    let transaction_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO transaction (id, "createdAt", type, amount, currency, processor,
            "projectId", "customerId", "productId", "productPriceId",
            "checkoutSessionId", "chargeId", "succeededAt")
        VALUES ($1, NOW(), 'payment', $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT ("chargeId") WHERE ("chargeId" IS NOT NULL AND type = 'payment') DO NOTHING
        "#,
        transaction_id,
        params.amount,
        params.currency,
        params.processor,
        params.project_id,
        params.customer_id,
        params.product_id,
        params.price_id,
        params.checkout_id,
        params.charge_id
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create transaction: {}", e))?;

    Ok(transaction_id)
}

async fn create_subscription_record(
    pool: &PgPool,
    params: CreateSubscriptionParams<'_>,
) -> Result<Uuid, String> {
    let new_subscription_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO subscription (id, "projectId", "productId", "productPriceId", "customerId",
            processor, "processorSubscriptionId", "processorCustomerId", "createdAt", status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'active')
        ON CONFLICT (processor, "processorSubscriptionId") DO NOTHING
        "#,
        new_subscription_id,
        params.project_id,
        params.product_id,
        params.price_id,
        params.customer_id,
        params.processor,
        params.processor_subscription_id,
        params.processor_customer_id
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to create subscription: {}", e))?;

    Ok(new_subscription_id)
}

async fn handle_checkout_completed(
    pool: &PgPool,
    processor: &str,
    payload: &Value,
) -> Result<(), String> {
    let data = parse_checkout_data(payload)?;

    let checkout_row = sqlx::query!(
        r#"SELECT id, "projectId", "productId", "priceId", "customerId" FROM checkout_session WHERE "processorCheckoutId" = $1"#,
        data.processor_checkout_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to fetch checkout session: {}", e))?;

    let (checkout_id, project_id, product_id, price_id, customer_id) = match checkout_row {
        Some(row) => {
            let cid = row
                .customerId
                .ok_or("Checkout session missing customerId")?;
            (row.id, row.projectId, row.productId, row.priceId, cid)
        }
        None => {
            tracing::warn!(
                "Checkout session {} not found, skipping",
                data.processor_checkout_id
            );
            return Ok(());
        }
    };

    // Update existing customer with processor info from Stripe (only set fields if not already set)
    sqlx::query!(
        r#"
        UPDATE customer
        SET "processorCustomerId" = COALESCE("processorCustomerId", $1),
            email = COALESCE(email, $2),
            name = COALESCE(name, $3),
            "updatedAt" = NOW()
        WHERE id = $4
        "#,
        data.processor_customer_id,
        data.customer_email,
        data.customer_name,
        customer_id
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update customer: {}", e))?;

    sqlx::query!(
        r#"
        UPDATE checkout_session
        SET "customerId" = $1, "processorCustomerId" = $2, "customerEmail" = $3,
            "completedAt" = NOW(), status = $4, mode = $5,
            "processorPaymentId" = $6, "processorSubscriptionId" = $7
        WHERE id = $8 AND status != 'complete'
        "#,
        customer_id,
        data.processor_customer_id,
        data.customer_email,
        CheckoutStatus::Complete as CheckoutStatus,
        data.mode as CheckoutMode,
        data.payment_intent,
        data.subscription,
        checkout_id
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update checkout session: {}", e))?;

    match data.mode {
        CheckoutMode::Payment => {
            if let Some(charge_id) = data.payment_intent {
                let tx_id = create_payment_transaction(
                    pool,
                    PaymentTransactionParams {
                        project_id,
                        customer_id,
                        product_id: Some(product_id),
                        price_id: Some(price_id),
                        checkout_id,
                        charge_id,
                        amount: data.amount_total,
                        currency: data.currency,
                        processor,
                    },
                )
                .await?;
                tracing::info!(
                    "Created transaction {} for checkout session {}",
                    tx_id,
                    data.processor_checkout_id
                );
            }
        }
        CheckoutMode::Subscription => {
            if let Some(sub_id_str) = data.subscription {
                let sub_id = create_subscription_record(
                    pool,
                    CreateSubscriptionParams {
                        project_id,
                        product_id: Some(product_id),
                        price_id: Some(price_id),
                        customer_id,
                        processor,
                        processor_subscription_id: sub_id_str,
                        processor_customer_id: data.processor_customer_id,
                    },
                )
                .await?;
                tracing::info!(
                    "Created subscription {} for checkout session {}",
                    sub_id,
                    data.processor_checkout_id
                );
            }
        }
        CheckoutMode::Setup => {
            tracing::info!(
                "Setup mode for checkout session {}",
                data.processor_checkout_id
            );
        }
    }

    tracing::info!("Completed checkout session {}", data.processor_checkout_id);
    Ok(())
}

/// Fetches all subscriptions for a Stripe customer and upserts them into our database.
/// This is single source of truth sync - called on any subscription-related webhook.
pub async fn sync_stripe_customer_data(
    pool: &PgPool,
    config: &Config,
    stripe_customer_id: &str,
) -> Result<(), String> {
    tracing::info!(
        "Syncing customer data for stripe_customer_id: {}",
        stripe_customer_id
    );

    let customer_row = sqlx::query!(
        r#"
        SELECT id, "projectId"
        FROM customer
        WHERE "processorCustomerId" = $1
        "#,
        stripe_customer_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to fetch customer from database: {}", e))?;

    let (customer_id, project_id) = match customer_row {
        Some(row) => (row.id, row.projectId),
        None => {
            tracing::warn!(
                "Customer with stripe_customer_id {} not found in database",
                stripe_customer_id
            );
            return Ok(());
        }
    };

    let stripe_response = fetch_customer_subscriptions_with_payment_means(
        &config.stripe_secret_key,
        stripe_customer_id,
    )
    .await
    .map_err(|e| format!("Failed to fetch subscriptions from Stripe: {}", e))?;

    if stripe_response.data.is_empty() {
        tracing::info!("No subscriptions found for customer {}", stripe_customer_id);
        return Ok(());
    }

    for subscription in stripe_response.data {
        tracing::debug!(
            "Processing subscription {} for customer {}",
            subscription.id,
            stripe_customer_id
        );

        let status: SubscriptionStatus = subscription.status.as_str().try_into()?;

        // We only support single-item subscriptions, so grab first price
        let stripe_price_id = subscription
            .items
            .data
            .first()
            .map(|item| item.price.id.clone());

        let (product_id, product_price_id): (Option<Uuid>, Option<Uuid>) =
            if let Some(ref stripe_price) = stripe_price_id {
                let price_row = sqlx::query!(
                    r#"SELECT id, "productId" FROM product_price WHERE "processorPriceId" = $1"#,
                    stripe_price
                )
                .fetch_optional(pool)
                .await
                .map_err(|e| format!("Failed to fetch product_price: {}", e))?;

                match price_row {
                    Some(row) => (Some(row.productId), Some(row.id)),
                    None => {
                        tracing::warn!(
                            "No product_price found for processor_price_id {}",
                            stripe_price
                        );
                        (None, None)
                    }
                }
            } else {
                (None, None)
            };

        let (payment_method_brand, payment_method_last4) =
            match subscription.default_payment_method.and_then(|pm| pm.card) {
                Some(card) => (Some(card.brand), Some(card.last4)),
                None => (None, None),
            };

        // Get current_period_start, falling back to subscription item level
        let current_period_start_ts = subscription
            .current_period_start
            .or_else(|| {
                subscription
                    .items
                    .data
                    .first()
                    .map(|item| item.current_period_start)
            })
            .ok_or("Missing current_period_start at both subscription and item levels")?;
        let current_period_start = DateTime::from_timestamp(current_period_start_ts, 0)
            .ok_or_else(|| format!("Invalid current_period_start: {}", current_period_start_ts))?;

        // Get current_period_end, falling back to subscription item level
        let current_period_end_ts = subscription
            .current_period_end
            .or_else(|| {
                subscription
                    .items
                    .data
                    .first()
                    .map(|item| item.current_period_end)
            })
            .ok_or("Missing current_period_end at both subscription and item levels")?;
        let current_period_end = DateTime::from_timestamp(current_period_end_ts, 0)
            .ok_or_else(|| format!("Invalid current_period_end: {}", current_period_end_ts))?;

        sqlx::query!(
            r#"
            INSERT INTO subscription (
                id, "projectId", "productId", "productPriceId", "customerId",
                processor, "processorSubscriptionId", "processorCustomerId", "createdAt",
                "currentPeriodStart", "currentPeriodEnd", "cancelAtPeriodEnd",
                "paymentMethodBrand", "paymentMethodLast4", status
            )
            VALUES (
                gen_random_uuid(), $1, $2, $3, $4, 'stripe', $5, $6, NOW(),
                $7, $8, $9, $10, $11, $12
            )
            ON CONFLICT (processor, "processorSubscriptionId") DO UPDATE
            SET
                status = CASE WHEN $12::text = 'canceled' THEN $12 ELSE EXCLUDED.status END,
                "currentPeriodStart" = EXCLUDED."currentPeriodStart",
                "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
                "cancelAtPeriodEnd" = EXCLUDED."cancelAtPeriodEnd",
                "paymentMethodBrand" = EXCLUDED."paymentMethodBrand",
                "paymentMethodLast4" = EXCLUDED."paymentMethodLast4",
                "productId" = EXCLUDED."productId",
                "productPriceId" = EXCLUDED."productPriceId"
            "#,
            project_id,
            product_id,
            product_price_id,
            customer_id,
            &subscription.id,
            stripe_customer_id,
            current_period_start,
            current_period_end,
            subscription.cancel_at_period_end,
            payment_method_brand.as_deref(),
            payment_method_last4.as_deref(),
            status as SubscriptionStatus
        )
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to upsert subscription: {}", e))?;

        tracing::info!(
            "Synced subscription {} with status {}",
            subscription.id,
            subscription.status
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_processor_names() {
        assert!(is_valid_processor_name("stripe"));
        assert!(is_valid_processor_name("paypal"));
        assert!(is_valid_processor_name("adyen"));
        assert!(is_valid_processor_name("stripe_connect"));
        assert!(is_valid_processor_name("processor1"));
        assert!(is_valid_processor_name("a"));
        assert!(is_valid_processor_name("a1_b2_c3"));
    }

    #[test]
    fn test_invalid_processor_names() {
        assert!(!is_valid_processor_name(""));
        assert!(!is_valid_processor_name("1stripe")); // starts with digit
        assert!(!is_valid_processor_name("_stripe")); // starts with underscore
        assert!(!is_valid_processor_name("Stripe")); // uppercase
        assert!(!is_valid_processor_name("stripe-connect")); // hyphen not allowed
        assert!(!is_valid_processor_name("stripe.connect")); // dot not allowed
        assert!(!is_valid_processor_name("stripe/connect")); // slash not allowed
        assert!(!is_valid_processor_name("stripe connect")); // space not allowed
        assert!(!is_valid_processor_name("a".repeat(33).as_str())); // too long
    }
}
