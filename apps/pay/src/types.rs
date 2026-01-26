use serde::{Deserialize, Serialize};
use sqlx::Type;
use utoipa::ToSchema;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Type, Serialize, Deserialize, ToSchema)]
#[sqlx(type_name = "checkout_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CheckoutStatus {
    Open,
    Complete,
    Expired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Type, Serialize, Deserialize, ToSchema)]
#[sqlx(type_name = "checkout_mode", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CheckoutMode {
    Payment,
    Subscription,
    Setup,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Type, Serialize, Deserialize, ToSchema)]
#[sqlx(type_name = "subscription_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionStatus {
    Active,
    PastDue,
    Canceled,
    Unpaid,
    Trialing,
    Incomplete,
    IncompleteExpired,
}

impl TryFrom<&str> for SubscriptionStatus {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value.to_lowercase().as_str() {
            "active" => Ok(SubscriptionStatus::Active),
            "past_due" => Ok(SubscriptionStatus::PastDue),
            "canceled" => Ok(SubscriptionStatus::Canceled),
            "unpaid" => Ok(SubscriptionStatus::Unpaid),
            "trialing" => Ok(SubscriptionStatus::Trialing),
            "incomplete" => Ok(SubscriptionStatus::Incomplete),
            "incomplete_expired" => Ok(SubscriptionStatus::IncompleteExpired),
            other => Err(format!(
                "Invalid subscription status: {}. Valid values are: active, past_due, canceled, unpaid, trialing, incomplete, incomplete_expired",
                other
            )),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Type, Serialize, Deserialize, ToSchema)]
#[sqlx(type_name = "payout_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum PayoutStatus {
    Paid,
    Pending,
    InTransit,
    Canceled,
    Failed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Type, Serialize, Deserialize, ToSchema)]
#[sqlx(type_name = "recurring_interval", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RecurringInterval {
    Day,
    Week,
    Month,
    Year,
}

impl TryFrom<&str> for RecurringInterval {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value.to_lowercase().as_str() {
            "day" => Ok(RecurringInterval::Day),
            "week" => Ok(RecurringInterval::Week),
            "month" => Ok(RecurringInterval::Month),
            "year" => Ok(RecurringInterval::Year),
            other => Err(format!(
                "Invalid recurring interval: {}. Valid values are: day, week, month, year",
                other
            )),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Type, Serialize, Deserialize, ToSchema)]
#[sqlx(type_name = "transaction_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TransactionType {
    Payment,
    ProcessorFee,
    Refund,
    Dispute,
    Balance,
    Payout,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Type, Serialize, Deserialize, ToSchema)]
#[sqlx(type_name = "refund_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum RefundStatus {
    Pending,
    RequiresAction,
    Succeeded,
    Failed,
    Canceled,
}

impl TryFrom<&str> for RefundStatus {
    type Error = String;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value.to_lowercase().as_str() {
            "pending" => Ok(RefundStatus::Pending),
            "requires_action" => Ok(RefundStatus::RequiresAction),
            "succeeded" => Ok(RefundStatus::Succeeded),
            "failed" => Ok(RefundStatus::Failed),
            "canceled" => Ok(RefundStatus::Canceled),
            other => Err(format!(
                "Invalid refund status: {}. Valid values are: pending, requires_action, succeeded, failed, canceled",
                other
            )),
        }
    }
}
