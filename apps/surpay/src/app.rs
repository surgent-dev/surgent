use sqlx::PgPool;
use std::sync::Arc;

use crate::core::config::Config;
use crate::integrations::ProcessorRegistry;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
    pub registry: Arc<ProcessorRegistry>,
}

impl axum::extract::FromRef<AppState> for PgPool {
    fn from_ref(state: &AppState) -> Self {
        state.pool.clone()
    }
}

impl axum::extract::FromRef<AppState> for Config {
    fn from_ref(state: &AppState) -> Self {
        state.config.clone()
    }
}

impl axum::extract::FromRef<AppState> for Arc<ProcessorRegistry> {
    fn from_ref(state: &AppState) -> Self {
        state.registry.clone()
    }
}
