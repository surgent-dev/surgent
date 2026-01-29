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

type TestResult = Result<(), Box<dyn std::error::Error>>;

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_price_success(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let product = app.create_product(&api_key).await;

    let body = json!({
        "productGroup": product.product_group,
        "name": "Monthly Plan",
        "description": "Monthly subscription",
        "price": 1999,
        "price_currency": "USD",
        "recurring_interval": "month",
        "is_default": true
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product/price")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = read_body(response.into_body()).await;
    assert!(body.get("product_price_id").is_some());
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_price_minimal(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let product = app.create_product(&api_key).await;

    let body = json!({
        "productGroup": product.product_group,
        "price": 999,
        "price_currency": "USD"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product/price")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = read_body(response.into_body()).await;
    assert!(body.get("product_price_id").is_some());
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_price_invalid_product(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let body = json!({
        "productGroup": Uuid::new_v4(),
        "price": 999,
        "price_currency": "USD"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product/price")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Invalid product");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_price_wrong_project(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let (_org_id2, project_id2, _session_cookie2) = seed_organization(&pool).await;
    let api_key1 = seed_api_key(&pool, project_id).await;
    let api_key2 = seed_api_key(&pool, project_id2).await;
    let mut app = create_router(create_test_state(pool).await);

    // Create product in project 1
    let product = app.create_product(&api_key1).await;

    // Try to create price using API key from project 2
    let body = json!({
        "productGroup": product.product_group,
        "price": 999,
        "price_currency": "USD"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product/price")
                .header("Authorization", format!("Bearer {}", api_key2))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Invalid product");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_price_cross_org_access(pool: PgPool) -> TestResult {
    let (_org1_id, project_id, _session_cookie1) = seed_organization(&pool).await;
    let (_org2_id, project_id2, _session_cookie2) = seed_organization(&pool).await;
    let api_key1 = seed_api_key(&pool, project_id).await;
    let api_key2 = seed_api_key(&pool, project_id2).await;

    let mut app = create_router(create_test_state(pool).await);

    let product = app.create_product(&api_key1).await;

    // Try to create price using API key from org 2
    let body = json!({
        "productGroup": product.product_group,
        "price": 999,
        "price_currency": "USD"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product/price")
                .header("Authorization", format!("Bearer {}", api_key2))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Invalid product");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_price_missing_auth(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);
    let body = json!({
        "productGroup": Uuid::new_v4(),
        "price": 999,
        "price_currency": "USD"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product/price")
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Missing authentication");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_price_missing_required_fields(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let product = app.create_product(&api_key).await;

    let body = json!({
        "productGroup": product.product_group
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product/price")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body = read_body_text(response.into_body()).await;
    assert!(
        body.contains("price"),
        "Expected error to mention 'price', got: {}",
        body
    );
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_price_stripe_integration(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    let product = app.create_product(&api_key).await;

    let body = json!({
        "productGroup": product.product_group,
        "name": "Monthly Plan",
        "description": "Monthly subscription",
        "price": 1999,
        "price_currency": "USD",
        "recurring_interval": "month",
        "is_default": true
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product/price")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);

    let response_body = read_body(response.into_body()).await;
    let product_price_id = Uuid::parse_str(response_body["product_price_id"].as_str().unwrap())?;

    let price_record = sqlx::query!(
        r#"
        SELECT "processorPriceId"
        FROM product_price
        WHERE id = $1
        "#,
        product_price_id
    )
    .fetch_one(&pool)
    .await?;

    assert!(
        price_record.processorPriceId.is_some(),
        "Expected processorPriceId to be populated"
    );

    let processor_price_id = price_record.processorPriceId.unwrap();
    assert!(
        processor_price_id.starts_with("price_"),
        "Expected processorPriceId to start with 'price_', got: {}",
        processor_price_id
    );

    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_price_same_amount_different_intervals(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let product = app.create_product(&api_key).await;

    // Create a recurring monthly price at $10
    let monthly_body = json!({
        "productGroup": product.product_group,
        "name": "Monthly",
        "price": 1000,
        "price_currency": "USD",
        "recurring_interval": "month"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product/price")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(monthly_body.to_string()))?,
        )
        .await?;
    assert_eq!(response.status(), StatusCode::CREATED);
    let monthly_price_id = read_body(response.into_body()).await["product_price_id"]
        .as_str()
        .unwrap()
        .to_string();

    // Create a one-time price at $10 (same amount, no interval)
    let onetime_body = json!({
        "productGroup": product.product_group,
        "name": "One-time",
        "price": 1000,
        "price_currency": "USD"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product/price")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(onetime_body.to_string()))?,
        )
        .await?;
    assert_eq!(response.status(), StatusCode::CREATED);
    let onetime_price_id = read_body(response.into_body()).await["product_price_id"]
        .as_str()
        .unwrap()
        .to_string();

    // Verify both prices were created and are distinct
    assert_ne!(
        monthly_price_id, onetime_price_id,
        "Same amount with different intervals should create distinct prices"
    );

    Ok(())
}
