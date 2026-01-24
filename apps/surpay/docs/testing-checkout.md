# Testing the Checkout Flow with Curl

This guide provides a step-by-step walkthrough for testing the full checkout flow of Surpay using `curl`. We will cover everything from creating an organization to generating a Stripe Checkout URL.

## Prerequisites

- Server running (default is `http://localhost:8090`)
- Database set up and migrated
- `jq` installed for JSON parsing (optional but recommended)
- Valid Stripe test API keys configured in `.env`

### Configuration

Set the base URL for your server:

```bash
export BASE_URL="http://localhost:8090"
```

## Step 0: Create Organization API Key (CLI)

Before using the API, you need a Master API key. Use the provided CLI tool to create one:

```bash
cargo run --bin create-api-key -- --name "Test Organization" --slug "test-org"
```

This will output an **API Key**. Save the **API Key** (it starts with `sp_`) as your `MASTER_KEY`.

```bash
export MASTER_KEY="your_master_key_here"
```

## Step 1: Create Organization

Use your Master Key to create an organization. This will provide you with the Organization API Key needed for all subsequent requests.

```bash
ORG_DATA=$(curl -s -X POST "$BASE_URL/organization" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Organization",
    "slug": "my-org-'"$(date +%s)"'"
  }')

export API_KEY=$(echo $ORG_DATA | jq -r '.apiKey')
echo "Organization API Key: $API_KEY"
```

## Step 2: Health Check

Verify the server is running:

```bash
curl "$BASE_URL/health"
```

**Expected Response:** `OK`

## Step 3: Create Project

Projects group your products. Use the Organization API Key (`sp_...`) from Step 1.

```bash
PROJECT_ID=$(curl -s -X POST "$BASE_URL/project" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Awesome Project",
    "slug": "my-awesome-project-'"$(date +%s)"'"
  }' | jq -r '.id')

echo "Project ID: $PROJECT_ID"
```

## Step 4: Create Product

Products are versioned. You need to provide a `productGroupId` (a UUID) to group different versions of the same product. When a product is created, Surpay automatically creates a corresponding product in Stripe.

```bash
PRODUCT_GROUP_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
PRODUCT_DATA=$(curl -s -X POST "$BASE_URL/product" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'"$PROJECT_ID"'",
    "productGroupId": "'"$PRODUCT_GROUP_ID"'",
    "name": "Pro Plan",
    "slug": "pro-plan-'"$(date +%s)"'",
    "isDefault": true
  }')

PRODUCT_ID=$(echo $PRODUCT_DATA | jq -r '.productId')
echo "Product ID: $PRODUCT_ID"
```

## Step 5: Create Product Price

Create a price for the product. Note that `productGroupId` refers to the `productGroupId`. Surpay will automatically create this price in Stripe and link it to the product.

```bash
PRICE_ID=$(curl -s -X POST "$BASE_URL/product/price" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'"$PROJECT_ID"'",
    "productGroupId": "'"$PRODUCT_GROUP_ID"'",
    "name": "one time payment",
    "priceAmount": 2900,
    "priceCurrency": "usd",
    "recurringInterval": "",
    "isDefault": true
  }' | jq -r '.productPriceId')

echo "Price ID: $PRICE_ID"
```

## Step 6: List Products with Prices (Verify)

Verify that your product and price were created correctly and that the `processorProductId` is populated.

```bash
curl -s "$BASE_URL/product/prices" \
  -H "Authorization: Bearer $API_KEY" | jq
```

## Step 7: Create Checkout Session

Now you can create a checkout session. This will return a Stripe Checkout URL.

```bash
curl -s -X POST "$BASE_URL/checkout" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "'"$PRODUCT_ID"'",
    "priceId": "'"$PRICE_ID"'",
    "successUrl": "https://example.com/success",
    "cancelUrl": "https://example.com/cancel"
  }'
```

## Step 8: List Customers

List all customers associated with a project. This returns an array of customers including their email, name, and Stripe customer ID.

```bash
curl -s "$BASE_URL/project/$PROJECT_ID/customers" \
  -H "Authorization: Bearer $API_KEY" | jq
```

## Step 9: List Transactions

List all payment transactions for a project. This returns an array of transactions with type `payment`, ordered by creation date (newest first).

```bash
curl -s "$BASE_URL/project/$PROJECT_ID/transactions" \
  -H "Authorization: Bearer $API_KEY" | jq
```

## Step 10: List Subscriptions

List all subscriptions for a project. This returns an array of subscriptions including their status (active, canceled, etc.) and current period dates, ordered by creation date (newest first).

```bash
curl -s "$BASE_URL/project/$PROJECT_ID/subscriptions" \
  -H "Authorization: Bearer $API_KEY" | jq
```

## All-in-One Test Script

You can copy this into a file named `test_flow.sh` and run it.

```bash
#!/bin/bash
set -e

# Configuration
# 1. Run: cargo run --bin create-api-key -- --name "Test Organization" --slug "test-org"
# 2. Copy the API Key and paste it below:
MASTER_KEY="sp_..."

BASE_URL="http://localhost:3000"
TS=$(date +%s)

echo "--- Step 1: Create Organization ---"
ORG_DATA=$(curl -s -X POST "$BASE_URL/organization" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Org $TS\",
    \"slug\": \"test-org-$TS\"
  }")
API_KEY=$(echo $ORG_DATA | jq -r '.apiKey')
echo "Org API Key: $API_KEY"

echo "--- Step 2: Health Check ---"
curl -s "$BASE_URL/health"
echo -e "\n"

echo "--- Step 3: Create Project ---"
PROJECT_ID=$(curl -s -X POST "$BASE_URL/project" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Project $TS\",
    \"slug\": \"test-project-$TS\"
  }" | jq -r '.id')
echo "Project ID: $PROJECT_ID"

echo "--- Step 4: Create Product ---"
PRODUCT_GROUP_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
PRODUCT_DATA=$(curl -s -X POST "$BASE_URL/product" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"productGroupId\": \"$PRODUCT_GROUP_ID\",
    \"name\": \"Test Product $TS\",
    \"slug\": \"test-product-$TS\",
    \"isDefault\": true
  }")
PRODUCT_ID=$(echo $PRODUCT_DATA | jq -r '.productId')
echo "Product ID: $PRODUCT_ID"

echo "--- Step 5: Create Product Price ---"
PRICE_ID=$(curl -s -X POST "$BASE_URL/product/price" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"productGroupId\": \"$PRODUCT_GROUP_ID\",
    \"name\": \"Monthly Test\",
    \"priceAmount\": 1000,
    \"priceCurrency\": \"usd\",
    \"recurringInterval\": \"month\",
    \"isDefault\": true
  }" | jq -r '.productPriceId')
echo "Price ID: $PRICE_ID"

echo "--- Step 6: Verify ---"
curl -s "$BASE_URL/product/prices" -H "Authorization: Bearer $API_KEY" | jq

echo "--- Step 7: Create Checkout Session ---"
curl -s -X POST "$BASE_URL/checkout" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"productId\": \"$PRODUCT_ID\",
    \"priceId\": \"$PRICE_ID\",
    \"successUrl\": \"https://example.com/success\",
    \"cancelUrl\": \"https://example.com/cancel\"
  }" | jq

echo "--- Step 8: List Customers ---"
curl -s "$BASE_URL/project/$PROJECT_ID/customers" \
  -H "Authorization: Bearer $API_KEY" | jq

echo "--- Step 9: List Transactions ---"
curl -s "$BASE_URL/project/$PROJECT_ID/transactions" \
  -H "Authorization: Bearer $API_KEY" | jq

echo "--- Step 10: List Subscriptions ---"
curl -s "$BASE_URL/project/$PROJECT_ID/subscriptions" \
  -H "Authorization: Bearer $API_KEY" | jq
```

## Troubleshooting

### Common Errors

- **401 Unauthorized:** Check your API key.
  - Use the **Master Key** (`sp_...` from Step 0) ONLY for creating organizations.
  - Use the **Organization Key** (`sp_...` from Step 1) for all other endpoints.
- **404 Product not found:** Ensure the `productId` exists and belongs to the organization associated with your API key.
- **400 Bad Request:** Check the required fields in your JSON body. Ensure UUIDs are valid and slugs are unique.
- **409 Conflict:** The slug you are trying to use for a project or organization already exists. Use a unique slug.
- **502 Bad Gateway (Stripe Error):** This usually means there was an issue communicating with Stripe. Check your `.env` file for valid `STRIPE_SECRET_KEY` and ensure your internet connection is stable.
- **400 Product not synced to Stripe:** This happens if the product was created without a successful Stripe call. Ensure your Stripe keys are correct.
