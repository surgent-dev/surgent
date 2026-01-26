use axum::{Json, extract::State, http::StatusCode};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::AuthenticatedProject;

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: Uuid,
    #[sqlx(rename = "organizationId")]
    pub organization_id: Option<Uuid>,
    pub name: String,
    pub slug: String,
    #[sqlx(rename = "externalId")]
    pub external_id: Option<Uuid>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ListProjectsResponse {
    pub projects: Vec<Project>,
}

/// List all projects for the authenticated organization
#[utoipa::path(
    get,
    path = "/projects",
    tag = "project",
    responses(
        (status = 200, description = "Projects retrieved", body = ListProjectsResponse),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("org_key" = [])
    )
)]
pub async fn list_projects(
    State(pool): State<PgPool>,
    auth: AuthenticatedProject,
) -> Result<(StatusCode, Json<ListProjectsResponse>), (StatusCode, String)> {
    let projects = sqlx::query_as::<_, Project>(
        r#"
        SELECT id, "organizationId", name, slug, "externalId"
        FROM project
        WHERE "organizationId" = $1
        "#,
    )
    .bind(auth.organization_id)
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok((StatusCode::OK, Json(ListProjectsResponse { projects })))
}
