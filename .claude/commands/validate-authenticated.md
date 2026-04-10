---
description: Authenticate via Clerk in Chrome and visually validate an authenticated feature using browser automation
allowed-tools: Bash, Read, Glob, Grep, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__tabs_create_mcp, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__read_page, mcp__claude-in-chrome__find, mcp__claude-in-chrome__form_input, mcp__claude-in-chrome__computer, mcp__claude-in-chrome__javascript_tool, mcp__claude-in-chrome__get_page_text, mcp__claude-in-chrome__read_console_messages, mcp__claude-in-chrome__read_network_requests, mcp__claude-in-chrome__gif_creator, mcp__claude-in-chrome__resize_window, mcp__claude-in-chrome__upload_image
argument-hint: <url-or-feature-to-validate> [description of what to check]
---

# Validate Authenticated Feature

Authenticate through Clerk in a live Chrome browser session, then navigate to and visually inspect an authenticated feature. Use this when you need to verify UI, behavior, or data rendering behind Clerk auth.

## Variables

VALIDATION_TARGET: $ARGUMENTS
APP_BASE_URL: http://localhost:3000
SIGN_IN_PATH: /sign-in

## Pre-Flight

Before starting browser automation:

1. **Read `.env.local`** to find `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — confirms Clerk is configured
2. **Read `src/middleware.ts`** to understand which routes are protected vs public
3. **Read `src/app/sign-in/[[...sign-in]]/page.tsx`** (or equivalent) to understand the sign-in component and post-auth redirect

## Workflow

### Step 1: Get Browser Context

Call `mcp__claude-in-chrome__tabs_context_mcp` to see what tabs are currently open. Look for:
- An existing tab already on the app (may already be authenticated)
- An existing tab on the sign-in page

If no suitable tab exists, create one with `mcp__claude-in-chrome__tabs_create_mcp`.

### Step 2: Check Authentication State

Navigate to the target authenticated page (or `APP_BASE_URL/programs` as a default check).

- **If the page loads with content** — you are already authenticated. Skip to Step 4.
- **If redirected to sign-in** — proceed to Step 3.

Use `mcp__claude-in-chrome__read_page` or `mcp__claude-in-chrome__get_page_text` to determine which state you are in.

### Step 3: Authenticate via Clerk

Clerk uses its embedded `<SignIn>` component. The sign-in flow:

1. Navigate to `APP_BASE_URL/sign-in`
2. Wait for the Clerk sign-in form to render (look for email/identifier input)
3. **Ask the user for credentials** — do NOT guess or hardcode credentials. Use this exact prompt:

   > I need to sign in through Clerk to access the authenticated pages. Could you provide the test account credentials (email and password) to use?

4. Once credentials are provided:
   - Use `mcp__claude-in-chrome__form_input` to fill the email/identifier field
   - Click "Continue" or the submit button with `mcp__claude-in-chrome__computer` (click action)
   - Wait for the password field to appear (Clerk uses a two-step flow)
   - Fill the password field
   - Click "Continue" / "Sign in"
5. Wait for redirect to the authenticated area (default: `/programs`)
6. Verify authentication succeeded by checking the page content

**Clerk Sign-In Gotchas:**
- Clerk renders inside an iframe or shadow DOM — if `find` doesn't locate elements, try using `javascript_tool` to query within Clerk's container
- The form may have a "Continue" button between email and password steps
- There may be social login buttons above the email field — target the email input specifically
- If bot detection blocks you, inform the user they may need to use a Testing Token or add `__clerk_testing_token` to the URL

### Step 4: Navigate to Validation Target

Parse `VALIDATION_TARGET` to determine where to navigate:

- If it's a URL path (starts with `/`), navigate to `APP_BASE_URL` + path
- If it's a full URL, navigate directly
- If it's a feature name, map it to the likely route based on the app structure:
  - "programs" → `/programs`
  - "documents" → `/{programId}/documents`
  - "discovery" → `/{programId}/discovery`
  - "requirements" → `/{programId}/requirements`
  - "workstreams" → `/{programId}/workstreams`
- If unclear, navigate to `/programs` and explore from there

### Step 5: Visual Inspection

Once on the target page, perform thorough validation:

1. **Screenshot** — Take a screenshot using `mcp__claude-in-chrome__read_page` to capture current visual state
2. **Page content** — Use `get_page_text` to extract all rendered text
3. **Console errors** — Use `read_console_messages` with pattern filter for errors/warnings
4. **Network issues** — Use `read_network_requests` to check for failed API calls (4xx/5xx)
5. **Interactive elements** — Use `find` to verify key UI elements are present and properly rendered

If `VALIDATION_TARGET` includes a description of what to check, focus the inspection on those specific aspects.

### Step 6: Report Findings

Provide a clear validation report:

```
Validation Report: [feature/page name]
URL: [the URL inspected]
Auth: Authenticated as [user email]

Visual State:
- [what the page looks like, key elements present]

Issues Found:
- [any console errors, network failures, missing elements, visual bugs]
- OR "No issues found"

Screenshots: [if captured]

Verification:
- [specific checks performed and results]
```

## Error Handling

- **Clerk form not found:** The sign-in component may load asynchronously. Wait 2-3 seconds and retry. If still not found, check if the page uses a different auth flow.
- **Bot detection:** If Clerk shows a bot challenge, inform the user. They may need to manually complete it or provide a Testing Token.
- **Session expired mid-validation:** If a page suddenly returns to sign-in, re-authenticate and continue.
- **Page not loading:** Check `read_console_messages` and `read_network_requests` for errors. Confirm the dev server is running (`bun run dev`).
- **After 2-3 failed attempts** at any step, stop and ask the user for guidance instead of continuing to retry.

## Important Notes

- **NEVER hardcode or guess credentials.** Always ask the user.
- **NEVER trigger JavaScript alerts/confirms/prompts** — they block the browser extension.
- If the app uses Clerk organizations, the user may need to select an org after sign-in before accessing program data.
- Session state persists in the Chrome tab — once authenticated, you stay authenticated for subsequent navigation within the same tab.
