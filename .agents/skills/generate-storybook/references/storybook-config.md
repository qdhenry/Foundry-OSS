<overview>
Storybook configuration patterns specific to the Foundry stack: Next.js 15 (App Router) + React 19 + Tailwind CSS 4.1 + Convex + Clerk.
</overview>

<main_config>
**`.storybook/main.ts`:**

```typescript
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: [
    "../src/components/**/*.stories.@(ts|tsx)",
    "../src/app/**/*.stories.@(ts|tsx)",
  ],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y",
    "@storybook/addon-viewport",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (config) => {
    // Ensure Tailwind CSS 4.1 is processed
    return config;
  },
};

export default config;
```

**Key decisions:**
- Vite builder (not Webpack) for speed with React 19
- Story globs cover both `src/components/` and `src/app/`
- Addons: essentials (controls, actions, docs), interactions (play functions), a11y (accessibility), viewport (responsive)
</main_config>

<preview_config>
**`.storybook/preview.ts`:**

```typescript
import type { Preview } from "@storybook/react";
import "../src/app/globals.css"; // Tailwind CSS 4.1 entry point

const customViewports = {
  mobile: {
    name: "Mobile",
    styles: { width: "375px", height: "812px" },
  },
  tablet: {
    name: "Tablet",
    styles: { width: "768px", height: "1024px" },
  },
  desktop: {
    name: "Desktop",
    styles: { width: "1280px", height: "800px" },
  },
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      viewports: customViewports,
    },
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    // Global decorators applied to ALL stories
  ],
};

export default preview;
```

**Important:**
- Import `globals.css` which is the Tailwind CSS 4.1 entry point with `@theme` directives
- Define three viewport presets matching Foundry's responsive breakpoints
- Set `nextjs.appDirectory: true` for App Router compatibility
</preview_config>

<decorator_patterns>
**`.storybook/decorators/ConvexMockDecorator.tsx`:**

Wraps stories in a mock Convex environment. Since Foundry uses `useQuery` and `useMutation` from `convex/react`, the decorator must provide a mock client that:
- Returns empty arrays for list queries by default
- Returns null for single-document queries by default
- Accepts override mock data via story parameters
- Uses `fn()` from `@storybook/test` for mutation tracking

**`.storybook/decorators/ClerkMockDecorator.tsx`:**

Provides mock Clerk auth context with:
- A fake authenticated user (`userId: "user_test123"`)
- A fake organization (`orgId: "org_test456"`, `orgSlug: "acme-corp"`)
- `isLoaded: true`, `isSignedIn: true` states
- Stubs for `useUser()`, `useOrganization()`, `useAuth()`

**`.storybook/decorators/RouterDecorator.tsx`:**

Mocks Next.js 15 App Router hooks:
- `useParams()` returns `{ programId: "prog_test789" }` (override via story parameters)
- `useRouter()` returns `{ push: fn(), replace: fn(), back: fn(), refresh: fn() }`
- `usePathname()` returns `"/programs/prog_test789/dashboard"` (override via story parameters)
- `useSearchParams()` returns empty URLSearchParams
</decorator_patterns>

<dependencies>
**Required devDependencies:**

```json
{
  "@storybook/react": "^8.x",
  "@storybook/react-vite": "^8.x",
  "@storybook/addon-essentials": "^8.x",
  "@storybook/addon-interactions": "^8.x",
  "@storybook/addon-a11y": "^8.x",
  "@storybook/addon-viewport": "^8.x",
  "@storybook/test": "^8.x",
  "storybook": "^8.x"
}
```

All Storybook packages should be on the same major version (v8).
</dependencies>

<tailwind_integration>
**Tailwind CSS 4.1 with Storybook:**

Foundry uses CSS-first config via `@theme` directives (no `tailwind.config.js`). The Vite builder processes CSS automatically through PostCSS.

Ensure `.storybook/preview.ts` imports the app's CSS entry point:
```typescript
import "../src/app/globals.css";
```

This loads all `@theme` tokens, custom properties, and utility classes.

If Storybook fails to process Tailwind, add PostCSS config:
```typescript
// .storybook/main.ts viteFinal
viteFinal: async (config) => {
  config.css = {
    postcss: {
      plugins: [
        (await import("@tailwindcss/postcss")).default,
      ],
    },
  };
  return config;
},
```
</tailwind_integration>

<common_issues>
**Troubleshooting:**

1. **"Cannot find module 'convex/react'"** — Convex types need to be available. Add path aliases in Vite config matching `tsconfig.json` paths.

2. **Clerk provider errors** — The ClerkMockDecorator must fully stub the Clerk context. Do not use the real ClerkProvider in Storybook.

3. **Next.js router errors** — Always apply the RouterDecorator for components using `useParams`, `useRouter`, or `usePathname`.

4. **Tailwind classes not rendering** — Verify `globals.css` is imported in preview.ts and PostCSS is configured in Vite.

5. **React 19 compatibility** — Use Storybook v8.4+ which supports React 19. Check for `react-dom/client` import issues.
</common_issues>
