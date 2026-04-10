import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../../../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../../../schema";
import type { ConvexTestModuleMap } from "../../../test.helpers";

type ImportMetaWithGlob = ImportMeta & {
  glob: (pattern: string) => ConvexTestModuleMap;
};

const importMetaWithGlob = import.meta as ImportMetaWithGlob;
const convexRoot = importMetaWithGlob.glob("../../../**/*.*s");
const atlassianTree = importMetaWithGlob.glob("../../**/*.*s");
function rekeyAtlassian(entries: ConvexTestModuleMap): ConvexTestModuleMap {
  const result: ConvexTestModuleMap = {};
  for (const [key, val] of Object.entries(entries)) {
    let newKey: string;
    if (key.startsWith("../../")) {
      newKey = key.replace("../../", "../../../atlassian/");
    } else if (key.startsWith("../")) {
      newKey = key.replace("../", "../../../atlassian/confluence/");
    } else if (key.startsWith("./")) {
      newKey = key.replace("./", "../../../atlassian/confluence/__tests__/");
    } else {
      newKey = key;
    }
    result[newKey] = val;
  }
  return result;
}
const modules: ConvexTestModuleMap = {
  ...convexRoot,
  ...rekeyAtlassian(atlassianTree),
};

// ── Helpers ──────────────────────────────────────────────────────────

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
    });
  });
  return { userId, programId };
}

// ── handleConfluenceWebhookEvent ─────────────────────────────────────

describe("handleConfluenceWebhookEvent", () => {
  test("returns processed:false when programId is missing", async () => {
    const t = convexTest(schema, modules);
    const result = await t.mutation(
      internalAny.atlassian.confluence.ingest.handleConfluenceWebhookEvent,
      {
        orgId: "org-1",
        programId: undefined,
        eventType: "page_updated",
        payload: { page: { id: "123", title: "Test" } },
      },
    );
    expect(result).toEqual({ processed: false, reason: "missing programId" });
  });

  test("returns processed:false when payload has no page id/title", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);
    const result = await t.mutation(
      internalAny.atlassian.confluence.ingest.handleConfluenceWebhookEvent,
      {
        orgId: "org-1",
        programId,
        eventType: "page_updated",
        payload: { something: "irrelevant" },
      },
    );
    expect(result).toEqual({
      processed: false,
      reason: "no page id/title in payload",
    });
  });

  test("creates new confluencePageRecords entry", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);
    const result = await t.mutation(
      internalAny.atlassian.confluence.ingest.handleConfluenceWebhookEvent,
      {
        orgId: "org-1",
        programId,
        eventType: "page_updated",
        payload: {
          page: { id: "pg-100", title: "Gap Analysis", version: { number: 3 } },
          timestamp: "2024-01-01T00:00:00Z",
        },
      },
    );
    expect(result).toMatchObject({
      processed: true,
      created: true,
      confluencePageId: "pg-100",
      confluencePageTitle: "Gap Analysis",
      confluenceVersion: 3,
    });

    // Verify the record was persisted
    const record = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("confluencePageRecords")
        .withIndex("by_confluence_page_id", (q: any) =>
          q.eq("programId", programId).eq("confluencePageId", "pg-100"),
        )
        .first();
    });
    expect(record).not.toBeNull();
    expect(record.direction).toBe("ingest");
    expect(record.pageType).toBe("ingested");
    expect(record.orgId).toBe("org-1");
    expect(record.confluenceVersion).toBe(3);
  });

  test("updates existing record on re-delivery", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    // First delivery
    await t.mutation(internalAny.atlassian.confluence.ingest.handleConfluenceWebhookEvent, {
      orgId: "org-1",
      programId,
      eventType: "page_updated",
      payload: {
        page: { id: "pg-200", title: "Original Title", version: { number: 1 } },
      },
    });

    // Re-delivery with updated title/version
    const result = await t.mutation(
      internalAny.atlassian.confluence.ingest.handleConfluenceWebhookEvent,
      {
        orgId: "org-1",
        programId,
        eventType: "page_updated",
        payload: {
          page: { id: "pg-200", title: "Updated Title", version: { number: 2 } },
        },
      },
    );

    expect(result).toMatchObject({
      processed: true,
      updated: true,
      confluencePageId: "pg-200",
      confluencePageTitle: "Updated Title",
      confluenceVersion: 2,
    });

    // Verify only one record exists
    const records = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("confluencePageRecords")
        .withIndex("by_confluence_page_id", (q: any) =>
          q.eq("programId", programId).eq("confluencePageId", "pg-200"),
        )
        .collect();
    });
    expect(records).toHaveLength(1);
    expect(records[0].confluencePageTitle).toBe("Updated Title");
    expect(records[0].confluenceVersion).toBe(2);
  });

  test("derives contentHash from version and timestamp", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    await t.mutation(internalAny.atlassian.confluence.ingest.handleConfluenceWebhookEvent, {
      orgId: "org-1",
      programId,
      eventType: "page_updated",
      payload: {
        page: {
          id: "pg-300",
          title: "Hash Test",
          version: { number: 5, when: "2024-06-15T12:00:00Z" },
        },
        timestamp: "2024-06-15T12:00:00Z",
      },
    });

    const record = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("confluencePageRecords")
        .withIndex("by_confluence_page_id", (q: any) =>
          q.eq("programId", programId).eq("confluencePageId", "pg-300"),
        )
        .first();
    });
    expect(record.contentHash).toBe("5:2024-06-15T12:00:00Z");
  });

  test("extracts page from nested payload.page", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    const result = await t.mutation(
      internalAny.atlassian.confluence.ingest.handleConfluenceWebhookEvent,
      {
        orgId: "org-1",
        programId,
        eventType: "page_updated",
        payload: {
          page: { id: "nested-1", title: "Nested Page", version: { number: 1 } },
        },
      },
    );
    expect(result).toMatchObject({
      processed: true,
      created: true,
      confluencePageId: "nested-1",
    });
  });

  test("extracts page from payload.content fallback", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    const result = await t.mutation(
      internalAny.atlassian.confluence.ingest.handleConfluenceWebhookEvent,
      {
        orgId: "org-1",
        programId,
        eventType: "page_updated",
        payload: {
          content: { id: "content-1", title: "Content Page", version: { number: 2 } },
        },
      },
    );
    expect(result).toMatchObject({
      processed: true,
      created: true,
      confluencePageId: "content-1",
      confluencePageTitle: "Content Page",
      confluenceVersion: 2,
    });
  });

  test("extracts page from root-level payload", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    const result = await t.mutation(
      internalAny.atlassian.confluence.ingest.handleConfluenceWebhookEvent,
      {
        orgId: "org-1",
        programId,
        eventType: "page_updated",
        payload: {
          id: "root-1",
          title: "Root Page",
          version: { number: 4 },
        },
      },
    );
    expect(result).toMatchObject({
      processed: true,
      created: true,
      confluencePageId: "root-1",
      confluencePageTitle: "Root Page",
      confluenceVersion: 4,
    });
  });
});

// ── queueManualIngest ────────────────────────────────────────────────

describe("queueManualIngest", () => {
  test("creates new record with direction ingest", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    const recordId = await t
      .withIdentity({ subject: "test-user-1" })
      .mutation(apiAny.atlassian.confluence.ingest.queueManualIngest, {
        orgId: "org-1",
        programId,
        confluencePageId: "manual-1",
        confluencePageTitle: "Manual Page",
        confluenceVersion: 1,
      });
    expect(recordId).toBeTruthy();

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(recordId);
    });
    expect(record.direction).toBe("ingest");
    expect(record.pageType).toBe("ingested");
    expect(record.confluencePageId).toBe("manual-1");
    expect(record.lastIngestedAt).toBeTypeOf("number");
  });

  test("updates existing record on same confluencePageId", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const firstId = await asUser.mutation(apiAny.atlassian.confluence.ingest.queueManualIngest, {
      orgId: "org-1",
      programId,
      confluencePageId: "manual-2",
      confluencePageTitle: "First Title",
      confluenceVersion: 1,
    });

    const secondId = await asUser.mutation(apiAny.atlassian.confluence.ingest.queueManualIngest, {
      orgId: "org-1",
      programId,
      confluencePageId: "manual-2",
      confluencePageTitle: "Updated Title",
      confluenceVersion: 2,
    });

    expect(secondId).toEqual(firstId);

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(firstId);
    });
    expect(record.confluencePageTitle).toBe("Updated Title");
    expect(record.confluenceVersion).toBe(2);
  });

  test("requires auth (assertOrgAccess)", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    await expect(
      t.mutation(apiAny.atlassian.confluence.ingest.queueManualIngest, {
        orgId: "org-1",
        programId,
        confluencePageId: "no-auth",
        confluencePageTitle: "No Auth",
        confluenceVersion: 1,
      }),
    ).rejects.toThrow();
  });
});

// ── getPageRecordQuery ───────────────────────────────────────────────

describe("getPageRecordQuery", () => {
  test("returns record by programId + confluencePageId", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    // Insert a record directly
    await t.run(async (ctx: any) => {
      await ctx.db.insert("confluencePageRecords", {
        orgId: "org-1",
        programId,
        pageType: "ingested",
        confluencePageId: "query-1",
        confluencePageTitle: "Query Page",
        confluenceVersion: 1,
        direction: "ingest",
      });
    });

    const record = await t.query(internalAny.atlassian.confluence.ingest.getPageRecordQuery, {
      programId,
      confluencePageId: "query-1",
    });
    expect(record).not.toBeNull();
    expect(record?.confluencePageTitle).toBe("Query Page");
  });

  test("returns null when no matching record", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    const record = await t.query(internalAny.atlassian.confluence.ingest.getPageRecordQuery, {
      programId,
      confluencePageId: "nonexistent",
    });
    expect(record).toBeNull();
  });
});

// ── getProgramInternal ───────────────────────────────────────────────

describe("getProgramInternal", () => {
  test("returns program by ID", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    const program = await t.query(internalAny.atlassian.confluence.ingest.getProgramInternal, {
      programId,
    });
    expect(program).not.toBeNull();
    expect(program?.name).toBe("Test Program");
    expect(program?.orgId).toBe("org-1");
  });

  test("returns null for nonexistent program", async () => {
    const t = convexTest(schema, modules);
    await setupTestData(t);

    // Use a valid-format but nonexistent ID
    const fakeId = await t.run(async (ctx: any) => {
      const id = await ctx.db.insert("programs", {
        orgId: "org-x",
        name: "Temp",
        clientName: "Temp",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        phase: "discovery",
        status: "active",
      });
      await ctx.db.delete(id);
      return id;
    });

    const program = await t.query(internalAny.atlassian.confluence.ingest.getProgramInternal, {
      programId: fakeId,
    });
    expect(program).toBeNull();
  });
});

// ── upsertIngestedPageRecord ─────────────────────────────────────────

describe("upsertIngestedPageRecord", () => {
  test("creates new record with full content fields", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    const recordId = await t.mutation(
      internalAny.atlassian.confluence.ingest.upsertIngestedPageRecord,
      {
        programId,
        confluencePageId: "upsert-1",
        confluencePageTitle: "Upsert Page",
        confluenceVersion: 3,
        contentHash: "abc123",
        cachedRenderedHtml: "<h1>Hello</h1>",
      },
    );
    expect(recordId).toBeTruthy();

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(recordId);
    });
    expect(record.contentHash).toBe("abc123");
    expect(record.cachedRenderedHtml).toBe("<h1>Hello</h1>");
    expect(record.cachedRenderedVersion).toBe(3);
    expect(record.direction).toBe("ingest");
    expect(record.pageType).toBe("ingested");
    expect(record.orgId).toBe("org-1");
  });

  test("updates existing record with new content", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    // Create initial record via webhook handler
    await t.mutation(internalAny.atlassian.confluence.ingest.handleConfluenceWebhookEvent, {
      orgId: "org-1",
      programId,
      eventType: "page_updated",
      payload: {
        page: { id: "upsert-2", title: "Initial Title", version: { number: 1 } },
      },
    });

    // Now upsert with full content
    const recordId = await t.mutation(
      internalAny.atlassian.confluence.ingest.upsertIngestedPageRecord,
      {
        programId,
        confluencePageId: "upsert-2",
        confluencePageTitle: "Updated Title",
        confluenceVersion: 2,
        contentHash: "hash-v2",
        cachedRenderedHtml: "<p>Updated content</p>",
      },
    );

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(recordId);
    });
    expect(record.confluencePageTitle).toBe("Updated Title");
    expect(record.confluenceVersion).toBe(2);
    expect(record.contentHash).toBe("hash-v2");
    expect(record.cachedRenderedHtml).toBe("<p>Updated content</p>");
    expect(record.cachedRenderedVersion).toBe(2);

    // Verify only one record
    const all = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("confluencePageRecords")
        .withIndex("by_confluence_page_id", (q: any) =>
          q.eq("programId", programId).eq("confluencePageId", "upsert-2"),
        )
        .collect();
    });
    expect(all).toHaveLength(1);
  });
});
