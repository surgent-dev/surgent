use std::collections::HashMap;

use axum::{Json, extract::State, http::StatusCode};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::AuthenticatedOrganization;
use crate::integrations::types::ProcessorPriceRequest;
use crate::types::RecurringInterval;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateProductPriceRequest {
    pub project_id: Uuid,
    pub product_group_id: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_default: Option<bool>,
    pub price: i32,
    pub price_currency: String,
    pub recurring_interval: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreateProductPriceResponse {
    pub product_price_id: Uuid,
}

/// Create a new product price
#[utoipa::path(
    post,
    path = "/product/price",
    tag = "product",
    request_body = CreateProductPriceRequest,
    responses(
        (status = 201, description = "Product price created", body = CreateProductPriceResponse),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 403, description = "Forbidden - product not owned by organization"),
        (status = 400, description = "Bad request - invalid product or other error"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("org_key" = [])
    )
)]
pub async fn create_product_price(
    State(state): State<crate::AppState>,
    AuthenticatedOrganization { organization: org }: AuthenticatedOrganization,
    Json(req): Json<CreateProductPriceRequest>,
) -> Result<(StatusCode, Json<CreateProductPriceResponse>), (StatusCode, String)> {
    let pool = &state.pool;
    let product = sqlx::query!(
        r#"
        SELECT p.id, p.processor_product_id
        FROM product p
        INNER JOIN project proj ON p.project_id = proj.id
        WHERE p.product_group_id = $1
          AND proj.id = $2
          AND proj.organization_id = $3
        ORDER BY p.version DESC NULLS LAST
        LIMIT 1
        "#,
        req.product_group_id,
        req.project_id,
        org.id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "Database error during product lookup");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let product = match product {
        Some(p) => p,
        None => {
            tracing::warn!(
                product_group_id = %req.product_group_id,
                project_id = %req.project_id,
                "Product not found or access denied"
            );
            return Err((StatusCode::FORBIDDEN, "Invalid product".to_string()));
        }
    };

    let processor_product_id = match product.processor_product_id {
        Some(id) => id,
        None => {
            tracing::error!(
                product_id = %product.id,
                "Product not synced to payment processor"
            );
            return Err((
                StatusCode::BAD_REQUEST,
                "Product not synced to payment processor".to_string(),
            ));
        }
    };

    let product_price_id = Uuid::new_v4();
    let normalized_recurring_interval = req.recurring_interval.as_ref().filter(|s| !s.is_empty());

    let processor = state.registry.get("stripe").await.ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Payment processor not available".to_string(),
    ))?;

    let processor_req = ProcessorPriceRequest {
        product: processor_product_id,
        currency: req.price_currency.to_lowercase(),
        unit_amount: req.price,
        recurring_interval: normalized_recurring_interval.cloned(),
        metadata: HashMap::from([
            ("surpay_price_id".to_string(), product_price_id.to_string()),
            ("org_id".to_string(), org.id.to_string()),
            (
                "product_group_id".to_string(),
                req.product_group_id.to_string(),
            ),
            ("price".to_string(), req.price.to_string()),
            ("currency".to_string(), req.price_currency.clone()),
            (
                "interval".to_string(),
                normalized_recurring_interval
                    .map(|s| s.as_str())
                    .unwrap_or("one_time")
                    .to_string(),
            ),
        ]),
    };

    let processor_price = processor.create_price(processor_req).await.map_err(|e| {
        tracing::error!(
            product_id = %product.id,
            error = %e,
            "Failed to create processor price"
        );
        (StatusCode::BAD_GATEWAY, e)
    })?;

    let recurring_interval = req
        .recurring_interval
        .as_deref()
        .and_then(|s| RecurringInterval::try_from(s).ok());

    sqlx::query!(
        r#"
        INSERT INTO product_price (
            id,
            product_id,
            name,
            description,
            price_amount,
            price_currency,
            recurring_interval,
            is_default,
            processor_price_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
        product_price_id,
        product.id,
        req.name,
        req.description,
        req.price,
        &req.price_currency,
        recurring_interval as Option<RecurringInterval>,
        req.is_default.unwrap_or(false),
        processor_price.id.as_str()
    )
    .execute(pool)
    .await
    .map_err(|e| {
        tracing::error!(
            product_price_id = %product_price_id,
            error = %e,
            "Database error during product_price insert"
        );
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok((
        StatusCode::CREATED,
        Json(CreateProductPriceResponse { product_price_id }),
    ))
}
