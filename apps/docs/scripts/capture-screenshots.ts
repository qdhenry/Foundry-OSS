import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { type ScreenshotEntry, screenshots } from "./screenshot-manifest";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const { values: args } = parseArgs({
  options: {
    filter: { type: "string", short: "f" },
    "base-url": { type: "string", short: "b" },
  },
  strict: false,
});

const BASE_URL = args["base-url"] || process.env.E2E_BASE_URL || "http://localhost:3000";
const AUTH_STATE_PATH = resolve(import.meta.dirname, "../../../e2e/.auth/user.json");
const OUTPUT_ROOT = resolve(import.meta.dirname, "../public/screenshots/generated");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function log(msg: string) {
  console.log(`[screenshots] ${msg}`);
}

function warn(msg: string) {
  console.warn(`[screenshots] WARN: ${msg}`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
async function authenticate(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>,
) {
  const email = process.env.E2E_CLERK_USER_EMAIL;
  const password = process.env.E2E_CLERK_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_CLERK_USER_EMAIL and E2E_CLERK_USER_PASSWORD env vars are required when no auth state file exists",
    );
  }

  log("Authenticating via Clerk sign-in flow...");
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "networkidle" });

  // Clerk sign-in: email field, continue, password field, continue
  await page.fill('input[name="identifier"]', email);
  await page.click('button:has-text("Continue")');
  await page.waitForSelector('input[name="password"]', { timeout: 10000 });
  await page.fill('input[name="password"]', password);
  await page.click('button:has-text("Continue")');

  // Wait for redirect away from sign-in
  await page.waitForURL("**/programs**", { timeout: 30000 });
  log("Authentication successful");
}

// ---------------------------------------------------------------------------
// Program ID detection
// ---------------------------------------------------------------------------
async function detectProgramId(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>,
): Promise<string> {
  await page.goto(`${BASE_URL}/programs`, { waitUntil: "networkidle" });

  // Look for a link whose href contains a UUID-shaped segment
  const uuidPattern = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

  // Also accept Convex document IDs (alphanumeric strings)
  const convexIdPattern = /\/([a-z0-9]{16,})\/?/i;

  const links = await page.$$eval("a[href]", (els) =>
    els.map((el) => el.getAttribute("href") ?? ""),
  );

  for (const href of links) {
    const uuidMatch = href.match(uuidPattern);
    if (uuidMatch) {
      return uuidMatch[1];
    }
  }

  // Fallback: Convex-style IDs
  for (const href of links) {
    const convexMatch = href.match(convexIdPattern);
    if (convexMatch) {
      return convexMatch[1];
    }
  }

  throw new Error("Could not detect a program ID from /programs page. Is the app seeded?");
}

// ---------------------------------------------------------------------------
// Screenshot capture
// ---------------------------------------------------------------------------
async function captureEntry(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>,
  entry: ScreenshotEntry,
  programId: string,
): Promise<{ light: boolean; dark: boolean }> {
  const url = `${BASE_URL}${entry.url.replace("[programId]", programId)}`;
  const sectionDir = resolve(OUTPUT_ROOT, entry.section);
  ensureDir(sectionDir);

  const result = { light: false, dark: false };

  // Navigate
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

  // Wait for specific selector or settle
  if (entry.waitFor) {
    await page.waitForSelector(entry.waitFor, { timeout: 15000 });
  }

  // Small settle delay for animations
  await sleep(500);

  // Light mode screenshot
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await sleep(300);
  await page.screenshot({
    path: resolve(sectionDir, `${entry.slug}-light.png`),
    fullPage: false,
  });
  result.light = true;

  // Dark mode screenshot
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await sleep(500);
  await page.screenshot({
    path: resolve(sectionDir, `${entry.slug}-dark.png`),
    fullPage: false,
  });
  result.dark = true;

  // Restore light mode
  await page.evaluate(() => document.documentElement.classList.remove("dark"));

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Seed guard
  if (!process.env.SKIP_SEED) {
    warn(
      "SKIP_SEED is not set. Make sure AcmeCorp seed data has been loaded before capturing screenshots.",
    );
  }

  // Filter entries
  const filterPattern = typeof args.filter === "string" ? args.filter : undefined;
  const entries = filterPattern
    ? screenshots.filter((s) => s.slug.includes(filterPattern))
    : screenshots;

  if (entries.length === 0) {
    log(`No entries match filter "${filterPattern}". Nothing to capture.`);
    process.exit(0);
  }

  log(`Capturing ${entries.length} screenshot(s) → ${OUTPUT_ROOT}`);
  ensureDir(OUTPUT_ROOT);

  // Launch browser
  const hasAuthState = existsSync(AUTH_STATE_PATH);
  const browser = await chromium.launch({ headless: true });
  const context = hasAuthState
    ? await browser.newContext({
        storageState: AUTH_STATE_PATH,
        viewport: { width: 1440, height: 900 },
      })
    : await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });

  const page = await context.newPage();

  // Authenticate if no stored state
  const needsAuth = entries.some((e) => e.auth);
  if (needsAuth && !hasAuthState) {
    await authenticate(page);
  }

  // Detect program ID
  let programId = "";
  const needsProgramId = entries.some((e) => e.url.includes("[programId]"));
  if (needsProgramId) {
    log("Detecting program ID from /programs...");
    programId = await detectProgramId(page);
    log(`Using program ID: ${programId}`);
  }

  // Capture loop
  let captured = 0;
  let failed = 0;
  const skipped = 0;
  const maxRetries = 3;
  const retryDelay = 2000;

  for (const entry of entries) {
    // Resize viewport if entry overrides default
    await page.setViewportSize(entry.viewport);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log(
          `[${captured + failed + skipped + 1}/${entries.length}] ${entry.section}/${entry.slug}${attempt > 1 ? ` (retry ${attempt})` : ""}`,
        );
        await captureEntry(page, entry, programId);
        captured++;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (attempt < maxRetries) {
          warn(`Attempt ${attempt} failed for ${entry.slug}: ${msg}`);
          await sleep(retryDelay * attempt);
        } else {
          warn(`FAILED after ${maxRetries} attempts: ${entry.slug} — ${msg}`);
          failed++;
        }
      }
    }
  }

  await browser.close();

  // Summary
  console.log("\n--- Screenshot Summary ---");
  console.log(`  Captured: ${captured} (x2 light/dark = ${captured * 2} files)`);
  console.log(`  Failed:   ${failed}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Total:    ${entries.length}`);
  console.log(`  Output:   ${OUTPUT_ROOT}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[screenshots] Fatal error:", err);
  process.exit(1);
});
