---
name: check-design-system
description: Focused design system compliance check on recent changes or specific files. Use when reviewing UI work for token usage, component classes, typography, and color violations.
---

<objective>
Check design system compliance on recently changed or user-specified files. Reports token usage, component class adherence, typography consistency, dark mode patterns, and color violations.
</objective>

<process>

<step_1>
**Determine scope:**
- If user specified files, use those
- Otherwise, get recently changed files: run `git diff --name-only HEAD~1` filtered to `src/**/*.tsx` and `src/**/*.css`
- If no recent changes, ask user which files to check
</step_1>

<step_2>
**Read the design token source:**
Read `src/app/globals.css` to confirm current token definitions (they may have been updated).
</step_2>

<step_3>
**Check each file for violations using Grep and Read:**

1. **Arbitrary color values** — `text-[#...]`, `bg-[#...]`, `border-[#...]` etc.
2. **Purple/violet colors** — Forbidden per UI rules
3. **dark: prefix in className** — Should use `.dark` CSS selector (Tailwind 4 CSS-first)
4. **Hardcoded spacing/radius** — Should use CSS custom properties (`var(--spacing-*)`, `var(--radius-*)`)
5. **Missing component utility classes** — Manual button/badge/card styling instead of `.btn-*`, `.badge-*`, `.card-*`
6. **Typography inconsistency** — Manual font-size instead of `.type-*` classes
</step_3>

<step_4>
**Report findings:**
Present violations grouped by file with specific line references and suggested fixes using the correct design tokens or component classes.

Include a compliance score: `X/Y checks passed`
</step_4>

</process>

<success_criteria>
- All target files scanned
- Each violation has a file:line reference
- Suggested fix uses the correct design token or component class
- Compliance score reported
</success_criteria>
