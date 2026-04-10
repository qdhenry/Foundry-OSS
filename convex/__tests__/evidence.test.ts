import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

import schema from "../schema";
import { modules } from "../test.helpers";
import { setupTestEnv } from "./helpers/baseFactory";

// ── listByRequirement ───────────────────────────────────────────────

describe("evidence.listByRequirement", () => {
  test("returns empty array when no evidence exists", async () => {
    const t = convexTest(schema, modules);
    const { asUser, requirementId } = await setupTestEnv(t);

    const items = await asUser.query(apiAny.evidence.listByRequirement, {
      requirementId,
    });
    expect(items).toHaveLength(0);
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, requirementId } = await setupTestEnv(t);

    await expect(
      asOtherUser.query(apiAny.evidence.listByRequirement, { requirementId }),
    ).rejects.toThrow();
  });
});

// ── generateUploadUrl ───────────────────────────────────────────────

describe("evidence.generateUploadUrl", () => {
  test("returns an upload URL for authorized user", async () => {
    const t = convexTest(schema, modules);
    const { asUser, orgId } = await setupTestEnv(t);

    const url = await asUser.mutation(apiAny.evidence.generateUploadUrl, {
      orgId,
    });
    expect(url).toBeTruthy();
    expect(typeof url).toBe("string");
  });

  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, orgId } = await setupTestEnv(t);

    await expect(
      asOtherUser.mutation(apiAny.evidence.generateUploadUrl, { orgId }),
    ).rejects.toThrow();
  });
});

// ── save ────────────────────────────────────────────────────────────
// Note: save requires a valid _storage ID from a completed upload flow.
// convex-test does not fully support ctx.storage.store, so we test the
// auth rejection path which fails before storageId validation.

describe("evidence.save", () => {
  test("rejects cross-org access", async () => {
    const t = convexTest(schema, modules);
    const { asOtherUser, orgId, requirementId } = await setupTestEnv(t);

    await expect(
      asOtherUser.mutation(apiAny.evidence.save, {
        orgId,
        requirementId,
        storageId: "kg2b0d5v8q0d7hb0bkegwdm2hh79dpfj" as any,
        fileName: "file.pdf",
        fileType: "pdf",
        fileSize: 1024,
      }),
    ).rejects.toThrow();
  });
});

// ── remove ──────────────────────────────────────────────────────────
// Note: remove requires an evidence record with a valid _storage ID.
// We test the "not found" error path and cross-org access rejection.

describe("evidence.remove", () => {
  test("throws when evidence does not exist", async () => {
    const t = convexTest(schema, modules);
    const { asUser, requirementId } = await setupTestEnv(t);

    // Use the requirement ID as a fake evidence ID (wrong table, will fail get)
    await expect(
      asUser.mutation(apiAny.evidence.remove, {
        evidenceId: requirementId as any,
      }),
    ).rejects.toThrow();
  });
});
