use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::Deserialize;
use sha2::Sha256;
use std::collections::HashMap;
use std::time::{Duration, SystemTime};
use subtle::ConstantTimeEq;
use tracing::debug;

use crate::integrations::traits::{ConnectProcessor, OAuthTokenResponse, PaymentProcessor};
use crate::integrations::types::{
    AccountCapabilities, AccountDetails, AccountLink, CreateCheckoutSessionRequest,
    NormalizedEvent, PaymentIntentRequest, PayoutRequest, ProcessorCheckout, ProcessorPayment,
    ProcessorPayout, ProcessorPrice, ProcessorPriceRequest, ProcessorProduct,
    ProcessorProductRequest, ProcessorTransfer, TransferRequest,
};
use crate::types::RefundStatus;
use async_trait::async_trait;

type HmacSha256 = Hmac<Sha256>;

/// Stripe payment processor implementation
#[derive(Clone)]
pub struct StripeProcessor {
    pub secret_key: String,
    pub webhook_secret: String,
    pub client_id: String,
}

impl StripeProcessor {
    /// Creates a new StripeProcessor with the given credentials
    pub fn new(secret_key: String, webhook_secret: String, client_id: String) -> Self {
        Self {
            secret_key,
            webhook_secret,
            client_id,
        }
    }

    /// Generates a deterministic idempotency key from metadata
    fn generate_idempotency_key(metadata: &HashMap<String, String>) -> String {
        let mut keys: Vec<_> = metadata.keys().collect();
        keys.sort();
        keys.iter()
            .map(|k| format!("{}:{}", k, metadata.get(*k).unwrap_or(&String::new())))
            .collect::<Vec<_>>()
            .join("|")
    }
}

#[async_trait]
impl PaymentProcessor for StripeProcessor {
    fn name(&self) -> &str {
        "stripe"
    }

    async fn create_product(
        &self,
        req: ProcessorProductRequest,
    ) -> Result<ProcessorProduct, String> {
        let idempotency_key = Self::generate_idempotency_key(&req.metadata);
        let stripe_req = CreateStripeProductRequest {
            name: req.name,
            description: req.description,
            active: req.active,
            metadata: req.metadata,
        };
        let response =
            create_stripe_product(&self.secret_key, stripe_req, &idempotency_key).await?;
        Ok(ProcessorProduct {
            id: response.id,
            name: response.name,
            description: response.description,
            active: response.active,
        })
    }

    async fn create_price(&self, req: ProcessorPriceRequest) -> Result<ProcessorPrice, String> {
        let idempotency_key = Self::generate_idempotency_key(&req.metadata);
        let stripe_req = CreateStripePriceRequest {
            product: req.product,
            currency: req.currency,
            unit_amount: req.unit_amount,
            recurring_interval: req.recurring_interval,
            metadata: req.metadata,
        };
        let response = create_stripe_price(&self.secret_key, stripe_req, &idempotency_key).await?;
        Ok(ProcessorPrice {
            id: response.id,
            product: response.product,
            currency: response.currency,
            unit_amount: response.unit_amount.unwrap_or(req.unit_amount as i64),
            active: response.active,
        })
    }

    async fn create_checkout_session(
        &self,
        req: CreateCheckoutSessionRequest,
    ) -> Result<ProcessorCheckout, String> {
        let idempotency_key = Self::generate_idempotency_key(&req.metadata);
        if req.line_items.len() != 1 {
            return Err("Exactly one line item is required".to_string());
        }
        let line_item = &req.line_items[0];
        let customer_creation = if req.mode == "payment" {
            Some(String::from("always"))
        } else {
            None
        };
        let stripe_req = CreateStripeCheckoutSessionRequest {
            success_url: req.success_url,
            cancel_url: req.cancel_url,
            stripe_price_id: line_item.price.clone(),
            quantity: line_item.quantity,
            mode: req.mode,
            application_fee_amount: req.application_fee_amount,
            application_fee_percent: req.application_fee_percent,
            destination_account: req.destination_account,
            customer_creation,
        };
        let response =
            create_stripe_checkout_session(&self.secret_key, stripe_req, &idempotency_key).await?;
        Ok(ProcessorCheckout {
            id: response.id,
            url: response.url,
            status: response.status,
            customer: response.customer,
        })
    }

    fn verify_webhook(&self, payload: &[u8], signature: &str) -> Result<bool, String> {
        verify_webhook_signature(payload, signature, &self.webhook_secret, 300)
    }

    fn parse_webhook_event(&self, payload: &serde_json::Value) -> Result<NormalizedEvent, String> {
        let event_type = payload
            .get("type")
            .and_then(|v| v.as_str())
            .ok_or("Missing event type")?;

        let object = payload
            .get("data")
            .and_then(|d| d.get("object"))
            .ok_or("Missing object in payload")?;

        match event_type {
            "checkout.session.completed" => {
                let session_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing session_id")?;
                let customer_id = object
                    .get("customer")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let customer_email = object
                    .get("customer_email")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let subscription_id = object
                    .get("subscription")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let payment_intent_id = object
                    .get("payment_intent")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let mode = object
                    .get("mode")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let amount_total = object
                    .get("amount_total")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0);
                let currency = object
                    .get("currency")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                Ok(NormalizedEvent::CheckoutCompleted {
                    session_id: session_id.to_string(),
                    customer_id,
                    customer_email,
                    subscription_id,
                    payment_intent_id,
                    mode,
                    amount_total,
                    currency,
                })
            }
            "checkout.session.expired" => {
                let session_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing session_id")?;
                Ok(NormalizedEvent::CheckoutExpired {
                    session_id: session_id.to_string(),
                })
            }
            "customer.subscription.created" => {
                let subscription_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing subscription_id")?;
                let customer_id = object
                    .get("customer")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing customer_id")?;
                let status = object
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Ok(NormalizedEvent::SubscriptionCreated {
                    subscription_id: subscription_id.to_string(),
                    customer_id: customer_id.to_string(),
                    status,
                })
            }
            "customer.subscription.updated" => {
                let subscription_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing subscription_id")?;
                let customer_id = object
                    .get("customer")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing customer_id")?;
                let status = object
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Ok(NormalizedEvent::SubscriptionUpdated {
                    subscription_id: subscription_id.to_string(),
                    customer_id: customer_id.to_string(),
                    status,
                })
            }
            "customer.subscription.deleted" => {
                let subscription_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing subscription_id")?;
                Ok(NormalizedEvent::SubscriptionCanceled {
                    subscription_id: subscription_id.to_string(),
                })
            }
            "invoice.paid" => {
                let invoice_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing invoice_id")?;
                let subscription_id = object
                    .get("subscription")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let customer_id = object
                    .get("customer")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing customer_id")?;
                Ok(NormalizedEvent::InvoicePaid {
                    invoice_id: invoice_id.to_string(),
                    subscription_id,
                    customer_id: customer_id.to_string(),
                })
            }
            "invoice.payment_failed" => {
                let invoice_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing invoice_id")?;
                let customer_id = object
                    .get("customer")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing customer_id")?;

                let error = object
                    .get("last_payment_error")
                    .and_then(|e| e.get("message"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error")
                    .to_string();

                Ok(NormalizedEvent::InvoicePaymentFailed {
                    invoice_id: invoice_id.to_string(),
                    error,
                    customer_id: customer_id.to_string(),
                })
            }
            "payment_intent.succeeded" => {
                let payment_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing payment_id")?;
                let amount = object.get("amount").and_then(|v| v.as_i64()).unwrap_or(0);
                let currency = object
                    .get("currency")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let account_id = None;

                Ok(NormalizedEvent::PaymentSucceeded {
                    payment_id: payment_id.to_string(),
                    amount,
                    currency,
                    account_id,
                })
            }
            "payment_intent.payment_failed" => {
                let payment_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing payment_id")?;

                let error = object
                    .get("last_payment_error")
                    .and_then(|e| e.get("message"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error")
                    .to_string();

                Ok(NormalizedEvent::PaymentFailed {
                    payment_id: payment_id.to_string(),
                    error,
                })
            }
            "account.updated" => {
                let account_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing account_id")?;

                let capabilities = object
                    .get("capabilities")
                    .map(|c| AccountCapabilities {
                        card_payments: c.get("card_payments").and_then(|v| v.as_str())
                            == Some("active"),
                        transfers: c.get("transfers").and_then(|v| v.as_str()) == Some("active"),
                    })
                    .unwrap_or(AccountCapabilities {
                        card_payments: false,
                        transfers: false,
                    });

                let details_submitted = object
                    .get("details_submitted")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let charges_enabled = object
                    .get("charges_enabled")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let payouts_enabled = object
                    .get("payouts_enabled")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);

                Ok(NormalizedEvent::AccountUpdated {
                    account_id: account_id.to_string(),
                    capabilities,
                    details_submitted,
                    charges_enabled,
                    payouts_enabled,
                })
            }
            "account.application.deauthorized" => {
                let account_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing account_id")?;
                Ok(NormalizedEvent::AccountDeauthorized {
                    account_id: account_id.to_string(),
                })
            }
            "payout.paid" => {
                let payout_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing payout_id")?;
                // For Connect, the connected account is attached on the top-level event as `account`.
                // The payout object's `destination` is typically a bank account / card, not an account id.
                let account_id = payload
                    .get("account")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Ok(NormalizedEvent::PayoutCompleted {
                    payout_id: payout_id.to_string(),
                    account_id,
                })
            }
            "payout.failed" => {
                let payout_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing payout_id")?;

                let error = object
                    .get("failure_message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown error")
                    .to_string();

                Ok(NormalizedEvent::PayoutFailed {
                    payout_id: payout_id.to_string(),
                    error,
                })
            }
            "transfer.created" => {
                let transfer_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing transfer_id")?;
                let amount = object.get("amount").and_then(|v| v.as_i64()).unwrap_or(0);
                let currency = object
                    .get("currency")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let destination = object
                    .get("destination")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Ok(NormalizedEvent::TransferCreated {
                    transfer_id: transfer_id.to_string(),
                    amount,
                    currency,
                    destination,
                })
            }
            "transfer.paid" => {
                let transfer_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing transfer_id")?;
                Ok(NormalizedEvent::TransferPaid {
                    transfer_id: transfer_id.to_string(),
                })
            }
            "transfer.reversed" => {
                let transfer_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing transfer_id")?;
                let reversal_id = object
                    .get("reversals")
                    .and_then(|r| r.get("data"))
                    .and_then(|d| d.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|r| r.get("id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                Ok(NormalizedEvent::TransferReversed {
                    transfer_id: transfer_id.to_string(),
                    reversal_id,
                })
            }
            "refund.created" | "refund.updated" | "charge.refund.updated" => {
                let refund_id = object
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing refund_id")?;
                let status = object
                    .get("status")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing refund status")?;
                let status = RefundStatus::try_from(status)?;
                let charge_id = object.get("charge").and_then(|v| v.as_str()).unwrap_or("");
                let amount = object.get("amount").and_then(|v| v.as_i64()).unwrap_or(0);
                let currency = object
                    .get("currency")
                    .and_then(|v| v.as_str())
                    .unwrap_or("usd");
                let reason = object
                    .get("reason")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                // Refund object doesn't have customer directly, it's on the charge
                Ok(NormalizedEvent::ChargeRefunded {
                    charge_id: charge_id.to_string(),
                    refund_id: refund_id.to_string(),
                    amount,
                    currency: currency.to_string(),
                    status,
                    reason,
                    customer_id: None,
                })
            }
            "charge.refunded" => {
                // charge.refunded has refund nested in refunds.data[] - may be empty in test fixtures
                let Some(refund) = object
                    .get("refunds")
                    .and_then(|r| r.get("data"))
                    .and_then(|d| d.as_array())
                    .and_then(|arr| arr.first())
                else {
                    return Ok(NormalizedEvent::Unknown {
                        event_type: event_type.to_string(),
                    });
                };
                let charge_id = object.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let customer_id = object
                    .get("customer")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let refund_id = refund
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing refund_id")?;
                let status = refund
                    .get("status")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing refund status")?;
                let status = RefundStatus::try_from(status)?;
                let amount = refund.get("amount").and_then(|v| v.as_i64()).unwrap_or(0);
                let currency = refund
                    .get("currency")
                    .and_then(|v| v.as_str())
                    .unwrap_or("usd");
                let reason = refund
                    .get("reason")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                Ok(NormalizedEvent::ChargeRefunded {
                    charge_id: charge_id.to_string(),
                    refund_id: refund_id.to_string(),
                    amount,
                    currency: currency.to_string(),
                    status,
                    reason,
                    customer_id,
                })
            }
            _ => Ok(NormalizedEvent::Unknown {
                event_type: event_type.to_string(),
            }),
        }
    }
}

#[async_trait]
impl ConnectProcessor for StripeProcessor {
    async fn create_account_link(
        &self,
        account_id: &str,
        refresh_url: &str,
        return_url: &str,
    ) -> Result<AccountLink, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .build()
            .map_err(|e| format!("HTTP client error: {}", e))?;

        let form_params: Vec<(String, String)> = vec![
            (String::from("account"), account_id.to_string()),
            (String::from("refresh_url"), refresh_url.to_string()),
            (String::from("return_url"), return_url.to_string()),
            (String::from("type"), String::from("account_onboarding")),
        ];

        let response = client
            .post("https://api.stripe.com/v1/account_links")
            .header("Authorization", format!("Bearer {}", self.secret_key))
            .form(&form_params)
            .send()
            .await
            .map_err(|e| format!("Stripe API error: {}", e))?;

        let status = response.status();
        let response_text = match response.text().await {
            Ok(text) => text,
            Err(e) => {
                return Err(format!(
                    "Failed to read response body (status {}): {}",
                    status, e
                ));
            }
        };

        if !status.is_success() {
            return Err(format!("Stripe error ({}): {}", status, response_text));
        }

        let stripe_response: StripeAccountLinkResponse = serde_json::from_str(&response_text)
            .map_err(|e| {
                format!(
                    "Failed to parse Stripe response: {} - Body: {}",
                    e, response_text
                )
            })?;

        Ok(AccountLink {
            id: stripe_response.id,
            url: stripe_response.url,
            created_at: stripe_response.created,
            expires_at: stripe_response.expires_at,
        })
    }

    async fn create_payment_intent(
        &self,
        req: PaymentIntentRequest,
    ) -> Result<ProcessorPayment, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .build()
            .map_err(|e| format!("HTTP client error: {}", e))?;

        let mut form_params: Vec<(String, String)> = vec![
            (String::from("amount"), req.amount.to_string()),
            (String::from("currency"), req.currency),
            (String::from("confirm"), req.confirm.to_string()),
        ];

        if let Some(customer) = req.customer {
            form_params.push((String::from("customer"), customer));
        }

        if let Some(payment_method) = req.payment_method {
            form_params.push((String::from("payment_method"), payment_method));
        }

        for (key, value) in req.metadata {
            form_params.push((format!("metadata[{}]", key), value));
        }

        let response = client
            .post("https://api.stripe.com/v1/payment_intents")
            .header("Authorization", format!("Bearer {}", self.secret_key))
            .form(&form_params)
            .send()
            .await
            .map_err(|e| format!("Stripe API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Stripe error: {}", error_text));
        }

        let stripe_response = response
            .json::<StripePaymentIntentResponse>()
            .await
            .map_err(|e| format!("Failed to parse Stripe response: {}", e))?;

        Ok(ProcessorPayment {
            id: stripe_response.id,
            amount: stripe_response.amount,
            currency: stripe_response.currency,
            status: stripe_response.status,
            customer: stripe_response.customer,
        })
    }

    async fn create_transfer(&self, req: TransferRequest) -> Result<ProcessorTransfer, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .build()
            .map_err(|e| format!("HTTP client error: {}", e))?;

        let mut form_params: Vec<(String, String)> = vec![
            (String::from("amount"), req.amount.to_string()),
            (String::from("currency"), req.currency),
            (String::from("destination"), req.destination),
        ];

        for (key, value) in req.metadata {
            form_params.push((format!("metadata[{}]", key), value));
        }

        let response = client
            .post("https://api.stripe.com/v1/transfers")
            .header("Authorization", format!("Bearer {}", self.secret_key))
            .form(&form_params)
            .send()
            .await
            .map_err(|e| format!("Stripe API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Stripe error: {}", error_text));
        }

        let stripe_response = response
            .json::<StripeTransferResponse>()
            .await
            .map_err(|e| format!("Failed to parse Stripe response: {}", e))?;

        Ok(ProcessorTransfer {
            id: stripe_response.id,
            amount: stripe_response.amount,
            currency: stripe_response.currency,
            destination: stripe_response.destination,
            status: String::from("pending"),
        })
    }

    async fn create_payout(
        &self,
        account_id: &str,
        req: PayoutRequest,
    ) -> Result<ProcessorPayout, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .build()
            .map_err(|e| format!("HTTP client error: {}", e))?;

        let mut form_params: Vec<(String, String)> = vec![
            (String::from("amount"), req.amount.to_string()),
            (String::from("currency"), req.currency),
        ];

        if let Some(destination) = req.destination {
            form_params.push((String::from("destination"), destination));
        }

        if let Some(method) = req.method {
            form_params.push((String::from("method"), method));
        }

        for (key, value) in req.metadata {
            form_params.push((format!("metadata[{}]", key), value));
        }

        let response = client
            .post("https://api.stripe.com/v1/payouts")
            .header("Authorization", format!("Bearer {}", self.secret_key))
            .header("Stripe-Account", account_id)
            .form(&form_params)
            .send()
            .await
            .map_err(|e| format!("Stripe API error: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Stripe error: {}", error_text));
        }

        let stripe_response = response
            .json::<StripePayoutResponse>()
            .await
            .map_err(|e| format!("Failed to parse Stripe response: {}", e))?;

        Ok(ProcessorPayout {
            id: stripe_response.id,
            amount: stripe_response.amount,
            currency: stripe_response.currency,
            status: stripe_response.status,
            arrival_date: stripe_response.arrival_date,
        })
    }

    fn generate_oauth_url(&self, state: &str, redirect_uri: &str) -> String {
        format!(
            "https://connect.stripe.com/oauth/authorize?response_type=code&client_id={}&scope=read_write&redirect_uri={}&state={}",
            self.client_id,
            urlencoding::encode(redirect_uri),
            urlencoding::encode(state)
        )
    }

    async fn exchange_oauth_code(&self, code: &str) -> Result<OAuthTokenResponse, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .build()
            .map_err(|e| format!("HTTP client error: {}", e))?;

        let form_params: Vec<(String, String)> = vec![
            (
                String::from("grant_type"),
                String::from("authorization_code"),
            ),
            (String::from("code"), code.to_string()),
        ];

        let response = client
            .post("https://connect.stripe.com/oauth/token")
            .header("Authorization", format!("Bearer {}", self.secret_key))
            .form(&form_params)
            .send()
            .await
            .map_err(|e| format!("Stripe API error: {}", e))?;

        let status = response.status();
        let response_text = match response.text().await {
            Ok(text) => text,
            Err(e) => {
                return Err(format!(
                    "Failed to read response body (status {}): {}",
                    status, e
                ));
            }
        };

        if !status.is_success() {
            return Err(format!("Stripe error ({}): {}", status, response_text));
        }

        let stripe_response: StripeOAuthTokenResponse = serde_json::from_str(&response_text)
            .map_err(|e| {
                format!(
                    "Failed to parse Stripe response: {} - Body: {}",
                    e, response_text
                )
            })?;

        Ok(OAuthTokenResponse {
            processor_account_id: stripe_response.stripe_user_id,
            scope: stripe_response.scope,
            livemode: stripe_response.livemode,
        })
    }

    async fn get_account(&self, account_id: &str) -> Result<AccountDetails, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
            .build()
            .map_err(|e| format!("HTTP client error: {}", e))?;

        let url = format!("https://api.stripe.com/v1/accounts/{}", account_id);

        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.secret_key))
            .send()
            .await
            .map_err(|e| format!("Stripe API error: {}", e))?;

        let status = response.status();
        let response_text = match response.text().await {
            Ok(text) => text,
            Err(e) => {
                return Err(format!(
                    "Failed to read response body (status {}): {}",
                    status, e
                ));
            }
        };

        if !status.is_success() {
            return Err(format!("Stripe error ({}): {}", status, response_text));
        }

        let stripe_response: StripeAccountResponse =
            serde_json::from_str(&response_text).map_err(|e| {
                format!(
                    "Failed to parse Stripe response: {} - Body: {}",
                    e, response_text
                )
            })?;

        Ok(AccountDetails {
            details_submitted: stripe_response.details_submitted,
            charges_enabled: stripe_response.charges_enabled,
            payouts_enabled: stripe_response.payouts_enabled,
        })
    }
}

#[derive(Debug, Clone)]
pub struct CreateStripeProductRequest {
    pub name: String,
    pub description: Option<String>,
    pub active: bool,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
pub struct StripeProductResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub active: bool,
}

const HTTP_TIMEOUT_SECS: u64 = 30;

pub async fn create_stripe_product(
    secret_key: &str,
    req: CreateStripeProductRequest,
    idempotency_key: &str,
) -> Result<StripeProductResponse, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let mut form_params: Vec<(String, String)> = vec![
        (String::from("name"), req.name),
        (String::from("active"), req.active.to_string()),
    ];

    if let Some(description) = req.description {
        form_params.push((String::from("description"), description));
    }

    for (key, value) in req.metadata {
        form_params.push((format!("metadata[{}]", key), value));
    }

    let response = client
        .post("https://api.stripe.com/v1/products")
        .header("Authorization", format!("Bearer {}", secret_key))
        .header("Idempotency-Key", idempotency_key)
        .form(&form_params)
        .send()
        .await
        .map_err(|e| format!("Stripe API error: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Stripe error: {}", error_text));
    }

    response
        .json::<StripeProductResponse>()
        .await
        .map_err(|e| format!("Failed to parse Stripe response: {}", e))
}

#[derive(Debug, Clone)]
pub struct CreateStripePriceRequest {
    pub product: String,
    pub currency: String,
    pub unit_amount: i32,
    pub recurring_interval: Option<String>,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
pub struct StripePriceResponse {
    pub id: String,
    pub product: String,
    pub currency: String,
    pub unit_amount: Option<i64>,
    pub active: bool,
}

pub async fn create_stripe_price(
    secret_key: &str,
    req: CreateStripePriceRequest,
    idempotency_key: &str,
) -> Result<StripePriceResponse, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let mut form_params: Vec<(String, String)> = vec![
        (String::from("product"), req.product),
        (String::from("currency"), req.currency),
        (String::from("unit_amount"), req.unit_amount.to_string()),
    ];

    if let Some(interval) = req.recurring_interval
        && !interval.is_empty()
    {
        form_params.push((String::from("recurring[interval]"), interval));
    }

    for (key, value) in req.metadata {
        form_params.push((format!("metadata[{}]", key), value));
    }

    let response = client
        .post("https://api.stripe.com/v1/prices")
        .header("Authorization", format!("Bearer {}", secret_key))
        .header("Idempotency-Key", idempotency_key)
        .form(&form_params)
        .send()
        .await
        .map_err(|e| format!("Stripe API error: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Stripe error: {}", error_text));
    }

    response
        .json::<StripePriceResponse>()
        .await
        .map_err(|e| format!("Failed to parse Stripe response: {}", e))
}

pub fn verify_webhook_signature(
    payload: &[u8],
    signature_header: &str,
    webhook_secret: &str,
    tolerance_seconds: u64,
) -> Result<bool, String> {
    // Stripe signature format: "t=timestamp,v1=sig1,v1=sig2,..."
    let mut timestamp: Option<u64> = None;
    let mut signatures: Vec<&str> = Vec::new();

    for part in signature_header.split(',') {
        let Some((key, value)) = part.split_once('=') else {
            return Err(format!("Invalid signature header format: {}", part));
        };

        match key {
            "t" => {
                timestamp = Some(
                    value
                        .parse()
                        .map_err(|e| format!("Invalid timestamp: {}", e))?,
                );
            }
            "v1" => {
                signatures.push(value);
            }
            _ => continue,
        }
    }

    let timestamp = timestamp.ok_or("Missing timestamp in signature header")?;

    // Check timestamp is within tolerance
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(|e| format!("Failed to get current time: {}", e))?
        .as_secs();

    if timestamp > now + tolerance_seconds || timestamp < now.saturating_sub(tolerance_seconds) {
        return Err(format!(
            "Timestamp {} is outside tolerance range (now: {}, tolerance: {}s)",
            timestamp, now, tolerance_seconds
        ));
    }

    // Stripe signature = HMAC-SHA256(secret, "{timestamp}.{payload}")
    let timestamp_str = timestamp.to_string();
    let signed_payload = [timestamp_str.as_bytes(), b".", payload].concat();
    let mut mac = HmacSha256::new_from_slice(webhook_secret.as_bytes())
        .map_err(|e| format!("Failed to create HMAC: {}", e))?;
    mac.update(&signed_payload);
    let expected_signature = hex::encode(mac.finalize().into_bytes());

    // Use constant-time comparison to prevent timing attacks
    // Timing attacks allow attackers to guess signatures character-by-character
    // by measuring response times. Constant-time comparison ensures the check
    // takes the same amount of time regardless of where strings differ.
    let expected_bytes = expected_signature.as_bytes();
    let is_valid = signatures.iter().any(|sig| {
        let sig_bytes = sig.as_bytes();
        if sig_bytes.len() != expected_bytes.len() {
            return false;
        }
        sig_bytes.ct_eq(expected_bytes).into()
    });
    Ok(is_valid)
}

#[derive(Debug, Deserialize)]
pub struct StripeCard {
    #[serde(default)]
    pub brand: String,
    #[serde(default)]
    pub last4: String,
}

#[derive(Debug, Deserialize)]
pub struct StripePaymentMethod {
    pub id: String,
    #[serde(default)]
    pub object: String,
    #[serde(rename = "type")]
    #[serde(default)]
    pub payment_type: String,
    pub card: Option<StripeCard>,
}

#[derive(Debug, Deserialize)]
pub struct StripeSubscriptionPrice {
    pub id: String,
    #[serde(rename = "object")]
    #[serde(default)]
    pub object_type: String,
    #[serde(default)]
    pub active: Option<bool>,
    #[serde(default)]
    pub billing_scheme: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub unit_amount: Option<i64>,
    #[serde(default)]
    pub recurring: Option<StripePriceRecurring>,
}

#[derive(Debug, Deserialize)]
pub struct StripePriceRecurring {
    #[serde(default)]
    pub interval: Option<String>,
    #[serde(default)]
    pub interval_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct StripeSubscriptionItem {
    pub id: String,
    pub price: StripeSubscriptionPrice,
    pub current_period_start: i64,
    pub current_period_end: i64,
    #[serde(default)]
    pub quantity: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct StripeSubscription {
    pub id: String,
    #[serde(default)]
    pub object: Option<String>,
    pub status: String,
    #[serde(default)]
    pub current_period_start: Option<i64>,
    #[serde(default)]
    pub current_period_end: Option<i64>,
    pub cancel_at_period_end: bool,
    pub default_payment_method: Option<StripePaymentMethod>,
    pub items: StripeItemsData,
    #[serde(default)]
    pub customer: Option<String>,
    #[serde(default)]
    pub latest_invoice: Option<String>,
    #[serde(default)]
    pub created: Option<i64>,
    #[serde(default)]
    pub cancel_at: Option<i64>,
    #[serde(default)]
    pub canceled_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct StripeItemsData {
    #[serde(default)]
    pub object: String,
    pub data: Vec<StripeSubscriptionItem>,
    #[serde(default)]
    pub has_more: bool,
    #[serde(default)]
    pub url: String,
}

#[derive(Debug, Deserialize)]
pub struct StripeSubscriptionListResponse {
    #[serde(default)]
    pub object: String,
    pub data: Vec<StripeSubscription>,
    #[serde(default)]
    pub has_more: bool,
    #[serde(default)]
    pub url: Option<String>,
}

pub async fn fetch_customer_subscriptions_with_payment_means(
    secret_key: &str,
    customer_id: &str,
) -> Result<StripeSubscriptionListResponse, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let url = format!(
        "https://api.stripe.com/v1/subscriptions?customer={}&status=all&expand[]=data.default_payment_method",
        customer_id
    );

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", secret_key))
        .send()
        .await
        .map_err(|e| format!("Stripe API error: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Stripe error: {}", error_text));
    }

    let response_body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;
    debug!("Stripe subscription response: {}", response_body);

    serde_json::from_str::<StripeSubscriptionListResponse>(&response_body).map_err(|e| {
        format!(
            "Failed to parse Stripe response: {}. Raw response: {}",
            e, response_body
        )
    })
}

#[derive(Debug, Clone)]
pub struct CreateStripeCheckoutSessionRequest {
    pub success_url: String,
    pub cancel_url: String,
    pub stripe_price_id: String,
    pub quantity: u32,
    pub mode: String,
    pub application_fee_amount: Option<i64>,
    pub application_fee_percent: Option<f64>,
    pub destination_account: Option<String>,
    pub customer_creation: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StripeCheckoutSessionResponse {
    pub id: String,
    pub url: Option<String>,
    pub status: String,
    pub customer: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StripeAccountResponse {
    pub id: String,
    pub country: String,
    pub email: Option<String>,
    #[serde(rename = "type")]
    pub account_type: String,
    #[serde(rename = "business_type")]
    pub business_type: Option<String>,
    pub capabilities: Option<StripeCapabilities>,
    pub details_submitted: bool,
    pub charges_enabled: bool,
    pub payouts_enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct StripeCapabilities {
    pub card_payments: Option<String>,
    pub transfers: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StripeAccountLinkResponse {
    #[serde(rename = "object")]
    pub object_type: String,
    #[serde(default)]
    pub id: Option<String>,
    pub url: String,
    pub created: i64,
    pub expires_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct StripePaymentIntentResponse {
    pub id: String,
    pub amount: i64,
    pub currency: String,
    pub status: String,
    pub customer: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StripeTransferResponse {
    pub id: String,
    pub amount: i64,
    pub currency: String,
    pub destination: String,
}

#[derive(Debug, Deserialize)]
pub struct StripePayoutResponse {
    pub id: String,
    pub amount: i64,
    pub currency: String,
    pub status: String,
    pub arrival_date: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct StripeOAuthTokenResponse {
    pub stripe_user_id: String,
    pub scope: String,
    pub livemode: bool,
}

pub async fn create_stripe_checkout_session(
    secret_key: &str,
    req: CreateStripeCheckoutSessionRequest,
    idempotency_key: &str,
) -> Result<StripeCheckoutSessionResponse, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let mode = req.mode.clone();
    let mut form_params: Vec<(String, String)> = vec![
        (String::from("mode"), mode.clone()),
        (String::from("success_url"), req.success_url),
        (String::from("cancel_url"), req.cancel_url),
        (String::from("line_items[0][price]"), req.stripe_price_id),
        (
            String::from("line_items[0][quantity]"),
            req.quantity.to_string(),
        ),
    ];

    if let Some(customer_creation) = req.customer_creation {
        form_params.push((String::from("customer_creation"), customer_creation));
    }

    if mode == "payment" {
        if let Some(fee_amount) = req.application_fee_amount {
            form_params.push((
                String::from("payment_intent_data[application_fee_amount]"),
                fee_amount.to_string(),
            ));
        }

        if let Some(destination) = req.destination_account {
            form_params.push((
                String::from("payment_intent_data[transfer_data][destination]"),
                destination,
            ));
        }
    } else if mode == "subscription" {
        if let Some(fee_percent) = req.application_fee_percent {
            form_params.push((
                String::from("subscription_data[application_fee_percent]"),
                fee_percent.to_string(),
            ));
        }

        if let Some(destination) = req.destination_account {
            form_params.push((
                String::from("subscription_data[transfer_data][destination]"),
                destination,
            ));
        }
    }

    let response = client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .header("Authorization", format!("Bearer {}", secret_key))
        .header("Idempotency-Key", idempotency_key)
        .form(&form_params)
        .send()
        .await
        .map_err(|e| format!("Stripe API error: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Stripe error: {}", error_text));
    }

    response
        .json::<StripeCheckoutSessionResponse>()
        .await
        .map_err(|e| format!("Failed to parse Stripe response: {}", e))
}

pub async fn fetch_checkout_session(
    secret_key: &str,
    session_id: &str,
) -> Result<StripeCheckoutSessionResponse, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let url = format!("https://api.stripe.com/v1/checkout/sessions/{}", session_id);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", secret_key))
        .send()
        .await
        .map_err(|e| format!("Stripe API error: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Stripe error: {}", error_text));
    }

    response
        .json::<StripeCheckoutSessionResponse>()
        .await
        .map_err(|e| format!("Failed to parse Stripe response: {}", e))
}
