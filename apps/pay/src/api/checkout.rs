use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::Redirect,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use std::sync::Arc;
use url::Url;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::{AuthenticatedUser, ProjectIdQuery, resolve_project_id};
use crate::core::config::Config;
use crate::integrations::ProcessorRegistry;
use crate::integrations::stripe::fetch_checkout_session;
use crate::integrations::types::{CheckoutLineItem, CreateCheckoutSessionRequest};
use crate::types::{CheckoutMode, RecurringInterval, SubscriptionStatus};

#[derive(Debug, Deserialize, ToSchema)]
pub struct CustomerData {
    pub email: Option<String>,
    pub name: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateCheckoutRequest {
    pub customer_id: String,
    /// Product identifier - can be UUID or slug
    pub product_id: String,
    /// Price identifier - can be UUID or slug. If omitted, uses the default (first) price.
    pub price_id: Option<String>,
    /// URL to redirect to after successful checkout
    pub success_url: Option<String>,
    /// URL to redirect to if checkout is cancelled
    pub cancel_url: Option<String>,
    pub customer_data: Option<CustomerData>,
}

impl CreateCheckoutRequest {
    /// Validates that success_url and cancel_url are valid HTTPS URLs.
    /// HTTP is allowed for localhost and 127.0.0.1 to support local development.
    /// Rejects URLs with embedded credentials (user:pass@host) to prevent phishing.
    pub fn validate(&self) -> Result<(), String> {
        let validate_url = |url: &str, field: &str| -> Result<(), String> {
            let parsed = Url::parse(url).map_err(|e| format!("Invalid {}: {}", field, e))?;

            // Reject URLs with embedded credentials
            if !parsed.username().is_empty() || parsed.password().is_some() {
                return Err(format!("{} must not contain credentials", field));
            }

            let scheme = parsed.scheme();
            if scheme == "https" {
                return Ok(());
            }
            if scheme == "http" {
                if let Some(host) = parsed.host_str() {
                    if host == "localhost" || host == "127.0.0.1" {
                        return Ok(());
                    }
                }
            }
            Err(format!("{} must use HTTPS", field))
        };

        if let Some(url) = &self.success_url {
            validate_url(url, "success_url")?;
        }
        if let Some(url) = &self.cancel_url {
            validate_url(url, "cancel_url")?;
        }

        Ok(())
    }
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateCheckoutResponse {
    pub checkout_url: String,
    pub customer_id: String,
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
        ("session_cookie" = [])
    )
)]
pub async fn create_checkout_session(
    State(pool): State<PgPool>,
    State(config): State<Config>,
    State(registry): State<Arc<ProcessorRegistry>>,
    auth: AuthenticatedUser,
    Query(query): Query<ProjectIdQuery>,
    Json(req): Json<CreateCheckoutRequest>,
) -> Result<(StatusCode, Json<CreateCheckoutResponse>), (StatusCode, String)> {
    tracing::debug!(?req, "Received checkout request");

    let auth_project_id = resolve_project_id(&pool, &auth, query.project_id).await?;

    // Validate URLs to prevent phishing attacks
    req.validate()
        .map_err(|error| (StatusCode::BAD_REQUEST, error))?;

    // Look up product by priority: UUID match > slug match
    let product_uuid = Uuid::parse_str(&req.product_id).ok();
    let product = sqlx::query!(
        r#"
        SELECT p.id, p."projectId"
        FROM product p
        WHERE p."projectId" = $1
          AND (p.id = $2 OR p.slug = $3)
        ORDER BY (p.id = $2)::int DESC
        LIMIT 1
        "#,
        auth_project_id,
        product_uuid,
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

    let product = product.ok_or((
        StatusCode::NOT_FOUND,
        "Product not found or does not belong to this project".to_string(),
    ))?;

    let project_id = product.projectId;
    let product_id = product.id;

    // Look up price by priority: UUID match > slug match > default (first price)
    let price_uuid = req.price_id.as_ref().and_then(|p| Uuid::parse_str(p).ok());
    let price = sqlx::query!(
        r#"
        SELECT id, "processorPriceId", "priceAmount", "recurringInterval" as "recurring_interval: Option<RecurringInterval>"
        FROM product_price
        WHERE "productId" = $1
          AND ($2::text IS NULL OR id = $3 OR slug = $2)
        ORDER BY
            (id = $3)::int DESC,
            (slug = $2)::int DESC,
            "createdAt" ASC
        LIMIT 1
        "#,
        product_id,
        req.price_id.as_deref(),
        price_uuid
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?
    .ok_or((
        StatusCode::NOT_FOUND,
        "Price not found for this product".to_string(),
    ))?;

    let price_id = price.id;

    let processor_price_id = price.processorPriceId.ok_or((
        StatusCode::BAD_REQUEST,
        "Price must have a processorPriceId".to_string(),
    ))?;

    let mode = if price.recurring_interval.is_some() {
        CheckoutMode::Subscription
    } else {
        CheckoutMode::Payment
    };

    // Atomic get-or-create customer by (project_id, external_id)
    let email = req.customer_data.as_ref().and_then(|d| d.email.clone());
    let name = req.customer_data.as_ref().and_then(|d| d.name.clone());

    let customer = sqlx::query!(
        r#"
        INSERT INTO customer (id, "projectId", "externalId", email, name)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT ("projectId", "externalId") DO UPDATE SET "updatedAt" = NOW()
        RETURNING id, "processorCustomerId"
        "#,
        Uuid::new_v4(),
        project_id,
        req.customer_id,
        email.as_deref(),
        name.as_deref()
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let customer_id = customer.id;
    let processor_customer_id = customer.processorCustomerId;

    // Check for duplicate subscription (only for subscription mode)
    if mode == CheckoutMode::Subscription {
        let existing_subscription = sqlx::query!(
            r#"
            SELECT id
            FROM subscription
            WHERE "customerId" = $1
              AND "productId" = $2
              AND status = ANY($3::subscription_status[])
            LIMIT 1
            "#,
            customer_id,
            product_id,
            &[SubscriptionStatus::Active, SubscriptionStatus::Trialing] as &[SubscriptionStatus]
        )
        .fetch_optional(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            )
        })?;

        if existing_subscription.is_some() {
            return Err((
                StatusCode::CONFLICT,
                "Customer already has an active subscription for this product".to_string(),
            ));
        }
    }

    // Look up project's connected account for destination charges
    let destination_account = sqlx::query_scalar!(
        r#"
        SELECT "processorAccountId"
        FROM connect_account
        WHERE "projectId" = $1 AND "processorAccountId" IS NOT NULL
        LIMIT 1
        "#,
        auth_project_id
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

    // Fetch org config for platform fee calculation (get org_id from project)
    let org_config = sqlx::query!(
        r#"
        SELECT o."platformFeePercent", o."platformFeeFixed"
        FROM organization o
        INNER JOIN project p ON p."organizationId" = o.id
        WHERE p.id = $1
        "#,
        auth_project_id
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
            mode: match mode {
                CheckoutMode::Payment => "payment",
                CheckoutMode::Subscription => "subscription",
                CheckoutMode::Setup => "setup",
            }
            .to_string(),
            customer: processor_customer_id,
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
                price_id = ?req.price_id,
                error = %e,
                "Failed to create checkout session"
            );
            (StatusCode::BAD_GATEWAY, e)
        })?;

    // Use merchant-provided redirect URLs if provided
    let final_success_url = req.success_url.clone();
    let final_cancel_url = req.cancel_url.clone();

    let session_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO checkout_session (
            id,
            "processorCheckoutId",
            "projectId",
            "productId",
            "priceId",
            "customerId",
            "successUrl",
            "cancelUrl",
            mode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
        session_id,
        &processor_session.id,
        project_id,
        product_id,
        price_id,
        customer_id,
        final_success_url.as_deref(),
        final_cancel_url.as_deref(),
        mode as CheckoutMode
    )
    .execute(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let url = processor_session.url.ok_or((
        StatusCode::INTERNAL_SERVER_ERROR,
        "Processor did not return a checkout URL".to_string(),
    ))?;

    let response = CreateCheckoutResponse {
        checkout_url: url,
        customer_id: req.customer_id,
    };
    tracing::debug!(?response, "Returning checkout response");

    Ok((StatusCode::CREATED, Json(response)))
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

    // Link customer's processorCustomerId before syncing
    let checkout_customer = sqlx::query!(
        r#"
        SELECT "customerId"
        FROM checkout_session
        WHERE "processorCheckoutId" = $1
        "#,
        session_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        tracing::error!(
            "Failed to fetch checkout session for customer linking: {}",
            e
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    if let Some(row) = checkout_customer {
        sqlx::query!(
            r#"
            UPDATE customer
            SET "processorCustomerId" = $1
            WHERE id = $2 AND "processorCustomerId" IS NULL
            "#,
            stripe_customer_id,
            row.customerId
        )
        .execute(&pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update customer processorCustomerId: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            )
        })?;
    }

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
