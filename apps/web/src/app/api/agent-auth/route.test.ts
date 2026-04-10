import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("/api/agent-auth", () => {
  beforeEach(() => {
    vi.resetModules();
    mockAuth.mockReset();
    mockFetch.mockReset();
  });

  describe("GET", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const { GET } = await import("./route");
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("proxies to agent service auth/status", async () => {
      mockAuth.mockResolvedValue({ userId: "user_1" });
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ authenticated: true }),
        status: 200,
      });
      const { GET } = await import("./route");
      const res = await GET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
    });
  });

  describe("POST", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const { POST } = await import("./route");
      const req = new Request("http://localhost/api/agent-auth", {
        method: "POST",
        body: JSON.stringify({ apiKey: "key" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("proxies to agent service auth/api-key", async () => {
      mockAuth.mockResolvedValue({ userId: "user_1" });
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ saved: true }),
        status: 200,
      });
      const { POST } = await import("./route");
      const req = new Request("http://localhost/api/agent-auth", {
        method: "POST",
        body: JSON.stringify({ apiKey: "key" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue({ userId: null });
      const { DELETE } = await import("./route");
      const res = await DELETE();
      expect(res.status).toBe(401);
    });

    it("proxies to agent service auth/api-key delete", async () => {
      mockAuth.mockResolvedValue({ userId: "user_1" });
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve({ deleted: true }),
        status: 200,
      });
      const { DELETE } = await import("./route");
      const res = await DELETE();
      expect(res.status).toBe(200);
    });
  });
});
