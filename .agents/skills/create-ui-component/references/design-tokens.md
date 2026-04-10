<overview>
Complete reference of all available Foundry design tokens. All tokens are defined as CSS custom properties in `src/app/globals.css` and mapped to Tailwind utility classes via `@theme inline`. The token system handles light/dark theming automatically — never use `dark:` prefix.

Source: `src/app/globals.css` `:root` (light) and `.dark` (dark) definitions.
</overview>

<surfaces>
Background colors for containers and layers.

| Token class | Usage |
|---|---|
| `bg-surface-page` | Page background (outermost) |
| `bg-surface-default` | Default container background (cards, panels) |
| `bg-surface-raised` | Raised elements (hover states, secondary panels) |
| `bg-surface-elevated` | Elevated elements (dropdowns, popovers) |
| `bg-surface-overlay` | Overlay backdrop (modal/dialog behind) |
</surfaces>

<text_tokens>
| Token class | Usage |
|---|---|
| `text-text-primary` | Primary body text |
| `text-text-secondary` | Secondary / supporting text |
| `text-text-muted` | Muted / disabled text, timestamps, placeholders |
| `text-text-link` | Link text (default state) |
| `text-text-link-hover` | Link text (hover state) |
| `text-text-on-brand` | Text on brand-colored backgrounds (white) |
| `text-text-wordmark` | Wordmark / logo text |
| `text-text-heading` | Heading text (slightly different from primary) |
</text_tokens>

<borders>
| Token class | Usage |
|---|---|
| `border-border-default` | Standard border |
| `border-border-subtle` | Subtle / light border (dividers) |
| `border-border-accent` | Accent border (blue tint) |
| `border-border-strong` | Strong / emphasized border |
</borders>

<accent_brand>
| Token class | Usage |
|---|---|
| `text-accent-default` / `bg-accent-default` | Primary accent color |
| `text-accent-strong` / `bg-accent-strong` | Stronger accent (darker blue) |
| `text-accent-subtle` / `bg-accent-subtle` | Lighter accent |
| `text-accent-muted` / `bg-accent-muted` | Most muted accent |
| `text-accent-label` | Accent for labels |
</accent_brand>

<interactive_states>
For hover/active backgrounds on interactive elements.

| Token class | Usage |
|---|---|
| `bg-interactive-ghost` | Ghost element background (barely visible) |
| `bg-interactive-subtle` | Subtle interactive background |
| `bg-interactive-hover` | Hover state background |
| `bg-interactive-active` | Active / pressed state background |
| `bg-interactive-glow` | Glow effect background |
</interactive_states>

<status_colors>
Each status has three variants: foreground (text/icon), background, and border.

| Status | Text/Icon | Background | Border |
|---|---|---|---|
| Success | `text-status-success-fg` | `bg-status-success-bg` | `border-status-success-border` |
| Warning | `text-status-warning-fg` | `bg-status-warning-bg` | `border-status-warning-border` |
| Error | `text-status-error-fg` | `bg-status-error-bg` | `border-status-error-border` |
| Info | `text-status-info-fg` | `bg-status-info-bg` | `border-status-info-border` |
</status_colors>

<component_tokens>

BUTTON (comp-btn-*):
| Token class | Usage |
|---|---|
| `bg-comp-btn-primary-bg` / `text-comp-btn-primary-text` | Primary button |
| `bg-comp-btn-secondary-bg` / `text-comp-btn-secondary-text` / `border-comp-btn-secondary-border` | Secondary button |
| `bg-comp-btn-ghost-bg` / `text-comp-btn-ghost-text` | Ghost button |
Prefer using `.btn-primary`, `.btn-secondary`, `.btn-ghost` utility classes from globals.css.

BADGE (comp-badge-*):
| Token class | Usage |
|---|---|
| `bg-comp-badge-bg` / `text-comp-badge-text` / `border-comp-badge-border` | Default badge |
Prefer using `.badge` utility class + status variants (`.badge-success`, `.badge-warning`, `.badge-error`, `.badge-info`).

INPUT (comp-input-*):
| Token class | Usage |
|---|---|
| `bg-comp-input-bg` / `text-comp-input-text` / `border-comp-input-border` | Input fields |
| `text-comp-input-placeholder` | Placeholder text |
| `border-comp-input-focus-border` | Focus state border |
Prefer using `.input`, `.textarea`, `.select` utility classes.

CARD (comp-card-*):
| Token class | Usage |
|---|---|
| `bg-comp-card-bg` / `border-comp-card-border` | Card container |
| `bg-comp-card-hover-bg` / `border-comp-card-hover-border` | Card hover state |
Prefer using `.card` and `.card-interactive` utility classes.

MODAL (comp-modal-*):
`bg-comp-modal-bg` / `border-comp-modal-border` — or use `.modal` utility class.

NAV (comp-nav-*):
`bg-comp-nav-bg` / `border-comp-nav-border`

TERMINAL (comp-terminal-*) — Always dark:
| Token class | Usage |
|---|---|
| `bg-comp-terminal-bg` / `border-comp-terminal-border` | Terminal container |
| `text-comp-terminal-timestamp` | Timestamps |
| `text-comp-terminal-agent` | Agent name text |
| `text-comp-terminal-value` | Values |
| `text-comp-terminal-success` | Success messages |
| `text-comp-terminal-text` | General terminal text |

TABLE (comp-table-*):
| Token class | Usage |
|---|---|
| `text-comp-table-header-text` | Table header text |
| `text-comp-table-cell-text` | Table cell text |
| `text-comp-table-cell-emphasis` | Emphasized cell text |
| `bg-comp-table-row-hover` | Row hover background |
| `border-comp-table-divider` | Row dividers |
Prefer using `.table-header`, `.table-cell`, `.table-cell-emphasis`, `.table-row-hover` utility classes.

TOOLTIP (comp-tooltip-*):
`bg-comp-tooltip-bg` / `border-comp-tooltip-border` / `text-comp-tooltip-text` — or use `.tooltip` utility class.

</component_tokens>

<brand_scale>
For rare cases needing specific brand blue shades (prefer semantic tokens above):
`brand-50` through `brand-900` (mapped from `--brand-blue-*`)
</brand_scale>

<typography>
| Class | Font | Weight | Size | Use |
|---|---|---|---|---|
| `.type-display-xl` | Instrument Serif | 400 | 4rem | Hero headings |
| `.type-display-l` | Instrument Serif | 400 | 2.8rem | Page titles |
| `.type-display-m` | Instrument Serif | 400 | 1.55rem | Section headings |
| `.type-body-l` | DM Sans | 300 | 1.1rem | Large body text |
| `.type-body-m` | DM Sans | 300 | 0.88rem | Default body text |
| `.type-body-s` | DM Sans | 400 | 0.82rem | Small body text |
| `.type-caption` | DM Sans | 500 | 0.72rem | Uppercase captions (0.12em tracking) |
| `.type-wordmark` | DM Sans | 600 | 1.4rem | Wordmark/logo (uppercase, 0.08em tracking) |
| `.type-button` | DM Sans | 500 | 0.85rem | Button text |
| `.type-input` | DM Sans | 400 | 0.85rem | Input text |
| `.type-label` | DM Sans | 500 | 0.75rem | Form labels |
| `.type-code` | DM Mono | 400 | 0.72rem | Code / monospace |
</typography>

<border_radius>
| Class | Value |
|---|---|
| `rounded-sm` | 6px |
| `rounded-md` | 10px |
| `rounded-lg` | 14px |
| `rounded-xl` | 16px |
| `rounded-2xl` | 20px |
| `rounded-full` | 9999px |
</border_radius>

<shadows>
| Class | Usage |
|---|---|
| `shadow-sm` | Subtle shadow (inputs, small elements) |
| `shadow-md` | Medium shadow (dropdowns, hover cards) |
| `shadow-lg` | Large shadow (modals, dialogs) |
| `shadow-glow` | Blue glow effect |
| `shadow-card` | Card shadow (subtle) |
| `shadow-button-hover` | Button hover shadow (blue tint) |
| `shadow-focus-ring` | Focus ring shadow |
</shadows>
