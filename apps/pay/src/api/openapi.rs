use utoipa::openapi::security::{ApiKey, ApiKeyValue, HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::{Modify, OpenApi};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Surpay API",
        version = "1.0.0",
        description = "Payment processing and subscription management API"
    ),
    paths(
        // Project
        crate::api::project::list_projects,
        // Customer
        crate::api::customer::list_customers,
        crate::api::customer::get_customer,
        // Transaction
        crate::api::transaction::list_transactions,
        // Subscription
        crate::api::subscription::list_subscriptions,
        // Product
        crate::api::products::product::create_product,
        crate::api::products::product::update_product,
        crate::api::products::product::list_products_with_prices,
        crate::api::products::price::create_product_price,
        // Checkout
        crate::api::checkout::create_checkout_session,
        crate::api::checkout::checkout_success,
        crate::api::checkout::checkout_cancel,
        // Account
        crate::api::account::create_connect_account,
        crate::api::account::create_whop_connect,
        crate::api::account::create_whop_access_token,
        crate::api::account::create_whop_payouts_portal_link,
        crate::api::account::get_account,
        crate::api::account::list_accounts,
        crate::api::account::update_account,
        crate::api::account::disconnect,
        // Check
        crate::api::check::check,
    ),
    components(
        schemas(
            // Types from src/types.rs
            crate::types::CheckoutStatus,
            crate::types::CheckoutMode,
            crate::types::SubscriptionStatus,
            crate::types::PayoutStatus,
            crate::types::RecurringInterval,
            crate::types::TransactionType,
            // Project DTOs
            crate::api::project::Project,
            crate::api::project::ListProjectsResponse,
            // Customer DTOs
            crate::api::customer::Customer,
            crate::api::customer::CustomerWithDetails,
            crate::api::customer::TransactionSummary,
            crate::api::customer::SubscriptionSummary,
            // Transaction DTOs
            crate::api::transaction::Transaction,
            // Subscription DTOs
            crate::api::subscription::Subscription,
            // Product DTOs
            crate::api::products::product::Product,
            crate::api::products::product::CreateProductRequest,
            crate::api::products::product::CreateProductResponse,
            crate::api::products::product::UpdateProductRequest,
            crate::api::products::product::UpdateProductResponse,
            crate::api::products::product::ProductPriceResponse,
            crate::api::products::product::ProductWithPricesResponse,
            crate::api::products::price::CreateProductPriceRequest,
            crate::api::products::price::CreateProductPriceResponse,
            // Checkout DTOs
            crate::api::checkout::CreateCheckoutRequest,
            crate::api::checkout::CreateCheckoutResponse,
            // Account DTOs
            crate::api::account::ConnectAccountRequest,
            crate::api::account::ConnectAccountResponse,
            crate::api::account::OAuthInitResponse,
            crate::api::account::OAuthCallbackResponse,
            crate::api::account::ConnectedAccountResponse,
            crate::api::account::WhopConnectRequest,
            crate::api::account::WhopConnectResponse,
            crate::api::account::WhopAccessTokenResponse,
            crate::api::account::WhopPayoutsPortalLinkResponse,
            crate::api::account::UpdateAccountRequest,
            // Check DTOs
            crate::api::check::CheckRequest,
            crate::api::check::CheckResponse,
        )
    ),
    tags(
        (name = "project", description = "Project listing (read-only). Projects and API keys are created via apps/worker."),
        (name = "customer", description = "Customer management"),
        (name = "transaction", description = "Transaction history"),
        (name = "subscription", description = "Subscription management"),
        (name = "product", description = "Product and pricing management"),
        (name = "checkout", description = "Checkout session management"),
        (name = "account", description = "Payment processor account management"),
        (name = "check", description = "Product access verification"),
    ),
    modifiers(&SecurityAddon)
)]
pub struct ApiDoc;

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi.components.get_or_insert_with(Default::default);

        // Project-scoped API key (for merchant operations)
        // Keys are provisioned by apps/worker during project creation.
        components.add_security_scheme(
            "project_key",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("64-char alphabetic key")
                    .description(Some("Project-scoped API key for merchant operations. Keys are provisioned during project creation and grant access to a specific project's resources."))
                    .build(),
            ),
        );

        // Session cookie (for browser-based dashboard access)
        components.add_security_scheme(
            "session_cookie",
            SecurityScheme::ApiKey(ApiKey::Cookie(
                ApiKeyValue::with_description(
                    "better-auth.session_token",
                    "Session cookie from better-auth. Used for browser-based dashboard access. Requires project_id query parameter.",
                ),
            )),
        );
    }
}
