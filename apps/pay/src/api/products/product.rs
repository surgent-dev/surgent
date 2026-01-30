use std::collections::HashMap;

use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::{
    AuthenticatedUser, ProjectIdQuery, resolve_project_id, verify_project_access,
};
use crate::integrations::types::ProcessorProductRequest;
use crate::types::RecurringInterval;

#[derive(Debug, Clone, Serialize, FromRow, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: Uuid,
    #[sqlx(rename = "productGroup")]
    #[serde(rename = "productGroup")]
    pub product_group: String,
    pub name: String,
    pub description: Option<String>,
    #[sqlx(rename = "projectId")]
    pub project_id: Uuid,
    pub slug: String,
    pub version: Option<i32>,
    #[sqlx(rename = "isArchived")]
    pub is_archived: Option<bool>,
    #[sqlx(rename = "isDefault")]
    pub is_default: Option<bool>,
    #[sqlx(rename = "processorProductId")]
    pub processor_product_id: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateProductRequest {
    #[serde(rename = "productGroup")]
    pub product_group: String,
    pub name: String,
    pub description: Option<String>,
    pub is_default: Option<bool>,
    pub slug: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateProductResponse {
    pub product_id: Uuid,
    pub product_group: String,
    pub version: i32,
}

/// Create a new product
#[utoipa::path(
    post,
    path = "/product",
    tag = "product",
    request_body = CreateProductRequest,
    responses(
        (status = 201, description = "Product created", body = CreateProductResponse),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 403, description = "Forbidden - project not owned by organization"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("project_key" = [])
    )
)]
pub async fn create_product(
    State(state): State<crate::AppState>,
    auth: AuthenticatedUser,
    Query(query): Query<ProjectIdQuery>,
    Json(req): Json<CreateProductRequest>,
) -> Result<(StatusCode, Json<CreateProductResponse>), (StatusCode, String)> {
    let project_id = resolve_project_id(&state.pool, &auth, query.project_id).await?;

    tracing::debug!(
        %project_id,
        product_group = %req.product_group,
        name = %req.name,
        slug = %req.slug,
        "Creating product"
    );

    let pool = &state.pool;

    let product_id = Uuid::new_v4();

    let max_version = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(MAX(version), 0) as "max!"
        FROM product
        WHERE "productGroup" = $1
        "#,
        req.product_group
    )
    .fetch_one(pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let version = max_version + 1;

    let processor = state.registry.get("stripe").await.ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        "Payment processor not available".to_string(),
    ))?;

    let org_id = auth
        .organization_id
        .map(|id| id.to_string())
        .unwrap_or_default();

    let processor_req = ProcessorProductRequest {
        name: req.name.clone(),
        description: req.description.clone(),
        active: true,
        metadata: HashMap::from([
            ("productGroup".to_string(), req.product_group.to_string()),
            ("surpay_product_id".to_string(), product_id.to_string()),
            ("org_id".to_string(), org_id),
            ("slug".to_string(), req.slug.clone()),
            ("version".to_string(), version.to_string()),
        ]),
    };

    let processor_product = processor.create_product(processor_req).await.map_err(|e| {
        tracing::error!(
            %project_id,
            %product_id,
            product_group = %req.product_group,
            product_name = %req.name,
            error = %e,
            "Failed to create processor product"
        );
        (StatusCode::BAD_GATEWAY, e)
    })?;

    sqlx::query!(
        r#"
        INSERT INTO product (
            id,
            "productGroup",
            "projectId",
            name,
            description,
            slug,
            version,
            "isDefault",
            "processorProductId"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
        product_id,
        req.product_group,
        project_id,
        req.name,
        req.description,
        req.slug,
        version,
        req.is_default.unwrap_or(false),
        processor_product.id
    )
    .execute(pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(db_err) = &e
            && db_err.constraint() == Some("product_project_id_slug_key")
        {
            return (
                StatusCode::CONFLICT,
                "Product with this slug already exists in project".to_string(),
            );
        }
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok((
        StatusCode::CREATED,
        Json(CreateProductResponse {
            product_id,
            product_group: req.product_group,
            version,
        }),
    ))
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateProductRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub slug: Option<String>,
    pub is_default: Option<bool>,
    pub is_archived: Option<bool>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProductResponse {
    pub product_id: Uuid,
    pub product_group: String,
    pub version: i32,
}

// Response structs for GET /product/prices
#[derive(Debug, Serialize, ToSchema, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ProductPriceResponse {
    pub id: Uuid,
    pub name: Option<String>,
    pub description: Option<String>,
    #[sqlx(rename = "priceAmount")]
    pub price_amount: i32,
    #[sqlx(rename = "priceCurrency")]
    pub price_currency: String,
    #[sqlx(rename = "recurringInterval")]
    pub recurring_interval: Option<RecurringInterval>,
    #[sqlx(rename = "isDefault")]
    pub is_default: Option<bool>,
}

// Internal struct for query that includes productId for grouping
#[derive(Debug, FromRow)]
struct ProductPriceRow {
    #[sqlx(rename = "productId")]
    product_id: Uuid,
    id: Uuid,
    name: Option<String>,
    description: Option<String>,
    #[sqlx(rename = "priceAmount")]
    price_amount: i32,
    #[sqlx(rename = "priceCurrency")]
    price_currency: String,
    #[sqlx(rename = "recurringInterval")]
    recurring_interval: Option<RecurringInterval>,
    #[sqlx(rename = "isDefault")]
    is_default: Option<bool>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ProductWithPricesResponse {
    pub product: Product,
    pub prices: Vec<ProductPriceResponse>,
}

/// Update a product
#[utoipa::path(
    put,
    path = "/product/{id}",
    tag = "product",
    params(
        ("id" = Uuid, Path, description = "Product ID")
    ),
    request_body = UpdateProductRequest,
    responses(
        (status = 201, description = "Product updated (new version created)", body = UpdateProductResponse),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 404, description = "Product not found"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("project_key" = [])
    )
)]
pub async fn update_product(
    State(state): State<crate::AppState>,
    auth: AuthenticatedUser,
    Path(product_id): Path<Uuid>,
    Json(req): Json<UpdateProductRequest>,
) -> Result<(StatusCode, Json<UpdateProductResponse>), (StatusCode, String)> {
    let existing = sqlx::query_as!(
        Product,
        r#"
        SELECT p.id, p."productGroup" AS product_group, p.name, p.description,
               p."projectId" AS project_id, p.slug, p.version, p."isArchived" AS is_archived,
               p."isDefault" AS is_default, p."processorProductId" AS processor_product_id
        FROM product p
        WHERE p.id = $1
        "#,
        product_id
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let existing = existing.ok_or((StatusCode::NOT_FOUND, "Product not found".to_string()))?;

    // API key auth: verify the product belongs to the API key's project
    if let Some(api_key_project_id) = auth.project_id {
        if existing.project_id != api_key_project_id {
            return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
        }
    } else {
        // Session auth: verify user membership in the project's organization
        verify_project_access(&state.pool, auth.user_id, existing.project_id).await?;
    }

    let max_version = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(MAX(version), 0) as "max!"
        FROM product
        WHERE "productGroup" = $1
        "#,
        existing.product_group
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let new_version = max_version + 1;
    let new_product_id = Uuid::new_v4();

    // Generate new slug: use provided slug, or append version to existing slug
    let new_slug = req
        .slug
        .unwrap_or_else(|| format!("{}-v{}", existing.slug, new_version));

    sqlx::query!(
        r#"
        INSERT INTO product (
            id, "productGroup", "projectId", name, description,
            slug, version, "isDefault", "isArchived"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
        new_product_id,
        existing.product_group,
        existing.project_id,
        req.name.unwrap_or(existing.name),
        req.description.or(existing.description),
        new_slug,
        new_version,
        req.is_default.or(existing.is_default).unwrap_or(false),
        req.is_archived.or(existing.is_archived).unwrap_or(false)
    )
    .execute(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok((
        StatusCode::CREATED,
        Json(UpdateProductResponse {
            product_id: new_product_id,
            product_group: existing.product_group,
            version: new_version,
        }),
    ))
}

/// List products with prices for a project
#[utoipa::path(
    get,
    path = "/products",
    tag = "product",
    responses(
        (status = 200, description = "List of products with prices", body = Vec<ProductWithPricesResponse>),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("project_key" = [])
    )
)]
pub async fn list_products_with_prices(
    State(state): State<crate::AppState>,
    auth: AuthenticatedUser,
    Query(query): Query<ProjectIdQuery>,
) -> Result<Json<Vec<ProductWithPricesResponse>>, (StatusCode, String)> {
    let project_id = resolve_project_id(&state.pool, &auth, query.project_id).await?;

    tracing::debug!(%project_id, "Listing products with prices");

    // DISTINCT ON gets the latest version per product_group (sorted by version DESC)
    let products = sqlx::query_as!(
        Product,
        r#"
        SELECT DISTINCT ON (p."productGroup")
            p.id, p."productGroup" AS product_group, p.name, p.description,
            p."projectId" AS project_id, p.slug, p.version, p."isArchived" AS is_archived,
            p."isDefault" AS is_default, p."processorProductId" AS processor_product_id
        FROM product p
        WHERE p."projectId" = $1
        ORDER BY p."productGroup", p.version DESC NULLS LAST
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

    if products.is_empty() {
        return Ok(Json(vec![]));
    }

    let product_ids: Vec<Uuid> = products.iter().map(|p| p.id).collect();

    let prices = sqlx::query_as!(
        ProductPriceRow,
        r#"
        SELECT id, "productId" AS product_id, name, description, "priceAmount" AS price_amount,
               "priceCurrency" AS price_currency, "recurringInterval" AS "recurring_interval: RecurringInterval",
               "isDefault" AS is_default
        FROM product_price
        WHERE "productId" = ANY($1)
        "#,
        &product_ids
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let mut prices_by_product: HashMap<Uuid, Vec<ProductPriceResponse>> = HashMap::new();
    for row in prices {
        prices_by_product
            .entry(row.product_id)
            .or_default()
            .push(ProductPriceResponse {
                id: row.id,
                name: row.name,
                description: row.description,
                price_amount: row.price_amount,
                price_currency: row.price_currency,
                recurring_interval: row.recurring_interval,
                is_default: row.is_default,
            });
    }

    let response: Vec<ProductWithPricesResponse> = products
        .into_iter()
        .map(|p| ProductWithPricesResponse {
            prices: prices_by_product.remove(&p.id).unwrap_or_default(),
            product: p,
        })
        .collect();

    tracing::debug!(count = response.len(), "Returning products with prices");

    Ok(Json(response))
}
