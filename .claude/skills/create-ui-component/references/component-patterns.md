<overview>
Patterns extracted from existing Foundry components. Use these as templates when building similar UI.
</overview>

<status_badge_maps>
For components that render different styles per status:

```typescript
const statusStyles: Record<string, string> = {
  on_track: "bg-status-success-bg text-status-success-fg border border-status-success-border",
  at_risk: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  blocked: "bg-status-error-bg text-status-error-fg border border-status-error-border",
  pending: "bg-status-info-bg text-status-info-fg border border-status-info-border",
};
```

Or use the `.badge-*` utility classes:
```tsx
<span className={`badge badge-${status}`}>{label}</span>
// .badge-success, .badge-warning, .badge-error, .badge-info
```
</status_badge_maps>

<status_dot>
Small colored dots indicating status:
```tsx
<span className="inline-block h-2 w-2 rounded-full bg-status-success-fg" />
<span className="inline-block h-2 w-2 rounded-full bg-status-warning-fg" />
<span className="inline-block h-2 w-2 rounded-full bg-status-error-fg" />
```

Or use `.status-dot` + `.status-dot-success` etc. from globals.css.
</status_dot>

<card_structure>
Using utility class (preferred for standard cards):
```tsx
<div className="card p-5">
  <h3 className="text-text-heading font-medium">{title}</h3>
  <p className="mt-1 text-sm text-text-secondary">{description}</p>
</div>
```

Interactive card:
```tsx
<div className="card card-interactive p-5 cursor-pointer">
  {/* content */}
</div>
```

Inline card (without utility class):
```tsx
<div className="rounded-xl border border-border-default bg-surface-default p-5">
  {/* content */}
</div>
```

See `src/components/dashboard/KpiCards.tsx` for a complete example.
</card_structure>

<interactive_hover>
For list items, nav items, and interactive rows:
```tsx
<button className="flex items-center gap-2 rounded-md px-3 py-2 text-text-secondary hover:bg-interactive-hover hover:text-text-primary transition-colors">
  <IconName size={16} className="text-text-muted" />
  <span>Label</span>
</button>
```
</interactive_hover>

<loading_skeleton>
```tsx
// Skeleton block
<div className="animate-pulse rounded-lg bg-surface-raised h-4 w-3/4" />

// Skeleton card
<div className="card p-5">
  <div className="animate-pulse space-y-3">
    <div className="rounded bg-surface-raised h-4 w-1/3" />
    <div className="rounded bg-surface-raised h-3 w-full" />
    <div className="rounded bg-surface-raised h-3 w-2/3" />
  </div>
</div>

// Full loading overlay
<div className="flex items-center justify-center py-12">
  <div className="animate-spin h-6 w-6 rounded-full border-2 border-accent-default border-t-transparent" />
</div>
```
</loading_skeleton>

<empty_state>
```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <IconName size={24} className="text-text-muted" />
  <p className="mt-3 text-sm text-text-secondary">No items found</p>
  <p className="mt-1 text-xs text-text-muted">Create your first item to get started.</p>
</div>
```
</empty_state>

<terminal_surface>
Terminal components use dedicated tokens (always dark):
```tsx
<div className="rounded-lg border border-comp-terminal-border bg-comp-terminal-bg p-4 font-mono">
  <span className="text-comp-terminal-timestamp text-xs">12:34:05</span>
  <span className="text-comp-terminal-agent ml-2">[agent]</span>
  <span className="text-comp-terminal-text ml-2">Processing task...</span>
  <span className="text-comp-terminal-success ml-2">Done</span>
</div>
```
</terminal_surface>

<tooltip_pattern>
Using group-hover for simple tooltips:
```tsx
<div className="group relative">
  <button>Hover me</button>
  <div className="tooltip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap">
    Tooltip text
  </div>
</div>
```

Or use the `.tooltip` utility class from globals.css.
</tooltip_pattern>

<icon_usage>
Icons come from `@untitledui/icons` — import individually:
```tsx
import { Grid01, AlertTriangle, Activity, ChevronRight } from "@untitledui/icons";

// Standard sizes
<Grid01 size={16} className="text-text-muted" />    // Small
<Grid01 size={20} className="text-text-secondary" /> // Default
<Grid01 size={24} className="text-accent-default" /> // Large

// In a button
<button className="flex items-center gap-2">
  <Activity size={16} />
  <span>Label</span>
</button>
```
</icon_usage>

<kpi_card>
From `KpiCards.tsx`:
```tsx
<div className="rounded-xl border border-border-default bg-surface-default p-5">
  <Icon size={20} className="text-text-muted" />
  <p className="mt-3 text-sm text-text-secondary">{label}</p>
  <p className="mt-1 text-2xl font-bold text-text-heading">{value}</p>
  <div className="mt-1 text-xs text-text-muted">{subtitle}</div>
</div>
```
</kpi_card>

<form_pattern>
```tsx
<div className="space-y-4">
  <div>
    <label className="form-label">Field Label</label>
    <input className="input" placeholder="Enter value..." />
    <p className="form-helper">Helper text explaining the field.</p>
  </div>
  <div>
    <label className="form-label">Another Field</label>
    <textarea className="textarea" rows={3} placeholder="Enter description..." />
  </div>
  <div className="flex justify-end gap-3">
    <button className="btn-secondary btn-sm">Cancel</button>
    <button className="btn-primary btn-sm">Save</button>
  </div>
</div>
```
</form_pattern>
