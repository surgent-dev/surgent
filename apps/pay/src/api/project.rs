use axum::{Json, extract::State, http::StatusCode};
use serde::Serialize;
use sqlx::PgPool;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::AuthenticatedProject;

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ListProjectsResponse {
    pub projects: Vec<Project>,
}

/// List all projects for the authenticated organization.
///
/// Returns projects belonging to the organization associated with the API key.
/// Project creation is handled by apps/worker, not this API.
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
        ("project_key" = [])
    )
)]
pub async fn list_projects(
    State(pool): State<PgPool>,
    auth: AuthenticatedProject,
) -> Result<(StatusCode, Json<ListProjectsResponse>), (StatusCode, String)> {
    let rows = sqlx::query!(
        r#"
        SELECT id, "organizationId", name, slug
        FROM project
        WHERE "organizationId" = $1
        "#,
        auth.organization_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    let projects = rows
        .into_iter()
        .map(|r| Project {
            id: r.id,
            organization_id: r.organizationId,
            name: r.name,
            slug: r.slug,
        })
        .collect();

    Ok((StatusCode::OK, Json(ListProjectsResponse { projects })))
}
