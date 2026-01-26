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
    create_test_state, create_test_state_real_stripe, read_body, read_body_text, seed_organization,
};
use surpay::api::create_router;

type TestResult = Result<(), Box<dyn std::error::Error>>;

// ==================== GET /accounts (list_accounts) ====================

#[sqlx::test(migrations = "./migrations")]
async fn test_list_accounts_requires_auth(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri("/accounts")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Missing API key");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_accounts_empty(pool: PgPool) -> TestResult {
    let (_org_id, _project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri("/accounts")
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    let body = read_body(response.into_body()).await;
    assert_eq!(body.as_array().unwrap().len(), 0);
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_accounts_returns_project_accounts(pool: PgPool) -> TestResult {
    let (_org_id1, project_id1, api_key1) = seed_organization(&pool).await;
    let (_org_id2, project_id2, api_key2) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    // Insert account for project1
    let account_id1 = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO connect_account (
            id,
            "projectId",
            country,
            currency,
            "isPayoutsEnabled",
            processor,
            "processorAccountId",
            status,
            "detailsSubmitted",
            "chargesEnabled",
            "businessType",
            data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        "#,
        account_id1,
        project_id1,
        "US",
        "usd",
        false,
        "stripe",
        "acct_test_1",
        "pending",
        false,
        false,
        None::<String>,
        json!({})
    )
    .execute(&pool)
    .await?;

    // Insert account for project2
    let account_id2 = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO connect_account (
            id,
            "projectId",
            country,
            currency,
            "isPayoutsEnabled",
            processor,
            "processorAccountId",
            status,
            "detailsSubmitted",
            "chargesEnabled",
            "businessType",
            data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        "#,
        account_id2,
        project_id2,
        "GB",
        "gbp",
        false,
        "stripe",
        "acct_test_2",
        "pending",
        false,
        false,
        None::<String>,
        json!({})
    )
    .execute(&pool)
    .await?;

    // List accounts for project1
    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri("/accounts")
                .header("Authorization", format!("Bearer {}", api_key1))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    let body = read_body(response.into_body()).await;
    let accounts = body.as_array().unwrap();
    assert_eq!(accounts.len(), 1);
    assert_eq!(accounts[0]["id"].as_str().unwrap(), account_id1.to_string());

    // List accounts for project2
    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri("/accounts")
                .header("Authorization", format!("Bearer {}", api_key2))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    let body = read_body(response.into_body()).await;
    let accounts = body.as_array().unwrap();
    assert_eq!(accounts.len(), 1);
    assert_eq!(accounts[0]["id"].as_str().unwrap(), account_id2.to_string());

    Ok(())
}

// ==================== GET /accounts/{id} (get_account) ====================

#[sqlx::test(migrations = "./migrations")]
async fn test_get_account_requires_auth(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);
    let account_id = Uuid::new_v4();

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/accounts/{}", account_id))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Missing API key");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_get_account_not_found(pool: PgPool) -> TestResult {
    let (_org_id, _project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);
    let account_id = Uuid::new_v4();

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/accounts/{}", account_id))
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Account not found");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_get_account_access_denied(pool: PgPool) -> TestResult {
    let (_org_id1, project_id1, _api_key1) = seed_organization(&pool).await;
    let (_org_id2, _project_id2, api_key2) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    // Insert account for project1
    let account_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO connect_account (
            id,
            "projectId",
            country,
            currency,
            "isPayoutsEnabled",
            processor,
            "processorAccountId",
            status,
            "detailsSubmitted",
            "chargesEnabled",
            "businessType",
            data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        "#,
        account_id,
        project_id1,
        "US",
        "usd",
        false,
        "stripe",
        "acct_test_123",
        "pending",
        false,
        false,
        None::<String>,
        json!({})
    )
    .execute(&pool)
    .await?;

    // Try to access with project2's API key
    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/accounts/{}", account_id))
                .header("Authorization", format!("Bearer {}", api_key2))
                .body(Body::empty())?,
        )
        .await?;

    // Returns 404 (not found in caller's project context) rather than 403
    // This is more secure as it doesn't leak existence of accounts in other projects
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_get_account_success(pool: PgPool) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    // Insert account
    let account_id = Uuid::new_v4();
    sqlx::query!(
        r#"
        INSERT INTO connect_account (
            id,
            "projectId",
            country,
            currency,
            "isPayoutsEnabled",
            processor,
            "processorAccountId",
            status,
            "detailsSubmitted",
            "chargesEnabled",
            "businessType",
            data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        "#,
        account_id,
        project_id,
        "US",
        "usd",
        true,
        "stripe",
        Some("acct_test_123"),
        "pending",
        true,
        true,
        Some("company"),
        json!({})
    )
    .execute(&pool)
    .await?;

    // Get account
    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/accounts/{}", account_id))
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    let body = read_body(response.into_body()).await;
    assert_eq!(body["id"].as_str().unwrap(), account_id.to_string());
    assert_eq!(body["processor"].as_str().unwrap(), "stripe");
    assert_eq!(
        body["processor_account_id"].as_str().unwrap(),
        "acct_test_123"
    );
    assert_eq!(body["status"].as_str().unwrap(), "pending");
    assert_eq!(body["country"].as_str().unwrap(), "US");
    assert_eq!(body["currency"].as_str().unwrap(), "usd");
    assert_eq!(body["business_type"].as_str().unwrap(), "company");
    assert!(body["details_submitted"].as_bool().unwrap());
    assert!(body["charges_enabled"].as_bool().unwrap());
    Ok(())
}

// ==================== GET /accounts/connect/callback ====================

#[sqlx::test(migrations = "./migrations")]
async fn test_callback_account_not_found(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);
    let account_id = Uuid::new_v4();
    let state = "test_state_123";

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/accounts/connect/callback?account_id={}&state={}",
                    account_id, state
                ))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Account not found");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_callback_success(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool.clone()).await);

    // Seed organization first to avoid foreign key constraint violation
    let (_org_id, project_id, _) = seed_organization(&pool).await;

    // Insert account with connect_state
    let account_id = Uuid::new_v4();
    let connect_state = "test_state_123";
    sqlx::query!(
        r#"
        INSERT INTO connect_account (
            id,
            "projectId",
            country,
            currency,
            "isPayoutsEnabled",
            processor,
            "processorAccountId",
            status,
            "detailsSubmitted",
            "chargesEnabled",
            "businessType",
            data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        "#,
        account_id,
        project_id,
        "US",
        "usd",
        false,
        "stripe",
        "acct_test_123",
        "pending",
        false,
        false,
        None::<String>,
        json!({ "connect_state": connect_state })
    )
    .execute(&pool)
    .await?;

    // Call callback
    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!(
                    "/accounts/connect/callback?account_id={}&state={}",
                    account_id, connect_state
                ))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    let body = read_body(response.into_body()).await;
    assert_eq!(body["account_id"].as_str().unwrap(), account_id.to_string());
    assert_eq!(body["status"].as_str().unwrap(), "success");
    assert_eq!(
        body["message"].as_str().unwrap(),
        "Account callback received"
    );

    // Verify status was updated
    let account = sqlx::query!(
        r#"SELECT status FROM connect_account WHERE id = $1"#,
        account_id
    )
    .fetch_one(&pool)
    .await?;
    assert_eq!(account.status, "onboarding_returned");

    Ok(())
}

// ==================== POST /accounts/connect (create_connect_account) ====================

#[sqlx::test(migrations = "./migrations")]
async fn test_create_connect_account_requires_auth(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);

    let body = json!({
        "processor": "stripe",
        "country": "US",
        "email": "test@example.com"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/accounts/connect")
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body_text = read_body_text(response.into_body()).await;
    assert_eq!(body_text, "Missing API key");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_connect_account_success(pool: PgPool) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool.clone()).await);

    let body = json!({
        "processor": "stripe",
        "country": "US",
        "email": "test@example.com",
        "business_type": "company"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/accounts/connect")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);
    let body = read_body(response.into_body()).await;

    assert!(body.get("account_id").is_some());
    let account_id = body["account_id"].as_str().unwrap();
    assert!(Uuid::parse_str(account_id).is_ok());

    assert!(body.get("oauth_url").is_some());
    let oauth_url = body["oauth_url"].as_str().unwrap();
    assert!(oauth_url.contains("oauth"));

    // Verify account was created in database with pending status
    let account = sqlx::query!(
        r#"SELECT "projectId", country, currency, processor, "processorAccountId", status, "businessType" FROM connect_account WHERE id = $1"#,
        Uuid::parse_str(account_id).unwrap()
    )
    .fetch_one(&pool)
    .await?;

    assert_eq!(account.projectId, project_id);
    assert_eq!(account.country, "US");
    assert_eq!(account.processor, "stripe");
    assert_eq!(account.status, "pending");
    assert!(account.processorAccountId.is_none()); // Initially NULL for OAuth flow

    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_connect_account_missing_country(pool: PgPool) -> TestResult {
    let (_org_id, _project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let body = json!({
        "processor": "stripe",
        "email": "test@example.com"
        // Note: no country field
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/accounts/connect")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body_text = read_body_text(response.into_body()).await;
    assert_eq!(body_text, "country is required");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_create_connect_account_real_stripe(pool: PgPool) -> TestResult {
    // Skip this test if STRIPE_SECRET_KEY is not set
    if std::env::var("STRIPE_SECRET_KEY").is_err() {
        eprintln!("Skipping test_create_connect_account_real_stripe: STRIPE_SECRET_KEY not set");
        return Ok(());
    }

    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state_real_stripe(pool.clone()).await);

    let body = json!({
        "processor": "stripe",
        "country": "US",
        "email": "test@example.com"
    });

    let response = app
        .call(
            Request::builder()
                .method("POST")
                .uri("/accounts/connect")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .body(Body::from(body.to_string()))?,
        )
        .await?;

    let status = response.status();
    if status != StatusCode::OK {
        let error_text = read_body_text(response.into_body()).await;
        panic!("Request failed with status {}: {}", status, error_text);
    }
    let body = read_body(response.into_body()).await;

    // Verify response contains expected fields
    assert!(body.get("account_id").is_some());
    let account_id = body["account_id"].as_str().unwrap();
    assert!(Uuid::parse_str(account_id).is_ok());

    assert!(body.get("oauth_url").is_some());
    let oauth_url = body["oauth_url"].as_str().unwrap();
    assert!(
        oauth_url.contains("oauth") || oauth_url.contains("connect"),
        "oauth_url should contain 'oauth' or 'connect', got: {}",
        oauth_url
    );

    // Verify account was created in database with pending status and NULL processorAccountId
    let account = sqlx::query!(
        r#"
        SELECT
            id,
            "projectId",
            country,
            currency,
            processor,
            "processorAccountId",
            status,
            "businessType"
        FROM connect_account
        WHERE id = $1
        "#,
        Uuid::parse_str(account_id).unwrap()
    )
    .fetch_one(&pool)
    .await?;

    assert_eq!(account.projectId, project_id);
    assert_eq!(account.country, "US");
    assert_eq!(account.currency, "usd");
    assert_eq!(account.processor, "stripe");
    assert_eq!(account.status, "pending");
    assert!(account.processorAccountId.is_none()); // Initially NULL for OAuth flow
    // business_type is optional - Stripe may not return it if not specified in the request

    Ok(())
}
