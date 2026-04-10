// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import tailWorker from "./tail-worker";

function makeEnv() {
  return {
    CONVEX_URL: "https://example.convex.cloud",
    SANDBOX_API_SECRET: "test-secret",
  };
}

function makeTraceItem(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      request: {
        url: "https://sandbox.example/sandbox/sbx-123/execute",
        method: "POST",
      },
      response: {
        cpuTime: 42,
        status: 200,
      },
    },
    eventTimestamp: 1700000000000,
    outcome: "ok",
    logs: [] as Array<{ level: string; message: unknown[]; timestamp: number }>,
    exceptions: [] as Array<{ name: string; message: string; timestamp: number }>,
    ...overrides,
  };
}

describe("tail-worker", () => {
  it("posts telemetry for sandbox routes", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);

    await tailWorker.tail([makeTraceItem()], makeEnv());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://example.convex.cloud/api/sandbox/tail-telemetry");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.sandboxId).toBe("sbx-123");
    expect(body.method).toBe("POST");
    expect(body.cpuTimeMs).toBe(42);
  });

  it("skips events without a request URL (non-HTTP events)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);

    await tailWorker.tail(
      [makeTraceItem({ event: { request: undefined, response: {} } })],
      makeEnv(),
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips events for non-sandbox routes (e.g., /health)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);

    const item = makeTraceItem({
      event: {
        request: { url: "https://sandbox.example/health", method: "GET" },
        response: { status: 200 },
      },
    });
    await tailWorker.tail([item], makeEnv());

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("extracts sandboxId from URL path", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);

    const item = makeTraceItem({
      event: {
        request: { url: "https://sandbox.example/sandbox/my-sandbox-42/logs", method: "GET" },
        response: {},
      },
    });
    await tailWorker.tail([item], makeEnv());

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.sandboxId).toBe("my-sandbox-42");
    expect(body.route).toBe("/sandbox/:id/logs");
  });

  it("truncates long log messages to 500 chars", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);

    const longMessage = "x".repeat(1000);
    const item = makeTraceItem({
      logs: [{ level: "log", message: longMessage, timestamp: 1700000000000 }],
    });
    await tailWorker.tail([item], makeEnv());

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.logs[0].message.length).toBeLessThanOrEqual(500);
  });

  it("truncates exception messages to 1000 chars", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);

    const longMessage = "e".repeat(2000);
    const item = makeTraceItem({
      exceptions: [{ name: "Error", message: longMessage, timestamp: 1700000000000 }],
    });
    await tailWorker.tail([item], makeEnv());

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.exceptions[0].message.length).toBeLessThanOrEqual(1000);
  });

  it("swallows fetch errors gracefully", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(tailWorker.tail([makeTraceItem()], makeEnv())).resolves.toBeUndefined();
  });

  it("processes multiple events", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchSpy);

    await tailWorker.tail(
      [
        makeTraceItem(),
        makeTraceItem({
          event: {
            request: { url: "https://sandbox.example/sandbox/sbx-456/logs", method: "GET" },
            response: {},
          },
        }),
      ],
      makeEnv(),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
