# Checkout Configuration

Source: https://docs.whop.com/api-reference/checkout-configurations/checkout-configuration

# Create checkout configuration

Source: https://docs.whop.com/api-reference/checkout-configurations/create-checkout-configuration

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /checkout_configurations
Creates a new checkout configuration

Required permissions:

- `checkout_configuration:create`
- `plan:create`
- `access_pass:create`
- `access_pass:update`
- `checkout_configuration:basic:read`

# List checkout configurations

Source: https://docs.whop.com/api-reference/checkout-configurations/list-checkout-configurations

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /checkout_configurations
Returns a paginated list of checkout configurations for a company, with optional filtering by plan and creation date.

Required permissions:

- `checkout_configuration:basic:read`

# Retrieve checkout configuration

Source: https://docs.whop.com/api-reference/checkout-configurations/retrieve-checkout-configuration

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /checkout_configurations/{id}
Retrieves the details of an existing checkout configuration.

Required permissions:

- `checkout_configuration:basic:read`

# Dispute

Source: https://docs.whop.com/api-reference/disputes/dispute

# Dispute created

Source: https://docs.whop.com/api-reference/disputes/dispute-created

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook dispute.created
Sent when a dispute is created

Required permissions:

- `payment:dispute:read`
- `plan:basic:read`
- `access_pass:basic:read`
- `company:basic:read`
- `payment:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `webhook_receive:disputes`

# Dispute updated

Source: https://docs.whop.com/api-reference/disputes/dispute-updated

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook dispute.updated
Sent when a dispute is updated

Required permissions:

- `payment:dispute:read`
- `plan:basic:read`
- `access_pass:basic:read`
- `company:basic:read`
- `payment:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `webhook_receive:disputes`

# List disputes

Source: https://docs.whop.com/api-reference/disputes/list-disputes

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /disputes
Returns a paginated list of disputes for a company, with optional filtering by creation date. A dispute represents a chargeback or inquiry filed by a customer against a payment.

Required permissions:

- `payment:dispute:read`
- `plan:basic:read`
- `access_pass:basic:read`
- `company:basic:read`
- `payment:basic:read`

# Retrieve dispute

Source: https://docs.whop.com/api-reference/disputes/retrieve-dispute

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /disputes/{id}
Retrieves the details of an existing dispute.

Required permissions:

- `payment:dispute:read`
- `plan:basic:read`
- `access_pass:basic:read`
- `company:basic:read`
- `payment:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`

# Submit evidence

Source: https://docs.whop.com/api-reference/disputes/submit-evidence

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /disputes/{id}/submit_evidence
Submit a payment dispute to the payment processor for review. Once submitted, no further edits can be made.

Required permissions:

- `payment:dispute`
- `plan:basic:read`
- `access_pass:basic:read`
- `company:basic:read`
- `payment:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`

# Update evidence

Source: https://docs.whop.com/api-reference/disputes/update-evidence

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /disputes/{id}/update_evidence
Update a dispute with evidence data to attempt to win the dispute.

Required permissions:

- `payment:dispute`
- `plan:basic:read`
- `access_pass:basic:read`
- `company:basic:read`
- `payment:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`

# Create invoice

Source: https://docs.whop.com/api-reference/invoices/create-invoice

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /invoices
Create an invoice for a customer. The invoice can be charged automatically using a stored payment method, or sent to the customer for manual payment.

Required permissions:

- `invoice:create`
- `plan:basic:read`

# Invoice

Source: https://docs.whop.com/api-reference/invoices/invoice

# Invoice created

Source: https://docs.whop.com/api-reference/invoices/invoice-created

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook invoice.created
Sent when a invoice is created

Required permissions:

- `invoice:basic:read`
- `plan:basic:read`
- `webhook_receive:invoices`

# Invoice paid

Source: https://docs.whop.com/api-reference/invoices/invoice-paid

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook invoice.paid
Sent when a invoice is paid

Required permissions:

- `invoice:basic:read`
- `plan:basic:read`
- `webhook_receive:invoices`

# Invoice past due

Source: https://docs.whop.com/api-reference/invoices/invoice-past-due

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook invoice.past_due
Sent when a invoice is past due

Required permissions:

- `invoice:basic:read`
- `plan:basic:read`
- `webhook_receive:invoices`

# Invoice voided

Source: https://docs.whop.com/api-reference/invoices/invoice-voided

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook invoice.voided
Sent when a invoice is voided

Required permissions:

- `invoice:basic:read`
- `plan:basic:read`
- `webhook_receive:invoices`

# List invoices

Source: https://docs.whop.com/api-reference/invoices/list-invoices

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /invoices
Returns a paginated list of invoices for a company, with optional filtering by product, status, collection method, and creation date.

Required permissions:

- `invoice:basic:read`
- `plan:basic:read`

# Retrieve invoice

Source: https://docs.whop.com/api-reference/invoices/retrieve-invoice

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /invoices/{id}
Retrieves the details of an existing invoice.

Required permissions:

- `invoice:basic:read`
- `plan:basic:read`

# Void invoice

Source: https://docs.whop.com/api-reference/invoices/void-invoice

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /invoices/{id}/void
Void an open invoice so it can no longer be paid. Voiding is permanent and cannot be undone.

Required permissions:

- `invoice:update`

# Ledger Account

Source: https://docs.whop.com/api-reference/ledger-accounts/ledger-account

# Retrieve ledger account

Source: https://docs.whop.com/api-reference/ledger-accounts/retrieve-ledger-account

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /ledger_accounts/{id}
Retrieves the details of an existing ledger account.

Required permissions:

- `company:balance:read`
- `payout:account:read`

# List payment methods

Source: https://docs.whop.com/api-reference/payment-methods/list-payment-methods

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /payment_methods
Returns a paginated list of payment methods for a member or company, with optional filtering by creation date. A payment method is a stored representation of how a customer intends to pay, such as a card, bank account, or digital wallet.

Required permissions:

- `member:payment_methods:read`

# Payment Method

Source: https://docs.whop.com/api-reference/payment-methods/payment-method

# Retrieve payment method

Source: https://docs.whop.com/api-reference/payment-methods/retrieve-payment-method

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /payment_methods/{id}
Retrieves the details of an existing payment method.

Required permissions:

- `member:payment_methods:read`

# Create payment

Source: https://docs.whop.com/api-reference/payments/create-payment

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /payments
Charge an existing member off-session using one of their stored payment methods. You can provide an existing plan, or create a new one in-line. This endpoint will respond with a payment object immediately, but the payment is processed asynchronously in the background. Use webhooks to be notified when the payment succeeds or fails.

Required permissions:

- `payment:charge`
- `plan:create`
- `access_pass:create`
- `access_pass:update`
- `plan:basic:read`
- `access_pass:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `promo_code:basic:read`

# List fees

Source: https://docs.whop.com/api-reference/payments/list-fees

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /payments/{id}/fees
Returns the list of fees associated with a specific payment, including platform fees and processing fees.

Required permissions:

- `payment:basic:read`

# List payments

Source: https://docs.whop.com/api-reference/payments/list-payments

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /payments
Returns a paginated list of payments for a company, with optional filtering by product, plan, status, billing reason, currency, and creation date.

Required permissions:

- `payment:basic:read`
- `plan:basic:read`
- `access_pass:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `promo_code:basic:read`

# Payment

Source: https://docs.whop.com/api-reference/payments/payment

# Payment created

Source: https://docs.whop.com/api-reference/payments/payment-created

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook payment.created
Sent when a payment is created

Required permissions:

- `payment:basic:read`
- `plan:basic:read`
- `access_pass:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `promo_code:basic:read`
- `webhook_receive:payments`

# Payment failed

Source: https://docs.whop.com/api-reference/payments/payment-failed

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook payment.failed
Sent when a payment is failed

Required permissions:

- `payment:basic:read`
- `plan:basic:read`
- `access_pass:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `promo_code:basic:read`
- `webhook_receive:payments`

# Payment pending

Source: https://docs.whop.com/api-reference/payments/payment-pending

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook payment.pending
Sent when a payment is pending

Required permissions:

- `payment:basic:read`
- `plan:basic:read`
- `access_pass:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `promo_code:basic:read`
- `webhook_receive:payments`

# Payment succeeded

Source: https://docs.whop.com/api-reference/payments/payment-succeeded

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook payment.succeeded
Sent when a payment is succeeded

Required permissions:

- `payment:basic:read`
- `plan:basic:read`
- `access_pass:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `promo_code:basic:read`
- `webhook_receive:payments`

# Refund payment

Source: https://docs.whop.com/api-reference/payments/refund-payment

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /payments/{id}/refund
Issue a full or partial refund for a payment. The refund is processed through the original payment processor and the membership status is updated accordingly.

Required permissions:

- `payment:manage`
- `plan:basic:read`
- `access_pass:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `promo_code:basic:read`

# Retrieve payment

Source: https://docs.whop.com/api-reference/payments/retrieve-payment

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /payments/{id}
Retrieves the details of an existing payment.

Required permissions:

- `payment:basic:read`
- `plan:basic:read`
- `access_pass:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `promo_code:basic:read`

# Retry payment

Source: https://docs.whop.com/api-reference/payments/retry-payment

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /payments/{id}/retry
Retry a failed or pending payment. This re-attempts the charge using the original payment method and plan details.

Required permissions:

- `payment:manage`
- `plan:basic:read`
- `access_pass:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `promo_code:basic:read`

# Void payment

Source: https://docs.whop.com/api-reference/payments/void-payment

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /payments/{id}/void
Void a payment that has not yet been settled. Voiding cancels the payment before it is captured by the payment processor.

Required permissions:

- `payment:manage`
- `plan:basic:read`
- `access_pass:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `promo_code:basic:read`

# Create plan

Source: https://docs.whop.com/api-reference/plans/create-plan

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /plans
Create a new pricing plan for a product. The plan defines the billing interval, price, and availability for customers.

Required permissions:

- `plan:create`
- `access_pass:basic:read`
- `plan:basic:read`

# Delete plan

Source: https://docs.whop.com/api-reference/plans/delete-plan

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /plans/{id}
Permanently delete a plan from a product. Existing memberships on this plan will not be affected.

Required permissions:

- `plan:delete`

# List plans

Source: https://docs.whop.com/api-reference/plans/list-plans

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /plans
Returns a paginated list of plans belonging to a company, with optional filtering by visibility, type, release method, and product.

Required permissions:

- `plan:basic:read`

# Plan

Source: https://docs.whop.com/api-reference/plans/plan

# Retrieve plan

Source: https://docs.whop.com/api-reference/plans/retrieve-plan

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /plans/{id}
Retrieves the details of an existing plan.

Required permissions:

- `plan:basic:read`

# Update plan

Source: https://docs.whop.com/api-reference/plans/update-plan

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /plans/{id}
Update a plan's pricing, billing interval, visibility, stock, and other settings.

Required permissions:

- `plan:update`
- `access_pass:basic:read`
- `plan:basic:read`

# Create product

Source: https://docs.whop.com/api-reference/products/create-product

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /products
Create a new product for a company. The product serves as the top-level container for plans and experiences.

Required permissions:

- `access_pass:create`
- `access_pass:basic:read`

# Delete product

Source: https://docs.whop.com/api-reference/products/delete-product

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /products/{id}
Permanently delete a product and remove it from the company's catalog.

Required permissions:

- `access_pass:delete`

# List products

Source: https://docs.whop.com/api-reference/products/list-products

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /products
Returns a paginated list of products belonging to a company, with optional filtering by type, visibility, and creation date.

Required permissions:

- `access_pass:basic:read`

# Product

Source: https://docs.whop.com/api-reference/products/product

# Retrieve product

Source: https://docs.whop.com/api-reference/products/retrieve-product

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /products/{id}
Retrieves the details of an existing product.

Required permissions:

- `access_pass:basic:read`

# Update product

Source: https://docs.whop.com/api-reference/products/update-product

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /products/{id}
Update a product's title, description, visibility, and other settings.

Required permissions:

- `access_pass:update`
- `access_pass:basic:read`

# Create promo code

Source: https://docs.whop.com/api-reference/promo-codes/create-promo-code

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /promo_codes
Create a new promo code that applies a discount at checkout. Can be scoped to specific products or plans.

Required permissions:

- `promo_code:create`
- `access_pass:basic:read`

# Delete promo code

Source: https://docs.whop.com/api-reference/promo-codes/delete-promo-code

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /promo_codes/{id}
Archive a promo code, preventing it from being used in future checkouts. Existing memberships are not affected.

Required permissions:

- `promo_code:delete`

# List promo codes

Source: https://docs.whop.com/api-reference/promo-codes/list-promo-codes

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /promo_codes
Returns a paginated list of promo codes belonging to a company, with optional filtering by product, plan, and status.

Required permissions:

- `promo_code:basic:read`
- `access_pass:basic:read`

# Promo Code

Source: https://docs.whop.com/api-reference/promo-codes/promo-code

# Retrieve promo code

Source: https://docs.whop.com/api-reference/promo-codes/retrieve-promo-code

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /promo_codes/{id}
Retrieves the details of an existing promo code.

Required permissions:

- `promo_code:basic:read`
- `access_pass:basic:read`

# List refunds

Source: https://docs.whop.com/api-reference/refunds/list-refunds

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /refunds
Returns a paginated list of refunds for a specific payment, with optional filtering by creation date.

Required permissions:

- `payment:basic:read`

# Refund

Source: https://docs.whop.com/api-reference/refunds/refund

# Refund created

Source: https://docs.whop.com/api-reference/refunds/refund-created

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook refund.created
Sent when a refund is created

Required permissions:

- `payment:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `webhook_receive:refunds`

# Refund updated

Source: https://docs.whop.com/api-reference/refunds/refund-updated

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook refund.updated
Sent when a refund is updated

Required permissions:

- `payment:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`
- `webhook_receive:refunds`

# Retrieve refund

Source: https://docs.whop.com/api-reference/refunds/retrieve-refund

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /refunds/{id}
Retrieves the details of an existing refund.

Required permissions:

- `payment:basic:read`
- `member:email:read`
- `member:basic:read`
- `member:phone:read`

# List setup intents

Source: https://docs.whop.com/api-reference/setup-intents/list-setup-intents

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /setup_intents
Returns a paginated list of setup intents for a company, with optional filtering by creation date. A setup intent securely collects and stores a member's payment method for future use without charging them immediately.

Required permissions:

- `payment:setup_intent:read`
- `member:basic:read`
- `member:email:read`

# Retrieve setup intent

Source: https://docs.whop.com/api-reference/setup-intents/retrieve-setup-intent

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /setup_intents/{id}
Retrieves the details of an existing setup intent.

Required permissions:

- `payment:setup_intent:read`
- `member:basic:read`
- `member:email:read`

# Setup Intent

Source: https://docs.whop.com/api-reference/setup-intents/setup-intent

# Setupintent canceled

Source: https://docs.whop.com/api-reference/setup-intents/setupintent-canceled

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook setup_intent.canceled
Sent when a setup intent is canceled

Required permissions:

- `payment:setup_intent:read`
- `member:basic:read`
- `member:email:read`
- `webhook_receive:setup_intents`

# Setupintent requires action

Source: https://docs.whop.com/api-reference/setup-intents/setupintent-requires-action

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook setup_intent.requires_action
Sent when a setup intent is requires action

Required permissions:

- `payment:setup_intent:read`
- `member:basic:read`
- `member:email:read`
- `webhook_receive:setup_intents`

# Setupintent succeeded

Source: https://docs.whop.com/api-reference/setup-intents/setupintent-succeeded

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook setup_intent.succeeded
Sent when a setup intent is succeeded

Required permissions:

- `payment:setup_intent:read`
- `member:basic:read`
- `member:email:read`
- `webhook_receive:setup_intents`

# List transfers

Source: https://docs.whop.com/api-reference/transfers/list-transfers

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /transfers
Returns a paginated list of fund transfers, filtered by origin or destination account, with optional sorting and date filtering.

Required permissions:

- `payout:transfer:read`

# Transfer

Source: https://docs.whop.com/api-reference/transfers/transfer

# Getting started

Source: https://docs.whop.com/developer/api/getting-started

Get your API keys and start making requests

# Use cases

Our API provides a powerful way to interact with whop programmatically.
Some common use cases include

- I'm a company owner and I want to pull payments made only to my company.

  -> Use [Company API keys](/developer/api/getting-started#company-api-keys)

- I'm a developer and I want to list memberships for any company that has installed my app.

  -> Use [App API keys](/developer/api/getting-started#app-api-keys)

- I'm a developer using [whop for platforms](/supported-business-models/platforms) I want to retrieve payment details for payments made to a connected account of my platform.

  -> Use [Company API keys](/developer/api/getting-started#company-api-keys) of the main "platform" company.

- I'm a developer and I want to let users sign in with Whop and access their data on their behalf.

  -> Use [OAuth tokens](/developer/guides/oauth)

<Info>
  Access to different features of our api is controlled by a fine-grained permission system, allowing you to implement strong security practices in your applications.
  Always make sure your api key has the required permissions enabled for your desired usage. Each endpoint will document the required permission scopes.
</Info>

# API Keys

<AccordionGroup>
  <Accordion title="Company API keys" icon="building">
    Use company API keys when you only want to fetch data, or perform actions for your own company,
    and or [connected account companies](/supported-business-models/platforms).

    1. Go to [your developer dashboard](https://whop.com/dashboard/developer).
    2. Click the "Create" button in the "Company API Keys" section
    3. Give your api key a name. For example "Data pipeline" or "GHL Integration"
    4. Select a role or a custom set of permissions. (You can always update this later and add more if you need)
    5. Create the api key, and copy it from the modal.

  </Accordion>

  <Accordion title="App API keys" icon="code">
    Use app API keys when you are building an app and need to access data on companies that have installed your app.

    1. Go to [your developer dashboard](https://whop.com/dashboard/developer).
    2. Click the **Create app** button and give your app a name. *You can change this name later.*
    3. Your API key is the hidden text after `WHOP_API_KEY` in the `Environment variables` section.
       Use the reveal button to show the key, copy it and keep it in a safe place.
       You will need it to make API calls.

  </Accordion>

  <Accordion title="OAuth tokens" icon="user">
    Use OAuth tokens when you want users to sign in with their Whop account and grant your app permission to act on their behalf. Unlike API keys which use your app's permissions, OAuth tokens are scoped to what each individual user can access.

    Common use cases:

    * "Sign in with Whop" authentication
    * Accessing a user's memberships, purchases, or profile
    * Performing actions as a specific user (not as your app)

    OAuth tokens are obtained through the OAuth 2.1 + PKCE flow:

    1. Redirect users to Whop's authorization page
    2. User logs in and approves your requested scopes
    3. Exchange the authorization code for access and refresh tokens
    4. Use the access token as your API key in SDK calls or the `Authorization` header

    See the [OAuth guide](/developer/guides/oauth) for full implementation details.

  </Accordion>
</AccordionGroup>

# Making API calls

Our public api is available at `https://api.whop.com/api/v1`

You can test the api by using curl to fetch your public user profile data:

```bash theme={null}
# replace "j" with your own whop username
curl https://api.whop.com/api/v1/users/j
```

To make authenticated requests you need to include your API key in the `Authorization` header using the `Bearer` scheme:

```bash theme={null}
# replace "YOUR_API_KEY" with your real API key
curl https://api.whop.com/api/v1/payments?company_id=biz_xxxxxxxxxxx \
    -H "Authorization: Bearer YOUR_API_KEY"
```

# Whop SDKs

We recommending using our SDKs to make API calls in your apps. We currently support

- [Typescript / Javascript](https://npmjs.com/package/@whop/sdk) / [Docs](https://github.com/whopio/whopsdk-typescript)

  ```bash theme={null}
  pnpm install @whop/sdk
  ```

- [Python](https://pypi.org/project/whop-sdk) / [Docs](https://github.com/whopio/whopsdk-python)

  ```bash theme={null}
  pip install whop-sdk
  ```

- [Ruby](https://rubygems.org/gems/whop-sdk) / [Docs](https://github.com/whopio/whopsdk-ruby)

  ```bash theme={null}
  gem install whop_sdk
  ```

## Example usage

<Note>
  Make sure your api key has the required permissions to make api calls. If building an app, see
  [Permissions](/developer/guides/permissions) for more information.
</Note>

<CodeGroup>
  ```typescript Typescript theme={null}
  import Whop from "@whop/sdk";

const client = new Whop({
apiKey: process.env["WHOP_API_KEY"], // This is the default and can be omitted
appID: "app_xxxxxxxxxxxxxx", // only required when building an app
});

const page = await client.payments.list({ company_id: "biz_xxxxxxxxxxxxxx" });
const paymentListResponse = page.data[0];

console.log(paymentListResponse.id);

````

```python Python theme={null}
import os
from whop_sdk import Whop

client = Whop(
    api_key=os.environ.get("WHOP_API_KEY"),  # This is the default and can be omitted
    app_id="app_xxxxxxxxxxxxxx", # only required when building an app
)

page = client.payments.list(
    company_id="biz_xxxxxxxxxxxxxx",
)
print(page.data)
````

```ruby Ruby theme={null}
require "bundler/setup"
require "whop_sdk"

whop = WhopSDK::Client.new(
  api_key: ENV["WHOP_API_KEY"], # This is the default and can be omitted
  app_id: "app_xxxxxxxxxxxxxx", # only required when building an app
)

page = whop.payments.list(company_id: "biz_xxxxxxxxxxxxxx")

puts(page.id)
```

</CodeGroup>

## MCP

You can also access the API via our mcp server available at
`https://mcp.whop.com/mcp` (cursor) or `https://mcp.whop.com/sse` (claude)

[Learn more here](/developer/guides/ai_and_mcp)

# Accept payments

Source: https://docs.whop.com/developer/guides/accept-payments

Create checkout links or embed a checkout flow in your app

Accept one-time and recurring payments using checkout links or an embedded checkout component.

To initiate a checkout you need a plan, and optionally a checkout configuration.

Plans specify the price shown at checkout and type of purchase (either `one_time` or `renewal`) as well as many other configurable options. Plans can be created manually in the [dashboard](https://whop.com/dashboard/links/checkout) or [via the API](/api-reference/plans/create-plan).

A checkout configuration allows you to attach custom metadata and redirect URLs to one or more checkouts created from it. These can only be created [via the API](/api-reference/checkout-configurations/create-checkout-configuration).

## Option 1: Create a checkout link

Checkout links are the simplest way to accept payments. Create a plan to get a shareable checkout URL.

<Tabs>
  <Tab title="Dashboard">
    1. Go to your [Dashboard](https://whop.com/dashboard/links/checkout) > **Checkout links**
    2. Click **+ Create checkout link**
    3. Select a product and configure your pricing (free, one-time, or recurring)
    4. Click **Create checkout link**

    The generated link can be shared directly with customers or embedded on your website.

  </Tab>

  <Tab title="API">
    Create a plan via the API to get a `purchase_url`:

    <CodeGroup>
      ```typescript TypeScript theme={null}
      import Whop from "@whop/sdk";

      const client = new Whop({
        apiKey: "Company API Key",
      });

      const plan = await client.plans.create({
        company_id: "biz_xxxxxxxxxxxxx",
        access_pass_id: "pass_xxxxxxxxxxxxx",
        initial_price: 10.0,
        plan_type: "one_time",
      });

      console.log(plan.purchase_url);
      ```

      ```python Python theme={null}
      from whop_sdk import Whop

      client = Whop(
          api_key="my_api_key",
      )

      plan = client.plans.create(
          company_id="biz_xxxxxxxxxxxxx",
          access_pass_id="pass_xxxxxxxxxxxxx",
          initial_price=10.0,
          plan_type="one_time",
      )

      print(plan.purchase_url)
      ```
    </CodeGroup>

    Redirect customers to the `purchase_url` to complete payment on a Whop-hosted checkout page.

  </Tab>
</Tabs>

## Option 2: Embedded checkout

For a custom checkout experience, use the embedded checkout component with a checkout configuration.

### Step 1: Create a checkout configuration

Create a checkout configuration on your server with an inline plan:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import Whop from "@whop/sdk";

const client = new Whop({
apiKey: "Company API Key",
});

const checkoutConfig = await client.checkoutConfigurations.create({
company_id: "biz_xxxxxxxxxxxxx",
plan: {
initial_price: 10.0,
plan_type: "one_time",
},
metadata: {
order_id: "order_12345",
},
});

console.log(checkoutConfig.id);

````

```python Python theme={null}
from whop_sdk import Whop

client = Whop(
    api_key="my_api_key",
)

checkout_config = client.checkout_configurations.create(
    company_id="biz_xxxxxxxxxxxxx",
    plan={
        "initial_price": 10.0,
        "plan_type": "one_time",
    },
    metadata={
        "order_id": "order_12345",
    },
)

print(checkout_config.id)
````

</CodeGroup>

In this example:

- `company_id` is your company ID
- `plan.initial_price` is the payment amount
- `plan.plan_type` is either `one_time` or `renewal` for subscriptions
- `metadata` stores custom data for your reference

### Step 2: Render the checkout

Use the embedded checkout component to render the payment form on the client:

```tsx theme={null}
import { WhopCheckoutEmbed } from '@whop/checkout/react'

export function Checkout({ sessionId }: { sessionId: string }) {
  return (
    <WhopCheckoutEmbed
      sessionId={sessionId}
      returnUrl="https://yoursite.com/checkout/complete"
      onComplete={(paymentId) => {
        console.log('Payment complete:', paymentId)
      }}
    />
  )
}
```

Pass the `checkoutConfig.id` from step 1 as the `sessionId` prop.

The `returnUrl` is required to handle redirects from external payment providers. When redirected, check the `status` query parameter:

- **success**: The payment succeeded. Use the receipt information to render a success page.
- **error**: The payment failed or was canceled. Remount the checkout so your customer can try again.

## Handle payment webhooks

Listen for the `payment.succeeded` webhook to fulfill orders on your server:

```typescript theme={null}
import { waitUntil } from '@vercel/functions'
import type { Payment } from '@whop/sdk/resources.js'
import type { NextRequest } from 'next/server'
import { whopsdk } from '@/lib/whop-sdk'

export async function POST(request: NextRequest): Promise<Response> {
  const requestBodyText = await request.text()
  const headers = Object.fromEntries(request.headers)
  const webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers })

  if (webhookData.type === 'payment.succeeded') {
    waitUntil(handlePaymentSucceeded(webhookData.data))
  }

  return new Response('OK', { status: 200 })
}

async function handlePaymentSucceeded(payment: Payment) {
  console.log('Payment succeeded:', payment.id)
}
```

## API Reference

<Card title="Create Checkout Configuration API" icon="code" href="/api-reference/checkout-configurations/create-checkout-configuration">
  See the full API reference for creating checkout configurations
</Card>

## Related resources

<CardGroup>
  <Card title="Webhooks" icon="webhook" href="/developer/guides/webhooks">
    Handle payment events in real-time
  </Card>

  <Card title="Save payment methods" icon="credit-card" href="/developer/guides/save-payment-methods">
    Save and charge payment methods
  </Card>
</CardGroup>

# App Views

Source: https://docs.whop.com/developer/guides/app-views

Configure how and where your app appears on Whop

App views determine where and how your app is displayed on Whop. You can configure one or more views depending on your app's functionality and target audience.

Each view serves a different purpose and appears in a different context on the platform.

## Experience View

The experience view is where members interact with your app's core features. Apps with this view appear directly in the Whop sidebar alongside native features like chat, forums, and courses.

When creators install your app, they can create one or more experiences powered by your app. Each experience maps to a single item in the sidebar and can render unique custom content.

Each instance of your experience view has a unique experience id which looks like `exp_xxxxxxxx`.

<Frame>
  <img alt="Experience View" />
</Frame>

### When to use Experience View

Experience view is ideal for consumer-focused apps that members interact with regularly:

- LIVE quizzes and polls that run directly within communities
- Custom course delivery systems with interactive content
- Gated content libraries with videos, files, or downloads
- Community games and interactive experiences
- Real-time collaboration tools for members

### Configure Experience View

<Steps>
  <Step title="Go to your app's hosting settings">
    1. Go to the [developer dashboard](https://whop.com/dashboard/developer)
    2. Create a new app or select an existing one
    3. Scroll down to the **Hosting** section

    <Frame>
      <img alt="App Settings" />
    </Frame>

  </Step>

  <Step title="Enter your path">
    Enter your path for the experience view. The recommended default path is `/experiences/[experienceId]`.

    <Frame>
      <img alt="Experience View Path" />
    </Frame>

    * `[experienceId]` is used to provide the accessed experience ID: `/experiences/[experienceId] -> /experiences/exp_***`
    * `[restPath]` is used for deep linking to specific sections of your app: `/experiences/[experienceId]/[restPath] -> /experiences/exp_***/posts/1`

  </Step>
</Steps>

### Preview Experience View

<Steps>
  <Step title="Install your app">
    Click the install button or copy the installation link and visit it in your browser. You will be prompted to install your app into your whop.

    <Frame>
      <img alt="Install App Button" />
    </Frame>

    If you've already installed your app, you can access it from your whop.

    <Frame>
      <img alt="Whop Sidebar Apps Section" />
    </Frame>

  </Step>

  <Step title="Set the environment">
    1. Open the dev tools by clicking the **cog** button
    2. Set the environment to **localhost**

    <video />

  </Step>
</Steps>

### Validate experience access

Check if a user has access to an experience using the `checkAccess` method. The experience ID is passed as a path parameter when your app loads.

```typescript theme={null}
import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";

export default async function ExperiencePage({
    params,
}: {
    params: Promise<{ experienceId: string }>;
}) {
    const { experienceId } = await params;
    const { userId } = await whopsdk.verifyUserToken(await headers());

    const access = await whopsdk.users.checkAccess(
        experienceId,
        { id: userId }
    );

    if (!access.has_access) {
        return <div>Access denied</div>;
    }

    // access.access_level can be:
    // "customer" - User has a valid membership
    // "admin" - User is a team member

    return <div>Welcome to the experience!</div>;
}
```

See [Authentication - Customer app](/developer/guides/authentication#customer-app-experience-view) for more information.

### Examples

- [Next.js](https://github.com/whopio/whop-nextjs-app-template/blob/main/app/experiences/%5BexperienceId%5D/page.tsx)
- [React Native](https://github.com/whopio/whop-sdk-ts/blob/main/packages/create-react-native/template/src/views/experience-view.tsx)

## Dashboard View

The dashboard view appears directly in the creator's business dashboard. This view is designed for apps that help businesses grow and manage their operations.

Apps with dashboard views are accessible from the dashboard sidebar under the apps section, making them easy to find when creators need to manage business operations.

<Frame>
  <img alt="Dashboard View" />
</Frame>

### When to use Dashboard View

Dashboard view is ideal for B2B apps that help creators run their business:

- Analytics dashboards showing revenue, member growth, and engagement metrics
- Customer upsell tools that send targeted offers to loyal members
- Member management interfaces for organizing and segmenting customers
- Automated marketing campaigns and email builders
- Custom admin panels for managing app-specific settings

### Configure Dashboard View

<Steps>
  <Step title="Go to your app's hosting settings">
    1. Go to the [developer dashboard](https://whop.com/dashboard/developer)
    2. Create a new app or select an existing one
    3. Scroll down to the **Hosting** section

    <Frame>
      <img alt="App Settings" />
    </Frame>

  </Step>

  <Step title="Enter your path">
    Enter your path for the dashboard view. The recommended default path is `/dashboard/[companyId]`.

    <Frame>
      <img alt="Dashboard View Path" />
    </Frame>

    * `[companyId]` is used to provide the accessed company ID: `/dashboard/[companyId] -> /dashboard/biz_***`
    * `[restPath]` is used for deep linking to specific sections of your app: `/dashboard/[companyId]/[restPath] -> /dashboard/biz_***/posts/1`

  </Step>
</Steps>

### Preview Dashboard View

<Steps>
  <Step title="Install your app">
    Click the preview button next to the field, this will take you to your app's dashboard view. You will be prompted to install your app if you haven't already.

    <Frame>
      <img alt="Preview App Button" />
    </Frame>

    If you've already installed your app, you can access it from your dashboard under the **apps** section.

    <Frame>
      <img alt="Dashboard Sidebar Apps Section" />
    </Frame>

  </Step>

  <Step title="Set the environment">
    1. Open the dev tools by clicking the **cog** button
    2. Set the environment to **localhost**

    <video />

  </Step>
</Steps>

### Validate company access

Dashboard apps should only be accessible to admins of the company. Check access using the `checkAccess` method with the company ID.

```typescript theme={null}
import { headers } from "next/headers";
import { whopsdk } from "@/lib/whop-sdk";

export default async function DashboardPage({
    params,
}: {
    params: Promise<{ companyId: string }>;
}) {
    const { companyId } = await params;
    const { userId } = await whopsdk.verifyUserToken(await headers());

    const access = await whopsdk.users.checkAccess(
        companyId,
        { id: userId }
    );

    if (access.access_level !== "admin") {
        return <div>Admin access required</div>;
    }

    return <div>Welcome to the dashboard!</div>;
}
```

See [Authentication - Dashboard app](/developer/guides/authentication#dashboard-app-dashboard-view) for more information.

### Examples

- [Next.js](https://github.com/whopio/whop-nextjs-app-template/blob/main/app/dashboard/%5BcompanyId%5D/page.tsx)
- [React Native](https://github.com/whopio/whop-sdk-ts/blob/main/packages/create-react-native/template/src/views/dashboard-view.tsx)

## Choosing the right views

You can configure multiple views for your app depending on its functionality:

- **Consumer apps**: Use Experience View to serve members with interactive features
- **Business apps**: Use Dashboard View to help creators manage operations
- **Hybrid apps**: Use both views to serve both members and creators

Configure your views in the Hosting section of your app dashboard to get started.

# Authentication

Source: https://docs.whop.com/developer/guides/authentication

Authenticate and authorize the current user.

# Authenticating the current user

To figure out who is making a request to your app, the whop iframe will pass a JWT token
inside the `x-whop-user-token` header on every request made to your app from an embedded iframe.
Our SDKs includes methods that make it easy to verify and decode this JWT into a whop `user_id`.

<Info>Ensure your SDK client is setup. [Learn more here](/developer/getting-started)</Info>

<CodeGroup>
  ```typescript JS/TS + NextJS theme={null}
  import { headers } from "next/headers";
  import { whopsdk } from "@/lib/whop-sdk";

export default async function MyServerRenderedPage() {
const { userId } = await whopsdk.verifyUserToken(await headers());
// this function throws on validation failure. Ensure you handle errors,
// or pass `{ dontThrow: true }` as the second argument

      // ... the rest of your component / api route etc...

}

````

```javascript JS/TS + ExpressJS theme={null}
import express from "express";
import { whopsdk } from "./lib/whop-sdk";

const app = express();

app.get("/my-route", async (req, res) => {
    const { userId } = await whopsdk.verifyUserToken(req.headers);
    // this function throws on validation failure. Ensure you handle errors,
    // or pass `{ dontThrow: true }` as the second argument

    // ... the rest of your route handler
});
````

```python Python + FastAPI theme={null}
from fastapi import FastAPI, Request
from lib.whop_sdk import whopsdk

app = FastAPI()

@app.get("/my-route")
async def my_route(request: Request):
    result = await whopsdk.verify_user_token(request.headers)
    # this function throws on validation failure. Ensure you handle errors,
    # or pass `dont_throw=True` as a keyword argument

    user_id = result.user_id

    # ... the rest of your route handler
```

```ruby Ruby on Rails theme={null}
class MyController < ApplicationController
  def my_action
    auth_result = whopsdk.verify_user_token!(request.headers)
    # this function throws on validation failure. For a non-throwing version,
    # use `verify_user_token` which returns nil on failure

    user_id = auth_result.user_id

    # ... the rest of your controller action
  end
end
```

</CodeGroup>

This token can only be included for requests made to the `window.location.origin` of your app displayed in the iframe.
I.e. relative page navigations like `<a href="/sub_page">...</a>`, or fetches that don't specify
a domain. e.g. `await fetch("/api/quizzes")`. All these requests are sent to the `App.base_url` domain.

<Accordion title="My API is on a different domain">
  If your app frontend is running on `example.com` however, your API is running on `api.example.com`
  we recommend that you reverse proxy your api requests through `example.com/api` such that you can still receive
  and verify the `x-whop-user-token` header.

If your domain is on cloudflare, you can create an ["origin rule"](https://developers.cloudflare.com/rules/origin-rules/features/#dns-record)
from `/api` on `example.com` to rewrite to `api.example.com/api`.

If you use nextjs you can also [setup a rewrite](https://developers.cloudflare.com/rules/origin-rules/features/#dns-record) in your `next.config.mjs`.

Rewriting like this can also be configured in `nginx` and `caddy` and many other popular services.
Refer to your respective server documentation for how to handle this.

  <Note>
    This setup is required due to the strict browser cross origin cookie policies.
  </Note>
</Accordion>

## Local setup

When developing locally, whop provides a locally runnable reverse proxy that perfectly matches the behaviour of the production setup.
This means you don't need to change your code to support local development.
[Learn how set it up here.](/developer/guides/dev-proxy)

# Authorization

Now that you know who is making a request, you need to check their access level. This ensures you only show content to users with the appropriate permissions.

The Whop API and SDKs provide a [`checkAccess`](/api-reference/users/check-access) method to verify access to an Experience, Company, or Product.

## Check Access

<CodeGroup>
  ```typescript JS/TS theme={null}
  import { whopsdk } from "@/lib/whop-sdk";

const response = await whopsdk.users.checkAccess(
"resource_id",
{ id: "user_xxxxxxxxxxxxx" }
);

// Response:
// {
// "has_access": true,
// "access_level": "customer"
// }

````

```python Python theme={null}
response = whopsdk.users.check_access(
    resource_id="resource_id",
    id="user_xxxxxxxxxxxxx",
)

# Response:
# {
#   "has_access": True,
#   "access_level": "customer"
# }
````

```ruby Ruby theme={null}
response = whopsdk.users.check_access(
    "resource_id",
    id: "user_xxxxxxxxxxxxx"
)

# Response:
# {
#   "has_access": true,
#   "access_level": "customer"
# }
```

```bash cURL theme={null}
curl --request GET \
  --url https://api.whop.com/api/v1/users/{id}/access/{resource_id} \
  --header 'Authorization: Bearer <token>'
```

</CodeGroup>

### Resource IDs

The `resource_id` can be:

- **Company ID** (`biz_xxxx`) - Check access to a company
- **Product ID** (`prod_xxxx`) - Check access to a specific product
- **Experience ID** (`exp_xxxx`) - Check access to an experience

### Access Levels

The response includes an `access_level` field with one of three values:

- **`customer`** - User has a valid membership but is not a team member
  - For **experiences**: User has a valid membership to any product connected to the experience
  - For **products**: User has a valid membership to that specific product
  - For **companies**: User has a valid membership to any product on the company

- **`admin`** - User is a team member of the company (any role including moderator)

- **`no_access`** - User has no access (`has_access` will be `false`)

### Customer app (Experience View)

When you are building a customer app, you should ensure that users who visit your
app have access to the experience id that they are viewing the app for.

This experience id will be passed in path parameters dynamically as `experienceId`.

<CodeGroup>
  ```typescript Server Component theme={null}
  import { headers } from "next/headers";
  import { whopsdk } from "@/lib/whop-sdk";

export default async function ExperiencePage({
params,
}: {
params: Promise<{ experienceId: string }>;
}) {
const { experienceId } = await params;
const { userId } = await whopsdk.verifyUserToken(await headers());

      const access = await whopsdk.users.checkAccess(
          experienceId,
          { id: userId }
      );

      if (!access.has_access) {
          return <div>Access denied</div>;
      }

      return <div>Welcome to the experience!</div>;

}

````

```typescript API Route theme={null}
import { whopsdk } from "@/lib/whop-sdk";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ experienceId: string }> }
) {
    const { experienceId } = await params;
    const { userId } = await whopsdk.verifyUserToken(request.headers);

    const access = await whopsdk.users.checkAccess(
        experienceId,
        { id: userId }
    );

    if (!access.has_access) {
        return new Response("Access denied", { status: 403 });
    }

    return Response.json({ message: "Welcome!" });
}
````

</CodeGroup>

### Dashboard app (Dashboard View)

Dashboard apps should only be accessible to admins of the company.

The company id will be passed in the path parameters when your app is loaded as `companyId`.

<CodeGroup>
  ```typescript Server Component theme={null}
  import { headers } from "next/headers";
  import { whopsdk } from "@/lib/whop-sdk";

export default async function DashboardPage({
params,
}: {
params: Promise<{ companyId: string }>;
}) {
const { companyId } = await params;
const { userId } = await whopsdk.verifyUserToken(await headers());

      const access = await whopsdk.users.checkAccess(
          companyId,
          { id: userId }
      );

      if (access.access_level !== "admin") {
          return <div>Admin access required</div>;
      }

      return <div>Welcome to the dashboard!</div>;

}

````

```typescript API Route theme={null}
import { whopsdk } from "@/lib/whop-sdk";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ companyId: string }> }
) {
    const { companyId } = await params;
    const { userId } = await whopsdk.verifyUserToken(request.headers);

    const access = await whopsdk.users.checkAccess(
        companyId,
        { id: userId }
    );

    if (access.access_level !== "admin") {
        return new Response("Admin access required", { status: 403 });
    }

    return Response.json({ message: "Welcome to dashboard!" });
}
````

</CodeGroup>

# Chat

Source: https://docs.whop.com/developer/guides/chat

Send and read messages from whop chat

<Note type="warning">
  **These docs are still under construction**

We're still working on adding:

- Sending messages with custom sender name + image from apps
- SSE events to live listen to reactions and new chat messages
  </Note>

## What's Currently Supported

The new SDK already supports the following chat functionality:

- **Chat Channels**: Retrieve, update settings, and list chat channels
- **Messages**: Create, retrieve, and list messages in channels
- **Support Channels**: Create, retrieve, and list support channels
- **Reactions**: Add, retrieve, and list reactions on messages

## Basic Usage

### Initialize the SDK

```typescript theme={null}
import Whop from '@whop/sdk'

const client = new Whop({
  appID: 'app_xxxxxxxxxxxxxx',
  apiKey: process.env['WHOP_API_KEY'],
})
```

### Sending Messages

```typescript theme={null}
// Create a message in a chat channel
const message = await client.messages.create({
  channel_id: 'channel_id_or_experience_id',
  content: 'Hello world! **Markdown** is supported',
  attachments: [
    {
      direct_upload_id: 'upload_id_from_S3',
    },
  ],
})
```

### Reading Messages

```typescript theme={null}
// List messages in a channel with auto-pagination
for await (const messageListResponse of client.messages.list({
  channel_id: 'channel_id_or_experience_id',
  direction: 'desc',
  first: 20,
})) {
  console.log(messageListResponse)
}

// Retrieve a specific message
const message = await client.messages.retrieve('message_id')
```

### Managing Chat Channels

```typescript theme={null}
// Retrieve a chat channel
const chatChannel = await client.chatChannels.retrieve('id')

// Update chat channel settings
const updatedChannel = await client.chatChannels.update('id', {
  ban_media: false,
  ban_urls: false,
  banned_words: ['word1', 'word2'],
  user_posts_cooldown_seconds: 10,
  who_can_post: 'everyone', // 'everyone' | 'members_only' | 'admins_only'
  who_can_react: 'everyone', // 'everyone' | 'members_only' | 'admins_only'
})

// List chat channels in a company
for await (const chatChannelListResponse of client.chatChannels.list({
  company_id: 'biz_xxxxxxxxxxxxxx',
  product_id: 'product_id_optional',
  first: 10,
})) {
  console.log(chatChannelListResponse)
}
```

### Adding Reactions

```typescript theme={null}
// Create a reaction on a message
const reaction = await client.reactions.create({
  resource_id: 'message_id',
  emoji: '😀', // Unicode emoji or ':heart:' format
})

// List reactions on a message
for await (const reactionListResponse of client.reactions.list({
  resource_id: 'message_id',
  first: 20,
})) {
  console.log(reactionListResponse)
}
```

### Support Channels

```typescript theme={null}
// Create or get existing support channel for a user
const supportChannel = await client.supportChannels.create({
  company_id: 'biz_xxxxxxxxxxxxxx',
  user_id: 'user_xxxxxxxxxxxxx',
})

// List support channels (e.g., for a support dashboard)
for await (const supportChannelListResponse of client.supportChannels.list({
  company_id: 'biz_xxxxxxxxxxxxxx',
  open: true, // Filter for unresolved channels
  order: 'last_post_sent_at',
  direction: 'desc',
  first: 10,
})) {
  console.log(supportChannelListResponse)
}
```

## Required Permissions

Make sure your app has the following permissions enabled:

- `chat:read` - For reading messages, channels, and reactions
- `chat:message:create` - For creating messages
- `chat:moderate` - For updating chat channel settings
- `support_chat:create` - For creating support channels
- `support_chat:read` - For reading support channels

## Message Structure

Messages returned from the API include:

```typescript theme={null}
{
  id: string;
  content: string | null;
  created_at: string;
  is_edited: boolean;
  is_pinned: boolean;
  message_type: 'text' | 'image' | 'video' | 'poll';
  poll: {
    options: Array<{ id: string; text: string }> | null;
  } | null;
  poll_votes: Array<{
    count: number;
    option_id: string | null;
  }>;
  reaction_counts: Array<{
    count: number;
    emoji: string | null;
  }>;
  replying_to_message_id: string | null;
  updated_at: string;
  user: {
    id: string;
    name: string | null;
    username: string;
  };
}
```

# Authentication

Source: https://docs.whop.com/developer/guides/chat/authentication

Set up OAuth authentication for embedded chat

<PlatformSelect>
  Before using the chat SDK, you need to configure OAuth authentication.

## Setup

1. Register your app in the [Whop Dashboard](https://whop.com/dashboard/) > Developer to get an app ID

  <Platform>
    2) Inside the app you just created, go to OAuth and add a redirect URL. Use your app's callback URL (e.g., `https://yourapp.com/oauth/callback`)
  </Platform>

  <Platform>
    2. Inside the app you just created, go to OAuth and add a redirect URL. Use your app's callback URL (e.g., `https://yourapp.com/oauth/callback`)
  </Platform>

  <Platform>
    2. Inside the app you just created, go to OAuth and add a redirect URL. Use your bundle ID (e.g., `com.yourapp.bundle://oauth/callback`) or configure a custom one
  </Platform>

3. On the same page, copy the required scopes from "View available scopes"

## Required scopes

Your OAuth configuration should include these scopes:

| Scope                                                  | Purpose            |
| ------------------------------------------------------ | ------------------ |
| `openid`, `profile`, `email`                           | Basic profile info |
| `chat:message:create`, `chat:read`                     | Experience chats   |
| `dms:read`, `dms:message:manage`, `dms:channel:manage` | Direct messages    |

  <Card title="OAuth guide" icon="key" href="/developer/guides/oauth">
    See the full OAuth guide for setting up authentication and obtaining tokens
  </Card>

  <Platform>
    ## Token endpoint

    Your server needs to provide a token endpoint that returns a valid OAuth token with the required scopes. The chat elements call this function whenever they need to authenticate.

    ```typescript theme={null}
    async function getToken() {
      const response = await fetch("/api/token");
      const data = await response.json();
      return data.token;
    }
    ```

    See the [OAuth guide](/developer/guides/oauth) for implementing the server-side token exchange.

  </Platform>

  <Platform>
    ## Token endpoint

    Your server needs to provide a token endpoint that returns a valid OAuth token with the required scopes. The chat elements call this function whenever they need to authenticate.

    ```typescript theme={null}
    async function getToken() {
      const response = await fetch("/api/token");
      const data = await response.json();
      return data.token;
    }
    ```

    See the [OAuth guide](/developer/guides/oauth) for implementing the server-side token exchange.

  </Platform>

  <Platform>
    ## Authentication setup

    The SDK supports two authentication approaches. Choose the one that fits your app:

    | Approach                  | Best for                                                                                                   |
    | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
    | **SDK-managed OAuth**     | Apps that don't have their own auth. The SDK shows a sign-in webview and manages tokens automatically      |
    | **Bring your own tokens** | Apps that already authenticate users via a backend. You provide tokens directly and skip the OAuth webview |

    ***

    ### Option A: SDK-managed OAuth

    Call `configureWithOAuth` on app launch. The SDK handles the entire flow: showing a sign-in webview, obtaining tokens, and refreshing them automatically.

    ```swift theme={null}
    .task {
        await WhopSDK.configureWithOAuth(
            appId: "app_XXXXXXXXXXXXXX",
            scopes: [
                "openid", "profile", "email",
                "chat:message:create", "chat:read",
                "dms:read", "dms:message:manage", "dms:channel:manage",
            ]
        )
    }
    ```

    By default, the SDK uses your bundle identifier for the redirect URI (`com.yourapp.bundle://oauth/callback`). You can customize this:

    ```swift theme={null}
    await WhopSDK.configureWithOAuth(
        appId: "app_XXXXXXXXXXXXXX",
        redirectUri: "myapp://auth/callback",
        scopes: [
            "openid", "profile", "email",
            "chat:message:create", "chat:read",
            "dms:read", "dms:message:manage", "dms:channel:manage",
        ]
    )
    ```

    Make sure the redirect URI matches what you configured in the [Whop Dashboard](https://whop.com/dashboard/) > Developer > App > OAuth.

    When a user navigates to a chat view, the OAuth flow is triggered automatically if they're not already authenticated. You can also trigger sign-in and sign-out manually:

    ```swift theme={null}
    // Sign in
    try await WhopSDK.signIn()

    // Sign out
    WhopSDK.signOut()
    ```

    #### Tracking authentication state

    Use the `.whopAuthState` modifier to reactively track whether the user is signed in:

    ```swift theme={null}
    struct ChatView: View {
        @State private var isAuthenticated = false

        var body: some View {
            VStack {
                if isAuthenticated {
                    Text("Signed In")
                } else {
                    Text("Not Signed In")
                }
            }
            .whopAuthState($isAuthenticated)
        }
    }
    ```

    #### Pre-filling tokens (optional)

    If you already have the user's Whop tokens from another source (e.g. a web OAuth flow or synced from your backend), you can pre-fill them to skip the sign-in webview on first launch. This is entirely optional and only relevant if your users have already authenticated with Whop elsewhere.

    ```swift theme={null}
    let tokens = await myBackend.getWhopTokens(for: currentUser)

    try await WhopSDK.preSignIn(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
    )
    ```

    The SDK extracts the token expiration from the JWT and handles refresh automatically. If the pre-filled tokens expire and can't be refreshed, the normal OAuth flow kicks in.

    ***

    ### Option B: Bring your own tokens

    If your app already has its own authentication system, you can provide a custom token provider instead of using the SDK's OAuth flow. This works the same way as the [payouts SDK](/developer/platforms/render-payout-portal). Your backend is responsible for obtaining and refreshing tokens.

    Create a class that conforms to `WhopTokenProvider` and implement the `getToken` method. The SDK calls this method when authentication is needed and before the current token expires.

    ```swift theme={null}
    import WhopElements

    class MyTokenProvider: WhopTokenProvider {
        /// Return an access token fetched from your backend.
        ///
        /// Called when a chat view appears and
        /// before expiration (within 60 seconds).
        func getToken() async -> WhopTokenResponse {
            let token = await fetchAccessToken()
            return WhopTokenResponse(accessToken: token)
        }
    }
    ```

    Then pass the token provider when configuring the SDK:

    ```swift theme={null}
    let tokenProvider = MyTokenProvider()

    WhopSDK.configure(tokenProvider: tokenProvider)
    ```

    This approach is useful when:

    * Your app has its own auth system and you want full control over token management
    * Your backend already handles Whop OAuth and can issue tokens
    * You want to avoid showing the SDK's sign-in webview

  </Platform>
</PlatformSelect>

# Chat element

Source: https://docs.whop.com/developer/guides/chat/chat-element

Display a chat channel in your app

<PlatformSelect>
  The chat element renders a real-time chat UI connected to a specific channel.

### Basic usage

Pass a `channelId` to connect to a specific chat channel.

  <Platform>
    ```tsx theme={null}
    import { useMemo } from "react";
    import {
      ChatElement,
      ChatSession,
      Elements,
    } from "@whop/embedded-components-react-js";
    import { loadWhopElements } from "@whop/embedded-components-vanilla-js";
    import type { ChatElementOptions } from "@whop/embedded-components-vanilla-js/types";

    const elements = loadWhopElements();

    async function getToken() {
      const response = await fetch("/api/token");
      const data = await response.json();
      return data.token;
    }

    export function ChatPage() {
      const chatOptions: ChatElementOptions = useMemo(() => {
        return {
          channelId: "chat_XXXXXXXXXXXXXX",
        };
      }, []);

      return (
        <Elements elements={elements}>
          <ChatSession token={getToken}>
            <ChatElement
              options={chatOptions}
              style={{ height: "100dvh", width: "100%" }}
            />
          </ChatSession>
        </Elements>
      );
    }
    ```

  </Platform>

  <Platform>
    ```typescript theme={null}
    import { loadWhopElements } from "@whop/embedded-components-vanilla-js";

    async function getToken() {
      const response = await fetch("/api/token");
      const data = await response.json();
      return data.token;
    }

    const whopElements = await loadWhopElements();

    const session = whopElements.createChatSession({
      token: getToken,
    });

    const chatElement = session.createElement("chat-element", {
      channelId: "chat_XXXXXXXXXXXXXX",
    });

    chatElement.mount("#chat-container");
    ```

  </Platform>

  <Platform>
    Display a chat channel with `WhopChatView`:

    ```swift theme={null}
    import SwiftUI
    import WhopElements

    struct ChatView: View {
        var body: some View {
            WhopChatView(
                channelId: "chat_XXXXXXXXXXXXXX",
                style: .imessage
            )
        }
    }
    ```

  </Platform>

### Deeplinking to messages

To scroll to and highlight a specific message, pass `deeplinkToPostId` in your options. The view will automatically navigate to that message.

  <Platform>
    ```tsx theme={null}
    const chatOptions: ChatElementOptions = useMemo(() => {
      return {
        channelId: "chat_XXXXXXXXXXXXXX",
        deeplinkToPostId: "post_XXXXXXXXXXXXXX",
      };
    }, []);

    <ChatElement options={chatOptions} />
    ```

  </Platform>

  <Platform>
    ```typescript theme={null}
    const chatElement = session.createElement("chat-element", {
      channelId: "chat_XXXXXXXXXXXXXX",
      deeplinkToPostId: "post_XXXXXXXXXXXXXX",
    });

    chatElement.mount("#chat-container");
    ```

  </Platform>

  <Platform>
    When `deeplinkToPostId` changes, the chat will automatically navigate to the new message.

    ```swift theme={null}
    struct ChatView: View {
        @State private var targetPostId: String? = nil

        var body: some View {
            WhopChatView(
                channelId: "chat_XXXXXXXXXXXXXX",
                deeplinkToPostId: targetPostId,
                style: .imessage
            )
        }
    }
    ```

  </Platform>

### Event handling

Listen to user interactions like profile clicks, link clicks, and sent messages using the `onEvent` callback.

  <Platform>
    | Event          | Detail                             | Description                               |
    | -------------- | ---------------------------------- | ----------------------------------------- |
    | `profileClick` | `{ id: string; username: string }` | Emitted when the user clicks on a profile |
    | `linkClick`    | `{ url: string }`                  | Emitted when the user clicks on a link    |
    | `messageSent`  | `{ content: string }`              | Emitted when the user sends a message     |

    ```tsx theme={null}
    import { useCallback, useMemo } from "react";
    import type { ChatElementEvent, ChatElementOptions } from "@whop/embedded-components-vanilla-js/types";

    const handleChatEvent = useCallback((event: ChatElementEvent) => {
      switch (event.type) {
        case "profileClick":
          console.log("Profile clicked:", event.detail.id);
          break;

        case "linkClick":
          console.log("Link clicked:", event.detail.url);
          break;

        case "messageSent":
          console.log("Message sent:", event.detail.content);
          break;
      }
    }, []);

    const chatOptions: ChatElementOptions = useMemo(() => {
      return {
        channelId: "chat_XXXXXXXXXXXXXX",
        onEvent: handleChatEvent,
      };
    }, [handleChatEvent]);

    <ChatElement options={chatOptions} />
    ```

  </Platform>

  <Platform>
    | Event          | Detail                             | Description                               |
    | -------------- | ---------------------------------- | ----------------------------------------- |
    | `profileClick` | `{ id: string; username: string }` | Emitted when the user clicks on a profile |
    | `linkClick`    | `{ url: string }`                  | Emitted when the user clicks on a link    |
    | `messageSent`  | `{ content: string }`              | Emitted when the user sends a message     |

    ```typescript theme={null}
    const chatElement = session.createElement("chat-element", {
      channelId: "chat_XXXXXXXXXXXXXX",
    });

    chatElement.on("profileClick", (ev) => {
      console.log("Profile clicked:", ev.detail.id);
    });

    chatElement.on("linkClick", (ev) => {
      console.log("Link clicked:", ev.detail.url);
    });

    chatElement.on("messageSent", (ev) => {
      console.log("Message sent:", ev.detail.content);
    });

    chatElement.mount("#chat-container");
    ```

  </Platform>

  <Platform>
    | Event          | Detail             | Description                             |
    | -------------- | ------------------ | --------------------------------------- |
    | `.profileTap`  | `username: String` | Emitted when the user taps on a profile |
    | `.urlTap`      | `url: String`      | Emitted when the user taps on a link    |
    | `.messageSent` | `content: String`  | Emitted when the user sends a message   |

    ```swift theme={null}
    WhopChatView(
        channelId: "chat_XXXXXXXXXXXXXX",
        style: .imessage,
        onEvent: { event in
            switch event {
            case let .profileTap(username):
                print("Profile tapped: \(username)")
            case let .urlTap(url):
                print("URL tapped: \(url)")
            case let .messageSent(content):
                print("Message sent: \(content)")
            }
        }
    )
    ```

  </Platform>
</PlatformSelect>

# DMs list element

Source: https://docs.whop.com/developer/guides/chat/dms-list-element

Display a list of direct message conversations

<PlatformSelect>
  The DMs list element renders a navigable list of the user's direct message conversations.

### Basic usage

Mount the DMs list and listen for channel selection events to navigate users into a conversation.

  <Platform>
    ```tsx theme={null}
    import { useCallback, useMemo, useState } from "react";
    import {
      ChatSession,
      DmsListElement,
      Elements,
    } from "@whop/embedded-components-react-js";
    import { loadWhopElements } from "@whop/embedded-components-vanilla-js";
    import type { DmsListElementEvent, DmsListElementOptions } from "@whop/embedded-components-vanilla-js/types";

    const elements = loadWhopElements();

    async function getToken() {
      const response = await fetch("/api/token");
      const data = await response.json();
      return data.token;
    }

    export function MessagesPage() {
      const [channelId, setChannelId] = useState<string>();

      const handleDmsEvent = useCallback((event: DmsListElementEvent) => {
        switch (event.type) {
          case "channelSelected":
            setChannelId(event.detail.id);
            break;
        }
      }, []);

      const dmsOptions: DmsListElementOptions = useMemo(() => {
        return {
          selectedChannel: channelId,
          onEvent: handleDmsEvent,
        };
      }, [channelId, handleDmsEvent]);

      return (
        <Elements elements={elements}>
          <ChatSession token={getToken}>
            <DmsListElement options={dmsOptions} />
          </ChatSession>
        </Elements>
      );
    }
    ```

  </Platform>

  <Platform>
    ```typescript theme={null}
    import { loadWhopElements } from "@whop/embedded-components-vanilla-js";

    async function getToken() {
      const response = await fetch("/api/token");
      const data = await response.json();
      return data.token;
    }

    const whopElements = await loadWhopElements();

    const session = whopElements.createChatSession({
      token: getToken,
    });

    const dmsListElement = session.createElement("dms-list-element", {});

    dmsListElement.on("channelSelected", (ev) => {
      console.log("Channel selected:", ev.detail.id);
    });

    dmsListElement.mount("#dms-list-container");
    ```

  </Platform>

  <Platform>
    Display a list of the user's direct messages with `WhopDMsListView`. Listen for channel selection to navigate into a conversation.

    ```swift theme={null}
    struct MessagesView: View {
        @State private var selectedChannel: DMChannel?

        var body: some View {
            WhopDMsListView(
                onEvent: { event in
                    switch event {
                    case let .channelSelected(channel):
                        selectedChannel = channel
                    }
                }
            )
            .navigationDestination(item: $selectedChannel) { channel in
                WhopChatView(
                    channelId: channel.id,
                    style: .imessage
                )
                .navigationBarTitleDisplayMode(.inline)
                .navigationTitle(channel.name)
            }
        }
    }
    ```

  </Platform>

### Company scoping

Filter the DMs list to only show conversations belonging to a specific company by passing a `companyId`. To programmatically create DM channels, use the [Create DM Channel](/api-reference/dm-channels/create-dm-channel) endpoint — make sure to pass the same `companyId` so the channel appears in the scoped list.

  <Platform>
    ```tsx theme={null}
    const dmsOptions: DmsListElementOptions = useMemo(() => {
      return {
        companyId: "biz_xxxx",
        selectedChannel: channelId,
        onEvent: handleDmsEvent,
      };
    }, [channelId, handleDmsEvent]);

    return (
      <Elements elements={elements}>
        <ChatSession token={getToken}>
          <DmsListElement options={dmsOptions} />
        </ChatSession>
      </Elements>
    );
    ```

  </Platform>

  <Platform>
    ```typescript theme={null}
    const dmsListElement = session.createElement("dms-list-element", {
      companyId: "biz_xxxx",
    });

    dmsListElement.mount("#dms-list-container");
    ```

  </Platform>

  <Platform>
    ```swift theme={null}
    WhopDMsListView(
        companyId: "biz_xxxx",
        onEvent: { event in
            switch event {
            case let .channelSelected(channel):
                selectedChannel = channel
            }
        }
    )
    ```
  </Platform>

### Event handling

  <Platform>
    Listen for channel selection to open the corresponding chat view.

    | Event             | Detail           | Description                            |
    | ----------------- | ---------------- | -------------------------------------- |
    | `channelSelected` | `{ id: string }` | Emitted when the user clicks a channel |

    ```tsx theme={null}
    const handleDmsEvent = useCallback((event: DmsListElementEvent) => {
      switch (event.type) {
        case "channelSelected":
          setChannelId(event.detail.id);
          break;
      }
    }, []);
    ```

  </Platform>

  <Platform>
    Listen for channel selection to open the corresponding chat view.

    | Event             | Detail           | Description                            |
    | ----------------- | ---------------- | -------------------------------------- |
    | `channelSelected` | `{ id: string }` | Emitted when the user clicks a channel |

    ```typescript theme={null}
    dmsListElement.on("channelSelected", (ev) => {
      console.log("Channel selected:", ev.detail.id);
    });
    ```

  </Platform>

  <Platform>
    On iOS, channel selection is handled by navigating to a new view. Use the `.channelSelected` event to push a `WhopChatView` onto the navigation stack.

    | Event              | Detail               | Description                          |
    | ------------------ | -------------------- | ------------------------------------ |
    | `.channelSelected` | `channel: DMChannel` | Emitted when the user taps a channel |

    ```swift theme={null}
    WhopDMsListView(
        onEvent: { event in
            switch event {
            case let .channelSelected(channel):
                selectedChannel = channel
            }
        }
    )
    .navigationDestination(item: $selectedChannel) { channel in
        WhopChatView(
            channelId: channel.id,
            style: .imessage
        )
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle(channel.name)
    }
    ```

  </Platform>
</PlatformSelect>

# Quickstart

Source: https://docs.whop.com/developer/guides/chat/quickstart

Embed Whop chat in your app in minutes

<QuickStart
title="Embed chat in your app"
description={<>
Integrate Whop's real-time messaging directly into your web or iOS app. Choose your platform to get started.
</>}

>

### You're all set!

Your app now has a fully functional embedded chat. Explore the detail pages below to add DMs, customize theming, and more.

## Next steps

  <CardGroup>
    <Card title="Chat element" icon="message" href="/developer/guides/chat/chat-element">
      Full props reference, events, and deeplinking for the chat view.
    </Card>

    <Card title="DMs list element" icon="inbox" href="/developer/guides/chat/dms-list-element">
      Display a list of direct message conversations with navigation.
    </Card>

    <Card title="Authentication" icon="key" href="/developer/guides/chat/authentication">
      OAuth setup, manual sign-in, and pre-filling tokens.
    </Card>

    <Card title="Theming & styles" icon="palette" href="/developer/guides/chat/theming-and-styles">
      Customize the appearance of chat elements.
    </Card>

  </CardGroup>
</QuickStart>

# Theming & styles

Source: https://docs.whop.com/developer/guides/chat/theming-and-styles

Customize the appearance of chat elements

<PlatformSelect>
  <Platform>
    ## Theming

    Customize the appearance of chat elements by passing a `theme` inside the `appearance` option on the `Elements` provider.

    ```tsx theme={null}
    <Elements
      elements={elements}
      appearance={{
        theme: {
          appearance: "dark",
          accentColor: "blue",
          grayColor: "gray",
          dangerColor: "red",
          warningColor: "amber",
          successColor: "green",
          infoColor: "sky",
        },
      }}
    >
      <ChatSession token={getToken}>
        <ChatElement options={chatOptions} />
      </ChatSession>
    </Elements>
    ```

    ### Theme properties

    | Property       | Default   | Description                                               |
    | -------------- | --------- | --------------------------------------------------------- |
    | `appearance`   | —         | Light or dark mode (`"light"`, `"dark"`)                  |
    | `accentColor`  | `"blue"`  | Primary interactive elements (buttons, links, highlights) |
    | `grayColor`    | `"gray"`  | Neutral color palette for text, borders, and backgrounds  |
    | `dangerColor`  | `"red"`   | Destructive actions and error states                      |
    | `warningColor` | `"amber"` | Warning states                                            |
    | `successColor` | `"green"` | Success states                                            |
    | `infoColor`    | `"sky"`   | Informational highlights                                  |

    ### Available colors

    All color properties accept any of the following tints:

    `amber` · `blue` · `bronze` · `brown` · `crimson` · `cyan` · `gold` · `grass` · `gray` · `green` · `indigo` · `iris` · `jade` · `lemon` · `lime` · `magenta` · `mint` · `orange` · `pink` · `plum` · `purple` · `red` · `ruby` · `sky` · `teal` · `tomato` · `violet` · `yellow`

  </Platform>

  <Platform>
    ## Theming

    Customize the appearance of chat elements by passing a `theme` inside the `appearance` option.

    ```typescript theme={null}
    const whopElements = await loadWhopElements();

    whopElements.updateOptions({
      appearance: {
        theme: {
          appearance: "dark",
          accentColor: "blue",
          grayColor: "gray",
          dangerColor: "red",
          warningColor: "amber",
          successColor: "green",
          infoColor: "sky",
        },
      },
    });
    ```

    ### Theme properties

    | Property       | Default   | Description                                               |
    | -------------- | --------- | --------------------------------------------------------- |
    | `appearance`   | —         | Light or dark mode (`"light"`, `"dark"`)                  |
    | `accentColor`  | `"blue"`  | Primary interactive elements (buttons, links, highlights) |
    | `grayColor`    | `"gray"`  | Neutral color palette for text, borders, and backgrounds  |
    | `dangerColor`  | `"red"`   | Destructive actions and error states                      |
    | `warningColor` | `"amber"` | Warning states                                            |
    | `successColor` | `"green"` | Success states                                            |
    | `infoColor`    | `"sky"`   | Informational highlights                                  |

    ### Available colors

    All color properties accept any of the following tints:

    `amber` · `blue` · `bronze` · `brown` · `crimson` · `cyan` · `gold` · `grass` · `gray` · `green` · `indigo` · `iris` · `jade` · `lemon` · `lime` · `magenta` · `mint` · `orange` · `pink` · `plum` · `purple` · `red` · `ruby` · `sky` · `teal` · `tomato` · `violet` · `yellow`

  </Platform>

  <Platform>
    ## Theming

    Customize the color palette of chat views and the DMs list using `WhopTheme` and the `.whopTheme()` modifier. The theme propagates through SwiftUI's environment to all child SDK views.

    ```swift theme={null}
    struct ThemedMessagesView: View {
        @State private var selectedChannel: DMChannel?

        let theme = WhopTheme(
            accent: .plum,
            neutral: .gray,
            danger: .tomato,
            warning: .violet
        )

        var body: some View {
            WhopDMsListView(
                onEvent: { event in
                    switch event {
                    case let .channelSelected(channel):
                        selectedChannel = channel
                    }
                }
            )
            .whopTheme(theme)
            .navigationDestination(item: $selectedChannel) { channel in
                WhopChatView(
                    channelId: channel.id,
                    style: .imessage
                )
                .whopTheme(theme)
                .navigationBarTitleDisplayMode(.inline)
                .navigationTitle(channel.name)
            }
        }
    }
    ```

    ### Theme properties

    `WhopTheme` defines six semantic color slots, each accepting a `WhopTint` value:

    | Property  | Default  | Description                                                         |
    | --------- | -------- | ------------------------------------------------------------------- |
    | `accent`  | `.blue`  | Primary interactive elements (buttons, links, selection highlights) |
    | `neutral` | `.gray`  | Text, borders, and backgrounds                                      |
    | `danger`  | `.red`   | Destructive actions and error states                                |
    | `info`    | `.sky`   | Informational highlights                                            |
    | `success` | `.green` | Success states                                                      |
    | `warning` | `.amber` | Warning states                                                      |

    ### Available tints

    All properties accept any of the following `WhopTint` values that adapt to light and dark mode:

    `amber` · `blue` · `bronze` · `brown` · `crimson` · `cyan` · `gold` · `grass` · `gray` · `green` · `indigo` · `iris` · `jade` · `lemon` · `lime` · `magenta` · `mint` · `orange` · `pink` · `plum` · `purple` · `red` · `ruby` · `sky` · `teal` · `tomato` · `violet` · `yellow`

    ## Chat styles

    Choose between Discord-style or iMessage-style chat. iMessage style (bubble chat) is the default if not provided:

    ```swift theme={null}
    // iMessage style (bubble chat)
    WhopChatView(
        channelId: "chat_XXXXXXXXXXXXXX",
        style: .imessage
    )

    // Discord style (full-width messages)
    WhopChatView(
        channelId: "chat_XXXXXXXXXXXXXX",
        style: .discord
    )
    ```

  </Platform>
</PlatformSelect>

# Development Proxy

Source: https://docs.whop.com/developer/guides/dev-proxy

How to use the Whop development proxy

Use the development proxy to match the production whop proxy behaviour in your local setup.
This means authentication and headers will work out of the box on local too.

<Note>
  You can use this proxy with any application written in any language and any framework.
</Note>

## NextJS / Javascript app

<Steps>
  <Step title="Add the proxy as a dev dependency">
    <CodeGroup>
      ```bash pnpm theme={null}
      pnpm add -D @whop-apps/dev-proxy
      ```

      ```bash bun theme={null}
      bun install -D @whop-apps/dev-proxy
      ```

      ```bash npm theme={null}
      npm install -D @whop-apps/dev-proxy
      ```

      ```bash yarn theme={null}
      yarn add -D @whop-apps/dev-proxy
      ```
    </CodeGroup>

  </Step>

  <Step title="Update your package.json dev script">
    Update your `package.json` dev script to include the proxy.

    ```json theme={null}
    "scripts": {
        "dev": "whop-proxy --command 'next dev --turbopack'",
    }
    ```

    <Note>
      You can update the dev command to match your framework requirements.
      You can also wrap other commands with the proxy in a similar way.
    </Note>

  </Step>

  <Step title="Run the proxy">
    <CodeGroup>
      ```bash pnpm theme={null}
      pnpm dev
      ```

      ```bash npm theme={null}
      npm run dev
      ```

      ```bash yarn theme={null}
      yarn dev
      ```
    </CodeGroup>

  </Step>
</Steps>

## Standalone mode (other frameworks)

<Steps>
  <Step title="Run your app locally">
    Run your app on your local machine on some port, for example 5000.

    <CodeGroup>
      ```bash Python + FastAPI theme={null}
      uvicorn main:app --port 5000
      ```

      ```bash Ruby on Rails theme={null}
      rails server -p 5000
      ```

      ```bash Go theme={null}
      go run main.go --port 5000
      ```
    </CodeGroup>

  </Step>

  <Step title="Run the proxy in standalone mode">
    <CodeGroup>
      ```bash pnpm theme={null}
      pnpm dlx @whop-apps/dev-proxy --standalone --upstreamPort=5000 --proxyPort=3000
      ```

      ```bash bun theme={null}
      bunx @whop-apps/dev-proxy --standalone --upstreamPort=5000 --proxyPort=3000
      ```

      ```bash npm theme={null}
      npx @whop-apps/dev-proxy --standalone --upstreamPort=5000 --proxyPort=3000
      ```

      ```bash yarn theme={null}
      yarn dlx @whop-apps/dev-proxy --standalone --upstreamPort=5000 --proxyPort=3000
      ```
    </CodeGroup>

    <Note>
      This will run the proxy as an independent process. It will start a server on
      port 3000 and forward requests to port 5000 and append the user token in the
      headers.
    </Note>

  </Step>
</Steps>

## Proxy Command Options

The proxy can be configured using the following command line options:

```bash theme={null}
Usage: pnpm dlx @whop-apps/dev-proxy [options]

Options:

--proxyPort <port>      The port the proxy should listen on (3000 by default)
--upstreamPort <port>   The port the upstream server is listening on (set automatically by default)
--npmCommand <command>  The npm command to run to start the upstream server (dev by default)
--command <command>     The command to run to start the upstream server (npm run dev by default)
--standalone            Run the proxy as an independent process proxying requests from one port to another port. Ignores the command / npmCommand options.
```

# Forums

Source: https://docs.whop.com/developer/guides/forums

Make forum posts and read existing posts

<Note type="warning">
  **These docs are still under construction**

We're still working on adding:

- Sending forum posts with custom sender name + image from apps
- SSE events to live listen to reactions, forum posts, and comments
  </Note>

## What's Currently Supported

The new SDK already supports the following forum functionality:

- **Forum Posts**: Create, retrieve, and list forum posts
- **Comments**: Create and list comments on forum posts
- **Reactions**: Add and list reactions (likes) on forum posts

## Basic Usage

### Initialize the SDK

```typescript theme={null}
import Whop from '@whop/sdk'

const client = new Whop({
  appID: 'app_xxxxxxxxxxxxxx',
  apiKey: process.env['WHOP_API_KEY'],
})
```

### Creating Forum Posts

```typescript theme={null}
// Create a new forum post
const forumPost = await client.forumPosts.create({
  experience_id: 'exp_xxxxxxxxxxxxxx',
  content: 'This is the main body of the post in **Markdown** format',
  title: 'Optional title for paywalled posts',
  is_mention: false,
  pinned: false,
  paywall_amount: 0, // Optional paywall amount in cents
})
```

### Reading Forum Posts

```typescript theme={null}
// List forum posts with auto-pagination
for await (const forumPostListResponse of client.forumPosts.list({
  experience_id: 'exp_xxxxxxxxxxxxxx',
  pinned: false, // Optional - filter pinned posts
  first: 10,
})) {
  console.log(forumPostListResponse)
}

// Retrieve a specific forum post
const forumPost = await client.forumPosts.retrieve('post_id')
```

### Working with Comments

```typescript theme={null}
// Create a comment on a forum post
const comment = await client.forumPosts.create({
  experience_id: 'exp_xxxxxxxxxxxxxx',
  content: 'This is a comment on the post',
  parent_id: 'parent_post_id', // ID of the post you're commenting on
})

// List comments on a forum post
for await (const commentListResponse of client.forumPosts.list({
  experience_id: 'exp_xxxxxxxxxxxxxx',
  parent_id: 'parent_post_id',
  first: 10,
})) {
  console.log(commentListResponse)
}
```

### Adding Reactions (Likes)

```typescript theme={null}
// Create a reaction on a forum post
const reaction = await client.reactions.create({
  resource_id: 'post_id',
  emoji: ':heart:', // For forums, emoji is always :heart:
})

// List reactions on a forum post
for await (const reactionListResponse of client.reactions.list({
  resource_id: 'post_id',
  first: 20,
})) {
  console.log(reactionListResponse)
}
```

## Required Permissions

Make sure your app has the following permissions enabled:

- `forum:read` - For reading forum posts and comments
- `forum:post:create` - For creating forum posts and comments
- `chat:read` - For reading and creating reactions

## Forum Post Structure

Forum posts returned from the API include:

```typescript theme={null}
{
  id: string
  comment_count: number
  content: string | null
  is_edited: boolean
  is_pinned: boolean
  is_poster_admin: boolean
  like_count: number | null
  parent_id: string | null // null for top-level posts, set for comments
  title: string | null
  user: {
    id: string
    name: string | null
    username: string
  }
  view_count: number | null
}
```

## Advanced Features

### Pinned Posts

You can create pinned posts that appear at the top of the forum:

```typescript theme={null}
const pinnedPost = await client.forumPosts.create({
  experience_id: 'exp_xxxxxxxxxxxxxx',
  content: 'Important announcement!',
  pinned: true,
})
```

### Mentioning Users

Tag users in your forum posts to notify them:

```typescript theme={null}
const post = await client.forumPosts.create({
  experience_id: 'exp_xxxxxxxxxxxxxx',
  content: 'Hey <@username> check this out!',
})
```

Use `<@username>` format where `username` is the user's Whop username. They'll receive a notification when mentioned.

### Paywalled Posts

Create posts that require payment to view:

```typescript theme={null}
const paywalledPost = await client.forumPosts.create({
  experience_id: 'exp_xxxxxxxxxxxxxx',
  content: 'Exclusive content here',
  title: 'Premium Post',
  paywall_amount: 500, // $5.00 in cents
})
```

### Pagination

All list operations support cursor-based pagination:

```typescript theme={null}
// Get first page
const firstPage = await client.forumPosts.list({
  experience_id: 'exp_xxxxxxxxxxxxxx',
  first: 10,
})

// Get next page using cursor
const nextPage = await client.forumPosts.list({
  experience_id: 'exp_xxxxxxxxxxxxxx',
  first: 10,
  before: firstPage.cursor, // Use cursor from previous response
})
```

# Frosted UI

Source: https://docs.whop.com/developer/guides/frosted_ui

Use our UI kit and tailwind design system.

Frosted UI is Whop's comprehensive React component library and design system. It provides 60+ accessible components, a sophisticated color system, typography scale, and seamless dark mode support—all built on top of Radix UI primitives and Tailwind CSS.

## Installation

<Steps>
  <Step title="Install the package">
    <CodeGroup>
      ```bash pnpm theme={null}
      pnpm add @whop/react
      ```

      ```bash npm theme={null}
      npm install @whop/react
      ```

      ```bash yarn theme={null}
      yarn add @whop/react
      ```

      ```bash bun theme={null}
      bun install @whop/react
      ```
    </CodeGroup>

    <Note>
      The `@whop/react` package includes Frosted UI and all necessary dependencies.
    </Note>

  </Step>

  <Step title="Set up the WhopApp provider">
    Wrap your application with the `WhopApp` component in your root layout. This sets up the theme and iframe SDK.

    ```tsx theme={null}
    // app/layout.tsx
    import { WhopApp } from "@whop/react";

    export default function RootLayout({
        children,
    }: {
        children: React.ReactNode;
    }) {
        return (
            <html lang="en">
                <body>
                    <WhopApp accentColor="blue" appearance="inherit">
                        {children}
                    </WhopApp>
                </body>
            </html>
        );
    }
    ```

  </Step>

  <Step title="Configure Next.js (optional)">
    Use the `withWhopAppConfig` wrapper in your Next.js configuration:

    ```typescript theme={null}
    // next.config.ts
    import type { NextConfig } from "next";
    import { withWhopAppConfig } from "@whop/react/next.config";

    const nextConfig: NextConfig = {
        // your config options
    };

    export default withWhopAppConfig(nextConfig);
    ```

    <Note>
      This configures server actions and optimizes Frosted UI imports.
    </Note>

  </Step>

  <Step title="Set up Tailwind (optional)">
    If you're using Tailwind CSS, add the Frosted UI plugin to access design tokens:

    ```javascript theme={null}
    // tailwind.config.js
    import { frostedThemePlugin } from "@whop/react/tailwind";

    export default {
        content: ["./src/**/*.{js,ts,jsx,tsx}"],
        plugins: [frostedThemePlugin()],
    };
    ```

  </Step>
</Steps>

<Check>Frosted UI is now set up and ready to use!</Check>

---

## Typography

Frosted UI provides a comprehensive typography system with two main components: `Heading` and `Text`.

### Type Scale

Both components use a 10-step size scale (0-9):

| Size | Font Size | Usage               |
| ---- | --------- | ------------------- |
| 0    | 10px      | Smallest text       |
| 1    | 12px      | Small labels        |
| 2    | 14px      | Body text (small)   |
| 3    | 16px      | Body text (default) |
| 4    | 18px      | Emphasized text     |
| 5    | 20px      | Subheadings         |
| 6    | 24px      | Headings            |
| 7    | 28px      | Large headings      |
| 8    | 32px      | Display text        |
| 9    | 40px      | Hero text           |

### Text Component

```tsx theme={null}
import { Text } from "@whop/react";

<Text size="3" weight="medium">
    This is body text
</Text>

<Text size="1" color="gray">
    Small muted text
</Text>

<Text as="label" size="2" weight="bold">
    Form Label
</Text>
```

**Props:**

- `size`: `"0"` through `"9"` (default: `"3"`)
- `weight`: `"light"` | `"regular"` | `"medium"` | `"bold"`
- `align`: `"left"` | `"center"` | `"right"`
- `color`: Any accent color or `"gray"`
- `highContrast`: Increases contrast for accessibility
- `as`: `"span"` | `"div"` | `"p"` | `"label"`

### Heading Component

```tsx theme={null}
import { Heading } from "@whop/react";

<Heading size="6" as="h1">
    Page Title
</Heading>

<Heading size="4" as="h2" weight="medium">
    Section Heading
</Heading>
```

**Props:**

- `size`: `"0"` through `"9"` (default: `"6"`)
- `weight`: `"light"` | `"regular"` | `"medium"` | `"bold"`
- `align`: `"left"` | `"center"` | `"right"`
- `as`: `"h1"` | `"h2"` | `"h3"` | `"h4"` | `"h5"` | `"h6"`
- `color`: Any accent color or `"gray"`
- `highContrast`: Increases contrast for accessibility

### Other Typography Components

```tsx theme={null}
import { Code, Strong, Em, Kbd } from "@whop/react";

<Code>const example = "code";</Code>
<Strong>Bold text</Strong>
<Em>Italic text</Em>
<Kbd>⌘ K</Kbd>
```

---

## Colors

Frosted UI uses Radix color scales, providing 12-step color palettes with both solid and alpha variants.

### Accent Colors

27 accent colors are available:

**Regular Colors:** `tomato`, `red`, `ruby`, `crimson`, `pink`, `plum`, `purple`, `violet`, `iris`, `indigo`, `blue`, `cyan`, `teal`, `jade`, `green`, `grass`, `brown`, `orange`

**Bright Colors:** `sky`, `mint`, `lime`, `yellow`, `amber`, `lemon`, `magenta`

**Metallic Colors:** `gold`, `bronze`

### Gray Colors

6 gray scales with different color temperatures:

- `gray` - Pure neutral gray
- `mauve` - Slightly purple-tinted
- `slate` - Cool blue-tinted
- `sage` - Subtle green-tinted
- `olive` - Warm olive-tinted
- `sand` - Warm sandy-tinted
- `auto` - Automatically matches accent color

### Semantic Colors

Pre-configured colors for common use cases:

- **Danger:** `red` (default), `tomato`, `ruby`
- **Warning:** `amber` (default), `yellow`
- **Success:** `green` (default), `teal`, `jade`, `grass`
- **Info:** `sky` (default), `blue`

### Using Colors

```tsx theme={null}
import { Button, Badge, Text } from "@whop/react";

<Button color="blue">Primary Action</Button>
<Button color="red">Delete</Button>
<Badge color="green">Active</Badge>
<Text color="gray">Muted text</Text>
```

### Tailwind Color Classes

With the Tailwind plugin, you can use Frosted UI colors directly:

```tsx theme={null}
<div className="bg-blue-2 text-blue-11 border border-blue-6">
    Blue themed box
</div>

<div className="bg-red-a3 text-red-11">
    Red with alpha background
</div>
```

**Color Scale:**

- Steps 1-3: Backgrounds and subtle fills
- Steps 4-6: Borders and separators
- Steps 7-9: Interactive elements
- Steps 10-12: Text and high contrast elements

**Alpha Variants:**

- Use `{color}-a1` through `{color}-a12` for transparency

<Warning>
  With the `frostedUiPlugin()` added to your tailwind config, the default tailwind colors like `bg-blue-200` DO NOT WORK.
  Use `bg-blue-2` instead according to the above documentation.
</Warning>

---

## Dark Mode

Frosted UI includes automatic dark mode support that respects system preferences and user choices.

### How It Works

Dark mode is managed through three appearance modes:

- `"inherit"` (default) - Respects system preference
- `"light"` - Forces light mode
- `"dark"` - Forces dark mode

The theme preference is stored in a cookie (`whop-frosted-theme`) and falls back to system preference if not set.

### Configuration

Set the appearance in your `WhopApp` component:

```tsx theme={null}
<WhopApp appearance="dark">{children}</WhopApp>
```

Or create nested themes with different appearances:

```tsx theme={null}
import { Theme } from "@whop/react";

<Theme appearance="light">
    <div>This section is always light</div>
</Theme>

<Theme appearance="dark">
    <div>This section is always dark</div>
</Theme>
```

### Tailwind Dark Mode Classes

Use the `dark:` prefix for dark mode styles:

```tsx theme={null}
<div className="bg-white dark:bg-black text-black dark:text-white">Adapts to theme</div>
```

---

## Breakpoints

Frosted UI uses a mobile-first responsive system with 5 breakpoints.

### Breakpoint Scale

| Name      | Min Width | Usage            |
| --------- | --------- | ---------------- |
| `initial` | 0px       | Mobile (default) |
| `xs`      | 520px     | Large mobile     |
| `sm`      | 768px     | Tablet           |
| `md`      | 1024px    | Small desktop    |
| `lg`      | 1280px    | Desktop          |
| `xl`      | 1640px    | Large desktop    |

### Responsive Props

Many components support responsive values using an object syntax:

```tsx theme={null}
import { Text, Box } from '@whop/react'
;<Text size={{ initial: '2', md: '4', lg: '6' }}>Responsive text size</Text>
```

### Tailwind Responsive Classes

```tsx theme={null}
<div className="p-2 md:p-4 lg:p-8">
    Responsive padding
</div>

<div className="text-2 sm:text-3 md:text-4">
    Responsive text
</div>
```

---

## Icons

Frosted UI includes an icon system through the `@frosted-ui/icons` package.

### Using Icons

```tsx theme={null}
import { IconButton } from "@whop/react";
import { MagnifyingGlassIcon, Cross2Icon } from "@frosted-ui/icons";

<IconButton>
    <MagnifyingGlassIcon />
</IconButton>

<IconButton color="red">
    <Cross2Icon />
</IconButton>
```

### Common Icons

Frosted UI uses Radix Icons, which includes icons like:

- Navigation: `ChevronRightIcon`, `ChevronDownIcon`, `ArrowRightIcon`
- Actions: `Cross2Icon`, `CheckIcon`, `PlusIcon`, `MinusIcon`
- UI: `MagnifyingGlassIcon`, `GearIcon`, `PersonIcon`
- And many more...

---

## Tailwind Plugin

The Frosted UI Tailwind plugin provides design tokens as Tailwind utilities.

### What's Included

**Typography:**

```tsx theme={null}
<p className="text-3 leading-3 font-medium tracking-2">Styled with Frosted UI tokens</p>
```

**Colors:**

```tsx theme={null}
<div className="bg-blue-2 text-blue-11 border-blue-6">Blue themed</div>
```

**Spacing & Layout:**

```tsx theme={null}
<div className="p-4 md:p-6 lg:p-8">Responsive padding</div>
```

### Key Differences from Standard Tailwind

1. **Font Size Scale:** Uses 0-9 instead of xs/sm/base/lg
2. **Line Height Scale:** Matches font size scale (0-9)
3. **Color System:** 12-step Radix color scales with alpha variants
4. **Semantic Colors:** Built-in danger, warning, success, info colors
5. **Design Tokens:** All values use CSS variables for theme consistency

---

## Common Components

### Button

```tsx theme={null}
import { Button } from "@whop/react";

<Button size="2" variant="solid" color="blue">
    Primary Action
</Button>

<Button size="2" variant="soft" color="gray">
    Secondary
</Button>

<Button size="2" variant="ghost" color="red">
    Danger
</Button>
```

**Props:**

- `size`: `"1"` | `"2"` | `"3"` | `"4"`
- `variant`: `"solid"` | `"soft"` | `"surface"` | `"ghost"` | `"classic"`
- `color`: Any accent color
- `highContrast`: Enhanced contrast
- `loading`: Shows loading spinner
- `disabled`: Disables interaction

### Input

```tsx theme={null}
import { TextInput, TextArea } from "@whop/react";

<TextInput
    size="2"
    placeholder="Enter text..."
    variant="surface"
/>

<TextArea
    size="2"
    placeholder="Enter multiple lines..."
    rows={4}
/>
```

### Card

```tsx theme={null}
import { Card } from '@whop/react'
;<Card size="2" variant="surface">
  <Heading size="4">Card Title</Heading>
  <Text>Card content goes here</Text>
</Card>
```

### Badge

```tsx theme={null}
import { Badge } from "@whop/react";

<Badge color="green" variant="soft">Active</Badge>
<Badge color="red" variant="solid">Error</Badge>
<Badge color="gray" variant="surface">Draft</Badge>
```

### Dialog

```tsx theme={null}
import { Dialog, Button } from '@whop/react'
;<Dialog.Root>
  <Dialog.Trigger>
    <Button>Open Dialog</Button>
  </Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Title>Dialog Title</Dialog.Title>
    <Dialog.Description>This is the dialog content</Dialog.Description>
    <Dialog.Close>
      <Button>Close</Button>
    </Dialog.Close>
  </Dialog.Content>
</Dialog.Root>
```

### Select

```tsx theme={null}
import { Select } from '@whop/react'
;<Select.Root defaultValue="1">
  <Select.Trigger />
  <Select.Content>
    <Select.Item value="1">Option 1</Select.Item>
    <Select.Item value="2">Option 2</Select.Item>
    <Select.Item value="3">Option 3</Select.Item>
  </Select.Content>
</Select.Root>
```

### Checkbox & Radio

```tsx theme={null}
import { Checkbox, RadioGroup } from "@whop/react";

<Checkbox size="2" color="blue">
    Accept terms
</Checkbox>

<RadioGroup.Root defaultValue="1">
    <RadioGroup.Item value="1">Option 1</RadioGroup.Item>
    <RadioGroup.Item value="2">Option 2</RadioGroup.Item>
</RadioGroup.Root>
```

---

## Advanced Usage

### Theme Customization

Customize the theme with multiple options:

```tsx theme={null}
<WhopApp
  appearance="dark"
  accentColor="violet"
  grayColor="mauve"
  dangerColor="ruby"
  warningColor="amber"
  successColor="jade"
  infoColor="sky"
>
  {children}
</WhopApp>
```

### Nested Themes

Create sections with different themes:

```tsx theme={null}
import { Theme } from '@whop/react'
;<div>
  <Theme accentColor="blue">
    <Button>Blue button</Button>
  </Theme>

  <Theme accentColor="red" appearance="dark">
    <Button>Red button in dark mode</Button>
  </Theme>
</div>
```

### Accessing Theme Context

```tsx theme={null}
import { useThemeContext } from '@whop/react'

function ThemedComponent() {
  const theme = useThemeContext()

  console.log(theme.appearance) // "light" | "dark"
  console.log(theme.accentColor) // "blue" | "red" | ...

  return <div>Current theme: {theme.appearance}</div>
}
```

---

## Component Library

Frosted UI includes 60+ components organized by category:

**Layout:** `Box`, `Flex`, `Grid`, `Container`, `Section`, `AspectRatio`, `Inset`

**Typography:** `Heading`, `Text`, `Code`, `Strong`, `Em`, `Kbd`, `Quote`, `Blockquote`

**Forms:** `TextInput`, `TextArea`, `Checkbox`, `RadioGroup`, `Select`, `Switch`, `Slider`, `DatePicker`, `OTPField`

**Buttons:** `Button`, `IconButton`

**Display:** `Card`, `Avatar`, `AvatarGroup`, `Badge`, `Callout`, `Table`, `DataList`, `Skeleton`

**Navigation:** `Tabs`, `Breadcrumbs`, `Link`, `SegmentedControl`

**Overlay:** `Dialog`, `AlertDialog`, `Drawer`, `Sheet`, `Popover`, `HoverCard`, `Tooltip`, `DropdownMenu`, `ContextMenu`

**Feedback:** `Progress`, `CircularProgress`, `Spinner`

**Utilities:** `ScrollArea`, `Separator`, `Portal`, `VisuallyHidden`, `AccessibleIcon`

<Info>
  All components are built on Radix UI primitives and follow accessibility best practices.
</Info>

---

## Resources

- [Radix UI Documentation](https://www.radix-ui.com/) - Component primitives
- [Radix Colors](https://www.radix-ui.com/colors) - Color system documentation
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

# Iframe SDK

Source: https://docs.whop.com/developer/guides/iframe

Interact with the whop website from within your app.

Whop apps are embedded into the site using iFrames. This SDK provides a type-safe way for you to communicate with the Whop application using a request/response style API powered by `window.postMessage`.

Since this package relies on `window.postMessage`, it only works in **Client Components** or client side javascript.

### Relevant Packages

- `@whop/iframe` - The main package for the iframe SDK.
- `@whop/react` - A React wrapper for Whop Apps including helpers for the iframe SDK.

---

## Setup

The main function exported from the `@whop/iframe` package is the `createSdk` function. When called, this function sets up a listener for messages from the main Whop site, using `window.on('message', ...)`. It is also exposed through the `WhopIframeSdkProvider` component from `@whop/react`.

### React

If you're using React, it is recommended to use the `WhopIframeSdkProvider` component from `@whop/react` to provide the iframe SDK to all child components.

<Steps>
  <Step title="Mount provider in root layout">
    ```javascript theme={null}
    // app/layout.tsx
    import { WhopIframeSdkProvider } from "@whop/react";

    export default function RootLayout({
      children,
    }: {
      children: React.ReactNode,
    }) {
      return (
        <html lang="en">
          <body>
            <WhopIframeSdkProvider>{children}</WhopIframeSdkProvider>
          </body>
        </html>
      );
    }
    ```

  </Step>

  <Step title="Consume the iframe SDK in a component">
    ```javascript theme={null}
    // components/example.tsx
    import { useIframeSdk } from "@whop/react";

    export const Example = () => {
      const iframeSdk = useIframeSdk();

      return (
        <button
          onClick={() => iframeSdk.openExternalUrl({ url: "https://example.com" })}
        >
          Open External URL
        </button>
      );
    };
    ```

  </Step>
</Steps>

### Other Frameworks

For other frameworks, you can use the `createSdk` function from `@whop/iframe` to create an instance of the iframe SDK.

<Steps>
  <Step title="Create the iframe SDK instance">
    ```javascript theme={null}
    // lib/iframe-sdk.ts
    import { createSdk } from "@whop/iframe";

    export const iframeSdk = createSdk({
      appId: process.env.NEXT_PUBLIC_WHOP_APP_ID,
    });
    ```

  </Step>

  <Step title="Use the iframe SDK instance">
    ```javascript theme={null}
    // index.ts
    import { iframeSdk } from "@/lib/iframe-sdk";

    const navigationButtonElement = document.querySelector("button");

    if (navigationButtonElement) {
      navigationButtonElement.addEventListener("click", () => {
        iframeSdk.openExternalUrl({ url: "https://example.com" });
      });
    }
    ```

  </Step>
</Steps>

<Check>We have now setup the SDK and iFrame.</Check>

## Opening External Links

Once the iframe SDK is initialized, you can use it to open external links. This will close your app and navigate to a new website.

<CodeGroup>
  ```javascript React theme={null}
  "use client";
  import { useIframeSdk } from "@whop/react";

export default function Home() {
const iframeSdk = useIframeSdk();

function openLink() {
iframeSdk.openExternalUrl({ url: "https://google.com" });
}

return <button onClick={openLink}>Click me to open Google</button>;
}

````

```javascript Vanilla JS theme={null}
import { iframeSdk } from "@/lib/iframe-sdk";

const navigationButtonElement = document.querySelector("button");

if (navigationButtonElement) {
  navigationButtonElement.addEventListener("click", () => {
    iframeSdk.openExternalUrl({ url: "https://google.com" });
  });
}
````

</CodeGroup>

### Opening User Profiles

If you want to display a Whop user profile, you can use the `openExternalUrl` method and pass their profile page link which looks like `https://whop.com/@username`.

The Whop app will intercept this and display a modal containing their user profile instead of navigating away.

<CodeGroup>
  ```javascript React theme={null}
  "use client";
  import { useIframeSdk } from "@whop/react";

export default function Home() {
const iframeSdk = useIframeSdk();

function openProfile() {
iframeSdk.openExternalUrl({ url: "https://whop.com/@j" });
}

return <button onClick={openProfile}>View Profile</button>;
}

````

```javascript Vanilla JS theme={null}
import { iframeSdk } from "@/lib/iframe-sdk";

const profileButtonElement = document.querySelector("button");

if (profileButtonElement) {
  profileButtonElement.addEventListener("click", () => {
    iframeSdk.openExternalUrl({ url: "https://whop.com/@j" });
  });
}
````

</CodeGroup>

<Info>
  You can also use a user ID instead of username. The final link should look
  like this: `https://whop.com/@user_XXXXXXXX`
</Info>

## In-App Purchases

The iframe SDK provides a method to trigger in-app purchases directly within your app. This allows you to accept payments for one-time purchases or subscriptions using Whop's checkout.

To process in-app purchases, you'll need to:

1. Create a checkout configuration on your server (with plan details and metadata)
2. Use the iframe SDK's `inAppPurchase` method to open the payment modal
3. Handle the response and validate the payment via webhooks

<CodeGroup>
  ```tsx React theme={null}
  "use client";
  import { useIframeSdk } from "@whop/react";
  import { useState } from "react";

export default function PaymentButton() {
const iframeSdk = useIframeSdk();
const [paymentId, setPaymentId] = useState<string>();

      async function handlePurchase() {
          // 1. Create checkout configuration on server
          //    (in this example this is a nextjs server action, but it could also be a plain API route)
          const checkoutConfiguration = await createCheckoutConfiguration(/* can pass options here */);

          // 2. Open payment modal
          const res = await iframeSdk.inAppPurchase({
              planId: checkoutConfiguration.plan.id,
              id: checkoutConfiguration.id
          });

          if (res.status === "ok") {
              setPaymentId(res.data.receipt_id);
          } else {
              // handle errors
          }
      }

      return <button onClick={handlePurchase}>Purchase</button>;

}

````

```javascript Vanilla JS theme={null}
import { iframeSdk } from "@/lib/iframe-sdk";

const paymentButton = document.querySelector("button#payment-button");

paymentButton.addEventListener(
    "click",
    async function onPaymentButtonClick() {
        // 1. Create checkout configuration on server
        const checkoutConfiguration = await createCheckoutConfiguration(/* can pass options here */);

        // 2. Open payment modal
        const res = await iframeSdk.inAppPurchase({
            planId: checkoutConfiguration.plan.id,
            id: checkoutConfiguration.id
        });

        if (res.status === "ok") {
            const paymentId = res.data.receipt_id;
            // Send this id to your backend to validate, or rely on webhooks.
            // User has purchased the item, and it can be unlocked.
        } else {
            // handle errors
        }
    }
);
````

</CodeGroup>

<Info>
  For a complete guide on setting up in-app purchases including creating checkout configurations,
  handling webhooks, and validating payments, see the [Accept payments documentation](/developer/guides/accept-payments).
</Info>

# Build a Paywall

Source: https://docs.whop.com/developer/guides/ios/build-a-paywall

Display subscription plans and handle purchases in your iOS app

This guide shows you how to build a paywall that displays your subscription plans and handles the purchase flow. By the end, you'll have a working paywall that lets users subscribe to your product.

## What you'll build

- A paywall screen that displays available plans with pricing
- A purchase flow that handles payments through Whop
- Error handling for cancelled or failed purchases

## Prerequisites

- [Install the SDK](/developer/guides/ios/installation)
- A Whop company with at least one product and plan
- An API key with the `iap:read` permission from your [Developer Settings](https://whop.com/dashboard/developer)

## Step 1: Configure the SDK

Initialize the SDK in your app's entry point with your API key:

```swift theme={null}
import SwiftUI
import WhopCheckout

@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(Checkout.shared)
                .task {
                    try? await Checkout.shared.configure(
                        companyId: "biz_xxxxxxxxxxxxxx",
                        apiKey: "your_api_key_here",
                        planMappings: [
                            .init(whopId: "plan_xxxxx", appleId: "monthly_sub"),
                            .init(whopId: "plan_yyyyy", appleId: "yearly_sub")
                        ]
                    )
                }
        }
    }
}
```

<Info>
  Find your company ID in the URL of your [Whop Dashboard](https://whop.com/dashboard) (starts with `biz_`). Find your plan IDs in the Products tab under each plan (starts with `plan_`).
</Info>

## Step 2: Display available plans

Use the `plans` property to show available subscription options:

```swift theme={null}
struct PaywallView: View {
    @Environment(Checkout.self) var checkout

    var body: some View {
        VStack(spacing: 20) {
            Text("Choose a Plan")
                .font(.title)
                .bold()

            ForEach(checkout.plans) { plan in
                PlanCard(plan: plan)
            }
        }
        .padding()
    }
}

struct PlanCard: View {
    let plan: CheckoutPlan
    @Environment(Checkout.self) var checkout

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(plan.title ?? "Plan")
                .font(.headline)

            Text(plan.initialPrice, format: .currency(code: plan.baseCurrency))
                .font(.title2)
                .bold()

            Button("Subscribe") {
                Task {
                    await purchase(plan)
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }

    func purchase(_ plan: CheckoutPlan) async {
        do {
            let result = try await checkout.purchase(plan.id)
            // Purchase successful!
            print("Purchased: \(result.receiptId)")
        } catch WhopCheckoutError.cancelled {
            // User dismissed the checkout
        } catch {
            // Handle other errors
            print("Purchase failed: \(error)")
        }
    }
}
```

## Step 3: Handle the purchase flow

When a user taps "Subscribe", the SDK automatically:

1. Presents a checkout sheet with the Whop payment flow
2. Handles payment processing
3. Dismisses the sheet when complete
4. Returns the result or throws an error

```swift theme={null}
func purchase(_ planId: String) async {
    do {
        let result = try await checkout.purchase(planId)
        // Success - user now has an active membership
        print("Receipt ID: \(result.receiptId)")
    } catch WhopCheckoutError.cancelled {
        // User dismissed the checkout sheet
    } catch WhopCheckoutError.paymentFailed(let message) {
        // Payment failed - show error to user
        showError(message)
    } catch {
        // Other errors
        showError("Something went wrong. Please try again.")
    }
}
```

## Complete example

Here's a full paywall implementation:

```swift theme={null}
struct PaywallView: View {
    @Environment(Checkout.self) var checkout
    @Environment(\.dismiss) var dismiss
    @State private var selectedPlanId: String?
    @State private var isPurchasing = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(.yellow)

                        Text("Unlock Premium")
                            .font(.title)
                            .bold()

                        Text("Get access to all features")
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 32)

                    // Plans
                    ForEach(checkout.plans) { plan in
                        Button {
                            selectedPlanId = plan.id
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(plan.title ?? "Plan")
                                        .font(.headline)
                                    Text(plan.initialPrice, format: .currency(code: plan.baseCurrency))
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                            .padding()
                            .background(plan.id == selectedPlanId ? Color.accentColor.opacity(0.1) : Color(.secondarySystemBackground))
                            .cornerRadius(12)
                            .overlay {
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(plan.id == selectedPlanId ? Color.accentColor : .clear, lineWidth: 2)
                            }
                        }
                        .buttonStyle(.plain)
                    }

                    // Purchase button
                    Button {
                        guard let planId = selectedPlanId else { return }
                        Task { await purchase(planId) }
                    } label: {
                        Group {
                            if isPurchasing {
                                ProgressView().tint(.white)
                            } else {
                                Text("Continue")
                            }
                        }
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(selectedPlanId == nil || isPurchasing)
                    .opacity(selectedPlanId == nil ? 0.5 : 1)
                }
                .padding()
            }
            .navigationTitle("Subscribe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    func purchase(_ planId: String) async {
        isPurchasing = true
        defer { isPurchasing = false }

        do {
            _ = try await checkout.purchase(planId)
            dismiss()
        } catch WhopCheckoutError.cancelled {
            // User cancelled
        } catch {
            print("Purchase failed: \(error.localizedDescription)")
        }
    }
}
```

## Next steps

<CardGroup>
  <Card title="Check Entitlements" icon="shield-check" href="/developer/guides/ios/check-entitlements">
    Learn how to gate content based on subscription status
  </Card>

  <Card title="API Reference" icon="book" href="/developer/guides/ios/checkout-reference">
    Explore all available methods and properties
  </Card>
</CardGroup>

# Check Entitlements

Source: https://docs.whop.com/developer/guides/ios/check-entitlements

Verify subscription status and gate premium content in your iOS app

This guide shows you how to check if a user has an active subscription and gate premium content accordingly. You'll also learn how to handle user login/logout to sync subscriptions across devices.

## What you'll learn

- Check if a user has access to a product
- Gate content based on subscription status
- Sync subscriptions across devices with user login

## Prerequisites

- [Install the SDK](/developer/guides/ios/installation)
- [Configure the SDK](/developer/guides/ios/build-a-paywall#step-1-configure-the-sdk)

## Check subscription status

Use `hasAccess(to:)` to check if the user has access to a specific product:

```swift theme={null}
struct ContentView: View {
    @Environment(Checkout.self) var checkout

    var body: some View {
        VStack {
            // Basic features always available
            BasicFeaturesView()

            // Premium features for subscribers
            if checkout.hasAccess(to: "prod_xxxxxxxxxxxxxx") {
                PremiumFeaturesView()
            }

            // If you have multiple tiers, check each product separately
            if checkout.hasAccess(to: "prod_yyyyyyyyyyyyyy") {
                EnterpriseFeaturesView()
            }
        }
    }
}
```

Or use `isSubscribed` to check if the user has any active subscription:

```swift theme={null}
if checkout.isSubscribed {
    // User has at least one active membership
}
```

## View active memberships

Access the `memberships` array to show subscription details:

```swift theme={null}
struct SubscriptionStatusView: View {
    @Environment(Checkout.self) var checkout

    var body: some View {
        List {
            if checkout.memberships.isEmpty {
                Text("No active subscriptions")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(checkout.memberships) { membership in
                    MembershipRow(membership: membership)
                }
            }
        }
    }
}

struct MembershipRow: View {
    let membership: CheckoutMembership

    var body: some View {
        VStack(alignment: .leading) {
            Text("Subscription")
                .font(.headline)

            if let expiresAt = membership.expiresAt {
                Text("Renews \(expiresAt, style: .date)")
                    .foregroundStyle(.secondary)
            }

            Text("Status: \(membership.status.rawValue)")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
```

## User login and logout

User IDs allow subscriptions to sync across devices. When a user logs in, the SDK automatically claims any unclaimed memberships from the current device and loads their existing memberships.

### Log in a user

```swift theme={null}
func handleLogin(userId: String) async {
    do {
        try await checkout.logIn(appUserId: userId)
        // Memberships are now synced for this user
    } catch {
        print("Login failed: \(error)")
    }
}
```

### Log out a user

```swift theme={null}
func handleLogout() {
    checkout.logOut()
    // User is now logged out, memberships cleared
}
```

### Check the current user

```swift theme={null}
if let userId = checkout.appUserId {
    Text("Logged in as \(userId)")
} else {
    Text("Not logged in")
}
```

## Guest purchases

Users can purchase subscriptions even without logging in. The SDK tracks these purchases by device ID and automatically claims them when the user logs in.

```swift theme={null}
struct PurchaseFlow: View {
    @Environment(Checkout.self) var checkout
    @State private var showingLogin = false

    var body: some View {
        VStack {
            if checkout.appUserId == nil {
                // User not logged in - they can still purchase
                Text("Purchase as guest or log in to sync across devices")

                Button("Continue as Guest") {
                    // Purchase will be tied to device
                    Task { try? await checkout.purchase("plan_xxx") }
                }

                Button("Log In") {
                    showingLogin = true
                }
            } else {
                // User logged in - purchase tied to their account
                Button("Subscribe") {
                    Task { try? await checkout.purchase("plan_xxx") }
                }
            }
        }
        .sheet(isPresented: $showingLogin) {
            // Your login view here
        }
    }
}
```

## Complete example

Here's a complete example showing entitlement checking with user auth:

```swift theme={null}
struct MainView: View {
    @Environment(Checkout.self) var checkout
    @State private var showingPaywall = false
    @State private var showingLogin = false

    var body: some View {
        NavigationStack {
            Group {
                if !checkout.isInitialized {
                    ProgressView("Loading...")
                } else if checkout.hasAccess(to: "prod_xxxxxxxxxxxxxx") {
                    PremiumContentView()
                } else {
                    FreeContentView(onUpgrade: { showingPaywall = true })
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        if let userId = checkout.appUserId {
                            Text("Signed in as \(userId)")
                            Button("Sign Out", action: signOut)
                        } else {
                            Button("Sign In") { showingLogin = true }
                        }

                        Divider()

                        if checkout.hasAccess(to: "prod_xxxxxxxxxxxxxx") {
                            Button("Manage Subscription") {
                                // Show subscription management
                            }
                        }
                    } label: {
                        Image(systemName: "person.circle")
                    }
                }
            }
            .sheet(isPresented: $showingPaywall) {
                PaywallView()
            }
            .sheet(isPresented: $showingLogin) {
                LoginView { userId in
                    Task {
                        try? await checkout.logIn(appUserId: userId)
                        showingLogin = false
                    }
                }
            }
        }
    }

    func signOut() {
        checkout.logOut()
    }
}

struct FreeContentView: View {
    let onUpgrade: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Text("Free Content")
                .font(.title)

            Text("Upgrade to access premium features")
                .foregroundStyle(.secondary)

            Button("Upgrade Now", action: onUpgrade)
                .buttonStyle(.borderedProminent)
        }
    }
}

struct PremiumContentView: View {
    var body: some View {
        VStack {
            Image(systemName: "crown.fill")
                .font(.largeTitle)
                .foregroundStyle(.yellow)

            Text("Premium Content")
                .font(.title)

            Text("Thanks for subscribing!")
        }
    }
}
```

## Reactive updates

The SDK automatically updates views when subscription status changes. Since `Checkout` is `@Observable`, any view using `@Environment(Checkout.self)` will re-render when:

- A purchase completes
- A user logs in or out
- Memberships are loaded or updated

No manual refresh is needed.

## Next steps

<CardGroup>
  <Card title="Build a Paywall" icon="credit-card" href="/developer/guides/ios/build-a-paywall">
    Display plans and handle purchases
  </Card>

  <Card title="API Reference" icon="book" href="/developer/guides/ios/checkout-reference">
    Explore all available methods and properties
  </Card>
</CardGroup>

# API Reference

Source: https://docs.whop.com/developer/guides/ios/checkout-reference

Complete API documentation for WhopCheckout

This page documents all classes, methods, properties, and types available in the WhopCheckout SDK.

<Info>
  Looking for guides? See [Build a Paywall](/developer/guides/ios/build-a-paywall) or [Check Entitlements](/developer/guides/ios/check-entitlements).
</Info>

## Checkout

The main class for managing in-app purchases. An `@Observable` class that can be used with SwiftUI's environment system.

```swift theme={null}
@MainActor @Observable
public class Checkout
```

---

### shared

The shared Checkout instance. Use this singleton to configure the SDK and manage purchases.

```swift theme={null}
static let shared: Checkout
```

**Example:**

```swift theme={null}
import WhopCheckout

// Configure at app startup
try await Checkout.shared.configure(...)

// Pass through SwiftUI environment
ContentView()
    .environment(Checkout.shared)

// Access in views
@Environment(Checkout.self) var checkout
```

---

### configure(companyId:apiKey:planMappings:)

Configures and initializes the SDK. Call this once at app startup.

```swift theme={null}
func configure(
    companyId: String,
    apiKey: String,
    planMappings: [PlanMapping] = []
) async throws
```

**Parameters:**

| Parameter      | Type            | Description                                                                                                      |
| -------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `companyId`    | `String`        | Your Whop company ID (starts with `biz_`)                                                                        |
| `apiKey`       | `String`        | Your API key with `iap:read` permission                                                                          |
| `planMappings` | `[PlanMapping]` | Mapping of Whop plan IDs to Apple StoreKit product IDs. Pass an empty array if you don't need StoreKit fallback. |

**Example:**

```swift theme={null}
try await Checkout.shared.configure(
    companyId: "biz_xxxxxxxxxxxxxx",
    apiKey: "your_api_key_here",
    planMappings: [
        .init(whopId: "plan_xxxxx", appleId: "monthly_sub"),
        .init(whopId: "plan_yyyyy", appleId: "yearly_sub")
    ]
)
```

---

### isInitialized

Indicates whether the SDK has finished initializing.

```swift theme={null}
var isInitialized: Bool { get }
```

**Example:**

```swift theme={null}
if checkout.isInitialized {
    // SDK ready to use
}
```

---

### deviceId

The unique device identifier managed by the SDK. Persists across app launches using the iOS Keychain.

```swift theme={null}
var deviceId: String { get }
```

---

### appUserId

The current logged-in user ID, or `nil` if no user is logged in.

```swift theme={null}
var appUserId: String? { get }
```

---

### plans

Array of available subscription plans for the configured products.

```swift theme={null}
var plans: [CheckoutPlan] { get }
```

**Example:**

```swift theme={null}
ForEach(checkout.plans) { plan in
    Text(plan.title ?? "Plan")
}
```

---

### memberships

Array of active memberships for the current user or device.

```swift theme={null}
var memberships: [CheckoutMembership] { get }
```

---

### isSubscribed

Whether the user has any active membership.

```swift theme={null}
var isSubscribed: Bool { get }
```

**Example:**

```swift theme={null}
if checkout.isSubscribed {
    // Show premium content
}
```

---

### supportsExternalPurchases

Whether the current App Store region supports external (non-StoreKit) purchases. Currently `true` for US users, `false` elsewhere.

```swift theme={null}
var supportsExternalPurchases: Bool { get }
```

When `true`, the SDK defaults to Whop web checkout (lower fees). When `false`, it defaults to StoreKit.

---

### refreshPlans()

Refreshes the available plans from the server.

```swift theme={null}
@discardableResult
func refreshPlans() async throws -> [CheckoutPlan]
```

**Returns:** The refreshed plans with current pricing.

**Throws:** `WhopCheckoutError` if the refresh fails.

Call this to update pricing or plan availability after initialization. The `plans` property will also be updated with the latest data.

**Example:**

```swift theme={null}
// Refresh and use the return value
let plans = try await Checkout.shared.refreshPlans()

// Or just refresh (plans property updates automatically)
try await Checkout.shared.refreshPlans()
```

---

### hasAccess(to:)

Checks if the user has access to a specific product.

```swift theme={null}
func hasAccess(to productId: String) -> Bool
```

**Parameters:**

| Parameter   | Type     | Description                                   |
| ----------- | -------- | --------------------------------------------- |
| `productId` | `String` | The product ID to check (starts with `prod_`) |

**Returns:** `true` if the user has an active membership for the product

**Example:**

```swift theme={null}
// Replace with your product ID from the Whop dashboard
if checkout.hasAccess(to: "prod_xxxxxxxxxxxxxx") {
    // Show pro features
}
```

---

### purchase(\_:method:)

Initiates a purchase flow for a plan. By default, uses Whop web checkout in the US (lower fees) and StoreKit elsewhere.

```swift theme={null}
func purchase(_ whopPlanId: String, method: PaymentMethod? = nil) async throws -> CheckoutPurchaseResult
```

**Parameters:**

| Parameter    | Type             | Description                                            |
| ------------ | ---------------- | ------------------------------------------------------ |
| `whopPlanId` | `String`         | The Whop plan ID to purchase (starts with `plan_`)     |
| `method`     | `PaymentMethod?` | Override the payment method. Defaults based on region. |

**Returns:** `CheckoutPurchaseResult` containing the receipt ID and membership information

**Throws:**

- `WhopCheckoutError.cancelled` if the user dismisses the checkout
- `WhopCheckoutError.notConfigured` if the SDK is not configured
- `WhopCheckoutError.paymentFailed(String)` if the payment fails

**Example:**

```swift theme={null}
do {
    // Use default payment method (Whop in US, StoreKit elsewhere)
    let result = try await checkout.purchase("plan_xxxxxxxxxxxxxx")
    print("Success! Receipt: \(result.receiptId)")
} catch WhopCheckoutError.cancelled {
    // User cancelled
} catch {
    // Handle error
}

// Or explicitly choose a payment method
let result = try await checkout.purchase("plan_xxx", method: .apple)
```

---

### logIn(appUserId:)

Logs in a user and claims any unclaimed memberships associated with the device.

```swift theme={null}
func logIn(appUserId: String) async throws
```

**Parameters:**

| Parameter   | Type     | Description                                              |
| ----------- | -------- | -------------------------------------------------------- |
| `appUserId` | `String` | Your app's user ID (should not change for the same user) |

**Example:**

```swift theme={null}
try await checkout.logIn(appUserId: "user_123")
```

---

### logOut()

Logs out the current user and clears their memberships from the local state.

```swift theme={null}
func logOut()
```

**Example:**

```swift theme={null}
checkout.logOut()
```

---

### restorePurchases()

Restores purchases from both StoreKit and Whop.

```swift theme={null}
func restorePurchases() async throws -> Bool
```

**Returns:** `true` if any active subscription was found

**Example:**

```swift theme={null}
Button("Restore Purchases") {
    Task {
        let restored = try await checkout.restorePurchases()
        if restored {
            print("Purchases restored!")
        }
    }
}
```

---

## Types

### CheckoutPurchaseResult

The result of a successful purchase.

```swift theme={null}
struct CheckoutPurchaseResult {
    let receiptId: String
    let membership: CheckoutMembership?
}
```

| Property     | Type                  | Description                             |
| ------------ | --------------------- | --------------------------------------- |
| `receiptId`  | `String`              | The unique receipt ID for this purchase |
| `membership` | `CheckoutMembership?` | The membership created by this purchase |

<Accordion title="When is membership nil?">
  The `membership` property depends on the payment method used:

| Payment Method    | Region     | `membership` value    |
| ----------------- | ---------- | --------------------- |
| Whop web checkout | US         | Populated immediately |
| StoreKit          | Outside US | `nil` initially       |

**Why StoreKit purchases return nil:**
StoreKit transactions are processed asynchronously by Apple. When the purchase completes, the SDK may not yet have the Whop membership synced. The SDK tracks StoreKit entitlements separately, so `checkout.isSubscribed` will still return `true`.

**How to handle both cases:**

```swift theme={null}
do {
    let result = try await checkout.purchase("plan_xxx")

    // Always check isSubscribed - works for both payment methods
    if checkout.isSubscribed {
        // Grant access
    }

    // Optionally use membership details if available
    if let membership = result.membership {
        print("Membership ID: \(membership.id)")
        print("Expires: \(membership.expiresAt?.formatted() ?? "N/A")")
    }
} catch WhopCheckoutError.cancelled {
    // User cancelled
}
```

**Key point:** Don't rely on `membership` being non-nil to grant access. Always use `checkout.isSubscribed` or `checkout.hasAccess(to:)` to check subscription status.
</Accordion>

---

### PlanMapping

A mapping between a Whop plan and an Apple StoreKit product, used during SDK configuration. This tells the SDK which Apple product to use for StoreKit purchases outside the US.

<Info>
  **PlanMapping vs CheckoutPlan:** `PlanMapping` is for SDK configuration (mapping IDs). `CheckoutPlan` is what you display in your UI (has pricing, titles, etc.). You create `PlanMapping` objects in `configure()`, then access `CheckoutPlan` objects via `checkout.plans`.
</Info>

```swift theme={null}
struct PlanMapping: Sendable {
    let whopId: String
    let appleId: String

    init(whopId: String, appleId: String)
}
```

| Property  | Type     | Description                                                               |
| --------- | -------- | ------------------------------------------------------------------------- |
| `whopId`  | `String` | The Whop plan ID (e.g., `plan_xxx`)                                       |
| `appleId` | `String` | The Apple product ID from App Store Connect (e.g., `com.yourapp.monthly`) |

**Example:**

```swift theme={null}
// Used in configure() - just maps IDs
try await Checkout.shared.configure(
    companyId: "biz_xxx",
    apiKey: "your_key",
    planMappings: [
        .init(whopId: "plan_monthly", appleId: "com.app.monthly"),
        .init(whopId: "plan_yearly", appleId: "com.app.yearly")
    ]
)

// After configuration, use checkout.plans (CheckoutPlan array) for UI
ForEach(checkout.plans) { plan in  // These are CheckoutPlan objects
    Text(plan.title ?? "Plan")
    Text(plan.whopDisplayPrice)
}
```

<Tip>
  Your Whop plans and Apple products should have matching pricing and billing periods. See [Setup → Plan Mappings](/developer/guides/ios/checkout/setup#plan-mappings) for details.
</Tip>

---

### PaymentMethod

The payment method to use for a purchase.

```swift theme={null}
enum PaymentMethod: Sendable {
    case whop   // Web checkout via Whop (lower fees)
    case apple  // StoreKit purchase via Apple
}
```

| Case    | Description                                                                         |
| ------- | ----------------------------------------------------------------------------------- |
| `whop`  | Web checkout via Whop. 2.7% + \$0.30 fees (vs Apple's 15-30%). Available in the US. |
| `apple` | StoreKit purchase via Apple (15-30% fees). Required outside the US.                 |

---

### CheckoutPlan (Display)

A subscription plan available for purchase, accessed via `checkout.plans`. Use this for displaying plan information in your UI and for making purchases.

<Info>
  **CheckoutPlan vs Plan:** `CheckoutPlan` contains full plan details (pricing, titles, trial info) for your UI. `Plan` is just an ID mapping used during SDK configuration. You never create `CheckoutPlan` objects—they come from `checkout.plans` after configuration.
</Info>

```swift theme={null}
struct CheckoutPlan: Identifiable {
    let id: String
    let productId: String?
    let title: String?
    let description: String?
    let planType: PlanType
    let billingPeriodDays: Int?
    let baseCurrency: String
    let initialPrice: Double
    let renewalPrice: Double
    let trialPeriodDays: Int?

    var renewalPeriod: RenewalPeriod? { get }
    var whopDisplayPrice: String { get }
    var appleDisplayPrice: String? { get }
}

enum PlanType: String {
    case oneTime = "one_time"
    case renewal
    case unknown
}

enum RenewalPeriod: Equatable {
    case weekly      // 7 days
    case monthly     // 30 days
    case quarterly   // 90 days
    case semiAnnual  // 180 days
    case yearly      // 365 days
    case custom(Int) // Custom period in days
}
```

| Property            | Type             | Description                                                  |
| ------------------- | ---------------- | ------------------------------------------------------------ |
| `id`                | `String`         | The plan ID                                                  |
| `productId`         | `String?`        | The product this plan belongs to                             |
| `title`             | `String?`        | Display name of the plan                                     |
| `description`       | `String?`        | Description text for the plan                                |
| `planType`          | `PlanType`       | Whether this is a one-time or recurring plan                 |
| `billingPeriodDays` | `Int?`           | Number of days in billing cycle (30 = monthly, 365 = yearly) |
| `baseCurrency`      | `String`         | Currency code (e.g., "usd")                                  |
| `initialPrice`      | `Double`         | Initial price of the plan                                    |
| `renewalPrice`      | `Double`         | Price for renewals                                           |
| `trialPeriodDays`   | `Int?`           | Number of days in trial period                               |
| `renewalPeriod`     | `RenewalPeriod?` | Computed renewal period (`.monthly`, `.yearly`, etc.)        |
| `whopDisplayPrice`  | `String`         | Formatted Whop price (e.g., "\$9.99")                        |
| `appleDisplayPrice` | `String?`        | Localized StoreKit price, if a plan mapping exists           |

---

### CheckoutMembership

An active subscription membership.

```swift theme={null}
struct CheckoutMembership: Identifiable {
    let id: String
    let productId: String
    let planId: String
    let status: Status
    let isClaimed: Bool
    let createdAt: Date
    let expiresAt: Date?
    let renewalPeriodEnd: Date?
    let cancelAtPeriodEnd: Bool
    let receiptId: String?

    var isActive: Bool { get }
}

enum Status: String {
    case active
    case canceled
    case canceling
    case completed
    case drafted
    case expired
    case pastDue = "past_due"
    case trialing
    case unresolved
    case unknown
}
```

| Property            | Type      | Description                                                                                               |
| ------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| `id`                | `String`  | The membership ID                                                                                         |
| `productId`         | `String`  | The product this membership belongs to                                                                    |
| `planId`            | `String`  | The plan this membership is for                                                                           |
| `status`            | `Status`  | Current status of the membership                                                                          |
| `isActive`          | `Bool`    | Whether the membership grants access (true for `active`, `trialing`, `canceling`, `pastDue`, `completed`) |
| `isClaimed`         | `Bool`    | Whether the membership has been claimed by a user                                                         |
| `createdAt`         | `Date`    | When the membership was created                                                                           |
| `expiresAt`         | `Date?`   | When the membership expires                                                                               |
| `renewalPeriodEnd`  | `Date?`   | End of the current renewal period                                                                         |
| `cancelAtPeriodEnd` | `Bool`    | Whether the membership will cancel at period end                                                          |
| `receiptId`         | `String?` | The receipt ID for this membership                                                                        |

---

### WhopCheckoutError

Errors thrown by the SDK.

```swift theme={null}
enum WhopCheckoutError: Error {
    case cancelled
    case notConfigured
    case paymentFailed(String)
}
```

| Case                    | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `cancelled`             | User dismissed the checkout sheet without completing purchase     |
| `notConfigured`         | SDK is not configured. Call `Checkout.shared.configure()` first.  |
| `paymentFailed(String)` | Payment failed. The associated string contains the error message. |

---

## Requirements

- iOS 17.0+
- Xcode 15.0+
- Swift 5.10+

# Installation

Source: https://docs.whop.com/developer/guides/ios/installation

Add the Whop iOS SDK to your project

The Whop iOS SDK is distributed as separate packages for different features. Install only what you need.

## WhopCheckout (In-App Purchases)

The WhopCheckout package handles subscriptions and payments in your app.

### Step 1: Add Package Dependency

In Xcode, go to **File** → **Add Package Dependencies...**

Enter the package URL:

```
https://github.com/whopio/whopsdk-checkout-swift
```

### Step 2: Select Version

Choose the latest version or specify a version range:

- **Up to Next Major**: Recommended for production
- **Exact Version**: For stability

### Step 3: Import and Configure

```swift theme={null}
import SwiftUI
import WhopCheckout

@main
struct YourApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(Checkout.shared)
                .task {
                    try? await Checkout.shared.configure(
                        companyId: "biz_xxxxxxxxxxxxxx",
                        apiKey: "your_api_key_here",
                        planMappings: [
                            .init(whopId: "plan_xxxxx", appleId: "monthly_sub")
                        ]
                    )
                }
        }
    }
}
```

<Card title="Build a Paywall" icon="credit-card" href="/developer/guides/ios/build-a-paywall">
  Continue with the full setup guide
</Card>

---

## WhopElements (embedded Chat, Payouts...)

Use WhopElements to embed Whop chat channels in your app.

### Step 1: Add Package Dependency

In Xcode, go to **File** → **Add Package Dependencies...**

Enter the package URL:

```
https://github.com/whopio/whopsdk-elements-swift
```

### Step 2: Select Version

Choose the latest version or specify a version range.

### Step 3: Import and Configure the specific element

```swift theme={null}
import SwiftUI
import WhopElements

@main
struct YourApp: App {
    var body: some Scene {
        WindowGroup {
            NavigationStack {
                WhopChatView(channelId: "chat_XXXXXXXXXXXXXX")
            }
            .task {
                await WhopSDK.configureWithOAuth(appId: "app_XXXXXXXXXXXXXX")
            }
        }
    }
}
```

<Card title="Embedded Chat" icon="message" href="/developer/guides/chat/quickstart">
  Continue with the chat integration guide
</Card>

<Card title="Embedded Payouts" icon="money-bill-transfer" href="/developer/platforms/render-payout-portal">
  Continue with the chat integration guide
</Card>

---

## Requirements

- iOS 17.0+
- Xcode 15.0+
- Swift 5.10+

## Next steps

<CardGroup>
  <Card title="Build a Paywall" icon="credit-card" href="/developer/guides/ios/build-a-paywall">
    Add subscriptions and payments
  </Card>

  <Card title="Check Entitlements" icon="shield-check" href="/developer/guides/ios/check-entitlements">
    Gate content based on subscription status
  </Card>

  <Card title="Embedded Chat" icon="message" href="/developer/guides/chat/quickstart">
    Add Whop chat to your app
  </Card>

  <Card title="Embedded Payouts" icon="money-bill-transfer" href="/developer/platforms/render-payout-portal">
    Enable connected account payouts
  </Card>

  <Card title="API Reference" icon="book" href="/developer/guides/ios/checkout-reference">
    Full SDK documentation
  </Card>
</CardGroup>

# iOS SDK

Source: https://docs.whop.com/developer/guides/ios/overview

Add payments, subscriptions, and chat to your native iOS app

The Whop iOS SDK lets you integrate in-app purchases, subscription management, and chat directly into your iOS app. The SDK automatically uses Whop's payment processing in the US (2.7% + \$0.30 vs Apple's 15-30%) and falls back to Apple's StoreKit elsewhere for global coverage.

## What you can build

<CardGroup>
  <Card title="Build a Paywall" icon="credit-card" href="/developer/guides/ios/build-a-paywall">
    Display subscription plans and handle purchases in your app
  </Card>

  <Card title="Check Entitlements" icon="shield-check" href="/developer/guides/ios/check-entitlements">
    Verify subscription status and gate premium content
  </Card>

  <Card title="Embedded Chat" icon="message" href="/developer/guides/chat/quickstart">
    Add Whop chat channels directly in your app
  </Card>

  <Card title="Embedded Payouts" icon="money-bill-transfer" href="/developer/platforms/render-payout-portal">
    Enable connected account payouts
  </Card>
</CardGroup>

## Quick example

Here's a complete example showing the SDK in action:

```swift theme={null}
import SwiftUI
import WhopCheckout

@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(Checkout.shared)
                .task {
                    try? await Checkout.shared.configure(
                        companyId: "biz_xxxxxxxxxxxxxx",
                        apiKey: "your_api_key_here",
                        planMappings: [
                            .init(whopId: "plan_xxxxx", appleId: "monthly_sub")
                        ]
                    )
                }
        }
    }
}

struct ContentView: View {
    @Environment(Checkout.self) var checkout

    var body: some View {
        if checkout.isSubscribed {
            Text("Welcome, premium user!")
        } else {
            Button("Upgrade to Premium") {
                Task {
                    try? await checkout.purchase("plan_xxxxx")
                }
            }
        }
    }
}
```

## Getting started

<Steps>
  <Step title="Install the SDK">
    Add the WhopCheckout package to your Xcode project via Swift Package Manager.

    [Installation guide →](/developer/guides/ios/installation)

  </Step>

  <Step title="Get your API key">
    Create an API key with the `iap:read` permission in your [Developer Settings](https://whop.com/dashboard/developer).
  </Step>

  <Step title="Configure the SDK">
    Initialize the SDK with your company ID, API key, and plan mappings via `Checkout.shared.configure()`.
  </Step>

  <Step title="Build your paywall">
    Display plans and handle purchases. The SDK automatically uses Whop checkout in the US and StoreKit elsewhere.

    [Build a paywall →](/developer/guides/ios/build-a-paywall)

  </Step>
</Steps>

## Reference

<Card title="API Reference" icon="book" href="/developer/guides/ios/checkout-reference">
  Complete API documentation for all Checkout classes, methods, and types
</Card>

## Requirements

- iOS 17.0+
- Xcode 15.0+
- Swift 5.10+

# Push notifications

Source: https://docs.whop.com/developer/guides/notifications

Send push notifications to engage your users

Send push notifications to users in your app. Notifications appear in the Whop mobile app and web interface.

There are two ways to send notifications:

- **Experience notifications** - Send to users who have access to an experience (your app customers)
- **Company notifications** - Send to team members of a company (dashboard app users)

<Info>
  To send experience notifications, the experience must belong to your app. To
  send company notifications, the company must have your app installed. No
  additional permissions are required.
</Info>

# Sending to everyone in an experience

Send notifications to all users with access to an experience:

<CodeGroup>
  ```typescript Typescript theme={null}
  const result = await client.notifications.create({
    experience_id: 'exp_xxxxxxxxxxxxxx',
    title: 'New Feature Available',
    subtitle: 'Check it out now',
    content: 'We just released a new feature that helps you track your progress better.',
  });

console.log(result.success); // true

````

```python Python theme={null}
result = client.notifications.create(
    experience_id="exp_xxxxxxxxxxxxxx",
    title="New Feature Available",
    subtitle="Check it out now",
    content="We just released a new feature that helps you track your progress better.",
)

print(result.success)  # True
````

```ruby Ruby theme={null}
result = client.notifications.create(
  experience_id: "exp_xxxxxxxxxxxxxx",
  title: "New Feature Available",
  subtitle: "Check it out now",
  content: "We just released a new feature that helps you track your progress better."
)

puts result.success  # true
```

</CodeGroup>

<Note>
  **Example use case:** If you're building a fitness tracking app, you could
  send a notification to everyone when a new workout program is released, or
  send targeted notifications to users who completed a 7-day streak to celebrate
  their achievement.
</Note>

## Sending to specific users

Use the `user_ids` parameter to send notifications only to specific users. These users must also have access to the experience.

<CodeGroup>
  ```typescript Typescript theme={null}
  const result = await client.notifications.create({
    experience_id: 'exp_xxxxxxxxxxxxxx',
    title: 'Complete your daily workout',
    content: 'You\'re 50% of the way to your goal. Finish strong!',
    user_ids: ['user_abc123', 'user_def456'],
  });
  ```

```python Python theme={null}
result = client.notifications.create(
    experience_id="exp_xxxxxxxxxxxxxx",
    title="Complete your daily workout",
    content="You're 50% of the way to your goal. Finish strong!",
    user_ids=["user_abc123", "user_def456"],
)
```

```ruby Ruby theme={null}
result = client.notifications.create(
  experience_id: "exp_xxxxxxxxxxxxxx",
  title: "Complete your daily workout",
  content: "You're 50% of the way to your goal. Finish strong!",
  user_ids: ["user_abc123", "user_def456"]
)
```

</CodeGroup>

# Sending to company team members

Send notifications to all team members of a company (dashboard app users):

<CodeGroup>
  ```typescript Typescript theme={null}
  const result = await client.notifications.create({
    company_id: 'biz_xxxxxxxxxxxxxx',
    title: 'Monthly Report Ready',
    subtitle: 'October 2024',
    content: 'Your monthly analytics report has been generated and is ready to view.',
  });
  ```

```python Python theme={null}
result = client.notifications.create(
    company_id="biz_xxxxxxxxxxxxxx",
    title="Monthly Report Ready",
    subtitle="October 2024",
    content="Your monthly analytics report has been generated and is ready to view.",
)
```

```ruby Ruby theme={null}
result = client.notifications.create(
  company_id: "biz_xxxxxxxxxxxxxx",
  title: "Monthly Report Ready",
  subtitle: "October 2024",
  content: "Your monthly analytics report has been generated and is ready to view."
)
```

</CodeGroup>

<Note>
  **Example use case:** If you're building a tax filing dashboard, you could
  send notifications to all team members when a filing deadline is approaching,
  or send targeted reminders to specific users who still need to complete steps
  in the filing process.
</Note>

## Sending to specific team members

Use the `user_ids` parameter to send notifications only to specific team members. These users must also be team members of the company.

<CodeGroup>
  ```typescript Typescript theme={null}
  const result = await client.notifications.create({
    company_id: 'biz_xxxxxxxxxxxxxx',
    title: 'Action Required',
    content: 'Please review and approve the pending invoices.',
    user_ids: ['user_manager1', 'user_manager2'],
  });
  ```

```python Python theme={null}
result = client.notifications.create(
    company_id="biz_xxxxxxxxxxxxxx",
    title="Action Required",
    content="Please review and approve the pending invoices.",
    user_ids=["user_manager1", "user_manager2"],
)
```

```ruby Ruby theme={null}
result = client.notifications.create(
  company_id: "biz_xxxxxxxxxxxxxx",
  title: "Action Required",
  content: "Please review and approve the pending invoices.",
  user_ids: ["user_manager1", "user_manager2"]
)
```

</CodeGroup>

# Deep linking with rest_path

Direct users to specific pages in your app when they tap a notification using the `rest_path` parameter.

## Setting up your app path

First, configure your app path in the dashboard to handle the dynamic route parameter:

1. Go to your app settings in the [developer dashboard](https://whop.com/dashboard/developer)
2. In the hosting section, update your "App path" to include `[restPath]`

**For experience apps:**

```
/experiences/[experienceId]/[restPath]
```

**For dashboard apps:**

```
/companies/[companyId]/[restPath]
```

## Sending notifications with deep links

Add the `rest_path` parameter to your notification. This will be appended to your app's base URL.

<CodeGroup>
  ```typescript Typescript theme={null}
  // Experience app: Direct to a specific workout
  await client.notifications.create({
    experience_id: 'exp_xxxxxxxxxxxxxx',
    title: 'Today\'s Recommended Workout',
    content: 'Based on your progress, we recommend this HIIT session.',
    rest_path: '/workouts/hiit-advanced-1',
  });

// Dashboard app: Direct to a specific report
await client.notifications.create({
company_id: 'biz_xxxxxxxxxxxxxx',
title: 'Unusual Activity Detected',
content: 'Review the flagged transactions in your dashboard.',
rest_path: '/reports/flagged-transactions',
});

````

```python Python theme={null}
# Experience app: Direct to a specific workout
client.notifications.create(
    experience_id="exp_xxxxxxxxxxxxxx",
    title="Today's Recommended Workout",
    content="Based on your progress, we recommend this HIIT session.",
    rest_path="/workouts/hiit-advanced-1",
)

# Dashboard app: Direct to a specific report
client.notifications.create(
    company_id="biz_xxxxxxxxxxxxxx",
    title="Unusual Activity Detected",
    content="Review the flagged transactions in your dashboard.",
    rest_path="/reports/flagged-transactions",
)
````

```ruby Ruby theme={null}
# Experience app: Direct to a specific workout
client.notifications.create(
  experience_id: "exp_xxxxxxxxxxxxxx",
  title: "Today's Recommended Workout",
  content: "Based on your progress, we recommend this HIIT session.",
  rest_path: "/workouts/hiit-advanced-1"
)

# Dashboard app: Direct to a specific report
client.notifications.create(
  company_id: "biz_xxxxxxxxxxxxxx",
  title: "Unusual Activity Detected",
  content: "Review the flagged transactions in your dashboard.",
  rest_path: "/reports/flagged-transactions"
)
```

</CodeGroup>

## Handling the route in your app

When a user taps the notification, they'll be directed to the full URL constructed from your app path and the `rest_path`.

**Example for experience app:**

If your app is hosted at `https://your-app.com` and you send:

```typescript theme={null}
rest_path: '/posts/post_123'
```

The user will open:

```
https://your-app.com/experiences/exp_xxxxxxxxxxxxxx/posts/post_123
```

**In Next.js**, create a file at:

```
app/experiences/[experienceId]/posts/[postId]/page.tsx
```

**In Express**, handle the route:

```typescript theme={null}
app.get('/experiences/:experienceId/posts/:postId', (req, res) => {
  // Handle the notification deep link
})
```

You can also use query parameters:

```typescript theme={null}
rest_path: '?action=review&id=123'
```

# Custom notification icons

By default, notifications display your experience or company avatar. Customize the icon by providing a Whop user ID whose profile picture will be used.

<CodeGroup>
  ```typescript Typescript theme={null}
  await client.notifications.create({
    experience_id: 'exp_xxxxxxxxxxxxxx',
    title: 'New Comment',
    content: 'Sarah replied to your post: "Great progress!"',
    icon_user_id: 'user_sarah123',
    rest_path: '/posts/my-post-123',
  });
  ```

```python Python theme={null}
client.notifications.create(
    experience_id="exp_xxxxxxxxxxxxxx",
    title="New Comment",
    content='Sarah replied to your post: "Great progress!"',
    icon_user_id="user_sarah123",
    rest_path="/posts/my-post-123",
)
```

```ruby Ruby theme={null}
client.notifications.create(
  experience_id: "exp_xxxxxxxxxxxxxx",
  title: "New Comment",
  content: 'Sarah replied to your post: "Great progress!"',
  icon_user_id: "user_sarah123",
  rest_path: "/posts/my-post-123"
)
```

</CodeGroup>

This is useful for social features where you want to show who performed an action (commented, liked, followed, etc).

# OAuth

Source: https://docs.whop.com/developer/guides/oauth

Use OAuth to let users sign in with Whop on your website

Use OAuth 2.1 + PKCE with OpenID Connect (OIDC) to let users sign in with Whop on your website or app.
You can use the returned access tokens to access data and perform actions on behalf of whop users.

<Info>
  OAuth endpoints live at `https://api.whop.com/oauth/`
</Info>

## Step 1: Get your Client ID and Scopes

<Steps>
  <Step title="Create or select your app">
    Go to the [Developer Dashboard](https://whop.com/dashboard/developer), create a new app or select an existing one.
  </Step>

  <Step title="Add redirect URIs">
    In the OAuth section, add every redirect URI you plan to use (exact match required).
  </Step>

  <Step title="Copy credentials">
    Copy your `client_id` (looks like `app_xxxxx`).
  </Step>

  <Step title="Select your scopes">
    Select your available oauth scopes from the "View available scopes" button and select only the ones you need. Copy them as JSON.
  </Step>
</Steps>

## Step 2: Send users to authorize

In your web or mobile client, use PKCE to securely redirect users to Whop's OAuth flow.

```typescript expandable theme={null}
const STORAGE_KEY = 'whop_oauth_pkce'

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(
    /[+/=]/g,
    (c) => ({ '+': '-', '/': '_', '=': '' })[c]!,
  )
}

function randomString(len: number) {
  return base64url(crypto.getRandomValues(new Uint8Array(len)))
}

async function sha256(str: string) {
  return base64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))),
  )
}

async function startWhopOAuth(
  clientId: string,
  redirectUri: string,
  scope = 'openid profile email',
  companyId?: string,
) {
  const pkce = { codeVerifier: randomString(32), state: randomString(16), nonce: randomString(16) }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pkce))

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state: pkce.state,
    nonce: pkce.nonce,
    code_challenge: await sha256(pkce.codeVerifier),
    code_challenge_method: 'S256',
    ...(companyId && { company_id: companyId }),
  })

  window.location.href = `https://api.whop.com/oauth/authorize?${params}`
}
```

Call `startWhopOAuth` to redirect the user:

```typescript theme={null}
await startWhopOAuth(
  'app_xxxxxxxxx',
  'https://yourapp.com/oauth/callback',
  'openid profile email', // optionally specify more custom scopes here
  'biz_xxxxx', // optionally specify a scoped company id here
)
```

If the user is not logged in, Whop will prompt for login, then show the consent screen.
If the user has already approved your application for the requested scopes,
they will be automatically redirected back without needing to confirm twice.

<Note>
  If you provide `companyId`, tokens are company-scoped for a specific user, meaning you
  will only have access to resources that that particular user can control on the specified Whop company.
</Note>

## Step 3: Handle the callback and exchange the code

Whop redirects back to your `redirect_uri` with `code` and `state`. Use this function to verify the state, exchange the code for tokens, and retrieve credentials:

```typescript expandable theme={null}
const STORAGE_KEY = 'whop_oauth_pkce'

interface WhopTokens {
  access_token: string
  refresh_token: string
  id_token?: string // only present if "openid" scope was requested
  token_type: string
  expires_in: number
  obtained_at: number // we add this client-side for refresh logic
}

async function handleWhopCallback(clientId: string, redirectUri: string): Promise<WhopTokens> {
  const params = new URLSearchParams(window.location.search)
  const [code, returnedState, error] = [
    params.get('code'),
    params.get('state'),
    params.get('error'),
  ]
  if (error) throw new Error(`OAuth error: ${error} - ${params.get('error_description') || ''}`)

  const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
  sessionStorage.removeItem(STORAGE_KEY)
  if (!stored || returnedState !== stored.state) throw new Error('Invalid state - possible CSRF')

  const res = await fetch('https://api.whop.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: stored.codeVerifier,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Token exchange failed: ${err.error_description || res.status}`)
  }

  const tokens = await res.json()
  return { ...tokens, obtained_at: Date.now() }
}

function storeTokens(tokens: WhopTokens) {
  document.cookie = `whop_tokens=${encodeURIComponent(JSON.stringify(tokens))}; path=/; max-age=${60 * 60 * 24 * 30}; secure; samesite=strict`
}

function getTokens(): WhopTokens | null {
  const match = document.cookie.match(/whop_tokens=([^;]+)/)
  return match ? JSON.parse(decodeURIComponent(match[1])) : null
}

function clearTokens() {
  document.cookie = 'whop_tokens=; path=/; max-age=0'
}
```

On your callback page:

```typescript theme={null}
const tokens = await handleWhopCallback('app_xxxxxxxxx', 'https://yourapp.com/oauth/callback')
storeTokens(tokens)
```

## Step 4: Use the tokens

Initialize the Whop SDK with the user's access token:

```typescript theme={null}
import Whop from '@whop/sdk'

const tokens = getTokens()

const client = new Whop({
  apiKey: tokens.access_token,
})
```

View our [API Reference](/api-reference) to see all available endpoints.

## Step 5: Refresh tokens

Access tokens expire after 1 hour. Use the refresh token to get new credentials:

```typescript expandable theme={null}
async function refreshTokens(clientId: string, companyId?: string): Promise<WhopTokens> {
  const tokens = getTokens()
  if (!tokens?.refresh_token) throw new Error('No refresh token available')

  const res = await fetch('https://api.whop.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: clientId,
      ...(companyId && { company_id: companyId }),
    }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    if (res.status === 401 || error.error === 'invalid_grant') {
      clearTokens()
      throw new Error('Session expired - please log in again')
    }
    throw new Error(`Token refresh failed: ${error.error_description || res.status}`)
  }

  const newTokens = await res.json()
  const stored = { ...newTokens, obtained_at: Date.now() }
  storeTokens(stored)
  return stored
}

async function getValidAccessToken(clientId: string): Promise<string> {
  const tokens = getTokens()
  if (!tokens) throw new Error('Not logged in')

  const expiresAt = tokens.obtained_at + tokens.expires_in * 1000
  const needsRefresh = Date.now() > expiresAt - 5 * 60 * 1000 // 5 min buffer

  if (needsRefresh) {
    const refreshed = await refreshTokens(clientId)
    return refreshed.access_token
  }

  return tokens.access_token
}
```

Usage:

```typescript theme={null}
const accessToken = await getValidAccessToken('app_xxxxxxxxx')
```

<Note>
  Refresh tokens rotate on each use. Always store the new tokens returned from the refresh endpoint.
  If you provided `company_id` during authorization, you must provide the same `company_id` when refreshing.
</Note>

## Step 6: Userinfo and revoke

### Get user info

Fetch the authenticated user's profile using the userinfo endpoint:

```typescript theme={null}
interface WhopUserInfo {
  sub: string // user tag (e.g. "user_xxxxx")
  name?: string // requires "profile" scope
  preferred_username?: string // requires "profile" scope
  picture?: string // requires "profile" scope
  email?: string // requires "email" scope
  email_verified?: boolean // requires "email" scope
}

async function getUserInfo(accessToken: string): Promise<WhopUserInfo> {
  const res = await fetch('https://api.whop.com/oauth/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch user info: ${res.status}`)
  return res.json()
}
```

<Note>
  The fields returned depend on the scopes granted. `openid` is required, `profile` adds name/username/picture, `email` adds email fields.
</Note>

### Revoke tokens on logout

When a user logs out, revoke their refresh token. Access tokens expire after 1 hour and cannot be server-revoked.

```typescript theme={null}
async function logout(clientId: string) {
  const tokens = getTokens()
  if (tokens?.refresh_token) {
    await fetch('https://api.whop.com/oauth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokens.refresh_token, client_id: clientId }),
    })
  }
  clearTokens()
}
```

<Warning>
  Always revoke tokens when users log out. This invalidates the refresh token immediately, preventing unauthorized access even if the token was compromised.
</Warning>

## Error handling

OAuth errors follow the standard format:

```json theme={null}
{
  "error": "invalid_grant",
  "error_description": "Authorization code has expired"
}
```

Common error codes:

- `invalid_request` - Missing or invalid parameter
- `invalid_grant` - Code/token expired or revoked
- `invalid_client` - Unknown client_id
- `insufficient_scope` - Token doesn't have required scope
- `rate_limit_exceeded` - Too many requests (check `Retry-After` header)

# Permissions

Source: https://docs.whop.com/developer/guides/permissions

Configure the permissions that your app needs

To retrieve private data and perform actions on behalf of companies, your app needs to be installed on the company.

A creator can install your app by finding it in the app store, or by visiting your "direct install" link
which looks like: `https://whop.com/apps/app_xxxxxxxxx` (where `app_xxxxxxxxx` is the id of your app).

Your app can only make calls if it has the required permissions for the api call.
Every endpoint documents it's required permissions in the api reference.

<Note>
  We are working on a full OAuth based permission mode that will allow apps to
  request permissions from users directly and operate on their behalf.
</Note>

## Request permissions

<Warning>
  The permissions flow is still required even if you are trying to access data
  on your own company. This will ensure your app works the same on your company
  as well as when it is installed by others.
</Warning>

<Steps>
  <Step title="Go to your app's permissions settings">
    1. Go to the [developer dashboard](https://whop.com/dashboard/developer)
    2. Select or create an app
    3. Click on the **Permissions** tab

    <Frame>
      <img alt="Permissions Settings" />
    </Frame>

  </Step>

  <Step title="Add permissions">
    1. Click on **Add permissions** 2. Select the permissions you want to add 3.
       Confirm by clicking **Add**
  </Step>

  <Step title="Configure each permission">
    1. Write a short explanation for why your app needs the permission
    2. Choose whether the permission is required or optional. Creators will be able to toggle off optional permissions during install.

    <Frame>
      <img alt="Permissions Justification" />
    </Frame>

  </Step>

  <Step title="Save your permissions">
    <Frame>
      <img alt="Save Permissions Settings" />
    </Frame>
  </Step>

  <Step title="Install your app">
    1. Visit your app's direct install link: `https://whop.com/apps/app_xxxxxxxxx/install` (where `app_xxxxxxxxx` is the id of your app).
    2. Select your company you want to install the app on
    3. Approve the permissions you requested
  </Step>
</Steps>

Creators will now need to approve the permissions you requested before installing your app:

<Frame>
  <img alt="Permissions Prompt" />
</Frame>

## Updating your permissions

You can update your requested permissions anytime. Creators will see a "Re-approve" button when they visit your app.

Creators can always update their granted permissions and re-approve new permissions in their [Authorized apps](https://whop.com/dashboard/settings/authorized-apps) settings page.

To manually navigate to the settings, go to: `Dashboard -> Settings -> Authorized apps`

<video />

## FAQ

<AccordionGroup>
  <Accordion title="How many permissions can I request?">
    You can request up to 100 permissions.
  </Accordion>

  <Accordion title="How do I know which permissions I need?">
    You can find the required permissions for each SDK method documented in the
    [API reference](/api-reference/payments/list-payments).

    <Frame>
      <img alt="SDK Reference Permissions" />
    </Frame>

  </Accordion>

  <Accordion title="Can I request additional permissions afterwards?">
    Yes. You can request additional permissions and the creator will be asked to re-approve them.

    <Note>
      Keep in mind that until the permissions are re-approved, API requests requiring the **newly requested** permissions will fail. Make sure to handle these errors gracefully in your code.
    </Note>

    <Warning>
      When developing your app, make sure you re-approve the permissions yourself in your [Authorized apps](https://whop.com/dashboard/settings/authorized-apps) settings.

      See [Configure your permissions](/developer/guides/permissions#updating-your-permissions) for more information.
    </Warning>

  </Accordion>
</AccordionGroup>

# React Native

Source: https://docs.whop.com/developer/guides/react-native

Build cross-platform mobile and web apps for Whop using React Native.

Build native iOS, Android, and web experiences for Whop using a single React Native codebase. Your apps run directly inside the Whop mobile app and can access native platform features.

## How it Works

Whop React Native apps are embedded experiences that run on multiple platforms:

- **Mobile (iOS/Android)**: Apps run natively inside the Whop mobile app with full platform integration
- **Web**: Apps run in the browser with automatic fallbacks for platform-specific features
- **Universal Code**: Write once, deploy everywhere with platform-specific optimizations

Your app receives authenticated user context and can make API calls through the Whop SDK. The build system automatically handles platform-specific bundling using Metro for mobile and esbuild for web.

---

## Getting Started

### System Requirements

Before you begin, make sure your system meets the following requirements:

- [Node.js 22](https://nodejs.org/) or later
- [pnpm 9.15](https://pnpm.io/) or later

To check, run `node -v` and `pnpm -v`.

### Create Your App

Create a new Whop React Native app using the CLI:

```bash theme={null}
pnpm create @whop/react-native@latest
```

This sets up a new project with the following structure:

```
my-app/
├── src/
│   └── views/
│       ├── experience-view.tsx    # Hub/experience view
│       ├── dashboard-view.tsx     # Company dashboard view
│       └── discover-view.tsx      # Discovery/marketplace view (optional)
├── .env.local                     # Environment variables
├── package.json
└── babel.config.js
```

### Configure Environment Variables

Create a `.env.local` file in the root directory:

```env theme={null}
WHOP_API_KEY=your_api_key
NEXT_PUBLIC_WHOP_APP_ID=your_app_id
NEXT_PUBLIC_WHOP_AGENT_USER_ID=your_agent_user_id
NEXT_PUBLIC_WHOP_COMPANY_ID=your_company_id
```

Get these credentials from the [Whop Developer Dashboard](https://whop.com/dashboard/developer):

1. Go to the Whop Developer Dashboard
2. Create a new app or select an existing one
3. Copy the environment variables from the app settings

---

## Views

<Frame>
  <img alt="Project Structure" />
</Frame>

Whop apps use different "views" depending on where they're displayed. Each view receives authenticated context as props.

### Experience View

The main view for hub/experience apps. This is where users interact with your app content.

```tsx theme={null}
// src/views/experience-view.tsx
import React from 'react'
import { View, Text, ScrollView } from 'react-native'
import type { ExperienceViewProps } from '@whop/react-native'

export function ExperienceView(props: ExperienceViewProps) {
  const { experienceId, companyId, currentUserId, path, params } = props

  return (
    <ScrollView>
      <Text>Experience: {experienceId}</Text>
      <Text>User: {currentUserId}</Text>
    </ScrollView>
  )
}
```

**Props:**

- `experienceId` - The experience ID
- `companyId` - The company that owns this experience
- `currentUserId` - The authenticated user (or `null` if not logged in)
- `path` - Navigation path as array (e.g., `["courses", "123"]`)
- `params` - Query parameters as object

### Dashboard View

For company dashboard integrations where sellers manage their business.

```tsx theme={null}
// src/views/dashboard-view.tsx
import React from 'react'
import { View, Text } from 'react-native'
import type { DashboardViewProps } from '@whop/react-native'

export function DashboardView(props: DashboardViewProps) {
  const { companyId, currentUserId, path, params } = props

  return (
    <View>
      <Text>Dashboard for company: {companyId}</Text>
    </View>
  )
}
```

**Props:**

- `companyId` - The company ID
- `currentUserId` - The authenticated user
- `path` - Navigation path as array
- `params` - Query parameters

### Discover View (Optional)

For marketplace/discovery experiences where users browse content.

```tsx theme={null}
// src/views/discover-view.tsx
import React from 'react'
import type { DiscoverViewProps } from '@whop/react-native'

export function DiscoverView(props: DiscoverViewProps) {
  const { currentUserId, path, params } = props

  // Your discovery UI
}
```

---

## Fetching Data

### Using the Whop SDK

<Warning>This still uses the deprecated SDK - we will update and changes this very soon to be 10x better!</Warning>

The Whop SDK is available out of the box for client-side data fetching:

```tsx theme={null}
import { whopSdk } from '@whop/react-native'
import { useQuery } from '@tanstack/react-query'

export function UserProfile() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => whopSdk.users.getCurrentUser(),
  })

  return <Text>{user?.name}</Text>
}
```

<Info>
  We recommend using [TanStack Query](https://tanstack.com/query/latest) for data fetching as it handles caching, loading states, and refetching automatically.
</Info>

<Warning>
  Some SDK operations are "server only" and must be called from your API. Check the [SDK reference](/developer/getting-started) for which methods require server-side execution.
</Warning>

### Making Authenticated API Requests

For server-side operations, create API routes and call them from your React Native app:

<Steps>
  <Step title="Set your API base URL">
    Configure your API origin in the [developer dashboard](https://whop.com/dashboard/developer) under "Base URL".

    <Frame>
      <img alt="Base URL" />
    </Frame>

  </Step>

  <Step title="Create an API endpoint">
    ```tsx theme={null}
    // app/api/user/route.ts
    import { whopSdk } from "@/lib/whop";

    export async function GET(request: Request) {
      const { userId } = await whopSdk.verifyUserToken(request.headers);
      const user = await whopSdk.users.getUser({ userId });

      return Response.json(user, { status: 200 });
    }
    ```

    See [Set up the API client](/sdk/whop-api-client) for SDK configuration.

  </Step>

  <Step title="Call from React Native">
    Use the `apiOrigin` to make authenticated requests:

    ```tsx theme={null}
    import { useQuery } from "@tanstack/react-query";
    import { __internal_execSync } from "@whop/react-native";

    const { apiOrigin } = __internal_execSync("getAppApiOrigin", {});

    export function User() {
      const { data: user, isPending } = useQuery({
        queryKey: ["user"],
        queryFn: () => fetch(`${apiOrigin}/api/user`).then((res) => res.json()),
      });

      if (isPending) return <Text>Loading...</Text>;

      return <Text>{user?.name}</Text>;
    }
    ```

  </Step>
</Steps>

<Note>
  It's important to use the `apiOrigin` for authenticated requests. This ensures requests go through Whop's proxy with proper authentication headers.
</Note>

### Example: Check Access to an Experience

```tsx theme={null}
// Component
import { useQuery } from '@tanstack/react-query'
import { __internal_execSync } from '@whop/react-native'

const { apiOrigin } = __internal_execSync('getAppApiOrigin', {})

export function ProtectedContent({ experienceId }: { experienceId: string }) {
  const { data: access, isPending } = useQuery({
    queryKey: ['access', experienceId],
    queryFn: () =>
      fetch(`${apiOrigin}/api/access?experienceId=${experienceId}`).then((res) => res.json()),
  })

  if (isPending) return <Text>Loading...</Text>
  if (!access?.hasAccess) return <Text>Access Denied</Text>

  return <Text>Welcome! You have access.</Text>
}
```

<Warning>This still uses the deprecated SDK - we will update and changes this very soon to be 10x better!</Warning>

```tsx theme={null}
// app/api/access/route.ts
import { whopSdk } from '@/lib/whop'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const experienceId = request.nextUrl.searchParams.get('experienceId')
  if (!experienceId) {
    return new Response('Experience ID required', { status: 400 })
  }

  const { userId } = await whopSdk.verifyUserToken(request.headers)

  const access = await whopSdk.access.checkIfUserHasAccessToExperience({
    experienceId,
    userId,
  })

  return Response.json(access, { status: 200 })
}
```

---

## Styling

### Color Themes

React Native provides a `useColorScheme` hook to detect the device's color scheme. This works automatically in Whop apps:

```tsx theme={null}
import { useColorScheme } from 'react-native'

export function ThemedView() {
  const colorScheme = useColorScheme()
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#fff'

  return <View style={{ backgroundColor }} />
}
```

### Using Radix UI Colors

For a comprehensive color system with automatic dark mode, use the `useColors` hook pattern with Radix UI colors:

```bash theme={null}
pnpm add @radix-ui/colors
```

```tsx theme={null}
// hooks/use-colors.ts
import { useColorScheme } from 'react-native'
import {
  gray,
  grayA,
  grayDark,
  grayDarkA,
  blue,
  blueA,
  blueDark,
  blueDarkA,
  red,
  redA,
  redDark,
  redDarkA,
  green,
  greenA,
  greenDark,
  greenDarkA,
  amber,
  amberA,
  amberDark,
  amberDarkA,
} from '@radix-ui/colors'

export function useColors() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  return {
    transparent: 'transparent' as const,
    ...(isDark ? grayDark : gray),
    ...(isDark ? grayDarkA : grayA),
    ...(isDark ? blueDark : blue),
    ...(isDark ? blueDarkA : blueA),
    ...(isDark ? redDark : red),
    ...(isDark ? redDarkA : redA),
    ...(isDark ? greenDark : green),
    ...(isDark ? greenDarkA : greenA),
    ...(isDark ? amberDark : amber),
    ...(isDark ? amberDarkA : amberA),
  }
}
```

**Usage:**

```tsx theme={null}
export function StyledComponent() {
  const colors = useColors()

  return (
    <View style={{ backgroundColor: colors.gray1 }}>
      <Text style={{ color: colors.gray12 }}>Themed text</Text>
    </View>
  )
}
```

---

## Navigation

Use the internal navigation APIs to navigate between screens and present modals:

### Navigate to a New Screen

```tsx theme={null}
import { __internal_execSync } from '@whop/react-native'

function navigateToPage() {
  __internal_execSync('routerPush', {
    path: ['courses', '123'],
    params: { section: 'intro' },
  })
}
```

The `path` and `params` are passed as props to your view component.

### Go Back

```tsx theme={null}
import { __internal_execSync } from '@whop/react-native'

function goBack() {
  __internal_execSync('routerPop', {})
}
```

### Present a Sheet/Modal

```tsx theme={null}
import { __internal_execSync } from '@whop/react-native'

function showModal() {
  __internal_execSync('routerPresentSheet', {
    path: ['modal', 'settings'],
    params: {},
  })
}

function hideModal() {
  __internal_execSync('routerDismissSheet', {})
}
```

### Get Current Route

```tsx theme={null}
import { __internal_execSync } from '@whop/react-native'

const currentRoute = __internal_execSync('routerGetCurrent', {})
console.log(currentRoute.path) // ["courses", "123"]
console.log(currentRoute.params) // { section: "intro" }
```

---

## Platform-Specific Features

### Navigation Bar

Set the navigation bar title and description:

```tsx theme={null}
import { __internal_execSync } from '@whop/react-native'

__internal_execSync('setNavigationBarData', {
  title: 'Course Details',
  description: 'Learn React Native',
})
```

### Screen Orientation

Control the screen orientation:

```tsx theme={null}
import { __internal_execSync } from '@whop/react-native'

// Lock to portrait
__internal_execSync('setScreenOrientationMode', {
  targetScreenOrientationMode: 'portrait',
})

// Lock to landscape
__internal_execSync('setScreenOrientationMode', {
  targetScreenOrientationMode: 'landscape',
})

// Allow rotation
__internal_execSync('setScreenOrientationMode', {
  targetScreenOrientationMode: 'rotate',
})
```

### Haptic Feedback

Provide haptic feedback on mobile devices:

```tsx theme={null}
import { Haptics } from '@whop/react-native'

async function triggerHaptic() {
  await Haptics.trigger('impactMedium', {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  })
}
```

**Available haptic types:**

- `"selection"` - Light selection feedback
- `"impactLight"` | `"impactMedium"` | `"impactHeavy"` - Impact feedback
- `"notificationSuccess"` | `"notificationWarning"` | `"notificationError"` - Notification feedback

### Local Caching

Store data locally on the device:

```tsx theme={null}
import { __internal_execSync } from '@whop/react-native'

// Save data
__internal_execSync('cacheSet', {
  key: 'user_preferences',
  data: JSON.stringify({ theme: 'dark' }),
})

// Retrieve data
const result = __internal_execSync('cacheGet', {
  key: 'user_preferences',
})
const preferences = JSON.parse(result.data || '{}')
```

### Host App Details

Get information about the Whop app:

```tsx theme={null}
import { __internal_execSync } from '@whop/react-native'

const hostDetails = __internal_execSync('getHostAppDetails', {})
console.log(hostDetails.platform) // "ios" | "android" | "web"
console.log(hostDetails.version) // "1.2.3"
console.log(hostDetails.build) // "123"
console.log(hostDetails.buildType) // "appstore" | "testflight" | "debug"
```

---

## In-App Purchases

Accept payments directly within your app:

```tsx theme={null}
import { __internal_execAsync } from '@whop/react-native'

async function handlePurchase(planId: string) {
  try {
    const result = await __internal_execAsync('inAppPurchase', {
      planId: planId,
      id: 'optional-checkout-config-id',
    })

    console.log('Payment successful!')
    console.log('Session ID:', result.sessionId)
    console.log('Receipt ID:', result.receiptId)

    // Unlock content for user
  } catch (error) {
    console.error('Payment failed:', error)
  }
}
```

For a complete guide on accepting payments, see the [Accept payments documentation](/developer/guides/accept-payments).

---

## Using Third-Party Libraries

Most React Native libraries work out of the box. Here are the recommended versions for common libraries:

```json theme={null}
{
  "dependencies": {
    "@react-native-async-storage/async-storage": "2.1.0",
    "@react-native-community/netinfo": "12.0.3",
    "@shopify/flash-list": "1.7.2",
    "burnt": "0.13.2",
    "react-native-mmkv": "3.1.0",
    "react-native-safe-area-context": "5.5.2",
    "react-native-screens": "4.6.0",
    "react-native-svg": "15.12.0",
    "react-native-gesture-handler": "2.27.2",
    "react-native-reanimated": "3.18.0",
    "react-native-haptic-feedback": "2.3.3",
    "lottie-react-native": "7.3.2"
  }
}
```

<Warning>
  When adding new libraries, make sure they're compatible with React Native. Some npm packages are web-only and won't work on mobile platforms.
</Warning>

---

## Deploying

### Build and Deploy

The `ship` command builds your app for all platforms and uploads it as a development build:

```bash theme={null}
pnpm ship
```

Build for specific platforms:

```bash theme={null}
pnpm ship --ios           # iOS only
pnpm ship --android       # Android only
pnpm ship --web          # Web only
pnpm ship --ios --android # iOS and Android
```

<Info>
  The `ship` command deploys as a **development build**, which is safe to run on existing production apps. It won't affect your live users.
</Info>

### Development vs Production Builds

**Development Builds:**

- Deployed with `pnpm ship`
- Only visible when "dev mode" is enabled (shake phone)
- Safe to test without affecting production users
- Can be deployed anytime

**Production Builds:**

- Promoted from development builds via the dashboard
- Visible to all users
- Requires approval/review
- Should be thoroughly tested first

### Preview Your App

After deploying a development build, preview it on your device:

```bash theme={null}
pnpm preview
```

This generates a QR code that installs your app.

<Warning>
  To preview development builds, you must **SHAKE YOUR PHONE** to enable "dev mode" in the Whop app. This allows you to see non-production builds.
</Warning>

### Build Commands

Additional commands for managing builds:

```bash theme={null}
pnpm build         # Build without uploading
pnpm upload        # Upload previously built files
pnpm clean         # Clean build directory
```

### Promoting to Production

1. Deploy a development build: `pnpm ship`
2. Test thoroughly in dev mode (shake to enable)
3. Go to your [app dashboard](https://whop.com/dashboard/developer)
4. Navigate to the Builds tab
5. Select your development build
6. Click "Promote to Production"

<Frame>
  <img alt="Promote to production" />
</Frame>

Your app will be reviewed and deployed to all users once approved.

### Rollback

From the builds screen you can also instantly rollback to a previous production build which will be pushed live to all users across Whop.

<Frame>
  <img alt="Rollback" />
</Frame>

---

## CLI Reference

The `@whop/react-native` CLI provides commands for building and deploying your app:

### Commands

```bash theme={null}
pnpm ship [--ios] [--android] [--web]    # Build + upload development build
pnpm build [--ios] [--android] [--web]   # Build only (no upload)
pnpm upload [--ios] [--android] [--web]  # Upload existing build/
pnpm clean                                # Clean build directory
pnpm preview                              # Generate install QR code
```

### Build Process

When you run `pnpm ship`, the CLI:

1. **Generates Entrypoints** - Creates platform-specific entry files that register your views
2. **Bundles Code**:
   - **Mobile (iOS/Android)**: Uses Metro bundler + Hermes bytecode compiler
   - **Web**: Uses esbuild with React Native Web aliases
3. **Packages Assets** - Collects and optimizes images and other assets
4. **Uploads to Whop** - Creates a development build in your app dashboard
5. **Generates Install Link** - Provides QR code for testing

### Build Output

```
build/
├── entrypoints/        # Generated entry files
│   ├── ios/
│   ├── android/
│   └── web/
├── output/            # Compiled bundles
│   ├── ios/
│   │   └── main_js_bundle.hbc
│   ├── android/
│   │   └── main_js_bundle.hbc
│   └── web/
│       ├── main.js
│       └── index.html
└── app_build_*.zip   # Packaged builds
```

---

## Troubleshooting

### Development Build Not Showing

**Problem**: You deployed a development build but can't see it in the app.

**Solution**: Shake your phone to enable "dev mode". Development builds are only visible when dev mode is active.

### Build Failures

**Problem**: Build fails with Metro or esbuild errors.

**Solutions**:

- Run `pnpm clean` to clear build cache
- Check that all dependencies are installed: `pnpm install`
- Verify Node.js version: `node -v` (should be 22+)
- Check for syntax errors in your views

### API Requests Not Working

**Problem**: API requests return 401 or authentication errors.

**Solutions**:

- Verify you're using `apiOrigin` from `__internal_execSync("getAppApiOrigin", {})`
- Check that `WHOP_API_KEY` is set in `.env.local`
- Ensure your API endpoint calls `whopSdk.verifyUserToken(request.headers)`
- Verify the Base URL is set correctly in the dashboard

### Views Not Found

**Problem**: Build succeeds but views don't render.

**Solutions**:

- Check that view files exist in `src/views/`
- Verify exports match: `export function ExperienceView(props: ExperienceViewProps)`
- Make sure view files end with `.tsx` or `.jsx`

### Libraries Not Working

**Problem**: Third-party library causes crashes on mobile.

**Solutions**:

- Verify the library supports React Native (not just web)
- Use recommended versions from the [Using Libraries](#using-third-party-libraries) section
- Check if the library requires native modules (if so and not in recommended, it is not supported)

### Platform-Specific Issues

**Problem**: App works on one platform but not another.

**Solutions**:

- Use `Platform.OS` to detect platform and provide fallbacks
- Test on all platforms before promoting to production
- Check if you're using platform-specific APIs incorrectly

---

## Next Steps

- [Set up authentication](/developer/guides/authentication) for your API routes
- [Accept payments](/developer/guides/accept-payments) with in-app purchases
- [Use webhooks](/developer/guides/webhooks) to handle events
- Explore the [SDK reference](/developer/api/getting-started) for available APIs

# Save payment methods

Source: https://docs.whop.com/developer/guides/save-payment-methods

Save customer payment methods to charge them later

Use saved payment methods to charge customers automatically for subscriptions, renewals, or usage-based billing without requiring them to enter their card details again.
The customer can save their payment method once using a Whop hosted or embedded flow, and you can bill them at any point in time.

## Save a payment method

<Steps>
  <Step title="Create a checkout configuration in setup mode">
    [Create a checkout configuration](/api-reference/checkout-configurations/create-checkout-configuration) without a plan to collect payment details without charging. Add metadata to be able to link the member and payment method to a customer in your system.

    <CodeGroup>
      ```typescript TypeScript theme={null}
      const checkoutConfiguration = await whopsdk.checkoutConfigurations.create({
        	company_id: "biz_XXXXXX",
        	mode: "setup",
        	redirect_url: "https://mywebsite.com/return_location",
        	metadata: { "customer_id": "my_internal_user_id" }
      });
      ```

      ```python Python theme={null}
      checkout_configuration = whopsdk.checkout_configurations.create(
          company_id="biz_XXXXXX",
          mode="setup",
        	 metadata={ "customer_id": "my_internal_user_id" }
      )
      ```
    </CodeGroup>

  </Step>

  <Step title="Direct the user to checkout">
    Use embedded checkout or redirect the user to save their payment method.

    <Tabs>
      <Tab title="Embedded">
        ```tsx theme={null}
        import { WhopCheckoutEmbed } from "@whop/checkout/react";

        export default function SavePayment() {
          return (
            <WhopCheckoutEmbed
              sessionId={checkoutConfiguration.id}
              returnUrl="https://yoursite.com/setup/complete"
              onComplete={(id) => {
                console.log("Payment method saved");
              }}
            />
          );
        }
        ```
      </Tab>

      <Tab title="Redirect">
        ```typescript theme={null}
        window.location.href = checkoutConfiguration.purchase_url;
        ```
      </Tab>
    </Tabs>

  </Step>

  <Step title="Handle completion">
    Listen for the `setup_intent.succeeded` webhook to get the payment method ID. The CheckoutConfiguration and its metadata will be included on the SetupIntent, which you can use to link the member and payment method to a customer in your system.

    ```typescript theme={null}
    import { waitUntil } from "@vercel/functions";
    import type { NextRequest } from "next/server";
    import { whopsdk } from "@/lib/whop-sdk";

    export async function POST(request: NextRequest): Promise<Response> {
      const requestBodyText = await request.text();
      const headers = Object.fromEntries(request.headers);
      const webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers });

      if (webhookData.type === "setup_intent.succeeded") {
        waitUntil(handleSetupSucceeded(webhookData.data));
      }

      return new Response("OK", { status: 200 });
    }

    async function handleSetupSucceeded(setupIntent) {
      console.log("Payment method ID:", setupIntent.payment_method.id);
      console.log("Member ID:", setupIntent.member.id);
      console.log("Metadata:", setupIntent.metadata);
    }
    ```

    The payment method is now saved and authorized for this member.

  </Step>
</Steps>

## Charge a saved payment method

<Steps>
  <Step title="Get the payment method">
    [List saved payment methods](/api-reference/payment-methods/list-payment-methods) for a member or use the payment method ID from the setup intent in the previous step.

    ```typescript theme={null}
    const payment_methods = await whopsdk.paymentMethods.list({
      member_id: "mber_XXXXXXXX",
    });

    const payment_method = payment_methods.data[0];
    ```

  </Step>

  <Step title="Create an off-session payment">
    Charge the payment method without customer interaction. The [create payment endpoint](/api-reference/payments/create-payment) will respond with a payment object immediately, but
    the payment will be processed asynchronously in the background.

    ```typescript theme={null}
    const payment = await whopsdk.payments.create({
      plan: { initial_price: 40.00, currency: "usd", plan_type: "one_time" },
      company_id: "biz_XXXXXXXX",
      member_id: "mber_XXXXXXXX",
      payment_method_id: "payt_XXXXXXXXX",
    });

    console.log("Payment:", payment.id);
    ```

  </Step>

  <Step title="Handle payment events">
    Listen for payment webhooks to track success or failure.

    ```typescript theme={null}
    if (webhookData.type === "payment.succeeded") {
      await fulfillOrder(webhookData.data);
    }

    if (webhookData.type === "payment.failed") {
      await notifyCustomer(webhookData.data.member.email, webhookData.data.failure_message);
    }
    ```

  </Step>
</Steps>

## Save during checkout

To save a payment method while processing a payment, add `setupFutureUsage: "off_session"` to the embedded checkout.

```tsx theme={null}
<WhopCheckoutEmbed
  planId="plan_XXXXXXXX"
  returnUrl="https://yoursite.com/checkout/complete"
  setupFutureUsage="off_session"
/>
```

The payment method will be saved after successful payment.

## Related resources

<CardGroup>
  <Card title="Accept payments" icon="credit-card" href="/developer/guides/accept-payments">
    Process one-time and subscription payments
  </Card>

  <Card title="Embedded checkout" icon="cart-shopping" href="/payments/checkout-embed">
    Integrate checkout into your website
  </Card>

  <Card title="Webhooks" icon="webhook" href="/developer/guides/webhooks">
    Handle payment events in real-time
  </Card>

  <Card title="Billing portal" icon="browser" href="/developer/guides/setup-billing-portal">
    Let customers manage payment methods
  </Card>
</CardGroup>

# Webhooks

Source: https://docs.whop.com/developer/guides/webhooks

Receive payment, membership and other events from whop programmatically

Use webhooks to handle and respond to whop events in realtime.

Choose between setting up company or app webhooks and follow each respective guide

- Company -> only receive events related to your own company. No permission required.
- App -> receive events on companies your app is installed on. A permission request is required.

## Company webhooks

Webhooks created on a company will receive all events for related to that specific company.

Use this mode if you are

- a creator only interested in events on your particular company.
- an app developer processing payments on your company.

To setup company webhooks, follow these steps

<Steps>
  <Step title="Create the webhook in the whop dashboard">
    Navigate to the base developer tab in your dashboard [here](https://whop.com/dashboard/developer).

    This is *not* your inside your app dashboard.

    Click **"Create Webhook"** in the top right corner.

  </Step>

  <Step title="Select events">
    Enter your webhook URL and select the events that you want to receive.
    Ensure that you are on API version `v1`.

    <Info>
      When testing locally use ngrok or cloudflare tunnels to forward requests to your local development environment.
    </Info>

  </Step>

  <Step title="Handle webhook events">
    Now the provided url will receive `POST` requests for the selected webhook triggers,
    for all resources that belong to the current company for which the webhook was created.

    See the [Receiving and validating webhooks](/developer/guides/webhooks#validating-webhooks) section to see how to handle these events.

  </Step>
</Steps>

## App webhooks

App webhooks allow your app to receive webhooks for events that happen on companies that have your app installed.

Use this mode if you are processing payments on behalf of other companies, or your integration needs to know when events happen on installed companies in order to function.

You may use both company webhooks and app webhooks simultaneously. For example, you may want to listen to waitlist entry creation events on installed companies,
but you only care about payments on your own company. In this case, make a company webhook for payments and an app webhook for waitlist entry creation.

To setup company webhooks, follow these steps

<Steps>
  <Step title="Create the webhook in the whop app dashboard">
    1. Navigate to the developer tab in your dashboard and select your app [here](https://whop.com/dashboard/developer).

    2. Select the `webhooks` tab within your specific app dashboard.

    Click **"Create Webhook"** in the top right corner.

    <Info>
      Note: This webhook should be created, scoped to your specific app. This is not the global company webhook table.
    </Info>

  </Step>

  <Step title="Select events">
    Enter your webhook URL and select the events that you want to receive.
    Ensure that you are on API version `v1`.

    <Info>
      When testing locally use ngrok or cloudflare tunnels to forward requests to your local development environment.
    </Info>

  </Step>

  <Step title="Request permissions">
    In order to receive the events you have selected, you must request the appropriate permissions.

    1. Navigate to the permissions tab.
    2. Click "Add Permissions"
    3. Select the appropriate `webhook_receive:xxxxxxx` permission relevant to the events you want to receive.
    4. Click "Add"
    5. provide a description of why you app needs the permissions
    6. Click "Save" at the bottom.

  </Step>

  <Step title="Handle webhook events">
    Now the provided URL will receive `POST` requests for the selected webhook triggers,
    for all resources that belong to any company on which the app is installed.

    To test this, install the app on your own company, or another test company and trigger the webhooks.

    See the [Receiving and validating webhooks](/developer/guides/webhooks#validating-webhooks) section to see how to handle these events.

  </Step>
</Steps>

## Validating webhooks

When handling webhook events (especially payments related ones) you MUST verify the authenticity of the request.
This is to avoid malicious actors spoofing whop to send fake events to your webhook handler.

Whop follows the [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks) spec to send webhooks.

Follow the below steps to learn how to handle webhook events securely.

<Steps>
  <Step title="Copy your webhook secret and setup your api client">
    If using the whop sdk in a supported programming language, copy your webhook key
    (found in the company or app webhooks table) and store it as the `WHOP_WEBHOOK_KEY` environment variable.

    You can also pass in the SDK client creation like so:

    <CodeGroup>
      ```typescript Typescript theme={null}
      import { Whop } from "@whop/sdk";

      export const whopsdk = new Whop({
         	appID: process.env.NEXT_PUBLIC_WHOP_APP_ID,
         	apiKey: process.env.WHOP_API_KEY,
         	webhookKey: btoa(process.env.WHOP_WEBHOOK_SECRET || ""),
      });
      ```

      ```python Python theme={null}
      # docs coming soon, however, sdk already supports this...
      ```

      ```ruby Ruby theme={null}
      # docs coming soon, however, sdk already supports this...
      ```
    </CodeGroup>

  </Step>

  <Step title="Setup your api handler">
    Create a route that can accept HTTP POST requests in your application. (you should have provided this URL in the webhook creation flow above)

    This varies on your framework of choice, however here are some examples in common frameworks

    <Note>Our SDK automatically handles unwrapping and verifying the webhook bodies according to the spec.</Note>

    <CodeGroup>
      ```typescript Typescript + NextJS theme={null}
      import { waitUntil } from "@vercel/functions";
      import type { Payment } from "@whop/sdk/resources.js";
      import type { NextRequest } from "next/server";
      import { whopsdk } from "@/lib/whop-sdk";

      export async function POST(request: NextRequest): Promise<Response> {
         	// Validate the webhook to ensure it's from Whop
         	const requestBodyText = await request.text();
         	const headers = Object.fromEntries(request.headers);
         	const webhookData = whopsdk.webhooks.unwrap(requestBodyText, { headers });

         	// Handle the webhook event
         	if (webhookData.type === "payment.succeeded") {
        		waitUntil(handlePaymentSucceeded(webhookData.data));
         	}

         	// Make sure to return a 2xx status code quickly. Otherwise the webhook will be retried.
         	return new Response("OK", { status: 200 });
      }

      async function handlePaymentSucceeded(invoice: Payment) {
         	// This is a placeholder for a potentially long running operation
         	// In a real scenario, you might need to fetch user data, update a database, etc.
         	console.log("[PAYMENT SUCCEEDED]", invoice);
      }
      ```

      ```python Python + FastAPI theme={null}
      # docs coming soon, however, sdk already supports this...
      ```

      ```ruby Ruby on Rails theme={null}
      # docs coming soon, however, sdk already supports this...
      ```
    </CodeGroup>

  </Step>
</Steps>

## Available webhooks

Every single webhook we send is documented in the [`API Reference`](/api-reference/).
Within each resource, the `hook` pages specify the webhook event name,
and the exact schema that will included in the webhook.

Here are some common ones.

- [Payment Succeeded](/api-reference/payments/payment-succeeded) - when a payment is successfully processed.
- [Membership Activated](/api-reference/memberships/membership-activated) - when someone joins your community on a particular product.
- [Membership Deactivated](/api-reference/memberships/membership-deactivated) - when someone's membership goes invalid. (Failed payments / Cancelled membership / Left community)
- [Entry Created](/api-reference/entries/entry-created) - when someone joins a waitlist entry.

# Add funds to your balance

Source: https://docs.whop.com/developer/platforms/add-funds-to-your-balance

Top up your platform balance to pay out connected accounts

<Steps>
  <Step title="Create your first top up in the dashboard">
    Before using the API, you need to create a top up from the [Dashboard](https://whop.com/dashboard/payouts/). This saves a payment method that you can reuse programmatically.
  </Step>

  <Step title="Get payment methods">
    List saved payment methods for your company:

    <CodeGroup>
      ```typescript TypeScript theme={null}
      const paymentMethods = await client.paymentMethods.list({
        company_id: "biz_xxxxxxxxxxxxx",
      });

      const paymentMethod = paymentMethods.data[0];
      ```

      ```python Python theme={null}
      payment_methods = client.payment_methods.list(
          company_id="biz_xxxxxxxxxxxxx",
      )

      payment_method = payment_methods.data[0]
      ```
    </CodeGroup>

  </Step>

  <Step title="Create a top up">
    <CodeGroup>
      ```typescript TypeScript theme={null}
      const topup = await client.topups.create({
        company_id: "biz_xxxxxxxxxxxxx",
        amount: 1000.0,
        currency: "usd",
        payment_method_id: paymentMethod.id,
      });

      console.log(topup.id);
      ```

      ```python Python theme={null}
      topup = client.topups.create(
          company_id="biz_xxxxxxxxxxxxx",
          amount=1000.0,
          currency="usd",
          payment_method_id=payment_method.id,
      )

      print(topup.id)
      ```
    </CodeGroup>

    In this example:

    * `company_id` is your platform's company ID
    * `amount` is the amount to add to your balance
    * `currency` is the currency of the top up
    * `payment_method_id` is the saved payment method to charge

  </Step>

  <Step title="Handle payment events">
    Listen for payment webhooks to confirm the top up was successful:

    ```typescript theme={null}
    if (webhookData.type === "payment.succeeded") {
      const payment = webhookData.data;
      console.log("Top up successful:", payment.id);
    }

    if (webhookData.type === "payment.failed") {
      const payment = webhookData.data;
      console.log("Top up failed:", payment.failure_message);
    }
    ```

  </Step>
</Steps>

## Related resources

<CardGroup>
  <Card title="Collect payments for connected accounts" icon="arrow-right-arrow-left" href="/developer/platforms/collect-payments-for-connected-accounts">
    Transfer funds to connected accounts
  </Card>

  <Card title="Render payout portal" icon="browser" href="/developer/platforms/render-payout-portal">
    Let users withdraw their funds
  </Card>
</CardGroup>

# Collect payments for connected accounts

Source: https://docs.whop.com/developer/platforms/collect-payments-for-connected-accounts

Direct charges and transfers for connected accounts

There are two ways to collect payments for connected accounts:

1. **Direct charges**: Create a checkout for the connected account and collect an application fee
2. **Transfers**: Collect payment to your platform account and transfer funds to connected accounts

## Direct charges

Create a checkout configuration with a connected account's company ID to charge customers directly on the connected account. The connected account is responsible for Whop fees, refunds, and disputes.

### How it works

1. Create a checkout configuration for your connected account with an `application_fee_amount`
2. When a customer purchases, the charge is created directly on the connected account
3. Your platform collects the application fee, and the remaining amount goes to the connected account
4. The connected account handles any disputes or refunds for the transaction

### Example

<CodeGroup>
  ```typescript TypeScript theme={null}
  import Whop from "@whop/sdk";

const client = new Whop({
apiKey: "Company API Key",
});

const checkoutConfig = await client.checkoutConfigurations.create({
company_id: "biz_xxxxxxxxxxxxx", // Connected account's company ID
plan: {
initial_price: 10.0,
plan_type: "one_time",
application_fee_amount: 1.23,
},
});

console.log(checkoutConfig.purchase_url);

````

```python Python theme={null}
from whop_sdk import Whop

client = Whop(
    api_key="my_api_key",
)

checkout_config = client.checkout_configurations.create(
    company_id="biz_xxxxxxxxxxxxx",  # Connected account's company ID
    plan={
        "initial_price": 10.0,
        "plan_type": "one_time",
        "application_fee_amount": 1.23,
    },
)

print(checkout_config.purchase_url)
````

</CodeGroup>

In this example:

- `company_id` is the connected account's company ID where the charge will be created
- `plan.initial_price` is the total payment amount (10.00 USD)
- `plan.application_fee_amount` is the fee your platform collects (1.23 USD)
- The connected account receives 8.77 USD (10.00 - 1.23)

### Limitations

- The `application_fee_amount` must be positive and less than the total payment amount
- The application fee collected is capped at the captured amount of the payment

## Transfers

Alternatively, collect payment to your platform account and transfer funds to connected accounts after the fact:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import Whop from "@whop/sdk";

const client = new Whop({
apiKey: "Company API Key",
});

const transfer = await client.transfers.create({
amount: 90.0,
currency: "usd",
origin_id: "biz_yyyyyyyyyyyyy", // Platform's company ID
destination_id: "biz_xxxxxxxxxxxxx", // Connected account's company ID
metadata: {
order_id: "order_12345",
},
});

console.log(transfer.id);

````

```python Python theme={null}
from whop_sdk import Whop

client = Whop(
    api_key="my_api_key",
)

transfer = client.transfers.create(
    amount=90.0,
    currency="usd",
    origin_id="biz_yyyyyyyyyyyyy",  # Platform's company ID
    destination_id="biz_xxxxxxxxxxxxx",  # Connected account's company ID
    metadata={
        "order_id": "order_12345",
    },
)

print(transfer.id)
````

</CodeGroup>

In this example:

- `origin_id` is your platform's company ID (where funds are deducted from)
- `destination_id` is the connected account's company ID (where funds are credited to)
- `amount` is the amount to transfer
- `metadata` stores custom data for your reference

## Which flow should I use?

|              | Direct charges                     | Transfers                 |
| ------------ | ---------------------------------- | ------------------------- |
| **Fees**     | Connected account pays Whop fees   | Platform pays Whop fees   |
| **Disputes** | Connected account handles disputes | Platform handles disputes |
| **Refunds**  | Connected account handles refunds  | Platform handles refunds  |

## API Reference

<CardGroup>
  <Card title="Create Checkout Configuration" icon="code" href="/api-reference/checkout-configurations/create-checkout-configuration">
    Create checkout configurations with application fees
  </Card>

  <Card title="Create Transfer" icon="code" href="/api-reference/transfers/create-transfer">
    Transfer funds between accounts
  </Card>
</CardGroup>

## Related resources

<CardGroup>
  <Card title="Accept payments" icon="credit-card" href="/developer/guides/accept-payments">
    Learn about checkout links and embedded checkout
  </Card>

  <Card title="Enroll connected accounts" icon="users" href="/developer/platforms/enroll-connected-accounts">
    Onboard connected accounts to your platform
  </Card>
</CardGroup>

# Enroll connected accounts

Source: https://docs.whop.com/developer/platforms/enroll-connected-accounts

Onboard businesses or individuals to your platform and facilitate payments

To enroll a connected account on your platform, you need to create a Company object for each connected account. This Company object represents the connected account's account and enables them to accept payments and receive payouts through your platform.

## Example

Here's an example of how to create a Company for a connected account:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import Whop from "@whop/sdk";

const client = new Whop({
apiKey: "Company API Key",
});

const company = await client.companies.create({
email: "merchant@example.com",
parent_company_id: "biz_xxxxxxxxxxxxx",
title: "Acme Merchant Store",
metadata: {
internal_user_id: "user_12345",
seller_tier: "gold",
},
});

console.log(company.id);

````

```python Python theme={null}
from whop_sdk import Whop

client = Whop(
    api_key="my_api_key",
)

company = client.companies.create(
    email="merchant@example.com",
    parent_company_id="biz_xxxxxxxxxxxxx",
    title="Acme Merchant Store",
    metadata={
        "internal_user_id": "user_12345",
        "seller_tier": "gold",
    },
)

print(company.id)
````

</CodeGroup>

In this example:

- `email` is the connected account's email address. This is used to identify the connected account and send them important notifications about their account.
- `parent_company_id` is your platform's company ID (the parent company)
- `title` is the display name for the connected account. This is required.
- `metadata` contains custom key-value pairs:
  - `internal_user_id`: Your platform's internal identifier for this connected account
  - `seller_tier`: A classification or tier level for the connected account (e.g., "bronze", "silver", "gold")
- The response includes a `company.id` that you can use to reference this connected account in future API calls

<Tip>
  The email address should belong to the connected account (business or individual)
  who will be managing the account. This person will receive account setup and
  payment notifications.
</Tip>

## Getting started

Before you can enroll connected accounts, you need to set up your platform account:

1. **Sign up for a platform account**: Create a Company account at [whop.com/dashboard](https://whop.com/dashboard)
2. **Generate a Company API key**: Go to your developer settings page and generate a Company API key
3. **Use the API key for authentication**: This API key is how you authenticate with the Whop API and control your connected accounts

The Company API key provides the necessary permissions to create and manage connected accounts (companies) under your platform account.

## Custom metadata

You can attach custom metadata to companies when creating them. Metadata allows you to store additional information about each connected account as key-value pairs. This is useful for:

- Storing your internal user or merchant identifiers
- Tracking connected account tiers or classifications
- Linking to your platform's database records

Metadata is stored on the Company object and can be retrieved later for reporting, filtering, or integration purposes.

## API Reference

<Card title="Create Company API" icon="code" href="/api-reference/companies/create-company">
  See the full API reference for creating companies and all available parameters
</Card>

## Next steps

After creating a Company for a connected account:

<CardGroup>
  <Card title="Pay connected accounts" icon="arrow-right-arrow-left" href="/developer/platforms/collect-payments-for-connected-accounts">
    Transfer funds to your connected accounts
  </Card>

  <Card title="Render payout portal" icon="money-bill-transfer" href="/developer/platforms/render-payout-portal">
    Let your users withdraw their funds
  </Card>
</CardGroup>

# Manual payouts to connected accounts

Source: https://docs.whop.com/developer/platforms/manual-payouts

Onboard connected accounts and programmatically pay them out

Send payouts directly to your connected accounts from your platform balance. Connected accounts must complete identity verification and add a payout method before they can receive funds.

<Steps>
  <Step title="Complete KYC verification">
    Before a user can receive payouts, they must complete identity verification (KYC). Use the hosted account onboarding flow to guide users through this process:

    <CodeGroup>
      ```typescript TypeScript theme={null}
      import Whop from "@whop/sdk";

      const client = new Whop({
        apiKey: "Company API Key",
      });

      const accountLink = await client.accountLinks.create({
        company_id: "biz_xxxxxxxxxxxxx",
        use_case: "account_onboarding",
        return_url: "https://yourapp.com/onboarding/complete",
        refresh_url: "https://yourapp.com/onboarding/refresh",
      });

      // Redirect the user to complete KYC
      console.log(accountLink.url);
      ```

      ```python Python theme={null}
      from whop_sdk import Whop

      client = Whop(
          api_key="my_api_key",
      )

      account_link = client.account_links.create(
          company_id="biz_xxxxxxxxxxxxx",
          use_case="account_onboarding",
          return_url="https://yourapp.com/onboarding/complete",
          refresh_url="https://yourapp.com/onboarding/refresh",
      )

      # Redirect the user to complete KYC
      print(account_link.url)
      ```
    </CodeGroup>

    Redirect the user to the `url` returned in the response. After completing verification, they will be redirected back to your `return_url`.

  </Step>

  <Step title="Add a payout method">
    Before creating a payout, the account needs a payout method. Use the embedded component to let users add a payout method:

    <CodeGroup>
      ```tsx React theme={null}
      "use client";

      import {
        Elements,
        PayoutsSession,
        PayoutMethodElement,
      } from "@whop/embedded-components-react-js";
      import { loadWhopElements } from "@whop/embedded-components-vanilla-js";

      const elements = loadWhopElements();

      export function AddPayoutMethod({ companyId }: { companyId: string }) {
        return (
          <Elements elements={elements}>
            <PayoutsSession
              token={() =>
                fetch(`/api/token?companyId=${companyId}`)
                  .then((res) => res.json())
                  .then((data) => data.token)
              }
              companyId={companyId}
              redirectUrl="https://yourapp.com/verification-complete"
            >
              <PayoutMethodElement fallback={<div>Loading...</div>} />
            </PayoutsSession>
          </Elements>
        );
      }
      ```
    </CodeGroup>

  </Step>

  <Step title="Get the default payout method">
    List the connected account's payout methods and find the one with `is_default: true`:

    <CodeGroup>
      ```typescript TypeScript theme={null}
      import Whop from "@whop/sdk";

      const client = new Whop({
        apiKey: "Company API Key",
      });

      const payoutMethods = await client.payoutMethods.list({
        company_id: "biz_xxxxxxxxxxxxx",
      });

      const defaultMethod = payoutMethods.data.find((method) => method.is_default);
      console.log(defaultMethod.id);
      ```

      ```python Python theme={null}
      from whop_sdk import Whop

      client = Whop(
          api_key="my_api_key",
      )

      payout_methods = client.payout_methods.list(
          company_id="biz_xxxxxxxxxxxxx",
      )

      default_method = next((m for m in payout_methods.data if m.is_default), None)
      print(default_method.id)
      ```
    </CodeGroup>

  </Step>

  <Step title="Create a payout">
    <CodeGroup>
      ```typescript TypeScript theme={null}
      import Whop from "@whop/sdk";

      const client = new Whop({
        apiKey: "Company API Key",
      });

      const withdrawal = await client.withdrawals.create({
        company_id: "biz_xxxxxxxxxxxxx",
        amount: 100.0,
        currency: "usd",
        payout_method_id: "pm_xxxxxxxxxxxxx",
      });

      console.log(withdrawal.id);
      ```

      ```python Python theme={null}
      from whop_sdk import Whop

      client = Whop(
          api_key="my_api_key",
      )

      withdrawal = client.withdrawals.create(
          company_id="biz_xxxxxxxxxxxxx",
          amount=100.0,
          currency="usd",
          payout_method_id="pm_xxxxxxxxxxxxx",
      )

      print(withdrawal.id)
      ```
    </CodeGroup>

    In this example:

    * `company_id` is the connected account to pay out
    * `amount` is the payout amount (100.00 USD) - fees will be deducted from this amount
    * `currency` is the ISO currency code
    * `payout_method_id` is the ID of the payout method to use (from step 3)

    The request will return an error if the amount exceeds the available balance.

    ### Cover payout fees for your connected accounts

    By default, payout fees are deducted from the connected account's balance. You can choose to cover these fees from your platform balance instead by setting `platform_covers_fees` to `true`:

    <CodeGroup>
      ```typescript TypeScript theme={null}
      const withdrawal = await client.withdrawals.create({
        company_id: "biz_xxxxxxxxxxxxx",
        amount: 100.0,
        currency: "usd",
        payout_method_id: "pm_xxxxxxxxxxxxx",
        platform_covers_fees: true,
      });
      ```

      ```python Python theme={null}
      withdrawal = client.withdrawals.create(
          company_id="biz_xxxxxxxxxxxxx",
          amount=100.0,
          currency="usd",
          payout_method_id="pm_xxxxxxxxxxxxx",
          platform_covers_fees=True,
      )
      ```
    </CodeGroup>

    When `platform_covers_fees` is `true`, the payout fee will be debited from your platform's ledger account instead of the connected account's balance.

  </Step>
</Steps>

## API Reference

<Card title="Create Withdrawal API" icon="code" href="/api-reference/withdrawals/create-withdrawal">
  See the full API reference for creating withdrawals
</Card>

## Related resources

<CardGroup>
  <Card title="Pay connected accounts" icon="arrow-right-arrow-left" href="/developer/platforms/collect-payments-for-connected-accounts">
    Transfer funds to your connected accounts
  </Card>

  <Card title="Render payout portal" icon="money-bill-transfer" href="/developer/platforms/render-payout-portal">
    Let your users withdraw their funds
  </Card>
</CardGroup>

# Playground

Source: https://docs.whop.com/developer/platforms/playground

Interactive playground for embedded payout components

<Embed />

# Quickstart

Source: https://docs.whop.com/developer/platforms/quickstart

Embed payout components in your application in minutes

<QuickStart
title="Embed payout components"
description={<>
Allow your connected accounts to manage their own payouts through an embedded portal. This guide shows you how to set up the server-side token generation and client-side components.
</>}

>

### Congratulations!

You've successfully embedded the payout components in your application.

## Next steps

  <CardGroup>
    <Card title="PayoutsSession Props" icon="gear" href="/developer/platforms/render-payout-portal#payoutssession-props">
      Customize the payout portal with additional configuration options like custom styling and event callbacks.
    </Card>

    <Card title="Hosted Payout Portal" icon="arrow-up-right-from-square" href="/developer/platforms/render-payout-portal#hosted-payout-portal">
      Skip embedding entirely and redirect users to a Whop-hosted payout portal.
    </Card>

    <Card title="Manual Payouts" icon="money-bill-transfer" href="/developer/platforms/manual-payouts">
      Programmatically trigger payouts, manage KYC verification, and control payout methods via the API.
    </Card>

    <Card title="Enroll Connected Accounts" icon="user-plus" href="/developer/platforms/enroll-connected-accounts">
      Learn how to create and manage Company objects for your connected accounts.
    </Card>

  </CardGroup>
</QuickStart>

# Enable connected account payouts

Source: https://docs.whop.com/developer/platforms/render-payout-portal

Let your connected accounts manage their own payouts through an embedded or hosted portal

Allow your connected accounts to complete KYC verification, add payout methods, and withdraw their funds on their own. You can embed the payout portal directly in your app or redirect users to a Whop-hosted portal.

## Embedded payout portal

### Server side implementation

To use the embedded component, you need to generate an access token for the connected account's company. This token grants temporary access to the payout portal for that specific company.

<CodeGroup>
  ```tsx Next.JS theme={null}
  // app/api/token/route.ts
  import Whop from "@whop/sdk";
  import type { NextRequest } from "next/server";

const whop = new Whop({
apiKey: process.env.WHOP_API_KEY,
});

export async function GET(request: NextRequest) {
// Authenticate your user here
const companyId = request.nextUrl.searchParams.get("companyId");

    if (!companyId) {
      return new Response(null, { status: 400 });
    }
    const tokenResponse = await whop.accessTokens
      .create({
        company_id: companyId,
      })
      .catch(() => {
        return null;
      });
    if (!tokenResponse) {
      return new Response(null, { status: 500 });
    }
    const token = tokenResponse.token;
    return Response.json({
      token,
    });

}

````

```typescript Express.js theme={null}
import express from "express";
import Whop from "@whop/sdk";

const app = express();
const client = new Whop({ apiKey: "Company API Key" });

app.use(express.json());

app.post("/api/access-token", async (req, res) => {
  // Authenticate your user here
  const { companyId } = req.body;

  const { token } = await client.accessTokens.create({
    company_id: companyId,
  });

  res.json({ token });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
````

```python Python theme={null}
from whop_sdk import Whop
from flask import Flask, request, jsonify

app = Flask(__name__)
client = Whop(api_key="Company API Key")

@app.route('/api/access-token', methods=['POST'])
def create_access_token():
    data = request.get_json()
    # Authenticate your user here
    company_id = data.get('companyId')

    access_token = client.access_tokens.create(
        company_id=company_id
    )

    return jsonify({'token': access_token.token})
```

</CodeGroup>

<Card title="Create Access Token API" icon="code" href="/api-reference/access-tokens/create-access-token">
  See the full API reference for generating access tokens and all available
  parameters
</Card>

## Client side setup

<CodeGroup>
  ```bash npm theme={null}
  npm install @whop/embedded-components-react-js @whop/embedded-components-vanilla-js
  ```

```bash pnpm theme={null}
pnpm add @whop/embedded-components-react-js @whop/embedded-components-vanilla-js
```

```html HTML theme={null}
<script src="https://latest.elements.whop.com/release/elements.js"></script>
```

```swift Swift theme={null}
// Add to your Package.swift dependencies

dependencies: [
    .package(url: "https://github.com/whopio/whopsdk-payments-swift.git", exact: "0.0.6")
]


// Info.plist - Add these usage descriptions to Info.plist for KYC functionality

<key>NSCameraUsageDescription</key>
<string>We use your camera to let you take photos, record videos, and ID verification.</string>

<key>NSMicrophoneUsageDescription</key>
<string>We use your microphone so you can record and share audio, and ID verification.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>We use your photo library so you can select and share photos or videos from your library.</string>
```

</CodeGroup>

## Client side implementation

<CodeGroup>
  ```tsx React theme={null}
  import type { WhopElementsOptions } from "@whop/embedded-components-vanilla-js/types";

import {
BalanceElement,
Elements,
PayoutsSession,
WithdrawButtonElement,
WithdrawalsElement,
} from "@whop/embedded-components-react-js";
import { loadWhopElements } from "@whop/embedded-components-vanilla-js";

const elements = loadWhopElements();

const appearance: WhopElementsOptions["appearance"] = {
classes: {
".Button": { height: "40px", "border-radius": "8px" },
".Button:disabled": { "background-color": "gray" },
".Container": { "border-radius": "12px" },
},
};

export function BalancePage({ companyId }: { companyId: string }) {
return (
<Elements appearance={appearance} elements={elements}>
<PayoutsSession
token={() =>
fetch(`/api/token?companyId=${companyId}`)
.then((res) => res.json())
.then((data) => data.token)
}
companyId={companyId}
redirectUrl="https://yourapp.com/verification-complete" >

<section
style={{ display: "flex", flexDirection: "column", gap: "8px" }} >
<div
style={{ height: "95.5px", width: "100%", position: "relative" }} >
<BalanceElement fallback={<div>Loading...</div>} />
</div>
<div style={{ height: "40px", width: "100%", position: "relative" }}>
<WithdrawButtonElement fallback={<div>Loading...</div>} />
</div>
<WithdrawalsElement fallback={<div>Loading...</div>} />
</section>
</PayoutsSession>
</Elements>
);
}

````

```swift Swift theme={null}
import SwiftUI
import WhopPayments

class MyTokenProvider: WhopTokenProvider {
    /// return an access token fetched from your
    /// backend.
    ///
    /// called when `WhopPayoutsView` appears and
    /// before expiration (within 60 seconds).
    func getToken() async -> WhopTokenResponse {
        let token = await fetchAccessToken()
        return WhopTokenResponse(accessToken: token)
    }
}

@main
struct MyApp: App {
    let tokenProvider = MyTokenProvider()

    var body: some Scene {
        WindowGroup {
            WhopPayoutsView(
                tokenProvider,
                companyId: "company_id",
                ledgerAccountId: "ledger_account_id"
            )
        }
    }
}
````

</CodeGroup>

## PayoutsSession Props

The `PayoutsSession` component requires the following props:

| Prop          | Type                            | Required | Description                                                                                                                        |
| ------------- | ------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `token`       | `string \| Promise \| Function` | Yes      | Access token for the session. Can be a string, promise, or function that returns a token.                                          |
| `companyId`   | `string`                        | Yes      | The company ID for the connected account.                                                                                          |
| `redirectUrl` | `string`                        | Yes      | Absolute URL (e.g., `https://yourapp.com/verification-complete`) to redirect the user to after identity verification is completed. |
| `currency`    | `string`                        | No       | Currency code (e.g., "USD"). Defaults to "USD".                                                                                    |

<Note>
  The `redirectUrl` must be a publicly accessible URL. Localhost URLs (e.g.,
  `http://localhost:3000`) will not work. For local development, use a tunneling
  service like [ngrok](https://ngrok.com) to expose your local server.
</Note>

## Modal methods

You can programmatically open modals using the `usePayoutsSessionRef` hook:

```tsx theme={null}
import { usePayoutsSessionRef } from '@whop/embedded-components-react-js'

const sessionRef = usePayoutsSessionRef()

;<button
  onClick={() =>
    sessionRef.current?.payoutsSession?.showChangeAccountCountryModal((modal) => ({
      onClose: (ev) => {
        ev.preventDefault()
        modal.close()
      },
    }))
  }
>
  Change Account Country
</button>
```

### Available modals

| Method                          | Description                                        |
| ------------------------------- | -------------------------------------------------- |
| `showChangeAccountCountryModal` | Allow users to change their payout account country |
| `showResetAccountModal`         | Allow users to reset their payout account          |

## Hosted payout portal

Instead of embedding the payout portal in your app, you can redirect users to a Whop-hosted payout portal. This is useful when you don't want to build a custom UI or need a quick integration.

Create an account link and redirect the user to the returned URL:

<CodeGroup>
  ```typescript TypeScript theme={null}
  import Whop from "@whop/sdk";

const client = new Whop({
apiKey: "Company API Key",
});

const accountLink = await client.accountLinks.create({
company_id: "biz_xxxxxxxxxxxxx",
use_case: "payouts_portal",
return_url: "https://yourapp.com/payouts/complete",
refresh_url: "https://yourapp.com/payouts/refresh",
});

// Redirect the user to the hosted portal
console.log(accountLink.url);

````

```python Python theme={null}
from whop_sdk import Whop

client = Whop(
    api_key="my_api_key",
)

account_link = client.account_links.create(
    company_id="biz_xxxxxxxxxxxxx",
    use_case="payouts_portal",
    return_url="https://yourapp.com/payouts/complete",
    refresh_url="https://yourapp.com/payouts/refresh",
)

# Redirect the user to the hosted portal
print(account_link.url)
````

</CodeGroup>

In this example:

- `company_id` is the platform or connected account
- `use_case` specifies the portal type
- `return_url` is where the user is redirected when they want to return to your site
- `refresh_url` is where the user is redirected if the session expires

### Available use cases

| Use case             | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| `account_onboarding` | KYC and identity verification                               |
| `payouts_portal`     | Withdrawals, payout methods, KYC, and identity verification |

After creating the account link, redirect the user to the `url` returned in the response. The user will complete the payout flow on the Whop-hosted portal and be redirected back to your `return_url` when finished.

## Related resources

<CardGroup>
  <Card title="Pay connected accounts" icon="arrow-right-arrow-left" href="/developer/platforms/collect-payments-for-connected-accounts">
    Transfer funds to connected accounts
  </Card>
</CardGroup>

# Enable Apple Pay

Source: https://docs.whop.com/payments/apple-pay

Enable Apple Pay for your embedded checkout by verifying your domain

Apple Pay allows customers to pay using their Apple Wallet, providing a seamless checkout experience on Safari and iOS devices. To enable Apple Pay on your embedded checkout, you need to verify ownership of your domain.

<Note>
  Domain verification is only required for [embedded checkout](/payments/checkout-embed). Whop-hosted checkout pages already support Apple Pay without any additional setup.
</Note>

## Prerequisites

Before setting up Apple Pay, ensure you have:

- A domain where you're hosting the embedded checkout
- Access to your domain's DNS settings (for Whop-hosted verification) or file hosting (for self-hosted verification)
- `@whop/checkout@0.0.43` or later if using the `hideSubmitButton` option in React

## Choose a verification method

There are two ways to verify your domain for Apple Pay:

<CardGroup>
  <Card title="Whop-hosted verification" icon="wand-magic-sparkles" href="#whop-hosted-verification">
    Recommended for most users. Whop handles the verification file hosting - you just need to add DNS records.
  </Card>

  <Card title="Self-hosted verification" icon="server" href="#self-hosted-verification">
    For advanced users who prefer to host the verification file themselves.
  </Card>
</CardGroup>

## Whop-hosted verification

This method lets Whop host the Apple Pay verification file on your behalf. You'll temporarily point your domain to Whop's servers to complete verification, then revert your DNS settings.

<Warning>
  This method requires temporary DNS changes that will cause your domain to be unavailable for a few minutes during verification. Plan accordingly.
</Warning>

<Note>
  **Before you begin:** Take a screenshot or export your current DNS records for the domain you're verifying. While the verification wizard will show revert instructions after completion, these are best-effort and may not capture all edge cases. Having your own backup ensures you can restore your DNS configuration accurately.
</Note>

### Step 0: Lower your DNS TTL (optional)

If the domain you're verifying is actively serving traffic, consider lowering the TTL (Time To Live) on the existing DNS record for that domain before starting. This ensures DNS changes propagate faster when you switch records and when you revert them. If you skip this step, downtime may last longer while DNS caches expire.

<Accordion title="How to lower your TTL">
  1. Find the existing A or CNAME record for the domain you want to verify (e.g., the record for `checkout.yoursite.com`)
  2. Lower its TTL to 60-300 seconds
  3. Wait for the previous TTL duration to pass (e.g., if it was 1 hour, wait 1 hour) so all DNS caches refresh
  4. Then proceed with the verification steps below
</Accordion>

### Step 1: Open payment domains settings

Navigate to your [checkout settings](https://whop.com/dashboard/settings/checkout/) and find the **Apple Pay for embedded checkout** section. Click **Configure** to open the domain management panel.

<Frame>
  <img alt="Payment domains settings showing the Configure button" />
</Frame>

### Step 2: Add your domain

Click the **+** button (or **Add payment domain** if no domains exist yet). From the dropdown menu, select **Whop-hosted verification**.

<Frame>
  <img alt="Add domain dropdown menu with Whop-hosted option" />
</Frame>

Enter the domain where you're hosting the embedded checkout (e.g., `checkout.yoursite.com` or `yoursite.com`). You'll need to acknowledge that your domain will experience temporary downtime during the verification process by checking the confirmation checkbox, then click **Start verification**.

<Frame>
  <img alt="Add domain dialog for Whop-hosted verification" />
</Frame>

### Step 3: Add DNS records

<Warning>
  This step will cause downtime for your domain. Your domain will point to Whop's servers until you revert the DNS records after verification. **If you haven't already, take a screenshot of your current DNS settings now** before making any changes.
</Warning>

After adding your domain, you'll see a list of DNS records that need to be added to your domain's DNS settings. These typically include:

- **A record** or **CNAME record** - Points your domain to Whop's verification servers
- (optional) **TXT record** - Proves domain ownership

<Tip>
  Use a low TTL (60-300 seconds) so you can revert quickly after verification.
</Tip>

<Frame>
  <img alt="DNS records to add for domain verification" />
</Frame>

If your domain already has an A or CNAME record, **edit or replace it** with the values shown—don't add a second record alongside the existing one. You can find these settings in your DNS provider's dashboard (e.g., Cloudflare, Namecheap, GoDaddy, Route 53).

<Frame>
  <img alt="DNS records configured in Cloudflare" />
</Frame>

### Step 4: Wait for DNS propagation

DNS changes can take anywhere from a few minutes to 48 hours to propagate, though most changes are visible within 5-15 minutes. The verification wizard will automatically detect when your DNS records are properly configured.

### Step 5: Complete verification

Once the DNS records are verified, Whop will:

1. Issue an SSL certificate for your domain
2. Host the Apple Pay verification file
3. Register your domain with Apple

### Step 6: Revert DNS settings

After verification is complete, revert your DNS settings to point back to your original hosting. The Apple Pay verification will remain valid. The wizard will show you the records to delete and restore.

<Warning>
  The revert instructions shown in the wizard are **best-effort** and may not be 100% accurate in all cases. Always refer to your own DNS backup (screenshot or export) to ensure you restore the correct values. If you're unsure, check with your hosting provider for the correct DNS configuration.
</Warning>

<Frame>
  <img alt="Domain verification complete with revert instructions" />
</Frame>

## Self-hosted verification

If you prefer to host the verification file yourself, you can do so by serving the Apple Pay merchant ID domain association file at a specific path on your domain.

### Step 1: Download the verification file

Download the [Apple Pay verification file](https://whop.com/.well-known/apple-platform-integrator/apple-developer-merchantid-domain-association).

### Step 2: Host the file

Host this file at the following path on your domain:

```
https://<your-domain>/.well-known/apple-developer-merchantid-domain-association
```

The file must be:

- Served over HTTPS
- Accessible without authentication
- Served with the correct content (no modifications)

<Tabs>
  <Tab title="Next.js">
    Place the file in your `public` folder:

    ```
    public/
    └── .well-known/
        └── apple-developer-merchantid-domain-association
    ```

  </Tab>

  <Tab title="Nginx">
    Add a location block to serve the file:

    ```nginx theme={null}
    location /.well-known/apple-developer-merchantid-domain-association {
        alias /path/to/apple-developer-merchantid-domain-association;
        default_type application/octet-stream;
    }
    ```

  </Tab>

  <Tab title="Vercel">
    Create a `vercel.json` with a rewrite rule that proxies to the Whop-hosted file:

    ```json theme={null}
    {
      "rewrites": [
        {
          "source": "/.well-known/apple-developer-merchantid-domain-association",
          "destination": "https://whop.com/.well-known/apple-platform-integrator/apple-developer-merchantid-domain-association"
        }
      ]
    }
    ```

  </Tab>

  <Tab title="Cloudflare Pages">
    Place the file in your output directory:

    ```
    dist/
    └── .well-known/
        └── apple-developer-merchantid-domain-association
    ```

  </Tab>
</Tabs>

### Step 3: Verify the file is accessible

Test that the file is accessible by visiting:

```
https://<your-domain>/.well-known/apple-developer-merchantid-domain-association
```

The file should download or display its contents without any errors.

### Step 4: Open payment domains settings

Navigate to your [checkout settings](https://whop.com/dashboard/settings/checkout/) and find the **Apple Pay for embedded checkout** section. Click **Configure** to open the domain management panel.

<Frame>
  <img alt="Payment domains settings showing the Configure button" />
</Frame>

### Step 5: Register your domain

Click the **+** button (or **Add payment domain** if no domains exist yet). From the dropdown menu, select **Self-hosted verification**.

<Frame>
  <img alt="Add domain dropdown menu with self-hosted option" />
</Frame>

Enter your domain. Whop will verify that the file is accessible before registering your domain with Apple.

<Frame>
  <img alt="Add domain dialog for self-hosted verification" />
</Frame>

## Troubleshooting

<AccordionGroup>
  <Accordion title="Apple Pay button doesn't appear">
    * Ensure your domain is fully verified in the payment domains settings
    * Check that you're using `@whop/checkout@0.0.43` or later
    * Apple Pay only appears on supported browsers (Safari) and devices (iOS, macOS)
    * Test on an actual Apple device, not in a simulator
  </Accordion>

  <Accordion title="DNS verification is taking too long">
    * DNS propagation can take up to 48 hours in some cases
    * Use a tool like [dnschecker.org](https://dnschecker.org) to verify your records have propagated
    * Ensure you've added the records to the correct DNS zone
    * If using Cloudflare, make sure the DNS record is set to "DNS only" (gray cloud), not "Proxied" (orange cloud) during verification
  </Accordion>

  <Accordion title="SSL certificate verification failed">
    * Ensure your DNS records are pointing to the correct values
    * Wait a few minutes for the certificate to be issued
    * If the issue persists, try removing and re-adding the domain
  </Accordion>

  <Accordion title="Self-hosted file returns 404">
    * Verify the file is in the correct location: `/.well-known/apple-developer-merchantid-domain-association`
    * Check that your web server is configured to serve files without extensions
    * Ensure the `.well-known` directory is not blocked by your hosting configuration
  </Accordion>
</AccordionGroup>

## Next steps

<CardGroup>
  <Card title="Embedded Checkout" icon="code" href="/payments/checkout-embed">
    Learn how to embed Whop checkout on your website
  </Card>

  <Card title="Checkout Links" icon="link" href="/payments/create-checkout-link">
    Create shareable checkout links for your products
  </Card>
</CardGroup>

# Authorized User

Source: https://docs.whop.com/api-reference/authorized-users/authorized-user

# List authorized users

Source: https://docs.whop.com/api-reference/authorized-users/list-authorized-users

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /authorized_users
Returns a paginated list of authorized team members for a company, with optional filtering by user, role, and creation date.

Required permissions:

- `company:authorized_user:read`
- `member:email:read`

# Retrieve authorized user

Source: https://docs.whop.com/api-reference/authorized-users/retrieve-authorized-user

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /authorized_users/{id}
Retrieves the details of an existing authorized user.

Required permissions:

- `company:authorized_user:read`
- `member:email:read`

# Chat Channel

Source: https://docs.whop.com/api-reference/chat-channels/chat-channel

# List chat channels

Source: https://docs.whop.com/api-reference/chat-channels/list-chat-channels

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /chat_channels
Returns a paginated list of chat channels within a specific company, with optional filtering by product.

Required permissions:

- `chat:read`

# Retrieve chat channel

Source: https://docs.whop.com/api-reference/chat-channels/retrieve-chat-channel

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /chat_channels/{id}
Retrieves the details of an existing chat channel.

Required permissions:

- `chat:read`

# Update chat channel

Source: https://docs.whop.com/api-reference/chat-channels/update-chat-channel

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /chat_channels/{id}
Update moderation settings for a chat channel, such as who can post, banned words, and media restrictions.

Required permissions:

- `chat:moderate`

# Company

Source: https://docs.whop.com/api-reference/companies/company

# Create company

Source: https://docs.whop.com/api-reference/companies/create-company

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /companies
Create a new company. Pass parent_company_id to create a connected account under a platform, or omit it to create a company for the current user.

Required permissions:

- `company:create`
- `company:basic:read`

# List companies

Source: https://docs.whop.com/api-reference/companies/list-companies

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /companies
Returns a paginated list of companies. When parent_company_id is provided, lists connected accounts under that platform. When omitted, lists companies the current user has access to.

Required permissions:

- `company:basic:read`

# Retrieve company

Source: https://docs.whop.com/api-reference/companies/retrieve-company

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /companies/{id}
Retrieves the details of an existing company.

Required permissions:

- `company:basic:read`

# Update company

Source: https://docs.whop.com/api-reference/companies/update-company

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /companies/{id}
Update a company's title, description, logo, and other settings.

Required permissions:

- `company:update`
- `company:basic:read`

# Company Token Transaction

Source: https://docs.whop.com/api-reference/company-token-transactions/company-token-transaction

# Create company token transaction

Source: https://docs.whop.com/api-reference/company-token-transactions/create-company-token-transaction

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /company_token_transactions
Create a token transaction to add, subtract, or transfer tokens for a member within a company.

Required permissions:

- `company_token_transaction:create`
- `member:basic:read`
- `company:basic:read`

# List company token transactions

Source: https://docs.whop.com/api-reference/company-token-transactions/list-company-token-transactions

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /company_token_transactions
Returns a paginated list of token transactions for a user or company, depending on the authenticated actor, with optional filtering by user and transaction type.

Required permissions:

- `company_token_transaction:read`
- `member:basic:read`
- `company:basic:read`

# Retrieve company token transaction

Source: https://docs.whop.com/api-reference/company-token-transactions/retrieve-company-token-transaction

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /company_token_transactions/{id}
Retrieves the details of an existing company token transaction.

Required permissions:

- `company_token_transaction:read`
- `member:basic:read`
- `company:basic:read`

# Approve entry

Source: https://docs.whop.com/api-reference/entries/approve-entry

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /entries/{id}/approve
Approve a pending waitlist entry, triggering the checkout process to grant the user access to the plan.

Required permissions:

- `plan:waitlist:manage`

# Deny entry

Source: https://docs.whop.com/api-reference/entries/deny-entry

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /entries/{id}/deny
Deny a pending waitlist entry, preventing the user from gaining access to the plan.

Required permissions:

- `plan:waitlist:manage`
- `plan:basic:read`
- `member:email:read`

# Entry

Source: https://docs.whop.com/api-reference/entries/entry

# Entry approved

Source: https://docs.whop.com/api-reference/entries/entry-approved

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook entry.approved
Sent when a entry is approved

Required permissions:

- `plan:waitlist:read`
- `member:email:read`
- `webhook_receive:entries`

# Entry created

Source: https://docs.whop.com/api-reference/entries/entry-created

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook entry.created
Sent when a entry is created

Required permissions:

- `plan:waitlist:read`
- `member:email:read`
- `webhook_receive:entries`

# Entry deleted

Source: https://docs.whop.com/api-reference/entries/entry-deleted

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook entry.deleted
Sent when a entry is deleted

Required permissions:

- `plan:waitlist:read`
- `member:email:read`
- `webhook_receive:entries`

# Entry denied

Source: https://docs.whop.com/api-reference/entries/entry-denied

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook entry.denied
Sent when a entry is denied

Required permissions:

- `plan:waitlist:read`
- `member:email:read`
- `webhook_receive:entries`

# List entries

Source: https://docs.whop.com/api-reference/entries/list-entries

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /entries
Returns a paginated list of waitlist entries for a company, with optional filtering by product, plan, status, and creation date.

Required permissions:

- `plan:waitlist:read`
- `member:email:read`

# Retrieve entry

Source: https://docs.whop.com/api-reference/entries/retrieve-entry

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /entries/{id}
Retrieves the details of an existing waitlist entry.

Required permissions:

- `plan:waitlist:read`
- `member:email:read`

# Attach experience

Source: https://docs.whop.com/api-reference/experiences/attach-experience

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /experiences/{id}/attach
Attach an experience to a product, making it accessible to the product's customers.

Required permissions:

- `experience:attach`

# Create experience

Source: https://docs.whop.com/api-reference/experiences/create-experience

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /experiences
Required permissions:

- `experience:create`

# Delete experience

Source: https://docs.whop.com/api-reference/experiences/delete-experience

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /experiences/{id}
Required permissions:

- `experience:delete`

# Detach experience

Source: https://docs.whop.com/api-reference/experiences/detach-experience

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /experiences/{id}/detach
Detach an experience from a product, removing customer access to it through that product.

Required permissions:

- `experience:detach`

# Duplicate experience

Source: https://docs.whop.com/api-reference/experiences/duplicate-experience

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /experiences/{id}/duplicate
Duplicates an existing experience. The name will be copied, unless provided. The new experience will be attached to the same products as the original experience.
If duplicating a Forum or Chat experience, the new experience will have the same settings as the original experience, e.g. who can post, who can comment, etc.
No content, e.g. posts, messages, lessons from within the original experience will be copied.

Required permissions:

- `experience:create`

# Experience

Source: https://docs.whop.com/api-reference/experiences/experience

# List experiences

Source: https://docs.whop.com/api-reference/experiences/list-experiences

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /experiences
Returns a paginated list of experiences belonging to a company, with optional filtering by product and app.

Required permissions:

- `experience:hidden_experience:read`

# Retrieve experience

Source: https://docs.whop.com/api-reference/experiences/retrieve-experience

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /experiences/{id}
Retrieves the details of an existing experience.

# Update experience

Source: https://docs.whop.com/api-reference/experiences/update-experience

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /experiences/{id}
Required permissions:

- `experience:update`

# Create fee markup

Source: https://docs.whop.com/api-reference/fee-markups/create-fee-markup

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /fee_markups
Create or update a fee markup for a company. If a markup for the specified fee type already exists, it will be updated with the new values.

Required permissions:

- `company:update_child_fees`

# Delete fee markup

Source: https://docs.whop.com/api-reference/fee-markups/delete-fee-markup

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /fee_markups/{id}
Delete a fee markup configuration for a company. This removes the custom fee override and reverts to the parent company's default fees.

Required permissions:

- `company:update_child_fees`

# Fee Markup

Source: https://docs.whop.com/api-reference/fee-markups/fee-markup

# List fee markups

Source: https://docs.whop.com/api-reference/fee-markups/list-fee-markups

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /fee_markups
Returns a paginated list of fee markups configured for a company. If the company is a platform account, returns the platform default markups.

Required permissions:

- `company:update_child_fees`

# Create forum post

Source: https://docs.whop.com/api-reference/forum-posts/create-forum-post

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /forum_posts
Create a new forum post or comment within an experience. Supports text content, attachments, polls, paywalling, and pinning.

Required permissions:

- `forum:post:create`

# Forum Post

Source: https://docs.whop.com/api-reference/forum-posts/forum-post

# List forum posts

Source: https://docs.whop.com/api-reference/forum-posts/list-forum-posts

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /forum_posts
Returns a paginated list of forum posts within a specific experience, with optional filtering by parent post or pinned status.

Required permissions:

- `forum:read`

# Retrieve forum post

Source: https://docs.whop.com/api-reference/forum-posts/retrieve-forum-post

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /forum_posts/{id}
Retrieves the details of an existing forum post.

Required permissions:

- `forum:read`

# Update forum post

Source: https://docs.whop.com/api-reference/forum-posts/update-forum-post

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /forum_posts/{id}
Edit the content, attachments, pinned status, or visibility of an existing forum post or comment.

# Forum

Source: https://docs.whop.com/api-reference/forums/forum

# List forums

Source: https://docs.whop.com/api-reference/forums/list-forums

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /forums
Returns a paginated list of forums within a specific company, with optional filtering by product.

Required permissions:

- `forum:read`

# Retrieve forum

Source: https://docs.whop.com/api-reference/forums/retrieve-forum

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /forums/{id}
Retrieves the details of an existing forum.

Required permissions:

- `forum:read`

# Update forum

Source: https://docs.whop.com/api-reference/forums/update-forum

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /forums/{id}
Update moderation and notification settings for a forum, such as who can post, who can comment, and email notification preferences.

Required permissions:

- `forum:moderate`

# Create lead

Source: https://docs.whop.com/api-reference/leads/create-lead

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /leads
Record a new lead for a company, capturing a potential customer's interest in a specific product.

Required permissions:

- `lead:manage`
- `member:email:read`
- `access_pass:basic:read`
- `member:basic:read`

# Lead

Source: https://docs.whop.com/api-reference/leads/lead

# List leads

Source: https://docs.whop.com/api-reference/leads/list-leads

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /leads
Returns a paginated list of leads for a company, with optional filtering by product and creation date.

Required permissions:

- `lead:basic:read`
- `member:email:read`
- `access_pass:basic:read`
- `member:basic:read`

# Retrieve lead

Source: https://docs.whop.com/api-reference/leads/retrieve-lead

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /leads/{id}
Retrieves the details of an existing lead.

Required permissions:

- `lead:basic:read`
- `member:email:read`
- `access_pass:basic:read`
- `member:basic:read`

# Update lead

Source: https://docs.whop.com/api-reference/leads/update-lead

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /leads/{id}
Update the metadata or referrer information on an existing lead record.

Required permissions:

- `lead:manage`
- `member:email:read`
- `access_pass:basic:read`
- `member:basic:read`

# List members

Source: https://docs.whop.com/api-reference/members/list-members

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /members
Returns a paginated list of members for a company, with extensive filtering by product, plan, status, access level, and more.

Required permissions:

- `member:basic:read`
- `member:email:read`
- `member:phone:read`

# Member

Source: https://docs.whop.com/api-reference/members/member

# Retrieve member

Source: https://docs.whop.com/api-reference/members/retrieve-member

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /members/{id}
Retrieves the details of an existing member.

Required permissions:

- `member:basic:read`
- `member:email:read`
- `member:phone:read`

# Cancel membership

Source: https://docs.whop.com/api-reference/memberships/cancel-membership

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /memberships/{id}/cancel
Cancel a membership either immediately or at the end of the current billing period. Immediate cancellation revokes access right away.

Required permissions:

- `member:manage`
- `member:email:read`
- `member:basic:read`

# List memberships

Source: https://docs.whop.com/api-reference/memberships/list-memberships

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /memberships
Returns a paginated list of memberships, with optional filtering by product, plan, status, and user.

Required permissions:

- `member:basic:read`
- `member:email:read`

# Membership

Source: https://docs.whop.com/api-reference/memberships/membership

# Membership activated

Source: https://docs.whop.com/api-reference/memberships/membership-activated

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook membership.activated
Sent when a membership is activated

Required permissions:

- `member:basic:read`
- `member:email:read`
- `webhook_receive:memberships`

# Membership cancel at period end changed

Source: https://docs.whop.com/api-reference/memberships/membership-cancel-at-period-end-changed

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook membership.cancel_at_period_end_changed
Sent when a membership is cancel at period end changed

Required permissions:

- `member:basic:read`
- `member:email:read`
- `webhook_receive:memberships`

# Membership deactivated

Source: https://docs.whop.com/api-reference/memberships/membership-deactivated

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook membership.deactivated
Sent when a membership is deactivated

Required permissions:

- `member:basic:read`
- `member:email:read`
- `webhook_receive:memberships`

# Pause membership

Source: https://docs.whop.com/api-reference/memberships/pause-membership

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /memberships/{id}/pause
Pause a membership's recurring payments. The customer retains access but will not be charged until the membership is resumed.

Required permissions:

- `member:manage`
- `member:email:read`
- `member:basic:read`

# Resume membership

Source: https://docs.whop.com/api-reference/memberships/resume-membership

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /memberships/{id}/resume
Resume a previously paused membership's recurring payments. Billing resumes on the next cycle.

Required permissions:

- `member:manage`
- `member:email:read`
- `member:basic:read`

# Retrieve membership

Source: https://docs.whop.com/api-reference/memberships/retrieve-membership

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /memberships/{id}
Retrieves the details of an existing membership.

Required permissions:

- `member:basic:read`
- `member:email:read`

# Uncancel membership

Source: https://docs.whop.com/api-reference/memberships/uncancel-membership

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /memberships/{id}/uncancel
Reverse a pending cancellation for a membership that was scheduled to cancel at period end.

Required permissions:

- `member:manage`
- `member:email:read`
- `member:basic:read`

# Update membership

Source: https://docs.whop.com/api-reference/memberships/update-membership

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /memberships/{id}
Update a membership's metadata or other mutable properties.

Required permissions:

- `member:manage`
- `member:email:read`
- `member:basic:read`

# List messages

Source: https://docs.whop.com/api-reference/messages/list-messages

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /messages
Returns a paginated list of messages within a specific experience chat, DM, or group chat channel, sorted by creation time.

Required permissions:

- `chat:read`

# Message

Source: https://docs.whop.com/api-reference/messages/message

# List payout methods

Source: https://docs.whop.com/api-reference/payout-methods/list-payout-methods

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /payout_methods
Returns a list of active payout methods configured for a company, ordered by most recently created.

Required permissions:

- `payout:destination:read`

# Payout Method

Source: https://docs.whop.com/api-reference/payout-methods/payout-method

# Payoutmethod created

Source: https://docs.whop.com/api-reference/payout-methods/payoutmethod-created

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook payout_method.created
Sent when a payout method is created

Required permissions:

- `payout:destination:read`
- `webhook_receive:payout_methods`

# Retrieve payout method

Source: https://docs.whop.com/api-reference/payout-methods/retrieve-payout-method

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /payout_methods/{id}
Retrieves the details of an existing payout method.

Required permissions:

- `payout:destination:read`

# List reviews

Source: https://docs.whop.com/api-reference/reviews/list-reviews

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /reviews
Returns a paginated list of customer reviews for a specific product, with optional filtering by star rating and creation date.

# Retrieve review

Source: https://docs.whop.com/api-reference/reviews/retrieve-review

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /reviews/{id}
Retrieves the details of an existing review.

# Review

Source: https://docs.whop.com/api-reference/reviews/review

# Create shipment

Source: https://docs.whop.com/api-reference/shipments/create-shipment

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /shipments
Create a new shipment with a tracking code for a specific payment within a company.

Required permissions:

- `shipment:create`
- `payment:basic:read`

# List shipments

Source: https://docs.whop.com/api-reference/shipments/list-shipments

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /shipments
Returns a paginated list of shipments, with optional filtering by payment, company, or user.

Required permissions:

- `shipment:basic:read`
- `payment:basic:read`

# Retrieve shipment

Source: https://docs.whop.com/api-reference/shipments/retrieve-shipment

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /shipments/{id}
Retrieves the details of an existing shipment.

Required permissions:

- `shipment:basic:read`
- `payment:basic:read`

# Shipment

Source: https://docs.whop.com/api-reference/shipments/shipment

# Create support channel

Source: https://docs.whop.com/api-reference/support-channels/create-support-channel

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /support_channels
Open a new support channel between a company team member and a customer. Returns the existing channel if one already exists for that user.

Required permissions:

- `support_chat:create`

# List support channels

Source: https://docs.whop.com/api-reference/support-channels/list-support-channels

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /support_channels
Returns a paginated list of support channels for a specific company, with optional filtering by resolution status and custom sorting.

Required permissions:

- `support_chat:read`

# Retrieve support channel

Source: https://docs.whop.com/api-reference/support-channels/retrieve-support-channel

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /support_channels/{id}
Retrieves the details of an existing support channel.

Required permissions:

- `support_chat:read`

# Support Channel

Source: https://docs.whop.com/api-reference/support-channels/support-channel

# Create topup

Source: https://docs.whop.com/api-reference/topups/create-topup

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /topups
Add funds to a company's platform balance by charging a stored payment method. Top-ups have no fees or taxes and do not count as revenue.

Required permissions:

- `payment:charge`

# Topup

Source: https://docs.whop.com/api-reference/topups/topup

# Create transfer

Source: https://docs.whop.com/api-reference/transfers/create-transfer

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /transfers
Transfer funds between two ledger accounts, such as from a company balance to a user balance.

Required permissions:

- `payout:transfer_funds`

# Retrieve transfer

Source: https://docs.whop.com/api-reference/transfers/retrieve-transfer

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /transfers/{id}
Retrieves the details of an existing transfer.

Required permissions:

- `payout:transfer:read`

# Check access

Source: https://docs.whop.com/api-reference/users/check-access

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /users/{id}/access/{resource_id}
Check whether a user has access to a specific resource, and return their access level.

# Retrieve user

Source: https://docs.whop.com/api-reference/users/retrieve-user

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /users/{id}
Retrieves the details of an existing user.

# Update user

Source: https://docs.whop.com/api-reference/users/update-user

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /users/me
Update the currently authenticated user's profile.

Required permissions:

- `user:profile:update`

# User

Source: https://docs.whop.com/api-reference/users/user

# Retrieve verification

Source: https://docs.whop.com/api-reference/verifications/retrieve-verification

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /verifications/{id}
Retrieves the details of an existing verification.

Required permissions:

- `payout:account:read`

# Verification

Source: https://docs.whop.com/api-reference/verifications/verification

# Verification succeeded

Source: https://docs.whop.com/api-reference/verifications/verification-succeeded

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook verification.succeeded
Sent when a verification is succeeded

Required permissions:

- `payout:account:read`
- `webhook_receive:verifications`

# Create withdrawal

Source: https://docs.whop.com/api-reference/withdrawals/create-withdrawal

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /withdrawals
Creates a withdrawal request for a ledger account

Required permissions:

- `payout:withdraw_funds`
- `payout:destination:read`

# List withdrawals

Source: https://docs.whop.com/api-reference/withdrawals/list-withdrawals

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /withdrawals
Returns a paginated list of withdrawals for a company, with optional sorting and date filtering.

Required permissions:

- `payout:withdrawal:read`

# Retrieve withdrawal

Source: https://docs.whop.com/api-reference/withdrawals/retrieve-withdrawal

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /withdrawals/{id}
Retrieves the details of an existing withdrawal.

Required permissions:

- `payout:withdrawal:read`
- `payout:destination:read`

# Withdrawal

Source: https://docs.whop.com/api-reference/withdrawals/withdrawal

# Withdrawal created

Source: https://docs.whop.com/api-reference/withdrawals/withdrawal-created

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook withdrawal.created
Sent when a withdrawal is created

Required permissions:

- `payout:withdrawal:read`
- `payout:destination:read`
- `webhook_receive:withdrawals`

# Withdrawal updated

Source: https://docs.whop.com/api-reference/withdrawals/withdrawal-updated

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook withdrawal.updated
Sent when a withdrawal is updated

Required permissions:

- `payout:withdrawal:read`
- `payout:destination:read`
- `webhook_receive:withdrawals`

# Access Token

Source: https://docs.whop.com/api-reference/access-tokens/access-token

# Create access token

Source: https://docs.whop.com/api-reference/access-tokens/create-access-token

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /access_tokens
Create a short-lived access token for authenticating API requests. When using API key authentication, provide company_id or user_id. When using OAuth, the user is derived from the token. Use this token with Whop's web and mobile embedded components.

# Account Link

Source: https://docs.whop.com/api-reference/account-links/account-link

# Create account link

Source: https://docs.whop.com/api-reference/account-links/create-account-link

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /account_links
Generate a URL that directs a sub-merchant to their account portal, such as the hosted payouts dashboard or the KYC onboarding flow.

# Ai Chat

Source: https://docs.whop.com/api-reference/ai-chats/ai-chat

# Create ai chat

Source: https://docs.whop.com/api-reference/ai-chats/create-ai-chat

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /ai_chats
Create a new AI chat thread and send the first message to the AI agent.

Required permissions:

- `ai_chat:create`

# Delete ai chat

Source: https://docs.whop.com/api-reference/ai-chats/delete-ai-chat

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /ai_chats/{id}
Delete an AI chat thread so it no longer appears in the user's chat list.

Required permissions:

- `ai_chat:delete`

# List ai chats

Source: https://docs.whop.com/api-reference/ai-chats/list-ai-chats

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /ai_chats
Returns a paginated list of AI chat threads for the current authenticated user.

# Retrieve ai chat

Source: https://docs.whop.com/api-reference/ai-chats/retrieve-ai-chat

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /ai_chats/{id}
Retrieves the details of an existing AI chat.

# Update ai chat

Source: https://docs.whop.com/api-reference/ai-chats/update-ai-chat

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /ai_chats/{id}
Update an AI chat's title or associated company context.

Required permissions:

- `ai_chat:update`

# App Build

Source: https://docs.whop.com/api-reference/app-builds/app-build

# Create app build

Source: https://docs.whop.com/api-reference/app-builds/create-app-build

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /app_builds
Upload a new build artifact for an app. The build must include a compiled code bundle for the specified platform.

Required permissions:

- `developer:manage_builds`

# List app builds

Source: https://docs.whop.com/api-reference/app-builds/list-app-builds

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /app_builds
Returns a paginated list of build artifacts for a given app, with optional filtering by platform, status, and creation date.

Required permissions:

- `developer:manage_builds`

# Promote app build

Source: https://docs.whop.com/api-reference/app-builds/promote-app-build

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /app_builds/{id}/promote
Promote an approved or draft app build to production so it becomes the active version served to users.

Required permissions:

- `developer:manage_builds`

# Retrieve app build

Source: https://docs.whop.com/api-reference/app-builds/retrieve-app-build

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /app_builds/{id}
Retrieves the details of an existing app build.

Required permissions:

- `developer:manage_builds`

# App

Source: https://docs.whop.com/api-reference/apps/app

# Create app

Source: https://docs.whop.com/api-reference/apps/create-app

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /apps
Register a new app on the Whop developer platform. Apps provide custom experiences that can be added to products.

Required permissions:

- `developer:create_app`
- `developer:manage_api_key`

# List apps

Source: https://docs.whop.com/api-reference/apps/list-apps

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /apps
Returns a paginated list of apps on the Whop platform, with optional filtering by company, type, view support, and search query.

# Retrieve app

Source: https://docs.whop.com/api-reference/apps/retrieve-app

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /apps/{id}
Retrieves the details of an existing app.

Required permissions:

- `developer:manage_api_key`

# Update app

Source: https://docs.whop.com/api-reference/apps/update-app

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /apps/{id}
Update the settings, metadata, or status of an existing app on the Whop developer platform.

Required permissions:

- `developer:update_app`
- `developer:manage_api_key`

# Course Chapter

Source: https://docs.whop.com/api-reference/course-chapters/course-chapter

# Create course chapter

Source: https://docs.whop.com/api-reference/course-chapters/create-course-chapter

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /course_chapters
Create a new chapter within a course to organize lessons into sections.

Required permissions:

- `courses:update`

# Delete course chapter

Source: https://docs.whop.com/api-reference/course-chapters/delete-course-chapter

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /course_chapters/{id}
Permanently delete a chapter and all of its lessons from a course.

Required permissions:

- `courses:update`

# List course chapters

Source: https://docs.whop.com/api-reference/course-chapters/list-course-chapters

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /course_chapters
Returns a paginated list of chapters within a course, ordered by position.

Required permissions:

- `courses:read`

# Retrieve course chapter

Source: https://docs.whop.com/api-reference/course-chapters/retrieve-course-chapter

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /course_chapters/{id}
Retrieves the details of an existing course chapter.

Required permissions:

- `courses:read`

# Update course chapter

Source: https://docs.whop.com/api-reference/course-chapters/update-course-chapter

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /course_chapters/{id}
Update a chapter's title within a course.

Required permissions:

- `courses:update`

# Course Lesson Interaction

Source: https://docs.whop.com/api-reference/course-lesson-interactions/course-lesson-interaction

# Courselessoninteraction completed

Source: https://docs.whop.com/api-reference/course-lesson-interactions/courselessoninteraction-completed

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml webhook course_lesson_interaction.completed
Sent when a course lesson interaction is completed

Required permissions:

- `courses:read`
- `course_analytics:read`
- `webhook_receive:courses`

# List course lesson interactions

Source: https://docs.whop.com/api-reference/course-lesson-interactions/list-course-lesson-interactions

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /course_lesson_interactions
Returns a paginated list of lesson interactions, filtered by lesson, course, user, or completion status.

Required permissions:

- `courses:read`
- `course_analytics:read`

# Retrieve course lesson interaction

Source: https://docs.whop.com/api-reference/course-lesson-interactions/retrieve-course-lesson-interaction

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /course_lesson_interactions/{id}
Retrieves the details of an existing course lesson interaction.

Required permissions:

- `courses:read`
- `course_analytics:read`

# Course Lesson

Source: https://docs.whop.com/api-reference/course-lessons/course-lesson

# Create course lesson

Source: https://docs.whop.com/api-reference/course-lessons/create-course-lesson

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /course_lessons
Create a new lesson within a course chapter. Lessons can contain video, text, or assessment content.

Required permissions:

- `courses:update`

# Delete course lesson

Source: https://docs.whop.com/api-reference/course-lessons/delete-course-lesson

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /course_lessons/{id}
Permanently delete a lesson and remove it from its chapter.

Required permissions:

- `courses:update`

# List course lessons

Source: https://docs.whop.com/api-reference/course-lessons/list-course-lessons

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /course_lessons
Returns a paginated list of lessons within a course or chapter, ordered by position.

Required permissions:

- `courses:read`

# Mark as completed course lesson

Source: https://docs.whop.com/api-reference/course-lessons/mark-as-completed-course-lesson

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /course_lessons/{lesson_id}/mark_as_completed
Mark a lesson as completed for the current user after they finish the content.

# Retrieve course lesson

Source: https://docs.whop.com/api-reference/course-lessons/retrieve-course-lesson

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /course_lessons/{id}
Retrieves the details of an existing course lesson.

Required permissions:

- `courses:read`

# Start course lesson

Source: https://docs.whop.com/api-reference/course-lessons/start-course-lesson

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /course_lessons/{lesson_id}/start
Record that the current user has started viewing a lesson, creating progress tracking records.

# Submit assessment course lesson

Source: https://docs.whop.com/api-reference/course-lessons/submit-assessment-course-lesson

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /course_lessons/{lesson_id}/submit_assessment
Submit answers for a quiz or knowledge check lesson and receive a graded result.

# Update course lesson

Source: https://docs.whop.com/api-reference/course-lessons/update-course-lesson

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /course_lessons/{id}
Update a lesson's content, type, visibility, assessment questions, or media attachments.

Required permissions:

- `courses:update`

# Course Student

Source: https://docs.whop.com/api-reference/course-students/course-student

# List course students

Source: https://docs.whop.com/api-reference/course-students/list-course-students

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /course_students
Returns a paginated list of students enrolled in a course, with optional name filtering.

Required permissions:

- `courses:read`
- `course_analytics:read`

# Retrieve course student

Source: https://docs.whop.com/api-reference/course-students/retrieve-course-student

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /course_students/{id}
Retrieves the details of an existing course student.

Required permissions:

- `courses:read`
- `course_analytics:read`

# Course

Source: https://docs.whop.com/api-reference/courses/course

# Create course

Source: https://docs.whop.com/api-reference/courses/create-course

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /courses
Create a new course within an experience, with optional chapters, lessons, and a certificate.

Required permissions:

- `courses:update`

# Delete course

Source: https://docs.whop.com/api-reference/courses/delete-course

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /courses/{id}
Permanently delete a course and all of its chapters, lessons, and student progress.

Required permissions:

- `courses:update`

# List courses

Source: https://docs.whop.com/api-reference/courses/list-courses

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /courses
Returns a paginated list of courses, filtered by either an experience or a company.

Required permissions:

- `courses:read`

# Retrieve course

Source: https://docs.whop.com/api-reference/courses/retrieve-course

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /courses/{id}
Retrieves the details of an existing course.

Required permissions:

- `courses:read`

# Update course

Source: https://docs.whop.com/api-reference/courses/update-course

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /courses/{id}
Update a course's title, description, visibility, thumbnail, or chapter ordering.

Required permissions:

- `courses:update`

# Create dm channel

Source: https://docs.whop.com/api-reference/dm-channels/create-dm-channel

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /dm_channels
Create a new DM channel between two or more users, optionally scoped to a specific company. Returns the existing channel if one already exists.

# Delete dm channel

Source: https://docs.whop.com/api-reference/dm-channels/delete-dm-channel

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /dm_channels/{id}
Permanently delete a DM channel and all of its messages. Only an admin of the channel can perform this action.

Required permissions:

- `dms:channel:manage`

# Dm Channel

Source: https://docs.whop.com/api-reference/dm-channels/dm-channel

# List dm channels

Source: https://docs.whop.com/api-reference/dm-channels/list-dm-channels

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /dm_channels
Returns a paginated list of DM channels for the currently authenticated user, sorted by most recently active.

Required permissions:

- `dms:read`

# Retrieve dm channel

Source: https://docs.whop.com/api-reference/dm-channels/retrieve-dm-channel

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /dm_channels/{id}
Retrieves the details of an existing DM channel.

Required permissions:

- `dms:read`

# Update dm channel

Source: https://docs.whop.com/api-reference/dm-channels/update-dm-channel

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /dm_channels/{id}
Update the settings of an existing DM channel, such as its display name. Only an admin of the channel can perform this action.

Required permissions:

- `dms:channel:manage`

# Create dm member

Source: https://docs.whop.com/api-reference/dm-members/create-dm-member

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /dm_members
Add a new user to an existing DM channel. Only an admin of the channel can add members.

Required permissions:

- `dms:channel:manage`

# Delete dm member

Source: https://docs.whop.com/api-reference/dm-members/delete-dm-member

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /dm_members/{id}
Remove a user from a DM channel. An admin can remove any member, and a member can remove themselves.

Required permissions:

- `dms:channel:manage`

# Dm Member

Source: https://docs.whop.com/api-reference/dm-members/dm-member

# List dm members

Source: https://docs.whop.com/api-reference/dm-members/list-dm-members

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /dm_members
Returns a paginated list of members in a specific DM channel, sorted by the date they were added.

Required permissions:

- `dms:read`

# Retrieve dm member

Source: https://docs.whop.com/api-reference/dm-members/retrieve-dm-member

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /dm_members/{id}
Retrieves the details of an existing DM member.

Required permissions:

- `dms:read`

# Update dm member

Source: https://docs.whop.com/api-reference/dm-members/update-dm-member

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /dm_members/{id}
Update a DM channel member's settings, such as their notification preferences or membership status.

Required permissions:

- `dms:channel:manage`

# Create file

Source: https://docs.whop.com/api-reference/files/create-file

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /files
Create a new file record and receive a presigned URL for uploading content to S3.

# File

Source: https://docs.whop.com/api-reference/files/file

# Retrieve file

Source: https://docs.whop.com/api-reference/files/retrieve-file

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /files/{id}
Retrieves the details of an existing file.

# Create message

Source: https://docs.whop.com/api-reference/messages/create-message

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /messages
Send a new message in an experience chat, DM, or group chat channel. Supports text content, attachments, polls, and replies.

Required permissions:

- `chat:message:create`

# Delete message

Source: https://docs.whop.com/api-reference/messages/delete-message

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /messages/{id}
Permanently delete a message from an experience chat, DM, or group chat channel. Only the message author or a channel admin can delete a message.

Required permissions:

- `chat:message:create`

# Retrieve message

Source: https://docs.whop.com/api-reference/messages/retrieve-message

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /messages/{id}
Retrieves the details of an existing message.

Required permissions:

- `chat:read`

# Update message

Source: https://docs.whop.com/api-reference/messages/update-message

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /messages/{id}
Edit the content, attachments, or pinned status of an existing message in an experience chat, DM, or group chat channel.

# Create notification

Source: https://docs.whop.com/api-reference/notifications/create-notification

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /notifications
Send a push notification to users in an experience or company team. The notification is processed asynchronously and supports targeting specific users.

Required permissions:

- `notification:create`

# Create reaction

Source: https://docs.whop.com/api-reference/reactions/create-reaction

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /reactions
Add an emoji reaction or poll vote to a message or forum post. In forums, the reaction is always a like.

Required permissions:

- `chat:read`

# Delete reaction

Source: https://docs.whop.com/api-reference/reactions/delete-reaction

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /reactions/{id}
Remove an emoji reaction from a message or forum post. Only the reaction author or a channel admin can remove a reaction.

Required permissions:

- `chat:read`

# List reactions

Source: https://docs.whop.com/api-reference/reactions/list-reactions

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /reactions
Returns a paginated list of emoji reactions on a specific message or forum post, sorted by most recent.

Required permissions:

- `chat:read`

# Reaction

Source: https://docs.whop.com/api-reference/reactions/reaction

# Retrieve reaction

Source: https://docs.whop.com/api-reference/reactions/retrieve-reaction

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /reactions/{id}
Retrieves the details of an existing reaction.

Required permissions:

- `chat:read`

# Create webhook

Source: https://docs.whop.com/api-reference/webhooks/create-webhook

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml post /webhooks
Creates a new webhook

Required permissions:

- `developer:manage_webhook`

# Delete webhook

Source: https://docs.whop.com/api-reference/webhooks/delete-webhook

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml delete /webhooks/{id}
Deletes a webhook

Required permissions:

- `developer:manage_webhook`

# List webhooks

Source: https://docs.whop.com/api-reference/webhooks/list-webhooks

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /webhooks
Returns a paginated list of webhook endpoints configured for a company, ordered by most recently created.

Required permissions:

- `developer:manage_webhook`

# Retrieve webhook

Source: https://docs.whop.com/api-reference/webhooks/retrieve-webhook

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml get /webhooks/{id}
Retrieves the details of an existing webhook.

Required permissions:

- `developer:manage_webhook`

# Update webhook

Source: https://docs.whop.com/api-reference/webhooks/update-webhook

https://app.stainless.com/api/spec/documented/whopsdk/openapi.documented.yml patch /webhooks/{id}
Updates a webhook

Required permissions:

- `developer:manage_webhook`

# Webhook

Source: https://docs.whop.com/api-reference/webhooks/webhook

# Embed checkout

Source: https://docs.whop.com/payments/checkout-embed

Learn how to embed Whop's checkout flow on your website

Embedded checkout allows you to embed Whop's checkout flow on your own website. This allows you to offer your customers a seamless checkout experience without leaving your website.

<iframe title="YouTube video player" />

## React setup

### Step 1: Install the package

```bash theme={null}
npm install @whop/checkout
```

### Step 2: Add the checkout element

```tsx theme={null}
import { WhopCheckoutEmbed } from '@whop/checkout/react'

export default function Home() {
  return (
    <WhopCheckoutEmbed planId="plan_XXXXXXXXX" returnUrl="https://yoursite.com/checkout/complete" />
  )
}
```

This component will mount an iframe with the Whop checkout embed.

The `returnUrl` is required to handle redirects from external payment providers. When redirected, check the `status` query parameter:

- **success**: The payment succeeded. Use the receipt information to render a success page.
- **error**: The payment failed or was canceled. Remount the checkout so your customer can try again.

<Tip>
  Keep that Plan ID handy. You'll need to paste it into your website code, so
  save it somewhere you can find it.
</Tip>

### Step 3: **(optional)** Configure - Programmatic controls

To get access to the controls of the checkout embed, you can use the `ref` prop.

```tsx theme={null}
const ref = useCheckoutEmbedControls()

return <WhopCheckoutEmbed ref={ref} planId="plan_XXXXXXXXX" />
```

#### **`submit`**

To submit checkout programmatically, you can use the `submit` method on the checkout element.

```tsx theme={null}
ref.current?.submit()
```

#### **`getEmail`**

To get the email of the user who is checking out, you can use the `getEmail` method on the checkout element.

```tsx theme={null}
const email = await ref.current?.getEmail()
console.log(email)
```

#### **`setEmail`**

To set the email of the user who is checking out, you can use the `setEmail` method on the checkout element.

```tsx theme={null}
try {
  await ref.current?.setEmail('example@domain.com')
} catch (error) {
  console.error(error)
}
```

#### **`getAddress`**

To get the address of the user who is checking out, you can use the `getAddress` method on the checkout element.

```tsx theme={null}
const address = await ref.current?.getAddress()
console.log(address)
```

#### **`setAddress`**

To set the address of the user who is checking out, you can use the `setAddress` method on the checkout element.

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `hideAddressForm` prop to `true`.
</Note>

```tsx theme={null}
try {
  await ref.current?.setAddress({
    name: 'John Doe',
    country: 'US',
    line1: '123 Main St',
    city: 'Any Town',
    state: 'CA',
    postalCode: '12345',
  })
} catch (error) {
  console.error(error)
}
```

### Step 4: **(optional)** Configure - Available properties

#### **`planId`**

**Required** - The plan id you want to checkout.

#### **`theme`**

**Optional** - The theme you want to use for the checkout.

Possible values are `light`, `dark` or `system`.

#### **`sessionId`**

**Optional** - The session id to use for the checkout.

This can be used to attach metadata to a checkout by first creating a session through the API and then passing the session id to the checkout element.

#### **`returnUrl`**

**Optional** - The URL to redirect the user to after checkout completes.

```tsx theme={null}
<WhopCheckoutEmbed returnUrl="https://yoursite.com/checkout/complete" planId="plan_XXXXXXXXX" />
```

#### **`affiliateCode`**

**Optional** - The affiliate code to use for the checkout.

```tsx theme={null}
<WhopCheckoutEmbed affiliateCode="tristan" planId="plan_XXXXXXXXX" />
```

#### **`hidePrice`**

**Optional** - Turn on to hide the price in the embedded checkout form.

Defaults to `false`

#### **`hideTermsAndConditions`**

**Optional** - Set to `true` to hide the terms and conditions in the embedded checkout form.

Defaults to `false`

#### **`skipRedirect`**

**Optional** - Set to `true` to skip the final redirect and keep the top frame loaded.

Defaults to `false`

#### **`onComplete`**

**Optional** - A callback function that will be called when the checkout is complete.

<Note>This option will set `skipRedirect` to `true`</Note>

```tsx theme={null}
<WhopCheckoutEmbed
  onComplete={(planId, receiptId) => {
    console.log(planId, receiptId)
  }}
  planId="plan_XXXXXXXXX"
/>
```

#### **`utm`**

**Optional** - The UTM parameters to add to the checkout URL.

**Note** - The keys must start with `utm_`

```tsx theme={null}
<WhopCheckoutEmbed planId="plan_XXXXXXXXX" utm={{ utm_campaign: 'ad_XXXXXXX' }} />
```

#### **`fallback`**

**Optional** - The fallback content to show while the checkout is loading.

```tsx theme={null}
<WhopCheckoutEmbed fallback={<>loading...</>} planId="plan_XXXXXXXXX" />
```

#### **`prefill`**

**Optional** - The prefill options to apply to the checkout embed.

Used to prefill the email or address in the embedded checkout form.
This setting can be helpful when integrating the embed into a funnel that collects the email prior to payment already.

```tsx theme={null}
<WhopCheckoutEmbed
  prefill={{ email: "example@domain.com" }}
  planId="plan_XXXXXXXXX"
/>
<WhopCheckoutEmbed
  prefill={{ address: {
    name: "John Doe",
    country: "US",
    line1: "123 Main St",
    city: "Any Town",
    state: "CA",
    postalCode: "12345",
  } }}
  planId="plan_XXXXXXXXX"
/>
```

#### **`hideEmail`**

**Optional** - Set to `true` to hide the email input in the embedded checkout form. Make sure to display the users email in the parent page when setting this attribute.

Defaults to `false`

<Note>
  Use this in conjunction with the `prefill` attribute or the `setEmail` method
  to control the email input.
</Note>

```tsx theme={null}
<WhopCheckoutEmbed hideEmail planId="plan_XXXXXXXXX" />
```

#### **`disableEmail`**

**Optional** - Set to `true` to disable the email input in the embedded checkout form.

Defaults to `false`

<Note>
  Use this in conjunction with the `prefill` attribute or the `setEmail` method
  to control the email input.
</Note>

```tsx theme={null}
<WhopCheckoutEmbed disableEmail planId="plan_XXXXXXXXX" />
```

#### **`hideAddressForm`**

**Optional** - Set to `true` to hide the address form in the embedded checkout form.

Defaults to `false`

<Note>
  Use this in conjunction with the `setAddress` method to control the address
  input.
</Note>

```tsx theme={null}
<WhopCheckoutEmbed hideAddressForm planId="plan_XXXXXXXXX" />
```

#### **`setupFutureUsage`**

**Optional** - The setup future usage to use for the checkout. When using the `chargeUser` API you need to set this to `off_session`. This will filter out payment methods that are not supported with that API.

```tsx theme={null}
<WhopCheckoutEmbed setupFutureUsage="off_session" planId="plan_XXXXXXXXX" />
```

#### **`onStateChange`**

**Optional** - A callback function that will be called when the checkout state changes.

This can be used when programmatically submitting the checkout embed.

Possible values are `loading`, `ready`, `disabled`.

```tsx theme={null}
<WhopCheckoutEmbed
  onStateChange={(state) => {
    console.log(state)
  }}
  planId="plan_XXXXXXXXX"
/>
```

#### **`environment`**

**Optional** - The environment to use for the checkout.

Possible values are `production` or `sandbox`.

Defaults to `production`

<Note>
  When using `sandbox`, make sure to use a sandbox plan ID. Sandbox plans can be created in the [sandbox dashboard](https://sandbox.whop.com/dashboard).
</Note>

```tsx theme={null}
<WhopCheckoutEmbed environment="sandbox" planId="plan_XXXXXXXXX" />
```

#### **`onAddressValidationError`**

**Optional** - A callback function that will be called when the address validation error occurs.

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `hideAddressForm` prop to `true`.
</Note>

```tsx theme={null}
<WhopCheckoutEmbed
  hideAddressForm
  onAddressValidationError={(error) => {
    console.log(error)
  }}
  planId="plan_XXXXXXXXX"
/>
```

#### **`styles`**

**Optional** - Customize the padding of the checkout embed container.

The `styles` prop accepts a `container` object with the following properties:

| Property        | Description                          | Default |
| --------------- | ------------------------------------ | ------- |
| `paddingTop`    | Top padding in pixels                | `32`    |
| `paddingBottom` | Bottom padding in pixels             | `32`    |
| `paddingLeft`   | Left padding in pixels               | `32`    |
| `paddingRight`  | Right padding in pixels              | `32`    |
| `paddingY`      | Shorthand for top and bottom padding | `32`    |
| `paddingX`      | Shorthand for left and right padding | `32`    |

Individual properties take precedence over their shorthand equivalents.

```tsx theme={null}
<WhopCheckoutEmbed planId="plan_XXXXXXXXX" styles={{ container: { paddingX: 0 } }} />
```

```tsx theme={null}
<WhopCheckoutEmbed
  planId="plan_XXXXXXXXX"
  styles={{ container: { paddingLeft: 16, paddingRight: 16, paddingTop: 0, paddingBottom: 0 } }}
/>
```

### Full example

```tsx theme={null}
import { WhopCheckoutEmbed } from '@whop/checkout/react'

export default function Home() {
  return (
    <WhopCheckoutEmbed
      fallback={<>loading...</>}
      planId="plan_XXXXXXXXX"
      sessionId="ch_XXXXXXXXX"
      returnUrl="https://yoursite.com/checkout/complete"
      theme="light"
      hidePrice={false}
    />
  )
}
```

## Other websites

### Step 1: Add the script tag

To embed checkout, you need to add the following script tag into the `<head>` of your page:

```md theme={null}
<script
  async
  defer
  src="https://js.whop.com/static/checkout/loader.js"
></script>
```

### Step 2: Add the checkout element

To create a checkout element, you need to include the following attributes on an element in your page:

```md theme={null}
<div
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
  data-whop-checkout-return-url="https://yoursite.com/checkout/complete"
></div>
```

This will mount an iframe inside of the element with the plan id you provided.

The `data-whop-checkout-return-url` is required to handle redirects from external payment providers. When redirected, check the `status` query parameter:

- **success**: The payment succeeded. Use the receipt information to render a success page.
- **error**: The payment failed or was canceled. Remount the checkout so your customer can try again.

### Step 3: **(optional)** Configure - Programmatic controls

First, attach an `id` to the checkout container:

```md theme={null}
<div id="whop-embedded-checkout" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`submit`**

To submit checkout programmatically, you can use the `submit` method on the checkout element.

```js theme={null}
wco.submit('whop-embedded-checkout')
```

#### **`getEmail`**

To get the email of the user who is checking out, you can use the `getEmail` method on the checkout element.

```js theme={null}
const email = await wco.getEmail('whop-embedded-checkout')
console.log(email)
```

#### **`setEmail`**

To set the email of the user who is checking out, you can use the `setEmail` method on the checkout element.

```js theme={null}
wco.setEmail('whop-embedded-checkout', 'example@domain.com')
```

#### **`getAddress`**

To get the address of the user who is checking out, you can use the `getAddress` method on the checkout element.

```js theme={null}
const address = await wco.getAddress('whop-embedded-checkout')
console.log(address)
```

#### **`setAddress`**

To set the address of the user who is checking out, you can use the `setAddress` method on the checkout element.

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `data-whop-checkout-hide-address` prop to `true`.
</Note>

```js theme={null}
try {
  await wco.setAddress('whop-embedded-checkout', {
    name: 'John Doe',
    country: 'US',
    line1: '123 Main St',
    city: 'Any Town',
    state: 'CA',
    postalCode: '12345',
  })
} catch (error) {
  console.error(error)
}
```

### Step 4: **(optional)** Configure - Available attributes

#### **`data-whop-checkout-plan-id`**

**Required** - The plan id you want to checkout.

> To get your plan id, you need to first create a plan in the **Manage Pricing** section on your whop page.

#### **`data-whop-checkout-theme`**

**Optional** - The theme you want to use for the checkout.

Possible values are `light`, `dark` or `system`.

```md theme={null}
<div data-whop-checkout-theme="light" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-theme-accent-color`**

**Optional** - The accent color to apply to the checkout embed

Possible values are

- `tomato`
- `red`
- `ruby`
- `crimson`
- `pink`
- `plum`
- `purple`
- `violet`
- `iris`
- `cyan`
- `teal`
- `jade`
- `green`
- `grass`
- `brown`
- `blue`
- `orange`
- `indigo`
- `sky`
- `mint`
- `yellow`
- `amber`
- `lime`
- `lemon`
- `magenta`
- `gold`
- `bronze`
- `gray`

```md theme={null}
<div data-whop-checkout-theme-accent-color="green" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-session`**

**Optional** - The session id to use for the checkout.

This can be used to attach metadata to a checkout by first creating a session through the API and then passing the session id to the checkout element.

```md theme={null}
<div data-whop-checkout-session="ch_XXXXXXXXX" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-return-url`**

**Optional** - The URL to redirect the user to after checkout completes.

```md theme={null}
<div data-whop-checkout-return-url="https://yoursite.com/checkout/complete" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-affiliate-code`**

**Optional** - The affiliate code to use for the checkout.

```md theme={null}
<div data-whop-checkout-affiliate-code="tristan" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-price`**

**Optional** - Set to `true` to hide the price in the embedded checkout form.

Defaults to `false`

```md theme={null}
<div data-whop-checkout-hide-price="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-submit-button`**

**Optional** - Set to `true` to hide the submit button in the embedded checkout form.

Defaults to `false`

<Note>
  When using this Option, you will need to [programmatically submit](#submit)
  the checkout form.
</Note>

```md theme={null}
<div data-whop-checkout-hide-submit-button="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-tos`**

**Optional** - Set to `true` to hide the terms and conditions in the embedded checkout form.

Defaults to `false`

```md theme={null}
<div data-whop-checkout-hide-tos="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-skip-redirect`**

**Optional** - Set to `true` to skip the final redirect and keep the top frame loaded.

Defaults to `false`

```md theme={null}
<div data-whop-checkout-skip-redirect="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-on-complete`**

**Optional** - The callback to call when the checkout succeeds

<Note>This option will set `data-whop-checkout-skip-redirect` to `true`</Note>

```html theme={null}
<script>
  window.onCheckoutComplete = (planId, receiptId) => {
    console.log(planId, receiptId)
  }
</script>

<div
  data-whop-checkout-on-complete="onCheckoutComplete"
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>
```

#### **`data-whop-checkout-on-state-change`**

**Optional** - The callback to call when state of the checkout changes

This can be used when programmatically submitting the checkout embed.

Possible values are `loading`, `ready`, `disabled`.

```html theme={null}
<script>
  window.onCheckoutStateChange = (state) => {
    console.log(state)
  }
</script>

<div
  data-whop-checkout-on-state-change="onCheckoutStateChange"
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>
```

#### **`data-whop-checkout-skip-utm`**

By default any utm params from the main page will be forwarded to the checkout embed.

**Optional** - Set to `true` to prevent the automatic forwarding of utm parameters

Defaults to `false`

#### **`data-whop-checkout-prefill-*`**

Used to prefill the email or address in the embedded checkout form. This setting can be helpful when integrating the embed into a funnel that collects the email prior to payment already.

```md theme={null}
<div data-whop-checkout-prefill-email="example@domain.com" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>

<div 
	data-whop-checkout-prefill-name="John Doe"
	data-whop-checkout-prefill-address-country="US"
	data-whop-checkout-prefill-address-line1="123 Main St"
	data-whop-checkout-prefill-address-line2=""
	data-whop-checkout-prefill-address-city="Any Town"
	data-whop-checkout-prefill-address-state="CA"
	data-whop-checkout-prefill-address-postal-code="12345"
	data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>

<div data-whop-checkout-prefill-address-name="John Doe" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-email`**

**Optional** - Set to `true` to hide the email input in the embedded checkout form. Make sure to display the users email in the parent page when setting this attribute.

Defaults to `false`

<Note>
  Use this in conjunction with the `data-whop-checkout-prefill-email` attribute
  or the `setEmail` method to control the email input.
</Note>

```md theme={null}
<div data-whop-checkout-hide-email="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-disable-email`**

**Optional** - Set to `true` to disable the email input in the embedded checkout form.

Defaults to `false`

<Note>
  Use this in conjunction with the `data-whop-checkout-prefill-email` attribute
  or the `setEmail` method to control the email input.
</Note>

```md theme={null}
<div data-whop-checkout-disable-email="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-address`**

**Optional** - Set to `true` to hide the address form in the embedded checkout form.

Defaults to `false`

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `data-whop-checkout-hide-address` prop to `true`.
</Note>

```md theme={null}
<div data-whop-checkout-hide-address="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-setup-future-usage`**

**Optional** - The setup future usage to use for the checkout. When using the `chargeUser` API you need to set this to `off_session`. This will filter out payment methods that are not supported with that API.

```md theme={null}
<div data-whop-checkout-setup-future-usage="off_session" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-environment`**

**Optional** - The environment to use for the checkout.

Possible values are `production` or `sandbox`.

Defaults to `production`

<Note>
  When using `sandbox`, make sure to use a sandbox plan ID. Sandbox plans can be created in the [sandbox dashboard](https://sandbox.whop.com/dashboard).
</Note>

```md theme={null}
<div data-whop-checkout-environment="sandbox" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-on-address-validation-error`**

**Optional** - The callback to call when the address validation error occurs.

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `data-whop-checkout-hide-address` prop to `true`.
</Note>

```html theme={null}
<script>
  window.onAddressValidationError = (error) => {
    console.log(error)
  }
</script>

<div
  data-whop-checkout-on-address-validation-error="onAddressValidationError"
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>
```

#### **`data-whop-checkout-style-*`**

**Optional** - Customize the padding of the checkout embed container.

The attribute pattern is `data-whop-checkout-style-container-{property}` where `{property}` is a kebab-case padding property.

| Attribute                                           | Description                          | Default |
| --------------------------------------------------- | ------------------------------------ | ------- |
| `data-whop-checkout-style-container-padding-top`    | Top padding in pixels                | `32`    |
| `data-whop-checkout-style-container-padding-bottom` | Bottom padding in pixels             | `32`    |
| `data-whop-checkout-style-container-padding-left`   | Left padding in pixels               | `32`    |
| `data-whop-checkout-style-container-padding-right`  | Right padding in pixels              | `32`    |
| `data-whop-checkout-style-container-padding-y`      | Shorthand for top and bottom padding | `32`    |
| `data-whop-checkout-style-container-padding-x`      | Shorthand for left and right padding | `32`    |

Individual properties take precedence over their shorthand equivalents.

```md theme={null}
<div
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
  data-whop-checkout-style-container-padding-x="0"
></div>
```

```md theme={null}
<div
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
  data-whop-checkout-style-container-padding-left="16"
  data-whop-checkout-style-container-padding-right="16"
  data-whop-checkout-style-container-padding-top="0"
  data-whop-checkout-style-container-padding-bottom="0"
></div>
```

### Full example

```md theme={null}
<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width">
		<script
			async
			defer
  			src="https://js.whop.com/static/checkout/loader.js"
		></script>
		<title>Whop embedded checkout example</title>
		<style>
			div {
				box-sizing: border-box;
			}
			body {
				margin: 0
			}
		</style>
	</head>
	<body>
		<div
			data-whop-checkout-plan-id="plan_XXXXXXXXX"
			data-whop-checkout-session="ch_XXXXXXXXX"
			data-whop-checkout-return-url="https://yoursite.com/checkout/complete"
			data-whop-checkout-theme="light"
			data-whop-checkout-hide-price="false"
			style="height: fit-content; overflow: hidden; max-width: 50%;"
		></div>
	</body>
</html>
```

## Apple Pay

Apple Pay allows customers to pay using their Apple Wallet, providing a seamless checkout experience on Safari and iOS devices. To enable Apple Pay on your embedded checkout, you need to verify ownership of your domain.

<Card title="Set up Apple Pay" icon="apple" href="/payments/apple-pay">
  Learn how to verify your domain and enable Apple Pay for embedded checkout
</Card>

<Note>
  When using the `hideSubmitButton` option in React, `@whop/checkout@0.0.43` or
  later is required for Apple Pay to appear in the embed.
</Note>

## FAQs

<AccordionGroup>
  <Accordion title="Why is my checkout not loading?">
    Make sure you've correctly replaced `plan_XXXXXXXXX` or `PLAN_ID_HERE` in the code snippets with your actual Plan ID from the Whop dashboard. Also verify that the script tag is properly loaded in the `<head>` section if using HTML/JS.
  </Accordion>

  <Accordion title="Where do I find my Plan ID?">
    Go to your **Dashboard** > **Checkout links** > Click the **three dots (⋮)** on your pricing option > Hover over **Details** > Click the ID (starts with `plan_`) to copy it.
  </Accordion>

  <Accordion title="Can I embed multiple checkouts on the same page?">
    Yes, you can add multiple checkout embeds with different Plan IDs. Each embed operates independently.
  </Accordion>

  <Accordion title="How do I change the checkout theme?">
    For React: add `theme="dark"` or `theme="light"` as a property. For HTML: add `data-whop-checkout-theme="dark"` to your div element.
  </Accordion>

  <Accordion title="Can I hide the price in the embedded checkout?">
    Yes, add `hidePrice={true}` in React or `data-whop-checkout-hide-price="true"` in HTML to hide the price display.
  </Accordion>

  <Accordion title="What happens after a customer completes checkout?">
    By default, customers are redirected to your whop. You can customize this by setting a custom redirect URL or skipping the redirect entirely.
  </Accordion>

  <Accordion title="How do I prevent the redirect after checkout?">
    Use `skipRedirect={true}` in React or `data-whop-checkout-skip-redirect="true"` in HTML to keep users on the same page.
  </Accordion>

  <Accordion title="Is the embedded checkout mobile-responsive?">
    Yes, the checkout automatically adapts to different screen sizes and devices.
  </Accordion>

  <Accordion title="Can I customize the checkout's appearance with CSS?">
    You can style the wrapper using the `.whop-checkout-wrapper iframe` CSS class, but the checkout content itself cannot be modified for security reasons.
  </Accordion>

  <Accordion title="Can I pre-fill customer information?">
    Yes, use `prefill={{ email: "customer@example.com" }}` in React or `data-whop-checkout-prefill-email="customer@example.com"` in HTML.
  </Accordion>
</AccordionGroup>

# AddPayoutMethodElement

Source: https://docs.whop.com/sdk/elements/add-payout-method-element

A UI element that allows users to add a new payout method (bank account, PayPal, etc.) to their account.

## Overview

A UI element that allows users to add a new payout method (bank account, PayPal, etc.) to their account.

This element handles the complete flow for adding payout methods, including:

- Selecting the payout method type
- Entering account details
- Validating the information
- Saving the payout method

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('add-payout-method-element', {
  onComplete: () => {
    console.log('Payout method added!')
  },
})

// Mount it to a container
element.mount('#payout-method-container')
```

### Using as a modal

```typescript theme={null}
// Show the element in a modal overlay
const modal = session.showAddPayoutMethodModal({
  onComplete: (ev) => {
    ev.preventDefault() // Prevent auto-close
    showSuccessMessage()
    setTimeout(() => modal.close(), 2000)
  },
})
```

### Listening to events

```typescript theme={null}
const element = session.createElement('add-payout-method-element', {})

element.on('ready', () => {
  console.log('Element loaded')
})

element.on('complete', (ev) => {
  console.log('Success!')
})

element.on('close', (ev) => {
  // Prevent unmount and show confirmation dialog
  ev.preventDefault()
  if (confirm('Are you sure you want to cancel?')) {
    element.unmount()
  }
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('add-payout-method-element', {
  onReady: (element) => {
    console.log('Element is ready')
  },
  onComplete: (ev) => {
    console.log('Payout method added successfully!')
    // Optionally prevent auto-unmount to show a success message
    // ev.preventDefault();
  },
  onClose: (ev) => {
    console.log('User closed the form')
  },
})
```

## Events

Events emitted by the AddPayoutMethodElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `AddPayoutMethodElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`AddPayoutMethodElementOptions`](#addpayoutmethodelementoptions)) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`AddPayoutMethodElementSnapshot`](#addpayoutmethodelementsnapshot)) => void

### `close`

Emitted when the user closes the payout method form without completing it.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

### `complete`

Emitted when the user successfully adds a new payout method.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`AddPayoutMethodElement`>) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                                          | Description                                      |
| --------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`AddPayoutMethodElementOptions`](#addpayoutmethodelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`AddPayoutMethodElementSnapshot`](#addpayoutmethodelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### AddPayoutMethodElementOptions

Configuration options for the AddPayoutMethodElement.

| Property     | Type                                                               | Required | Default | Description                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------ | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onReady`    | `((element: AddPayoutMethodElement) => void) \| undefined`         | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                                      |
| `onClose`    | `((ev: CustomEvent) => void) \| undefined`                         | No       | -       | Callback fired when the user closes the form without adding a payout method. By default, the element will unmount when closed. Call 'ev.preventDefault()' to keep it mounted. |
| `onComplete` | `((ev: CustomEvent<AddPayoutMethodElement>) => void) \| undefined` | No       | -       | Callback fired when the user successfully adds a new payout method. By default, the element will unmount after completion. Call 'ev.preventDefault()' to keep it mounted.     |

### AddPayoutMethodElementSnapshot

Represents the current state of the AddPayoutMethodElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# AutomaticWithdrawElement

Source: https://docs.whop.com/sdk/elements/automatic-withdraw-element

A UI element that allows users to configure automatic withdrawals for their account.

## Overview

A UI element that allows users to configure automatic withdrawals for their account.

This element handles the complete flow for setting up automatic withdrawals, including:

- Configuring withdrawal frequency and thresholds
- Selecting the destination payout method
- Enabling or disabling automatic withdrawals

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('automatic-withdraw-element', {
  onComplete: () => {
    console.log('Automatic withdraw settings saved!')
  },
})

// Mount it to a container
element.mount('#automatic-withdraw-container')
```

### Using as a modal

```typescript theme={null}
// Show the element in a modal overlay
const modal = session.showAutomaticWithdrawModal({
  onComplete: (ev) => {
    ev.preventDefault() // Prevent auto-close
    showSuccessMessage()
    setTimeout(() => modal.close(), 2000)
  },
})
```

### Listening to events

```typescript theme={null}
const element = session.createElement('automatic-withdraw-element', {})

element.on('ready', () => {
  console.log('Element loaded')
})

element.on('complete', (ev) => {
  console.log('Settings saved!')
})

element.on('close', (ev) => {
  // Prevent unmount and show confirmation dialog
  ev.preventDefault()
  if (confirm('Are you sure you want to cancel?')) {
    element.unmount()
  }
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('automatic-withdraw-element', {
  onReady: (element) => {
    console.log('Element is ready')
  },
  onComplete: (ev) => {
    console.log('Automatic withdraw settings saved!')
    // Optionally prevent auto-unmount to show a success message
    // ev.preventDefault();
  },
  onClose: (ev) => {
    console.log('User closed the form')
  },
})
```

## Events

Events emitted by the AutomaticWithdrawElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `AutomaticWithdrawElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`AutomaticWithdrawElementOptions`](#automaticwithdrawelementoptions)) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`AutomaticWithdrawElementSnapshot`](#automaticwithdrawelementsnapshot)) => void

### `close`

Emitted when the user closes the automatic withdraw configuration without saving.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

### `complete`

Emitted when the user successfully saves their automatic withdraw settings.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`AutomaticWithdrawElement`>) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                                              | Description                                      |
| --------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`AutomaticWithdrawElementOptions`](#automaticwithdrawelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`AutomaticWithdrawElementSnapshot`](#automaticwithdrawelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### AutomaticWithdrawElementOptions

Configuration options for the AutomaticWithdrawElement.

| Property     | Type                                                                 | Required | Default | Description                                                                                                                                                                              |
| ------------ | -------------------------------------------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onReady`    | `((element: AutomaticWithdrawElement) => void) \| undefined`         | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                                                 |
| `onClose`    | `((ev: CustomEvent) => void) \| undefined`                           | No       | -       | Callback fired when the user closes the form without saving changes. By default, the element will unmount when closed. Call 'ev.preventDefault()' to keep it mounted.                    |
| `onComplete` | `((ev: CustomEvent<AutomaticWithdrawElement>) => void) \| undefined` | No       | -       | Callback fired when the user successfully saves their automatic withdraw settings. By default, the element will unmount after completion. Call 'ev.preventDefault()' to keep it mounted. |

### AutomaticWithdrawElementSnapshot

Represents the current state of the AutomaticWithdrawElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# BalanceElement

Source: https://docs.whop.com/sdk/elements/balance-element

A UI element that displays the user's balance information including available, pending, and reserve balances.

## Overview

A UI element that displays the user's balance information including available, pending, and reserve balances.

This element provides a comprehensive view of the user's financial status:

- Available balance (funds ready for withdrawal)
- Pending balance (funds being processed)
- Regular reserve balance (funds held in reserve)
- BNPL reserve balance (Buy Now Pay Later reserve funds)

Clicking on balance sections opens detailed breakdown modals by default.

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('balance-element', {
  onReady: () => {
    console.log('Balance loaded!')
  },
})

// Mount it to a container
element.mount('#balance-container')
```

### Hiding pending balance

```typescript theme={null}
const element = session.createElement('balance-element', {
  hidePendingBalance: true,
})

element.mount('#balance-container')
```

### Custom breakdown handling

```typescript theme={null}
const element = session.createElement('balance-element', {
  onShowAvailableBalanceBreakdown: (ev) => {
    // Prevent the default modal from opening
    ev.preventDefault()
    // Show your own custom breakdown UI
    showCustomBreakdownModal()
  },
})

element.mount('#balance-container')
```

### Listening to events

```typescript theme={null}
const element = session.createElement('balance-element', {})

element.on('ready', () => {
  console.log('Element loaded')
})

element.on('showAvailableBalanceBreakdown', (ev) => {
  console.log('User clicked on available balance')
  // Let default modal open, or call ev.preventDefault() to handle yourself
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('balance-element', {
  hidePendingBalance: true,
  onReady: (element) => {
    console.log('Balance element is ready')
  },
  onShowAvailableBalanceBreakdown: (ev) => {
    // Custom handling - prevent default modal
    ev.preventDefault()
    showCustomBreakdownModal()
  },
})
```

## Events

Events emitted by the BalanceElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `BalanceElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`BalanceElementOptions`](#balanceelementoptions)) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`BalanceElementSnapshot`](#balanceelementsnapshot)) => void

### `showAvailableBalanceBreakdown`

Emitted when the user clicks to view the available balance breakdown.
By default, opens the TotalBalanceBreakdown modal. Call `ev.preventDefault()` to handle this yourself.

**Callback signature:** (ev: `CustomEvent`\<`BalanceElement`>) => void

### `showRegularReserveBalanceBreakdown`

Emitted when the user clicks to view the regular reserve balance breakdown.
By default, opens the RegularReserveBalanceBreakdown modal. Call `ev.preventDefault()` to handle this yourself.

**Callback signature:** (ev: `CustomEvent`\<`BalanceElement`>) => void

### `showBnplReserveBalanceBreakdown`

Emitted when the user clicks to view the BNPL reserve balance breakdown.
By default, opens the BnplReserveBalanceBreakdown modal. Call `ev.preventDefault()` to handle this yourself.

**Callback signature:** (ev: `CustomEvent`\<`BalanceElement`>) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                          | Description                                      |
| --------- | ------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`BalanceElementOptions`](#balanceelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`BalanceElementSnapshot`](#balanceelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### BalanceElementOptions

Configuration options for the BalanceElement.

| Property                               | Type                                                       | Required | Default | Description                                                                                                                                                                                        |
| -------------------------------------- | ---------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hidePendingBalance`                   | `boolean \| undefined`                                     | No       | false   | Whether to hide the pending balance from the display. When 'true', only the available balance will be shown.                                                                                       |
| `onReady`                              | `((element: BalanceElement) => void) \| undefined`         | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                                                           |
| `onShowAvailableBalanceBreakdown`      | `((ev: CustomEvent<BalanceElement>) => void) \| undefined` | No       | -       | Callback fired when the user clicks to view the available balance breakdown. By default, opens the TotalBalanceBreakdown modal. Call 'ev.preventDefault()' to handle this yourself.                |
| `onShowRegularReserveBalanceBreakdown` | `((ev: CustomEvent<BalanceElement>) => void) \| undefined` | No       | -       | Callback fired when the user clicks to view the regular reserve balance breakdown. By default, opens the RegularReserveBalanceBreakdown modal. Call 'ev.preventDefault()' to handle this yourself. |
| `onShowBnplReserveBalanceBreakdown`    | `((ev: CustomEvent<BalanceElement>) => void) \| undefined` | No       | -       | Callback fired when the user clicks to view the BNPL reserve balance breakdown. By default, opens the BnplReserveBalanceBreakdown modal. Call 'ev.preventDefault()' to handle this yourself.       |

### BalanceElementSnapshot

Represents the current state of the BalanceElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# BnplReserveBalanceBreakdownElement

Source: https://docs.whop.com/sdk/elements/bnpl-reserve-balance-breakdown-element

A UI element that displays a detailed breakdown of the BNPL (Buy Now Pay Later) reserve balance.

## Overview

A UI element that displays a detailed breakdown of the BNPL (Buy Now Pay Later) reserve balance.

This element shows how funds are allocated in the BNPL reserve, including:

- Total BNPL reserve amount
- Individual transaction holds
- Expected release dates for reserved funds

BNPL reserves are funds held to cover potential refunds or chargebacks from Buy Now Pay Later transactions.

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('bnpl-reserve-balance-breakdown-element', {
  onClose: () => {
    console.log('Breakdown closed')
  },
})

// Mount it to a container
element.mount('#bnpl-breakdown-container')
```

### Using as a modal

```typescript theme={null}
// Show the breakdown in a modal overlay
const modal = session.showBnplReserveBalanceBreakdownModal({
  onClose: (ev) => {
    ev.preventDefault()
    modal.close()
  },
})
```

### Listening to events

```typescript theme={null}
const element = session.createElement('bnpl-reserve-balance-breakdown-element', {})

element.on('ready', () => {
  console.log('Breakdown loaded')
})

element.on('close', (ev) => {
  console.log('User closed the breakdown')
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('bnpl-reserve-balance-breakdown-element', {
  onReady: (element) => {
    console.log('Breakdown is ready')
  },
  onClose: (ev) => {
    console.log('User closed the breakdown')
  },
})
```

## Events

Events emitted by the BnplReserveBalanceBreakdownElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `BnplReserveBalanceBreakdownElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`BnplReserveBalanceBreakdownElementOptions`](#bnplreservebalancebreakdownelementoptions)) => void

### `close`

Emitted when the user closes the breakdown view.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`BnplReserveBalanceBreakdownElementSnapshot`](#bnplreservebalancebreakdownelementsnapshot)) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                                                                  | Description                                      |
| --------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`BnplReserveBalanceBreakdownElementOptions`](#bnplreservebalancebreakdownelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`BnplReserveBalanceBreakdownElementSnapshot`](#bnplreservebalancebreakdownelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### BnplReserveBalanceBreakdownElementOptions

Configuration options for the BnplReserveBalanceBreakdownElement.

| Property  | Type                                                                   | Required | Default | Description                                                                                                                                              |
| --------- | ---------------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onReady` | `((element: BnplReserveBalanceBreakdownElement) => void) \| undefined` | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                 |
| `onClose` | `((ev: CustomEvent) => void) \| undefined`                             | No       | -       | Callback fired when the user closes the breakdown view. By default, the element will unmount when closed. Call 'ev.preventDefault()' to keep it mounted. |

### BnplReserveBalanceBreakdownElementSnapshot

Represents the current state of the BnplReserveBalanceBreakdownElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# ChangeAccountCountryElement

Source: https://docs.whop.com/sdk/elements/change-account-country-element

A UI element that allows users to change the country associated with their payout account.

## Overview

A UI element that allows users to change the country associated with their payout account.

This element handles the complete flow for updating account country, including:

- Displaying available countries
- Validating the country selection
- Updating the account settings

Changing the account country may affect available payout methods and tax requirements.

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('change-account-country-element', {
  onCountryChanged: (ev) => {
    console.log('Country changed to:', ev.detail.country)
  },
})

// Mount it to a container
element.mount('#country-change-container')
```

### Using as a modal

```typescript theme={null}
// Show the element in a modal overlay
const modal = session.showChangeAccountCountryModal({
  onCountryChanged: (ev) => {
    console.log('New country:', ev.detail.country)
    // Element auto-unmounts by default
  },
  onClose: (ev) => {
    ev.preventDefault()
    modal.close()
  },
})
```

### Listening to events

```typescript theme={null}
const element = session.createElement('change-account-country-element', {})

element.on('ready', () => {
  console.log('Element loaded')
})

element.on('countryChanged', (ev) => {
  console.log('Country changed to:', ev.detail.country)
  // Optionally prevent auto-unmount
  // ev.preventDefault();
})

element.on('close', (ev) => {
  console.log('User cancelled the change')
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('change-account-country-element', {
  onReady: (element) => {
    console.log('Element is ready')
  },
  onCountryChanged: (ev) => {
    console.log('Country changed to:', ev.detail.country)
  },
  onClose: (ev) => {
    console.log('User cancelled')
  },
})
```

## Events

Events emitted by the ChangeAccountCountryElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `ChangeAccountCountryElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`ChangeAccountCountryElementOptions`](#changeaccountcountryelementoptions)) => void

### `close`

Emitted when the user closes the country selection without making a change.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`ChangeAccountCountryElementSnapshot`](#changeaccountcountryelementsnapshot)) => void

### `countryChanged`

Emitted when the user successfully changes their account country.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<\{ country: `string`; }>) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                                                    | Description                                      |
| --------- | --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`ChangeAccountCountryElementOptions`](#changeaccountcountryelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`ChangeAccountCountryElementSnapshot`](#changeaccountcountryelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### ChangeAccountCountryElementOptions

Configuration options for the ChangeAccountCountryElement.

| Property           | Type                                                             | Required | Default | Description                                                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onReady`          | `((element: ChangeAccountCountryElement) => void) \| undefined`  | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                                         |
| `onClose`          | `((ev: CustomEvent) => void) \| undefined`                       | No       | -       | Callback fired when the user closes the element without changing their country. By default, the element will unmount when closed. Call 'ev.preventDefault()' to keep it mounted. |
| `onCountryChanged` | `((ev: CustomEvent<{ country: string; }>) => void) \| undefined` | No       | -       | Callback fired when the user successfully changes their account country. By default, the element will unmount after the change. Call 'ev.preventDefault()' to keep it mounted.   |

### ChangeAccountCountryElementSnapshot

Represents the current state of the ChangeAccountCountryElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# GenerateWithdrawalReceiptElement

Source: https://docs.whop.com/sdk/elements/generate-withdrawal-receipt-element

A UI element that allows users to generate and request a receipt for a specific withdrawal.

## Overview

A UI element that allows users to generate and request a receipt for a specific withdrawal.

This element handles the receipt generation flow, including:

- Displaying withdrawal details
- Allowing the user to request a receipt
- Sending the receipt to the user's email

## Usage

### Basic usage

```typescript theme={null}
// Create the element with a specific withdrawal ID
const element = session.createElement('generate-withdrawal-receipt-element', {
  withdrawalId: 'withdrawal_abc123',
  onReceiptRequested: () => {
    console.log('Receipt sent to email!')
  },
})

// Mount it to a container
element.mount('#receipt-container')
```

### Using as a modal

```typescript theme={null}
// Show the element in a modal overlay
const modal = session.showGenerateWithdrawalReceiptModal({
  withdrawalId: 'withdrawal_abc123',
  onReceiptRequested: (ev) => {
    console.log('Receipt requested!')
    // Element auto-unmounts by default
  },
  onClose: (ev) => {
    ev.preventDefault()
    modal.close()
  },
})
```

### Listening to events

```typescript theme={null}
const element = session.createElement('generate-withdrawal-receipt-element', {
  withdrawalId: 'withdrawal_abc123',
})

element.on('ready', () => {
  console.log('Element loaded')
})

element.on('receiptRequested', (ev) => {
  console.log('Receipt requested!')
  ev.preventDefault() // Keep element mounted
  showSuccessMessage()
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('generate-withdrawal-receipt-element', {
  withdrawalId: 'withdrawal_abc123',
  onReady: (element) => {
    console.log('Receipt generator is ready')
  },
  onReceiptRequested: (ev) => {
    console.log('Receipt requested!')
  },
})
```

## Events

Events emitted by the GenerateWithdrawalReceiptElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `GenerateWithdrawalReceiptElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`GenerateWithdrawalReceiptElementOptions`](#generatewithdrawalreceiptelementoptions)) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`GenerateWithdrawalReceiptElementSnapshot`](#generatewithdrawalreceiptelementsnapshot)) => void

### `close`

Emitted when the user closes the receipt generator without requesting a receipt.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

### `receiptRequested`

Emitted when the user successfully requests a receipt for the withdrawal.
The receipt will be sent to the user's email address.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                                                              | Description                                      |
| --------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`GenerateWithdrawalReceiptElementOptions`](#generatewithdrawalreceiptelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`GenerateWithdrawalReceiptElementSnapshot`](#generatewithdrawalreceiptelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### GenerateWithdrawalReceiptElementOptions

Configuration options for the GenerateWithdrawalReceiptElement.

| Property             | Type                                                                 | Required | Default | Description                                                                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `withdrawalId`       | `string`                                                             | Yes      | -       | The ID of the withdrawal to generate a receipt for. This is required to identify which withdrawal the receipt should be generated for.                                                                                     |
| `onReady`            | `((element: GenerateWithdrawalReceiptElement) => void) \| undefined` | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                                                                                   |
| `onClose`            | `((ev: CustomEvent) => void) \| undefined`                           | No       | -       | Callback fired when the user closes the element without requesting a receipt. By default, the element will unmount when closed. Call 'ev.preventDefault()' to keep it mounted.                                             |
| `onReceiptRequested` | `((ev: CustomEvent) => void) \| undefined`                           | No       | -       | Callback fired when the user successfully requests a receipt. The receipt will be sent to the user's email address. By default, the element will unmount after the request. Call 'ev.preventDefault()' to keep it mounted. |

### GenerateWithdrawalReceiptElementSnapshot

Represents the current state of the GenerateWithdrawalReceiptElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# Create a payouts session

Source: https://docs.whop.com/sdk/elements/payouts-session

Manages authentication and creates payout elements.

## Overview

Manages authentication and creates payout elements.

The PayoutsSession handles token management, element creation, and provides
convenience methods for showing elements in modals.

## Examples

### Basic usage

```typescript theme={null}
const session = whopElements.createPayoutsSession({
  token: async () => {
    const response = await fetch('/api/token')
    const data = await response.json()
    return data.token
  },
  companyId: 'your-company-id',
  redirectUrl: 'https://yourapp.com/callback',
})

session.on('ready', () => {
  console.log('Session is ready')
})
```

### Creating elements

```typescript theme={null}
const balanceElement = session.createElement('balance-element', {})
balanceElement.mount('#balance-container')

const withdrawButton = session.createElement('withdraw-button-element', {
  onWithdraw: () => console.log('Withdrawal initiated'),
})
withdrawButton.mount('#withdraw-button')
```

### Using modal methods

```typescript theme={null}
// With options object
session.showWithdrawModal({
  onWithdraw: () => console.log('Withdrawal submitted'),
  onClose: () => console.log('Modal closed'),
})

// With callback for modal reference
session.showWithdrawModal((modal) => ({
  onWithdraw: () => {
    console.log('Withdrawal submitted')
    modal.close()
  },
  onClose: () => modal.close(),
}))
```

## Options

| Property      | Type                  | Required | Default | Description                                                                                                                                                                                                                                                                                                                                                                            |
| ------------- | --------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `token`       | `Token \| GetToken`   | Yes      | -       | The token to use for the session. If a function is provided, it will be called and awaited to get the token. When a function is provided, the token will be refreshed automatically before it expires. if a string is provided, it will be used as the token and not refreshed automatically. However you can update the token at runtime by calling 'updateOptions' with a new token. |
| `currency`    | `string \| undefined` | No       | "USD"   | The currency to use in the Elements                                                                                                                                                                                                                                                                                                                                                    |
| `companyId`   | `string`              | Yes      | -       | The company ID to use in the Elements                                                                                                                                                                                                                                                                                                                                                  |
| `redirectUrl` | `string`              | Yes      | -       | URL to redirect to after identity verification is completed. This must be an absolute URL (e.g., "[https://yourapp.com/callback](https://yourapp.com/callback)"). Localhost URLs will not work - use ngrok for local development.                                                                                                                                                      |

## Events

Events emitted by the PayoutsSession.

Listen to these events using the `on()` method.

### `optionsUpdated`

Emitted when the session options are updated via `updateOptions()`.

**Callback signature:** (options: `ExpandedPayoutsSessionOptions`) => void

### `tokenRefreshed`

Emitted when the authentication token is refreshed.

**Callback signature:** (token: `string`) => void

### `tokenRefreshError`

Emitted when token refresh fails.

**Callback signature:** (error: `unknown`) => void

### `error`

Emitted when an error occurs during session operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the session is ready and authenticated.

**Callback signature:** (`void`) => void

## Methods

### `createElement(type, options)`

Create a new element instance.

| Parameter | Type                           | Description                                                           |
| --------- | ------------------------------ | --------------------------------------------------------------------- |
| `type`    | T \| \{ type: T; }             | The element type (e.g., "balance-element", "withdraw-button-element") |
| `options` | PayoutsSessionElements\[T]\[0] | Element-specific configuration options                                |

**Returns:** `PayoutsSessionElements[T][1]`

```typescript theme={null}
const element = session.createElement('balance-element', {
  onReady: () => console.log('Element ready'),
})
element.mount('#container')
```

### `updateOptions(options)`

Update the session options after initialization.

Changes will be propagated to all active elements.

| Parameter | Type                            | Description                                      |
| --------- | ------------------------------- | ------------------------------------------------ |
| `options` | Partial\<PayoutsSessionOptions> | Partial options object with the values to update |

### `destroy()`

Destroy the session and clean up all mounted elements.

Call this when you no longer need the session to free up resources.

### Modal Methods

#### `showWithdrawModal(options, force)`

Show the withdraw element in a modal overlay.

| Parameter | Type                                                                                                                                                                                                | Description                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `options` | [`WithdrawElementOptions`](/sdk/elements/withdraw-element#withdrawelementoptions) \| ((modal: ModalContainer) => [`WithdrawElementOptions`](/sdk/elements/withdraw-element#withdrawelementoptions)) | Element options or a callback that receives the modal container |
| `force`   | Force \| undefined                                                                                                                                                                                  | -                                                               |

**Returns:** `Force extends true ? ModalContainer : ModalContainer | undefined`

#### `showAddPayoutMethodModal(options, force)`

Show the add payout method element in a modal overlay.

| Parameter | Type                                                                                                                                                                                                                                              | Description                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `options` | [`AddPayoutMethodElementOptions`](/sdk/elements/add-payout-method-element#addpayoutmethodelementoptions) \| ((modal: ModalContainer) => [`AddPayoutMethodElementOptions`](/sdk/elements/add-payout-method-element#addpayoutmethodelementoptions)) | Element options or a callback that receives the modal container |
| `force`   | Force \| undefined                                                                                                                                                                                                                                | -                                                               |

**Returns:** `Force extends true ? ModalContainer : ModalContainer | undefined`

#### `showAutomaticWithdrawModal(options, force)`

Show the automatic withdraw settings element in a modal overlay.

| Parameter | Type                                                                                                                                                                                                                                                        | Description                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `options` | [`AutomaticWithdrawElementOptions`](/sdk/elements/automatic-withdraw-element#automaticwithdrawelementoptions) \| ((modal: ModalContainer) => [`AutomaticWithdrawElementOptions`](/sdk/elements/automatic-withdraw-element#automaticwithdrawelementoptions)) | Element options or a callback that receives the modal container |
| `force`   | Force \| undefined                                                                                                                                                                                                                                          | -                                                               |

**Returns:** `Force extends true ? ModalContainer : ModalContainer | undefined`

#### `showVerifyModal(options, force)`

Show the identity verification element in a modal overlay.

| Parameter | Type                                                                                                                                                                                    | Description                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `options` | [`VerifyElementOptions`](/sdk/elements/verify-element#verifyelementoptions) \| ((modal: ModalContainer) => [`VerifyElementOptions`](/sdk/elements/verify-element#verifyelementoptions)) | Element options or a callback that receives the modal container |
| `force`   | Force \| undefined                                                                                                                                                                      | -                                                               |

**Returns:** `Force extends true ? ModalContainer : ModalContainer | undefined`

#### `showWithdrawalBreakdownModal(options, force)`

Show the withdrawal breakdown element in a modal overlay.

| Parameter | Type                                                                                                                                                                                                                                                                    | Description                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `options` | [`WithdrawalBreakdownElementOptions`](/sdk/elements/withdrawal-breakdown-element#withdrawalbreakdownelementoptions) \| ((modal: ModalContainer) => [`WithdrawalBreakdownElementOptions`](/sdk/elements/withdrawal-breakdown-element#withdrawalbreakdownelementoptions)) | Element options or a callback that receives the modal container |
| `force`   | Force \| undefined                                                                                                                                                                                                                                                      | -                                                               |

**Returns:** `Force extends true ? ModalContainer : ModalContainer | undefined`

#### `showChangeAccountCountryModal(options, force)`

Show the change account country element in a modal overlay.

| Parameter | Type                                                                                                                                                                                                                                                                            | Description                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `options` | [`ChangeAccountCountryElementOptions`](/sdk/elements/change-account-country-element#changeaccountcountryelementoptions) \| ((modal: ModalContainer) => [`ChangeAccountCountryElementOptions`](/sdk/elements/change-account-country-element#changeaccountcountryelementoptions)) | Element options or a callback that receives the modal container |
| `force`   | Force \| undefined                                                                                                                                                                                                                                                              | -                                                               |

**Returns:** `Force extends true ? ModalContainer : ModalContainer | undefined`

#### `showResetAccountModal(options, force)`

Show the reset account element in a modal overlay.

| Parameter | Type                                                                                                                                                                                                                          | Description                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `options` | [`ResetAccountElementOptions`](/sdk/elements/reset-account-element#resetaccountelementoptions) \| ((modal: ModalContainer) => [`ResetAccountElementOptions`](/sdk/elements/reset-account-element#resetaccountelementoptions)) | Element options or a callback that receives the modal container |
| `force`   | Force \| undefined                                                                                                                                                                                                            | -                                                               |

**Returns:** `Force extends true ? ModalContainer : ModalContainer | undefined`

#### `showTotalBalanceBreakdownModal(options, force)`

Show the total balance breakdown element in a modal overlay.

| Parameter | Type                                                                                                                                                                                                                                                                                  | Description                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `options` | [`TotalBalanceBreakdownElementOptions`](/sdk/elements/total-balance-breakdown-element#totalbalancebreakdownelementoptions) \| ((modal: ModalContainer) => [`TotalBalanceBreakdownElementOptions`](/sdk/elements/total-balance-breakdown-element#totalbalancebreakdownelementoptions)) | Element options or a callback that receives the modal container |
| `force`   | Force \| undefined                                                                                                                                                                                                                                                                    | -                                                               |

**Returns:** `Force extends true ? ModalContainer : ModalContainer | undefined`

#### `showRegularReserveBalanceBreakdownModal(options, force)`

Show the regular reserve balance breakdown element in a modal overlay.

| Parameter | Type                                                                                                                                                                                                                                                                                                                                          | Description                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `options` | [`RegularReserveBalanceBreakdownElementOptions`](/sdk/elements/regular-reserve-balance-breakdown-element#regularreservebalancebreakdownelementoptions) \| ((modal: ModalContainer) => [`RegularReserveBalanceBreakdownElementOptions`](/sdk/elements/regular-reserve-balance-breakdown-element#regularreservebalancebreakdownelementoptions)) | Element options or a callback that receives the modal container |
| `force`   | Force \| undefined                                                                                                                                                                                                                                                                                                                            | -                                                               |

**Returns:** `Force extends true ? ModalContainer : ModalContainer | undefined`

#### `showBnplReserveBalanceBreakdownModal(options, force)`

Show the BNPL reserve balance breakdown element in a modal overlay.

| Parameter | Type                                                                                                                                                                                                                                                                                                                        | Description                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `options` | [`BnplReserveBalanceBreakdownElementOptions`](/sdk/elements/bnpl-reserve-balance-breakdown-element#bnplreservebalancebreakdownelementoptions) \| ((modal: ModalContainer) => [`BnplReserveBalanceBreakdownElementOptions`](/sdk/elements/bnpl-reserve-balance-breakdown-element#bnplreservebalancebreakdownelementoptions)) | Element options or a callback that receives the modal container |
| `force`   | Force \| undefined                                                                                                                                                                                                                                                                                                          | -                                                               |

**Returns:** `Force extends true ? ModalContainer : ModalContainer | undefined`

#### `showGenerateWithdrawalReceiptModal(options, force)`

Show the generate withdrawal receipt element in a modal overlay.

| Parameter | Type                                                                                                                                                                                                                                                                                                          | Description                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `options` | [`GenerateWithdrawalReceiptElementOptions`](/sdk/elements/generate-withdrawal-receipt-element#generatewithdrawalreceiptelementoptions) \| ((modal: ModalContainer) => [`GenerateWithdrawalReceiptElementOptions`](/sdk/elements/generate-withdrawal-receipt-element#generatewithdrawalreceiptelementoptions)) | Element options or a callback that receives the modal container |
| `force`   | Force \| undefined                                                                                                                                                                                                                                                                                            | -                                                               |

**Returns:** `Force extends true ? ModalContainer : ModalContainer | undefined`

# RegularReserveBalanceBreakdownElement

Source: https://docs.whop.com/sdk/elements/regular-reserve-balance-breakdown-element

A UI element that displays a detailed breakdown of the regular reserve balance.

## Overview

A UI element that displays a detailed breakdown of the regular reserve balance.

This element shows how funds are allocated in the regular reserve, including:

- Total reserve amount
- Individual transaction holds
- Expected release dates for reserved funds

Regular reserves are funds held to cover potential refunds, chargebacks, or disputes from standard transactions.

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('regular-reserve-balance-breakdown-element', {
  onClose: () => {
    console.log('Breakdown closed')
  },
})

// Mount it to a container
element.mount('#reserve-breakdown-container')
```

### Using as a modal

```typescript theme={null}
// Show the breakdown in a modal overlay
const modal = session.showRegularReserveBalanceBreakdownModal({
  onClose: (ev) => {
    ev.preventDefault()
    modal.close()
  },
})
```

### Listening to events

```typescript theme={null}
const element = session.createElement('regular-reserve-balance-breakdown-element', {})

element.on('ready', () => {
  console.log('Breakdown loaded')
})

element.on('close', (ev) => {
  console.log('User closed the breakdown')
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('regular-reserve-balance-breakdown-element', {
  onReady: (element) => {
    console.log('Breakdown is ready')
  },
  onClose: (ev) => {
    console.log('User closed the breakdown')
  },
})
```

## Events

Events emitted by the RegularReserveBalanceBreakdownElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `RegularReserveBalanceBreakdownElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`RegularReserveBalanceBreakdownElementOptions`](#regularreservebalancebreakdownelementoptions)) => void

### `close`

Emitted when the user closes the breakdown view.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`RegularReserveBalanceBreakdownElementSnapshot`](#regularreservebalancebreakdownelementsnapshot)) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                                                                        | Description                                      |
| --------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`RegularReserveBalanceBreakdownElementOptions`](#regularreservebalancebreakdownelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`RegularReserveBalanceBreakdownElementSnapshot`](#regularreservebalancebreakdownelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### RegularReserveBalanceBreakdownElementOptions

Configuration options for the RegularReserveBalanceBreakdownElement.

| Property  | Type                                                                      | Required | Default | Description                                                                                                                                              |
| --------- | ------------------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onReady` | `((element: RegularReserveBalanceBreakdownElement) => void) \| undefined` | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                 |
| `onClose` | `((ev: CustomEvent) => void) \| undefined`                                | No       | -       | Callback fired when the user closes the breakdown view. By default, the element will unmount when closed. Call 'ev.preventDefault()' to keep it mounted. |

### RegularReserveBalanceBreakdownElementSnapshot

Represents the current state of the RegularReserveBalanceBreakdownElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# ResetAccountElement

Source: https://docs.whop.com/sdk/elements/reset-account-element

A UI element that allows users to reset their payout account.

## Overview

A UI element that allows users to reset their payout account.

This element handles the account reset flow, including:

- Displaying reset confirmation
- Warning about consequences of resetting
- Processing the reset request

Resetting an account will clear all payout methods and may require re-verification.
This action cannot be undone.

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('reset-account-element', {
  onReset: () => {
    console.log('Account reset successfully!')
  },
})

// Mount it to a container
element.mount('#reset-account-container')
```

### Using as a modal

```typescript theme={null}
// Show the element in a modal overlay
const modal = session.showResetAccountModal({
  onReset: (ev) => {
    console.log('Account reset!')
    // Element auto-unmounts by default
  },
  onClose: (ev) => {
    ev.preventDefault()
    modal.close()
  },
})
```

### Listening to events

```typescript theme={null}
const element = session.createElement('reset-account-element', {})

element.on('ready', () => {
  console.log('Element loaded')
})

element.on('reset', (ev) => {
  console.log('Account reset confirmed!')
})

element.on('close', (ev) => {
  console.log('User cancelled the reset')
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('reset-account-element', {
  onReady: (element) => {
    console.log('Element is ready')
  },
  onReset: (ev) => {
    console.log('Account has been reset!')
  },
  onClose: (ev) => {
    console.log('User cancelled the reset')
  },
})
```

## Events

Events emitted by the ResetAccountElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `ResetAccountElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`ResetAccountElementOptions`](#resetaccountelementoptions)) => void

### `close`

Emitted when the user closes the reset confirmation without resetting.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`ResetAccountElementSnapshot`](#resetaccountelementsnapshot)) => void

### `reset`

Emitted when the user confirms and successfully resets their payout account.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                                    | Description                                      |
| --------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`ResetAccountElementOptions`](#resetaccountelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`ResetAccountElementSnapshot`](#resetaccountelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### ResetAccountElementOptions

Configuration options for the ResetAccountElement.

| Property  | Type                                                    | Required | Default | Description                                                                                                                                                                              |
| --------- | ------------------------------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onReady` | `((element: ResetAccountElement) => void) \| undefined` | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                                                 |
| `onClose` | `((ev: CustomEvent) => void) \| undefined`              | No       | -       | Callback fired when the user closes the element without resetting their account. By default, the element will unmount when closed. Call 'ev.preventDefault()' to keep it mounted.        |
| `onReset` | `((ev: CustomEvent) => void) \| undefined`              | No       | -       | Callback fired when the user confirms and successfully resets their payout account. By default, the element will unmount after the reset. Call 'ev.preventDefault()' to keep it mounted. |

### ResetAccountElementSnapshot

Represents the current state of the ResetAccountElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# StatusBannerElement

Source: https://docs.whop.com/sdk/elements/status-banner-element

A UI element that displays a status banner indicating the user's account verification and compliance status.

## Overview

A UI element that displays a status banner indicating the user's account verification and compliance status.

This element automatically shows relevant banners based on the account status:

- KYC (Know Your Customer) verification status
- Compliance requirements
- Information requests
- Review status

The banner includes actionable buttons that open verification flows when clicked.

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('status-banner-element', {
  onReady: () => {
    console.log('Status banner loaded')
  },
})

// Mount it to a container
element.mount('#status-banner-container')
```

### Custom verify click handling

```typescript theme={null}
const element = session.createElement('status-banner-element', {
  onVerifyClick: (ev) => {
    // Prevent default verify modal
    ev.preventDefault()
    // Show your own verification UI
    showCustomVerificationFlow()
  },
})

element.mount('#status-banner-container')
```

### Listening to banner changes

```typescript theme={null}
const element = session.createElement('status-banner-element', {})

element.on('bannerChange', (ev, bannerType) => {
  if (bannerType === 'kyc-success') {
    showSuccessNotification('Verification complete!')
  } else if (bannerType === null) {
    console.log('No issues - account in good standing')
  }
})

element.on('snapshot', (snapshot) => {
  console.log('Current banner type:', snapshot.bannerType)
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('status-banner-element', {
  onReady: (element) => {
    console.log('Status banner is ready')
  },
  onVerifyClick: (ev) => {
    // Custom verification flow
    ev.preventDefault()
    openCustomVerificationModal()
  },
  onBannerChange: (ev, bannerType) => {
    console.log('Banner changed to:', bannerType)
  },
})
```

## Events

Events emitted by the StatusBannerElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `StatusBannerElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`StatusBannerElementOptions`](#statusbannerelementoptions)) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`StatusBannerElementSnapshot`](#statusbannerelementsnapshot)) => void

### `verifyClick`

Emitted when the user clicks the verify button on the banner.
By default, opens the verification modal. Call `ev.preventDefault()` to handle this yourself.

**Callback signature:** (ev: `CustomEvent`\<`StatusBannerElement`>) => void

### `bannerChange`

Emitted when the banner type changes (e.g., after verification status updates).

**Callback signature:** (ev: `CustomEvent`\<`StatusBannerElement`>, bannerType: `StatusBannerType`) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                                    | Description                                      |
| --------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`StatusBannerElementOptions`](#statusbannerelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`StatusBannerElementSnapshot`](#statusbannerelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### StatusBannerElementOptions

Configuration options for the StatusBannerElement.

| Property         | Type                                                                                          | Required | Default | Description                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `onReady`        | `((element: StatusBannerElement) => void) \| undefined`                                       | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                           |
| `onVerifyClick`  | `((ev: CustomEvent<StatusBannerElement>) => void) \| undefined`                               | No       | -       | Callback fired when the user clicks the verify button on the banner. By default, opens the verification modal. Call 'ev.preventDefault()' to handle this yourself. |
| `onBannerChange` | `((ev: CustomEvent<StatusBannerElement>, bannerType: StatusBannerType) => void) \| undefined` | No       | -       | Callback fired when the banner type changes (e.g., after verification status updates).                                                                             |

### StatusBannerElementSnapshot

Represents the current state of the StatusBannerElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property     | Type                   | Required | Default | Description                                                                                                                                                                          |
| ------------ | ---------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `state`      | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive                                      |
| `bannerType` | `StatusBannerType`     | Yes      | -       | The type of banner currently being displayed. This indicates the user's current verification/compliance status. Will be 'null' if no banner is needed (account is in good standing). |

# TotalBalanceBreakdownElement

Source: https://docs.whop.com/sdk/elements/total-balance-breakdown-element

A UI element that displays a detailed breakdown of the user's total available balance.

## Overview

A UI element that displays a detailed breakdown of the user's total available balance.

This element shows how the total balance is composed, including:

- Available balance (funds ready for withdrawal)
- Pending transactions
- Expected deposits
- Any holds or adjustments

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('total-balance-breakdown-element', {
  onClose: () => {
    console.log('Breakdown closed')
  },
})

// Mount it to a container
element.mount('#balance-breakdown-container')
```

### Using as a modal

```typescript theme={null}
// Show the breakdown in a modal overlay
const modal = session.showTotalBalanceBreakdownModal({
  onClose: (ev) => {
    ev.preventDefault()
    modal.close()
  },
})
```

### Listening to events

```typescript theme={null}
const element = session.createElement('total-balance-breakdown-element', {})

element.on('ready', () => {
  console.log('Breakdown loaded')
})

element.on('close', (ev) => {
  console.log('User closed the breakdown')
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('total-balance-breakdown-element', {
  onReady: (element) => {
    console.log('Breakdown is ready')
  },
  onClose: (ev) => {
    console.log('User closed the breakdown')
  },
})
```

## Events

Events emitted by the TotalBalanceBreakdownElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `TotalBalanceBreakdownElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`TotalBalanceBreakdownElementOptions`](#totalbalancebreakdownelementoptions)) => void

### `close`

Emitted when the user closes the breakdown view.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`TotalBalanceBreakdownElementSnapshot`](#totalbalancebreakdownelementsnapshot)) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                                                      | Description                                      |
| --------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`TotalBalanceBreakdownElementOptions`](#totalbalancebreakdownelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`TotalBalanceBreakdownElementSnapshot`](#totalbalancebreakdownelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### TotalBalanceBreakdownElementOptions

Configuration options for the TotalBalanceBreakdownElement.

| Property  | Type                                                             | Required | Default | Description                                                                                                                                              |
| --------- | ---------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onReady` | `((element: TotalBalanceBreakdownElement) => void) \| undefined` | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                 |
| `onClose` | `((ev: CustomEvent) => void) \| undefined`                       | No       | -       | Callback fired when the user closes the breakdown view. By default, the element will unmount when closed. Call 'ev.preventDefault()' to keep it mounted. |

### TotalBalanceBreakdownElementSnapshot

Represents the current state of the TotalBalanceBreakdownElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# Types

Source: https://docs.whop.com/sdk/elements/types

Shared type definitions for Whop embedded components

## Overview

This page documents the shared types used across Whop embedded components.

## EmbeddableElement

| Property  | Type                                             | Required | Default | Description |
| --------- | ------------------------------------------------ | -------- | ------- | ----------- |
| `mount`   | `(element: HTMLElement \| '#${string}') => void` | Yes      | -       | -           |
| `unmount` | `() => void`                                     | Yes      | -       | -           |

## CSSValue

A CSS property value.

```typescript theme={null}
type CSSValue = string
```

## CSSProps

A record of CSS properties and their values.

```typescript theme={null}
type CSSProps = { [x: string]: string }
```

## Classes

A record of CSS class names to their style definitions.

```typescript theme={null}
type Classes = { [x: string]: CSSProps }
```

## Variables

CSS custom properties (variables) that can be used to customize element styles.
Keys must start with `--` prefix.

```typescript theme={null}
type Variables = { [x: `--${string}`]: string }
```

## AccentColor

Available accent colors for theming elements.

These colors are used for primary UI elements like buttons, links, and highlights.

```typescript theme={null}
type AccentColor =
  | 'ruby'
  | 'blue'
  | 'red'
  | 'yellow'
  | 'green'
  | 'gray'
  | 'tomato'
  | 'crimson'
  | 'pink'
  | 'plum'
  | 'purple'
  | 'violet'
  | 'iris'
  | 'cyan'
  | 'teal'
  | 'jade'
  | 'grass'
  | 'brown'
  | 'orange'
  | 'indigo'
  | 'sky'
  | 'mint'
  | 'amber'
  | 'lime'
  | 'lemon'
  | 'magenta'
  | 'gold'
  | 'bronze'
```

## Theme

Theme configuration for customizing the visual appearance of elements.

```typescript theme={null}
const theme: Theme = {
  appearance: 'dark',
  accentColor: 'blue',
  grayColor: 'slate',
}
```

| Property       | Type                                                                                 | Required | Default | Description                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `appearance`   | `"light" \| "dark" \| undefined`                                                     | No       | -       | The color scheme to use. - '"light"' - Light mode with dark text on light backgrounds - '"dark"' - Dark mode with light text on dark backgrounds |
| `accentColor`  | [`AccentColor`](#accentcolor) \| undefined                                           | No       | -       | The primary accent color used for interactive elements.                                                                                          |
| `grayColor`    | `"gray" \| "mauve" \| "slate" \| "sage" \| "olive" \| "sand" \| "auto" \| undefined` | No       | -       | The gray color palette to use for neutral elements. Use '"auto"' to automatically match the accent color.                                        |
| `dangerColor`  | `"ruby" \| "red" \| "tomato" \| undefined`                                           | No       | -       | The color used for error states and destructive actions.                                                                                         |
| `warningColor` | `"yellow" \| "amber" \| undefined`                                                   | No       | -       | The color used for warning states.                                                                                                               |
| `successColor` | `"green" \| "teal" \| "jade" \| "grass" \| undefined`                                | No       | -       | The color used for success states.                                                                                                               |
| `infoColor`    | `"blue" \| "sky" \| undefined`                                                       | No       | -       | The color used for informational states.                                                                                                         |

## Appearance

Configuration for customizing the visual appearance of Whop elements.

Use this to match the embedded components to your application's design.

```typescript theme={null}
const appearance: Appearance = {
  theme: {
    appearance: 'dark',
    accentColor: 'blue',
  },
}

const whopElements = new WhopElements({ appearance })
```

| Property    | Type                                           | Required | Default | Description                                       |
| ----------- | ---------------------------------------------- | -------- | ------- | ------------------------------------------------- |
| `variables` | [`Variables`](#variables) \| null \| undefined | No       | -       | CSS custom properties to override default styles. |
| `classes`   | [`Classes`](#classes) \| null \| undefined     | No       | -       | Custom CSS classes to apply to elements.          |
| `theme`     | [`Theme`](#theme) \| null \| undefined         | No       | -       | Theme settings for colors and appearance mode.    |

## WhopElementsEnvironment

The environment to use for API calls.

- `"production"` - Use the live production API
- `"sandbox"` - Use the sandbox API for testing

```typescript theme={null}
type WhopElementsEnvironment = 'production' | 'sandbox'
```

## WhopElementsOptions

Configuration options for initializing WhopElements.

```typescript theme={null}
const whopElements = new WhopElements({
  appearance: {
    theme: { appearance: 'light' },
  },
  locale: 'en',
  environment: 'production',
})
```

| Property      | Type                                                               | Required | Default      | Description                                                                                                             |
| ------------- | ------------------------------------------------------------------ | -------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `appearance`  | [`Appearance`](#appearance) \| undefined                           | No       | -            | Customize the appearance of the Whop embedded Elements. Includes theme settings like light/dark mode and accent colors. |
| `locale`      | `"en" \| undefined`                                                | No       | "en"         | The locale to use for all Elements. Controls the language and formatting of text, dates, and numbers.                   |
| `environment` | [`WhopElementsEnvironment`](#whopelementsenvironment) \| undefined | No       | "production" | The environment to use for API calls. Use '"sandbox"' for testing without affecting production data.                    |

# VerifyElement

Source: https://docs.whop.com/sdk/elements/verify-element

A UI element that guides users through identity verification (KYC) and compliance requirements.

## Overview

A UI element that guides users through identity verification (KYC) and compliance requirements.

This element handles the complete verification flow, including:

- Collecting personal information
- Document upload and verification
- Identity verification checks
- Compliance questionnaires

The verification process is required before users can withdraw funds.

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('verify-element', {
  onVerificationSubmitted: () => {
    console.log('Verification submitted!')
  },
})

// Mount it to a container
element.mount('#verify-container')
```

### Using as a modal

```typescript theme={null}
// Show the element in a modal overlay
const modal = session.showVerifyModal({
  onVerificationSubmitted: (ev) => {
    console.log('Verification complete!')
    // Element auto-unmounts by default
  },
  onClose: (ev) => {
    ev.preventDefault()
    modal.close()
  },
})
```

### Inline with controls

```typescript theme={null}
// Embed the element with its own navigation controls
const element = session.createElement('verify-element', {
  includeControls: true,
  onVerificationSubmitted: (ev) => {
    ev.preventDefault() // Keep mounted
    showSuccessMessage()
  },
})

element.mount('#verification-section')
```

### Listening to events

```typescript theme={null}
const element = session.createElement('verify-element', {})

element.on('ready', () => {
  console.log('Verification form loaded')
})

element.on('verificationSubmitted', (ev) => {
  console.log('Verification submitted!')
})

element.on('close', (ev) => {
  console.log('User closed the form')
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('verify-element', {
  includeControls: true,
  onReady: (element) => {
    console.log('Verification form is ready')
  },
  onVerificationSubmitted: (ev) => {
    console.log('Verification submitted!')
  },
  onClose: (ev) => {
    console.log('User closed the form')
  },
})
```

## Events

Events emitted by the VerifyElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `VerifyElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`VerifyElementOptions`](#verifyelementoptions)) => void

### `close`

Emitted when the user closes the verification form without completing it.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`VerifyElementSnapshot`](#verifyelementsnapshot)) => void

### `verificationSubmitted`

Emitted when the user successfully submits their verification information.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`VerifyElement`>) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                        | Description                                      |
| --------- | ----------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`VerifyElementOptions`](#verifyelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`VerifyElementSnapshot`](#verifyelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### VerifyElementOptions

Configuration options for the VerifyElement.

| Property                  | Type                                                      | Required | Default | Description                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `includeControls`         | `boolean \| undefined`                                    | No       | false   | Whether to include navigation controls (back/close buttons) in the element. Set to 'true' when embedding the element inline, or 'false' when using in a modal that provides its own controls. |
| `onReady`                 | `((element: VerifyElement) => void) \| undefined`         | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                                                      |
| `onVerificationSubmitted` | `((ev: CustomEvent<VerifyElement>) => void) \| undefined` | No       | -       | Callback fired when the user successfully submits their verification information. By default, the element will unmount after submission. Call 'ev.preventDefault()' to keep it mounted.       |
| `onClose`                 | `((ev: CustomEvent) => void) \| undefined`                | No       | -       | Callback fired when the user closes the verification form without completing it. By default, the element will unmount when closed. Call 'ev.preventDefault()' to keep it mounted.             |

### VerifyElementSnapshot

Represents the current state of the VerifyElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# Getting Started

Source: https://docs.whop.com/sdk/elements/whop-elements

The main entry point for Whop embedded components.

## Overview

The main entry point for Whop embedded components.

WhopElements is the root object that manages configuration and creates sessions
for different element types. Initialize it once and use it to create sessions
for payouts, payments, and other embedded experiences.

## Installation

<CodeGroup>
  ```bash React theme={null}
  npm install @whop/embedded-components-vanilla-js @whop/embedded-components-react-js
  ```

```bash Vanilla JS theme={null}
npm install @whop/embedded-components-vanilla-js
```

</CodeGroup>

## Examples

### Basic initialization

```typescript theme={null}
import WhopElements from '@whop/embeddable-components'

const whopElements = new WhopElements({
  appearance: {
    theme: { appearance: 'light' },
  },
  locale: 'en',
})
```

### Creating a payouts session

```typescript theme={null}
const session = whopElements.createPayoutsSession({
  token: async () => {
    // Fetch token from your backend
    const response = await fetch('/api/payouts-token')
    const data = await response.json()
    return data.token
  },
  companyId: 'your-company-id',
  redirectUrl: 'https://yourapp.com/callback',
})

// Create and mount an element
const element = session.createElement('balance-element', {})
element.mount('#balance-container')
```

### Updating options after initialization

```typescript theme={null}
// Switch to dark mode
whopElements.updateOptions({
  appearance: {
    theme: { appearance: 'dark' },
  },
})
```

### Listening to option changes

```typescript theme={null}
whopElements.on('optionsUpdated', (options) => {
  console.log('Options changed:', options)
})
```

## Options

| Property      | Type                                                                                  | Required | Default      | Description                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------- | -------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `appearance`  | [`Appearance`](/sdk/elements/types#appearance) \| undefined                           | No       | -            | Customize the appearance of the Whop embedded Elements. Includes theme settings like light/dark mode and accent colors. |
| `locale`      | `"en" \| undefined`                                                                   | No       | "en"         | The locale to use for all Elements. Controls the language and formatting of text, dates, and numbers.                   |
| `environment` | [`WhopElementsEnvironment`](/sdk/elements/types#whopelementsenvironment) \| undefined | No       | "production" | The environment to use for API calls. Use '"sandbox"' for testing without affecting production data.                    |

## Events

Events emitted by WhopElements.

Listen to these events using the `on()` method.

### `optionsUpdated`

Emitted when the WhopElements options are updated via `updateOptions()`.

**Callback signature:** (options: [`WhopElementsOptions`](/sdk/elements/types#whopelementsoptions)) => void

## Methods

### `createPayoutsSession(options)`

Create a new payouts session for managing payout elements.

The session handles authentication and provides methods to create
payout-related elements like balance displays, withdrawal forms, and more.

| Parameter | Type                    | Description                                   |
| --------- | ----------------------- | --------------------------------------------- |
| `options` | `PayoutsSessionOptions` | Configuration options for the payouts session |

**Returns:** [`PayoutsSession`](/sdk/elements/payouts-session)

### `createChatSession(options)`

Create a new chat session for managing chat elements.

| Parameter | Type                 | Description                                |
| --------- | -------------------- | ------------------------------------------ |
| `options` | `ChatSessionOptions` | Configuration options for the chat session |

**Returns:** [`ChatSession`](/sdk/elements/chat-session)

### `updateOptions(options)`

Update the WhopElements configuration after initialization.

Changes will be propagated to all active sessions and elements.
Only the provided options will be updated; others remain unchanged.

| Parameter | Type                                                                       | Description                                      |
| --------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | Partial\<[`WhopElementsOptions`](/sdk/elements/types#whopelementsoptions)> | Partial options object with the values to update |

## Related Types

- [WhopElementsOptions](/sdk/elements/types#whopelementsoptions)
- [WhopElementsEnvironment](/sdk/elements/types#whopelementsenvironment)
- [Appearance](/sdk/elements/types#appearance)
- [Theme](/sdk/elements/types#theme)
- [AccentColor](/sdk/elements/types#accentcolor)

# WithdrawButtonElement

Source: https://docs.whop.com/sdk/elements/withdraw-button-element

A UI element that renders a button for initiating withdrawals.

## Overview

A UI element that renders a button for initiating withdrawals.

This element provides a convenient one-click withdrawal experience:

- Shows current available balance
- Automatically handles verification if required
- Opens withdrawal modal when clicked
- Supports customizable styling

The button intelligently routes users to verification or withdrawal based on their account status.

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('withdraw-button-element', {
  onWithdrawalRequested: () => {
    console.log('Withdrawal initiated!')
  },
})

// Mount it to a container
element.mount('#withdraw-button-container')
```

### Customized button

```typescript theme={null}
const element = session.createElement('withdraw-button-element', {
  size: '4',
  variant: 'solid',
  highContrast: true,
  onWithdrawalRequested: (ev) => {
    console.log('Withdrawal requested!')
  },
})

element.mount('#withdraw-button-container')
```

### Handling verification

```typescript theme={null}
const element = session.createElement('withdraw-button-element', {
  onVerificationSubmitted: (ev) => {
    console.log('User completed verification!')
  },
  onWithdrawalRequested: (ev) => {
    console.log('Withdrawal requested!')
  },
})

// Custom verify handling
element.on('verify', (ev) => {
  ev.preventDefault() // Handle verification yourself
  showCustomVerificationFlow()
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('withdraw-button-element', {
  size: '3',
  variant: 'solid',
  onReady: (element) => {
    console.log('Button is ready')
  },
  onWithdrawalRequested: (ev) => {
    console.log('Withdrawal requested!')
  },
})
```

## Events

Events emitted by the WithdrawButtonElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `WithdrawButtonElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`WithdrawButtonElementOptions`](#withdrawbuttonelementoptions)) => void

### `verify`

Emitted when the user clicks the button and needs to verify their identity first.
By default, opens the verification modal. Call `ev.preventDefault()` to handle this yourself.

**Callback signature:** (ev: `CustomEvent`\<`WithdrawButtonElement`>) => void

### `withdraw`

Emitted when the user clicks the button to initiate a withdrawal.
By default, opens the withdrawal modal. Call `ev.preventDefault()` to handle this yourself.

**Callback signature:** (ev: `CustomEvent`\<`WithdrawButtonElement`>) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`WithdrawButtonElementSnapshot`](#withdrawbuttonelementsnapshot)) => void

### `verificationSubmitted`

Emitted when the user successfully submits verification through the modal opened by this button.

**Callback signature:** (ev: `CustomEvent`\<`WithdrawButtonElement`>) => void

### `withdrawalRequested`

Emitted when the user successfully requests a withdrawal through the modal opened by this button.

**Callback signature:** (ev: `CustomEvent`\<`WithdrawButtonElement`>) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                                        | Description                                      |
| --------- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`WithdrawButtonElementOptions`](#withdrawbuttonelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`WithdrawButtonElementSnapshot`](#withdrawbuttonelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### WithdrawButtonElementOptions

Configuration options for the WithdrawButtonElement.

| Property                  | Type                                                                  | Required | Default | Description                                                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hidePendingBalance`      | `boolean \| undefined`                                                | No       | false   | Whether to hide the pending balance from the button display.                                                                                                                                                 |
| `onReady`                 | `((element: WithdrawButtonElement) => void) \| undefined`             | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                                                                     |
| `onVerificationSubmitted` | `((ev: CustomEvent<WithdrawButtonElement>) => void) \| undefined`     | No       | -       | Callback fired when the user successfully submits verification through this button's flow.                                                                                                                   |
| `onWithdrawalRequested`   | `((ev: CustomEvent<WithdrawButtonElement>) => void) \| undefined`     | No       | -       | Callback fired when the user successfully requests a withdrawal through this button's flow.                                                                                                                  |
| `size`                    | `"1" \| "2" \| "3" \| "4" \| undefined`                               | No       | -       | The size of the button. - '"1"' - Extra small - '"2"' - Small - '"3"' - Medium (default) - '"4"' - Large                                                                                                     |
| `variant`                 | `"solid" \| "soft" \| "surface" \| "ghost" \| "classic" \| undefined` | No       | -       | The visual variant of the button. - '"solid"' - Filled background - '"soft"' - Subtle background - '"surface"' - Surface-level emphasis - '"ghost"' - No background - '"classic"' - Traditional button style |
| `color`                   | `AccentColor \| undefined`                                            | No       | -       | The accent color for the button.                                                                                                                                                                             |
| `highContrast`            | `boolean \| undefined`                                                | No       | false   | Whether to use high contrast mode for better accessibility.                                                                                                                                                  |

### WithdrawButtonElementSnapshot

Represents the current state of the WithdrawButtonElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# WithdrawElement

Source: https://docs.whop.com/sdk/elements/withdraw-element

A UI element that provides a complete withdrawal form for users to request fund transfers.

## Overview

A UI element that provides a complete withdrawal form for users to request fund transfers.

This element handles the full withdrawal flow, including:

- Displaying available balance
- Selecting withdrawal amount
- Choosing payout method
- Confirming and submitting the withdrawal request

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('withdraw-element', {
  onWithdraw: () => {
    console.log('Withdrawal submitted!')
  },
})

// Mount it to a container
element.mount('#withdraw-container')
```

### Using as a modal

```typescript theme={null}
// Show the withdrawal form in a modal overlay
const modal = session.showWithdrawModal({
  onWithdraw: (ev) => {
    console.log('Withdrawal submitted!')
    // Element auto-unmounts by default
  },
  onClose: (ev) => {
    ev.preventDefault()
    modal.close()
  },
})
```

### Listening to events

```typescript theme={null}
const element = session.createElement('withdraw-element', {})

element.on('ready', () => {
  console.log('Form loaded')
})

element.on('withdraw', (ev) => {
  console.log('Withdrawal submitted!')
  ev.preventDefault() // Keep mounted
  showSuccessMessage()
})

element.on('close', (ev) => {
  console.log('User cancelled')
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('withdraw-element', {
  onReady: (element) => {
    console.log('Withdrawal form is ready')
  },
  onWithdraw: (ev) => {
    console.log('Withdrawal requested!')
  },
  onClose: (ev) => {
    console.log('User cancelled')
  },
})
```

## Events

Events emitted by the WithdrawElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `WithdrawElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`WithdrawElementOptions`](#withdrawelementoptions)) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`WithdrawElementSnapshot`](#withdrawelementsnapshot)) => void

### `close`

Emitted when the user closes the withdrawal form without completing it.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

### `withdraw`

Emitted when the user successfully submits a withdrawal request.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                            | Description                                      |
| --------- | --------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`WithdrawElementOptions`](#withdrawelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`WithdrawElementSnapshot`](#withdrawelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### WithdrawElementOptions

Configuration options for the WithdrawElement.

| Property     | Type                                                | Required | Default | Description                                                                                                                                                                     |
| ------------ | --------------------------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onReady`    | `((element: WithdrawElement) => void) \| undefined` | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                                        |
| `onWithdraw` | `((ev: CustomEvent) => void) \| undefined`          | No       | -       | Callback fired when the user successfully submits a withdrawal request. By default, the element will unmount after the request. Call 'ev.preventDefault()' to keep it mounted.  |
| `onClose`    | `((ev: CustomEvent) => void) \| undefined`          | No       | -       | Callback fired when the user closes the withdrawal form without completing it. By default, the element will unmount when closed. Call 'ev.preventDefault()' to keep it mounted. |

### WithdrawElementSnapshot

Represents the current state of the WithdrawElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# WithdrawalBreakdownElement

Source: https://docs.whop.com/sdk/elements/withdrawal-breakdown-element

A UI element that displays a detailed breakdown of a specific withdrawal.

## Overview

A UI element that displays a detailed breakdown of a specific withdrawal.

This element shows comprehensive information about a withdrawal, including:

- Withdrawal amount
- Fees and deductions
- Destination payout method
- Status and timeline
- Transaction details

## Usage

### Basic usage

```typescript theme={null}
// Create the element with a specific withdrawal ID
const element = session.createElement('withdrawal-breakdown-element', {
  withdrawalId: 'withdrawal_abc123',
  onClose: () => {
    console.log('Breakdown closed')
  },
})

// Mount it to a container
element.mount('#withdrawal-breakdown-container')
```

### Using as a modal

```typescript theme={null}
// Show the breakdown in a modal overlay
const modal = session.showWithdrawalBreakdownModal({
  withdrawalId: 'withdrawal_abc123',
  onClose: (ev) => {
    ev.preventDefault()
    modal.close()
  },
})
```

### Listening to events

```typescript theme={null}
const element = session.createElement('withdrawal-breakdown-element', {
  withdrawalId: 'withdrawal_abc123',
})

element.on('ready', () => {
  console.log('Breakdown loaded')
})

element.on('close', (ev) => {
  console.log('User closed the breakdown')
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('withdrawal-breakdown-element', {
  withdrawalId: 'withdrawal_abc123',
  onReady: (element) => {
    console.log('Breakdown is ready')
  },
  onClose: (ev) => {
    console.log('User closed the breakdown')
  },
})
```

## Events

Events emitted by the WithdrawalBreakdownElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `WithdrawalBreakdownElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`WithdrawalBreakdownElementOptions`](#withdrawalbreakdownelementoptions)) => void

### `close`

Emitted when the user closes the breakdown view.
Call `ev.preventDefault()` to prevent the element from automatically unmounting.

**Callback signature:** (ev: `CustomEvent`\<`any`>) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`WithdrawalBreakdownElementSnapshot`](#withdrawalbreakdownelementsnapshot)) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                                                  | Description                                      |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`WithdrawalBreakdownElementOptions`](#withdrawalbreakdownelementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`WithdrawalBreakdownElementSnapshot`](#withdrawalbreakdownelementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### WithdrawalBreakdownElementOptions

Configuration options for the WithdrawalBreakdownElement.

| Property       | Type                                                           | Required | Default | Description                                                                                                                                              |
| -------------- | -------------------------------------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `withdrawalId` | `string`                                                       | Yes      | -       | The ID of the withdrawal to show the breakdown for. This is required to identify which withdrawal's details to display.                                  |
| `onReady`      | `((element: WithdrawalBreakdownElement) => void) \| undefined` | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event.                 |
| `onClose`      | `((ev: CustomEvent) => void) \| undefined`                     | No       | -       | Callback fired when the user closes the breakdown view. By default, the element will unmount when closed. Call 'ev.preventDefault()' to keep it mounted. |

### WithdrawalBreakdownElementSnapshot

Represents the current state of the WithdrawalBreakdownElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# WithdrawalsElement

Source: https://docs.whop.com/sdk/elements/withdrawals-element

A UI element that displays a list of the user's past withdrawals.

## Overview

A UI element that displays a list of the user's past withdrawals.

This element provides a comprehensive view of withdrawal history, including:

- List of all withdrawals with status, amount, and date
- Ability to view detailed breakdown for each withdrawal
- Option to generate receipts for completed withdrawals
- Pagination for large withdrawal histories

## Usage

### Basic usage

```typescript theme={null}
// Create the element
const element = session.createElement('withdrawals-element', {
  onReady: () => {
    console.log('Withdrawals list loaded')
  },
})

// Mount it to a container
element.mount('#withdrawals-container')
```

### Custom breakdown handling

```typescript theme={null}
const element = session.createElement('withdrawals-element', {})

element.on('showWithdrawalBreakdown', (ev) => {
  // Prevent default modal
  ev.preventDefault()
  // Show your own breakdown UI
  showCustomBreakdown(ev.detail.withdrawalId)
})

element.on('showGenerateWithdrawalReceipt', (ev) => {
  // Prevent default modal
  ev.preventDefault()
  // Handle receipt generation yourself
  generateReceipt(ev.detail.withdrawalId)
})

element.mount('#withdrawals-container')
```

### Listening to events

```typescript theme={null}
const element = session.createElement('withdrawals-element', {})

element.on('ready', () => {
  console.log('Withdrawals list loaded')
})

element.on('showWithdrawalBreakdown', (ev) => {
  console.log('User viewing withdrawal:', ev.detail.withdrawalId)
  // Let default modal open
})

element.mount('#container')
```

```typescript theme={null}
const element = session.createElement('withdrawals-element', {
  onReady: (element) => {
    console.log('Withdrawals list is ready')
  },
})
```

## Events

Events emitted by the WithdrawalsElement.

Listen to these events using the `on()` method or by passing callback functions in the options.

### `error`

Emitted when an error occurs during element initialization or operation.

**Callback signature:** (error: `unknown`) => void

### `ready`

Emitted when the element has finished loading and is ready for user interaction.

**Callback signature:** (element: `WithdrawalsElement`) => void

### `optionsUpdated`

Emitted when the element's options are updated via `updateOptions()`.

**Callback signature:** (options: [`WithdrawalsElementOptions`](#withdrawalselementoptions)) => void

### `snapshot`

Emitted when the element's internal state changes.

**Callback signature:** (snapshot: [`WithdrawalsElementSnapshot`](#withdrawalselementsnapshot)) => void

### `showWithdrawalBreakdown`

Emitted when the user clicks to view a withdrawal breakdown.
By default, opens the WithdrawalBreakdown modal. Call `ev.preventDefault()` to handle this yourself.

**Callback signature:** (ev: `CustomEvent`\<\{ withdrawalId: `string`; }>) => void

### `showGenerateWithdrawalReceipt`

Emitted when the user clicks to generate a receipt for a withdrawal.
By default, opens the GenerateWithdrawalReceipt modal. Call `ev.preventDefault()` to handle this yourself.

**Callback signature:** (ev: `CustomEvent`\<\{ withdrawalId: `string`; }>) => void

## Methods

### `mount(container)`

Mount the element to a DOM container.

The container must be an empty element. The element will be appended as a child.
If the element is already mounted, this method will log a warning and return.

| Parameter   | Type                              | Description                                               |
| ----------- | --------------------------------- | --------------------------------------------------------- |
| `container` | `HTMLElement` \| `#$\{`string`\}` | The container element or a CSS selector starting with '#' |

```typescript theme={null}
// Using a selector
element.mount('#my-container')

// Using an element reference
const container = document.getElementById('my-container')
element.mount(container)
```

### `unmount()`

Remove the element from the DOM and clean up all event listeners.

After unmounting, the element instance should not be reused.
Create a new element instance if you need to mount again.

```typescript theme={null}
// Unmount when done
element.unmount()

// Commonly used in event handlers
element.on('complete', () => {
  element.unmount()
})
```

### `updateOptions(options)`

Update the element's configuration options after creation.

Only the provided options will be updated; other options remain unchanged.
The element will re-render with the new options.

| Parameter | Type                                                                  | Description                                      |
| --------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| `options` | `Partial`\<[`WithdrawalsElementOptions`](#withdrawalselementoptions)> | Partial options object with the values to update |

```typescript theme={null}
// Update a single option
element.updateOptions({
  onComplete: (ev) => {
    console.log('New handler!')
  },
})
```

### `getSnapshot()`

Get the current state snapshot of the element.

The snapshot contains the element's current internal state, such as
loading status, form values, or other element-specific data.

**Returns:** [`WithdrawalsElementSnapshot`](#withdrawalselementsnapshot)

```typescript theme={null}
const snapshot = element.getSnapshot()
console.log('Current state:', snapshot.state)

// Or listen for changes
element.on('snapshot', (snapshot) => {
  console.log('State changed:', snapshot)
})
```

## Types

### WithdrawalsElementOptions

Configuration options for the WithdrawalsElement.

| Property  | Type                                                   | Required | Default | Description                                                                                                                              |
| --------- | ------------------------------------------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `onReady` | `((element: WithdrawalsElement) => void) \| undefined` | No       | -       | Callback fired when the element has finished loading and is ready for interaction. This is equivalent to listening to the 'ready' event. |

### WithdrawalsElementSnapshot

Represents the current state of the WithdrawalsElement.

Use `element.getSnapshot()` to get the current state, or listen to the `snapshot` event for changes.

| Property | Type                   | Required | Default | Description                                                                                                                                     |
| -------- | ---------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `"ready" \| "loading"` | Yes      | -       | The current loading state of the element. - '"loading"' - The element is initializing - '"ready"' - The element is fully loaded and interactive |

# Embed checkout

Source: https://docs.whop.com/payments/checkout-embed

Learn how to embed Whop's checkout flow on your website

Embedded checkout allows you to embed Whop's checkout flow on your own website. This allows you to offer your customers a seamless checkout experience without leaving your website.

<iframe title="YouTube video player" />

## React setup

### Step 1: Install the package

```bash theme={null}
npm install @whop/checkout
```

### Step 2: Add the checkout element

```tsx theme={null}
import { WhopCheckoutEmbed } from '@whop/checkout/react'

export default function Home() {
  return (
    <WhopCheckoutEmbed planId="plan_XXXXXXXXX" returnUrl="https://yoursite.com/checkout/complete" />
  )
}
```

This component will mount an iframe with the Whop checkout embed.

The `returnUrl` is required to handle redirects from external payment providers. When redirected, check the `status` query parameter:

- **success**: The payment succeeded. Use the receipt information to render a success page.
- **error**: The payment failed or was canceled. Remount the checkout so your customer can try again.

<Tip>
  Keep that Plan ID handy. You'll need to paste it into your website code, so
  save it somewhere you can find it.
</Tip>

### Step 3: **(optional)** Configure - Programmatic controls

To get access to the controls of the checkout embed, you can use the `ref` prop.

```tsx theme={null}
const ref = useCheckoutEmbedControls()

return <WhopCheckoutEmbed ref={ref} planId="plan_XXXXXXXXX" />
```

#### **`submit`**

To submit checkout programmatically, you can use the `submit` method on the checkout element.

```tsx theme={null}
ref.current?.submit()
```

#### **`getEmail`**

To get the email of the user who is checking out, you can use the `getEmail` method on the checkout element.

```tsx theme={null}
const email = await ref.current?.getEmail()
console.log(email)
```

#### **`setEmail`**

To set the email of the user who is checking out, you can use the `setEmail` method on the checkout element.

```tsx theme={null}
try {
  await ref.current?.setEmail('example@domain.com')
} catch (error) {
  console.error(error)
}
```

#### **`getAddress`**

To get the address of the user who is checking out, you can use the `getAddress` method on the checkout element.

```tsx theme={null}
const address = await ref.current?.getAddress()
console.log(address)
```

#### **`setAddress`**

To set the address of the user who is checking out, you can use the `setAddress` method on the checkout element.

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `hideAddressForm` prop to `true`.
</Note>

```tsx theme={null}
try {
  await ref.current?.setAddress({
    name: 'John Doe',
    country: 'US',
    line1: '123 Main St',
    city: 'Any Town',
    state: 'CA',
    postalCode: '12345',
  })
} catch (error) {
  console.error(error)
}
```

### Step 4: **(optional)** Configure - Available properties

#### **`planId`**

**Required** - The plan id you want to checkout.

#### **`theme`**

**Optional** - The theme you want to use for the checkout.

Possible values are `light`, `dark` or `system`.

#### **`sessionId`**

**Optional** - The session id to use for the checkout.

This can be used to attach metadata to a checkout by first creating a session through the API and then passing the session id to the checkout element.

#### **`returnUrl`**

**Optional** - The URL to redirect the user to after checkout completes.

```tsx theme={null}
<WhopCheckoutEmbed returnUrl="https://yoursite.com/checkout/complete" planId="plan_XXXXXXXXX" />
```

#### **`affiliateCode`**

**Optional** - The affiliate code to use for the checkout.

```tsx theme={null}
<WhopCheckoutEmbed affiliateCode="tristan" planId="plan_XXXXXXXXX" />
```

#### **`hidePrice`**

**Optional** - Turn on to hide the price in the embedded checkout form.

Defaults to `false`

#### **`hideTermsAndConditions`**

**Optional** - Set to `true` to hide the terms and conditions in the embedded checkout form.

Defaults to `false`

#### **`skipRedirect`**

**Optional** - Set to `true` to skip the final redirect and keep the top frame loaded.

Defaults to `false`

#### **`onComplete`**

**Optional** - A callback function that will be called when the checkout is complete.

<Note>This option will set `skipRedirect` to `true`</Note>

```tsx theme={null}
<WhopCheckoutEmbed
  onComplete={(planId, receiptId) => {
    console.log(planId, receiptId)
  }}
  planId="plan_XXXXXXXXX"
/>
```

#### **`utm`**

**Optional** - The UTM parameters to add to the checkout URL.

**Note** - The keys must start with `utm_`

```tsx theme={null}
<WhopCheckoutEmbed planId="plan_XXXXXXXXX" utm={{ utm_campaign: 'ad_XXXXXXX' }} />
```

#### **`fallback`**

**Optional** - The fallback content to show while the checkout is loading.

```tsx theme={null}
<WhopCheckoutEmbed fallback={<>loading...</>} planId="plan_XXXXXXXXX" />
```

#### **`prefill`**

**Optional** - The prefill options to apply to the checkout embed.

Used to prefill the email or address in the embedded checkout form.
This setting can be helpful when integrating the embed into a funnel that collects the email prior to payment already.

```tsx theme={null}
<WhopCheckoutEmbed
  prefill={{ email: "example@domain.com" }}
  planId="plan_XXXXXXXXX"
/>
<WhopCheckoutEmbed
  prefill={{ address: {
    name: "John Doe",
    country: "US",
    line1: "123 Main St",
    city: "Any Town",
    state: "CA",
    postalCode: "12345",
  } }}
  planId="plan_XXXXXXXXX"
/>
```

#### **`hideEmail`**

**Optional** - Set to `true` to hide the email input in the embedded checkout form. Make sure to display the users email in the parent page when setting this attribute.

Defaults to `false`

<Note>
  Use this in conjunction with the `prefill` attribute or the `setEmail` method
  to control the email input.
</Note>

```tsx theme={null}
<WhopCheckoutEmbed hideEmail planId="plan_XXXXXXXXX" />
```

#### **`disableEmail`**

**Optional** - Set to `true` to disable the email input in the embedded checkout form.

Defaults to `false`

<Note>
  Use this in conjunction with the `prefill` attribute or the `setEmail` method
  to control the email input.
</Note>

```tsx theme={null}
<WhopCheckoutEmbed disableEmail planId="plan_XXXXXXXXX" />
```

#### **`hideAddressForm`**

**Optional** - Set to `true` to hide the address form in the embedded checkout form.

Defaults to `false`

<Note>
  Use this in conjunction with the `setAddress` method to control the address
  input.
</Note>

```tsx theme={null}
<WhopCheckoutEmbed hideAddressForm planId="plan_XXXXXXXXX" />
```

#### **`setupFutureUsage`**

**Optional** - The setup future usage to use for the checkout. When using the `chargeUser` API you need to set this to `off_session`. This will filter out payment methods that are not supported with that API.

```tsx theme={null}
<WhopCheckoutEmbed setupFutureUsage="off_session" planId="plan_XXXXXXXXX" />
```

#### **`onStateChange`**

**Optional** - A callback function that will be called when the checkout state changes.

This can be used when programmatically submitting the checkout embed.

Possible values are `loading`, `ready`, `disabled`.

```tsx theme={null}
<WhopCheckoutEmbed
  onStateChange={(state) => {
    console.log(state)
  }}
  planId="plan_XXXXXXXXX"
/>
```

#### **`environment`**

**Optional** - The environment to use for the checkout.

Possible values are `production` or `sandbox`.

Defaults to `production`

<Note>
  When using `sandbox`, make sure to use a sandbox plan ID. Sandbox plans can be created in the [sandbox dashboard](https://sandbox.whop.com/dashboard).
</Note>

```tsx theme={null}
<WhopCheckoutEmbed environment="sandbox" planId="plan_XXXXXXXXX" />
```

#### **`onAddressValidationError`**

**Optional** - A callback function that will be called when the address validation error occurs.

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `hideAddressForm` prop to `true`.
</Note>

```tsx theme={null}
<WhopCheckoutEmbed
  hideAddressForm
  onAddressValidationError={(error) => {
    console.log(error)
  }}
  planId="plan_XXXXXXXXX"
/>
```

#### **`styles`**

**Optional** - Customize the padding of the checkout embed container.

The `styles` prop accepts a `container` object with the following properties:

| Property        | Description                          | Default |
| --------------- | ------------------------------------ | ------- |
| `paddingTop`    | Top padding in pixels                | `32`    |
| `paddingBottom` | Bottom padding in pixels             | `32`    |
| `paddingLeft`   | Left padding in pixels               | `32`    |
| `paddingRight`  | Right padding in pixels              | `32`    |
| `paddingY`      | Shorthand for top and bottom padding | `32`    |
| `paddingX`      | Shorthand for left and right padding | `32`    |

Individual properties take precedence over their shorthand equivalents.

```tsx theme={null}
<WhopCheckoutEmbed planId="plan_XXXXXXXXX" styles={{ container: { paddingX: 0 } }} />
```

```tsx theme={null}
<WhopCheckoutEmbed
  planId="plan_XXXXXXXXX"
  styles={{ container: { paddingLeft: 16, paddingRight: 16, paddingTop: 0, paddingBottom: 0 } }}
/>
```

### Full example

```tsx theme={null}
import { WhopCheckoutEmbed } from '@whop/checkout/react'

export default function Home() {
  return (
    <WhopCheckoutEmbed
      fallback={<>loading...</>}
      planId="plan_XXXXXXXXX"
      sessionId="ch_XXXXXXXXX"
      returnUrl="https://yoursite.com/checkout/complete"
      theme="light"
      hidePrice={false}
    />
  )
}
```

## Other websites

### Step 1: Add the script tag

To embed checkout, you need to add the following script tag into the `<head>` of your page:

```md theme={null}
<script
  async
  defer
  src="https://js.whop.com/static/checkout/loader.js"
></script>
```

### Step 2: Add the checkout element

To create a checkout element, you need to include the following attributes on an element in your page:

```md theme={null}
<div
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
  data-whop-checkout-return-url="https://yoursite.com/checkout/complete"
></div>
```

This will mount an iframe inside of the element with the plan id you provided.

The `data-whop-checkout-return-url` is required to handle redirects from external payment providers. When redirected, check the `status` query parameter:

- **success**: The payment succeeded. Use the receipt information to render a success page.
- **error**: The payment failed or was canceled. Remount the checkout so your customer can try again.

### Step 3: **(optional)** Configure - Programmatic controls

First, attach an `id` to the checkout container:

```md theme={null}
<div id="whop-embedded-checkout" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`submit`**

To submit checkout programmatically, you can use the `submit` method on the checkout element.

```js theme={null}
wco.submit('whop-embedded-checkout')
```

#### **`getEmail`**

To get the email of the user who is checking out, you can use the `getEmail` method on the checkout element.

```js theme={null}
const email = await wco.getEmail('whop-embedded-checkout')
console.log(email)
```

#### **`setEmail`**

To set the email of the user who is checking out, you can use the `setEmail` method on the checkout element.

```js theme={null}
wco.setEmail('whop-embedded-checkout', 'example@domain.com')
```

#### **`getAddress`**

To get the address of the user who is checking out, you can use the `getAddress` method on the checkout element.

```js theme={null}
const address = await wco.getAddress('whop-embedded-checkout')
console.log(address)
```

#### **`setAddress`**

To set the address of the user who is checking out, you can use the `setAddress` method on the checkout element.

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `data-whop-checkout-hide-address` prop to `true`.
</Note>

```js theme={null}
try {
  await wco.setAddress('whop-embedded-checkout', {
    name: 'John Doe',
    country: 'US',
    line1: '123 Main St',
    city: 'Any Town',
    state: 'CA',
    postalCode: '12345',
  })
} catch (error) {
  console.error(error)
}
```

### Step 4: **(optional)** Configure - Available attributes

#### **`data-whop-checkout-plan-id`**

**Required** - The plan id you want to checkout.

> To get your plan id, you need to first create a plan in the **Manage Pricing** section on your whop page.

#### **`data-whop-checkout-theme`**

**Optional** - The theme you want to use for the checkout.

Possible values are `light`, `dark` or `system`.

```md theme={null}
<div data-whop-checkout-theme="light" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-theme-accent-color`**

**Optional** - The accent color to apply to the checkout embed

Possible values are

- `tomato`
- `red`
- `ruby`
- `crimson`
- `pink`
- `plum`
- `purple`
- `violet`
- `iris`
- `cyan`
- `teal`
- `jade`
- `green`
- `grass`
- `brown`
- `blue`
- `orange`
- `indigo`
- `sky`
- `mint`
- `yellow`
- `amber`
- `lime`
- `lemon`
- `magenta`
- `gold`
- `bronze`
- `gray`

```md theme={null}
<div data-whop-checkout-theme-accent-color="green" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-session`**

**Optional** - The session id to use for the checkout.

This can be used to attach metadata to a checkout by first creating a session through the API and then passing the session id to the checkout element.

```md theme={null}
<div data-whop-checkout-session="ch_XXXXXXXXX" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-return-url`**

**Optional** - The URL to redirect the user to after checkout completes.

```md theme={null}
<div data-whop-checkout-return-url="https://yoursite.com/checkout/complete" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-affiliate-code`**

**Optional** - The affiliate code to use for the checkout.

```md theme={null}
<div data-whop-checkout-affiliate-code="tristan" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-price`**

**Optional** - Set to `true` to hide the price in the embedded checkout form.

Defaults to `false`

```md theme={null}
<div data-whop-checkout-hide-price="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-submit-button`**

**Optional** - Set to `true` to hide the submit button in the embedded checkout form.

Defaults to `false`

<Note>
  When using this Option, you will need to [programmatically submit](#submit)
  the checkout form.
</Note>

```md theme={null}
<div data-whop-checkout-hide-submit-button="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-tos`**

**Optional** - Set to `true` to hide the terms and conditions in the embedded checkout form.

Defaults to `false`

```md theme={null}
<div data-whop-checkout-hide-tos="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-skip-redirect`**

**Optional** - Set to `true` to skip the final redirect and keep the top frame loaded.

Defaults to `false`

```md theme={null}
<div data-whop-checkout-skip-redirect="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-on-complete`**

**Optional** - The callback to call when the checkout succeeds

<Note>This option will set `data-whop-checkout-skip-redirect` to `true`</Note>

```html theme={null}
<script>
  window.onCheckoutComplete = (planId, receiptId) => {
    console.log(planId, receiptId)
  }
</script>

<div
  data-whop-checkout-on-complete="onCheckoutComplete"
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>
```

#### **`data-whop-checkout-on-state-change`**

**Optional** - The callback to call when state of the checkout changes

This can be used when programmatically submitting the checkout embed.

Possible values are `loading`, `ready`, `disabled`.

```html theme={null}
<script>
  window.onCheckoutStateChange = (state) => {
    console.log(state)
  }
</script>

<div
  data-whop-checkout-on-state-change="onCheckoutStateChange"
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>
```

#### **`data-whop-checkout-skip-utm`**

By default any utm params from the main page will be forwarded to the checkout embed.

**Optional** - Set to `true` to prevent the automatic forwarding of utm parameters

Defaults to `false`

#### **`data-whop-checkout-prefill-*`**

Used to prefill the email or address in the embedded checkout form. This setting can be helpful when integrating the embed into a funnel that collects the email prior to payment already.

```md theme={null}
<div data-whop-checkout-prefill-email="example@domain.com" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>

<div 
	data-whop-checkout-prefill-name="John Doe"
	data-whop-checkout-prefill-address-country="US"
	data-whop-checkout-prefill-address-line1="123 Main St"
	data-whop-checkout-prefill-address-line2=""
	data-whop-checkout-prefill-address-city="Any Town"
	data-whop-checkout-prefill-address-state="CA"
	data-whop-checkout-prefill-address-postal-code="12345"
	data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>

<div data-whop-checkout-prefill-address-name="John Doe" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-email`**

**Optional** - Set to `true` to hide the email input in the embedded checkout form. Make sure to display the users email in the parent page when setting this attribute.

Defaults to `false`

<Note>
  Use this in conjunction with the `data-whop-checkout-prefill-email` attribute
  or the `setEmail` method to control the email input.
</Note>

```md theme={null}
<div data-whop-checkout-hide-email="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-disable-email`**

**Optional** - Set to `true` to disable the email input in the embedded checkout form.

Defaults to `false`

<Note>
  Use this in conjunction with the `data-whop-checkout-prefill-email` attribute
  or the `setEmail` method to control the email input.
</Note>

```md theme={null}
<div data-whop-checkout-disable-email="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-hide-address`**

**Optional** - Set to `true` to hide the address form in the embedded checkout form.

Defaults to `false`

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `data-whop-checkout-hide-address` prop to `true`.
</Note>

```md theme={null}
<div data-whop-checkout-hide-address="true" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-setup-future-usage`**

**Optional** - The setup future usage to use for the checkout. When using the `chargeUser` API you need to set this to `off_session`. This will filter out payment methods that are not supported with that API.

```md theme={null}
<div data-whop-checkout-setup-future-usage="off_session" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-environment`**

**Optional** - The environment to use for the checkout.

Possible values are `production` or `sandbox`.

Defaults to `production`

<Note>
  When using `sandbox`, make sure to use a sandbox plan ID. Sandbox plans can be created in the [sandbox dashboard](https://sandbox.whop.com/dashboard).
</Note>

```md theme={null}
<div data-whop-checkout-environment="sandbox" data-whop-checkout-plan-id="plan_XXXXXXXXX"></div>
```

#### **`data-whop-checkout-on-address-validation-error`**

**Optional** - The callback to call when the address validation error occurs.

<Note>
  This method will only work if the address form is hidden. You can hide the
  address form by setting the `data-whop-checkout-hide-address` prop to `true`.
</Note>

```html theme={null}
<script>
  window.onAddressValidationError = (error) => {
    console.log(error)
  }
</script>

<div
  data-whop-checkout-on-address-validation-error="onAddressValidationError"
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
></div>
```

#### **`data-whop-checkout-style-*`**

**Optional** - Customize the padding of the checkout embed container.

The attribute pattern is `data-whop-checkout-style-container-{property}` where `{property}` is a kebab-case padding property.

| Attribute                                           | Description                          | Default |
| --------------------------------------------------- | ------------------------------------ | ------- |
| `data-whop-checkout-style-container-padding-top`    | Top padding in pixels                | `32`    |
| `data-whop-checkout-style-container-padding-bottom` | Bottom padding in pixels             | `32`    |
| `data-whop-checkout-style-container-padding-left`   | Left padding in pixels               | `32`    |
| `data-whop-checkout-style-container-padding-right`  | Right padding in pixels              | `32`    |
| `data-whop-checkout-style-container-padding-y`      | Shorthand for top and bottom padding | `32`    |
| `data-whop-checkout-style-container-padding-x`      | Shorthand for left and right padding | `32`    |

Individual properties take precedence over their shorthand equivalents.

```md theme={null}
<div
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
  data-whop-checkout-style-container-padding-x="0"
></div>
```

```md theme={null}
<div
  data-whop-checkout-plan-id="plan_XXXXXXXXX"
  data-whop-checkout-style-container-padding-left="16"
  data-whop-checkout-style-container-padding-right="16"
  data-whop-checkout-style-container-padding-top="0"
  data-whop-checkout-style-container-padding-bottom="0"
></div>
```

### Full example

```md theme={null}
<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width">
		<script
			async
			defer
  			src="https://js.whop.com/static/checkout/loader.js"
		></script>
		<title>Whop embedded checkout example</title>
		<style>
			div {
				box-sizing: border-box;
			}
			body {
				margin: 0
			}
		</style>
	</head>
	<body>
		<div
			data-whop-checkout-plan-id="plan_XXXXXXXXX"
			data-whop-checkout-session="ch_XXXXXXXXX"
			data-whop-checkout-return-url="https://yoursite.com/checkout/complete"
			data-whop-checkout-theme="light"
			data-whop-checkout-hide-price="false"
			style="height: fit-content; overflow: hidden; max-width: 50%;"
		></div>
	</body>
</html>
```

## Apple Pay

Apple Pay allows customers to pay using their Apple Wallet, providing a seamless checkout experience on Safari and iOS devices. To enable Apple Pay on your embedded checkout, you need to verify ownership of your domain.

<Card title="Set up Apple Pay" icon="apple" href="/payments/apple-pay">
  Learn how to verify your domain and enable Apple Pay for embedded checkout
</Card>

<Note>
  When using the `hideSubmitButton` option in React, `@whop/checkout@0.0.43` or
  later is required for Apple Pay to appear in the embed.
</Note>

## FAQs

<AccordionGroup>
  <Accordion title="Why is my checkout not loading?">
    Make sure you've correctly replaced `plan_XXXXXXXXX` or `PLAN_ID_HERE` in the code snippets with your actual Plan ID from the Whop dashboard. Also verify that the script tag is properly loaded in the `<head>` section if using HTML/JS.
  </Accordion>

  <Accordion title="Where do I find my Plan ID?">
    Go to your **Dashboard** > **Checkout links** > Click the **three dots (⋮)** on your pricing option > Hover over **Details** > Click the ID (starts with `plan_`) to copy it.
  </Accordion>

  <Accordion title="Can I embed multiple checkouts on the same page?">
    Yes, you can add multiple checkout embeds with different Plan IDs. Each embed operates independently.
  </Accordion>

  <Accordion title="How do I change the checkout theme?">
    For React: add `theme="dark"` or `theme="light"` as a property. For HTML: add `data-whop-checkout-theme="dark"` to your div element.
  </Accordion>

  <Accordion title="Can I hide the price in the embedded checkout?">
    Yes, add `hidePrice={true}` in React or `data-whop-checkout-hide-price="true"` in HTML to hide the price display.
  </Accordion>

  <Accordion title="What happens after a customer completes checkout?">
    By default, customers are redirected to your whop. You can customize this by setting a custom redirect URL or skipping the redirect entirely.
  </Accordion>

  <Accordion title="How do I prevent the redirect after checkout?">
    Use `skipRedirect={true}` in React or `data-whop-checkout-skip-redirect="true"` in HTML to keep users on the same page.
  </Accordion>

  <Accordion title="Is the embedded checkout mobile-responsive?">
    Yes, the checkout automatically adapts to different screen sizes and devices.
  </Accordion>

  <Accordion title="Can I customize the checkout's appearance with CSS?">
    You can style the wrapper using the `.whop-checkout-wrapper iframe` CSS class, but the checkout content itself cannot be modified for security reasons.
  </Accordion>

  <Accordion title="Can I pre-fill customer information?">
    Yes, use `prefill={{ email: "customer@example.com" }}` in React or `data-whop-checkout-prefill-email="customer@example.com"` in HTML.
  </Accordion>
</AccordionGroup>
