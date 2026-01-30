use std::collections::HashMap;

use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::{AuthenticatedUser, ProjectIdQuery, resolve_project_id};
use crate::integrations::types::{ProcessorPriceRequest, ProcessorProductRequest};
use crate::types::RecurringInterval;

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductPriceRequest {
    pub product_group: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub slug: Option<String>,
    pub is_default: Option<bool>,
    pub price: i32,
    pub price_currency: String,
    pub recurring_interval: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
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
        (status = 409, description = "Conflict - price with this slug already exists for product"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("project_key" = [])
    )
)]
pub async fn create_product_price(
    State(state): State<crate::AppState>,
    auth: AuthenticatedUser,
    Query(query): Query<ProjectIdQuery>,
    Json(req): Json<CreateProductPriceRequest>,
) -> Result<(StatusCode, Json<CreateProductPriceResponse>), (StatusCode, String)> {
    let project_id = resolve_project_id(&state.pool, &auth, query.project_id).await?;

    tracing::debug!(?req, %project_id, "Creating product price");

    let pool = &state.pool;
    let product = sqlx::query!(
        r#"
        SELECT p.id, p.name, p.description, p.slug, p."productGroup", p.version, p."processorProductId"
        FROM product p
        WHERE p."productGroup" = $1
          AND p."projectId" = $2
        ORDER BY p.version DESC NULLS LAST
        LIMIT 1
        "#,
        req.product_group,
        project_id
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
                product_group = %req.product_group,
                %project_id,
                "Product not found or access denied"
            );
            return Err((StatusCode::FORBIDDEN, "Invalid product".to_string()));
        }
    };

    let org_id = auth
        .organization_id
        .map(|id| id.to_string())
        .unwrap_or_default();

    let processor_product_id = match product.processorProductId {
        Some(id) => id,
        None => {
            tracing::info!(
                product_id = %product.id,
                product_group = %product.productGroup,
                "Product not synced to payment processor, performing eager sync"
            );

            let processor = state.registry.get("stripe").await.ok_or((
                StatusCode::SERVICE_UNAVAILABLE,
                "Payment processor not available".to_string(),
            ))?;

            let processor_req = ProcessorProductRequest {
                name: product.name.clone(),
                description: product.description.clone(),
                active: true,
                metadata: HashMap::from([
                    ("productGroup".to_string(), product.productGroup.clone()),
                    ("surpay_product_id".to_string(), product.id.to_string()),
                    ("org_id".to_string(), org_id.clone()),
                    ("slug".to_string(), product.slug.clone()),
                    (
                        "version".to_string(),
                        product.version.unwrap_or(1).to_string(),
                    ),
                ]),
            };

            let processor_product = processor.create_product(processor_req).await.map_err(|e| {
                tracing::error!(
                    product_id = %product.id,
                    product_group = %product.productGroup,
                    error = %e,
                    "Failed to create processor product during eager sync"
                );
                (StatusCode::BAD_GATEWAY, e)
            })?;

            sqlx::query!(
                r#"UPDATE product SET "processorProductId" = $1 WHERE id = $2"#,
                &processor_product.id,
                product.id
            )
            .execute(pool)
            .await
            .map_err(|e| {
                tracing::error!(
                    product_id = %product.id,
                    error = %e,
                    "Failed to update product with processorProductId"
                );
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Database error: {}", e),
                )
            })?;

            tracing::info!(
                product_id = %product.id,
                processor_product_id = %processor_product.id,
                "Successfully synced product to payment processor"
            );

            processor_product.id
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
            ("org_id".to_string(), org_id),
            ("productGroup".to_string(), req.product_group.to_string()),
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
            "productId",
            name,
            description,
            slug,
            "priceAmount",
            "priceCurrency",
            "recurringInterval",
            "isDefault",
            "processorPriceId"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        "#,
        product_price_id,
        product.id,
        req.name,
        req.description,
        req.slug,
        req.price,
        &req.price_currency,
        recurring_interval as Option<RecurringInterval>,
        req.is_default.unwrap_or(false),
        processor_price.id.as_str()
    )
    .execute(pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(db_err) = &e
            && db_err.constraint() == Some("ix_product_price_product_id_slug")
        {
            return (
                StatusCode::CONFLICT,
                "Price with this slug already exists for product".to_string(),
            );
        }
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
