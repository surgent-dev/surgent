mod common;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use sqlx::PgPool;
use tower::Service;
use uuid::Uuid;

use common::{
    ProductPriceDetails, TestAppExt, create_test_state, read_body, read_body_text,
    seed_organization,
};
use surpay::api::create_router;

type TestResult = Result<(), Box<dyn std::error::Error>>;

#[sqlx::test(migrations = "./migrations")]
async fn test_list_products_with_prices_success(pool: PgPool) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let (_product_id, product_group_id) = app.create_product(&api_key, project_id).await;
    let _price_id = app
        .create_product_price(&api_key, project_id, product_group_id)
        .await;

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/product/prices", project_id))
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_body(response.into_body()).await;
    let products = body.as_array().expect("Expected array response");
    assert_eq!(products.len(), 1);

    let first = &products[0];
    assert!(first.get("product").is_some());
    assert!(first.get("prices").is_some());

    let prices = first["prices"].as_array().expect("prices should be array");
    assert_eq!(prices.len(), 1);
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_products_with_prices_empty_when_no_products(pool: PgPool) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/product/prices", project_id))
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_body(response.into_body()).await;
    let products = body.as_array().expect("Expected array response");
    assert!(products.is_empty());
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_products_with_prices_returns_only_latest_version(pool: PgPool) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let product_group_id = Uuid::new_v4();

    // Create v1 and v2 of the same product group
    let _v1_product_id = app
        .create_product_with_group(&api_key, project_id, product_group_id)
        .await;
    let v2_product_id = app
        .create_product_with_group(&api_key, project_id, product_group_id)
        .await;

    // Add price only to v2
    let _price_id = app
        .create_product_price(&api_key, project_id, product_group_id)
        .await;

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/product/prices", project_id))
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_body(response.into_body()).await;
    let products = body.as_array().expect("Expected array response");
    assert_eq!(
        products.len(),
        1,
        "Should only return one product (latest version)"
    );

    // Verify it's the v2 product
    let product = &products[0]["product"];
    assert_eq!(product["version"].as_i64(), Some(2));
    assert_eq!(
        product["id"].as_str(),
        Some(v2_product_id.to_string().as_str())
    );
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_products_with_prices_product_without_prices(pool: PgPool) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let _product = app.create_product(&api_key, project_id).await;
    // No prices added

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/product/prices", project_id))
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_body(response.into_body()).await;
    let products = body.as_array().expect("Expected array response");
    assert_eq!(products.len(), 1);

    let prices = products[0]["prices"]
        .as_array()
        .expect("prices should be array");
    assert!(
        prices.is_empty(),
        "Product without prices should have empty prices array"
    );
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_products_with_prices_multiple_prices(pool: PgPool) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let (_product_id, product_group_id) = app.create_product(&api_key, project_id).await;

    // Add multiple prices (with different amounts to avoid idempotency collisions)
    let _price1 = app
        .create_product_price_with_details(
            &api_key,
            ProductPriceDetails {
                project_id,
                product_group_id,
                name: "Price 1",
                price: 1001,
                currency: "USD",
                recurring_interval: None,
            },
        )
        .await;
    let _price2 = app
        .create_product_price_with_details(
            &api_key,
            ProductPriceDetails {
                project_id,
                product_group_id,
                name: "Price 2",
                price: 1002,
                currency: "USD",
                recurring_interval: None,
            },
        )
        .await;
    let _price3 = app
        .create_product_price_with_details(
            &api_key,
            ProductPriceDetails {
                project_id,
                product_group_id,
                name: "Price 3",
                price: 1003,
                currency: "USD",
                recurring_interval: None,
            },
        )
        .await;

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/product/prices", project_id))
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_body(response.into_body()).await;
    let products = body.as_array().expect("Expected array response");
    assert_eq!(products.len(), 1);

    let prices = products[0]["prices"]
        .as_array()
        .expect("prices should be array");
    assert_eq!(prices.len(), 3, "Should have all 3 prices");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_products_with_prices_missing_auth(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);
    let project_id = Uuid::new_v4();

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/product/prices", project_id))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = read_body_text(response.into_body()).await;
    assert_eq!(body, "Missing API key");
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_products_with_prices_invalid_auth(pool: PgPool) -> TestResult {
    let mut app = create_router(create_test_state(pool).await);
    let project_id = Uuid::new_v4();

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/product/prices", project_id))
                .header("Authorization", "Bearer sp_org_invalid_invalidinvalid")
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_products_with_prices_price_values_are_correct(pool: PgPool) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let (_product_id, product_group_id) = app.create_product(&api_key, project_id).await;

    let price_id = app
        .create_product_price_with_details(
            &api_key,
            ProductPriceDetails {
                project_id,
                product_group_id,
                name: "Monthly Plan",
                price: 2999,
                currency: "EUR",
                recurring_interval: Some("month"),
            },
        )
        .await;

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/product/prices", project_id))
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_body(response.into_body()).await;
    let products = body.as_array().expect("Expected array response");
    assert_eq!(products.len(), 1);

    let prices = products[0]["prices"]
        .as_array()
        .expect("prices should be array");
    assert_eq!(prices.len(), 1);

    let price = &prices[0];
    assert_eq!(price["id"].as_str(), Some(price_id.to_string().as_str()));
    assert_eq!(price["name"].as_str(), Some("Monthly Plan"));
    assert_eq!(price["price_amount"].as_i64(), Some(2999));
    assert_eq!(price["price_currency"].as_str(), Some("EUR"));
    assert_eq!(price["recurring_interval"].as_str(), Some("month"));
    assert_eq!(price["is_default"].as_bool(), Some(false));
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_products_with_prices_multiple_prices_with_different_values(
    pool: PgPool,
) -> TestResult {
    let (_org_id, project_id, api_key) = seed_organization(&pool).await;
    let mut app = create_router(create_test_state(pool).await);

    let (_product_id, product_group_id) = app.create_product(&api_key, project_id).await;

    let monthly_id = app
        .create_product_price_with_details(
            &api_key,
            ProductPriceDetails {
                project_id,
                product_group_id,
                name: "Monthly",
                price: 999,
                currency: "USD",
                recurring_interval: Some("month"),
            },
        )
        .await;
    let yearly_id = app
        .create_product_price_with_details(
            &api_key,
            ProductPriceDetails {
                project_id,
                product_group_id,
                name: "Yearly",
                price: 9999,
                currency: "USD",
                recurring_interval: Some("year"),
            },
        )
        .await;

    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/product/prices", project_id))
                .header("Authorization", format!("Bearer {}", api_key))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_body(response.into_body()).await;
    let products = body.as_array().expect("Expected array response");
    let prices = products[0]["prices"]
        .as_array()
        .expect("prices should be array");
    assert_eq!(prices.len(), 2);

    // Find each price by ID and verify values
    let monthly = prices
        .iter()
        .find(|p| p["id"].as_str() == Some(monthly_id.to_string().as_str()))
        .expect("Monthly price not found");
    assert_eq!(monthly["name"].as_str(), Some("Monthly"));
    assert_eq!(monthly["price_amount"].as_i64(), Some(999));
    assert_eq!(monthly["recurring_interval"].as_str(), Some("month"));

    let yearly = prices
        .iter()
        .find(|p| p["id"].as_str() == Some(yearly_id.to_string().as_str()))
        .expect("Yearly price not found");
    assert_eq!(yearly["name"].as_str(), Some("Yearly"));
    assert_eq!(yearly["price_amount"].as_i64(), Some(9999));
    assert_eq!(yearly["recurring_interval"].as_str(), Some("year"));
    Ok(())
}

#[sqlx::test(migrations = "./migrations")]
async fn test_list_products_with_prices_organization_isolation(pool: PgPool) -> TestResult {
    // Create two organizations with their own products
    let (_org1_id, project1_id, api_key1) = seed_organization(&pool).await;
    let (_org2_id, project2_id, api_key2) = seed_organization(&pool).await;

    let mut app = create_router(create_test_state(pool).await);

    let (product1_id, product_group1) = app.create_product(&api_key1, project1_id).await;
    let (_product2_id, product_group2) = app.create_product(&api_key2, project2_id).await;

    let _price1 = app
        .create_product_price(&api_key1, project1_id, product_group1)
        .await;
    let _price2 = app
        .create_product_price(&api_key2, project2_id, product_group2)
        .await;

    // Authenticate as org1, should only see org1's products
    let response = app
        .call(
            Request::builder()
                .method("GET")
                .uri(format!("/project/{}/product/prices", project1_id))
                .header("Authorization", format!("Bearer {}", api_key1))
                .body(Body::empty())?,
        )
        .await?;

    assert_eq!(response.status(), StatusCode::OK);

    let body = read_body(response.into_body()).await;
    let products = body.as_array().expect("Expected array response");
    assert_eq!(products.len(), 1, "Should only see org1's product");

    let product_id = products[0]["product"]["id"].as_str();
    assert_eq!(product_id, Some(product1_id.to_string().as_str()));
    Ok(())
}
