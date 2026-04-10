import { describe, expect, test } from "vitest";
import { assertActionOrgAccess, authorizeCredentialOwner } from "../../googleDrive/auth";

/**
 * Unit tests for convex/googleDrive/auth.ts
 *
 * These are plain TypeScript helpers (not Convex endpoints), so we test them
 * directly with mock ActionQueryCtx objects. This avoids the overhead of a
 * full convex-test instance while still covering every branch.
 *
 * Covers:
 *  - assertActionOrgAccess: authenticated+in org, not authenticated,
 *    user not found, not in org, JWT org_id fallback
 *  - authorizeCredentialOwner: all pass, credential not found,
 *    wrong user, wrong org on credential
 */

// ── Mock helpers ──────────────────────────────────────────────────────

type MockUser = {
  _id: string;
  clerkId: string;
  orgIds: string[];
};

type MockCredential = {
  _id: string;
  orgId: string;
  userId: string;
};

function createMockCtx({
  identity = null as null | { subject: string; org_id?: string },
  users = {} as Record<string, MockUser>,
  credentials = {} as Record<string, MockCredential>,
}) {
  return {
    auth: {
      getUserIdentity: () => Promise.resolve(identity),
    },
    runQuery: async (_ref: any, args: Record<string, unknown>) => {
      // Dispatch by args shape
      if ("clerkId" in args) {
        return users[args.clerkId as string] ?? null;
      }
      if ("credentialId" in args) {
        return credentials[args.credentialId as string] ?? null;
      }
      return null;
    },
  };
}

const MOCK_ORG = "org-test";

const validUser: MockUser = {
  _id: "user-id-1",
  clerkId: "clerk-user-1",
  orgIds: [MOCK_ORG],
};

// ── assertActionOrgAccess ─────────────────────────────────────────────

describe("assertActionOrgAccess", () => {
  test("throws when identity is null (not authenticated)", async () => {
    const ctx = createMockCtx({ identity: null });

    await expect(assertActionOrgAccess(ctx, MOCK_ORG)).rejects.toThrow("Not authenticated");
  });

  test("throws when user is not found in the database", async () => {
    const ctx = createMockCtx({
      identity: { subject: "clerk-unknown" },
      users: {}, // no matching user
    });

    await expect(assertActionOrgAccess(ctx, MOCK_ORG)).rejects.toThrow("Access denied");
  });

  test("throws when user is not in the requested org", async () => {
    const ctx = createMockCtx({
      identity: { subject: "clerk-user-1" },
      users: {
        "clerk-user-1": { ...validUser, orgIds: ["org-other"] },
      },
    });

    await expect(assertActionOrgAccess(ctx, MOCK_ORG)).rejects.toThrow("Access denied");
  });

  test("returns user when authenticated and in org", async () => {
    const ctx = createMockCtx({
      identity: { subject: "clerk-user-1" },
      users: { "clerk-user-1": validUser },
    });

    const user = await assertActionOrgAccess(ctx, MOCK_ORG);
    expect(user._id).toBe("user-id-1");
    expect(user.orgIds).toContain(MOCK_ORG);
  });

  test("passes via JWT org_id fallback when user.orgIds doesn't include org", async () => {
    // Edge case: user's orgIds is stale but the JWT org_id matches
    const ctx = createMockCtx({
      identity: { subject: "clerk-user-1", org_id: MOCK_ORG },
      users: {
        "clerk-user-1": { ...validUser, orgIds: ["org-stale"] },
      },
    });

    // Should NOT throw because jwtOrgId === orgId
    const user = await assertActionOrgAccess(ctx, MOCK_ORG);
    expect(user._id).toBe("user-id-1");
  });
});

// ── authorizeCredentialOwner ──────────────────────────────────────────

describe("authorizeCredentialOwner", () => {
  test("returns credential and user when all checks pass", async () => {
    const credential: MockCredential = {
      _id: "cred-id-1",
      orgId: MOCK_ORG,
      userId: "user-id-1",
    };

    const ctx = createMockCtx({
      identity: { subject: "clerk-user-1" },
      users: { "clerk-user-1": validUser },
      credentials: { "cred-id-1": credential },
    });

    const result = await authorizeCredentialOwner(ctx, {
      orgId: MOCK_ORG,
      credentialId: "cred-id-1",
    });

    expect(result.credential._id).toBe("cred-id-1");
    expect(result.user._id).toBe("user-id-1");
  });

  test("throws when credential is not found", async () => {
    const ctx = createMockCtx({
      identity: { subject: "clerk-user-1" },
      users: { "clerk-user-1": validUser },
      credentials: {}, // no credential
    });

    await expect(
      authorizeCredentialOwner(ctx, {
        orgId: MOCK_ORG,
        credentialId: "cred-missing",
      }),
    ).rejects.toThrow("Invalid credential");
  });

  test("throws when credential belongs to a different user", async () => {
    const credential: MockCredential = {
      _id: "cred-id-2",
      orgId: MOCK_ORG,
      userId: "different-user-id", // not validUser._id
    };

    const ctx = createMockCtx({
      identity: { subject: "clerk-user-1" },
      users: { "clerk-user-1": validUser },
      credentials: { "cred-id-2": credential },
    });

    await expect(
      authorizeCredentialOwner(ctx, {
        orgId: MOCK_ORG,
        credentialId: "cred-id-2",
      }),
    ).rejects.toThrow("Invalid credential");
  });

  test("throws when credential's orgId does not match requested org", async () => {
    const credential: MockCredential = {
      _id: "cred-id-3",
      orgId: "org-different", // different org
      userId: "user-id-1",
    };

    const ctx = createMockCtx({
      identity: { subject: "clerk-user-1" },
      users: { "clerk-user-1": validUser },
      credentials: { "cred-id-3": credential },
    });

    await expect(
      authorizeCredentialOwner(ctx, {
        orgId: MOCK_ORG,
        credentialId: "cred-id-3",
      }),
    ).rejects.toThrow("Invalid credential");
  });

  test("throws when user is not authenticated (propagated from assertActionOrgAccess)", async () => {
    const ctx = createMockCtx({ identity: null });

    await expect(
      authorizeCredentialOwner(ctx, {
        orgId: MOCK_ORG,
        credentialId: "cred-id-1",
      }),
    ).rejects.toThrow("Not authenticated");
  });
});
