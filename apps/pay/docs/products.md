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
Authorization: Bearer xKmZqWpNrTsYvBcDfGhJkLmNpQrStUvWxYzAbCdEfGhJkLmNpQrStUvWxYzAbCd
```

---

## API Endpoints

### 1. Create Product

Creates a new product and its first version. This also automatically creates a corresponding product in Stripe.

**HTTP Method:** `POST`  
**Path:** `/product`

#### Request Body

| Field            | Type    | Required | Description                                                     |
| :--------------- | :------ | :------- | :-------------------------------------------------------------- |
| `projectId`      | UUID    | Yes      | The ID of the project this product belongs to.                  |
| `productGroupId` | UUID    | Yes      | A unique ID you generate to group all versions of this product. |
| `name`           | String  | Yes      | The name of the product.                                        |
| `slug`           | String  | Yes      | A URL-friendly identifier for the product.                      |
| `description`    | String  | No       | A brief description of the product.                             |
| `isDefault`      | Boolean | No       | Whether this is the default product for the project.            |

#### Response Body (201 Created)

```json
{
  "productId": "uuid",
  "productGroupId": "uuid",
  "version": 1
}
```

#### Example cURL

```bash
curl -X POST https://api.surpay.com/product \
  -H "Authorization: Bearer xKmZqWpNrTsYvBcDfGhJkLmNpQrStUvWxYzAbCdEfGhJkLmNpQrStUvWxYzAbCd" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "productGroupId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "name": "Pro Plan",
    "slug": "pro-plan",
    "description": "Unlimited access to all features",
    "isDefault": true
  }'
```

---

### 2. Update Product

Creates a new version of an existing product. The `productGroupId` remains the same, but a new `productId` is generated and the `version` is incremented.

**HTTP Method:** `PUT`  
**Path:** `/product/{productId}`

#### Request Body

All fields are optional. If not provided, the value from the previous version is used.

| Field         | Type    | Description                            |
| :------------ | :------ | :------------------------------------- |
| `name`        | String  | Updated name.                          |
| `description` | String  | Updated description.                   |
| `slug`        | String  | Updated slug.                          |
| `isDefault`   | Boolean | Update default status.                 |
| `isArchived`  | Boolean | Whether to archive this product group. |

#### Response Body (201 Created)

```json
{
  "productId": "uuid (new)",
  "productGroupId": "uuid (same)",
  "version": 2
}
```

#### Example cURL

```bash
curl -X PUT https://api.surpay.com/product/b1f2e3d4-c5b6-a7f8-e9d0-c1b2a3f4e5d6 \
  -H "Authorization: Bearer xKmZqWpNrTsYvBcDfGhJkLmNpQrStUvWxYzAbCdEfGhJkLmNpQrStUvWxYzAbCd" \
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

| Field               | Type    | Required | Description                                                 |
| :------------------ | :------ | :------- | :---------------------------------------------------------- |
| `projectId`         | UUID    | Yes      | The ID of the project.                                      |
| `productGroupId`    | UUID    | Yes      | The `productGroupId` of the product.                        |
| `priceAmount`       | Integer | Yes      | Amount in the smallest currency unit (e.g., 999 for $9.99). |
| `priceCurrency`     | String  | Yes      | 3-letter ISO currency code (e.g., "usd").                   |
| `name`              | String  | No       | Name for this price tier.                                   |
| `description`       | String  | No       | Description for this price tier.                            |
| `recurringInterval` | String  | No       | 'month' or 'year' for subscriptions.                        |
| `isDefault`         | Boolean | No       | Whether this is the default price for the product.          |

#### Response Body (201 Created)

```json
{
  "productPriceId": "uuid"
}
```

#### Example cURL

```bash
curl -X POST https://api.surpay.com/product/price \
  -H "Authorization: Bearer xKmZqWpNrTsYvBcDfGhJkLmNpQrStUvWxYzAbCdEfGhJkLmNpQrStUvWxYzAbCd" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "productGroupId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "priceAmount": 2900,
    "priceCurrency": "usd",
    "recurringInterval": "month",
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
      "productGroupId": "uuid",
      "name": "Pro Plan v2",
      "description": "Now with even more features!",
      "slug": "pro-plan",
      "version": 2,
      "isArchived": false,
      "isDefault": true,
      "processorProductId": "prod_R123456789"
    },
    "prices": [
      {
        "id": "uuid",
        "name": "Monthly Subscription",
        "description": null,
        "priceAmount": 2900,
        "priceCurrency": "usd",
        "recurringInterval": "month",
        "isDefault": false
      }
    ]
  }
]
```

#### Example cURL

```bash
curl -X GET https://api.surpay.com/product/prices \
  -H "Authorization: Bearer xKmZqWpNrTsYvBcDfGhJkLmNpQrStUvWxYzAbCdEfGhJkLmNpQrStUvWxYzAbCd"
```

---

## Stripe Integration

Surpay automatically synchronizes your products with Stripe:

1.  **Automatic Creation**: When you call `POST /product`, Surpay creates a corresponding Product in Stripe.
2.  **Environment Mapping**: Requests sync with your Stripe account based on the API key used.
3.  **Metadata**: Surpay stores the `productGroupId` and its own `productId` in Stripe product metadata for easy cross-referencing.
4.  **Idempotency**: Surpay uses internal idempotency keys to ensure that retried requests do not create duplicate products in Stripe.

**Price Sync**: When you call `POST /product/price`, Surpay also creates a corresponding Price in Stripe. See [Product Prices Documentation](product-prices.md) for details.

---

## Database Schema

### `product` Table

Stores product versions.

| Column               | Type    | Description                       |
| :------------------- | :------ | :-------------------------------- |
| `id`                 | UUID    | Primary Key (Version ID).         |
| `productGroupId`     | UUID    | Identifier for the product group. |
| `projectId`          | UUID    | Foreign Key to `project`.         |
| `name`               | String  | Product name.                     |
| `description`        | Text    | Product description.              |
| `slug`               | String  | URL-friendly identifier.          |
| `version`            | Integer | Version number.                   |
| `isArchived`         | Boolean | Archive status.                   |
| `isDefault`          | Boolean | Default status for project.       |
| `processorProductId` | String  | Reference to Stripe Product.      |
| `processor`          | String  | 'stripe', etc.                    |

### `product_price` Table

Stores pricing information for specific product versions.

| Column              | Type    | Description                                  |
| :------------------ | :------ | :------------------------------------------- |
| `id`                | UUID    | Primary Key.                                 |
| `productId`         | UUID    | Foreign Key to `product` (specific version). |
| `name`              | Text    | Price tier name.                             |
| `description`       | Text    | Price tier description.                      |
| `priceAmount`       | Integer | Amount in cents.                             |
| `priceCurrency`     | String  | 3-letter ISO code.                           |
| `recurringInterval` | String  | 'month' or 'year'.                           |
| `isDefault`         | Boolean | Default status for product.                  |
| `processorPriceId`  | String  | Reference to Stripe Price.                   |

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
