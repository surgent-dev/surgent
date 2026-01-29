mod common;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use sqlx::PgPool;
use tower::Service;
use uuid::Uuid;

use common::{
    create_test_state, read_body, read_body_text, seed_api_key, seed_customer, seed_organization,
};
use surpay::api::create_router;

type TestResult = Result<(), Box<dyn std::error::Error>>;

#[sqlx::test(migrations = "./migrations")]
async fn test_list_customers_requires_auth(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri("/customers")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Missing authentication");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_customers_empty(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri("/customers")
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_body(response.into_body()).await;
    let customers = body.as_array().expect("Expected array response");
    assert!(customers.is_empty());
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_customers_success(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    // Seed a customer directly in the database
    let customer_id =
        seed_customer(&pool, project_id, "test@example.com", Some("Test Customer")).await;

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri("/customers")
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_body(response.into_body()).await;
    let customers = body.as_array().expect("Expected array response");
    assert_eq!(customers.len(), 1);

    let customer = &customers[0];
    assert_eq!(
        customer["id"].as_str(),
        Some(customer_id.to_string().as_str())
    );
    assert_eq!(customer["email"].as_str(), Some("test@example.com"));
    assert_eq!(customer["name"].as_str(), Some("Test Customer"));
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_customers_returns_project_customers(pool: PgPool) -> TestResult {
    let (_org_id1, project_id1, _session_cookie1) = seed_organization(&pool).await;
    let (_org_id2, project_id2, _session_cookie2) = seed_organization(&pool).await;
    let api_key1 = seed_api_key(&pool, project_id1).await;
    let api_key2 = seed_api_key(&pool, project_id2).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    // Seed a customer in project1
    let customer_id1 =
        seed_customer(&pool, project_id1, "test1@example.com", Some("Customer 1")).await;

    // Seed a customer in project2
    seed_customer(&pool, project_id2, "test2@example.com", Some("Customer 2")).await;

    // List customers for project1
    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri("/customers")
                .header("Authorization", format!("Bearer {}", api_key1))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    let body = read_body(response.into_body()).await;
    let customers = body.as_array().unwrap();
    assert_eq!(customers.len(), 1);
    assert_eq!(
        customers[0]["id"].as_str().unwrap(),
        customer_id1.to_string()
    );

    // List customers for project2
    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri("/customers")
                .header("Authorization", format!("Bearer {}", api_key2))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    let body = read_body(response.into_body()).await;
    let customers = body.as_array().unwrap();
    assert_eq!(customers.len(), 1);
    assert_eq!(customers[0]["email"].as_str().unwrap(), "test2@example.com");

    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_get_customer_requires_auth(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);
    let customer_id = Uuid::new_v4();

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/customers/{}", customer_id))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Missing authentication");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_get_customer_success(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    // Seed a customer directly in the database
    let customer_id =
        seed_customer(&pool, project_id, "test@example.com", Some("Test Customer")).await;

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/customers/{}", customer_id))
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_body(response.into_body()).await;
    assert_eq!(body["id"].as_str(), Some(customer_id.to_string().as_str()));
    assert_eq!(body["email"].as_str(), Some("test@example.com"));
    assert_eq!(body["name"].as_str(), Some("Test Customer"));

    // Should have empty transactions and subscriptions arrays
    let transactions = body["transactions"]
        .as_array()
        .expect("transactions should be array");
    assert!(transactions.is_empty(), "transactions should be empty");

    let subscriptions = body["subscriptions"]
        .as_array()
        .expect("subscriptions should be array");
    assert!(subscriptions.is_empty(), "subscriptions should be empty");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_get_customer_not_found(pool: PgPool) -> TestResult {
    let (_org_id, project_id, _session_cookie) = seed_organization(&pool).await;
    let api_key = seed_api_key(&pool, project_id).await;
    let mut app = create_router(create_test_state(pool).await);

    let invalid_customer_id = Uuid::new_v4();

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/customers/{}", invalid_customer_id))
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Customer not found");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_get_customer_access_denied(pool: PgPool) -> TestResult {
    let (_org_id1, project_id1, _session_cookie1) = seed_organization(&pool).await;
    let (_org_id2, project_id2, _session_cookie2) = seed_organization(&pool).await;
    let api_key2 = seed_api_key(&pool, project_id2).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    // Seed a customer in project1
    let customer_id = seed_customer(&pool, project_id1, "test@example.com", Some("Customer")).await;

    // Try to access with project2's API key
    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/customers/{}", customer_id))
                .header("Authorization", format!("Bearer {}", api_key2))
                .body(Body::empty())?,
        )
        .await?;

    // Returns 404 NOT_FOUND when customer doesn't belong to the project
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    Ok(())
}
