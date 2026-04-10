"use node";

const DEFAULT_TIMEOUT_MS = 120_000;

export async function callAgentService<T>({
  endpoint,
  body,
  orgId,
  timeoutMs,
}: {
  endpoint: string;
  body: Record<string, unknown>;
  orgId: string;
  timeoutMs?: number;
}): Promise<T> {
  const baseUrl = process.env.AGENT_SERVICE_URL;
  if (!baseUrl) {
    throw new Error(
      "AGENT_SERVICE_URL environment variable is not set. " +
        "Set it via: npx convex env set AGENT_SERVICE_URL http://localhost:3001",
    );
  }

  const url = `${baseUrl}${endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);

  // Production: authenticate with bearer token when AGENT_SERVICE_SECRET is set
  // Local dev: skip bearer auth (Express agent-service doesn't require it)
  const secret = process.env.AGENT_SERVICE_SECRET;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-org-id": orgId,
    ...(secret && { Authorization: `Bearer ${secret}` }),
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorDetail: string;
      try {
        const errorBody = (await response.json()) as {
          error?: { code?: string; message?: string };
        };
        errorDetail =
          errorBody.error?.message ??
          `${errorBody.error?.code ?? "UNKNOWN"}: HTTP ${response.status}`;
      } catch {
        errorDetail = `HTTP ${response.status} ${response.statusText}`;
      }
      throw new Error(`Agent service ${endpoint} failed: ${errorDetail}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `Agent service ${endpoint} timed out after ${timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
