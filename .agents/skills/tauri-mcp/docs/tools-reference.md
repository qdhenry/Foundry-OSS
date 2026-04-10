# Tauri MCP Tools Reference

Detailed parameter documentation for all 10 MCP tools exposed by `tauri-plugin-mcp`.

## take_screenshot

Captures the current window state. Full resolution image is saved to disk; an optimized inline thumbnail is returned to the agent.

**Use when:** Visually inspecting UI state, verifying layout changes, debugging rendering issues.

**No required parameters** — captures the active window by default.

## query_page

Inspects the page DOM and application state. Supports multiple query modes.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `mode` | string | One of: `map`, `html`, `state`, `find_element`, `app_info` |
| `selector` | string | CSS selector or element reference (for `html`, `find_element` modes) |

**Modes:**
- `map` — Returns a structural map of the page (element tree with roles/types)
- `html` — Returns raw HTML of matched element(s)
- `state` — Returns current reactive state (form values, component state)
- `find_element` — Locates elements matching selector, returns refs for use in other tools
- `app_info` — Returns application metadata (name, version, window info)

## click

Clicks an element by coordinates or selector.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `x` | number | X coordinate (if using coordinates) |
| `y` | number | Y coordinate (if using coordinates) |
| `selector` | string | Element selector (alternative to coordinates) |
| `selector_type` | string | One of: `ref`, `id`, `class`, `tag`, `text` |

**Selector types:**
- `ref` — Element reference from `query_page` / `find_element`
- `id` — HTML element ID
- `class` — CSS class name
- `tag` — HTML tag name
- `text` — Text content match

## type_text

Types text into input fields, textareas, or contentEditable elements.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `fields` | array | Array of `{ selector, value, selector_type }` for bulk fill |
| `text` | string | Text to type (single field mode) |
| `selector` | string | Target element (single field mode) |

**Supports:** `<input>`, `<textarea>`, and `contentEditable` elements. Use `fields` array for filling multiple form fields in one call.

## mouse_action

Performs hover, scroll, and drag operations.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | One of: `hover`, `scroll`, `drag` |
| `x` | number | X coordinate |
| `y` | number | Y coordinate |
| `direction` | string | Scroll direction: `up`, `down`, `left`, `right` |
| `amount` | number | Scroll amount |
| `to_element` | string | Scroll to element selector |
| `drag_to_x` | number | Drag end X coordinate |
| `drag_to_y` | number | Drag end Y coordinate |

## navigate

Controls webview navigation.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | One of: `goto`, `back`, `forward`, `reload` |
| `url` | string | URL to navigate to (for `goto`) |
| `delta` | number | History steps for `back`/`forward` (default: 1) |

## execute_js

Runs arbitrary JavaScript in the webview context.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | JavaScript code to execute |

**Returns:** The value of the last expression, or resolved Promise value. Errors are returned as error objects.

## manage_storage

Manages localStorage and cookies.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `storage_type` | string | `localStorage` or `cookie` |
| `action` | string | `get`, `set`, `remove`, `clear`, `keys` |
| `key` | string | Storage key (for get/set/remove) |
| `value` | string | Value to set (for set) |

## manage_window

Controls the application window.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | One of: `list`, `focus`, `minimize`, `maximize`, `close`, `position`, `size`, `fullscreen` |
| `x` | number | X position (for `position`) |
| `y` | number | Y position (for `position`) |
| `width` | number | Width (for `size`) |
| `height` | number | Height (for `size`) |
| `zoom` | number | Zoom level |
| `devtools` | boolean | Toggle devtools |

## wait_for

Waits for a condition to be met before continuing.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `condition` | string | Condition type (see below) |
| `selector` | string | Element selector |
| `text` | string | Text to wait for |
| `timeout` | number | Max wait time in ms |

**Conditions:**
- `text_appears` — Wait for text to appear on page
- `text_disappears` — Wait for text to disappear
- `visible` — Wait for element to become visible
- `hidden` — Wait for element to become hidden
- `attached` — Wait for element to be added to DOM
- `detached` — Wait for element to be removed from DOM
