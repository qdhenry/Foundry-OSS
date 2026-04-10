use crate::auth::keychain::KeychainStore;
use crate::commands::types::{ApiKeyResponse, SetApiKeyRequest};

#[tauri::command]
pub async fn get_api_key(provider: String) -> Result<ApiKeyResponse, String> {
    let key = KeychainStore::default().get_api_key(&provider).await?;

    Ok(ApiKeyResponse {
        provider,
        api_key: key,
    })
}

#[tauri::command]
pub async fn set_api_key(request: SetApiKeyRequest) -> Result<(), String> {
    KeychainStore::default()
        .set_api_key(&request.provider, &request.api_key)
        .await
}
