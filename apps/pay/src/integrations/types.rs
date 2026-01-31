use serde::{Deserialize, Serialize};

use crate::types::RefundStatus;
use std::collections::HashMap;

/// Request to create a product on the payment processor
#[derive(Debug, Clone, Deserialize)]
pub struct ProcessorProductRequest {
    pub name: String,
    pub description: Option<String>,
    pub active: bool,
    pub metadata: HashMap<String, String>,
}

/// Product representation returned by payment processor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessorProduct {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub active: bool,
}

/// Request to create a price on the payment processor
#[derive(Debug, Clone, Deserialize)]
pub struct ProcessorPriceRequest {
    pub product: String,
    pub currency: String,
    pub unit_amount: i32,
    pub recurring_interval: Option<String>,
    pub metadata: HashMap<String, String>,
}

/// Price representation returned by payment processor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessorPrice {
    pub id: String,
    pub product: String,
    pub currency: String,
    pub unit_amount: i64,
    pub active: bool,
}

/// Individual line item for checkout
#[derive(Debug, Clone, Deserialize)]
pub struct CheckoutLineItem {
    pub price: String,
    pub quantity: u32,
}

/// Request to create a checkout session on the payment processor
#[derive(Debug, Clone, Deserialize)]
pub struct CreateCheckoutSessionRequest {
    pub line_items: Vec<CheckoutLineItem>,
    pub success_url: String,
    pub cancel_url: String,
    pub mode: String,
    pub customer: Option<String>,
    pub metadata: HashMap<String, String>,
    pub application_fee_amount: Option<i64>,
    pub application_fee_percent: Option<f64>,
    pub destination_account: Option<String>,
}

/// Checkout session representation returned by payment processor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessorCheckout {
    pub id: String,
    pub url: Option<String>,
    pub status: String,
    pub customer: Option<String>,
}

/// Account capabilities response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapabilitiesResponse {
    pub transfers: Option<String>,
    pub card_payments: Option<String>,
}

/// Account onboarding link for connected accounts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountLink {
    pub id: Option<String>, // Stripe doesn't return id for account links
    pub url: String,
    pub created_at: i64,
    pub expires_at: i64,
}

/// Request to create a payment intent
#[derive(Debug, Clone, Deserialize)]
pub struct PaymentIntentRequest {
    pub amount: i64,
    pub currency: String,
    pub customer: Option<String>,
    pub payment_method: Option<String>,
    pub confirm: bool,
    pub metadata: HashMap<String, String>,
}

/// Payment representation returned by payment processor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessorPayment {
    pub id: String,
    pub amount: i64,
    pub currency: String,
    pub status: String,
    pub customer: Option<String>,
}

/// Request to transfer funds to a connected account
#[derive(Debug, Clone, Deserialize)]
pub struct TransferRequest {
    pub amount: i64,
    pub currency: String,
    pub destination: String,
    pub metadata: HashMap<String, String>,
}

/// Transfer representation returned by payment processor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessorTransfer {
    pub id: String,
    pub amount: i64,
    pub currency: String,
    pub destination: String,
    pub status: String,
}

/// Request to create a payout to an external bank account
#[derive(Debug, Clone, Deserialize)]
pub struct PayoutRequest {
    pub amount: i64,
    pub currency: String,
    pub destination: Option<String>,
    pub method: Option<String>,
    pub metadata: HashMap<String, String>,
}

/// Payout representation returned by payment processor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessorPayout {
    pub id: String,
    pub amount: i64,
    pub currency: String,
    pub status: String,
    pub arrival_date: Option<i64>,
}

/// Account details fetched from the payment processor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountDetails {
    pub details_submitted: bool,
    pub charges_enabled: bool,
    pub payouts_enabled: bool,
}

/// Normalized webhook event types across different payment processors
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum NormalizedEvent {
    // Account events
    AccountUpdated {
        account_id: String,
        capabilities: AccountCapabilities,
        details_submitted: bool,
        charges_enabled: bool,
        payouts_enabled: bool,
    },
    AccountDeauthorized {
        account_id: String,
    },

    // Payment events
    PaymentSucceeded {
        payment_id: String,
        amount: i64,
        currency: String,
        account_id: Option<String>,
    },
    PaymentFailed {
        payment_id: String,
        error: String,
    },

    // Checkout events
    CheckoutCompleted {
        session_id: String,
        customer_id: Option<String>,
        customer_email: Option<String>,
        subscription_id: Option<String>,
        payment_intent_id: Option<String>,
        mode: String,
        amount_total: i64,
        currency: String,
    },
    CheckoutExpired {
        session_id: String,
    },

    // Subscription events
    SubscriptionCreated {
        subscription_id: String,
        customer_id: String,
        status: String,
    },
    SubscriptionUpdated {
        subscription_id: String,
        customer_id: String,
        status: String,
    },
    SubscriptionCanceled {
        subscription_id: String,
    },

    // Payout events
    PayoutCompleted {
        payout_id: String,
        account_id: String,
    },
    PayoutFailed {
        payout_id: String,
        error: String,
    },

    // Dispute events
    DisputeCreated {
        dispute_id: String,
        charge_id: String,
    },
    DisputeClosed {
        dispute_id: String,
        status: DisputeStatus,
    },

    // Invoice events
    InvoicePaid {
        invoice_id: String,
        subscription_id: Option<String>,
        customer_id: String,
    },
    InvoicePaymentFailed {
        invoice_id: String,
        error: String,
        customer_id: String,
    },

    // Transfer events
    TransferCreated {
        transfer_id: String,
        amount: i64,
        currency: String,
        destination: String,
    },
    TransferPaid {
        transfer_id: String,
    },
    TransferReversed {
        transfer_id: String,
        reversal_id: String,
    },

    // Charge events
    ChargeRefunded {
        charge_id: String,
        refund_id: String,
        amount: i64,
        currency: String,
        status: RefundStatus,
        reason: Option<String>,
        customer_id: Option<String>,
    },

    // Unknown/unhandled events (for forward compatibility)
    Unknown {
        event_type: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountCapabilities {
    pub card_payments: bool,
    pub transfers: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DisputeStatus {
    Won,
    Lost,
    Closed,
}
