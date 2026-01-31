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
    CreateCheckoutSessionRequest, NormalizedEvent, ProcessorCheckout, ProcessorPrice,
    ProcessorPriceRequest, ProcessorProduct, ProcessorProductRequest,
};

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Serialize)]
struct CheckoutPlan {
    company_id: String,
    currency: String,
    initial_price: f64,
    plan_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    application_fee_amount: Option<f64>,
    title: String,
}

#[derive(Debug, Serialize)]
struct CreateCheckoutConfigurationRequest {
    mode: String,
    plan: CheckoutPlan,
    #[serde(skip_serializing_if = "Option::is_none")]
    redirect_url: Option<String>,
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
    pub application_fee_amount: Option<f64>,
    pub redirect_url: Option<&'a str>,
    pub title: &'a str,
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
        let req = CreateCheckoutConfigurationRequest {
            mode: "payment".to_string(),
            plan: CheckoutPlan {
                company_id: params.company_id.to_string(),
                currency: params.currency.to_lowercase(),
                initial_price: params.price_amount,
                plan_type: params.plan_type.to_string(),
                application_fee_amount: params.application_fee_amount,
                title: params.title.to_string(),
            },
            redirect_url: params.redirect_url.map(String::from),
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

/// Whop webhook processor implementing PaymentProcessor trait.
/// Uses Standard Webhooks v1.0.0 spec for signature verification.
#[derive(Clone)]
pub struct WhopProcessor {
    pub webhook_secret: String,
}

impl WhopProcessor {
    pub fn new(webhook_secret: String) -> Self {
        Self { webhook_secret }
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
        _req: CreateCheckoutSessionRequest,
    ) -> Result<ProcessorCheckout, String> {
        Err("Not implemented".to_string())
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
        let signed_payload = format!(
            "{}.{}.{}",
            webhook_id,
            timestamp_str,
            String::from_utf8_lossy(payload)
        );

        let mut mac = HmacSha256::new_from_slice(&secret)
            .map_err(|e| format!("Failed to create HMAC: {}", e))?;
        mac.update(signed_payload.as_bytes());
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
                let amount = data.get("amount").and_then(|v| v.as_i64()).unwrap_or(0);
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
            _ => Ok(NormalizedEvent::Unknown {
                event_type: event_type.to_string(),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_checkout_configuration_real() {
        dotenvy::dotenv().ok();

        let api_key = match std::env::var("WHOP_API_KEY") {
            Ok(key) => key,
            Err(_) => {
                eprintln!("Skipping test: WHOP_API_KEY not set");
                return;
            }
        };

        let platform_company_id = match std::env::var("WHOP_PLATFORM_COMPANY_ID") {
            Ok(id) => id,
            Err(_) => {
                eprintln!("Skipping test: WHOP_PLATFORM_COMPANY_ID not set");
                return;
            }
        };

        let base_url = std::env::var("WHOP_BASE_URL")
            .unwrap_or_else(|_| "https://sandbox-api.whop.com/api/v1".to_string());

        let client = WhopClient::new(api_key, platform_company_id.clone(), base_url)
            .expect("Failed to create WhopClient");

        let params = CreateCheckoutParams {
            company_id: &platform_company_id,
            currency: "USD",
            price_amount: 1.00,
            plan_type: "one_time",
            application_fee_amount: None,
            redirect_url: Some("https://example.com/success"),
            title: "Test Checkout",
        };

        let result = client.create_checkout_configuration(params).await;
        assert!(result.is_ok(), "API call failed: {:?}", result.err());

        let config = result.unwrap();
        assert!(!config.id.is_empty(), "Expected non-empty checkout id");
        assert!(
            !config.purchase_url.is_empty(),
            "Expected non-empty purchase_url"
        );

        println!("\n\n🔗 Checkout URL: {}\n", config.purchase_url);
    }
}
