use super::types::{
    AccountDetails, AccountLink, CreateCheckoutSessionRequest, NormalizedEvent,
    PaymentIntentRequest, PayoutRequest, ProcessorCheckout, ProcessorPayment, ProcessorPayout,
    ProcessorPrice, ProcessorPriceRequest, ProcessorProduct, ProcessorProductRequest,
    ProcessorTransfer, TransferRequest,
};
use async_trait::async_trait;
use serde::Deserialize;

/// Response from OAuth token exchange (processor-agnostic)
#[derive(Debug, Deserialize)]
pub struct OAuthTokenResponse {
    pub processor_account_id: String,
    pub scope: String,
    pub livemode: bool,
}

/// Core payment processor trait for handling product, price, and checkout operations
#[async_trait]
pub trait PaymentProcessor: Send + Sync {
    /// Returns the processor identifier (e.g., "stripe", "paypal")
    fn name(&self) -> &str;

    /// Creates a product on the payment processor
    async fn create_product(
        &self,
        req: ProcessorProductRequest,
    ) -> Result<ProcessorProduct, String>;

    /// Creates a price on the payment processor
    async fn create_price(&self, req: ProcessorPriceRequest) -> Result<ProcessorPrice, String>;

    /// Creates a checkout session for collecting payment
    async fn create_checkout_session(
        &self,
        req: CreateCheckoutSessionRequest,
    ) -> Result<ProcessorCheckout, String>;

    /// Verifies webhook signature from the payment processor
    fn verify_webhook(&self, payload: &[u8], signature: &str) -> Result<bool, String>;

    /// Parses webhook payload into a normalized event type
    fn parse_webhook_event(&self, payload: &serde_json::Value) -> Result<NormalizedEvent, String>;
}

/// Extended payment processor trait with marketplace and connect capabilities
#[async_trait]
pub trait ConnectProcessor: PaymentProcessor + Send + Sync {
    /// Creates an onboarding link for a connected account to complete verification
    async fn create_account_link(
        &self,
        account_id: &str,
        refresh_url: &str,
        return_url: &str,
    ) -> Result<AccountLink, String>;

    /// Creates a payment intent for direct payments
    async fn create_payment_intent(
        &self,
        req: PaymentIntentRequest,
    ) -> Result<ProcessorPayment, String>;

    /// Transfers funds to a connected account
    async fn create_transfer(&self, req: TransferRequest) -> Result<ProcessorTransfer, String>;

    /// Creates a payout from a connected account to an external bank account
    async fn create_payout(
        &self,
        account_id: &str,
        req: PayoutRequest,
    ) -> Result<ProcessorPayout, String>;

    /// Generates OAuth authorization URL for Stripe Connect
    fn generate_oauth_url(&self, state: &str, redirect_uri: &str) -> String;

    /// Exchanges OAuth authorization code for access token
    async fn exchange_oauth_code(&self, code: &str) -> Result<OAuthTokenResponse, String>;

    /// Fetches account details from the payment processor
    async fn get_account(&self, account_id: &str) -> Result<AccountDetails, String>;
}
