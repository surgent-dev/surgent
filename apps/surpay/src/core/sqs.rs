use aws_sdk_sqs::Client;
use aws_sdk_sqs::types::Message;

/// Creates an SQS client, optionally pointing to a custom endpoint (e.g., ElasticMQ).
pub async fn create_client(endpoint_url: Option<&str>) -> Client {
    let mut config = aws_config::defaults(aws_config::BehaviorVersion::latest());
    
    if let Some(url) = endpoint_url {
        config = config.endpoint_url(url);
    }
    
    let config = config.load().await;
    Client::new(&config)
}

/// Sends a JSON-serialized message to the specified queue.
pub async fn send_message<T: serde::Serialize>(
    client: &Client,
    queue_url: &str,
    message: &T,
) -> Result<String, String> {
    let body = serde_json::to_string(message)
        .map_err(|e| format!("Failed to serialize message: {}", e))?;
    
    let result = client
        .send_message()
        .queue_url(queue_url)
        .message_body(body)
        .send()
        .await
        .map_err(|e| format!("Failed to send message: {}", e))?;
    
    Ok(result.message_id().unwrap_or_default().to_string())
}

/// Receives messages from the specified queue with visibility timeout.
pub async fn receive_messages(
    client: &Client,
    queue_url: &str,
    visibility_timeout: i32,
    max_messages: i32,
) -> Result<Vec<Message>, String> {
    let result = client
        .receive_message()
        .queue_url(queue_url)
        .visibility_timeout(visibility_timeout)
        .max_number_of_messages(max_messages)
        .wait_time_seconds(20)
        .message_system_attribute_names(aws_sdk_sqs::types::MessageSystemAttributeName::ApproximateReceiveCount)
        .send()
        .await
        .map_err(|e| format!("Failed to receive messages: {}", e))?;
    
    Ok(result.messages().to_vec())
}

/// Deletes a message from the queue using its receipt handle.
pub async fn delete_message(
    client: &Client,
    queue_url: &str,
    receipt_handle: &str,
) -> Result<(), String> {
    client
        .delete_message()
        .queue_url(queue_url)
        .receipt_handle(receipt_handle)
        .send()
        .await
        .map_err(|e| format!("Failed to delete message: {}", e))?;
    
    Ok(())
}

/// Extracts the approximate receive count from a message's attributes.
/// Returns 0 if the attribute is not present.
pub fn get_receive_count(message: &Message) -> i32 {
    message
        .attributes()
        .and_then(|attrs| attrs.get(&aws_sdk_sqs::types::MessageSystemAttributeName::ApproximateReceiveCount))
        .and_then(|v| v.parse::<i32>().ok())
        .unwrap_or(0)
}
