#![allow(dead_code)]

use argon2::{
    Argon2, PasswordHasher,
    password_hash::{SaltString, rand_core::OsRng},
};
use async_trait::async_trait;
use axum::{Router, body::Body, http::Request};
use http_body_util::BodyExt;
use serde_json::{Value, json};
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

pub async fn seed_api_key(pool: &PgPool) -> String {
    let api_key_id = Uuid::new_v4();
    let name = "Test Master Key";
    let slug = format!("test-master-key-{}", &api_key_id.to_string()[..8]);

    let prefix = "testliv1";
    let secret = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    let argon2 = Argon2::default();

    let salt = SaltString::generate(&mut OsRng);
    let hash = argon2
        .hash_password(secret.as_bytes(), &salt)
        .expect("Failed to hash secret")
        .to_string();

    sqlx::query!(
        r#"
        INSERT INTO api_key (
            id,
            name,
            slug,
            api_key,
            api_key_prefix
        )
        VALUES ($1, $2, $3, $4, $5)
        "#,
        api_key_id,
        name,
        slug,
        hash,
        prefix
    )
    .execute(pool)
    .await
    .expect("Failed to seed API key");

    format!("sp_master_{}_{}", prefix, secret)
}

/// Seeds an organization and returns (org_id, api_key)
pub async fn seed_organization(pool: &PgPool) -> (Uuid, String) {
    let org_id = Uuid::new_v4();
    let name = "Test Organization";
    let slug = format!("test-org-{}", &org_id.to_string()[..8]);

    let prefix = format!("lv{}", &Uuid::new_v4().to_string()[..6]);
    let secret = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    let argon2 = Argon2::default();

    let salt = SaltString::generate(&mut OsRng);
    let hash = argon2
        .hash_password(secret.as_bytes(), &salt)
        .expect("Failed to hash secret")
        .to_string();

    sqlx::query!(
        r#"
        INSERT INTO organization (
            id,
            name,
            slug,
            api_key,
            api_key_prefix
        )
        VALUES ($1, $2, $3, $4, $5)
        "#,
        org_id,
        name,
        slug,
        hash,
        prefix
    )
    .execute(pool)
    .await
    .expect("Failed to seed organization");

    let api_key = format!("sp_org_{}_{}", prefix, secret);
    (org_id, api_key)
}

/// Seeds a customer and returns the customer ID
pub async fn seed_customer(
    pool: &PgPool,
    project_id: Uuid,
    email: &str,
    name: Option<&str>,
) -> Uuid {
    let customer_id = Uuid::new_v4();

    sqlx::query!(
        r#"
        INSERT INTO customer (id, project_id, email, name)
        VALUES ($1, $2, $3, $4)
        "#,
        customer_id,
        project_id,
        email,
        name
    )
    .execute(pool)
    .await
    .expect("Failed to seed customer");

    customer_id
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
    pub project_id: Uuid,
    pub product_group_id: Uuid,
    pub name: &'a str,
    pub price: i32,
    pub currency: &'a str,
    pub recurring_interval: Option<&'a str>,
}

pub trait TestAppExt {
    fn create_project(&mut self, api_key: &str) -> impl std::future::Future<Output = Uuid> + Send;

    fn create_product(
        &mut self,
        api_key: &str,
        project_id: Uuid,
    ) -> impl std::future::Future<Output = (Uuid, Uuid)> + Send;

    fn create_product_with_group(
        &mut self,
        api_key: &str,
        project_id: Uuid,
        product_group_id: Uuid,
    ) -> impl std::future::Future<Output = Uuid> + Send;

    fn create_product_price(
        &mut self,
        api_key: &str,
        project_id: Uuid,
        product_group_id: Uuid,
    ) -> impl std::future::Future<Output = Uuid> + Send;

    fn create_product_price_with_details(
        &mut self,
        api_key: &str,
        details: ProductPriceDetails<'_>,
    ) -> impl std::future::Future<Output = Uuid> + Send;
}

impl TestAppExt for Router {
    async fn create_project(&mut self, api_key: &str) -> Uuid {
        let slug = format!("test-project-{}", &Uuid::new_v4().to_string()[..8]);
        let response = self
            .call(
                Request::builder()
                    .method("POST")
                    .uri("/project")
                    .header("Authorization", format!("Bearer {}", api_key))
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

    async fn create_product(&mut self, api_key: &str, project_id: Uuid) -> (Uuid, Uuid) {
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
                            "project_id": project_id,
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

    async fn create_product_with_group(
        &mut self,
        api_key: &str,
        project_id: Uuid,
        product_group_id: Uuid,
    ) -> Uuid {
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
                            "project_id": project_id,
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

    async fn create_product_price(
        &mut self,
        api_key: &str,
        project_id: Uuid,
        product_group_id: Uuid,
    ) -> Uuid {
        self.create_product_price_with_details(
            api_key,
            ProductPriceDetails {
                project_id,
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
            "project_id": details.project_id,
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
