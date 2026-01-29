mod common;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use chrono::Utc;
use hmac::{Hmac, Mac};
use serde_json::json;
use sha2::Sha256;
use sqlx::PgPool;
use tower::Service;
use uuid::Uuid;

use common::{TestAppExt, create_test_state, seed_api_key, seed_organization};
use surpay::api::create_router;
use surpay::api::webhook::{WebhookMessage, process_webhook_message_directly};
use surpay::integrations::types::NormalizedEvent;
use surpay::types::CheckoutStatus;

type TestResult = Result<(), Box<dyn std::error::Error>>;
type HmacSha256 = Hmac<Sha256>;

// Helper to generate valid Stripe signature
fn generate_stripe_signature(payload: &str, secret: &str) -> String {
    let timestamp = Utc::now().timestamp();
    let timestamp_str = timestamp.to_string();
    let signed_payload = [timestamp_str.as_bytes(), b".", payload.as_bytes()].concat();

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(&signed_payload);
    let signature = hex::encode(mac.finalize().into_bytes());

    format!("t={},v1={}", timestamp, signature)
}

#[sqlx::test(migrations = "./migrations")]
async fn test_webhook_missing_signature(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);

    let payload =
        json!({"id": "evt_test", "type": "checkout.session.completed", "livemode": false});

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/webhooks/stripe")
                .header("Content-Type", "application/json")
                .body(Body::from(payload.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_webhook_invalid_signature(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);

    let payload =
        json!({"id": "evt_test", "type": "checkout.session.completed", "livemode": false});

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/webhooks/stripe")
                .header("Content-Type", "application/json")
                .header("stripe-signature", "t=123,v1=invalid")
                .body(Body::from(payload.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_webhook_valid_signature_enqueues(pool: PgPool) -> TestResult {
    let state = create_test_state(pool.clone()).await;
    let mut app = create_router(state.clone());

    let payload = json!({
        "id": "evt_test_123",
        "type": "checkout.session.completed",
        "livemode": false,
        "data": {
            "object": {
                "id": "cs_test_nonexistent",
                "customer_email": "test@example.com",
                "customer": "cus_test",
                "mode": "payment",
                "amount_total": 1000,
                "currency": "usd"
            }
        }
    });

    let payload_str = payload.to_string();
    let signature = generate_stripe_signature(&payload_str, &state.config.stripe_webhook_secret);

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/webhooks/stripe")
                .header("Content-Type", "application/json")
                .header("stripe-signature", signature)
                .body(Body::from(payload_str))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_checkout_completed_creates_customer_and_transaction(pool: PgPool) -> TestResult {
    // Setup: Create org, project, product, price, and checkout session
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let state = create_test_state(pool.clone()).await;
    let mut app = create_router(state.clone());

    let product = app.create_product(&api_key).await;
    let price_id = app
        .create_product_price(&api_key, product.product_group_id)
        .await;

    // Create a customer first (simulating what /checkout does)
    let customer_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO customer (id, "projectId", "externalId", email, name)
        VALUES ($1, $2, $3, $4, $5)
        "#,
        customer_id,
        project_id,
        "test_external_id",
        "buyer@example.com",
        "Test Buyer"
    )
    .execute(&pool)
    .await?;

    // Create a checkout session directly in DB (simulating what /checkout does)
    let checkout_id = Uuid::new_v4();
    let processor_checkout_id = format!("cs_test_{}", Uuid::new_v4());

    sqlx::query!(
        r#"
        INSERT INTO checkout_session (id, "processorCheckoutId", "projectId", "productId", "priceId", "customerId", status)
        VALUES ($1, $2, $3, $4, $5, $6, 'open')
        "#,
        checkout_id,
        &processor_checkout_id,
        project_id,
        product.id,
        price_id,
        customer_id
    )
    .execute(&pool)
    .await?;

    // Simulate checkout.session.completed webhook
    let event_id = format!("evt_{}", Uuid::new_v4());
    let payload = json!({
        "id": event_id,
        "type": "checkout.session.completed",
        "livemode": false,
        "data": {
            "object": {
                "id": processor_checkout_id,
                "customer_email": "buyer@example.com",
                "customer_details": {"name": "Test Buyer", "email": "buyer@example.com"},
                "customer": "cus_test123",
                "mode": "payment",
                "payment_intent": "pi_test123",
                "amount_total": 1000,
                "currency": "usd"
            }
        }
    });

    let payload_str = payload.to_string();
    let signature = generate_stripe_signature(&payload_str, &state.config.stripe_webhook_secret);

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/webhooks/stripe")
                .header("Content-Type", "application/json")
                .header("stripe-signature", signature)
                .body(Body::from(payload_str))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    // Process webhook directly (bypass queue for test)
    let msg = WebhookMessage {
        processor: "stripe".to_string(),
        event_id,
        event: NormalizedEvent::CheckoutCompleted {
            session_id: processor_checkout_id.clone(),
            customer_id: Some("cus_test123".to_string()),
            customer_email: Some("buyer@example.com".to_string()),
            subscription_id: None,
            payment_intent_id: Some("pi_test123".to_string()),
            mode: "payment".to_string(),
            amount_total: 1000,
            currency: "usd".to_string(),
        },
        raw_payload: payload,
        received_at: Utc::now(),
    };
    process_webhook_message_directly(&pool, &state.config, msg).await?;

    // Verify checkout session was updated
    let session = sqlx::query!(
        r#"SELECT status as "status: CheckoutStatus", "customerId", "customerEmail", "processorCustomerId", "completedAt" FROM checkout_session WHERE id = $1"#,
        checkout_id
    )
    .fetch_one(&pool)
    .await?;

    assert_eq!(session.status, CheckoutStatus::Complete);
    assert_eq!(session.customerEmail.as_deref(), Some("buyer@example.com"));
    assert_eq!(session.processorCustomerId.as_deref(), Some("cus_test123"));
    assert!(session.completedAt.is_some());
    assert!(session.customerId.is_some());

    // Verify customer was created
    let customer = sqlx::query!(
        r#"SELECT email, name, "processorCustomerId" FROM customer WHERE "projectId" = $1 AND email = $2"#,
        project_id,
        "buyer@example.com"
    )
    .fetch_one(&pool)
    .await?;

    assert_eq!(customer.email.as_deref(), Some("buyer@example.com"));
    assert_eq!(customer.name.as_deref(), Some("Test Buyer"));
    assert_eq!(customer.processorCustomerId.as_deref(), Some("cus_test123"));

    // Verify transaction was created
    let transaction_row = sqlx::query!(
        r#"SELECT type as "type_: String", amount, currency, processor FROM transaction WHERE "checkoutSessionId" = $1"#,
        checkout_id
    )
    .fetch_one(&pool)
    .await?;

    assert_eq!(transaction_row.type_, "payment");
    assert_eq!(transaction_row.amount, 1000);
    assert_eq!(transaction_row.currency, "usd");
    assert_eq!(transaction_row.processor, "stripe");

    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_checkout_expired_updates_status(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let state = create_test_state(pool.clone()).await;
    let mut app = create_router(state.clone());

    let product = app.create_product(&api_key).await;
    let price_id = app
        .create_product_price(&api_key, product.product_group_id)
        .await;

    // Create checkout session
    let checkout_id = Uuid::new_v4();
    let processor_checkout_id = format!("cs_test_{}", Uuid::new_v4());

    sqlx::query!(
        r#"
        INSERT INTO checkout_session (id, "processorCheckoutId", "projectId", "productId", "priceId", status)
        VALUES ($1, $2, $3, $4, $5, 'open')
        "#,
        checkout_id,
        &processor_checkout_id,
        project_id,
        product.id,
        price_id
    )
    .execute(&pool)
    .await?;

    // Simulate checkout.session.expired webhook
    let event_id = format!("evt_{}", Uuid::new_v4());
    let payload = json!({
        "id": event_id,
        "type": "checkout.session.expired",
        "livemode": false,
        "data": {
            "object": {
                "id": processor_checkout_id
            }
        }
    });

    let payload_str = payload.to_string();
    let signature = generate_stripe_signature(&payload_str, &state.config.stripe_webhook_secret);

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/webhooks/stripe")
                .header("Content-Type", "application/json")
                .header("stripe-signature", signature)
                .body(Body::from(payload_str))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    // Process webhook directly (bypass queue for test)
    let msg = WebhookMessage {
        processor: "stripe".to_string(),
        event_id,
        event: NormalizedEvent::CheckoutExpired {
            session_id: processor_checkout_id.clone(),
        },
        raw_payload: payload,
        received_at: Utc::now(),
    };
    process_webhook_message_directly(&pool, &state.config, msg).await?;

    // Verify status was updated
    let session = sqlx::query!(
        r#"SELECT status as "status: CheckoutStatus" FROM checkout_session WHERE id = $1"#,
        checkout_id
    )
    .fetch_one(&pool)
    .await?;

    assert_eq!(session.status, CheckoutStatus::Expired);

    Ok(())
}
