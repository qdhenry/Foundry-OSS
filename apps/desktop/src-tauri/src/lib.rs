pub mod auth;
pub mod cache;
pub mod commands;
pub mod execution;
pub mod process;
pub mod runtime;
pub mod streaming;
pub mod sync;
pub mod worktree;

#[cfg(debug_assertions)]
fn resolve_debug_mcp_socket_path() -> std::path::PathBuf {
    resolve_debug_mcp_socket_path_with(
        std::env::var("FOUNDRY_DESKTOP_MCP_SOCKET_PATH")
            .ok()
            .as_deref(),
        std::env::temp_dir(),
        std::process::id(),
    )
}

#[cfg(debug_assertions)]
fn resolve_debug_mcp_socket_path_with(
    env_override: Option<&str>,
    temp_dir: std::path::PathBuf,
    process_id: u32,
) -> std::path::PathBuf {
    if let Some(raw_path) = env_override {
        let trimmed = raw_path.trim();
        if !trimmed.is_empty() {
            return std::path::PathBuf::from(trimmed);
        }
    }

    temp_dir.join(format!("foundry-desktop-tauri-mcp-{process_id}.sock"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default().invoke_handler(tauri::generate_handler![
        commands::session::create_session,
        commands::session::cancel_session,
        commands::session::restart_session,
        commands::session::get_session_status,
        commands::session::get_terminal_connection_info,
        commands::execution::start_execution,
        commands::execution::launch_local_session,
        commands::execution::send_chat_message,
        commands::worktree::create_worktree,
        commands::worktree::cleanup_worktree,
        commands::worktree::list_worktrees,
        commands::git::commit_push,
        commands::git::create_draft_pr,
        commands::git::checkout_branch,
        commands::keychain::get_api_key,
        commands::keychain::set_api_key,
        commands::filesystem::list_files,
        commands::filesystem::read_file,
        commands::filesystem::write_file,
        commands::filesystem::watch_changes,
        commands::ide::open_in_vscode,
        commands::ide::open_in_cursor,
        commands::system::check_prerequisites,
        commands::system::configure_convex_sync,
        commands::system::pick_directory,
        commands::streaming::get_ws_port,
    ]);

    #[cfg(debug_assertions)]
    {
        let mcp_socket_path = resolve_debug_mcp_socket_path();
        builder = builder.plugin(tauri_plugin_mcp::init_with_config(
            tauri_plugin_mcp::PluginConfig::new("Foundry Desktop".to_string())
                .socket_path(mcp_socket_path),
        ));
    }

    builder = builder.plugin(tauri_plugin_deep_link::init());
    builder = builder.plugin(tauri_plugin_shell::init());

    builder
        .run(tauri::generate_context!())
        .expect("failed to run Foundry desktop Tauri backend");
}

#[cfg(test)]
mod tests {
    #[cfg(debug_assertions)]
    use super::resolve_debug_mcp_socket_path_with;

    #[cfg(debug_assertions)]
    #[test]
    fn resolve_debug_mcp_socket_path_uses_env_override_when_present() {
        let resolved = resolve_debug_mcp_socket_path_with(
            Some(" /tmp/custom-mcp.sock "),
            std::path::PathBuf::from("/tmp"),
            42,
        );

        assert_eq!(resolved, std::path::PathBuf::from("/tmp/custom-mcp.sock"));
    }

    #[cfg(debug_assertions)]
    #[test]
    fn resolve_debug_mcp_socket_path_defaults_to_temp_dir_with_process_id() {
        let resolved =
            resolve_debug_mcp_socket_path_with(None, std::path::PathBuf::from("/tmp"), 4242);

        assert_eq!(
            resolved,
            std::path::PathBuf::from("/tmp/foundry-desktop-tauri-mcp-4242.sock")
        );
    }
}
