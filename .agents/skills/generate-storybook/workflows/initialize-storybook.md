<required_reading>
**Read these reference files NOW:**
1. references/storybook-config.md
</required_reading>

<process>

**Step 1: Install Storybook and dependencies**

Run the Storybook init command for the Foundry project:

```bash
npx storybook@latest init --type react --builder vite --skip-install
```

Then install the required dependencies:

```bash
npm install -D @storybook/react @storybook/react-vite @storybook/addon-essentials @storybook/addon-interactions @storybook/addon-a11y @storybook/test @storybook/addon-viewport storybook
```

**Step 2: Configure Storybook for Next.js 15 + Tailwind 4.1**

Read `references/storybook-config.md` and create/update these files:

1. `.storybook/main.ts` — Vite builder, story globs, addons (essentials, interactions, a11y, viewport)
2. `.storybook/preview.ts` — Global decorators for Tailwind CSS import, Clerk mock, Convex mock, viewport presets
3. `.storybook/preview-head.html` — If needed for font loading or global CSS

Story glob patterns:
```
"../src/components/**/*.stories.@(ts|tsx)",
"../src/app/**/*.stories.@(ts|tsx)"
```

**Step 3: Create mock providers**

Create `.storybook/decorators/` with:

1. `ConvexMockDecorator.tsx` — Wraps stories in a mock Convex provider that returns empty arrays/objects for queries. Uses `@storybook/test` `fn()` for mutations.
2. `ClerkMockDecorator.tsx` — Provides a mock Clerk context with a fake authenticated user and organization.
3. `RouterDecorator.tsx` — Wraps stories in Next.js App Router stubs (`useParams`, `useRouter`, `usePathname`).

**Step 4: Add npm scripts**

Add to `package.json`:
```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

**Step 5: Verify Storybook launches**

```bash
npm run storybook -- --ci
```

Confirm it starts without errors. If there are build errors, fix them before proceeding.

</process>

<success_criteria>
- All Storybook dependencies installed
- `.storybook/main.ts` configured with correct story globs and addons
- `.storybook/preview.ts` imports Tailwind globals and applies mock decorators
- Mock decorators created for Convex, Clerk, and Next.js router
- `npm run storybook` launches without errors
</success_criteria>
