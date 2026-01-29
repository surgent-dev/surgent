use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::Redirect,
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use sqlx::PgPool;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::AppState;
use crate::core::auth::{
    AuthenticatedUser, ProjectIdQuery, resolve_project_id, verify_project_access,
};

type HmacSha256 = Hmac<Sha256>;

const OAUTH_STATE_MAX_AGE_SECS: i64 = 3600; // 1 hour
const OAUTH_STATE_MAX_LEN: usize = 2048;

// ============================================================================
// Helper types and functions
// ============================================================================

/// Common account fields fetched from the database.
struct AccountRow {
    id: Uuid,
    project_id: Option<Uuid>,
    processor: String,
    processor_account_id: Option<String>,
    status: String,
    country: String,
    currency: String,
    business_type: Option<String>,
    details_submitted: bool,
    charges_enabled: bool,
    payouts_enabled: bool,
}

impl From<AccountRow> for ConnectedAccountResponse {
    fn from(row: AccountRow) -> Self {
        ConnectedAccountResponse {
            id: row.id,
            processor: row.processor,
            processor_account_id: row.processor_account_id,
            status: row.status,
            country: row.country,
            currency: row.currency,
            business_type: row.business_type,
            details_submitted: row.details_submitted,
            charges_enabled: row.charges_enabled,
            payouts_enabled: row.payouts_enabled,
        }
    }
}

/// Fetches an account by ID, returning 404 if not found or 500 on db error.
async fn fetch_account_by_id(pool: &PgPool, id: Uuid) -> Result<AccountRow, (StatusCode, String)> {
    sqlx::query!(
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
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?
    .map(|row| AccountRow {
        id: row.id,
        project_id: row.projectId,
        processor: row.processor,
        processor_account_id: row.processorAccountId,
        status: row.status,
        country: row.country,
        currency: row.currency,
        business_type: row.businessType,
        details_submitted: row.detailsSubmitted,
        charges_enabled: row.chargesEnabled,
        payouts_enabled: row.isPayoutsEnabled,
    })
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Account not found".to_string()))
}

/// Verifies the caller has access to the given project.
/// - API key auth: checks project_id matches auth.project_id
/// - Session auth: checks user membership via verify_project_access
async fn verify_account_project_access(
    auth: &AuthenticatedUser,
    pool: &PgPool,
    account_project_id: Uuid,
) -> Result<(), (StatusCode, String)> {
    if let Some(api_key_project_id) = auth.project_id {
        if account_project_id != api_key_project_id {
            return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
        }
    } else {
        verify_project_access(pool, auth.user_id, account_project_id).await?;
    }
    Ok(())
}

// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
struct OAuthStatePayload {
    project_id: Uuid,
    processor: String,
    country: String,
    business_type: Option<String>,
    ts: i64,
    nonce: String,
    // user_id is included for audit/logging purposes. The actual user authentication
    // is handled by the OAuth provider (e.g., Stripe) during the OAuth flow.
    // We cannot verify this in oauth_callback since it's a redirect without auth headers.
    user_id: Uuid,
}

fn sign_oauth_state(
    payload: &OAuthStatePayload,
    secret: &str,
) -> Result<String, (StatusCode, String)> {
    let json = serde_json::to_string(payload).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to serialize oauth state: {}", e),
        )
    })?;
    let payload_b64 = URL_SAFE_NO_PAD.encode(json.as_bytes());

    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to create HMAC: {}", e),
        )
    })?;
    mac.update(payload_b64.as_bytes());
    let sig_b64 = URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes());

    Ok(format!("{}:{}", payload_b64, sig_b64))
}

fn verify_oauth_state(state: &str, secret: &str) -> Option<OAuthStatePayload> {
    if state.len() > OAUTH_STATE_MAX_LEN {
        return None;
    }

    let (payload_b64, sig_b64) = state.rsplit_once(':')?;

    // Decode signature and verify using constant-time comparison
    let sig_bytes = URL_SAFE_NO_PAD.decode(sig_b64).ok()?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(payload_b64.as_bytes());
    mac.verify_slice(&sig_bytes).ok()?;

    // Decode payload
    let json_bytes = URL_SAFE_NO_PAD.decode(payload_b64).ok()?;
    let payload: OAuthStatePayload = serde_json::from_slice(&json_bytes).ok()?;

    // Check expiry (reject future timestamps with small leeway for clock skew)
    let now = chrono::Utc::now().timestamp();
    const CLOCK_SKEW_LEEWAY_SECS: i64 = 60;
    if payload.ts > now + CLOCK_SKEW_LEEWAY_SECS {
        return None; // Future timestamp not allowed
    }
    if now - payload.ts > OAUTH_STATE_MAX_AGE_SECS {
        return None; // Expired
    }

    Some(payload)
}

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
    Query(query): Query<ProjectIdQuery>,
    Json(req): Json<ConnectAccountRequest>,
) -> Result<Json<OAuthInitResponse>, (StatusCode, String)> {
    let project_id = resolve_project_id(&state.pool, &auth, query.project_id).await?;
    tracing::debug!(
        project_id = %project_id,
        processor = %req.processor,
        "create_connect_account request"
    );

    let processor = state
        .registry
        .get_connect(&req.processor)
        .await
        .ok_or_else(|| {
            tracing::error!("Invalid processor: {}", req.processor);
            (StatusCode::BAD_REQUEST, "Invalid processor".to_string())
        })?;
    tracing::debug!("processor found: {}", req.processor);

    // Check if project already has a connected account for this processor
    let existing = sqlx::query!(
        r#"
        SELECT id, "processorAccountId"
        FROM connect_account
        WHERE "projectId" = $1 AND processor = $2
        "#,
        project_id,
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
    })?;

    if let Some(existing) = existing {
        if existing.processorAccountId.is_some() {
            return Err((
                StatusCode::CONFLICT,
                "Account already connected".to_string(),
            ));
        }
    }

    // Country is required
    let country = req
        .country
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "country is required".to_string()))?;

    // Create signed state containing all info needed for callback
    let payload = OAuthStatePayload {
        project_id,
        processor: req.processor.clone(),
        country: country.clone(),
        business_type: req.business_type.clone(),
        ts: chrono::Utc::now().timestamp(),
        nonce: Uuid::new_v4().to_string(),
        user_id: auth.user_id,
    };
    let signed_state = sign_oauth_state(&payload, &state.config.better_auth_secret)?;

    // Generate OAuth URL
    let base = state.config.surpay_base_url.trim_end_matches('/');
    let redirect_uri = format!("{}/accounts/connect/oauth/callback", base);
    let oauth_url = processor.generate_oauth_url(&signed_state, &redirect_uri);

    Ok(Json(OAuthInitResponse { oauth_url }))
}

/// DEPRECATED: Legacy endpoint for old connect flow using connect_state in account data.
/// New accounts use the OAuth flow with signed state tokens instead.
/// Returns 410 GONE for accounts without connect_state.
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
        .ok_or_else(|| (StatusCode::GONE, "Legacy endpoint deprecated".to_string()))?;
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

/// DEPRECATED: Legacy endpoint for old connect flow using connect_state in account data.
/// New accounts use the OAuth flow with signed state tokens instead.
/// Returns 410 GONE for accounts without connect_state.
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
        .ok_or_else(|| (StatusCode::GONE, "Legacy endpoint deprecated".to_string()))?;
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
    // Verify and decode the signed state
    let payload =
        verify_oauth_state(&params.state, &state.config.better_auth_secret).ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                "Invalid or expired state".to_string(),
            )
        })?;

    let processor = state
        .registry
        .get_connect(&payload.processor)
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

    // Check if this processor account already exists
    let existing = sqlx::query!(
        r#"
        SELECT id, "projectId" FROM connect_account
        WHERE processor = $1 AND "processorAccountId" = $2
        "#,
        &payload.processor,
        &token_response.processor_account_id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    if let Some(existing) = existing {
        // Case 1: Existing disconnected account → reconnect to this project
        if existing.projectId.is_none() {
            // Use atomic update with projectId IS NULL check to prevent race conditions
            let result = sqlx::query!(
                r#"UPDATE connect_account SET "projectId" = $1, status = 'connected' WHERE id = $2 AND "projectId" IS NULL"#,
                payload.project_id,
                existing.id
            )
            .execute(&state.pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

            // Another request reconnected this account first
            if result.rows_affected() == 0 {
                let redirect_url = format!(
                    "{}/project/{}?stripe_conflict=true&conflict_account_id={}",
                    state.config.web_base_url.trim_end_matches('/'),
                    payload.project_id,
                    existing.id
                );
                return Ok(Redirect::temporary(&redirect_url));
            }

            let redirect_url = format!(
                "{}/project/{}?stripe_connected=true",
                state.config.web_base_url.trim_end_matches('/'),
                payload.project_id
            );
            return Ok(Redirect::temporary(&redirect_url));
        }

        // Case 2: Existing connected account on SAME project → just redirect success
        if existing.projectId == Some(payload.project_id) {
            let redirect_url = format!(
                "{}/project/{}?stripe_connected=true",
                state.config.web_base_url.trim_end_matches('/'),
                payload.project_id
            );
            return Ok(Redirect::temporary(&redirect_url));
        }

        // Case 3: Existing connected account on DIFFERENT project → conflict
        let redirect_url = format!(
            "{}/project/{}?stripe_conflict=true&conflict_account_id={}",
            state.config.web_base_url.trim_end_matches('/'),
            payload.project_id,
            existing.id
        );
        return Ok(Redirect::temporary(&redirect_url));
    }

    // Case 4: No existing account → create new row
    let account_details = processor
        .get_account(&token_response.processor_account_id)
        .await;

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

    let currency = match payload.country.to_lowercase().as_str() {
        "us" => "usd",
        "gb" => "gbp",
        "eu" => "eur",
        _ => "usd",
    };

    let account_id = Uuid::new_v4();
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
        payload.project_id,
        &payload.country,
        currency,
        payouts_enabled,
        &payload.processor,
        &token_response.processor_account_id,
        "connected",
        details_submitted,
        charges_enabled,
        payload.business_type,
        serde_json::json!({})
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
        payload.project_id
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
    let account = fetch_account_by_id(&state.pool, id).await?;

    // Disconnected accounts (projectId = NULL) are not accessible
    let project_id = account
        .project_id
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Account not found".to_string()))?;

    verify_account_project_access(&auth, &state.pool, project_id).await?;

    Ok(Json(account.into()))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ListAccountsQuery {
    pub project_id: Option<Uuid>,
}

/// List all accounts
#[utoipa::path(
    get,
    path = "/accounts",
    tag = "account",
    params(
        ("project_id" = Option<Uuid>, Query, description = "Project ID (required for session auth)")
    ),
    responses(
        (status = 200, description = "List of accounts", body = Vec<ConnectedAccountResponse>),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 403, description = "Forbidden - access denied"),
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
    let project_id = resolve_project_id(&state.pool, &auth, query.project_id).await?;
    tracing::debug!(project_id = %project_id, "list_accounts request");

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
        project_id
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
        .map(|acc| {
            AccountRow {
                id: acc.id,
                project_id: Some(project_id), // list_accounts only returns accounts for a project
                processor: acc.processor,
                processor_account_id: acc.processorAccountId,
                status: acc.status,
                country: acc.country,
                currency: acc.currency,
                business_type: acc.businessType,
                details_submitted: acc.detailsSubmitted,
                charges_enabled: acc.chargesEnabled,
                payouts_enabled: acc.isPayoutsEnabled,
            }
            .into()
        })
        .collect();

    Ok(Json(response))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateAccountRequest {
    pub project_id: Uuid,
}

/// Update account's project
#[utoipa::path(
    patch,
    path = "/accounts/{id}",
    tag = "account",
    params(
        ("id" = Uuid, Path, description = "Account ID")
    ),
    request_body = UpdateAccountRequest,
    responses(
        (status = 200, description = "Account updated", body = ConnectedAccountResponse),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 403, description = "Forbidden - access denied"),
        (status = 404, description = "Account not found"),
        (status = 500, description = "Internal server error")
    ),
    security(("project_key" = []))
)]
pub async fn update_account(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateAccountRequest>,
) -> Result<Json<ConnectedAccountResponse>, (StatusCode, String)> {
    // Fetch current account to verify access to the source project
    let current = fetch_account_by_id(&state.pool, id).await?;

    // Disconnected accounts (projectId = NULL) cannot be moved via this endpoint
    let current_project_id = current
        .project_id
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Account not found".to_string()))?;

    // Verify access to both source and destination projects
    verify_account_project_access(&auth, &state.pool, current_project_id).await?;
    verify_account_project_access(&auth, &state.pool, req.project_id).await?;

    // Move the account to the new project
    let account = sqlx::query!(
        r#"
        UPDATE connect_account
        SET "projectId" = $1
        WHERE id = $2
        RETURNING
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
        "#,
        req.project_id,
        id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(db_err) = &e
            && db_err.constraint() == Some("account_project_processor_key")
        {
            return (
                StatusCode::CONFLICT,
                "Project already has an account with this processor".to_string(),
            );
        }
        tracing::error!(error = %e, account_id = %id, project_id = %req.project_id, "Failed to update account");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?
    .ok_or_else(|| (StatusCode::NOT_FOUND, "Account not found".to_string()))?;

    Ok(Json(
        AccountRow {
            id: account.id,
            project_id: account.projectId,
            processor: account.processor,
            processor_account_id: account.processorAccountId,
            status: account.status,
            country: account.country,
            currency: account.currency,
            business_type: account.businessType,
            details_submitted: account.detailsSubmitted,
            charges_enabled: account.chargesEnabled,
            payouts_enabled: account.isPayoutsEnabled,
        }
        .into(),
    ))
}

/// Delete/disconnect an account
#[utoipa::path(
    delete,
    path = "/accounts/{id}",
    tag = "account",
    params(
        ("id" = Uuid, Path, description = "Account ID")
    ),
    responses(
        (status = 200, description = "Account disconnected"),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 403, description = "Forbidden - access denied"),
        (status = 404, description = "Account not found"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("project_key" = [])
    )
)]
pub async fn disconnect(
    State(state): State<AppState>,
    auth: AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let account = fetch_account_by_id(&state.pool, id).await?;

    // Account already disconnected (projectId is NULL)
    let Some(project_id) = account.project_id else {
        return Ok(StatusCode::OK);
    };

    verify_account_project_access(&auth, &state.pool, project_id).await?;

    sqlx::query!(
        r#"
        UPDATE connect_account
        SET "projectId" = NULL, status = 'disconnected'
        WHERE id = $1
        "#,
        id
    )
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok(StatusCode::OK)
}
