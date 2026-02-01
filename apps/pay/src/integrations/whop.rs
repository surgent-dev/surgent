use async_trait::async_trait;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::time::SystemTime;
use subtle::ConstantTimeEq;
use tracing::{debug, error, info, warn};

use crate::integrations::traits::PaymentProcessor;
use crate::integrations::types::{
    CreateCheckoutSessionRequest, DisputeStatus, NormalizedEvent, ProcessorCheckout,
    ProcessorPrice, ProcessorPriceRequest, ProcessorProduct, ProcessorProductRequest,
};
use crate::types::RefundStatus;

type HmacSha256 = Hmac<Sha256>;

/// Inline product details for renewal plans (required when no product_id)
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InlineProduct {
    title: String,
    external_identifier: String,
}

#[derive(Debug, Serialize)]
struct CheckoutPlan {
    company_id: String,
    currency: String,
    plan_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    initial_price: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    renewal_price: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    billing_period: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    application_fee_amount: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    product: Option<InlineProduct>,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
}

#[derive(Debug, Serialize)]
struct CreateCheckoutConfigurationRequest {
    mode: String,
    plan: CheckoutPlan,
    #[serde(skip_serializing_if = "Option::is_none")]
    redirect_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CheckoutConfiguration {
    pub id: String,
    pub purchase_url: String,
}

pub struct CreateCheckoutParams<'a> {
    pub company_id: &'a str,
    pub currency: &'a str,
    pub price_amount: f64,
    pub plan_type: &'a str,
    pub billing_period: Option<i32>,
    pub application_fee_amount: Option<f64>,
    pub redirect_url: Option<&'a str>,
    pub title: &'a str,
    pub metadata: Option<serde_json::Value>,
    pub product_id: Option<&'a str>,
}

pub struct WhopClient {
    client: Client,
    api_key: String,
    platform_company_id: String,
    base_url: String,
}

#[derive(Debug, Serialize)]
struct CreateCompanyRequest {
    title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    email: Option<String>,
    parent_company_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct WhopCompany {
    pub id: String,
    pub title: String,
}

impl WhopClient {
    pub fn new(
        api_key: String,
        platform_company_id: String,
        base_url: String,
    ) -> Result<Self, String> {
        debug!(
            platform_company_id = %platform_company_id,
            base_url = %base_url,
            "Creating WhopClient"
        );
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
        Ok(Self {
            client,
            api_key,
            platform_company_id,
            base_url,
        })
    }

    pub async fn create_company(
        &self,
        title: &str,
        email: &str,
        user_id: &str,
        project_id: &str,
    ) -> Result<WhopCompany, String> {
        let req = CreateCompanyRequest {
            title: title.to_string(),
            email: Some(email.to_string()),
            parent_company_id: self.platform_company_id.clone(),
            metadata: Some(serde_json::json!({
                "internal_user_id": user_id,
                "project_id": project_id
            })),
        };

        info!(
            title = %title,
            parent_company_id = %self.platform_company_id,
            user_id = %user_id,
            project_id = %project_id,
            "Whop: Creating company"
        );

        let response = self
            .client
            .post(format!("{}/companies", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&req)
            .send()
            .await
            .map_err(|e| {
                error!("Whop API request failed: {}", e);
                format!("Whop API request failed: {}", e)
            })?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|e| format!("Failed to read Whop response: {}", e))?;

        debug!(status = %status, "Whop API response status");

        if !status.is_success() {
            error!(status = %status, body = %body, "Whop API error");
            return Err(format!("Whop API error: {}", body));
        }

        let company = serde_json::from_str::<WhopCompany>(&body).map_err(|e| {
            warn!(error = %e, "Failed to parse Whop response");
            "Failed to parse Whop response".to_string()
        })?;

        info!(company_id = %company.id, "Whop: Company created successfully");

        Ok(company)
    }

    pub async fn create_checkout_configuration(
        &self,
        params: CreateCheckoutParams<'_>,
    ) -> Result<CheckoutConfiguration, String> {
        let is_renewal = params.plan_type == "renewal";

        let plan = if is_renewal {
            CheckoutPlan {
                company_id: params.company_id.to_string(),
                currency: params.currency.to_lowercase(),
                plan_type: params.plan_type.to_string(),
                initial_price: None,
                renewal_price: Some(params.price_amount),
                billing_period: params.billing_period,
                application_fee_amount: params.application_fee_amount,
                product: Some(InlineProduct {
                    title: params.title.to_string(),
                    external_identifier: params.product_id.unwrap_or("unknown").to_string(),
                }),
                title: None,
            }
        } else {
            CheckoutPlan {
                company_id: params.company_id.to_string(),
                currency: params.currency.to_lowercase(),
                plan_type: params.plan_type.to_string(),
                initial_price: Some(params.price_amount),
                renewal_price: None,
                billing_period: None,
                application_fee_amount: params.application_fee_amount,
                product: None,
                title: Some(params.title.to_string()),
            }
        };

        let req = CreateCheckoutConfigurationRequest {
            mode: "payment".to_string(),
            plan,
            redirect_url: params.redirect_url.map(String::from),
            metadata: params.metadata,
        };

        debug!(
            company_id = %params.company_id,
            price_amount = %params.price_amount,
            plan_type = %params.plan_type,
            "Whop: Creating checkout configuration"
        );

        let response = self
            .client
            .post(format!("{}/checkout_configurations", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&req)
            .send()
            .await
            .map_err(|e| {
                error!("Whop checkout API request failed: {}", e);
                format!("Whop API request failed: {}", e)
            })?;

        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|e| format!("Failed to read Whop response: {}", e))?;

        debug!(status = %status, "Whop checkout API response status");

        if !status.is_success() {
            error!(status = %status, body = %body, "Whop checkout API error");
            return Err(format!("Whop API error: {}", body));
        }

        let config = serde_json::from_str::<CheckoutConfiguration>(&body).map_err(|e| {
            warn!(error = %e, body = %body, "Failed to parse Whop checkout response");
            "Failed to parse Whop checkout response".to_string()
        })?;

        info!(checkout_id = %config.id, "Whop: Checkout configuration created");

        Ok(config)
    }
}

/// Whop payment processor implementing PaymentProcessor trait.
/// Handles checkout session creation and webhook verification.
#[derive(Clone)]
pub struct WhopProcessor {
    pub webhook_secret: String,
    pub api_key: String,
    pub platform_company_id: String,
    pub base_url: String,
}

impl WhopProcessor {
    pub fn new(
        webhook_secret: String,
        api_key: String,
        platform_company_id: String,
        base_url: String,
    ) -> Self {
        Self {
            webhook_secret,
            api_key,
            platform_company_id,
            base_url,
        }
    }

    /// Returns the webhook secret as raw bytes.
    ///
    /// # Why raw bytes instead of base64 decode?
    ///
    /// Standard Webhooks v1.0.0 typically expects base64-encoded secrets, but Whop's
    /// implementation has a quirk: their SDK calls `btoa(secret)` before passing it to
    /// the Standard Webhooks library, which then base64-decodes it back. The net effect
    /// is that the HMAC key is the literal string bytes of the entire secret (including
    /// the `ws_` prefix), not any decoded form.
    ///
    /// Empirically verified: hex-decoding, base64-decoding, and prefix-stripping all
    /// produce signature mismatches. Only raw string bytes work correctly.
    fn decode_secret(&self) -> Result<Vec<u8>, String> {
        Ok(self.webhook_secret.as_bytes().to_vec())
    }
}

#[async_trait]
impl PaymentProcessor for WhopProcessor {
    fn name(&self) -> &str {
        "whop"
    }

    async fn create_product(
        &self,
        _req: ProcessorProductRequest,
    ) -> Result<ProcessorProduct, String> {
        Err("Not implemented".to_string())
    }

    async fn create_price(&self, _req: ProcessorPriceRequest) -> Result<ProcessorPrice, String> {
        Err("Not implemented".to_string())
    }

    async fn create_checkout_session(
        &self,
        req: CreateCheckoutSessionRequest,
    ) -> Result<ProcessorCheckout, String> {
        let company_id = req
            .destination_account
            .as_ref()
            .ok_or("Whop checkout requires destination_account (company_id)")?;

        let product_name = req
            .product_name
            .as_ref()
            .ok_or("Whop checkout requires product_name")?;

        let unit_amount = req
            .unit_amount
            .ok_or("Whop checkout requires unit_amount")?;

        // Whop uses "renewal" for subscriptions, "one_time" for payments
        let is_subscription = req.mode == "subscription";
        let plan_type = if is_subscription {
            "renewal"
        } else {
            "one_time"
        };

        let billing_period = if is_subscription {
            req.billing_period_days
        } else {
            None
        };

        // Convert cents to dollars for Whop API
        let price_dollars = unit_amount as f64 / 100.0;
        let fee_dollars = req.application_fee_amount.map(|f| f as f64 / 100.0);

        let whop_client = WhopClient::new(
            self.api_key.clone(),
            self.platform_company_id.clone(),
            self.base_url.clone(),
        )?;

        // Convert HashMap metadata to serde_json::Value
        let metadata = if req.metadata.is_empty() {
            None
        } else {
            Some(serde_json::to_value(&req.metadata).unwrap_or_default())
        };

        let checkout = whop_client
            .create_checkout_configuration(CreateCheckoutParams {
                company_id,
                currency: "usd",
                price_amount: price_dollars,
                plan_type,
                billing_period,
                application_fee_amount: fee_dollars,
                redirect_url: Some(&req.success_url),
                title: product_name,
                metadata,
                product_id: req.product_id.as_deref(),
            })
            .await?;

        Ok(ProcessorCheckout {
            id: checkout.id,
            url: Some(checkout.purchase_url),
            status: "open".to_string(),
            customer: None,
        })
    }

    /// Verifies Whop webhook signature using Standard Webhooks v1.0.0 spec.
    /// Signature param format: "{webhook-id};{webhook-timestamp};{webhook-signature}"
    fn verify_webhook(&self, payload: &[u8], signature: &str) -> Result<bool, String> {
        // Parse combined signature header: "id;timestamp;signatures"
        let parts: Vec<&str> = signature.splitn(3, ';').collect();
        if parts.len() != 3 {
            return Err("Invalid signature format: expected 'id;timestamp;signatures'".to_string());
        }

        let webhook_id = parts[0];
        let timestamp_str = parts[1];
        let signatures_header = parts[2];

        tracing::debug!(
            webhook_id = %webhook_id,
            timestamp = %timestamp_str,
            "Whop webhook: parsed headers"
        );

        let timestamp: u64 = timestamp_str
            .parse()
            .map_err(|e| format!("Invalid timestamp: {}", e))?;

        // Check timestamp is within 5 minute tolerance (300 seconds)
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map_err(|e| format!("Failed to get current time: {}", e))?
            .as_secs();

        const TOLERANCE_SECS: u64 = 300;
        if timestamp > now + TOLERANCE_SECS || timestamp < now.saturating_sub(TOLERANCE_SECS) {
            return Err(format!(
                "Timestamp {} is outside tolerance range (now: {}, tolerance: {}s)",
                timestamp, now, TOLERANCE_SECS
            ));
        }

        let secret = self.decode_secret()?;

        // Signed content: "{webhook-id}.{webhook-timestamp}.{raw_body}"
        let mut signed_payload =
            Vec::with_capacity(webhook_id.len() + timestamp_str.len() + payload.len() + 2);
        signed_payload.extend_from_slice(webhook_id.as_bytes());
        signed_payload.push(b'.');
        signed_payload.extend_from_slice(timestamp_str.as_bytes());
        signed_payload.push(b'.');
        signed_payload.extend_from_slice(payload);

        let mut mac = HmacSha256::new_from_slice(&secret)
            .map_err(|e| format!("Failed to create HMAC: {}", e))?;
        mac.update(&signed_payload);
        let expected_signature = BASE64.encode(mac.finalize().into_bytes());

        // Signature header format: "v1,{base64_sig}" (may have multiple space-separated)
        let expected_bytes = expected_signature.as_bytes();
        let is_valid = signatures_header.split(' ').any(|sig_entry| {
            let Some(sig) = sig_entry.strip_prefix("v1,") else {
                return false;
            };
            let sig_bytes = sig.as_bytes();
            if sig_bytes.len() != expected_bytes.len() {
                return false;
            }
            sig_bytes.ct_eq(expected_bytes).into()
        });

        tracing::debug!(
            webhook_id = %webhook_id,
            timestamp = %timestamp_str,
            valid = %is_valid,
            "Whop webhook: signature verification complete"
        );

        Ok(is_valid)
    }

    fn parse_webhook_event(&self, payload: &serde_json::Value) -> Result<NormalizedEvent, String> {
        let event_type = payload
            .get("type")
            .and_then(|v| v.as_str())
            .ok_or("Missing event type")?;

        let data = payload.get("data").ok_or("Missing data in payload")?;

        match event_type {
            "payment.succeeded" => {
                let payment_id = data
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing payment_id")?;
                // Whop sends `total` in dollars - convert to cents safely
                let amount = if let Some(total) = data.get("total") {
                    if let Some(n) = total.as_f64() {
                        // Use string intermediary to avoid float precision issues
                        let cents_str = format!("{:.0}", n * 100.0);
                        cents_str.parse::<i64>().unwrap_or(0)
                    } else if let Some(s) = total.as_str() {
                        // Parse string amount
                        s.parse::<f64>()
                            .map(|n| format!("{:.0}", n * 100.0).parse::<i64>().unwrap_or(0))
                            .unwrap_or(0)
                    } else {
                        0
                    }
                } else {
                    0
                };
                let currency = data
                    .get("currency")
                    .and_then(|v| v.as_str())
                    .unwrap_or("usd")
                    .to_string();

                Ok(NormalizedEvent::PaymentSucceeded {
                    payment_id: payment_id.to_string(),
                    amount,
                    currency,
                    account_id: None,
                })
            }
            "membership.activated" => {
                let membership_id = data
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing membership id")?
                    .to_string();
                let status = data
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("active")
                    .to_string();
                let user_id = data
                    .get("user")
                    .and_then(|u| u.get("id"))
                    .and_then(|v| v.as_str())
                    .ok_or("Missing user.id")?
                    .to_string();
                let plan_id = data
                    .get("plan")
                    .and_then(|p| p.get("id"))
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let product_id = data
                    .get("product")
                    .and_then(|p| p.get("id"))
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let renewal_period_start = data
                    .get("renewal_period_start")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let renewal_period_end = data
                    .get("renewal_period_end")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let cancel_at_period_end = data
                    .get("cancel_at_period_end")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let session_id = data
                    .get("metadata")
                    .and_then(|m| m.get("session_id"))
                    .and_then(|v| v.as_str())
                    .map(String::from);

                Ok(NormalizedEvent::MembershipActivated {
                    membership_id,
                    status,
                    user_id,
                    plan_id,
                    product_id,
                    renewal_period_start,
                    renewal_period_end,
                    cancel_at_period_end,
                    session_id,
                })
            }
            "membership.deactivated" => {
                let membership_id = data
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing membership id")?
                    .to_string();
                let status = data
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("canceled")
                    .to_string();
                let canceled_at = data
                    .get("canceled_at")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let session_id = data
                    .get("metadata")
                    .and_then(|m| m.get("session_id"))
                    .and_then(|v| v.as_str())
                    .map(String::from);

                Ok(NormalizedEvent::MembershipDeactivated {
                    membership_id,
                    status,
                    canceled_at,
                    session_id,
                })
            }
            "membership.cancel_at_period_end_changed" => {
                let membership_id = data
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing membership id")?
                    .to_string();
                let cancel_at_period_end = data
                    .get("cancel_at_period_end")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let session_id = data
                    .get("metadata")
                    .and_then(|m| m.get("session_id"))
                    .and_then(|v| v.as_str())
                    .map(String::from);

                Ok(NormalizedEvent::MembershipCancelAtPeriodEndChanged {
                    membership_id,
                    cancel_at_period_end,
                    session_id,
                })
            }
            "refund.created" | "refund.updated" => {
                let refund_id = data
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing refund_id")?
                    .to_string();
                // Whop sends `total` in dollars - convert to cents
                let amount = if let Some(total) = data.get("total") {
                    if let Some(n) = total.as_f64() {
                        let cents_str = format!("{:.0}", n * 100.0);
                        cents_str.parse::<i64>().unwrap_or(0)
                    } else if let Some(s) = total.as_str() {
                        s.parse::<f64>()
                            .map(|n| format!("{:.0}", n * 100.0).parse::<i64>().unwrap_or(0))
                            .unwrap_or(0)
                    } else {
                        0
                    }
                } else {
                    0
                };
                let currency = data
                    .get("currency")
                    .and_then(|v| v.as_str())
                    .unwrap_or("usd")
                    .to_string();
                let status_str = data
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("pending");
                let status = RefundStatus::try_from(status_str).unwrap_or(RefundStatus::Pending);
                let charge_id = data
                    .get("payment")
                    .and_then(|p| p.get("id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let reason = data
                    .get("reason")
                    .and_then(|v| v.as_str())
                    .map(String::from);

                Ok(NormalizedEvent::ChargeRefunded {
                    charge_id,
                    refund_id,
                    amount,
                    currency,
                    status,
                    reason,
                    customer_id: None,
                })
            }
            "dispute.created" => {
                let dispute_id = data
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing dispute_id")?
                    .to_string();
                let charge_id = data
                    .get("payment")
                    .and_then(|p| p.get("id"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                Ok(NormalizedEvent::DisputeCreated {
                    dispute_id,
                    charge_id,
                })
            }
            "dispute.updated" => {
                let dispute_id = data
                    .get("id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing dispute_id")?
                    .to_string();
                let status_str = data
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("closed");
                let status = match status_str {
                    "won" => DisputeStatus::Won,
                    "lost" => DisputeStatus::Lost,
                    _ => DisputeStatus::Closed,
                };

                Ok(NormalizedEvent::DisputeClosed { dispute_id, status })
            }
            _ => Ok(NormalizedEvent::Unknown {
                event_type: event_type.to_string(),
            }),
        }
    }
}
