#![allow(dead_code)]

use async_trait::async_trait;
use axum::{Router, body::Body, http::Request};
use base64::{
    Engine,
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
};
use hmac::{Hmac, Mac};
use http_body_util::BodyExt;
use rand::Rng;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use std::sync::Arc;
use surpay::AppState;
use surpay::core::config::Config;
use surpay::integrations::{
    ConnectProcessor, PaymentProcessor, ProcessorRegistry, StripeProcessor,
    types::{
        AccountDetails, AccountLink, CreateCheckoutSessionRequest, NormalizedEvent,
        PaymentIntentRequest, PayoutRequest, ProcessorCheckout, ProcessorPayment, ProcessorPayout,
        ProcessorPrice, ProcessorPriceRequest, ProcessorProduct, ProcessorProductRequest,
        ProcessorTransfer, TransferRequest,
    },
};
use tower::Service;
use uuid::Uuid;

/// Seeds a user and returns the user ID
pub async fn seed_user(pool: &PgPool) -> Uuid {
    let user_id = Uuid::new_v4();
    let name = "Test User";
    let email = format!("test-{}@example.com", &user_id.to_string()[..8]);

    sqlx::query!(
        r#"
        INSERT INTO "user" (
            id,
            name,
            email,
            "emailVerified",
            "createdAt",
            "updatedAt"
        )
        VALUES ($1, $2, $3, true, now(), now())
        "#,
        user_id,
        name,
        email
    )
    .execute(pool)
    .await
    .expect("Failed to seed user");

    user_id
}

/// Seeds an API key (master key) and returns the full test API key string
/// Mock ConnectProcessor for testing account endpoints without real Stripe API calls
#[derive(Clone)]
pub struct MockConnectProcessor;

impl MockConnectProcessor {
    pub fn new() -> Self {
        Self
    }
}

impl Default for MockConnectProcessor {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl PaymentProcessor for MockConnectProcessor {
    fn name(&self) -> &str {
        "stripe"
    }

    async fn create_product(
        &self,
        _req: ProcessorProductRequest,
    ) -> Result<ProcessorProduct, String> {
        Ok(ProcessorProduct {
            id: "prod_test_123".to_string(),
            name: _req.name,
            description: _req.description,
            active: _req.active,
        })
    }

    async fn create_price(&self, _req: ProcessorPriceRequest) -> Result<ProcessorPrice, String> {
        Ok(ProcessorPrice {
            id: "price_test_123".to_string(),
            product: _req.product,
            currency: _req.currency,
            unit_amount: _req.unit_amount as i64,
            active: true,
        })
    }

    async fn create_checkout_session(
        &self,
        _req: CreateCheckoutSessionRequest,
    ) -> Result<ProcessorCheckout, String> {
        Ok(ProcessorCheckout {
            id: "cs_test_123".to_string(),
            url: Some("https://test.stripe.com/checkout".to_string()),
            status: "open".to_string(),
            customer: _req.customer,
        })
    }

    fn verify_webhook(&self, _payload: &[u8], _signature: &str) -> Result<bool, String> {
        Ok(true)
    }

    fn parse_webhook_event(&self, _payload: &Value) -> Result<NormalizedEvent, String> {
        Ok(NormalizedEvent::Unknown {
            event_type: "test_event".to_string(),
        })
    }
}

#[async_trait]
impl ConnectProcessor for MockConnectProcessor {
    async fn create_account_link(
        &self,
        _account_id: &str,
        _refresh_url: &str,
        _return_url: &str,
    ) -> Result<AccountLink, String> {
        Ok(AccountLink {
            id: Some("link_test_123".to_string()),
            url: "https://test.stripe.com/onboarding".to_string(),
            created_at: 1234567890,
            expires_at: 1234567890 + 3600,
        })
    }

    async fn create_payment_intent(
        &self,
        _req: PaymentIntentRequest,
    ) -> Result<ProcessorPayment, String> {
        Ok(ProcessorPayment {
            id: "pi_test_123".to_string(),
            amount: _req.amount,
            currency: _req.currency,
            status: "requires_payment_method".to_string(),
            customer: _req.customer,
        })
    }

    async fn create_transfer(&self, _req: TransferRequest) -> Result<ProcessorTransfer, String> {
        Ok(ProcessorTransfer {
            id: "tr_test_123".to_string(),
            amount: _req.amount,
            currency: _req.currency,
            destination: _req.destination,
            status: "pending".to_string(),
        })
    }

    async fn create_payout(
        &self,
        _account_id: &str,
        _req: PayoutRequest,
    ) -> Result<ProcessorPayout, String> {
        Ok(ProcessorPayout {
            id: "po_test_123".to_string(),
            amount: _req.amount,
            currency: _req.currency,
            status: "pending".to_string(),
            arrival_date: None,
        })
    }

    fn generate_oauth_url(&self, _state: &str, _redirect_uri: &str) -> String {
        "https://connect.stripe.com/oauth/authorize".to_string()
    }

    async fn exchange_oauth_code(
        &self,
        _code: &str,
    ) -> Result<surpay::integrations::traits::OAuthTokenResponse, String> {
        Ok(surpay::integrations::traits::OAuthTokenResponse {
            processor_account_id: "acct_test_123".to_string(),
            scope: "read_write".to_string(),
            livemode: false,
        })
    }

    async fn get_account(&self, _account_id: &str) -> Result<AccountDetails, String> {
        Ok(AccountDetails {
            details_submitted: true,
            charges_enabled: true,
            payouts_enabled: true,
        })
    }
}

fn hash_api_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

/// Generates a 64-character alphabetic API key (a-z, A-Z)
fn generate_api_key() -> String {
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let mut rng = rand::rng();
    (0..64)
        .map(|_| CHARSET[rng.random_range(0..CHARSET.len())] as char)
        .collect()
}

/// Seeds an API key for a project and returns the raw API key string.
/// The key is associated with the project's organization and a new user.
pub async fn seed_api_key(pool: &PgPool, project_id: Uuid) -> String {
    let row = sqlx::query!(
        r#"SELECT "organizationId", "userId" FROM project WHERE id = $1"#,
        project_id
    )
    .fetch_one(pool)
    .await
    .expect("Project must exist");

    let api_key_id = Uuid::new_v4();
    let api_key = generate_api_key();
    let hash = hash_api_key(&api_key);
    let prefix = &api_key[..8];

    sqlx::query!(
        r#"
        INSERT INTO apikey (
            id,
            name,
            "key",
            prefix,
            "userId",
            "organizationId",
            "projectId",
            "createdAt",
            "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        "#,
        api_key_id,
        "Test API Key",
        hash,
        prefix,
        row.userId,
        row.organizationId,
        project_id
    )
    .execute(pool)
    .await
    .expect("Failed to seed API key");

    api_key
}

/// Seeds an organization with a project and returns (org_id, project_id, session_cookie)
/// The session_cookie can be used for authenticated requests via Cookie header.
pub async fn seed_organization(pool: &PgPool) -> (Uuid, Uuid, String) {
    let org_id = Uuid::new_v4();
    let project_id = Uuid::new_v4();
    let user_id = seed_user(pool).await;
    let name = "Test Organization";
    let slug = format!("test-org-{}", &org_id.to_string()[..8]);
    let project_slug = format!("test-project-{}", &project_id.to_string()[..8]);

    sqlx::query!(
        r#"
        INSERT INTO organization (
            id,
            name,
            slug
        )
        VALUES ($1, $2, $3)
        "#,
        org_id,
        name,
        slug
    )
    .execute(pool)
    .await
    .expect("Failed to seed organization");

    sqlx::query!(
        r#"
        INSERT INTO member (
            "userId",
            "organizationId",
            role
        )
        VALUES ($1, $2, 'owner')
        "#,
        user_id,
        org_id
    )
    .execute(pool)
    .await
    .expect("Failed to seed member");

    sqlx::query!(
        r#"
        INSERT INTO project (
            id,
            name,
            slug,
            "organizationId",
            "userId"
        )
        VALUES ($1, $2, $3, $4, $5)
        "#,
        project_id,
        "Test Project",
        project_slug,
        org_id,
        user_id
    )
    .execute(pool)
    .await
    .expect("Failed to seed project");

    // Create session for the user
    let session_id = Uuid::new_v4();
    let token = Uuid::new_v4().to_string();

    sqlx::query!(
        r#"
        INSERT INTO session (id, "userId", token, "expiresAt", "activeOrganizationId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, NOW() + INTERVAL '1 day', $4, NOW(), NOW())
        "#,
        session_id,
        user_id,
        token,
        org_id
    )
    .execute(pool)
    .await
    .expect("Failed to seed session");

    let signature = sign_session_token(&token, "test-secret");
    let session_cookie = format!("{}.{}", token, signature);

    (org_id, project_id, session_cookie)
}

/// Seeds a project for an existing organization and returns the project ID
pub async fn seed_project(pool: &PgPool, org_id: Uuid, user_id: Uuid) -> Uuid {
    let project_id = Uuid::new_v4();
    let slug = format!("test-project-{}", &project_id.to_string()[..8]);

    sqlx::query!(
        r#"INSERT INTO project (id, name, slug, "organizationId", "userId") VALUES ($1, $2, $3, $4, $5)"#,
        project_id,
        "Test Project",
        slug,
        org_id,
        user_id
    )
    .execute(pool)
    .await
    .expect("Failed to seed project");

    project_id
}

/// Seeds a customer and returns the customer ID
pub async fn seed_customer(
    pool: &PgPool,
    project_id: Uuid,
    email: &str,
    name: Option<&str>,
) -> Uuid {
    let customer_id = Uuid::new_v4();
    let external_id = format!("test-{}", &customer_id.to_string()[..8]);

    sqlx::query!(
        r#"
        INSERT INTO customer (id, "projectId", "externalId", email, name)
        VALUES ($1, $2, $3, $4, $5)
        "#,
        customer_id,
        project_id,
        external_id,
        email,
        name
    )
    .execute(pool)
    .await
    .expect("Failed to seed customer");

    customer_id
}

type HmacSha256 = Hmac<Sha256>;

/// Signs a session token using HMAC-SHA256 with base64 STANDARD encoding
pub fn sign_session_token(token: &str, secret: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(token.as_bytes());
    STANDARD.encode(mac.finalize().into_bytes())
}

/// Seeds a session for testing authenticated handlers.
/// Creates a user, adds them as a member of the org, and creates a session.
/// Returns (user_id, cookie_value) where cookie_value is "token.signature"
pub async fn seed_session(pool: &PgPool, org_id: Uuid) -> (Uuid, String) {
    let user_id = seed_user(pool).await;
    let session_id = Uuid::new_v4();
    let token = Uuid::new_v4().to_string();

    // Add user as member of org
    sqlx::query!(
        r#"
        INSERT INTO member ("userId", "organizationId", role)
        VALUES ($1, $2, 'member')
        "#,
        user_id,
        org_id
    )
    .execute(pool)
    .await
    .expect("Failed to seed member");

    // Create session with future expiry
    sqlx::query!(
        r#"
        INSERT INTO session (id, "userId", token, "expiresAt", "activeOrganizationId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, NOW() + INTERVAL '1 day', $4, NOW(), NOW())
        "#,
        session_id,
        user_id,
        token,
        org_id
    )
    .execute(pool)
    .await
    .expect("Failed to seed session");

    let signature = sign_session_token(&token, "test-secret");
    let cookie_value = format!("{}.{}", token, signature);

    (user_id, cookie_value)
}

pub async fn read_body(body: Body) -> Value {
    let bytes = body.collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap_or(json!({}))
}

pub async fn read_body_text(body: Body) -> String {
    let bytes = body.collect().await.unwrap().to_bytes();
    String::from_utf8_lossy(&bytes).to_string()
}

/// Creates an AppState for testing with minimal configuration
/// Loads Stripe keys from environment variables
pub async fn create_test_state(pool: PgPool) -> AppState {
    let registry = Arc::new(ProcessorRegistry::new());
    let config = Config {
        database_url: "test://db".to_string(),
        database_max_connections: 5,
        database_min_connections: 1,
        service_host: "localhost".to_string(),
        service_port: "3000".to_string(),
        stripe_secret_key: std::env::var("STRIPE_SECRET_KEY")
            .expect("STRIPE_SECRET_KEY must be set to run tests"),
        stripe_client_id: std::env::var("STRIPE_CLIENT_ID")
            .unwrap_or_else(|_| "ca_test_client_id".to_string()),
        stripe_webhook_secret: std::env::var("STRIPE_WEBHOOK_SECRET")
            .unwrap_or_else(|_| "whsec_test_secret".to_string()),
        surpay_base_url: "http://localhost:3000".to_string(),
        cargo_crate_name: "surpay".to_string(),
        sqs_endpoint_url: std::env::var("SQS_ENDPOINT_URL").ok(),
        sqs_webhooks_queue_url: std::env::var("SQS_WEBHOOKS_QUEUE_URL")
            .unwrap_or_else(|_| "http://localhost:9324/queue/webhooks".to_string()),
        sqs_webhooks_dlq_url: std::env::var("SQS_WEBHOOKS_DLQ_URL")
            .unwrap_or_else(|_| "http://localhost:9324/queue/webhooks_dlq".to_string()),
        better_auth_secret: "test-secret".to_string(),
        trusted_origins: "http://localhost:3000".to_string(),
        web_base_url: "http://localhost:3000".to_string(),
    };

    // Register Stripe processor
    let stripe_processor = StripeProcessor::new(
        config.stripe_secret_key.clone(),
        config.stripe_webhook_secret.clone(),
        config.stripe_client_id.clone(),
    );

    registry
        .register(Arc::new(stripe_processor))
        .await
        .expect("Failed to register Stripe processor");

    // Register Mock Connect processor for testing account endpoints
    let mock_connect = MockConnectProcessor::new();
    registry
        .register_connect(Arc::new(mock_connect))
        .await
        .expect("Failed to register Mock Connect processor");

    let sqs_client = surpay::core::sqs::create_client(config.sqs_endpoint_url.as_deref()).await;

    AppState {
        pool,
        registry,
        config,
        sqs_client,
    }
}

/// Creates an AppState for testing with real Stripe processor for BOTH payment and connect
/// Loads Stripe keys from environment variables and registers the SAME StripeProcessor instance
/// for both PaymentProcessor and ConnectProcessor (no mocking)
pub async fn create_test_state_real_stripe(pool: PgPool) -> AppState {
    let registry = Arc::new(ProcessorRegistry::new());
    let config = Config {
        database_url: "test://db".to_string(),
        database_max_connections: 5,
        database_min_connections: 1,
        service_host: "localhost".to_string(),
        service_port: "3000".to_string(),
        stripe_secret_key: std::env::var("STRIPE_SECRET_KEY")
            .expect("STRIPE_SECRET_KEY must be set to run tests"),
        stripe_client_id: std::env::var("STRIPE_CLIENT_ID")
            .unwrap_or_else(|_| "ca_test_client_id".to_string()),
        stripe_webhook_secret: std::env::var("STRIPE_WEBHOOK_SECRET")
            .unwrap_or_else(|_| "whsec_test_secret".to_string()),
        surpay_base_url: "http://localhost:3000".to_string(),
        cargo_crate_name: "surpay".to_string(),
        sqs_endpoint_url: std::env::var("SQS_ENDPOINT_URL").ok(),
        sqs_webhooks_queue_url: std::env::var("SQS_WEBHOOKS_QUEUE_URL")
            .unwrap_or_else(|_| "http://localhost:9324/queue/webhooks".to_string()),
        sqs_webhooks_dlq_url: std::env::var("SQS_WEBHOOKS_DLQ_URL")
            .unwrap_or_else(|_| "http://localhost:9324/queue/webhooks_dlq".to_string()),
        better_auth_secret: "test-secret".to_string(),
        trusted_origins: "http://localhost:3000".to_string(),
        web_base_url: "http://localhost:3000".to_string(),
    };

    // Register Stripe processor as BOTH PaymentProcessor AND ConnectProcessor
    let stripe_processor = StripeProcessor::new(
        config.stripe_secret_key.clone(),
        config.stripe_webhook_secret.clone(),
        config.stripe_client_id.clone(),
    );

    registry
        .register(Arc::new(stripe_processor.clone()))
        .await
        .expect("Failed to register Stripe processor");
    registry
        .register_connect(Arc::new(stripe_processor))
        .await
        .expect("Failed to register Stripe connect processor");

    let sqs_client = surpay::core::sqs::create_client(config.sqs_endpoint_url.as_deref()).await;

    AppState {
        pool,
        registry,
        config,
        sqs_client,
    }
}

pub struct ProductPriceDetails<'a> {
    pub product_group_id: Uuid,
    pub name: &'a str,
    pub price: i32,
    pub currency: &'a str,
    pub recurring_interval: Option<&'a str>,
}

/// Result of creating a product, containing both UUID and slug
pub struct CreatedProduct {
    pub id: Uuid,
    pub slug: String,
    pub product_group_id: Uuid,
}

pub trait TestAppExt {
    fn create_project(
        &mut self,
        session_cookie: &str,
    ) -> impl std::future::Future<Output = Uuid> + Send;

    fn create_product(
        &mut self,
        api_key: &str,
    ) -> impl std::future::Future<Output = CreatedProduct> + Send;

    fn create_product_with_group(
        &mut self,
        api_key: &str,
        product_group_id: Uuid,
    ) -> impl std::future::Future<Output = (Uuid, String)> + Send;

    fn create_product_price(
        &mut self,
        api_key: &str,
        product_group_id: Uuid,
    ) -> impl std::future::Future<Output = Uuid> + Send;

    fn create_product_price_with_details(
        &mut self,
        api_key: &str,
        details: ProductPriceDetails<'_>,
    ) -> impl std::future::Future<Output = Uuid> + Send;
}

impl TestAppExt for Router {
    async fn create_project(&mut self, session_cookie: &str) -> Uuid {
        let slug = format!("test-project-{}", &Uuid::new_v4().to_string()[..8]);
        let response = self
            .call(
                Request::builder()
                    .method("POST")
                    .uri("/project")
                    .header(
                        "Cookie",
                        format!("better-auth.session_token={}", session_cookie),
                    )
                    .header("Content-Type", "application/json")
                    .body(Body::from(
                        json!({
                            "name": "Test Project",
                            "slug": slug
                        })
                        .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();

        let body = read_body(response.into_body()).await;
        Uuid::parse_str(body["id"].as_str().unwrap()).unwrap()
    }

    async fn create_product(&mut self, api_key: &str) -> CreatedProduct {
        let product_group_id = Uuid::new_v4();
        let slug = format!("test-product-{}", &Uuid::new_v4().to_string()[..8]);
        let response = self
            .call(
                Request::builder()
                    .method("POST")
                    .uri("/product")
                    .header("Authorization", format!("Bearer {}", api_key))
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
        let id = Uuid::parse_str(body["product_id"].as_str().unwrap()).unwrap();
        CreatedProduct {
            id,
            slug,
            product_group_id,
        }
    }

    async fn create_product_with_group(
        &mut self,
        api_key: &str,
        product_group_id: Uuid,
    ) -> (Uuid, String) {
        let slug = format!("test-product-{}", &Uuid::new_v4().to_string()[..8]);
        let response = self
            .call(
                Request::builder()
                    .method("POST")
                    .uri("/product")
                    .header("Authorization", format!("Bearer {}", api_key))
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
        let id = Uuid::parse_str(body["product_id"].as_str().unwrap()).unwrap();
        (id, slug)
    }

    async fn create_product_price(&mut self, api_key: &str, product_group_id: Uuid) -> Uuid {
        self.create_product_price_with_details(
            api_key,
            ProductPriceDetails {
                product_group_id,
                name: "Test Price",
                price: 1000,
                currency: "USD",
                recurring_interval: None,
            },
        )
        .await
    }

    async fn create_product_price_with_details(
        &mut self,
        api_key: &str,
        details: ProductPriceDetails<'_>,
    ) -> Uuid {
        let mut payload = json!({
            "product_group_id": details.product_group_id,
            "name": details.name,
            "price": details.price,
            "price_currency": details.currency
        });

        if let Some(interval) = details.recurring_interval {
            payload["recurring_interval"] = json!(interval);
        }

        let response = self
            .call(
                Request::builder()
                    .method("POST")
                    .uri("/product/price")
                    .header("Authorization", format!("Bearer {}", api_key))
                    .header("Content-Type", "application/json")
                    .body(Body::from(payload.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();

        let body = read_body(response.into_body()).await;
        Uuid::parse_str(body["product_price_id"].as_str().unwrap()).unwrap()
    }
}
