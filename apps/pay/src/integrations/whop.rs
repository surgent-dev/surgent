use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info, warn};

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
