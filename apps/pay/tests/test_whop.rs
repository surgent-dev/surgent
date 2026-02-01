use surpay::integrations::whop::{CreateCheckoutParams, WhopClient};

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
        billing_period: None,
        application_fee_amount: None,
        redirect_url: Some("https://example.com/success"),
        title: "Test Checkout",
        metadata: Some(serde_json::json!({ "session_id": "test-session-id" })),
        product_id: None,
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
