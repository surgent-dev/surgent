use axum::{Json, extract::State, http::StatusCode};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::core::auth::AuthenticatedOrganization;

#[derive(Debug, Clone, FromRow, Serialize, ToSchema)]
pub struct Project {
    pub id: Uuid,
    pub organization_id: Option<Uuid>,
    pub name: String,
    pub slug: String,
    pub external_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateProjectRequest {
    pub name: String,
    pub slug: String,
    pub external_id: Option<Uuid>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreateProjectResponse {
    pub id: Uuid,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ListProjectsResponse {
    pub projects: Vec<Project>,
}

/// Create a new project
#[utoipa::path(
    post,
    path = "/project",
    tag = "project",
    request_body = CreateProjectRequest,
    responses(
        (status = 201, description = "Project created", body = CreateProjectResponse),
        (status = 401, description = "Unauthorized - invalid or missing API key"),
        (status = 409, description = "Conflict - slug already exists"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("org_key" = [])
    )
)]
pub async fn create_project(
    State(pool): State<PgPool>,
    AuthenticatedOrganization { organization: org }: AuthenticatedOrganization,
    Json(req): Json<CreateProjectRequest>,
) -> Result<(StatusCode, Json<CreateProjectResponse>), (StatusCode, String)> {
    let project_id = Uuid::new_v4();

    sqlx::query!(
        r#"
        INSERT INTO project (
            id,
            organization_id,
            name,
            slug,
            external_id
        )
        VALUES ($1, $2, $3, $4, $5)
        "#,
        project_id,
        org.id,
        req.name,
        req.slug,
        req.external_id
    )
    .execute(&pool)
    .await
    .map_err(|e| {
        if let sqlx::Error::Database(ref db_err) = e
            && db_err.constraint() == Some("project_slug_key")
        {
            return (StatusCode::CONFLICT, "slug already exists".to_string());
        }
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Database error: {}", e),
        )
    })?;

    Ok((
        StatusCode::CREATED,
        Json(CreateProjectResponse { id: project_id }),
    ))
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
    AuthenticatedOrganization { organization: org }: AuthenticatedOrganization,
) -> Result<(StatusCode, Json<ListProjectsResponse>), (StatusCode, String)> {
    let projects = sqlx::query_as!(
        Project,
        r#"
        SELECT id, organization_id, name, slug, external_id
        FROM project
        WHERE organization_id = $1
        "#,
        org.id
    )
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
