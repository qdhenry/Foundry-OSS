

# Untitled UI React — LLM Guidance Document

## What is Untitled UI React?

Untitled UI React is described as the world's largest collection of open-source React components, built with Tailwind CSS and React Aria. Unlike a traditional npm library installed as a dependency, Untitled UI React works by injecting source code directly into your project — you own every file and can modify it freely. There is no vendor lock-in and no third-party package to maintain.

The library is split into a **free/open-source tier** (MIT licensed, usable in unlimited commercial projects) and a **PRO tier** (one-time purchase) with significantly more components, page examples, and dashboard templates.

---

## Tech Stack

- **React** v19.1
- **Tailwind CSS** v4.1
- **TypeScript** v5.8
- **React Aria** v1.9 (Adobe) — provides WAI-ARIA accessible primitives

These are the only hard requirements. No other third-party packages are required for core components (though some individual components may require additional deps, which the CLI installs automatically).

---

## Architecture Philosophy

- **Code ownership**: Components are added as source files to your project, not as installed packages.
- **No lock-in**: Modify, extend, or delete any component as you see fit.
- **Semantic color tokens**: All colors reference CSS variables (e.g., `bg-primary`, `text-secondary`) rather than hard-coded Tailwind palette classes, enabling effortless dark mode.
- **Accessibility baseline**: All components are built on React Aria — keyboard navigation, focus trapping, and ARIA roles are handled out of the box.

---

## CLI Tool

The CLI is the primary mechanism for scaffolding projects and installing components. It requires no global installation — use `npx` or `bunx` directly.

### CLI Invocation Pattern

```bash
npx untitledui@latest <command> [options]
# or
bunx untitledui@latest <command> [options]
```

---

## CLI Commands Reference

### 1. `init` — Scaffold a New Project

Creates a brand-new project with all Untitled UI configurations pre-installed.

```bash
# Create a new Next.js project
npx untitledui@latest init --nextjs

# Create a new Vite project
npx untitledui@latest init --vite

# Create a named Next.js project in one shot
npx untitledui@latest init my-app --nextjs
```

**Interactive prompts during init:**
```
? What is your project named? › untitled-ui
? Which color would you like to use as the brand color?
  ❯ brand
    error
    warning
    success
    gray-neutral
    moss
    green
    teal
    blue
    (+ more)
```

**`init` command options:**

| Option | Description |
|---|---|
| `--nextjs` | Initialize a Next.js project |
| `--vite` | Initialize a Vite project |
| `-c, --color <color-name>` | Specify a brand color (non-interactive) |
| `-o, --overwrite` | Overwrite existing files |
| `--colors-list` | List all available brand color options |

After init, the directory will contain a complete project with Next.js (or Vite), Tailwind CSS v4, the `theme.css` file, `globals.css`, utility files, and pre-installed base components.

---

### 2. `add` — Add Components to an Existing Project

Adds one or more components into an existing project.

```bash
# Add a single component
npx untitledui@latest add button

# Add multiple components at once
npx untitledui@latest add button toggle avatar

# Interactive mode (no component specified — prompts for type and component)
npx untitledui@latest add
```

**Interactive prompts when no component is specified:**
```
? What type of component are you adding?
  ❯ base
    marketing
    shared-assets
    application
    foundations

? Which components would you like to add?
  ❯ ◯ button
    ◯ card
    ◯ dropdown
    ◯ input
    ◯ modal
    ◯ table
    (navigate with arrow keys, select with spacebar, confirm with Enter)
```

**`add` command options:**

| Option | Description |
|---|---|
| `-a, --all` | Add all available components |
| `-o, --overwrite` | Overwrite existing component files |
| `-p, --path <path>` | Specify where to install the component (e.g., `src/components`) |
| `-d, --dir <directory>` | Specify the project root directory |
| `-t, --type <type>` | Filter by component type: `base`, `marketing`, `shared-assets`, `application`, `foundations` |
| `--include-all-components` | Automatically include all base components without prompting |
| `-y, --yes` | Non-interactive mode — use defaults for all prompts (ideal for AI agents and CI/CD) |

**Important flags for AI/automated contexts:** The `--yes` (`-y`) flag suppresses all interactive prompts, making it safe to use in non-interactive pipelines.

```bash
# Update an existing component to the latest version
npx untitledui@latest add button --overwrite

# Install to a custom path
npx untitledui@latest add button --path src/components/ui

# Fully non-interactive
npx untitledui@latest add button --yes
```

---

### 3. `login` — Authenticate for PRO Components

```bash
npx untitledui@latest login
```

This opens a browser window, checks if you are signed in to untitledui.com, and either authenticates immediately or prompts a magic link flow. Credentials are saved locally and persist across CLI sessions — you only need to log in once per machine.

After logging in, PRO components are accessible via the same `add` command:

```bash
npx untitledui@latest login
npx untitledui@latest add <pro-component-name>
```

---

### 4. `example` — Add Complete Page Examples

Adds fully functional page templates (dashboards, settings pages, landing pages, etc.) to your project, including all required components and dependencies.

```bash
# Interactive example selection
npx untitledui@latest example

# Add a specific named example
npx untitledui@latest example dashboards-01

# Add a specific variant of an example
npx untitledui@latest example dashboards-01/01
```

**Interactive prompts:**
```
? Select which type of example you want to add
  ❯ Application
    Marketing
```

**`example` command options:**

| Option | Description |
|---|---|
| `-o, --overwrite` | Overwrite existing files |
| `-p, --path <path>` | Path to install component files |
| `-e, --example-path <path>` | Path to install the example page file |
| `--include-all-components` | Include all components from the example without prompting |
| `-y, --yes` | Non-interactive mode |

**What gets added:**
- The main page file (e.g., in `app/` or `pages/`)
- All required components
- All required npm dependencies
- Properly configured imports

---

## Component Categories and CLI Names

Component names for the `add` command follow the URL slug pattern from the docs site. The CLI type categories are:

### Base Components (free, open-source)

These are foundational primitives. CLI type: `base`

| Component | CLI Name |
|---|---|
| Buttons | `button` |
| Button Groups | `button-groups` |
| Badges | `badges` |
| Badge Groups | `badge-groups` |
| Tags | `tags` |
| Dropdowns | `dropdowns` |
| Select | `select` |
| Inputs | `inputs` |
| Textareas | `textareas` |
| Verification Code Inputs | `verification-code-inputs` |
| Text Editors | `text-editors` |
| Toggles | `toggles` |
| Checkboxes | `checkboxes` |
| Radio Buttons | `radio-buttons` |
| Radio Groups | `radio-groups` |
| Avatars | `avatars` |
| Tooltips | `tooltips` |
| Progress Indicators | `progress-indicators` |
| Sliders | `sliders` |
| Social Buttons | `social-buttons` |
| Mobile App Store Buttons | `mobile-app-store-buttons` |
| Utility Buttons | `utility-buttons` |
| Featured Icons | `featured-icons` |

### Application UI Components

These are more complex UI blocks. CLI type: `application`

| Component | CLI Name |
|---|---|
| Modals | `modal` |
| Command Menus (⌘K) | `command-menu` |
| Tables | `table` |
| Date Pickers | `date-pickers` |
| Calendars | `calendars` |
| File Uploaders | `file-uploaders` |
| Sidebar Navigations | `sidebar-navigations` |
| Header Navigations | `header-navigations` |
| Page Headers | `page-headers` |
| Card Headers | `card-headers` |
| Section Headers | `section-headers` |
| Section Footers | `section-footers` |
| Modals | `modals` |
| Line & Bar Charts | `line-bar-charts` |
| Activity Gauges | `activity-gauges` |
| Pie Charts | `pie-charts` |
| Radar Charts | `radar-charts` |
| Metrics | `metrics` |
| Slideout Menus | `slideout-menus` |
| Inline CTAs | `inline-ctas` |
| Pagination | `pagination` |
| Carousels | `carousels` |
| Progress Steps | `progress-steps` |
| Activity Feeds | `activity-feeds` |
| Messaging | `messaging` |
| Tabs | `tabs` |
| Breadcrumbs | `breadcrumbs` |
| Alerts | `alerts` |
| Notifications | `notifications` |
| Loading Indicators | `loading-indicators` |
| Empty States | `empty-states` |
| Code Snippets | `code-snippets` |
| QR Codes | `qr-codes` |
| Illustrations | `illustrations` |
| Rating Badge & Stars | `rating-badge-and-stars` |
| Credit Cards | `credit-cards` |

---

## Manual Installation (Without the CLI)

For projects that cannot use the CLI, manual setup requires:

### Step 1: Install npm packages

```bash
npm install @untitledui/icons react-aria-components tailwindcss-react-aria-components tailwind-merge tailwindcss-animate
```

### Step 2: Create `styles/theme.css`

Add the full `@theme { ... }` block with all CSS variables for colors (brand, gray, error, warning, success, etc.), typography sizes, breakpoints, radius, shadow, and animation tokens. This is a large file — see the docs at `https://www.untitledui.com/react/docs/installation` for the complete listing.

### Step 3: Update `globals.css`

```css
@import "tailwindcss";
@import "./theme.css";
@plugin "tailwindcss-animate";
@plugin "tailwindcss-react-aria-components";
@custom-variant dark (&:where(.dark-mode, .dark-mode *));
@custom-variant label (& [data-label]);
@custom-variant focus-input-within (&:has(input:focus));
@utility scrollbar-hide { /* hides scrollbars cross-browser */ }
@utility transition-inherit-all { /* inherits transition from parent */ }
```

### Step 4: Create utility files

- `utils/cx.ts` — a wrapper around `tailwind-merge` extended with custom text display size tokens
- `utils/is-react-component.ts`
- `hooks/use-breakpoint.ts`
- `hooks/use-clipboard.ts`

### Step 5: Copy component source code

Copy the component `.tsx` files from the individual component pages on the Untitled UI docs site directly into your project.

---

## Theming

### Brand Color at Init Time

During `npx untitledui@latest init`, you choose a brand color from a set of named palettes (brand/purple default, error/red, warning/yellow, success/green, gray-neutral, moss, green, teal, blue, indigo, violet, fuchsia, pink, rose, orange, cyan, etc.).

### Changing Brand Color After Setup

Remap the `--color-brand-*` CSS variables to any color palette in `theme.css`:

```css
@theme {
  --color-brand-25: var(--color-rose-25);
  --color-brand-50: var(--color-rose-50);
  /* ... through -950 */
}
```

All components use `bg-brand-*`, `text-brand-*`, `border-brand-*` semantic classes that automatically resolve to the current brand color.

---

## Dark Mode

Dark mode is implemented via a CSS class toggle — no JavaScript framework dependency required.

- Add class `dark-mode` to any element (including `<html>` or `<body>`) to activate dark mode for that subtree.
- All semantic color tokens (e.g., `bg-primary`, `text-secondary`, `border-primary`) automatically flip to their dark counterparts.
- Light mode class: `light-mode`
- You can mix light and dark regions on the same page by scoping these classes to individual containers.

```tsx
// Entire app in dark mode
<html className="dark-mode">

// Single dark section within a light page
<div className="dark-mode">
  <MyComponent />
</div>
```

---

## Icon System

### Free Icons (`@untitledui/icons`)

```bash
npm install @untitledui/icons
```

1,100+ line-style icons. Import from the main package (tree-shaking supported):

```tsx
import { Home01, Settings01, User01, Bell01 } from "@untitledui/icons";

<Home01 className="size-5" />
<Settings01 className="size-5 text-brand-600" strokeWidth={1.5} aria-hidden="true" />
```

Or individual file imports for older bundlers:

```tsx
import Home01 from "@untitledui/icons/Home01";
```

### PRO Icons (`@untitledui-pro/icons`)

4,600+ icons across 4 styles: `line`, `solid`, `duocolor`, `duotone`.

Setup requires a private npm token in `.npmrc`:

```
@untitledui-pro:registry=https://pkg.untitledui.com
//pkg.untitledui.com/:_authToken=YOUR_TOKEN_HERE
```

```bash
npm install @untitledui-pro/icons
```

```tsx
import { Home01 } from "@untitledui-pro/icons/line";
import { Home01 } from "@untitledui-pro/icons/solid";
import { Home01 } from "@untitledui-pro/icons/duocolor";
import { Home01 } from "@untitledui-pro/icons/duotone";
```

---

## MCP (Model Context Protocol) Integration

Untitled UI provides an MCP server that allows Claude Code, Cursor, Codex, and Gemini CLI to browse, search, and install components directly using natural language.

### Setup for Claude Code

```bash
# OAuth (recommended — no API key needed)
claude mcp add --transport http untitledui https://www.untitledui.com/react/api/mcp

# With API key (for non-OAuth clients)
claude mcp add --transport http untitledui https://www.untitledui.com/react/api/mcp \
  --header "Authorization: Bearer YOUR_API_KEY"
```

**Manual config (`~/.claude.json`):**

```json
{
  "mcpServers": {
    "untitledui": {
      "type": "http",
      "url": "https://www.untitledui.com/react/api/mcp"
    }
  }
}
```

**Prerequisite:** A project must first be initialized via `npx untitledui init`.

### MCP Server Tools

| Tool | Purpose |
|---|---|
| `list_components` | Browse components by category with pagination |
| `search_components` | Search by functionality/keywords |
| `get_component` | Install a single component |
| `get_component_bundle` | Install multiple components at once |
| `get_page_templates` | Browse page templates (PRO) |
| `get_page_template_files` | Install a complete page template (PRO) |

### MCP Resources

| Resource URI | Content |
|---|---|
| `untitledui://components` | All components |
| `untitledui://components/base` | Core UI components |
| `untitledui://components/application` | Complex app components |
| `untitledui://components/marketing` | Marketing sections |
| `untitledui://templates` | Complete page templates |
| `untitledui://examples` | Usage examples |

---

## `components.json` Configuration File

An optional config file placed at the project root that tells the CLI how to resolve import aliases and where to place files.

```json
{
  "aliases": {
    "components": "@/components/",
    "utils": "@/utils/",
    "hooks": "@/hooks/",
    "styles": "@/styles/"
  },
  "examples": "app"
}
```

Aliases **must** be valid `tsconfig.json` path aliases — relative paths (e.g., `../../components`) will not work. The CLI reads but never writes to this file.

Useful for monorepos with a shared UI package:

```json
{
  "aliases": {
    "components": "@workspace/ui/components/",
    "utils": "@workspace/ui/utils/",
    "hooks": "@workspace/ui/hooks/",
    "styles": "@workspace/ui/styles/"
  },
  "examples": "../../apps/web"
}
```

---

## Free vs PRO Components

| Feature | Free | PRO |
|---|---|---|
| Base UI components | ✅ | ✅ |
| Application components (tables, charts, date pickers) | ✅ | ✅ |
| Advanced marketing sections | ❌ | ✅ |
| Modal / slideout / command menu variants | Some | All |
| 250+ page examples (dashboards, settings, landing pages) | ❌ | ✅ |
| Shared assets (login/signup/404 pages) | ❌ | ✅ |
| Lifetime updates | ❌ | ✅ |
| npm PRO icons (4 styles) | ❌ | ✅ |

Free components are MIT licensed. PRO is a one-time purchase (no subscription).

---

## Typical Workflows

### Start a new Next.js project from scratch

```bash
npx untitledui@latest init my-app --nextjs
cd my-app
npm run dev
```

### Add components to an existing project

```bash
# Ensure you have Tailwind CSS 4 set up and theme.css/globals.css configured
npx untitledui@latest add button input modal
```

### Update a component to the latest version

```bash
npx untitledui@latest add button --overwrite
```

### Add all base components at once

```bash
npx untitledui@latest add --all --type base
```

### Install a dashboard example page (PRO)

```bash
npx untitledui@latest login
npx untitledui@latest example dashboards-01/01 --yes
```

### Non-interactive / AI agent usage

```bash
npx untitledui@latest add button modal table --yes
```

---

## Key URLs

| Resource | URL |
|---|---|
| Framework home | `https://www.untitledui.com/react` |
| Introduction docs | `https://www.untitledui.com/react/docs/introduction` |
| Installation guide | `https://www.untitledui.com/react/docs/installation` |
| CLI reference | `https://www.untitledui.com/react/docs/cli` |
| Theming guide | `https://www.untitledui.com/react/docs/theming` |
| Dark mode guide | `https://www.untitledui.com/react/docs/dark-mode` |
| Icons guide | `https://www.untitledui.com/react/docs/icons` |
| Next.js integration | `https://www.untitledui.com/react/integrations/nextjs` |
| Vite integration | `https://www.untitledui.com/react/integrations/vite` |
| MCP integration | `https://www.untitledui.com/react/integrations/mcp` |
| components.json | `https://www.untitledui.com/react/integrations/components-json` |
| GitHub repo | `https://github.com/untitleduico/react` |
| All components browser | `https://www.untitledui.com/react/components` |
