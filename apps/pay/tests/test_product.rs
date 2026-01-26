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

type TestResult = Result<(), Box<dyn std::error::Error>>;

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_success(pool: PgPool) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let body = json!({
        "project_id": project_id,
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
                .header("Authorization", format!("Bearer {}", api_key))
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
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let body = json!({
        "project_id": project_id,
        "product_group_id": Uuid::new_v4(),
        "slug": "test-product"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("Authorization", format!("Bearer {}", api_key))
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
async fn test_create_product_missing_project_id(pool: PgPool) -> TestResult {
    let (_org_id, _project_id, api_key) = seed_organization(&pool).await;
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
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body = read_body_text(response.into_body()).await;
    assert!(
        body.contains("project_id"),
        "Expected error to mention 'project_id', got: {}",
        body
    );
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_invalid_project(pool: PgPool) -> TestResult {
    let (_org_id, _project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let body = json!({
        "project_id": Uuid::new_v4(),
        "product_group_id": Uuid::new_v4(),
        "name": "Test Product",
        "slug": "test-product"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Invalid project");
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
    assert_eq!(body, "Missing API key");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_wrong_org_project(pool: PgPool) -> TestResult {
    // Create two organizations, project under first org
    let (_org1_id, project_id, _api_key1) = seed_organization(&pool).await;
    let (_org2_id, _project_id2, api_key2) = seed_organization(&pool).await;

    let mut app = create_router(create_test_state(pool).await);

    // Try to create product using org2's API key for org1's project
    let body = json!({
        "project_id": project_id,
        "product_group_id": Uuid::new_v4(),
        "name": "Test Product",
        "slug": "test-product"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("Authorization", format!("Bearer {}", api_key2))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Invalid project");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_duplicate_slug_allowed(pool: PgPool) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let slug = format!("test-product-{}", Uuid::new_v4());
    let product_group_id = Uuid::new_v4();
    let body = json!({
        "project_id": project_id,
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
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);

    // Second request with same slug should also succeed (slug not unique)
    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/product")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_update_product_success(pool: PgPool) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let (product_id, product_group_id) = app.create_product(&api_key, project_id).await;

    let body = json!({
        "name": "Updated Product",
        "description": "New description"
    });

    let response = app
        .call(
            Request::builder()
                .method("PUT")
                .uri(format!("/product/{}", product_id))
                .header("Authorization", format!("Bearer {}", api_key))
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
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let product_group_id = Uuid::new_v4();

    // Create first product (version 1)
    let product_id = app
        .create_product_with_group(&api_key, project_id, product_group_id)
        .await;

    // Update to version 2
    let response = app
        .call(
            Request::builder()
                .method("PUT")
                .uri(format!("/product/{}", product_id))
                .header("Authorization", format!("Bearer {}", api_key))
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
                .header("Authorization", format!("Bearer {}", api_key))
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
    let (_org_id, _project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let response = app
        .call(
            Request::builder()
                .method("PUT")
                .uri(format!("/product/{}", Uuid::new_v4()))
                .header("Authorization", format!("Bearer {}", api_key))
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
    assert_eq!(body, "Missing API key");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_update_product_wrong_org(pool: PgPool) -> TestResult {
    let (_org1_id, project_id, api_key1) = seed_organization(&pool).await;
    let (_org2_id, _project_id2, api_key2) = seed_organization(&pool).await;

    let mut app = create_router(create_test_state(pool).await);

    let (product_id, _) = app.create_product(&api_key1, project_id).await;

    // Try to update with org2's API key
    let response = app
        .call(
            Request::builder()
                .method("PUT")
                .uri(format!("/product/{}", product_id))
                .header("Authorization", format!("Bearer {}", api_key2))
                .header("Content-Type", "application/json")
                .body(Body::from(json!({"name": "Hacked xd lmao"}).to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Product not found");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_product_with_stripe_integration(pool: PgPool) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    let product_name = "Stripe Integrated Product";

    let body = json!({
        "project_id": project_id,
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
                .header("Authorization", format!("Bearer {}", api_key))
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
