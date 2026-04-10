---
name: tauri-mcp
description: Setup, configure, and manage the Tauri MCP plugin for AI agent debugging of the Foundry desktop app. Use when adding MCP support, configuring the MCP server, troubleshooting MCP connections, or when the user invokes /tauri-mcp.
version: 1.0.0
tags: [tauri, mcp, desktop, debugging, ai-agent]
---

# Tauri MCP Plugin Skill

Enables AI agents (Claude Code, Cursor) to interact with and debug the Foundry Tauri desktop app through screenshots, DOM access, input simulation, and more via the Model Context Protocol.

## When to Use

- Setting up the MCP plugin in the Tauri app
- Configuring Claude Code or Cursor to connect to the running desktop app
- Troubleshooting MCP connection issues (socket, TCP, auth)
- Adding or modifying MCP tools exposed to AI agents
- Debugging the desktop app via MCP inspector

## Project Context

The Foundry desktop app lives at `apps/desktop/`:
- **Rust backend:** `apps/desktop/src-tauri/` (Cargo workspace)
- **Frontend:** `apps/desktop/src/` (Vite + React 19)
- **Cargo.toml** already includes `tauri-plugin-mcp` as a git dependency

## Quick Reference

### Dependencies

**Rust** (already in `Cargo.toml`):
```toml
tauri-plugin-mcp = { git = "https://github.com/P3GLEG/tauri-plugin-mcp" }
```

**JS guest bindings** (install if needed):
```bash
bun add tauri-plugin-mcp -D --filter @foundry/desktop
```

**MCP server CLI** (for agent connection):
```bash
npx tauri-plugin-mcp-server
```

### Rust Plugin Registration

Register in `apps/desktop/src-tauri/src/lib.rs` — **dev builds only**:

```rust
#[cfg(debug_assertions)]
{
    builder = builder.plugin(tauri_plugin_mcp::init_with_config(
        tauri_plugin_mcp::PluginConfig::new("foundry-desktop".to_string())
            .start_socket_server(true)
            .socket_path("/tmp/foundry-mcp.sock")
    ));
}
```

**TCP mode** (alternative):
```rust
.plugin(tauri_plugin_mcp::init_with_config(
    tauri_plugin_mcp::PluginConfig::new("foundry-desktop".to_string())
        .tcp_localhost(4000)
        .auth_token("your-secret-token".to_string())
))
```

### Claude Code MCP Configuration

Add to `.claude/settings.json` or project MCP config:

**IPC mode (default, recommended):**
```json
{
  "mcpServers": {
    "tauri-mcp": {
      "command": "npx",
      "args": ["tauri-plugin-mcp-server"]
    }
  }
}
```

**Custom socket path:**
```json
{
  "mcpServers": {
    "tauri-mcp": {
      "command": "npx",
      "args": ["tauri-plugin-mcp-server"],
      "env": {
        "TAURI_MCP_IPC_PATH": "/tmp/foundry-mcp.sock"
      }
    }
  }
}
```

**TCP mode:**
```json
{
  "mcpServers": {
    "tauri-mcp": {
      "command": "npx",
      "args": ["tauri-plugin-mcp-server"],
      "env": {
        "TAURI_MCP_CONNECTION_TYPE": "tcp",
        "TAURI_MCP_TCP_HOST": "127.0.0.1",
        "TAURI_MCP_TCP_PORT": "4000"
      }
    }
  }
}
```

## Available MCP Tools

Once connected, AI agents have access to 10 tools:

| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| `take_screenshot` | Capture window screenshot | Full image saved to disk, inline thumbnail |
| `query_page` | DOM inspection | Modes: `map`, `html`, `state`, `find_element`, `app_info` |
| `click` | Click elements | By coordinates (x,y) or selector (ref, id, class, tag, text) |
| `type_text` | Fill text fields | `fields` array for bulk fill, supports contentEditable |
| `mouse_action` | Mouse operations | Hover, scroll (direction/amount), drag |
| `navigate` | Webview navigation | `goto` URL, `back`/`forward` (with delta), `reload` |
| `execute_js` | Run JavaScript | Arbitrary JS in webview context, returns result |
| `manage_storage` | Storage operations | localStorage get/set/remove/clear/keys, cookies |
| `manage_window` | Window control | List/focus/minimize/maximize/close/position/size/fullscreen, zoom, devtools |
| `wait_for` | Wait for conditions | Text appearing/disappearing, element visible/hidden/attached/detached |

See [docs/tools-reference.md](docs/tools-reference.md) for detailed parameter documentation.

## Setup Workflow

### 1. Register the Plugin (Rust)

Modify `apps/desktop/src-tauri/src/lib.rs` to register the plugin in `cfg(debug_assertions)` block. The builder chain needs to include the MCP plugin before `.run()`.

### 2. Install JS Guest Bindings (if using JS API)

```bash
cd apps/desktop && bun add tauri-plugin-mcp -D
```

### 3. Configure Agent MCP Server

Add the MCP server config to your Claude Code settings (`.claude/settings.json`) or Cursor settings.

### 4. Start the App and Verify

```bash
# Start the desktop app in dev mode
cd apps/desktop && bun run tauri dev

# In another terminal, test with MCP inspector
npx @modelcontextprotocol/inspector npx tauri-plugin-mcp-server
```

## Architecture

```
AI Agent (Claude Code / Cursor)
  ↓ stdio
MCP Server (tauri-plugin-mcp-server)
  ↓ IPC socket or TCP
Tauri Plugin (Rust: socket server, command routing, native input)
  ↓ Tauri events (correlation IDs)
Guest JS (DOM interaction, element resolution, form filling)
  ↓
DOM / Application
```

## Platform Notes

| Platform | Input Method | Screenshot Method |
|----------|-------------|-------------------|
| macOS | Native `NSEvent` injection (no Accessibility perms needed) | Native capture |
| Windows | JS fallback (~80% coverage, `isTrusted=false`) | Native capture |
| Linux | JS fallback (~80% coverage) | `xcap` library |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Connection refused | Verify the Tauri app is running with socket server enabled |
| Socket not found | Check socket path matches between Rust config and MCP server env |
| Auth failed (TCP) | Ensure `auth_token` matches in Rust config and MCP server env |
| Stale socket | Plugin auto-cleans stale sockets on startup; restart the app |
| No screenshot | Ensure the window is visible and not minimized |
| Tools not responding | Check that `#[cfg(debug_assertions)]` is active (dev build only) |

**Diagnostic command:**
```bash
npx @modelcontextprotocol/inspector npx tauri-plugin-mcp-server
```

## Security

- Plugin should **only** be registered in debug builds (`#[cfg(debug_assertions)]`)
- TCP mode requires auth token for non-loopback connections
- Auth tokens use constant-time comparison
- Token files are created with `0o600` permissions and cleaned up on shutdown
