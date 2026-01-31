use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{debug, error, info};

pub struct WhopClient {
    client: Client,
    api_key: String,
    platform_company_id: String,
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
    pub fn new(api_key: String, platform_company_id: String) -> Self {
        debug!(
            platform_company_id = %platform_company_id,
            "Creating WhopClient"
        );
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            api_key,
            platform_company_id,
        }
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
        debug!("Whop request body: {:?}", req);

        let response = self
            .client
            .post("https://api.whop.com/api/v1/companies")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&req)
            .send()
            .await
            .map_err(|e| {
                error!("Whop API request failed: {}", e);
                format!("Whop API request failed: {}", e)
            })?;

        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        debug!(status = %status, "Whop API response status");
        debug!("Whop API response body: {}", body);

        if !status.is_success() {
            error!(
                status = %status,
                body = %body,
                "Whop API error"
            );
            return Err(format!("Whop API error {}: {}", status, body));
        }

        info!("Whop: Company created successfully");

        serde_json::from_str::<WhopCompany>(&body).map_err(|e| {
            error!(
                error = %e,
                body = %body,
                "Failed to parse Whop response"
            );
            format!("Failed to parse Whop response: {} - body: {}", e, body)
        })
    }
}
