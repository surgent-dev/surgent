mod common;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::json;
use sqlx::PgPool;
use tower::Service;
use uuid::Uuid;

use common::{TestAppExt, create_test_state, read_body, read_body_text, seed_organization};
use surpay::api::create_router;
use surpay::types::CheckoutStatus;

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
    assert_eq!(body, "Missing Authorization header");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_checkout_invalid_product(pool: PgPool) -> TestResult {
    let (_org_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let project_id = app.create_project(&api_key).await;
    let (_product_id, product_group_id) = app.create_product(&api_key, project_id).await;
    let price_id = app
        .create_product_price(&api_key, project_id, product_group_id)
        .await;

    let body = json!({
        "product_id": Uuid::new_v4(),
        "price_id": price_id,
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
    assert_eq!(
        body,
        "Product not found or does not belong to this organization"
    );
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_checkout_invalid_price(pool: PgPool) -> TestResult {
    let (_org_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let project_id = app.create_project(&api_key).await;
    let (product_id, _) = app.create_product(&api_key, project_id).await;

    let body = json!({
        "product_id": product_id,
        "price_id": Uuid::new_v4(),
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
    let (_org_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let project_id = app.create_project(&api_key).await;

    // Create product 1 and its price
    let (_product_id1, product_group_id1) = app.create_product(&api_key, project_id).await;
    let price_id1 = app
        .create_product_price(&api_key, project_id, product_group_id1)
        .await;

    // Create product 2
    let (product_id2, _) = app.create_product(&api_key, project_id).await;

    // Try to create checkout with product_id2 but price_id1 (which belongs to product_id1)
    let body = json!({
        "product_id": product_id2,
        "price_id": price_id1,
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
    let (_org1_id, api_key1) = seed_organization(&pool).await;
    let (_org2_id, api_key2) = seed_organization(&pool).await;

    let mut app = create_router(create_test_state(pool).await);

    // Create product under org1
    let project_id1 = app.create_project(&api_key1).await;
    let (product_id1, product_group_id1) = app.create_product(&api_key1, project_id1).await;
    let price_id1 = app
        .create_product_price(&api_key1, project_id1, product_group_id1)
        .await;

    // Try to create checkout with org2's API key for org1's product
    let body = json!({
        "product_id": product_id1,
        "price_id": price_id1,
        "success_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel"
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
    assert_eq!(
        body,
        "Product not found or does not belong to this organization"
    );
    Ok(())
}

/// Tests the complete checkout flow end-to-end.
///
/// This is a real integration test that requires Stripe API keys to be set via:
/// - STRIPE_SECRET_KEY environment variable
///
/// The test covers the complete happy path:
/// 1. Create organization (seed_organization)
/// 2. Create project
/// 3. Create product (auto-creates Stripe product)
/// 4. Create product price (auto-creates Stripe price)
/// 5. Create checkout session via POST /checkout
/// 6. Verify response contains valid checkout_url and session_id
/// 7. Verify checkout_session record was created in database
#[sqlx::test(migrations = "./migrations")]
async fn test_full_checkout_flow_integration(pool: PgPool) -> TestResult {
    // Step 1: Create organization
    let (org_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    // Step 2: Create project
    let project_id = app.create_project(&api_key).await;

    // Step 3: Create product (auto-creates Stripe product)
    let (product_id, product_group_id) = app.create_product(&api_key, project_id).await;

    // Step 4: Create product price (auto-creates Stripe price)
    let price_id = app
        .create_product_price(&api_key, project_id, product_group_id)
        .await;

    // Step 5: Create checkout session
    let body = json!({
        "product_id": product_id,
        "price_id": price_id,
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

    // Step 6: Assert 201 CREATED status
    assert_eq!(
        response.status(),
        StatusCode::CREATED,
        "Expected 201 CREATED status for successful checkout session creation"
    );

    // Step 7: Parse response and assert it contains checkout_url
    let response_body = read_body(response.into_body()).await;

    let checkout_url = response_body["checkout_url"]
        .as_str()
        .expect("Response must contain 'checkout_url' field");
    let session_id = response_body["session_id"]
        .as_str()
        .expect("Response must contain 'session_id' field");

    println!("{}", checkout_url);

    // Step 8: Assert checkout_url starts with Stripe checkout URL
    assert!(
        checkout_url.starts_with("https://checkout.stripe.com"),
        "checkout_url should start with 'https://checkout.stripe.com', got: {}",
        checkout_url
    );

    // Step 9: Assert session_id is a valid UUID
    let parsed_session_id =
        Uuid::parse_str(session_id).expect("session_id must be a valid UUID format");

    // Step 10: Verify checkout_session record was created in database
    let checkout_session = sqlx::query!(
        r#"
        SELECT id, "processorCheckoutId", "organizationId", "projectId", "productId", "priceId", status as "status: CheckoutStatus"
        FROM checkout_session
        WHERE id = $1
        "#,
        parsed_session_id
    )
    .fetch_optional(&pool)
    .await
    .expect("Failed to query checkout_session from database");

    assert!(
        checkout_session.is_some(),
        "checkout_session record should exist in database"
    );

    let session = checkout_session.unwrap();

    // Verify all fields match
    assert_eq!(
        session.organizationId, org_id,
        "checkout_session organizationId should match the requesting organization"
    );
    assert_eq!(
        session.projectId, project_id,
        "checkout_session projectId should match the product's project"
    );
    assert_eq!(
        session.productId, product_id,
        "checkout_session productId should match the requested product"
    );
    assert_eq!(
        session.priceId, price_id,
        "checkout_session priceId should match the requested price"
    );
    assert_eq!(
        session.status,
        CheckoutStatus::Open,
        "checkout_session status should be 'open' for newly created sessions"
    );
    assert!(
        !session.processorCheckoutId.is_empty(),
        "checkout_session should have a non-empty processorCheckoutId"
    );

    Ok(())
}

/// Tests subscription mode checkout flow with a recurring price.
///
/// Validates that when a price has a recurring_interval set (e.g., "month"),
/// the checkout session is created in subscription mode and returns a valid checkout_url.
///
/// The test covers:
/// 1. Create organization
/// 2. Create project
/// 3. Create product (auto-creates Stripe product)
/// 4. Create recurring product price (auto-creates Stripe price with recurring interval)
/// 5. Create checkout session via POST /checkout
/// 6. Verify response contains valid checkout_url and session_id
/// 7. Verify checkout_session record was created in database
#[sqlx::test(migrations = "./migrations")]
async fn test_subscription_checkout_with_recurring_price(pool: PgPool) -> TestResult {
    // Step 1: Create organization
    let (org_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    // Step 2: Create project
    let project_id = app.create_project(&api_key).await;

    // Step 3: Create product (auto-creates Stripe product)
    let (product_id, product_group_id) = app.create_product(&api_key, project_id).await;

    // Step 4: Create recurring product price (auto-creates Stripe price with recurring interval)
    let price_id = app
        .create_product_price_with_details(
            &api_key,
            common::ProductPriceDetails {
                project_id,
                product_group_id,
                name: "Monthly Subscription",
                price: 2000,
                currency: "USD",
                recurring_interval: Some("month"),
            },
        )
        .await;

    // Step 5: Create checkout session
    let body = json!({
        "product_id": product_id,
        "price_id": price_id,
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

    // Step 6: Assert 201 CREATED status
    let status = response.status();

    // Read response body before asserting
    let response_body = read_body_text(response.into_body()).await;

    if status != StatusCode::CREATED {
        eprintln!("Error response body: {}", response_body);
    }
    assert_eq!(
        status,
        StatusCode::CREATED,
        "Expected 201 CREATED status for successful checkout session creation"
    );

    // Step 7: Parse response and assert it contains checkout_url
    let response_body_json: serde_json::Value =
        serde_json::from_str(&response_body).expect("Response body should be valid JSON");

    let checkout_url = response_body_json["checkout_url"]
        .as_str()
        .expect("Response must contain 'checkout_url' field");
    let session_id = response_body_json["session_id"]
        .as_str()
        .expect("Response must contain 'session_id' field");

    println!("{}", checkout_url);

    // Step 8: Assert checkout_url starts with Stripe checkout URL
    assert!(
        checkout_url.starts_with("https://checkout.stripe.com"),
        "checkout_url should start with 'https://checkout.stripe.com', got: {}",
        checkout_url
    );

    // Step 9: Assert session_id is a valid UUID
    let parsed_session_id =
        Uuid::parse_str(session_id).expect("session_id must be a valid UUID format");

    // Step 10: Verify checkout_session record was created in database
    let checkout_session = sqlx::query!(
        r#"
        SELECT id, "processorCheckoutId", "organizationId", "projectId", "productId", "priceId", status as "status: CheckoutStatus"
        FROM checkout_session
        WHERE id = $1
        "#,
        parsed_session_id
    )
    .fetch_optional(&pool)
    .await
    .expect("Failed to query checkout_session from database");

    assert!(
        checkout_session.is_some(),
        "checkout_session record should exist in database"
    );

    let session = checkout_session.unwrap();

    // Verify all fields match
    assert_eq!(
        session.organizationId, org_id,
        "checkout_session organizationId should match the requesting organization"
    );
    assert_eq!(
        session.projectId, project_id,
        "checkout_session projectId should match the product's project"
    );
    assert_eq!(
        session.productId, product_id,
        "checkout_session productId should match the requested product"
    );
    assert_eq!(
        session.priceId, price_id,
        "checkout_session priceId should match the requested price"
    );
    assert_eq!(
        session.status,
        CheckoutStatus::Open,
        "checkout_session status should be 'open' for newly created sessions"
    );
    assert!(
        !session.processorCheckoutId.is_empty(),
        "checkout_session should have a non-empty processorCheckoutId"
    );

    Ok(())
}
