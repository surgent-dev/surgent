use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, FromRow)]
pub struct Organization {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    #[sqlx(rename = "createdBy")]
    pub created_by: Option<String>,
    #[sqlx(rename = "platformFeePercent")]
    pub platform_fee_percent: Option<i32>,
    #[sqlx(rename = "platformFeeFixed")]
    pub platform_fee_fixed: Option<i32>,
}
