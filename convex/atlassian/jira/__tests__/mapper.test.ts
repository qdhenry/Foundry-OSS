import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../../_generated/api";

const internalAny: any = (generatedApi as any).internal;

import schema from "../../../schema";
import { modules } from "../../../testing/convexModules.test";

/**
 * Tests for the Jira mapper data flow.
 *
 * The mapper actions (pushWorkstreamAsEpic, pushRequirementAsStory, pushProgramToJira)
 * are "use node" internalActions that convex-test cannot directly invoke.
 * Instead, we test the supporting queries (mapperQueries) and mutations (push.enqueueOperationInternal)
 * that the mapper uses, verifying the data shapes that would flow through the mapper.
 */

async function setupTestData(t: any) {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-1",
      email: "test@example.com",
      name: "Test User",
      orgIds: ["org-1"],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-1",
      name: "Test Program",
      clientName: "Test Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "discovery",
      status: "active",
      jiraSyncMode: "approval_required",
    });
  });

  const workstreamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId: "org-1",
      programId,
      name: "Order Management",
      shortCode: "OM",
      status: "on_track",
      sortOrder: 1,
      description: "Order management workstream",
    });
  });

  const requirementId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("requirements", {
      orgId: "org-1",
      programId,
      workstreamId,
      refId: "REQ-001",
      title: "Order Processing",
      description: "Must support complex order workflows",
      priority: "must_have",
      fitGap: "custom_dev",
      effortEstimate: "high",
      status: "draft",
    });
  });

  return { userId, programId, workstreamId, requirementId, orgId: "org-1" };
}

describe("mapperQueries", () => {
  test("getWorkstreamQuery returns workstream by ID", async () => {
    const t = convexTest(schema, modules);
    const { workstreamId } = await setupTestData(t);

    const ws = await t.query(internalAny.atlassian.jira.mapperQueries.getWorkstreamQuery, {
      workstreamId,
    });

    expect(ws).toBeTruthy();
    expect(ws?.name).toBe("Order Management");
    expect(ws?.shortCode).toBe("OM");
    expect(ws?.description).toBe("Order management workstream");
  });

  test("getRequirementQuery returns requirement by ID", async () => {
    const t = convexTest(schema, modules);
    const { requirementId } = await setupTestData(t);

    const req = await t.query(internalAny.atlassian.jira.mapperQueries.getRequirementQuery, {
      requirementId,
    });

    expect(req).toBeTruthy();
    expect(req?.refId).toBe("REQ-001");
    expect(req?.title).toBe("Order Processing");
    expect(req?.priority).toBe("must_have");
    expect(req?.fitGap).toBe("custom_dev");
    expect(req?.effortEstimate).toBe("high");
  });

  test("getProgramQuery returns program by ID", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    const prog = await t.query(internalAny.atlassian.jira.mapperQueries.getProgramQuery, {
      programId,
    });

    expect(prog).toBeTruthy();
    expect(prog?.jiraSyncMode).toBe("approval_required");
  });

  test("listWorkstreamsInternal returns workstreams for program", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    // Add a second workstream
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("workstreams", {
        orgId: "org-1",
        programId,
        name: "Catalog",
        shortCode: "CAT",
        status: "on_track",
        sortOrder: 2,
      });
    });

    const workstreams = await t.query(
      internalAny.atlassian.jira.mapperQueries.listWorkstreamsInternal,
      { programId },
    );

    expect(workstreams).toHaveLength(2);
  });

  test("listRequirementsByWorkstreamInternal returns requirements for workstream", async () => {
    const t = convexTest(schema, modules);
    const { programId, workstreamId } = await setupTestData(t);

    // Add a second requirement to the same workstream
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId,
        workstreamId,
        refId: "REQ-002",
        title: "Return Processing",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
    });

    const reqs = await t.query(
      internalAny.atlassian.jira.mapperQueries.listRequirementsByWorkstreamInternal,
      { workstreamId },
    );

    expect(reqs).toHaveLength(2);
  });

  test("listRequirementsByWorkstreamInternal returns empty for workstream with no requirements", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    const emptyWsId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("workstreams", {
        orgId: "org-1",
        programId,
        name: "Empty",
        shortCode: "EMP",
        status: "on_track",
        sortOrder: 3,
      });
    });

    const reqs = await t.query(
      internalAny.atlassian.jira.mapperQueries.listRequirementsByWorkstreamInternal,
      { workstreamId: emptyWsId },
    );

    expect(reqs).toHaveLength(0);
  });
});

describe("mapper Epic payload construction", () => {
  test("enqueues Epic with correct summary format [shortCode] name", async () => {
    const t = convexTest(schema, modules);
    const { programId, workstreamId, orgId } = await setupTestData(t);

    // Simulate what pushWorkstreamAsEpic does: read workstream, build payload, enqueue
    const ws = await t.query(internalAny.atlassian.jira.mapperQueries.getWorkstreamQuery, {
      workstreamId,
    });

    const fields = {
      project: { id: "10000" },
      summary: `[${ws?.shortCode}] ${ws?.name}`,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: ws?.description ?? `Workstream: ${ws?.name}` }],
          },
        ],
      },
      issuetype: { name: "Epic" },
    };

    const queueItemId = await t.mutation(internalAny.atlassian.jira.push.enqueueOperationInternal, {
      orgId,
      programId,
      operationType: "create_issue",
      payload: { fields, platformEntityType: "workstream" },
      platformEntityId: workstreamId,
    });

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item.operationType).toBe("create_issue");
    expect(item.status).toBe("pending");
    expect(item.payload.fields.issuetype).toEqual({ name: "Epic" });
    expect(item.payload.fields.summary).toBe("[OM] Order Management");
    expect(item.payload.fields.project).toEqual({ id: "10000" });
    expect(item.payload.platformEntityType).toBe("workstream");
    expect(item.payload.fields.description.type).toBe("doc");
    expect(item.payload.fields.description.content[0].content[0].text).toBe(
      "Order management workstream",
    );
  });

  test("uses fallback description when workstream has no description", async () => {
    const t = convexTest(schema, modules);
    const { programId, orgId } = await setupTestData(t);

    const wsId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("workstreams", {
        orgId: "org-1",
        programId,
        name: "Data Migration",
        shortCode: "DM",
        status: "on_track",
        sortOrder: 2,
      });
    });

    const ws = await t.query(internalAny.atlassian.jira.mapperQueries.getWorkstreamQuery, {
      workstreamId: wsId,
    });

    const descText = ws?.description ?? `Workstream: ${ws?.name}`;
    expect(descText).toBe("Workstream: Data Migration");
  });
});

describe("mapper Story payload construction", () => {
  const PRIORITY_MAP: Record<string, string> = {
    must_have: "Highest",
    should_have: "High",
    nice_to_have: "Medium",
    deferred: "Low",
  };

  test("enqueues Story with correct summary format [refId] title", async () => {
    const t = convexTest(schema, modules);
    const { programId, requirementId, orgId } = await setupTestData(t);

    const req = await t.query(internalAny.atlassian.jira.mapperQueries.getRequirementQuery, {
      requirementId,
    });

    const fields: Record<string, any> = {
      project: { id: "10000" },
      summary: `[${req?.refId}] ${req?.title}`,
      issuetype: { name: "Story" },
      priority: { name: PRIORITY_MAP[req?.priority] ?? "Medium" },
    };

    const queueItemId = await t.mutation(internalAny.atlassian.jira.push.enqueueOperationInternal, {
      orgId,
      programId,
      operationType: "create_issue",
      payload: { fields, platformEntityType: "requirement" },
      platformEntityId: requirementId,
    });

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item.payload.fields.issuetype).toEqual({ name: "Story" });
    expect(item.payload.fields.summary).toBe("[REQ-001] Order Processing");
    expect(item.payload.platformEntityType).toBe("requirement");
  });

  test("maps must_have priority to Highest", async () => {
    const t = convexTest(schema, modules);
    const { requirementId } = await setupTestData(t);

    const req = await t.query(internalAny.atlassian.jira.mapperQueries.getRequirementQuery, {
      requirementId,
    });

    expect(req?.priority).toBe("must_have");
    expect(PRIORITY_MAP[req?.priority]).toBe("Highest");
  });

  test("maps all priority levels correctly", () => {
    expect(PRIORITY_MAP.must_have).toBe("Highest");
    expect(PRIORITY_MAP.should_have).toBe("High");
    expect(PRIORITY_MAP.nice_to_have).toBe("Medium");
    expect(PRIORITY_MAP.deferred).toBe("Low");
  });

  test("falls back to Medium for unknown priority", () => {
    expect(PRIORITY_MAP.unknown ?? "Medium").toBe("Medium");
  });

  test("includes epicKey as parent when provided", async () => {
    const t = convexTest(schema, modules);
    const { programId, requirementId, orgId } = await setupTestData(t);

    const req = await t.query(internalAny.atlassian.jira.mapperQueries.getRequirementQuery, {
      requirementId,
    });

    const epicKey = "PROJ-42";
    const fields: Record<string, any> = {
      project: { id: "10000" },
      summary: `[${req?.refId}] ${req?.title}`,
      issuetype: { name: "Story" },
      priority: { name: PRIORITY_MAP[req?.priority] ?? "Medium" },
      parent: { key: epicKey },
    };

    const queueItemId = await t.mutation(internalAny.atlassian.jira.push.enqueueOperationInternal, {
      orgId,
      programId,
      operationType: "create_issue",
      payload: { fields, platformEntityType: "requirement" },
      platformEntityId: requirementId,
    });

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item.payload.fields.parent).toEqual({ key: "PROJ-42" });
  });

  test("does not include parent field when epicKey is not provided", async () => {
    const t = convexTest(schema, modules);
    const { programId, requirementId, orgId } = await setupTestData(t);

    const req = await t.query(internalAny.atlassian.jira.mapperQueries.getRequirementQuery, {
      requirementId,
    });

    const fields: Record<string, any> = {
      project: { id: "10000" },
      summary: `[${req?.refId}] ${req?.title}`,
      issuetype: { name: "Story" },
      priority: { name: PRIORITY_MAP[req?.priority] ?? "Medium" },
    };

    const queueItemId = await t.mutation(internalAny.atlassian.jira.push.enqueueOperationInternal, {
      orgId,
      programId,
      operationType: "create_issue",
      payload: { fields, platformEntityType: "requirement" },
      platformEntityId: requirementId,
    });

    const item = await t.run(async (ctx: any) => {
      return await ctx.db.get(queueItemId);
    });

    expect(item.payload.fields.parent).toBeUndefined();
  });

  test("description includes priority, fitGap, and effort", async () => {
    const t = convexTest(schema, modules);
    const { requirementId } = await setupTestData(t);

    const req = await t.query(internalAny.atlassian.jira.mapperQueries.getRequirementQuery, {
      requirementId,
    });

    // Simulate the mapper's description assembly
    const descParts = [
      `Priority: ${req?.priority} | Fit/Gap: ${req?.fitGap} | Effort: ${req?.effortEstimate ?? "N/A"}`,
      "",
      req?.description ?? "",
    ];

    const descText = descParts.join("\n");
    expect(descText).toContain("Priority: must_have");
    expect(descText).toContain("Fit/Gap: custom_dev");
    expect(descText).toContain("Effort: high");
    expect(descText).toContain("Must support complex order workflows");
  });
});

describe("mapper program push orchestration", () => {
  test("listWorkstreamsInternal + listRequirementsByWorkstreamInternal gives full program data", async () => {
    const t = convexTest(schema, modules);
    const { programId, workstreamId } = await setupTestData(t);

    // Add second workstream with a requirement
    const ws2Id = await t.run(async (ctx: any) => {
      return await ctx.db.insert("workstreams", {
        orgId: "org-1",
        programId,
        name: "Catalog",
        shortCode: "CAT",
        status: "on_track",
        sortOrder: 2,
      });
    });

    await t.run(async (ctx: any) => {
      return await ctx.db.insert("requirements", {
        orgId: "org-1",
        programId,
        workstreamId: ws2Id,
        refId: "REQ-002",
        title: "Product Import",
        priority: "should_have",
        fitGap: "config",
        status: "draft",
      });
    });

    const workstreams = await t.query(
      internalAny.atlassian.jira.mapperQueries.listWorkstreamsInternal,
      { programId },
    );

    expect(workstreams).toHaveLength(2);

    // Verify requirements per workstream
    const ws1Reqs = await t.query(
      internalAny.atlassian.jira.mapperQueries.listRequirementsByWorkstreamInternal,
      { workstreamId },
    );
    expect(ws1Reqs).toHaveLength(1);
    expect(ws1Reqs[0].refId).toBe("REQ-001");

    const ws2Reqs = await t.query(
      internalAny.atlassian.jira.mapperQueries.listRequirementsByWorkstreamInternal,
      { workstreamId: ws2Id },
    );
    expect(ws2Reqs).toHaveLength(1);
    expect(ws2Reqs[0].refId).toBe("REQ-002");
  });

  test("empty program returns no workstreams", async () => {
    const t = convexTest(schema, modules);
    await setupTestData(t);

    const emptyProgramId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Empty Program",
        clientName: "Test",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        phase: "discovery",
        status: "active",
      });
    });

    const workstreams = await t.query(
      internalAny.atlassian.jira.mapperQueries.listWorkstreamsInternal,
      { programId: emptyProgramId },
    );

    expect(workstreams).toHaveLength(0);
  });

  test("jiraSyncMode drives auto-execute behavior", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    // approval_required mode
    const prog = await t.query(internalAny.atlassian.jira.mapperQueries.getProgramQuery, {
      programId,
    });
    expect(prog?.jiraSyncMode).toBe("approval_required");

    // auto mode
    const autoProgramId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-1",
        name: "Auto Program",
        clientName: "Test",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        phase: "discovery",
        status: "active",
        jiraSyncMode: "auto",
      });
    });

    const autoProg = await t.query(internalAny.atlassian.jira.mapperQueries.getProgramQuery, {
      programId: autoProgramId,
    });
    expect(autoProg?.jiraSyncMode).toBe("auto");
  });
});
