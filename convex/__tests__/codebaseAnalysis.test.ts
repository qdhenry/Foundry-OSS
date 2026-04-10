import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";

async function setupBaseData(t: any) {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("users", {
      clerkId: "test-user-1",
      email: "user1@example.com",
      name: "User One",
      orgIds: ["org-1"],
      role: "admin",
    });
  });

  await t.run(async (ctx: any) => {
    await ctx.db.insert("users", {
      clerkId: "test-user-2",
      email: "user2@example.com",
      name: "User Two",
      orgIds: ["org-2"],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-1",
      name: "Test Program",
      clientName: "Test Client",
      sourcePlatform: "none",
      targetPlatform: "none",
      phase: "build",
      status: "active",
    });
  });

  return { programId };
}

// ── create ───────────────────────────────────────────────────────────

describe("codebaseAnalysis.create", () => {
  test("inserts analysis with status='pending'", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const analysisId = await asUser.mutation(apiAny.codebaseAnalysis.create, {
      orgId: "org-1",
      programId,
      repoUrl: "https://github.com/test/repo",
      repoName: "test/repo",
    });

    expect(analysisId).toBeDefined();

    const analysis = await asUser.query(apiAny.codebaseAnalysis.get, {
      orgId: "org-1",
      analysisId,
    });
    expect(analysis.status).toBe("pending");
    expect(analysis.repoUrl).toBe("https://github.com/test/repo");
    expect(analysis.repoName).toBe("test/repo");
  });

  test("with wrong org throws 'Access denied'", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.codebaseAnalysis.create, {
        orgId: "org-1",
        programId,
        repoUrl: "https://github.com/test/repo",
        repoName: "test/repo",
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── listByProgram ────────────────────────────────────────────────────

describe("codebaseAnalysis.listByProgram", () => {
  test("returns analyses for correct org/program", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await asUser.mutation(apiAny.codebaseAnalysis.create, {
      orgId: "org-1",
      programId,
      repoUrl: "https://github.com/test/repo-a",
      repoName: "test/repo-a",
    });

    await asUser.mutation(apiAny.codebaseAnalysis.create, {
      orgId: "org-1",
      programId,
      repoUrl: "https://github.com/test/repo-b",
      repoName: "test/repo-b",
    });

    const analyses = await asUser.query(apiAny.codebaseAnalysis.listByProgram, {
      orgId: "org-1",
      programId,
    });
    expect(analyses).toHaveLength(2);

    // Cross-org access should throw
    const asOtherUser = t.withIdentity({ subject: "test-user-2" });
    await expect(
      asOtherUser.query(apiAny.codebaseAnalysis.listByProgram, {
        orgId: "org-1",
        programId,
      }),
    ).rejects.toThrow("Access denied");
  });
});

// ── get ──────────────────────────────────────────────────────────────

describe("codebaseAnalysis.get", () => {
  test("returns analysis by ID with all fields present", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const analysisId = await asUser.mutation(apiAny.codebaseAnalysis.create, {
      orgId: "org-1",
      programId,
      repoUrl: "https://github.com/test/repo",
      repoName: "test/repo",
    });

    const analysis = await asUser.query(apiAny.codebaseAnalysis.get, {
      orgId: "org-1",
      analysisId,
    });

    expect(analysis._id).toBe(analysisId);
    expect(analysis.orgId).toBe("org-1");
    expect(analysis.programId).toBe(programId);
    expect(analysis.repoUrl).toBe("https://github.com/test/repo");
    expect(analysis.repoName).toBe("test/repo");
    expect(analysis.status).toBe("pending");
    expect(analysis.createdAt).toBeTypeOf("number");
    expect(analysis.updatedAt).toBeTypeOf("number");
  });
});

// ── sendChatMessage ──────────────────────────────────────────────────

describe("codebaseAnalysis.sendChatMessage", () => {
  test("inserts user message", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const analysisId = await asUser.mutation(apiAny.codebaseAnalysis.create, {
      orgId: "org-1",
      programId,
      repoUrl: "https://github.com/test/repo",
      repoName: "test/repo",
    });

    await asUser.mutation(apiAny.codebaseAnalysis.sendChatMessage, {
      orgId: "org-1",
      analysisId,
      content: "What does this code do?",
    });

    const messages = await asUser.query(apiAny.codebaseAnalysis.getChatMessages, {
      orgId: "org-1",
      analysisId,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("What does this code do?");
    expect(messages[0].analysisId).toBe(analysisId);
  });
});

// ── getGraphInternal ─────────────────────────────────────────────────

describe("codebaseAnalysis.getGraphInternal", () => {
  test("returns nodes and edges", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const analysisId = await asUser.mutation(apiAny.codebaseAnalysis.create, {
      orgId: "org-1",
      programId,
      repoUrl: "https://github.com/test/repo",
      repoName: "test/repo",
    });

    // Directly insert 2 nodes and 1 edge
    const { nodeId1, nodeId2 } = await t.run(async (ctx: any) => {
      const nodeId1 = await ctx.db.insert("codebaseGraphNodes", {
        orgId: "org-1",
        analysisId,
        nodeType: "file",
        name: "index.ts",
        filePath: "/src/index.ts",
        layer: "api",
        description: "Main entry point",
        language: "typescript",
      });
      const nodeId2 = await ctx.db.insert("codebaseGraphNodes", {
        orgId: "org-1",
        analysisId,
        nodeType: "function",
        name: "handleRequest",
        filePath: "/src/handler.ts",
        layer: "service",
        description: "Handles incoming requests",
        language: "typescript",
      });
      return { nodeId1, nodeId2 };
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("codebaseGraphEdges", {
        orgId: "org-1",
        analysisId,
        sourceNodeId: nodeId1,
        targetNodeId: nodeId2,
        edgeType: "imports",
      });
    });

    const graph = await t.query(internalAny.codebaseAnalysis.getGraphInternal, { analysisId });

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].sourceNodeId).toBe(nodeId1);
    expect(graph.edges[0].targetNodeId).toBe(nodeId2);
  });
});

// ── getChatHistoryInternal ───────────────────────────────────────────

describe("codebaseAnalysis.getChatHistoryInternal", () => {
  test("returns messages in order", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const analysisId = await asUser.mutation(apiAny.codebaseAnalysis.create, {
      orgId: "org-1",
      programId,
      repoUrl: "https://github.com/test/repo",
      repoName: "test/repo",
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("codebaseChatMessages", {
        orgId: "org-1",
        analysisId,
        role: "user",
        content: "How does authentication work?",
        createdAt: 1000,
      });
      await ctx.db.insert("codebaseChatMessages", {
        orgId: "org-1",
        analysisId,
        role: "assistant",
        content: "Authentication uses JWT tokens via Clerk.",
        createdAt: 2000,
      });
    });

    const history = await t.query(internalAny.codebaseAnalysis.getChatHistoryInternal, {
      analysisId,
    });

    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({
      role: "user",
      content: "How does authentication work?",
    });
    expect(history[1]).toEqual({
      role: "assistant",
      content: "Authentication uses JWT tokens via Clerk.",
    });
  });
});

// ── updateStatus ─────────────────────────────────────────────────────

describe("codebaseAnalysis.updateStatus", () => {
  test("transitions status", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const analysisId = await asUser.mutation(apiAny.codebaseAnalysis.create, {
      orgId: "org-1",
      programId,
      repoUrl: "https://github.com/test/repo",
      repoName: "test/repo",
    });

    await t.mutation(internalAny.codebaseAnalysis.updateStatus, {
      analysisId,
      status: "scanning",
      currentStage: "Scanning repository structure...",
    });

    const analysis = await asUser.query(apiAny.codebaseAnalysis.get, {
      orgId: "org-1",
      analysisId,
    });

    expect(analysis.status).toBe("scanning");
    expect(analysis.currentStage).toBe("Scanning repository structure...");
  });
});

// ── storeGraphData ───────────────────────────────────────────────────

describe("codebaseAnalysis.storeGraphData", () => {
  test("inserts nodes and maps edges by index", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const analysisId = await asUser.mutation(apiAny.codebaseAnalysis.create, {
      orgId: "org-1",
      programId,
      repoUrl: "https://github.com/test/repo",
      repoName: "test/repo",
    });

    await t.mutation(internalAny.codebaseAnalysis.storeGraphData, {
      analysisId,
      orgId: "org-1",
      nodes: [
        {
          nodeType: "file",
          name: "app.ts",
          filePath: "/src/app.ts",
          layer: "api",
          description: "Application entry",
          language: "typescript",
        },
        {
          nodeType: "class",
          name: "UserService",
          filePath: "/src/services/user.ts",
          layer: "service",
          description: "User management service",
          language: "typescript",
        },
      ],
      edges: [
        {
          sourceIndex: 0,
          targetIndex: 1,
          edgeType: "imports",
        },
      ],
    });

    // Verify via getGraphInternal
    const graph = await t.query(internalAny.codebaseAnalysis.getGraphInternal, { analysisId });

    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes.find((n: any) => n.name === "app.ts")).toBeDefined();
    expect(graph.nodes.find((n: any) => n.name === "UserService")).toBeDefined();

    expect(graph.edges).toHaveLength(1);
    const edge = graph.edges[0];
    const sourceNode = graph.nodes.find((n: any) => n.name === "app.ts");
    const targetNode = graph.nodes.find((n: any) => n.name === "UserService");
    expect(edge.sourceNodeId).toBe(sourceNode._id);
    expect(edge.targetNodeId).toBe(targetNode._id);
    expect(edge.edgeType).toBe("imports");
  });
});
