
use fliptengine::Engine;
use fliptevaluation::error::Error;
use fliptevaluation::{
    EvaluationRequest as FliptEvaluationRequest
};
use fliptevaluation::models::flipt;

use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use serde_json;
uniffi::setup_scaffolding!();


#[derive(uniffi::Record, Serialize, Deserialize)]
pub struct ClientOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub update_interval: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "clientToken")]
    pub client_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fetch_mode: Option<String>,
}


#[derive(uniffi::Object)]
pub struct FliptClient {
    inner: Engine,
}

#[uniffi::export]
impl FliptClient {
    #[uniffi::constructor]
    pub fn new(opts: ClientOptions) -> Result<Self, FliptError> {
        // Use provided options or sensible defaults
        let url = opts.url.unwrap_or_else(|| "http://localhost:8080".to_string());
        let namespace = opts.namespace.unwrap_or_else(|| "default".to_string());
        let environment = opts.environment.unwrap_or_else(|| "default".to_string());

        // Create JSON configuration using the actual options
        let mut config = serde_json::json!({
            "url": url,
            "namespace": namespace,
            "environment": environment
        });

        // Add optional fields if they exist
        if let Some(token) = opts.client_token.filter(|t| !t.is_empty()) {
            config["authentication"] = serde_json::json!({
                "client_token": token
            });
        }

        if let Some(reference) = opts.reference.filter(|r| !r.is_empty()) {
            config["reference"] = serde_json::Value::String(reference);
        }

        if let Some(interval) = opts.update_interval {
            config["update_interval"] = serde_json::Value::Number(serde_json::Number::from(interval));
        }

        if let Some(fetch_mode) = opts.fetch_mode.filter(|f| !f.is_empty()) {
            config["fetch_mode"] = serde_json::Value::String(fetch_mode);
        }

        // Serialize configuration to JSON
        let config_json = serde_json::to_string(&config)
            .map_err(|e| FliptError::InvalidRequest {
                message: format!("Failed to serialize client configuration: {}", e)
            })?;

        // Create C string for FFI
        let c_string = std::ffi::CString::new(config_json)
            .map_err(|e| FliptError::InvalidRequest {
                message: format!("Failed to create C string from config: {}", e)
            })?;

        // Initialize the engine through FFI
        let engine_ptr = unsafe {
            fliptengine::initialize_engine(c_string.into_raw())
        };

        if engine_ptr.is_null() {
            return Err(FliptError::Internal {
                message: "Failed to initialize Flipt engine: null pointer returned".to_string()
            });
        }

        let engine = unsafe { *Box::from_raw(engine_ptr as *mut Engine) };

        Ok(Self { inner: engine })
    }

    pub fn evaluate_variant(&self, request: EvaluationRequest) -> Result<VariantEvaluationResponse, FliptError> {
        // Input validation
        if request.flag_key.is_empty() {
            return Err(FliptError::InvalidRequest {
                message: "Flag key cannot be empty".to_string()
            });
        }
        if request.entity_id.is_empty() {
            return Err(FliptError::InvalidRequest {
                message: "Entity ID cannot be empty".to_string()
            });
        }

        let eval_request = FliptEvaluationRequest {
            flag_key: request.flag_key,
            entity_id: request.entity_id,
            context: request.context,
        };

        let response = self.inner.variant(&eval_request)
            .map_err(|e| FliptError::Internal {
                message: format!("Flag evaluation failed: {}", e)
            })?;

        Ok(VariantEvaluationResponse {
            flag_match: response.r#match,
            segment_keys: response.segment_keys,
            reason: format_reason(&response.reason),
            flag_key: response.flag_key,
            variant_key: response.variant_key,
            variant_attachment: response.variant_attachment.unwrap_or_default(),
            request_duration_millis: response.request_duration_millis,
            timestamp: response.timestamp.to_rfc3339(),
        })
    }

    pub fn evaluate_boolean(&self, request: EvaluationRequest) -> Result<BooleanEvaluationResponse, FliptError> {
        // Input validation
        if request.flag_key.is_empty() {
            return Err(FliptError::InvalidRequest {
                message: "Flag key cannot be empty".to_string()
            });
        }
        if request.entity_id.is_empty() {
            return Err(FliptError::InvalidRequest {
                message: "Entity ID cannot be empty".to_string()
            });
        }

        let eval_request = FliptEvaluationRequest {
            flag_key: request.flag_key,
            entity_id: request.entity_id,
            context: request.context,
        };

        let response = self.inner.boolean(&eval_request)
            .map_err(|e| FliptError::Internal {
                message: format!("Boolean evaluation failed: {}", e)
            })?;

        Ok(BooleanEvaluationResponse {
            enabled: response.enabled,
            flag_key: response.flag_key,
            reason: format_reason(&response.reason),
            request_duration_millis: response.request_duration_millis,
            timestamp: response.timestamp.to_rfc3339(),
        })
    }

    pub fn evaluate_batch(&self, requests: Vec<EvaluationRequest>) -> Result<BatchEvaluationResponse, FliptError> {
        let eval_requests: Vec<FliptEvaluationRequest> = requests.into_iter().map(|r| {
            FliptEvaluationRequest {
                flag_key: r.flag_key,
                entity_id: r.entity_id,
                context: r.context,
            }
        }).collect();

        let batch_response = self.inner.batch(eval_requests)
            .map_err(|e| FliptError::Internal {
                message: format!("Batch evaluation failed: {}", e)
            })?;

        let responses: Vec<EvaluationResponse> = batch_response.responses.into_iter().map(|resp| {
            match resp.r#type {
                flipt::ResponseType::Variant => {
                    if let Some(variant_resp) = resp.variant_evaluation_response {
                        EvaluationResponse {
                            response_type: "VARIANT_EVALUATION_RESPONSE_TYPE".to_string(),
                            boolean_evaluation_response: None,
                            variant_evaluation_response: Some(VariantEvaluationResponse {
                                flag_match: variant_resp.r#match,
                                segment_keys: variant_resp.segment_keys,
                                reason: format_reason(&variant_resp.reason),
                                flag_key: variant_resp.flag_key,
                                variant_key: variant_resp.variant_key,
                                variant_attachment: variant_resp.variant_attachment.unwrap_or_default(),
                                request_duration_millis: variant_resp.request_duration_millis,
                                timestamp: variant_resp.timestamp.to_rfc3339(),
                            }),
                            error_evaluation_response: None,
                        }
                    } else {
                        // Handle error case
                        EvaluationResponse {
                            response_type: "ERROR_EVALUATION_RESPONSE_TYPE".to_string(),
                            boolean_evaluation_response: None,
                            variant_evaluation_response: None,
                            error_evaluation_response: Some(ErrorEvaluationResponse {
                                flag_key: "unknown".to_string(),
                                namespace_key: "default".to_string(),
                                reason: "UNKNOWN_EVALUATION_REASON".to_string(),
                            }),
                        }
                    }
                },
                flipt::ResponseType::Boolean => {
                    if let Some(boolean_resp) = resp.boolean_evaluation_response {
                        EvaluationResponse {
                            response_type: "BOOLEAN_EVALUATION_RESPONSE_TYPE".to_string(),
                            boolean_evaluation_response: Some(BooleanEvaluationResponse {
                                enabled: boolean_resp.enabled,
                                flag_key: boolean_resp.flag_key,
                                reason: format_reason(&boolean_resp.reason),
                                request_duration_millis: boolean_resp.request_duration_millis,
                                timestamp: boolean_resp.timestamp.to_rfc3339(),
                            }),
                            variant_evaluation_response: None,
                            error_evaluation_response: None,
                        }
                    } else {
                        // Handle error case
                        EvaluationResponse {
                            response_type: "ERROR_EVALUATION_RESPONSE_TYPE".to_string(),
                            boolean_evaluation_response: None,
                            variant_evaluation_response: None,
                            error_evaluation_response: Some(ErrorEvaluationResponse {
                                flag_key: "unknown".to_string(),
                                namespace_key: "default".to_string(),
                                reason: "UNKNOWN_EVALUATION_REASON".to_string(),
                            }),
                        }
                    }
                },
                flipt::ResponseType::Error => {
                    if let Some(error_resp) = resp.error_evaluation_response {
                        EvaluationResponse {
                            response_type: "ERROR_EVALUATION_RESPONSE_TYPE".to_string(),
                            boolean_evaluation_response: None,
                            variant_evaluation_response: None,
                            error_evaluation_response: Some(ErrorEvaluationResponse {
                                flag_key: error_resp.flag_key,
                                namespace_key: error_resp.namespace_key,
                                reason: "ERROR_EVALUATION_REASON".to_string(),
                            }),
                        }
                    } else {
                        EvaluationResponse {
                            response_type: "ERROR_EVALUATION_RESPONSE_TYPE".to_string(),
                            boolean_evaluation_response: None,
                            variant_evaluation_response: None,
                            error_evaluation_response: Some(ErrorEvaluationResponse {
                                flag_key: "unknown".to_string(),
                                namespace_key: "default".to_string(),
                                reason: "UNKNOWN_EVALUATION_REASON".to_string(),
                            }),
                        }
                    }
                },
            }
        }).collect();

        Ok(BatchEvaluationResponse {
            responses,
            request_duration_millis: batch_response.request_duration_millis,
        })
    }

    pub fn list_flags(&self) -> Result<Vec<Flag>, FliptError> {
        let flags = self.inner.list_flags()
            .map_err(|e| FliptError::Internal { message: e.to_string() })?;

        Ok(flags.into_iter().map(|flag| Flag {
            key: flag.key,
            enabled: flag.enabled,
            flag_type: format_flag_type(&flag.r#type),
            description: flag.description,
        }).collect())
    }

    pub fn refresh(&self) -> Result<(), FliptError> {
        // This would typically refresh the snapshot from the server
        // For now, we'll just return OK since the engine handles this internally
        Ok(())
    }

    pub fn close(&self) {
        // Clean up resources if needed
        // The engine will be dropped automatically
    }
}


#[derive(uniffi::Record, Serialize, Deserialize, Clone, PartialEq, Debug)]
pub struct EvaluationRequest {
    pub flag_key: String,
    pub entity_id: String,
    pub context: HashMap<String, String>,
}

#[derive(uniffi::Record, Serialize, Deserialize, Clone, PartialEq, Debug)]
pub struct VariantEvaluationResponse {
    pub flag_match: bool,
    pub segment_keys: Vec<String>,
    pub reason: String,
    pub flag_key: String,
    pub variant_key: String,
    pub variant_attachment: String,
    pub request_duration_millis: f64,
    pub timestamp: String,
}

#[derive(uniffi::Record, Serialize, Deserialize, Clone, PartialEq, Debug)]
pub struct BooleanEvaluationResponse {
    pub enabled: bool,
    pub flag_key: String,
    pub reason: String,
    pub request_duration_millis: f64,
    pub timestamp: String,
}

#[derive(uniffi::Record)]
pub struct ErrorEvaluationResponse {
    pub flag_key: String,
    pub namespace_key: String,
    pub reason: String,
}

#[derive(uniffi::Record)]
pub struct EvaluationResponse {
    pub response_type: String,
    pub boolean_evaluation_response: Option<BooleanEvaluationResponse>,
    pub variant_evaluation_response: Option<VariantEvaluationResponse>,
    pub error_evaluation_response: Option<ErrorEvaluationResponse>,
}

#[derive(uniffi::Record)]
pub struct BatchEvaluationResponse {
    pub responses: Vec<EvaluationResponse>,
    pub request_duration_millis: f64,
}

#[derive(uniffi::Record)]
pub struct Flag {
    pub key: String,
    pub enabled: bool,
    pub flag_type: String,
    pub description: Option<String>,
}


#[derive(uniffi::Error, Debug)]
pub enum FliptError {
    Internal { message: String },
    UnknownFlag { message: String },
    InvalidRequest { message: String },
    ConnectionError { message: String },
}

// Helper function to format EvaluationReason enum to string
fn format_reason(reason: &flipt::EvaluationReason) -> String {
    match reason {
        flipt::EvaluationReason::FlagDisabled => "FLAG_DISABLED_EVALUATION_REASON".to_string(),
        flipt::EvaluationReason::Match => "MATCH_EVALUATION_REASON".to_string(),
        flipt::EvaluationReason::Default => "DEFAULT_EVALUATION_REASON".to_string(),
        flipt::EvaluationReason::Unknown => "UNKNOWN_EVALUATION_REASON".to_string(),
    }
}

// Helper function to format FlagType enum to string
fn format_flag_type(flag_type: &flipt::FlagType) -> String {
    match flag_type {
        flipt::FlagType::Variant => "VARIANT_FLAG_TYPE".to_string(),
        flipt::FlagType::Boolean => "BOOLEAN_FLAG_TYPE".to_string(),
    }
}

impl From<Error> for FliptError {
    fn from(err: Error) -> Self {
        match err {
            Error::Internal(msg) => FliptError::Internal { message: msg },
            Error::InvalidJSON(e) => FliptError::InvalidRequest { message: e.to_string() },
            Error::Server(_) => FliptError::ConnectionError { message: "Server connection error".to_string() },
            Error::Unknown(msg) => FliptError::Internal { message: msg },
            _ => FliptError::Internal { message: "Unknown error".to_string() },
        }
    }
}

impl std::fmt::Display for FliptError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            FliptError::Internal { message } => write!(f, "Internal error: {}", message),
            FliptError::UnknownFlag { message } => write!(f, "Unknown flag: {}", message),
            FliptError::InvalidRequest { message } => write!(f, "Invalid request: {}", message),
            FliptError::ConnectionError { message } => write!(f, "Connection error: {}", message),
        }
    }
}
