use std::sync::Arc;
use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use tokio::net::TcpListener;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use surpay::{
    AppState,
    api::create_router,
    api::webhook::WebhookWorker,
    core::config::Config,
    integrations::{ProcessorRegistry, StripeProcessor},
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,tower_http=debug,axum::rejection=trace".into()),
        )
        .with(
            tracing_subscriber::fmt::layer()
                .with_file(true)
                .with_line_number(true)
                .with_target(true)
                .with_span_events(tracing_subscriber::fmt::format::FmtSpan::CLOSE),
        )
        .init();

    let pool = PgPoolOptions::new()
        .max_connections(config.database_max_connections)
        .min_connections(config.database_min_connections)
        .acquire_timeout(Duration::from_secs(3))
        .connect(&config.database_url)
        .await
        .expect("Failed to connect to database");
    sqlx::migrate!()
        .run(&pool)
        .await
        .expect("Migrations failed");

    // Spawn webhook worker
    tokio::spawn({
        let pool = pool.clone();
        let config = config.clone();
        async move {
            loop {
                let worker = WebhookWorker::new(pool.clone(), config.clone()).await;
                if let Err(e) = worker.run().await {
                    tracing::error!("Webhook worker error: {}", e);
                }
                // Restart after a delay to prevent tight loops
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
    });

    let addr = format!("{}:{}", config.service_host, config.service_port);

    // Create and configure processor registry
    let registry = Arc::new(ProcessorRegistry::new());
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

    let state = AppState {
        pool,
        config,
        registry,
    };
    let app = create_router(state);

    let listener = TcpListener::bind(addr).await.unwrap();
    tracing::debug!("server up and listening on {}", listener.local_addr()?);
    axum::serve(listener, app).await.unwrap();

    Ok(())
}
