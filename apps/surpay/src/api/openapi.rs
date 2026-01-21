use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::{Modify, OpenApi};

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Surpay API",
        version = "1.0.0",
        description = "Payment processing and subscription management API"
    ),
    paths(
        // Organization (master key)
        crate::api::organization::create_organization,
        // Project
        crate::api::project::create_project,
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
        crate::api::account::get_account,
        crate::api::account::list_accounts,
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
            // Organization DTOs
            crate::api::organization::CreateOrganizationRequest,
            crate::api::organization::CreateOrganizationResponse,
            // Project DTOs
            crate::api::project::CreateProjectRequest,
            crate::api::project::CreateProjectResponse,
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
        )
    ),
    tags(
        (name = "organization", description = "Organization management (requires master key)"),
        (name = "project", description = "Project management"),
        (name = "customer", description = "Customer management"),
        (name = "transaction", description = "Transaction history"),
        (name = "subscription", description = "Subscription management"),
        (name = "product", description = "Product and pricing management"),
        (name = "checkout", description = "Checkout session management"),
        (name = "account", description = "Payment processor account management"),
    ),
    modifiers(&SecurityAddon)
)]
pub struct ApiDoc;

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi.components.get_or_insert_with(Default::default);

        // Master API key (for organization creation)
        components.add_security_scheme(
            "master_key",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("sp_master_<prefix>_<secret>")
                    .description(Some("Master API key for platform administration"))
                    .build(),
            ),
        );

        // Organization API key (for merchant operations)
        components.add_security_scheme(
            "org_key",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("sp_org_<prefix>_<secret>")
                    .description(Some("Organization API key for merchant operations"))
                    .build(),
            ),
        );
    }
}
