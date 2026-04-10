# Foundry Design Tokens — Tokens Studio Import

## Quick Start

### 1. Install Tokens Studio
Open Figma → Plugins → Search **"Tokens Studio for Figma"** → Install

### 2. Import Tokens

**Option A — Load from folder (local)**
1. Open the Tokens Studio plugin
2. Go to **Settings** (gear icon)
3. Under Token storage, choose **"Local document"**
4. Switch to **JSON view** (toggle at top-right of Tokens page)
5. You'll see a left panel for Token Sets — create three sets: `global`, `dark`, `light`
6. Paste each JSON file's contents into the corresponding set
7. Create a `$themes.json` by going to **Themes** and configuring as described below

**Option B — Sync from GitHub**
1. Push this `foundry-tokens/` folder to a GitHub repo
2. In Tokens Studio → Settings → Add new sync provider → **GitHub**
3. Point to the repo and folder path
4. The plugin auto-detects `$themes.json`, `global.json`, `dark.json`, `light.json`

### 3. Configure Themes

The `$themes.json` defines two themes:

| Theme | Global | Dark | Light |
|---|---|---|---|
| **Foundry / Midnight (Dark)** | Source ✓ | Enabled ✓ | Disabled |
| **Foundry / Light** | Source ✓ | Disabled | Enabled ✓ |

- **Source** = tokens are available as references but won't generate styles directly
- **Enabled** = tokens generate Figma styles/variables and can override source tokens

### 4. Apply to Figma

1. Select the **Foundry / Midnight (Dark)** theme
2. Click **"Create variables"** or **"Create styles"** from the export menu
3. The plugin generates:
   - **Color variables** for all surfaces, text, borders, status, interactive, component tokens
   - **Typography styles** for each type scale entry
   - **Number variables** for spacing, border-radius, sizing

---

## File Structure

```
foundry-tokens/
├── $themes.json     ← Theme configuration (which sets to enable)
├── global.json      ← Base tokens: brand colors, fonts, spacing, radius, sizing
├── dark.json        ← Dark theme: surfaces, text, shadows, component tokens
├── light.json       ← Light theme: overrides for light mode
└── README.md        ← This file
```

## Token Architecture

### global.json (Source)
Base-level tokens with no theme dependency:
- `brandBlue.50–900` — The full blue scale (Ice → Ink)
- `semantic.*` — Raw status colors for both modes
- `fontFamily.*` — Instrument Serif, DM Sans, DM Mono
- `fontWeight.*`, `fontSize.*`, `lineHeight.*`, `letterSpacing.*`
- `typography.*` — Composite tokens (font + size + weight + line-height)
- `spacing.1–24` — 4px base grid
- `borderRadius.sm–full`
- `sizing.*` — Icons, max-widths, gutter
- `opacity.*` — Interactive state levels

### dark.json / light.json (Themed)
Semantic tokens that reference globals and switch per theme:
- `surface.*` — Page, default, raised, elevated, overlay
- `border.*` — Default, subtle, accent, (strong in light)
- `text.*` — Primary, secondary, muted, link, wordmark, heading
- `accent.*` — Default, strong, subtle, muted, label
- `interactive.*` — Ghost, subtle, hover, active, glow
- `status.{success|warning|error|info}.{fg|bg|border}`
- `shadow.*` — sm, md, lg, glow, card, buttonHover, focusRing
- `component.*` — Button, badge, input, card, modal, nav, terminal, table, tooltip

### Key Design Decisions
- **Terminal component** tokens are identical in both themes (always dark)
- Light mode uses **deeper blues** (600–700) for accents instead of 300–400
- Light mode uses **deeper semantic colors** (e.g. `#16a34a` vs `#4ade80` for success)
- Blue opacity utilities use **blue-600 base** in light mode vs **blue-500 base** in dark

---

## Font Setup

Before using typography tokens, install the fonts in Figma:

1. **Instrument Serif** — [Google Fonts](https://fonts.google.com/specimen/Instrument+Serif) (Regular 400, Italic 400)
2. **DM Sans** — [Google Fonts](https://fonts.google.com/specimen/DM+Sans) (300, 400, 500, 600, 700)
3. **DM Mono** — [Google Fonts](https://fonts.google.com/specimen/DM+Mono) (300, 400, 500)

---

## Tips

- Use the **Themes** panel in Tokens Studio to quickly switch between dark and light while designing
- The `component.*` tokens map directly to Untitled UI React component props
- Reference tokens with `{curly.brace.syntax}` — e.g. a card background referencing `{surface.default}` will auto-switch between `#0a0e1a` (dark) and `#ffffff` (light)
- For Style Dictionary / code export, use [@tokens-studio/sd-transforms](https://github.com/tokens-studio/sd-transforms)
