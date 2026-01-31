use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub database_max_connections: u32,
    pub database_min_connections: u32,

    pub service_host: String,
    pub service_port: String,

    pub stripe_secret_key: String,
    pub stripe_client_id: String,

    pub stripe_webhook_secret: String,

    pub surpay_base_url: String,

    pub sqs_endpoint_url: Option<String>,
    pub sqs_webhooks_queue_url: String,
    pub sqs_webhooks_dlq_url: String,

    pub better_auth_secret: String,

    pub cargo_crate_name: String,

    pub trusted_origins: String,

    pub web_base_url: String,

    pub whop_api_key: Option<String>,
    pub whop_platform_company_id: Option<String>,
}

impl Config {
    pub fn from_env() -> Result<Self, env::VarError> {
        dotenvy::dotenv().ok();

        Ok(Self {
            database_url: env::var("DATABASE_URL").expect("Expect DATABASE_URL in environment."),

            database_max_connections: env::var("DATABASE_MAX_CONNECTIONS")
                .map(|s| s.parse::<u32>().unwrap_or(5))
                .unwrap_or(5),
            database_min_connections: env::var("DATABASE_MIN_CONNECTIONS")
                .map(|s| s.parse::<u32>().unwrap_or(1))
                .unwrap_or(1),

            service_host: env::var("SERVICE_HOST").expect("Expect SERVICE_HOST in env."),
            service_port: env::var("SERVICE_PORT").expect("Expect SERVICE_PORT in env."),

            stripe_secret_key: env::var("STRIPE_SECRET_KEY")
                .expect("STRIPE_SECRET_KEY must be set"),
            stripe_client_id: env::var("STRIPE_CLIENT_ID").expect("STRIPE_CLIENT_ID must be set"),

            stripe_webhook_secret: env::var("STRIPE_WEBHOOK_SECRET")
                .expect("STRIPE_WEBHOOK_SECRET must be set"),

            surpay_base_url: env::var("SURPAY_BASE_URL").expect("SURPAY_BASE_URL must be set"),

            sqs_endpoint_url: env::var("SQS_ENDPOINT_URL").ok(),
            sqs_webhooks_queue_url: env::var("SQS_WEBHOOKS_QUEUE_URL")
                .expect("SQS_WEBHOOKS_QUEUE_URL must be set"),
            sqs_webhooks_dlq_url: env::var("SQS_WEBHOOKS_DLQ_URL")
                .expect("SQS_WEBHOOKS_DLQ_URL must be set"),

            better_auth_secret: env::var("BETTER_AUTH_SECRET")
                .expect("BETTER_AUTH_SECRET must be set"),

            cargo_crate_name: env!("CARGO_CRATE_NAME").to_string(),

            trusted_origins: env::var("TRUSTED_ORIGINS").expect("TRUSTED_ORIGINS must be set"),

            web_base_url: env::var("WEB_BASE_URL").expect("WEB_BASE_URL must be set"),

            whop_api_key: env::var("WHOP_API_KEY").ok(),
            whop_platform_company_id: env::var("WHOP_PLATFORM_COMPANY_ID").ok(),
        })
    }
}
