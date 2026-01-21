mod common;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::json;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

use common::{create_test_state, read_body, read_body_text, seed_organization};
use surpay::api::create_router;

type TestResult = Result<(), Box<dyn std::error::Error>>;

#[sqlx::test(migrations = "./migrations")]
async fn test_create_project_success(pool: PgPool) -> TestResult {
    let (_org_id, api_key) = seed_organization(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let body = json!({
        "name": "Test Project",
        "slug": format!("test-project-{}", Uuid::new_v4()),
        "external_id": Uuid::new_v4()
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/project")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = read_body(response.into_body()).await;
    assert!(body.get("id").is_some());
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_project_missing_name(pool: PgPool) -> TestResult {
    let (_org_id, api_key) = seed_organization(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let body = json!({
        "slug": "test-project"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/project")
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
async fn test_create_project_missing_slug(pool: PgPool) -> TestResult {
    let (_org_id, api_key) = seed_organization(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let body = json!({
        "name": "Test Project"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/project")
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
async fn test_create_project_missing_auth(pool: PgPool) -> TestResult {
    let app = create_router(create_test_state(pool).await);
    let body = json!({});

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/project")
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
async fn test_create_project_invalid_key_format(pool: PgPool) -> TestResult {
    let app = create_router(create_test_state(pool).await);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/project")
                .header("Authorization", "Bearer invalid-key-format")
                .header("Content-Type", "application/json")
                .body(Body::from("{}"))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Invalid API key format");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_project_wrong_api_key(pool: PgPool) -> TestResult {
    let (_org_id, api_key) = seed_organization(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let body = json!({
        "name": "Test Project",
        "slug": "test-project"
    });

    // Valid format but wrong secret - use the prefix from the seeded org
    let parts: Vec<&str> = api_key.split('_').collect();
    let prefix = parts.get(2).unwrap_or(&"tsxxxxxx");
    let wrong_key = format!("sp_org_{}_wrongsecretwrongsecretwrongse", prefix);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/project")
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
async fn test_create_project_wrong_auth_scheme(pool: PgPool) -> TestResult {
    let (_org_id, api_key) = seed_organization(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let body = json!({
        "name": "Test Project",
        "slug": "test-project"
    });

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/project")
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
async fn test_create_project_duplicate_slug(pool: PgPool) -> TestResult {
    let (_org_id, api_key) = seed_organization(&pool).await;
    let app = create_router(create_test_state(pool.clone()).await);

    let slug = format!("test-project-{}", Uuid::new_v4());
    let body = json!({
        "name": "Test Project",
        "slug": slug
    });

    // First request should succeed
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/project")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CREATED);

    // Second request with same slug should fail
    let app = create_router(create_test_state(pool).await);
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/project")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::CONFLICT);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "slug already exists");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_project_invalid_json(pool: PgPool) -> TestResult {
    let (_org_id, api_key) = seed_organization(&pool).await;
    let app = create_router(create_test_state(pool).await);

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/project")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from("not valid json"))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = read_body_text(response.into_body()).await;
    assert!(
        body.contains("expected"),
        "Expected parse error message, got: {}",
        body
    );
    Ok(())
}
