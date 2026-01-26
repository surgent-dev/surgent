use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::Redirect,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::AppState;
use crate::core::auth::{AuthenticatedUser, verify_project_access};

#[derive(Debug, Clone)]
pub struct Account {
    pub id: Uuid,
    pub project_id: Uuid,
    pub country: String,
    pub currency: String,
    pub is_payouts_enabled: bool,
    pub processor: String,
    pub processor_account_id: Option<String>,
    pub status: String,
    pub details_submitted: bool,
    pub charges_enabled: bool,
    pub business_type: Option<String>,
    pub data: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ConnectAccountRequest {
    pub project_id: Uuid,
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
        ("project_key" = [])
    )
)]
pub async fn create_connect_account(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Json(req): Json<ConnectAccountRequest>,
) -> Result<Json<OAuthInitResponse>, (StatusCode, String)> {
    tracing::debug!(
        "create_connect_account called for project: {}",
        req.project_id
    );
    verify_project_access(&state.pool, auth.user_id, req.project_id).await?;
    tracing::debug!("project access verified");

    let processor = state
        .registry
        .get_connect(&req.processor)
        .await
        .ok_or_else(|| {
            tracing::error!("Invalid processor: {}", req.processor);
            (StatusCode::BAD_REQUEST, "Invalid processor".to_string())
        })?;
    tracing::debug!("processor found: {}", req.processor);

    // Check for existing account first (before requiring country for new accounts)
    if let Some(existing) = sqlx::query!(
        r#"
        SELECT id, "processorAccountId", data
        FROM connect_account
        WHERE "projectId" = $1 AND processor = $2
        "#,
        req.project_id,
        &req.processor
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Database error checking existing account: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })? {
        tracing::debug!("Found existing account");
        // If account already has a processor_account_id, it's already connected
        if existing.processorAccountId.is_some() {
            return Err((
                StatusCode::CONFLICT,
                "Account already connected".to_string(),
            ));
        }
        // If account is pending, generate a new OAuth URL for retry
        tracing::debug!("Existing account data: {:?}", existing.data);
        let connect_state = existing
            .data
            .get("connect_state")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                tracing::error!("Missing connect_state in account data: {:?}", existing.data);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Missing connect_state".to_string(),
                )
            })?;
        let base = state.config.surpay_base_url.trim_end_matches('/');
        let redirect_uri = format!("{}/accounts/connect/oauth/callback", base);
        let oauth_url = processor.generate_oauth_url(connect_state, &redirect_uri);
        return Ok(Json(OAuthInitResponse {
            account_id: existing.id,
            oauth_url,
        }));
    }

    // Country is only required for new accounts
    let country = req
        .country
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "country is required".to_string()))?;

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

    sqlx::query!(
        r#"
        INSERT INTO connect_account (
            id,
            "projectId",
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
        account_id,
        req.project_id,
        &country,
        &currency,
        false,
        &req.processor,
        None::<String>,
        "pending",
        false,
        false,
        req.business_type,
        account_data
    )
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
    let account = sqlx::query!(
        r#"
        SELECT id, data
        FROM connect_account
        WHERE id = $1
        "#,
        params.account_id
    )
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

    sqlx::query!(
        r#"UPDATE connect_account SET status = 'onboarding_returned' WHERE id = $1"#,
        account.id
    )
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
    let row = sqlx::query!(
        r#"
        SELECT id, processor, "processorAccountId", data
        FROM connect_account
        WHERE id = $1
        "#,
        params.account_id
    )
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

    let Some(ref processor_account_id) = row.processorAccountId else {
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

    let mut new_data = row.data.clone();
    new_data["connect_state"] = serde_json::Value::String(new_state);
    sqlx::query!(
        r#"UPDATE connect_account SET data = $1 WHERE id = $2"#,
        new_data,
        row.id
    )
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let account_link = processor
        .create_account_link(processor_account_id, &refresh_url, &return_url)
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
) -> Result<Redirect, (StatusCode, String)> {
    // Look up account by state in data JSONB
    let row = sqlx::query!(
        r#"
        SELECT id, processor, data, "projectId"
        FROM connect_account
        WHERE data->>'connect_state' = $1
        "#,
        &params.state
    )
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
    let mut data = row.data.clone();
    if let Some(map) = data.as_object_mut() {
        map.remove("connect_state");
    }

    sqlx::query!(
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
        &token_response.processor_account_id,
        "connected",
        data,
        details_submitted,
        charges_enabled,
        payouts_enabled,
        row.id
    )
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let redirect_url = format!(
        "{}/project/{}?stripe_connected=true",
        state.config.web_base_url.trim_end_matches('/'),
        row.projectId
    );
    Ok(Redirect::temporary(&redirect_url))
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
        ("project_key" = [])
    )
)]
pub async fn get_account(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ConnectedAccountResponse>, (StatusCode, String)> {
    let account = sqlx::query!(
        r#"
        SELECT
            id,
            "projectId",
            country,
            currency,
            "isPayoutsEnabled",
            processor,
            "processorAccountId",
            status,
            "detailsSubmitted",
            "chargesEnabled",
            "businessType"
        FROM connect_account
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Account not found".to_string()))?;

    verify_project_access(&state.pool, auth.user_id, account.projectId).await?;

    Ok(Json(ConnectedAccountResponse {
        id: account.id,
        processor: account.processor,
        processor_account_id: account.processorAccountId,
        status: account.status,
        country: account.country,
        currency: account.currency,
        business_type: account.businessType,
        details_submitted: account.detailsSubmitted,
        charges_enabled: account.chargesEnabled,
        payouts_enabled: account.isPayoutsEnabled,
    }))
}

#[derive(Debug, Deserialize)]
pub struct ListAccountsQuery {
    pub project_id: Uuid,
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
        ("project_key" = [])
    )
)]
pub async fn list_accounts(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Query(query): Query<ListAccountsQuery>,
) -> Result<Json<Vec<ConnectedAccountResponse>>, (StatusCode, String)> {
    verify_project_access(&state.pool, auth.user_id, query.project_id).await?;

    let accounts = sqlx::query!(
        r#"
        SELECT
            id,
            country,
            currency,
            "isPayoutsEnabled",
            processor,
            "processorAccountId",
            status,
            "detailsSubmitted",
            "chargesEnabled",
            "businessType"
        FROM connect_account
        WHERE "projectId" = $1
        ORDER BY "createdAt" DESC
        "#,
        query.project_id
    )
    .fetch_all(&state.pool)
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
            processor_account_id: acc.processorAccountId,
            status: acc.status,
            country: acc.country,
            currency: acc.currency,
            business_type: acc.businessType,
            details_submitted: acc.detailsSubmitted,
            charges_enabled: acc.chargesEnabled,
            payouts_enabled: acc.isPayoutsEnabled,
        })
        .collect();

    Ok(Json(response))
}
