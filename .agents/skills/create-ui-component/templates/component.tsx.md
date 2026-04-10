<template>
```tsx
"use client";

import { IconName } from "@untitledui/icons";

// ── Types ────────────────────────────────────────────────────────────

export interface ComponentNameProps {
  /** Brief description of prop */
  title: string;
  /** Optional prop with default */
  variant?: "default" | "compact";
  /** Callback prop */
  onClick?: () => void;
}

// ── Component ────────────────────────────────────────────────────────

export function ComponentName({ title, variant = "default", onClick }: ComponentNameProps) {
  return (
    <div className="card p-5">
      {/* Icon — from @untitledui/icons */}
      <IconName size={20} className="text-text-muted" />

      {/* Heading — uses text-text-heading */}
      <h3 className="mt-3 font-medium text-text-heading">{title}</h3>

      {/* Body text — uses text-text-secondary */}
      <p className="mt-1 text-sm text-text-secondary">
        Description goes here
      </p>

      {/* Muted / meta text */}
      <span className="text-xs text-text-muted">Meta info</span>

      {/* Interactive element */}
      {onClick && (
        <button
          onClick={onClick}
          className="mt-3 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-interactive-hover hover:text-text-primary transition-colors"
        >
          Action
        </button>
      )}
    </div>
  );
}
```
</template>

<notes>
- Replace `IconName` with the actual icon from `@untitledui/icons`
- Replace `ComponentName` with the actual component name
- Remove `"use client"` only if the component is purely presentational (no hooks, no event handlers, no state)
- All colors use design tokens — never raw Tailwind colors
- No `dark:` prefix — CSS custom properties handle theming
- Prefer `.card`, `.btn-primary`, `.badge`, `.input` utility classes where they fit
- Export as named export (not default)
</notes>
