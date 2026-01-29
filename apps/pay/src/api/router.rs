use axum::{
    Router,
    http::{Method, StatusCode, header},
    response::IntoResponse,
    routing::{get, post, put},
};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::AppState;
use crate::api::account::{
    connect_callback, connect_refresh, create_connect_account, disconnect, get_account,
    list_accounts, oauth_callback, update_account,
};
use crate::api::check::check;
use crate::api::checkout::{checkout_cancel, checkout_success, create_checkout_session};
use crate::api::customer::{get_customer, list_customers};
use crate::api::openapi::ApiDoc;
use crate::api::products::price::create_product_price;
use crate::api::products::{create_product, list_products_with_prices, update_product};
use crate::api::project::list_projects;
use crate::api::subscription::list_subscriptions;
use crate::api::transaction::list_transactions;
use crate::api::webhook::webhook_handler;

pub fn create_router(state: AppState) -> Router {
    let project_routes = Router::new().route("/{project_id}/transactions", get(list_transactions));
    let customer_routes = Router::new()
        .route("/", get(list_customers))
        .route("/{id}", get(get_customer));
    let product_routes = Router::new()
        .route("/", post(create_product))
        .route("/{id}", put(update_product))
        .route("/price", post(create_product_price));
    let checkout_routes = Router::new()
        .route("/", post(create_checkout_session))
        .route("/success/{session_id}", get(checkout_success))
        .route("/cancel/{session_id}", get(checkout_cancel));

    let webhook_routes = Router::new().route("/{processor}", post(webhook_handler));
    let account_routes = Router::new()
        .route("/connect", post(create_connect_account))
        .route("/connect/callback", get(connect_callback))
        .route("/connect/refresh", get(connect_refresh))
        .route("/connect/oauth/callback", get(oauth_callback))
        .route(
            "/{id}",
            get(get_account).patch(update_account).delete(disconnect),
        )
        .route("/", get(list_accounts));

    let origins: Vec<_> = state
        .config
        .trusted_origins
        .split(',')
        .map(|s| s.trim().parse().expect("Invalid origin in TRUSTED_ORIGINS"))
        .collect();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([header::CONTENT_TYPE, header::COOKIE])
        .allow_credentials(true);

    Router::new()
        .route("/health", get(health_check))
        .route("/projects", get(list_projects))
        .route("/products", get(list_products_with_prices))
        .route("/subscriptions", get(list_subscriptions))
        .route("/check", post(check))
        .nest("/webhooks", webhook_routes)
        .nest("/project", project_routes)
        .nest("/customers", customer_routes)
        .nest("/product", product_routes)
        .nest("/checkout", checkout_routes)
        .nest("/accounts", account_routes)
        .merge(SwaggerUi::new("/docs").url("/api-doc/openapi.json", ApiDoc::openapi()))
        .fallback(fallback)
        .layer(cors)
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(|req: &axum::http::Request<_>| {
                    tracing::info_span!(
                        "request",
                        method = %req.method(),
                        uri = %req.uri(),
                    )
                })
                .on_response(
                    |response: &axum::http::Response<_>,
                     latency: std::time::Duration,
                     _span: &tracing::Span| {
                        tracing::info!(
                            "request completed: status = {status}, latency = {latency:?}",
                            status = response.status(),
                        );
                    },
                ),
        )
        .with_state(state)
}

async fn health_check() -> &'static str {
    "OK\n"
}

pub async fn fallback() -> impl IntoResponse {
    (StatusCode::NOT_FOUND, "Not Found")
}
