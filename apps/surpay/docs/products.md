# Product System Documentation

The Surpay Product System provides a robust way to manage products and their pricing with built-in versioning and automatic Stripe integration.

## Overview

Surpay uses an **immutable versioning system** for products. Instead of updating an existing product record, every change creates a new version of the product. This ensures a complete audit trail and prevents breaking existing subscriptions or checkouts that might rely on a specific version of a product.

### Key Concepts

- **Product Group ID**: A unique identifier that remains constant across all versions of a product.
- **Product ID**: A unique identifier for a _specific version_ of a product.
- **Version**: An incrementing integer starting from 1 for each product group.
- **Immutability**: Once a product version is created, it is never modified. Updates create new versions.

---

## Authentication

All API requests must include your API key in the `Authorization` header as a Bearer token.

```bash
Authorization: Bearer sp_test_your_secret_key
```

Use your **test key** for development and **live key** for production.

---

## API Endpoints

### 1. Create Product

Creates a new product and its first version. This also automatically creates a corresponding product in Stripe.

**HTTP Method:** `POST`  
**Path:** `/product`

#### Request Body

| Field              | Type    | Required | Description                                                     |
| :----------------- | :------ | :------- | :-------------------------------------------------------------- |
| `project_id`       | UUID    | Yes      | The ID of the project this product belongs to.                  |
| `product_group_id` | UUID    | Yes      | A unique ID you generate to group all versions of this product. |
| `name`             | String  | Yes      | The name of the product.                                        |
| `slug`             | String  | Yes      | A URL-friendly identifier for the product.                      |
| `description`      | String  | No       | A brief description of the product.                             |
| `is_default`       | Boolean | No       | Whether this is the default product for the project.            |

#### Response Body (201 Created)

```json
{
  "product_id": "uuid",
  "product_group_id": "uuid",
  "version": 1
}
```

#### Example cURL

```bash
curl -X POST https://api.surpay.com/product \
  -H "Authorization: Bearer sp_test_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "product_group_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "name": "Pro Plan",
    "slug": "pro-plan",
    "description": "Unlimited access to all features",
    "is_default": true
  }'
```

---

### 2. Update Product

Creates a new version of an existing product. The `product_group_id` remains the same, but a new `product_id` is generated and the `version` is incremented.

**HTTP Method:** `PUT`  
**Path:** `/product/{product_id}`

#### Request Body

All fields are optional. If not provided, the value from the previous version is used.

| Field         | Type    | Description                            |
| :------------ | :------ | :------------------------------------- |
| `name`        | String  | Updated name.                          |
| `description` | String  | Updated description.                   |
| `slug`        | String  | Updated slug.                          |
| `is_default`  | Boolean | Update default status.                 |
| `is_archived` | Boolean | Whether to archive this product group. |

#### Response Body (201 Created)

```json
{
  "product_id": "uuid (new)",
  "product_group_id": "uuid (same)",
  "version": 2
}
```

#### Example cURL

```bash
curl -X PUT https://api.surpay.com/product/b1f2e3d4-c5b6-a7f8-e9d0-c1b2a3f4e5d6 \
  -H "Authorization: Bearer sp_test_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pro Plan v2",
    "description": "Now with even more features!"
  }'
```

---

### 3. Create Product Price

Adds a pricing tier to a product. Prices are linked to the _latest version_ of the product group at the time of creation.

**HTTP Method:** `POST`  
**Path:** `/product/price`

#### Request Body

| Field                | Type    | Required | Description                                                 |
| :------------------- | :------ | :------- | :---------------------------------------------------------- |
| `project_id`         | UUID    | Yes      | The ID of the project.                                      |
| `base_product_id`    | UUID    | Yes      | The `product_group_id` of the product.                      |
| `price`              | Integer | Yes      | Amount in the smallest currency unit (e.g., 999 for $9.99). |
| `price_currency`     | String  | Yes      | 3-letter ISO currency code (e.g., "usd").                   |
| `name`               | String  | No       | Name for this price tier.                                   |
| `description`        | String  | No       | Description for this price tier.                            |
| `recurring_interval` | String  | No       | 'month' or 'year' for subscriptions.                        |
| `is_default`         | Boolean | No       | Whether this is the default price for the product.          |

#### Response Body (201 Created)

```json
{
  "product_price_id": "uuid"
}
```

#### Example cURL

```bash
curl -X POST https://api.surpay.com/product/price \
  -H "Authorization: Bearer sp_test_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "base_product_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "price": 2900,
    "price_currency": "usd",
    "recurring_interval": "month",
    "name": "Monthly Subscription"
  }'
```

---

### 4. List Products with Prices

Retrieves all products for your organization, including their associated prices. Only the **latest version** of each product group is returned.

**HTTP Method:** `GET`  
**Path:** `/product/prices`

#### Response Body (200 OK)

Returns an array of product objects, each containing an array of prices.

```json
[
  {
    "product": {
      "id": "uuid",
      "product_group_id": "uuid",
      "name": "Pro Plan v2",
      "description": "Now with even more features!",
      "slug": "pro-plan",
      "version": 2,
      "is_archived": false,
      "is_default": true,
      "stripe_product_id": "prod_R123456789"
    },
    "prices": [
      {
        "id": "uuid",
        "name": "Monthly Subscription",
        "description": null,
        "price_amount": 2900,
        "price_currency": "usd",
        "recurring_interval": "month",
        "is_default": false
      }
    ]
  }
]
```

#### Example cURL

```bash
curl -X GET https://api.surpay.com/product/prices \
  -H "Authorization: Bearer sp_test_YOUR_KEY"
```

---

## Stripe Integration

Surpay automatically synchronizes your products with Stripe:

1.  **Automatic Creation**: When you call `POST /product`, Surpay creates a corresponding Product in Stripe.
2.  **Environment Mapping**:
    - Requests using `sp_test_` keys sync with your Stripe **Test Mode**.
    - Requests using `sp_live_` keys sync with your Stripe **Live Mode**.
3.  **Metadata**: Surpay stores the `product_group_id` and its own `product_id` in Stripe product metadata for easy cross-referencing.
4.  **Idempotency**: Surpay uses internal idempotency keys to ensure that retried requests do not create duplicate products in Stripe.

**Price Sync**: When you call `POST /product/price`, Surpay also creates a corresponding Price in Stripe. See [Product Prices Documentation](product-prices.md) for details.

---

## Database Schema

### `product` Table

Stores product versions.

| Column              | Type    | Description                       |
| :------------------ | :------ | :-------------------------------- |
| `id`                | UUID    | Primary Key (Version ID).         |
| `product_group_id`  | UUID    | Identifier for the product group. |
| `project_id`        | UUID    | Foreign Key to `project`.         |
| `name`              | String  | Product name.                     |
| `description`       | Text    | Product description.              |
| `slug`              | String  | URL-friendly identifier.          |
| `version`           | Integer | Version number.                   |
| `is_archived`       | Boolean | Archive status.                   |
| `is_default`        | Boolean | Default status for project.       |
| `stripe_product_id` | String  | Reference to Stripe Product.      |
| `env`               | String  | 'test' or 'live'.                 |

### `product_price` Table

Stores pricing information for specific product versions.

| Column               | Type    | Description                                  |
| :------------------- | :------ | :------------------------------------------- |
| `id`                 | UUID    | Primary Key.                                 |
| `product_id`         | UUID    | Foreign Key to `product` (specific version). |
| `name`               | Text    | Price tier name.                             |
| `description`        | Text    | Price tier description.                      |
| `price_amount`       | Integer | Amount in cents.                             |
| `price_currency`     | String  | 3-letter ISO code.                           |
| `recurring_interval` | String  | 'month' or 'year'.                           |
| `is_default`         | Boolean | Default status for product.                  |
| `stripe_price_id`    | String  | Reference to Stripe Price.                   |

---

## Error Codes

| Status Code | Meaning          | Description                                           |
| :---------- | :--------------- | :---------------------------------------------------- |
| `200`       | OK               | Request successful.                                   |
| `201`       | Created          | Resource created successfully (used for updates too). |
| `401`       | Unauthorized     | Missing or invalid API key.                           |
| `403`       | Forbidden        | You do not have permission to access this resource.   |
| `404`       | Not Found        | The requested resource does not exist.                |
| `422`       | Validation Error | The request body is invalid.                          |
| `502`       | Bad Gateway      | Error communicating with Stripe.                      |
| `500`       | Internal Error   | An unexpected error occurred on our end.              |
