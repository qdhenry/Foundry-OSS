import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type ConvexMcpConfig, createConvexMcpTools } from "./convex-mcp-server.js";

describe("createConvexMcpTools", () => {
  const config: ConvexMcpConfig = {
    convexUrl: "https://test-deployment.convex.cloud",
    deploymentToken: "test-deployment-token",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 5 MCP tools", () => {
    const tools = createConvexMcpTools(config);

    expect(tools).toHaveLength(5);
    expect(tools.map((t) => t.name)).toEqual([
      "get_requirement_context",
      "get_team_members",
      "get_sprint_data",
      "get_active_skills",
      "get_program_context",
    ]);
  });

  it("each tool has name, description, inputSchema, and execute", () => {
    const tools = createConvexMcpTools(config);

    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe("string");
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe("string");
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.inputSchema).toBe("object");
      expect(tool.execute).toBeDefined();
      expect(typeof tool.execute).toBe("function");
    }
  });

  it("get_requirement_context calls Convex API with correct path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: "req_1", title: "Test Req" }]),
      }),
    );

    const tools = createConvexMcpTools(config);
    const tool = tools.find((t) => t.name === "get_requirement_context")!;

    const result = await tool.execute({ programId: "prog_1" });

    expect(fetch).toHaveBeenCalledWith(
      "https://test-deployment.convex.cloud/api/query",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-deployment-token",
        }),
        body: JSON.stringify({
          path: "requirements:listByProgram",
          args: { programId: "prog_1" },
        }),
      }),
    );

    expect(result).toEqual([{ id: "req_1", title: "Test Req" }]);
  });

  it("get_requirement_context passes optional workstreamId", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    const tools = createConvexMcpTools(config);
    const tool = tools.find((t) => t.name === "get_requirement_context")!;

    await tool.execute({ programId: "prog_1", workstreamId: "ws_1" });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          path: "requirements:listByProgram",
          args: { programId: "prog_1", workstreamId: "ws_1" },
        }),
      }),
    );
  });

  it("get_team_members calls correct Convex function", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    const tools = createConvexMcpTools(config);
    const tool = tools.find((t) => t.name === "get_team_members")!;

    await tool.execute({ programId: "prog_1" });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          path: "teamMembers:listByProgram",
          args: { programId: "prog_1" },
        }),
      }),
    );
  });

  it("get_sprint_data calls correct Convex function", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    const tools = createConvexMcpTools(config);
    const tool = tools.find((t) => t.name === "get_sprint_data")!;

    await tool.execute({ programId: "prog_1", sprintId: "sprint_1" });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          path: "sprintGates:listByProgram",
          args: { programId: "prog_1", sprintId: "sprint_1" },
        }),
      }),
    );
  });

  it("get_active_skills calls correct Convex function", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      }),
    );

    const tools = createConvexMcpTools(config);
    const tool = tools.find((t) => t.name === "get_active_skills")!;

    await tool.execute({ programId: "prog_1" });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          path: "skills:listByProgram",
          args: { programId: "prog_1" },
        }),
      }),
    );
  });

  it("get_program_context calls correct Convex function", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "prog_1", name: "Test Program" }),
      }),
    );

    const tools = createConvexMcpTools(config);
    const tool = tools.find((t) => t.name === "get_program_context")!;

    const result = await tool.execute({ programId: "prog_1" });

    expect(result).toEqual({ id: "prog_1", name: "Test Program" });
  });

  it("throws on Convex API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      }),
    );

    const tools = createConvexMcpTools(config);
    const tool = tools.find((t) => t.name === "get_program_context")!;

    await expect(tool.execute({ programId: "prog_1" })).rejects.toThrow(
      "Convex API error: 500 Internal Server Error",
    );
  });
});
