mod common;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::json;
use sqlx::PgPool;
use tower::Service;
use uuid::Uuid;

use common::{
    TestAppExt, create_test_state, read_body, read_body_text, seed_api_key, seed_organization,
};
use surpay::api::create_router;
use surpay::types::{CheckoutMode, CheckoutStatus};

type TestResult = Result<(), Box<dyn std::error::Error>>;

#[sqlx::test(migrations = "./migrations")]
async fn test_create_checkout_missing_auth(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);
    let body = json!({
        "product_id": Uuid::new_v4(),
        "price_id": Uuid::new_v4(),
        "success_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/checkout")
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Missing API key");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_checkout_invalid_product(pool: PgPool) -> TestResult {
    let (_org_id, project_id, session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let product = app.create_product(&session_cookie, project_id).await;
    let _price_id = app
        .create_product_price(&session_cookie, project_id, product.product_group_id)
        .await;

    let body = json!({
        "customer_id": "test_user",
        "product_id": "nonexistent-product-slug",
        "success_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/checkout")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Product not found or does not belong to this project");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_checkout_invalid_price(pool: PgPool) -> TestResult {
    let (_org_id, project_id, session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let product = app.create_product(&session_cookie, project_id).await;

    let body = json!({
        "customer_id": "test_user",
        "product_id": product.slug,
        "price_id": "nonexistent-price-slug",
        "success_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/checkout")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Price not found for this product");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_checkout_price_not_for_product(pool: PgPool) -> TestResult {
    let (_org_id, project_id, session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    // Create product 1 and its price
    let product1 = app.create_product(&session_cookie, project_id).await;
    let _price_id1 = app
        .create_product_price(&session_cookie, project_id, product1.product_group_id)
        .await;

    // Create product 2
    let product2 = app.create_product(&session_cookie, project_id).await;

    // Try to create checkout with product_id2 but price_id1 (which belongs to product_id1)
    // Since prices don't have slugs set, any price_id value will result in "Price not found"
    let body = json!({
        "customer_id": "test_user",
        "product_id": product2.slug,
        "price_id": "price-from-product1",
        "success_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/checkout")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Price not found for this product");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_checkout_wrong_org(pool: PgPool) -> TestResult {
    let (_org1_id, project_id1, session_cookie1) = seed_organization(&pool).await;
    let (_org2_id, project_id2, _session_cookie2) = seed_organization(&pool).await;

    let _api_key1 = seed_api_key(&pool, project_id1).await;
    let api_key2 = seed_api_key(&pool, project_id2).await;

    let mut app = create_router(create_test_state(pool).await);

    // Create product under org1
    let product1 = app.create_product(&session_cookie1, project_id1).await;
    let _price_id1 = app
        .create_product_price(&session_cookie1, project_id1, product1.product_group_id)
        .await;

    // Try to create checkout with org2's API key for org1's product
    let body = json!({
        "customer_id": "test_user",
        "product_id": product1.slug
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/checkout")
                .header("Authorization", format!("Bearer {}", api_key2))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Product not found or does not belong to this project");
    Ok(())
}

/// Tests the complete checkout flow end-to-end.
///
/// This is a real integration test that requires Stripe API keys to be set via:
/// - STRIPE_SECRET_KEY environment variable
///
/// The test covers the complete happy path:
/// 1. Create organization (seed_organization)
/// 2. Create product (auto-creates Stripe product)
/// 3. Create product price (auto-creates Stripe price)
/// 4. Create checkout session via POST /checkout
/// 5. Verify response contains valid checkout_url
/// 6. Verify checkout_session record was created in database
#[sqlx::test(migrations = "./migrations")]
async fn test_full_checkout_flow_integration(pool: PgPool) -> TestResult {
    let (_org_id, project_id, session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    let product = app.create_product(&session_cookie, project_id).await;
    let _price_id = app
        .create_product_price(&session_cookie, project_id, product.product_group_id)
        .await;

    let body = json!({
        "customer_id": "test_user",
        "product_id": product.slug
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/checkout")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(
        response.status(),
        StatusCode::CREATED,
        "Expected 201 CREATED status for successful checkout session creation"
    );

    let response_body = read_body(response.into_body()).await;
    let checkout_url = response_body["checkout_url"]
        .as_str()
        .expect("Response must contain 'checkout_url' field");

    assert!(
        checkout_url.starts_with("https://checkout.stripe.com"),
        "checkout_url should start with 'https://checkout.stripe.com', got: {}",
        checkout_url
    );

    // Verify checkout_session record was created in database
    let checkout_session = sqlx::query!(
        r#"
        SELECT "projectId", "productId", status as "status: CheckoutStatus", "processorCheckoutId", mode as "mode: CheckoutMode"
        FROM checkout_session
        WHERE "projectId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 1
        "#,
        project_id
    )
    .fetch_one(&pool)
    .await
    .expect("checkout_session record should exist in database");

    assert_eq!(
        checkout_session.projectId, project_id,
        "checkout_session projectId should match"
    );
    assert_eq!(
        checkout_session.productId, product.id,
        "checkout_session productId should match"
    );
    assert_eq!(
        checkout_session.status,
        CheckoutStatus::Open,
        "checkout_session status should be 'open'"
    );
    assert!(
        !checkout_session.processorCheckoutId.is_empty(),
        "checkout_session should have a processorCheckoutId"
    );
    assert_eq!(
        checkout_session.mode,
        Some(CheckoutMode::Payment),
        "checkout should be in payment mode for one-time price"
    );

    Ok(())
}

/// Tests subscription mode checkout flow with a recurring price.
///
/// Validates that when a price has a recurring_interval set (e.g., "month"),
/// the checkout session is created in subscription mode and returns a valid checkout_url.
#[sqlx::test(migrations = "./migrations")]
async fn test_subscription_checkout_with_recurring_price(pool: PgPool) -> TestResult {
    let (_org_id, project_id, session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    let product = app.create_product(&session_cookie, project_id).await;

    // Create recurring product price (auto-creates Stripe price with recurring interval)
    let _price_id = app
        .create_product_price_with_details(
            &session_cookie,
            common::ProductPriceDetails {
                project_id,
                product_group_id: product.product_group_id,
                name: "Monthly Subscription",
                price: 2000,
                currency: "USD",
                recurring_interval: Some("month"),
            },
        )
        .await;

    let body = json!({
        "customer_id": "test_user",
        "product_id": product.slug
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/checkout")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    let status = response.status();
    let response_body = read_body_text(response.into_body()).await;

    if status != StatusCode::CREATED {
        eprintln!("Error response body: {}", response_body);
    }
    assert_eq!(
        status,
        StatusCode::CREATED,
        "Expected 201 CREATED status for successful checkout session creation"
    );

    let response_body_json: serde_json::Value =
        serde_json::from_str(&response_body).expect("Response body should be valid JSON");

    let checkout_url = response_body_json["checkout_url"]
        .as_str()
        .expect("Response must contain 'checkout_url' field");

    assert!(
        checkout_url.starts_with("https://checkout.stripe.com"),
        "checkout_url should start with 'https://checkout.stripe.com', got: {}",
        checkout_url
    );

    // Verify checkout_session record was created with subscription mode
    let checkout_session = sqlx::query!(
        r#"
        SELECT "projectId", "productId", status as "status: CheckoutStatus", "processorCheckoutId", mode as "mode: CheckoutMode"
        FROM checkout_session
        WHERE "projectId" = $1
        ORDER BY "createdAt" DESC
        LIMIT 1
        "#,
        project_id
    )
    .fetch_one(&pool)
    .await
    .expect("checkout_session record should exist in database");

    assert_eq!(checkout_session.projectId, project_id);
    assert_eq!(checkout_session.productId, product.id);
    assert_eq!(checkout_session.status, CheckoutStatus::Open);
    assert!(
        !checkout_session.processorCheckoutId.is_empty(),
        "checkout_session should have a processorCheckoutId"
    );
    assert_eq!(
        checkout_session.mode,
        Some(CheckoutMode::Subscription),
        "checkout should be in subscription mode for recurring price"
    );

    Ok(())
}

/// Tests checkout creation with minimal SDK request body.
///
/// Validates that a checkout session can be created with only the required fields:
/// - customer_id
/// - product_id
///
/// No success_url, cancel_url, or price_id are provided, testing the minimal API contract.
#[sqlx::test(migrations = "./migrations")]
async fn test_create_checkout_minimal_request(pool: PgPool) -> TestResult {
    let (_org_id, project_id, session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);
    let product = app.create_product(&session_cookie, project_id).await;
    let _price_id = app
        .create_product_price(&session_cookie, project_id, product.product_group_id)
        .await;
    // Minimal SDK request: only customer_id and product_id
    let body = json!({
        "customer_id": "user_abc123",
        "product_id": product.slug
    });
    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/checkout")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;
    let status = response.status();
    let response_body = read_body(response.into_body()).await;
    if status != StatusCode::CREATED {
        eprintln!("Error response body: {:?}", response_body);
    }
    assert_eq!(
        status,
        StatusCode::CREATED,
        "Expected 201 CREATED status for minimal checkout request"
    );
    let checkout_url = response_body["checkout_url"]
        .as_str()
        .expect("Response must contain 'checkout_url' field");
    assert!(
        checkout_url.starts_with("https://checkout.stripe.com"),
        "checkout_url should start with 'https://checkout.stripe.com', got: {}",
        checkout_url
    );
    Ok(())
}
/// Tests checkout creation with customer_data and verifies customer was created.
///
/// Validates that when customer_data is provided in the checkout request:
/// 1. The checkout session is created successfully
/// 2. A customer record is created with the provided email and name
/// 3. The customer can be retrieved via the customer API
#[sqlx::test(migrations = "./migrations")]
async fn test_create_checkout_with_customer_data(pool: PgPool) -> TestResult {
    let (_org_id, project_id, session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool.clone()).await);
    let product = app.create_product(&session_cookie, project_id).await;
    let _price_id = app
        .create_product_price(&session_cookie, project_id, product.product_group_id)
        .await;
    // SDK request with customer_data
    let body = json!({
        "customer_id": "user_abc123",
        "product_id": product.slug,
        "customer_data": {
            "email": "john@example.com",
            "name": "John Doe"
        }
    });
    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/checkout")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;
    let status = response.status();
    let response_body = read_body(response.into_body()).await;
    if status != StatusCode::CREATED {
        eprintln!("Error response body: {:?}", response_body);
    }
    assert_eq!(
        status,
        StatusCode::CREATED,
        "Expected 201 CREATED status for checkout with customer_data"
    );
    // Query customer from DB by external ID
    let customer = sqlx::query!(
        r#"
        SELECT id, email, name
        FROM customer
        WHERE "externalId" = $1 AND "projectId" = $2
        "#,
        "user_abc123",
        project_id
    )
    .fetch_one(&pool)
    .await
    .expect("Customer should exist in database");
    // Verify customer via API
    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/customer/{}", project_id, customer.id))
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie),
                )
                .body(Body::empty())?,
        )
        .await?;
    assert_eq!(
        response.status(),
        StatusCode::OK,
        "Expected 200 OK when fetching customer"
    );
    let customer_body = read_body(response.into_body()).await;
    assert_eq!(
        customer_body["email"].as_str(),
        Some("john@example.com"),
        "Customer email should match"
    );
    assert_eq!(
        customer_body["name"].as_str(),
        Some("John Doe"),
        "Customer name should match"
    );
    Ok(())
}
