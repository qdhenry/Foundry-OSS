use crate::commands::types::WsPortResponse;
use crate::streaming::ws_server::WebSocketServer;

#[tauri::command]
pub async fn get_ws_port() -> Result<WsPortResponse, String> {
    let port = WebSocketServer::default().ensure_started().await?;

    Ok(WsPortResponse { port })
}
