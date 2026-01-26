use super::traits::{ConnectProcessor, PaymentProcessor};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Thread-safe registry for managing payment processor instances.
/// Uses RwLock for optimal performance in read-heavy workloads.
pub struct ProcessorRegistry {
    processors: RwLock<HashMap<String, Arc<dyn PaymentProcessor>>>,
    connect_processors: RwLock<HashMap<String, Arc<dyn ConnectProcessor>>>,
}

impl ProcessorRegistry {
    /// Creates a new empty processor registry.
    pub fn new() -> Self {
        Self {
            processors: RwLock::new(HashMap::new()),
            connect_processors: RwLock::new(HashMap::new()),
        }
    }

    /// Registers a payment processor with its name as the key.
    /// Returns an error if a processor with the same name is already registered.
    pub async fn register(&self, processor: Arc<dyn PaymentProcessor>) -> Result<(), String> {
        let name = processor.name().to_string();
        let mut guard = self.processors.write().await;

        if guard.contains_key(&name) {
            return Err(format!("Processor '{}' is already registered", name));
        }

        guard.insert(name, processor);
        Ok(())
    }

    /// Retrieves a processor by name.
    /// Returns None if no processor with the given name is registered.
    pub async fn get(&self, name: &str) -> Option<Arc<dyn PaymentProcessor>> {
        let guard = self.processors.read().await;
        guard.get(name).cloned()
    }

    /// Lists all registered processor names.
    pub async fn list(&self) -> Vec<String> {
        let guard = self.processors.read().await;
        guard.keys().cloned().collect()
    }

    /// Registers a connect processor with its name as the key.
    /// Returns an error if a connect processor with the same name is already registered.
    pub async fn register_connect(
        &self,
        processor: Arc<dyn ConnectProcessor>,
    ) -> Result<(), String> {
        let name = processor.name().to_string();
        let mut guard = self.connect_processors.write().await;

        if guard.contains_key(&name) {
            return Err(format!(
                "Connect processor '{}' is already registered",
                name
            ));
        }

        guard.insert(name, processor);
        Ok(())
    }

    /// Retrieves a connect processor by name.
    /// Returns None if no connect processor with the given name is registered.
    pub async fn get_connect(&self, name: &str) -> Option<Arc<dyn ConnectProcessor>> {
        let guard = self.connect_processors.read().await;
        guard.get(name).cloned()
    }
}

impl Default for ProcessorRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::Arc;

    // Mock payment processor for testing
    struct MockProcessor {
        name: String,
    }

    impl MockProcessor {
        fn new(name: &str) -> Self {
            Self {
                name: name.to_string(),
            }
        }
    }

    #[async_trait]
    impl PaymentProcessor for MockProcessor {
        fn name(&self) -> &str {
            &self.name
        }

        async fn create_product(
            &self,
            _req: super::super::types::ProcessorProductRequest,
        ) -> Result<super::super::types::ProcessorProduct, String> {
            unimplemented!()
        }

        async fn create_price(
            &self,
            _req: super::super::types::ProcessorPriceRequest,
        ) -> Result<super::super::types::ProcessorPrice, String> {
            unimplemented!()
        }

        async fn create_checkout_session(
            &self,
            _req: super::super::types::CreateCheckoutSessionRequest,
        ) -> Result<super::super::types::ProcessorCheckout, String> {
            unimplemented!()
        }

        fn verify_webhook(&self, _payload: &[u8], _signature: &str) -> Result<bool, String> {
            unimplemented!()
        }

        fn parse_webhook_event(
            &self,
            _payload: &serde_json::Value,
        ) -> Result<super::super::types::NormalizedEvent, String> {
            unimplemented!()
        }
    }

    #[tokio::test]
    async fn test_register_processor() {
        let registry = ProcessorRegistry::new();
        let processor = Arc::new(MockProcessor::new("test_processor"));

        // Successful registration
        let result = registry.register(processor.clone()).await;
        assert!(result.is_ok(), "Registration should succeed");

        // Duplicate registration should fail
        let duplicate_result = registry.register(processor).await;
        assert!(
            duplicate_result.is_err(),
            "Duplicate registration should fail"
        );
        assert!(
            duplicate_result.unwrap_err().contains("already registered"),
            "Error should indicate processor is already registered"
        );
    }

    #[tokio::test]
    async fn test_get_processor() {
        let registry = ProcessorRegistry::new();
        let processor = Arc::new(MockProcessor::new("stripe"));

        // Get before registration
        let result = registry.get("stripe").await;
        assert!(
            result.is_none(),
            "Should return None for unregistered processor"
        );

        // Register and retrieve
        registry.register(processor.clone()).await.unwrap();
        let retrieved = registry.get("stripe").await;
        assert!(retrieved.is_some(), "Should retrieve registered processor");
        assert_eq!(
            retrieved.unwrap().name(),
            "stripe",
            "Retrieved processor name should match"
        );
    }

    #[tokio::test]
    async fn test_list_processors() {
        let registry = ProcessorRegistry::new();

        // Empty registry
        let list = registry.list().await;
        assert!(list.is_empty(), "List should be empty for new registry");

        // Register multiple processors
        let processor1 = Arc::new(MockProcessor::new("stripe"));
        let processor2 = Arc::new(MockProcessor::new("paypal"));

        registry.register(processor1).await.unwrap();
        registry.register(processor2).await.unwrap();

        let list = registry.list().await;
        assert_eq!(list.len(), 2, "Should list 2 registered processors");
        assert!(
            list.contains(&"stripe".to_string()),
            "Should contain 'stripe'"
        );
        assert!(
            list.contains(&"paypal".to_string()),
            "Should contain 'paypal'"
        );
    }

    #[tokio::test]
    async fn test_default() {
        let registry = ProcessorRegistry::default();
        assert!(
            registry.list().await.is_empty(),
            "Default registry should be empty"
        );
    }

    #[tokio::test]
    async fn test_concurrent_reads() {
        let registry = Arc::new(ProcessorRegistry::new());
        let processor = Arc::new(MockProcessor::new("concurrent"));

        // Register processor
        registry.register(processor).await.unwrap();

        let mut handles = vec![];

        // Spawn multiple tasks trying to read
        for _ in 0..10 {
            let registry_clone = Arc::clone(&registry);
            let handle = tokio::spawn(async move {
                let proc = registry_clone.get("concurrent").await;
                assert!(proc.is_some(), "Should retrieve processor from task");
                proc.unwrap().name().to_string()
            });
            handles.push(handle);
        }

        // Wait for all threads and verify
        for handle in handles {
            let name = handle.await.unwrap();
            assert_eq!(name, "concurrent");
        }
    }
}
