# Surpay

Surpay is a high-performance payment processing platform API built in Rust. It is designed to manage organizations, projects, products, and pricing for subscription-based services with a focus on multi-tenancy and security.

## Features

- **Multi-tenancy**: Organization-based isolation for all data.
- **API Key Authentication**: Secure, hashed API keys with live and test environment support.
- **Product Versioning**: Automatic versioning of products to maintain historical data.
- **Flexible Pricing**: Support for multiple prices per product, including recurring intervals.
- **Type-Safe Database Access**: Compile-time SQL query checking using SQLx.
- **Observability**: Integrated tracing for request logging and performance monitoring.

## Tech Stack

- **Language**: [Rust](https://www.rust-lang.org/) (2024 Edition)
- **Web Framework**: [Axum](https://github.com/tokio-rs/axum)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **SQL Toolkit**: [SQLx](https://github.com/launchbadge/sqlx)
- **Message Queue**: [AWS SQS](https://aws.amazon.com/sqs/) (ElasticMQ for local development)
- **Runtime**: [Tokio](https://tokio.rs/)

## Prerequisites

- **Rust**: Latest stable version (2024 edition support required)
- **Docker**: For running the development database
- **SQLx CLI** (Optional): For managing migrations manually (`cargo install sqlx-cli`)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-repo/surpay.git
cd surpay
```

### 2. Start the Development Database

Surpay requires PostgreSQL and ElasticMQ (SQS-compatible queue) for local development. You can start them using Docker Compose:

```bash
docker-compose -f docker-compose.dev.yml up -d
```

This starts PostgreSQL on `localhost:5432` and ElasticMQ on `localhost:9324`.

**Database URL:** `postgres://surpay:password@localhost/surpay`

To stop or reset the database:

- Stop: `docker-compose -f docker-compose.dev.yml down`
- Reset (delete all data): `docker-compose -f docker-compose.dev.yml down -v`

### 3. Configuration

Create a `.env` file in the root directory based on the provided example:

```bash
cp env.example .env
```

Edit `.env` with your database credentials and service settings:

```env
DATABASE_URL=postgres://surpay:password@localhost/surpay
DATABASE_MAX_CONNECTIONS=5
DATABASE_MIN_CONNECTIONS=1

SERVICE_PORT=8090
SERVICE_HOST=0.0.0.0

# SQS Configuration (ElasticMQ for local dev)
SQS_ENDPOINT_URL=http://localhost:9324
SQS_WEBHOOKS_QUEUE_URL=http://localhost:9324/queue/webhooks
SQS_WEBHOOKS_DLQ_URL=http://localhost:9324/queue/webhooks_dlq
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
AWS_REGION=us-east-1
```

### 4. Run Migrations

The application automatically runs migrations on startup. However, if you want to run them manually using SQLx CLI:

```bash
sqlx database create
sqlx migrate run
```

### 5. Running the Server

```bash
cargo run
```

The server will start at `http://0.0.0.0:8090` (or your configured host/port).

### 6. Creating a Master API Key

To create a master API key for administrative tasks, use the provided utility:

```bash
cargo run --bin create-api-key -- --name "Admin Key" --slug "admin-key"
```

This will output a live and test API key. **Make sure to save them**, as the secrets are hashed and cannot be recovered.

## API Endpoints Overview

| Method | Endpoint          | Description                          | Auth Required |
| :----- | :---------------- | :----------------------------------- | :------------ |
| `GET`  | `/health`         | Health check                         | No            |
| `POST` | `/organization`   | Create a new organization            | Yes (Master)  |
| `POST` | `/project`        | Create a new project                 | Yes (Org)     |
| `POST` | `/product`        | Create a new product                 | Yes (Org)     |
| `PUT`  | `/product/{id}`   | Update product (creates new version) | Yes (Org)     |
| `POST` | `/product/price`  | Create a price for a product         | Yes (Org)     |
| `GET`  | `/product/prices` | List products with their prices      | Yes (Org)     |

## Authentication

Surpay uses Bearer token authentication with API keys. There are two types of keys:

1. **Master API Keys**: Used for administrative tasks like creating organizations. These are stored in the `api_key` table.
2. **Organization API Keys**: Used for managing resources within a specific organization (projects, products, etc.). These are stored in the `organization` table.

### API Key Format

`sp_{env}_{prefix}_{secret}`

- `env`: Either `live` or `test`.
- `prefix`: 8-character unique identifier.
- `secret`: 32-character random secret.

### Usage

Include the API key in the `Authorization` header of your requests:

```http
Authorization: Bearer sp_live_abcdefgh_your_secret_key_here
```

API keys are stored securely using Argon2 hashing. Master keys are created via the CLI, while Organization keys are returned when an organization is created.

## Database Schema Overview

The database consists of several key entities:

- **Organization**: Top-level tenant.
- **Project**: Logical grouping of products within an organization.
- **Product**: Versioned entities representing services or goods.
- **ProductPrice**: Pricing details (amount, currency, interval) for products.
- **Customer**: Users associated with projects.
- **Subscription**: Links customers to products and prices.
- **Transaction**: Records of financial events (payments, refunds, payouts).

## Testing

Surpay uses `#[sqlx::test]` for integration tests, which automatically handles database migrations for each test. The development database must be running for tests to execute.

### Running Tests

```bash
cargo test
```

_Note: Ensure your `DATABASE_URL` in `.env` points to the running development database (e.g., `postgres://surpay:password@localhost/surpay`)._
