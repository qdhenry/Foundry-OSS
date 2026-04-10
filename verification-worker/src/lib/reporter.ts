import type { Env } from "../types";

export async function updateVerificationStatus(
  env: Env,
  verificationId: string,
  update: {
    status: string;
    startedAt?: number;
    error?: string;
    durationMs?: number;
  }
): Promise<void> {
  const url = `${env.CONVEX_HTTP_URL}/api/verification/results`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.VERIFICATION_API_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        verificationId,
        type: "status_update",
        ...update,
      }),
    });
  } catch (err) {
    console.error("Failed to update verification status:", err);
  }
}

export async function uploadScreenshot(
  env: Env,
  buffer: ArrayBuffer
): Promise<string | null> {
  const url = `${env.CONVEX_HTTP_URL}/api/verification/screenshot`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.VERIFICATION_API_SECRET}`,
        "Content-Type": "application/octet-stream",
      },
      body: buffer,
    });
    const data = await response.json() as { storageId?: string };
    return data.storageId ?? null;
  } catch (err) {
    console.error("Failed to upload screenshot:", err);
    return null;
  }
}

interface ReportPayload {
  verificationId: string;
  status: "completed" | "failed";
  checks: Array<{
    type: string;
    description: string;
    status: string;
    route?: string;
    selector?: string;
    expected?: string;
    actual?: string;
    aiExplanation?: string;
  }>;
  screenshotStorageIds: Array<{
    storageId: string;
    route: string;
    label: string;
    viewport: { width: number; height: number };
    capturedAt: number;
    order: number;
  }>;
  aiSummary: string;
  durationMs: number;
}

export async function reportResults(
  env: Env,
  payload: Omit<ReportPayload, "screenshotStorageIds"> & {
    screenshots: Array<{
      buffer: ArrayBuffer;
      route: string;
      label: string;
      viewport: { width: number; height: number };
      capturedAt: number;
      order: number;
    }>;
  }
): Promise<void> {
  // Upload screenshots first
  const screenshotStorageIds: ReportPayload["screenshotStorageIds"] = [];
  for (const ss of payload.screenshots) {
    const storageId = await uploadScreenshot(env, ss.buffer);
    if (storageId) {
      screenshotStorageIds.push({
        storageId,
        route: ss.route,
        label: ss.label,
        viewport: ss.viewport,
        capturedAt: ss.capturedAt,
        order: ss.order,
      });
    }
  }

  // Report full results
  const url = `${env.CONVEX_HTTP_URL}/api/verification/results`;
  await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.VERIFICATION_API_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      verificationId: payload.verificationId,
      type: "final_results",
      status: payload.status,
      checks: payload.checks,
      screenshotStorageIds,
      aiSummary: payload.aiSummary,
      durationMs: payload.durationMs,
    }),
  });
}
