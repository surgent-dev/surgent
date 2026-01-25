mod common;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::json;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

use common::{create_test_state, read_body, read_body_text, seed_api_key};
use surpay::api::create_router;

type TestResult = Result<(), Box<dyn std::error::Error>>;

#[sqlx::test(migrations = "./migrations")]
async fn test_create_organization_success(pool: PgPool) -> TestResult {
    let api_key = seed_api_key(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let body = json!({
        "name": "Test Organization",
        "slug": format!("test-org-{}", Uuid::new_v4())
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/organization")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_body(response.into_body()).await;
    assert!(body.get("id").is_some());
    assert!(body.get("api_key").is_some());
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_organization_missing_auth(pool: PgPool) -> TestResult {
    let app = create_router(create_test_state(pool).await);
    let body = json!({ "name": "Test Organization", "slug": "test-org" });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/organization")
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
async fn test_create_organization_invalid_key_format(pool: PgPool) -> TestResult {
    let app = create_router(create_test_state(pool).await);

    let body = json!({
        "name": "Test Organization",
        "slug": "test-org-invalid-key"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/organization")
                .header("Authorization", "Bearer invalid-key-format")
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Invalid API key format");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_organization_wrong_api_key(pool: PgPool) -> TestResult {
    seed_api_key(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let body = json!({
        "name": "Test Organization",
        "slug": "test-org-wrong-key"
    });

    // Valid format but wrong secret
    let wrong_key = "sp_master_testtst1_wrongsecretwrongsecretwrongse";

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/organization")
                .header("Authorization", format!("Bearer {}", wrong_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Invalid API key");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_organization_wrong_auth_scheme(pool: PgPool) -> TestResult {
    let api_key = seed_api_key(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let body = json!({
        "name": "Test Organization",
        "slug": "test-org-wrong-scheme"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/organization")
                .header("Authorization", format!("Basic {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Invalid Authorization scheme");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_organization_missing_name(pool: PgPool) -> TestResult {
    let api_key = seed_api_key(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let body = json!({
        "slug": "test-org-no-name"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/organization")
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
async fn test_create_organization_missing_slug(pool: PgPool) -> TestResult {
    let api_key = seed_api_key(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let body = json!({
        "name": "Test Organization"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/organization")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body = read_body_text(response.into_body()).await;
    assert!(
        body.contains("slug"),
        "Expected error to mention 'slug', got: {}",
        body
    );
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_organization_empty_body(pool: PgPool) -> TestResult {
    let api_key = seed_api_key(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/organization")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from("{}"))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body = read_body_text(response.into_body()).await;
    assert!(
        body.contains("missing field"),
        "Expected error to mention missing field, got: {}",
        body
    );
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_organization_invalid_json(pool: PgPool) -> TestResult {
    let api_key = seed_api_key(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/organization")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from("not valid json"))?,
        )
        .await?;

    // Axum returns 400 Bad Request for malformed JSON (parse error)
    // vs 422 Unprocessable Entity for valid JSON with missing/invalid fields
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = read_body_text(response.into_body()).await;
    assert!(
        body.contains("expected"),
        "Expected parse error message, got: {}",
        body
    );
    Ok(())
}
