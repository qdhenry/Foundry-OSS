import puppeteer from "@cloudflare/puppeteer";
import type { Env } from "../types";
import type { NavigationPlan } from "./ai-service";
import { generateAiSummary } from "./ai-service";

interface ScreenshotCapture {
  buffer: ArrayBuffer;
  route: string;
  label: string;
  viewport: { width: number; height: number };
  capturedAt: number;
  order: number;
}

interface CheckResult {
  type: "visual" | "functional" | "accessibility" | "console_error" | "network_error";
  description: string;
  status: "passed" | "failed" | "warning" | "skipped";
  route?: string;
  selector?: string;
  expected?: string;
  actual?: string;
  aiExplanation?: string;
}

export interface VerificationResult {
  screenshots: ScreenshotCapture[];
  checks: CheckResult[];
  aiSummary: string;
}

export async function executeBrowserVerification(
  env: Env,
  baseUrl: string,
  plan: NavigationPlan,
  options?: {
    proxyOrigin?: string;
    proxyHeaders?: Record<string, string>;
  }
): Promise<VerificationResult> {
  const browser = await puppeteer.launch(env.BROWSER);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const screenshots: ScreenshotCapture[] = [];
  const checks: CheckResult[] = [];
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  let screenshotOrder = 0;

  // Collect console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  // Collect network failures
  page.on("requestfailed", (req) => {
    networkErrors.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  if (options?.proxyOrigin && options.proxyHeaders) {
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      try {
        const requestUrl = new URL(req.url());
        if (requestUrl.origin === options.proxyOrigin) {
          void req.continue({
            headers: {
              ...req.headers(),
              ...options.proxyHeaders,
            },
          });
          return;
        }
      } catch {
        // Fall through for non-HTTP(S) requests (data:, about:, etc.)
      }
      void req.continue();
    });
  }

  // Execute navigation plan
  for (const route of plan.routes) {
    const fullUrl = `${baseUrl}${route.url}`;

    try {
      await page.goto(fullUrl, { waitUntil: "networkidle0", timeout: 15000 });

      if (route.waitFor) {
        try {
          await page.waitForSelector(route.waitFor, { timeout: 10000 });
        } catch {
          checks.push({
            type: "functional",
            description: `Expected element "${route.waitFor}" on ${route.url}`,
            status: "failed",
            route: route.url,
            selector: route.waitFor,
            expected: "Element present",
            actual: "Element not found within 10s",
          });
        }
      }

      // Screenshot after page load
      const screenshot = await page.screenshot({ fullPage: true });
      screenshots.push({
        buffer: screenshot instanceof Buffer ? screenshot.buffer : screenshot as ArrayBuffer,
        route: route.url,
        label: route.description,
        viewport: { width: 1280, height: 800 },
        capturedAt: Date.now(),
        order: screenshotOrder++,
      });

      // Execute interactions
      if (route.interactions) {
        for (const interaction of route.interactions) {
          try {
            switch (interaction.action) {
              case "click":
                if (interaction.selector) {
                  await page.click(interaction.selector);
                }
                break;
              case "type":
                if (interaction.selector && interaction.value) {
                  await page.type(interaction.selector, interaction.value);
                }
                break;
              case "scroll":
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                break;
              case "wait":
                if (interaction.selector) {
                  await page.waitForSelector(interaction.selector, { timeout: 5000 });
                }
                break;
            }

            // Screenshot after interaction
            const postScreenshot = await page.screenshot({ fullPage: true });
            screenshots.push({
              buffer: postScreenshot instanceof Buffer ? postScreenshot.buffer : postScreenshot as ArrayBuffer,
              route: route.url,
              label: `After: ${interaction.description}`,
              viewport: { width: 1280, height: 800 },
              capturedAt: Date.now(),
              order: screenshotOrder++,
            });
          } catch (err: any) {
            checks.push({
              type: "functional",
              description: `Interaction failed: ${interaction.description}`,
              status: "warning",
              route: route.url,
              selector: interaction.selector,
              actual: err.message,
            });
          }
        }
      }

      checks.push({
        type: "functional",
        description: `Page loaded successfully: ${route.description}`,
        status: "passed",
        route: route.url,
      });
    } catch (err: any) {
      checks.push({
        type: "functional",
        description: `Failed to load: ${route.description}`,
        status: "failed",
        route: route.url,
        actual: err.message,
      });
    }
  }

  // Evaluate assertions
  for (const assertion of plan.assertions) {
    try {
      if (assertion.route) {
        await page.goto(`${baseUrl}${assertion.route}`, { waitUntil: "networkidle0", timeout: 15000 });
      }

      if (assertion.selector) {
        const element = await page.$(assertion.selector);
        if (element) {
          const text = await page.evaluate((el) => el.textContent?.trim() ?? "", element);
          const isMatch = assertion.expected
            ? text.toLowerCase().includes(assertion.expected.toLowerCase())
            : true;

          checks.push({
            type: assertion.type,
            description: assertion.description,
            status: isMatch ? "passed" : "failed",
            route: assertion.route,
            selector: assertion.selector,
            expected: assertion.expected,
            actual: text.slice(0, 200),
          });
        } else {
          checks.push({
            type: assertion.type,
            description: assertion.description,
            status: "failed",
            route: assertion.route,
            selector: assertion.selector,
            expected: "Element exists",
            actual: "Element not found",
          });
        }
      } else if (assertion.type === "visual") {
        checks.push({
          type: assertion.type,
          description: assertion.description,
          status: "skipped",
          route: assertion.route,
          actual: "Visual assertion could not be auto-verified because no selector was provided",
        });
      } else {
        checks.push({
          type: assertion.type,
          description: assertion.description,
          status: "failed",
          route: assertion.route,
          actual: "Assertion is missing a selector",
        });
      }
    } catch (err: any) {
      checks.push({
        type: assertion.type,
        description: assertion.description,
        status: "warning",
        route: assertion.route,
        actual: err.message,
      });
    }
  }

  // Console error check
  if (consoleErrors.length > 0) {
    checks.push({
      type: "console_error",
      description: `${consoleErrors.length} console error(s) detected`,
      status: "failed",
      actual: consoleErrors.slice(0, 10).join("\n"),
    });
  } else {
    checks.push({
      type: "console_error",
      description: "No console errors detected",
      status: "passed",
    });
  }

  // Network error check
  if (networkErrors.length > 0) {
    checks.push({
      type: "network_error",
      description: `${networkErrors.length} network failure(s) detected`,
      status: "failed",
      actual: networkErrors.slice(0, 10).join("\n"),
    });
  } else {
    checks.push({
      type: "network_error",
      description: "No network failures detected",
      status: "passed",
    });
  }

  await browser.close();

  // Generate AI summary
  const aiSummary = await generateAiSummary(env, checks, screenshots.length);

  return { screenshots, checks, aiSummary };
}
