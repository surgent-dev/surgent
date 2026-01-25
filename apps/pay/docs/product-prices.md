# Product Price System Documentation

The Surpay Product Price System allows you to define pricing tiers for your products. Prices are integrated with Stripe and follow an immutable pattern to ensure consistency across subscriptions and checkouts.

## Overview

In Surpay, **prices are immutable**. Once a price is created, it cannot be modified. If you need to change the price of a product, you should create a new price record. This ensures that existing customers on a specific price tier are not affected by changes.

Prices are linked to the **latest version** of a product group at the time of creation. When you create a price, Surpay automatically synchronizes it with Stripe, creating a corresponding Stripe Price object.

### Key Concepts

- **Price Immutability**: Once created, a price record is never updated.
- **Product Relationship**: Prices are linked to a product group via `productGroupId`. They are internally associated with the latest version of that product.
- **Stripe Sync**: Every price created in Surpay is automatically mirrored in Stripe.
- **Recurring vs One-time**: Prices can be recurring (subscriptions) or one-time payments.

---

## Authentication

All API requests must include your API key in the `Authorization` header as a Bearer token.

```bash
Authorization: Bearer sp_test_your_secret_key
```

Use your **test key** for development and **live key** for production.

---

## API Endpoints

### 1. Create Product Price

Adds a pricing tier to a product. This also automatically creates a corresponding price in Stripe.

**HTTP Method:** `POST`  
**Path:** `/product/price`

#### Request Body

| Field               | Type    | Required | Description                                                    |
| :------------------ | :------ | :------- | :------------------------------------------------------------- |
| `projectId`         | UUID    | Yes      | The ID of the project this price belongs to.                   |
| `productGroupId`    | UUID    | Yes      | The `productGroupId` of the product.                           |
| `priceAmount`       | Integer | Yes      | Amount in the smallest currency unit (e.g., 999 for $9.99).    |
| `priceCurrency`     | String  | Yes      | 3-letter ISO currency code (e.g., "usd").                      |
| `name`              | String  | No       | Name for this price tier.                                      |
| `description`       | String  | No       | Description for this price tier.                               |
| `recurringInterval` | String  | No       | 'month' or 'year' for subscriptions. Omit for one-time prices. |
| `isDefault`         | Boolean | No       | Whether this is the default price for the product.             |

#### Response Body (201 Created)

```json
{
  "productPriceId": "uuid"
}
```

#### Example cURL

```bash
curl -X POST https://api.surpay.com/product/price \
  -H "Authorization: Bearer sp_test_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "productGroupId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "priceAmount": 2900,
    "priceCurrency": "usd",
    "recurringInterval": "month",
    "name": "Monthly Subscription",
    "description": "Pro plan monthly billing"
  }'
```

---

## Stripe Integration

Surpay automatically synchronizes your product prices with Stripe:

1.  **Automatic Creation**: When you call `POST /product/price`, Surpay creates a corresponding Price in Stripe.
2.  **Product Requirement**: The product (identified by `productGroupId`) must already be synced to Stripe (i.e., it must have a `processorProductId`). If not, the request will fail with a `400 Bad Request`.
3.  **Environment Mapping**:
    - Requests using `sp_test_` keys sync with your Stripe **Test Mode**.
    - Requests using `sp_live_` keys sync with your Stripe **Live Mode**.
4.  **Metadata**: Surpay stores its own `productPriceId` in the Stripe price metadata as `surpay_price_id`.
5.  **Idempotency**: Surpay uses an idempotency key in the format `price:{productId}:{org_id}:{price_id}` to ensure that retried requests do not create duplicate prices in Stripe.
6.  **Immutability**: Since Stripe prices are mostly immutable, Surpay follows this pattern. To "update" a price, you must create a new one.

---

## Database Schema

### `product_price` Table

Stores pricing information for specific product versions.

| Column              | Type    | Description                                           |
| :------------------ | :------ | :---------------------------------------------------- |
| `id`                | UUID    | Primary Key.                                          |
| `productId`         | UUID    | Foreign Key to `product` (specific version ID).       |
| `name`              | Text    | Price tier name.                                      |
| `description`       | Text    | Price tier description.                               |
| `priceAmount`       | Integer | Amount in cents (or smallest currency unit).          |
| `priceCurrency`     | String  | 3-letter ISO code (e.g., "usd").                      |
| `recurringInterval` | String  | 'month', 'year', or NULL for one-time.                |
| `isDefault`         | Boolean | Default status for the product.                       |
| `processorPriceId`  | String  | Reference to the Stripe Price ID (e.g., `price_...`). |

---

## Error Codes

| Status Code | Meaning        | Description                                           |
| :---------- | :------------- | :---------------------------------------------------- |
| `201`       | Created        | Price created and synced to Stripe successfully.      |
| `400`       | Bad Request    | Product not synced to Stripe or invalid request data. |
| `401`       | Unauthorized   | Missing or invalid API key.                           |
| `403`       | Forbidden      | Invalid product or project ownership.                 |
| `502`       | Bad Gateway    | Error communicating with Stripe.                      |
| `500`       | Internal Error | An unexpected error occurred on our end.              |
