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

describe("upsertPublishedPage", () => {
  test("creates a new confluencePageRecords entry with direction publish", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const recordId = await asUser.mutation(
      apiAny.atlassian.confluence.publish.upsertPublishedPage,
      {
        orgId: "org-1",
        programId,
        pageType: "gap_analysis",
        confluencePageId: "12345",
        confluencePageTitle: "Gap Analysis Report",
        confluenceVersion: 1,
      },
    );

    expect(recordId).toBeDefined();

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(recordId);
    });

    expect(record).toMatchObject({
      orgId: "org-1",
      programId,
      pageType: "gap_analysis",
      confluencePageId: "12345",
      confluencePageTitle: "Gap Analysis Report",
      confluenceVersion: 1,
      direction: "publish",
    });
    expect(record.lastPublishedAt).toBeTypeOf("number");
  });

  test("updates an existing entry with same programId and confluencePageId", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const firstId = await asUser.mutation(apiAny.atlassian.confluence.publish.upsertPublishedPage, {
      orgId: "org-1",
      programId,
      pageType: "gap_analysis",
      confluencePageId: "12345",
      confluencePageTitle: "Gap Analysis v1",
      confluenceVersion: 1,
    });

    const secondId = await asUser.mutation(
      apiAny.atlassian.confluence.publish.upsertPublishedPage,
      {
        orgId: "org-1",
        programId,
        pageType: "gap_analysis",
        confluencePageId: "12345",
        confluencePageTitle: "Gap Analysis v2",
        confluenceVersion: 2,
      },
    );

    expect(secondId).toBe(firstId);

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(firstId);
    });

    expect(record.confluencePageTitle).toBe("Gap Analysis v2");
    expect(record.confluenceVersion).toBe(2);
  });

  test("stores all optional fields: contentHash, cachedRenderedHtml, cachedRenderedVersion", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const recordId = await asUser.mutation(
      apiAny.atlassian.confluence.publish.upsertPublishedPage,
      {
        orgId: "org-1",
        programId,
        pageType: "sprint_report",
        confluencePageId: "67890",
        confluencePageTitle: "Sprint Report",
        confluenceVersion: 3,
        contentHash: "abc123hash",
        cachedRenderedHtml: "<h1>Sprint Report</h1>",
        cachedRenderedVersion: 3,
        sprintId: "sprint-42",
      },
    );

    const record = await t.run(async (ctx: any) => {
      return await ctx.db.get(recordId);
    });

    expect(record).toMatchObject({
      contentHash: "abc123hash",
      cachedRenderedHtml: "<h1>Sprint Report</h1>",
      cachedRenderedVersion: 3,
      sprintId: "sprint-42",
    });
  });

  test("throws without identity", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    await expect(
      t.mutation(apiAny.atlassian.confluence.publish.upsertPublishedPage, {
        orgId: "org-1",
        programId,
        pageType: "gap_analysis",
        confluencePageId: "12345",
        confluencePageTitle: "Test",
        confluenceVersion: 1,
      }),
    ).rejects.toThrow("Not authenticated");
  });
});

describe("listPagesByProgram", () => {
  test("returns all pages for a program", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    await asUser.mutation(apiAny.atlassian.confluence.publish.upsertPublishedPage, {
      orgId: "org-1",
      programId,
      pageType: "gap_analysis",
      confluencePageId: "page-1",
      confluencePageTitle: "Page 1",
      confluenceVersion: 1,
    });
    await asUser.mutation(apiAny.atlassian.confluence.publish.upsertPublishedPage, {
      orgId: "org-1",
      programId,
      pageType: "risk_register",
      confluencePageId: "page-2",
      confluencePageTitle: "Page 2",
      confluenceVersion: 1,
    });

    const pages = await asUser.query(apiAny.atlassian.confluence.publish.listPagesByProgram, {
      programId,
    });

    expect(pages).toHaveLength(2);
  });

  test("filters by direction publish when specified", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Insert a publish record via mutation
    await asUser.mutation(apiAny.atlassian.confluence.publish.upsertPublishedPage, {
      orgId: "org-1",
      programId,
      pageType: "gap_analysis",
      confluencePageId: "page-publish",
      confluencePageTitle: "Published Page",
      confluenceVersion: 1,
    });

    // Insert an ingest record directly
    await t.run(async (ctx: any) => {
      await ctx.db.insert("confluencePageRecords", {
        orgId: "org-1",
        programId,
        pageType: "ingested",
        confluencePageId: "page-ingest",
        confluencePageTitle: "Ingested Page",
        confluenceVersion: 1,
        direction: "ingest",
        lastIngestedAt: Date.now(),
      });
    });

    const publishPages = await asUser.query(
      apiAny.atlassian.confluence.publish.listPagesByProgram,
      { programId, direction: "publish" },
    );

    expect(publishPages).toHaveLength(1);
    expect(publishPages[0].confluencePageId).toBe("page-publish");
  });

  test("filters by direction ingest when specified", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    // Insert a publish record
    await asUser.mutation(apiAny.atlassian.confluence.publish.upsertPublishedPage, {
      orgId: "org-1",
      programId,
      pageType: "gap_analysis",
      confluencePageId: "page-publish",
      confluencePageTitle: "Published Page",
      confluenceVersion: 1,
    });

    // Insert an ingest record directly
    await t.run(async (ctx: any) => {
      await ctx.db.insert("confluencePageRecords", {
        orgId: "org-1",
        programId,
        pageType: "ingested",
        confluencePageId: "page-ingest",
        confluencePageTitle: "Ingested Page",
        confluenceVersion: 1,
        direction: "ingest",
        lastIngestedAt: Date.now(),
      });
    });

    const ingestPages = await asUser.query(apiAny.atlassian.confluence.publish.listPagesByProgram, {
      programId,
      direction: "ingest",
    });

    expect(ingestPages).toHaveLength(1);
    expect(ingestPages[0].confluencePageId).toBe("page-ingest");
  });

  test("returns empty array for program with no pages", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);
    const asUser = t.withIdentity({ subject: "test-user-1" });

    const pages = await asUser.query(apiAny.atlassian.confluence.publish.listPagesByProgram, {
      programId,
    });

    expect(pages).toHaveLength(0);
  });
});

describe("listPagesByProgramInternal", () => {
  test("returns all pages without auth check", async () => {
    const t = convexTest(schema, modules);
    const { programId } = await setupTestData(t);

    // Insert records directly (no auth needed for internal query)
    await t.run(async (ctx: any) => {
      await ctx.db.insert("confluencePageRecords", {
        orgId: "org-1",
        programId,
        pageType: "gap_analysis",
        confluencePageId: "page-1",
        confluencePageTitle: "Page 1",
        confluenceVersion: 1,
        direction: "publish",
        lastPublishedAt: Date.now(),
      });
      await ctx.db.insert("confluencePageRecords", {
        orgId: "org-1",
        programId,
        pageType: "ingested",
        confluencePageId: "page-2",
        confluencePageTitle: "Page 2",
        confluenceVersion: 1,
        direction: "ingest",
        lastIngestedAt: Date.now(),
      });
    });

    const pages = await t.query(
      internalAny.atlassian.confluence.publish.listPagesByProgramInternal,
      { programId },
    );

    expect(pages).toHaveLength(2);
  });
});
