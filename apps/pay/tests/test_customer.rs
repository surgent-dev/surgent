mod common;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use sqlx::PgPool;
use tower::Service;
use uuid::Uuid;

use common::{create_test_state, read_body, read_body_text, seed_customer, seed_organization};
use surpay::api::create_router;

type TestResult = Result<(), Box<dyn std::error::Error>>;

#[sqlx::test(migrations = "./migrations")]
async fn test_list_customers_empty(pool: PgPool) -> TestResult {
    let (_org_id, project_id, session_cookie) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/customers", project_id))
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie),
                )
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
    let (_org_id, project_id, session_cookie) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    // Seed a customer directly in the database
    let customer_id =
        seed_customer(&pool, project_id, "test@example.com", Some("Test Customer")).await;

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/customers", project_id))
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie),
                )
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
async fn test_list_customers_unauthorized(pool: PgPool) -> TestResult {
    let (_org1_id, project_id, _session_cookie1) = seed_organization(&pool).await;
    let (_org2_id, _project_id2, session_cookie2) = seed_organization(&pool).await;

    let mut app = create_router(create_test_state(pool.clone()).await);

    // Seed a customer in org1's project
    seed_customer(&pool, project_id, "test@example.com", Some("Test Customer")).await;

    // Try to list customers using org2's session
    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/customers", project_id))
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie2),
                )
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Access denied");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_customers_invalid_project(pool: PgPool) -> TestResult {
    let (_org_id, _project_id, session_cookie) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let invalid_project_id = Uuid::new_v4();

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/customers", invalid_project_id))
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie),
                )
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Access denied");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_get_customer_success(pool: PgPool) -> TestResult {
    let (_org_id, project_id, session_cookie) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    // Seed a customer directly in the database
    let customer_id =
        seed_customer(&pool, project_id, "test@example.com", Some("Test Customer")).await;

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/customer/{}", project_id, customer_id))
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie),
                )
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
    let (_org_id, project_id, session_cookie) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let invalid_customer_id = Uuid::new_v4();

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/project/{}/customer/{}",
                    project_id, invalid_customer_id
                ))
                .header(
                    "Cookie",
                    format!("better-auth.session_token={}", session_cookie),
                )
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Customer not found");
    Ok(())
}
