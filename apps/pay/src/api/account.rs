use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::Redirect,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::AppState;
use crate::core::auth::AuthenticatedOrganization;

#[derive(Debug, Clone, FromRow)]
pub struct Account {
    pub id: Uuid,
    #[sqlx(rename = "organizationId")]
    pub organization_id: Uuid,
    pub country: String,
    pub currency: String,
    #[sqlx(rename = "isPayoutsEnabled")]
    pub is_payouts_enabled: bool,
    pub processor: String,
    #[sqlx(rename = "processorAccountId")]
    pub processor_account_id: Option<String>,
    pub status: String,
    #[sqlx(rename = "detailsSubmitted")]
    pub details_submitted: bool,
    #[sqlx(rename = "chargesEnabled")]
    pub charges_enabled: bool,
    #[sqlx(rename = "businessType")]
    pub business_type: Option<String>,
    pub data: serde_json::Value,
    #[sqlx(rename = "createdAt")]
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    #[sqlx(rename = "updatedAt")]
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ConnectAccountRequest {
    pub processor: String,
    pub account_type: Option<String>,
    pub country: Option<String>,
    pub email: Option<String>,
    pub business_type: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ConnectAccountResponse {
    pub account_id: Uuid,
    pub processor_account_id: String,
    pub onboarding_url: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OAuthInitResponse {
    pub account_id: Uuid,
    pub oauth_url: String,
}

#[derive(Debug, Deserialize)]
pub struct OAuthCallbackParams {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OAuthCallbackResponse {
    pub account_id: Uuid,
    pub processor_account_id: String,
}

#[derive(Debug, Deserialize)]
pub struct CallbackParams {
    pub account_id: Uuid,
    pub state: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ConnectedAccountResponse {
    pub id: Uuid,
    pub processor: String,
    pub processor_account_id: Option<String>,
    pub status: String,
    pub country: String,
    pub currency: String,
    pub business_type: Option<String>,
    pub details_submitted: bool,
    pub charges_enabled: bool,
    pub payouts_enabled: bool,
}

/// Create a new connect account
#[utoipa::path(
    post,
    path = "/accounts/connect",
    tag = "account",
    request_body = ConnectAccountRequest,
    responses(
        (status = 200, description = "Connect account created", body = OAuthInitResponse),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 400, description = "Invalid request"),
        (status = 409, description = "Conflict - account already connected"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("org_key" = [])
    )
)]
pub async fn create_connect_account(
    State(state): State<AppState>,
    AuthenticatedOrganization {
        organization: org, ..
    }: AuthenticatedOrganization,
    Json(req): Json<ConnectAccountRequest>,
) -> Result<Json<OAuthInitResponse>, (StatusCode, String)> {
    let processor = state
        .registry
        .get_connect(&req.processor)
        .await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Invalid processor".to_string()))?;

    let country = req
        .country
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "country is required".to_string()))?;

    // One account per org+processor (enforced by DB). If it already exists, return an error.
    #[derive(Debug, FromRow)]
    struct ExistingAccountRow {
        pub id: Uuid,
        pub processor_account_id: Option<String>,
    }

    if let Some(existing) = sqlx::query_as::<_, ExistingAccountRow>(
        r#"
        SELECT id, "processorAccountId", status
        FROM connect_account
        WHERE "organizationId" = $1 AND processor = $2
        "#,
    )
    .bind(org.id)
    .bind(&req.processor)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })? {
        // If account already has a processor_account_id, it's already connected
        if existing.processor_account_id.is_some() {
            return Err((
                StatusCode::CONFLICT,
                "Account already connected".to_string(),
            ));
        }
        // If account is pending, return the same account for retry
        return Ok(Json(OAuthInitResponse {
            account_id: existing.id,
            oauth_url: String::new(), // Caller should handle retry logic
        }));
    }

    // Create pending account for OAuth flow
    let account_id = Uuid::new_v4();
    let connect_state = Uuid::new_v4().to_string();
    let currency = match country.to_lowercase().as_str() {
        "us" => "usd".to_string(),
        "gb" => "gbp".to_string(),
        "eu" => "eur".to_string(),
        _ => "usd".to_string(),
    };

    let mut account_data = serde_json::json!({});
    account_data["connect_state"] = serde_json::Value::String(connect_state.clone());

    sqlx::query(
        r#"
        INSERT INTO connect_account (
            id,
            "organizationId",
            country,
            currency,
            "isPayoutsEnabled",
            processor,
            "processorAccountId",
            status,
            "detailsSubmitted",
            "chargesEnabled",
            "businessType",
            data
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        "#,
    )
    .bind(account_id)
    .bind(org.id)
    .bind(&country)
    .bind(&currency)
    .bind(false)
    .bind(&req.processor)
    .bind(None::<String>) // processor_account_id initially NULL
    .bind("pending")
    .bind(false)
    .bind(false)
    .bind(req.business_type)
    .bind(account_data)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    // Generate OAuth URL
    let base = state.config.surpay_base_url.trim_end_matches('/');
    let redirect_uri = format!("{}/accounts/connect/oauth/callback", base);
    let oauth_url = processor.generate_oauth_url(&connect_state, &redirect_uri);

    Ok(Json(OAuthInitResponse {
        account_id,
        oauth_url,
    }))
}

pub async fn connect_callback(
    State(pool): State<PgPool>,
    Query(params): Query<CallbackParams>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let account = sqlx::query_as::<_, Account>(
        r#"
        SELECT
            id,
            "organizationId",
            country,
            currency,
            "isPayoutsEnabled",
            processor,
            "processorAccountId",
            status,
            "detailsSubmitted",
            "chargesEnabled",
            "businessType",
            data,
            "createdAt",
            "updatedAt"
        FROM connect_account
        WHERE id = $1
        "#,
    )
    .bind(params.account_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Account not found".to_string()))?;

    let expected_state = account
        .data
        .get("connect_state")
        .and_then(|v| v.as_str())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Missing connect_state".to_string()))?;
    if expected_state != params.state {
        return Err((StatusCode::BAD_REQUEST, "Invalid state".to_string()));
    }

    sqlx::query("UPDATE connect_account SET status = 'onboarding_returned' WHERE id = $1")
        .bind(account.id)
        .execute(&pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            )
        })?;

    Ok(Json(serde_json::json!({
        "account_id": account.id,
        "status": "success",
        "message": "Account callback received"
    })))
}

pub async fn connect_refresh(
    State(state): State<AppState>,
    Query(params): Query<CallbackParams>,
) -> Result<Redirect, (StatusCode, String)> {
    #[derive(Debug, FromRow)]
    struct RefreshAccountRow {
        pub id: Uuid,
        pub processor: String,
        pub processor_account_id: Option<String>,
        pub data: serde_json::Value,
    }

    let row = sqlx::query_as::<_, RefreshAccountRow>(
        r#"
        SELECT id, processor, "processorAccountId", data
        FROM connect_account
        WHERE id = $1
        "#,
    )
    .bind(params.account_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Account not found".to_string()))?;

    let expected_state = row
        .data
        .get("connect_state")
        .and_then(|v| v.as_str())
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Missing connect_state".to_string()))?;
    if expected_state != params.state {
        return Err((StatusCode::BAD_REQUEST, "Invalid state".to_string()));
    }

    let Some(processor_account_id) = row.processor_account_id else {
        return Err((
            StatusCode::CONFLICT,
            "Account missing processor_account_id".to_string(),
        ));
    };

    let processor = state
        .registry
        .get_connect(&row.processor)
        .await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Invalid processor".to_string()))?;

    let new_state = Uuid::new_v4().to_string();
    let base = state.config.surpay_base_url.trim_end_matches('/');
    let return_url = format!(
        "{}/accounts/connect/callback?account_id={}&state={}",
        base, row.id, new_state
    );
    let refresh_url = format!(
        "{}/accounts/connect/refresh?account_id={}&state={}",
        base, row.id, new_state
    );

    let mut data = row.data;
    data["connect_state"] = serde_json::Value::String(new_state);
    sqlx::query("UPDATE connect_account SET data = $1 WHERE id = $2")
        .bind(data)
        .bind(row.id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            )
        })?;

    let account_link = processor
        .create_account_link(&processor_account_id, &refresh_url, &return_url)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Processor error: {}", e),
            )
        })?;

    Ok(Redirect::temporary(&account_link.url))
}

pub async fn oauth_callback(
    State(state): State<AppState>,
    Query(params): Query<OAuthCallbackParams>,
) -> Result<Json<OAuthCallbackResponse>, (StatusCode, String)> {
    // Look up account by state in data JSONB
    #[derive(Debug, FromRow)]
    struct AccountRow {
        pub id: Uuid,
        pub processor: String,
        pub data: serde_json::Value,
    }

    let row = sqlx::query_as::<_, AccountRow>(
        r#"
        SELECT id, processor, data
        FROM connect_account
        WHERE data->>'connect_state' = $1
        "#,
    )
    .bind(&params.state)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Account not found".to_string()))?;

    let processor = state
        .registry
        .get_connect(&row.processor)
        .await
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Invalid processor".to_string()))?;

    // Exchange OAuth code for processor account ID
    let token_response = processor
        .exchange_oauth_code(&params.code)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Processor error: {}", e),
            )
        })?;

    // Fetch account details from processor
    let account_details = processor
        .get_account(&token_response.processor_account_id)
        .await;

    // If fetch fails, use safe defaults and continue
    let (details_submitted, charges_enabled, payouts_enabled) = match account_details {
        Ok(details) => {
            tracing::info!(
                account_id = %token_response.processor_account_id,
                details_submitted = details.details_submitted,
                charges_enabled = details.charges_enabled,
                "Fetched account details from processor"
            );
            (
                details.details_submitted,
                details.charges_enabled,
                details.payouts_enabled,
            )
        }
        Err(e) => {
            tracing::warn!(
                account_id = %token_response.processor_account_id,
                error = %e,
                "Failed to fetch account details, using defaults"
            );
            (false, false, false)
        }
    };

    // Update account with processor_account_id and status
    let mut data = row.data;
    data.as_object_mut()
        .and_then(|map| map.remove("connect_state"));

    sqlx::query(
        r#"
        UPDATE connect_account
        SET "processorAccountId" = $1,
            status = $2,
            data = $3,
            "detailsSubmitted" = $4,
            "chargesEnabled" = $5,
            "isPayoutsEnabled" = $6
        WHERE id = $7
        "#,
    )
    .bind(&token_response.processor_account_id)
    .bind("connected")
    .bind(data)
    .bind(details_submitted)
    .bind(charges_enabled)
    .bind(payouts_enabled)
    .bind(row.id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok(Json(OAuthCallbackResponse {
        account_id: row.id,
        processor_account_id: token_response.processor_account_id,
    }))
}

/// Get account by ID
#[utoipa::path(
    get,
    path = "/accounts/{id}",
    tag = "account",
    params(
        ("id" = Uuid, Path, description = "Account ID")
    ),
    responses(
        (status = 200, description = "Account details", body = ConnectedAccountResponse),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 403, description = "Forbidden - access denied"),
        (status = 404, description = "Account not found"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("org_key" = [])
    )
)]
pub async fn get_account(
    State(pool): State<PgPool>,
    AuthenticatedOrganization {
        organization: org, ..
    }: AuthenticatedOrganization,
    Path(id): Path<Uuid>,
) -> Result<Json<ConnectedAccountResponse>, (StatusCode, String)> {
    let account = sqlx::query_as::<_, Account>(
        r#"
        SELECT
            id,
            "organizationId",
            country,
            currency,
            "isPayoutsEnabled",
            processor,
            "processorAccountId",
            status,
            "detailsSubmitted",
            "chargesEnabled",
            "businessType",
            data,
            "createdAt",
            "updatedAt"
        FROM connect_account
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Account not found".to_string()))?;

    if account.organization_id != org.id {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    Ok(Json(ConnectedAccountResponse {
        id: account.id,
        processor: account.processor,
        processor_account_id: account.processor_account_id,
        status: account.status,
        country: account.country,
        currency: account.currency,
        business_type: account.business_type,
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.is_payouts_enabled,
    }))
}

/// List all accounts
#[utoipa::path(
    get,
    path = "/accounts",
    tag = "account",
    responses(
        (status = 200, description = "List of accounts", body = Vec<ConnectedAccountResponse>),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("org_key" = [])
    )
)]
pub async fn list_accounts(
    State(pool): State<PgPool>,
    AuthenticatedOrganization {
        organization: org, ..
    }: AuthenticatedOrganization,
) -> Result<Json<Vec<ConnectedAccountResponse>>, (StatusCode, String)> {
    let accounts = sqlx::query_as::<_, Account>(
        r#"
        SELECT
            id,
            "organizationId",
            country,
            currency,
            "isPayoutsEnabled",
            processor,
            "processorAccountId",
            status,
            "detailsSubmitted",
            "chargesEnabled",
            "businessType",
            data,
            "createdAt",
            "updatedAt"
        FROM connect_account
        WHERE "organizationId" = $1
        ORDER BY "createdAt" DESC
        "#,
    )
    .bind(org.id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let response: Vec<ConnectedAccountResponse> = accounts
        .into_iter()
        .map(|acc| ConnectedAccountResponse {
            id: acc.id,
            processor: acc.processor,
            processor_account_id: acc.processor_account_id,
            status: acc.status,
            country: acc.country,
            currency: acc.currency,
            business_type: acc.business_type,
            details_submitted: acc.details_submitted,
            charges_enabled: acc.charges_enabled,
            payouts_enabled: acc.is_payouts_enabled,
        })
        .collect();

    Ok(Json(response))
}
