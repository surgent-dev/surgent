use axum::{Json, extract::Path, extract::State, http::StatusCode, response::Redirect};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use url::Url;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::AuthenticatedProject;
use crate::core::config::Config;
use crate::integrations::ProcessorRegistry;
use crate::integrations::stripe::fetch_checkout_session;
use crate::integrations::types::{CheckoutLineItem, CreateCheckoutSessionRequest};
use crate::types::RecurringInterval;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateCheckoutRequest {
    pub product_id: Uuid,
    pub price_id: Uuid,
    pub success_url: String,
    pub cancel_url: String,
}

impl CreateCheckoutRequest {
    /// Validates that success_url and cancel_url are valid HTTPS URLs
    pub fn validate(&self) -> Result<(), String> {
        // Validate success_url
        let success_url =
            Url::parse(&self.success_url).map_err(|e| format!("Invalid success_url: {}", e))?;

        if success_url.scheme() != "https" {
            return Err("success_url must use HTTPS".to_string());
        }

        // Validate cancel_url
        let cancel_url =
            Url::parse(&self.cancel_url).map_err(|e| format!("Invalid cancel_url: {}", e))?;

        if cancel_url.scheme() != "https" {
            return Err("cancel_url must use HTTPS".to_string());
        }

        Ok(())
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreateCheckoutResponse {
    pub checkout_url: String,
    pub session_id: Uuid,
}

/// Create a new checkout session
#[utoipa::path(
    post,
    path = "/checkout",
    tag = "checkout",
    request_body = CreateCheckoutRequest,
    responses(
        (status = 201, description = "Checkout session created", body = CreateCheckoutResponse),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 400, description = "Invalid request"),
        (status = 404, description = "Product or price not found"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("org_key" = [])
    )
)]
pub async fn create_checkout_session(
    State(pool): State<PgPool>,
    State(config): State<Config>,
    State(registry): State<Arc<ProcessorRegistry>>,
    auth: AuthenticatedProject,
    Json(req): Json<CreateCheckoutRequest>,
) -> Result<(StatusCode, Json<CreateCheckoutResponse>), (StatusCode, String)> {
    // Validate URLs to prevent phishing attacks
    req.validate()
        .map_err(|error| (StatusCode::BAD_REQUEST, error))?;

    // Validate product belongs to the authenticated project
    let product = sqlx::query!(
        r#"
        SELECT p.id, p."projectId"
        FROM product p
        WHERE p.id = $1 AND p."projectId" = $2
        "#,
        req.product_id,
        auth.project_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let product = product.ok_or((
        StatusCode::NOT_FOUND,
        "Product not found or does not belong to this project".to_string(),
    ))?;

    let project_id = product.projectId;

    // Same with price
    let price = sqlx::query!(
        r#"
        SELECT id, "processorPriceId", "priceAmount", "recurringInterval" as "recurring_interval: Option<RecurringInterval>"
        FROM product_price
        WHERE id = $1 AND "productId" = $2
        "#,
        req.price_id,
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

    let price = price.ok_or((
        StatusCode::NOT_FOUND,
        "Price not found for this product".to_string(),
    ))?;

    let processor_price_id = price.processorPriceId.ok_or((
        StatusCode::BAD_REQUEST,
        "Price must have a processorPriceId".to_string(),
    ))?;

    let mode = if price.recurring_interval.is_some() {
        "subscription"
    } else {
        "payment"
    };

    // Look up project's connected account for destination charges
    let destination_account = sqlx::query_scalar!(
        r#"
        SELECT "processorAccountId"
        FROM connect_account
        WHERE "projectId" = $1 AND "processorAccountId" IS NOT NULL
        LIMIT 1
        "#,
        auth.project_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?
    .flatten();

    // Fetch org config for platform fee calculation
    let org_config = sqlx::query!(
        r#"
        SELECT "platformFeePercent", "platformFeeFixed"
        FROM organization
        WHERE id = $1
        "#,
        auth.organization_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    // Calculate platform fee from org config
    let application_fee_amount = if destination_account.is_some() {
        let price_amount = price.priceAmount as i64;
        let percent_fee = org_config
            .as_ref()
            .and_then(|o| o.platformFeePercent)
            .map(|p| (price_amount * p as i64) / 100)
            .unwrap_or(0);
        let fixed_fee = org_config
            .as_ref()
            .and_then(|o| o.platformFeeFixed)
            .map(|f| f as i64)
            .unwrap_or(0);
        let total_fee = percent_fee + fixed_fee;

        if total_fee > 0 { Some(total_fee) } else { None }
    } else {
        None
    };

    // Proxy URLs redirect through Surpay to trigger eager data sync before merchant redirect
    let proxy_success_url = format!(
        "{}/checkout/success/{{CHECKOUT_SESSION_ID}}",
        config.surpay_base_url.trim_end_matches('/')
    );
    let proxy_cancel_url = format!(
        "{}/checkout/cancel/{{CHECKOUT_SESSION_ID}}",
        config.surpay_base_url.trim_end_matches('/')
    );

    let processor = registry.get("stripe").await.ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Payment processor not available".to_string(),
    ))?;

    let processor_session = processor
        .create_checkout_session(CreateCheckoutSessionRequest {
            line_items: vec![CheckoutLineItem {
                price: processor_price_id.to_string(),
                quantity: 1,
            }],
            success_url: proxy_success_url,
            cancel_url: proxy_cancel_url,
            mode: mode.to_string(),
            customer: None,
            // Stripe's current implementation derives idempotency from metadata. Use a random
            // value to preserve the current "new session per request" behavior.
            metadata: HashMap::from([("idempotency_key".to_string(), Uuid::new_v4().to_string())]),
            application_fee_amount,
            destination_account,
        })
        .await
        .map_err(|e| {
            tracing::error!(
                processor_price_id = %processor_price_id,
                product_id = %req.product_id,
                price_id = %req.price_id,
                error = %e,
                "Failed to create checkout session"
            );
            (StatusCode::BAD_GATEWAY, e)
        })?;

    let session_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO checkout_session (
            id,
            "processorCheckoutId",
            "projectId",
            "productId",
            "priceId",
            "successUrl",
            "cancelUrl"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
        session_id,
        &processor_session.id,
        project_id,
        req.product_id,
        req.price_id,
        &req.success_url,
        &req.cancel_url
    )
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let checkout_url = processor_session.url.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "Processor did not return a checkout URL".to_string(),
    ))?;

    Ok((
        StatusCode::CREATED,
        Json(CreateCheckoutResponse {
            checkout_url,
            session_id,
        }),
    ))
}

/// Handle checkout success redirect
#[utoipa::path(
    get,
    path = "/checkout/success/{session_id}",
    tag = "checkout",
    params(
        ("session_id" = String, Path, description = "Checkout session ID")
    ),
    responses(
        (status = 302, description = "Redirect to merchant success URL"),
        (status = 404, description = "Session not found"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn checkout_success(
    Path(session_id): Path<String>,
    State(pool): State<PgPool>,
    State(config): State<Config>,
) -> Result<Redirect, (StatusCode, String)> {
    let stripe_session = fetch_checkout_session(&config.stripe_secret_key, &session_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch Stripe checkout session: {}", e);
            (StatusCode::BAD_GATEWAY, format!("Stripe error: {}", e))
        })?;

    let stripe_customer_id = stripe_session.customer.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "Stripe session missing customer".to_string(),
    ))?;

    // Eager sync ensures data is available before redirecting to merchant
    // (webhook may not have processed yet due to race condition)
    if let Err(e) =
        crate::api::webhook::sync_stripe_customer_data(&pool, &config, &stripe_customer_id).await
    {
        tracing::error!("Failed to sync customer data: {}", e);
    }

    let checkout_row = sqlx::query!(
        "SELECT \"successUrl\" FROM checkout_session WHERE \"processorCheckoutId\" = $1",
        session_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch checkout session: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let success_url = checkout_row.and_then(|row| row.successUrl).ok_or_else(|| {
        tracing::warn!("No successUrl found for session {}", session_id);
        (
            StatusCode::NOT_FOUND,
            "Checkout session not found or missing successUrl".to_string(),
        )
    })?;

    tracing::info!("Redirecting to success URL for session {}", session_id);
    Ok(Redirect::temporary(&success_url))
}

/// Handle checkout cancel redirect
#[utoipa::path(
    get,
    path = "/checkout/cancel/{session_id}",
    tag = "checkout",
    params(
        ("session_id" = String, Path, description = "Checkout session ID")
    ),
    responses(
        (status = 302, description = "Redirect to merchant cancel URL"),
        (status = 404, description = "Session not found"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn checkout_cancel(
    Path(session_id): Path<String>,
    State(pool): State<PgPool>,
) -> Result<Redirect, (StatusCode, String)> {
    let checkout_row = sqlx::query!(
        "SELECT \"cancelUrl\" FROM checkout_session WHERE \"processorCheckoutId\" = $1",
        session_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch checkout session: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let cancel_url = checkout_row.and_then(|row| row.cancelUrl).ok_or_else(|| {
        tracing::warn!("No cancelUrl found for session {}", session_id);
        (
            StatusCode::NOT_FOUND,
            "Checkout session not found or missing cancelUrl".to_string(),
        )
    })?;

    tracing::info!("Redirecting to cancel URL for session {}", session_id);
    Ok(Redirect::temporary(&cancel_url))
}
