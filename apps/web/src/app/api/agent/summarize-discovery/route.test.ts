import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("POST /api/agent/summarize-discovery", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: null, orgId: null });
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/agent/summarize-discovery", {
      method: "POST",
      body: JSON.stringify({ programId: "p1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("proxies request to agent service when authenticated", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1", orgId: "org_1" });
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ summary: "test" }),
      status: 200,
    });
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/agent/summarize-discovery", {
      method: "POST",
      body: JSON.stringify({ programId: "p1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBe("test");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("forwards orgId header when present", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1", orgId: "org_123" });
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({}),
      status: 200,
    });
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/agent/summarize-discovery", {
      method: "POST",
      body: JSON.stringify({}),
    });
    await POST(req);
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[1].headers["x-org-id"]).toBe("org_123");
  });
});
