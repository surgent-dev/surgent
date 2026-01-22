use aws_sdk_sqs::Client;
use aws_sdk_sqs::types::Message;
use aws_sdk_sqs::operation::RequestId;

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
        .map_err(|e| {
            let error_info = format_error(&e);
            format!(
                "Failed to send message to queue {}: {}",
                queue_url, error_info
            )
        })?;

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
        .message_system_attribute_names(
            aws_sdk_sqs::types::MessageSystemAttributeName::ApproximateReceiveCount,
        )
        .send()
        .await
        .map_err(|e| {
            let error_info = format_error(&e);
            format!(
                "Failed to receive messages from queue {}: {}",
                queue_url, error_info
            )
        })?;

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
        .map_err(|e| {
            let error_info = format_error(&e);
            format!(
                "Failed to delete message from queue {}: {}",
                queue_url, error_info
            )
        })?;

    Ok(())
}

/// Extracts the approximate receive count from a message's attributes.
/// Returns 0 if the attribute is not present.
pub fn get_receive_count(message: &Message) -> i32 {
    message
        .attributes()
        .and_then(|attrs| {
            attrs.get(&aws_sdk_sqs::types::MessageSystemAttributeName::ApproximateReceiveCount)
        })
        .and_then(|v| v.parse::<i32>().ok())
        .unwrap_or(0)
}

/// Formats AWS SDK errors with descriptive context.
fn format_error<E: std::error::Error + 'static>(error: &aws_sdk_sqs::error::SdkError<E>) -> String {
    let mut details = String::new();

    details.push_str(&format!("{}", error));

    if let Some(req_id) = error.request_id() {
        details.push_str(&format!(" | RequestId: {}", req_id));
    }

    if let Some(source) = std::error::Error::source(error) {
        details.push_str(&format!(" | Source: {}", source));
        if let Some(outer_source) = std::error::Error::source(source) {
            details.push_str(&format!(" | SourceChain: {}", outer_source));
        }
    }

    details
}
