---
name: pre-commit-review
description: Comprehensive review of all staged changes before committing. Routes files to appropriate governance domains and produces a go/no-go recommendation. Use before committing significant changes.
---

<objective>
Review all staged changes before commit. Route each file to the appropriate governance domain for review. Produce a go/no-go recommendation with specific findings and required fixes.
</objective>

<process>

<step_1>
**Get staged files:**
Run `git diff --cached --name-only` to list all staged files.
If no files are staged, run `git diff --name-only` to show unstaged changes and inform the user.
</step_1>

<step_2>
**Classify files by domain:**
- `convex/**/*.ts` (not `_generated/`) → Security + Convex patterns
- `src/**/*.tsx` → Design system + Architecture
- `src/**/*.css` → Design system
- `src/app/**/page.tsx` or `layout.tsx` → Architecture (Next.js 15 patterns)
</step_2>

<step_3>
**Run domain-specific checks using Grep and Read:**

**Security checks** (convex files):
- `assertOrgAccess` or `getAuthUser` present in query/mutation handlers
- `.withIndex()` used (no bare `.filter()`)
- No direct `ctx.auth.getUserIdentity()`

**Convex checks** (convex files):
- camelCase naming for tables/functions
- `v.union(v.literal())` for enum fields
- Index coverage for new query patterns

**Design system checks** (src files):
- No arbitrary colors (`text-[#...]`, `bg-[#...]`), no purple/violet
- No `dark:` prefix in className
- CSS token usage for spacing/radius

**Architecture checks** (src files):
- PascalCase component files
- kebab-case route directories
- Awaited params in page.tsx/layout.tsx
</step_3>

<step_4>
**Produce recommendation:**

**GO** — No blocking violations found. List any warnings.

**NO-GO** — Blocking violations found. List each violation with:
- File and line number
- Rule violated (e.g., SEC-001, DS-002)
- Required fix
</step_4>

</process>

<success_criteria>
- All staged files classified and checked
- Clear GO or NO-GO recommendation
- Every blocking violation has a specific fix
- Warnings listed separately from blockers
</success_criteria>
