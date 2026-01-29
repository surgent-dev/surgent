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
    create_test_state, read_body, read_body_text, seed_api_key, seed_organization, seed_session,
};
use surpay::api::create_router;

type TestResult = Result<(), Box<dyn std::error::Error>>;

/// Helper to create a product using API key auth, returns (product_id, product_group_id)
async fn create_product_with_api_key(app: &mut axum::Router, api_key: &str) -> (Uuid, Uuid) {
    let product_group_id = Uuid::new_v4();
    let slug = format!("test-product-{}", &Uuid::new_v4().to_string()[..8]);
    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("x-api-key", api_key)
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "product_group_id": product_group_id,
                        "name": "Test Product",
                        "slug": slug
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = read_body(response.into_body()).await;
    let product_id = Uuid::parse_str(body["product_id"].as_str().unwrap()).unwrap();
    (product_id, product_group_id)
}

/// Helper to create a product with a specific group using API key auth
async fn create_product_with_group_api_key(
    app: &mut axum::Router,
    api_key: &str,
    product_group_id: Uuid,
) -> Uuid {
    let slug = format!("test-product-{}", &Uuid::new_v4().to_string()[..8]);
    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("x-api-key", api_key)
                .header("Content-Type", "application/json")
                .body(Body::from(
                    json!({
                        "product_group_id": product_group_id,
                        "name": "Test Product",
                        "slug": slug
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = read_body(response.into_body()).await;
    Uuid::parse_str(body["product_id"].as_str().unwrap()).unwrap()
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_success(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let body = json!({
        "product_group_id": Uuid::new_v4(),
        "name": "Test Product",
        "slug": format!("test-product-{}", Uuid::new_v4()),
        "description": "A test product"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("x-api-key", &api_key)
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = read_body(response.into_body()).await;
    assert!(body.get("product_id").is_some());
    assert!(body.get("product_group_id").is_some());
    assert_eq!(body.get("version").and_then(|v| v.as_i64()), Some(1));
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_missing_name(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let body = json!({
        "product_group_id": Uuid::new_v4(),
        "slug": "test-product"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("x-api-key", &api_key)
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body = read_body_text(response.into_body()).await;
    assert!(
        body.contains("name"),
        "Expected error to mention 'name', got: {}",
        body
    );
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_requires_api_key_with_project(pool: PgPool) -> TestResult {
    let (org_id, _project_id, session_cookie) = seed_organization(&pool).await;
    let (_user_id, _session_cookie2) = seed_session(&pool, org_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let body = json!({
        "product_group_id": Uuid::new_v4(),
        "name": "Test Product",
        "slug": "test-product"
    });

    // Session auth without project_id query param should return BAD_REQUEST
    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie),
                )
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "project_id query parameter required for session auth");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_invalid_api_key(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);

    let body = json!({
        "product_group_id": Uuid::new_v4(),
        "name": "Test Product",
        "slug": "test-product"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("x-api-key", "invalid-api-key")
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    // Invalid API key falls back to cookie auth, which also fails
    assert_eq!(body, "Missing authentication");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_missing_auth(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);
    let body = json!({});

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
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
async fn test_create_product_api_key_scoped_to_project(pool: PgPool) -> TestResult {
    // Create two organizations with projects
    let (_org1_id, project1_id, _session1) = seed_organization(&pool).await;
    let (_org2_id, project2_id, _session2) = seed_organization(&pool).await;
    let api_key1 = seed_api_key(&pool, project1_id).await;

    let mut app = create_router(create_test_state(pool.clone()).await);

    // Create product using org1's API key - should succeed and be in project1
    let body = json!({
        "product_group_id": Uuid::new_v4(),
        "name": "Test Product",
        "slug": format!("test-product-{}", Uuid::new_v4())
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("x-api-key", &api_key1)
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);

    let resp_body = read_body(response.into_body()).await;
    let product_id = Uuid::parse_str(resp_body["product_id"].as_str().unwrap())?;

    // Verify product is in project1, not project2
    let product = sqlx::query!(
        r#"SELECT "projectId" FROM product WHERE id = $1"#,
        product_id
    )
    .fetch_one(&pool)
    .await?;

    assert_eq!(product.projectId, project1_id);
    assert_ne!(product.projectId, project2_id);
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_duplicate_slug_rejected(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let slug = format!("test-product-{}", Uuid::new_v4());
    let product_group_id = Uuid::new_v4();
    let body = json!({
        "product_group_id": product_group_id,
        "name": "Test Product",
        "slug": slug
    });

    // First request should succeed
    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("x-api-key", &api_key)
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);

    // Second request with same slug should fail (slug unique per project)
    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("x-api-key", &api_key)
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CONFLICT);
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_update_product_success(pool: PgPool) -> TestResult {
    let (org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let (_user_id, session_cookie) = seed_session(&pool, org_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let (product_id, product_group_id) = create_product_with_api_key(&mut app, &api_key).await;

    let body = json!({
        "name": "Updated Product",
        "description": "New description"
    });

    let response = app
        .call(
            Request::builder()
                .method("PUT")
                .uri(format!("/product/{}", product_id))
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie),
                )
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = read_body(response.into_body()).await;
    assert!(body.get("product_id").is_some());
    assert_ne!(body["product_id"].as_str().unwrap(), product_id.to_string());
    assert_eq!(
        body["product_group_id"].as_str().unwrap(),
        product_group_id.to_string()
    );
    assert_eq!(body.get("version").and_then(|v| v.as_i64()), Some(2));
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_update_product_increments_version_correctly(pool: PgPool) -> TestResult {
    let (org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let (_user_id, session_cookie) = seed_session(&pool, org_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let product_group_id = Uuid::new_v4();

    // Create first product (version 1)
    let product_id = create_product_with_group_api_key(&mut app, &api_key, product_group_id).await;

    // Update to version 2
    let response = app
        .call(
            Request::builder()
                .method("PUT")
                .uri(format!("/product/{}", product_id))
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie),
                )
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"name": "V2"}).to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);
    let body = read_body(response.into_body()).await;
    assert_eq!(body.get("version").and_then(|v| v.as_i64()), Some(2));
    let product_id_v2 = body["product_id"].as_str().unwrap();

    // Update v2 to version 3
    let response = app
        .call(
            Request::builder()
                .method("PUT")
                .uri(format!("/product/{}", product_id_v2))
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie),
                )
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"name": "V3"}).to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);
    let body = read_body(response.into_body()).await;
    assert_eq!(body.get("version").and_then(|v| v.as_i64()), Some(3));
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_update_product_not_found(pool: PgPool) -> TestResult {
    let (org_id, _project_id, _api_key) = seed_organization(&pool).await;
    let (_user_id, session_cookie) = seed_session(&pool, org_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let response = app
        .call(
            Request::builder()
                .method("PUT")
                .uri(format!("/product/{}", Uuid::new_v4()))
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie),
                )
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"name": "Updated"}).to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Product not found");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_update_product_missing_auth(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);

    let response = app
        .call(
            Request::builder()
                .method("PUT")
                .uri(format!("/product/{}", Uuid::new_v4()))
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"name": "Updated"}).to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Missing authentication");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_update_product_wrong_org(pool: PgPool) -> TestResult {
    let (org1_id, project_id, _session_cookie1) = seed_organization(&pool).await;
    let (org2_id, _project_id2, _session_cookie2) = seed_organization(&pool).await;
    let api_key1 = seed_api_key(&pool, project_id).await;
    let (_user_id1, _session_cookie1_extra) = seed_session(&pool, org1_id).await;
    let (_user_id2, session_cookie2) = seed_session(&pool, org2_id).await;

    let mut app = create_router(create_test_state(pool).await);

    let (product_id, _) = create_product_with_api_key(&mut app, &api_key1).await;

    // Try to update with org2's session
    let response = app
        .call(
            Request::builder()
                .method("PUT")
                .uri(format!("/product/{}", product_id))
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie2),
                )
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"name": "Hacked xd lmao"}).to_string()))?,
        )
        .await?;

    // Returns 403 FORBIDDEN when user doesn't have access to the project
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Access denied");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_with_stripe_integration(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    let product_name = "Stripe Integrated Product";

    let body = json!({
        "product_group_id": Uuid::new_v4(),
        "name": product_name,
        "slug": format!("stripe-test-{}", Uuid::new_v4()),
        "description": "Testing Stripe integration"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("x-api-key", &api_key)
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = read_body(response.into_body()).await;
    let product_id = Uuid::parse_str(body["product_id"].as_str().unwrap())?;

    // Verify database record and processorProductId population
    let product = sqlx::query!(
        r#"SELECT name, "processorProductId" FROM product WHERE id = $1"#,
        product_id
    )
    .fetch_one(&pool)
    .await?;

    assert_eq!(product.name, product_name);
    assert!(
        product.processorProductId.is_some(),
        "processorProductId should be populated"
    );
    assert!(
        product.processorProductId.unwrap().starts_with("prod_"),
        "processorProductId should start with 'prod_'"
    );

    Ok(())
}
