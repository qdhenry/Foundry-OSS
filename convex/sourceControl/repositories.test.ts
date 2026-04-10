import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import * as generatedApi from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.helpers";

const apiAny: any = (generatedApi as any).api;

type SetupData = {
  programId: string;
  repositoryId: string;
};

async function setupBaseData(t: any): Promise<SetupData> {
  await t.run(async (ctx: any) => {
    await ctx.db.insert("users", {
      clerkId: "repo-user-1",
      email: "repo-user-1@example.com",
      name: "Repo User One",
      orgIds: ["org-1"],
      role: "admin",
    });

    await ctx.db.insert("users", {
      clerkId: "repo-user-2",
      email: "repo-user-2@example.com",
      name: "Repo User Two",
      orgIds: ["org-2"],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: "org-1",
      name: "Repository Program",
      clientName: "Repository Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "build",
      status: "active",
    });
  });

  const repositoryId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("sourceControlRepositories", {
      orgId: "org-1",
      programId,
      installationId: "inst-1",
      providerType: "github",
      repoFullName: "example/backend-repo",
      providerRepoId: "101",
      defaultBranch: "main",
      role: "integration",
      isMonorepo: false,
    });
  });

  return { programId, repositoryId };
}

describe("sourceControl.repositories.setLocalPath", () => {
  test("sets localPath for authorized users", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "repo-user-1" });

    await asUser.mutation(apiAny.sourceControl.repositories.setLocalPath, {
      repositoryId: data.repositoryId,
      localPath: "/Users/dev/example/backend-repo",
    });

    const repository = await t.run(async (ctx: any) => {
      return await ctx.db.get(data.repositoryId);
    });

    expect(repository?.localPath).toBe("/Users/dev/example/backend-repo");
  });

  test("rejects setLocalPath when user does not have org access", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asOtherUser = t.withIdentity({ subject: "repo-user-2" });

    await expect(
      asOtherUser.mutation(apiAny.sourceControl.repositories.setLocalPath, {
        repositoryId: data.repositoryId,
        localPath: "/Users/dev/example/backend-repo",
      }),
    ).rejects.toThrow("Access denied");
  });

  test("rejects setLocalPath when repository does not exist", async () => {
    const t = convexTest(schema, modules);
    const data = await setupBaseData(t);
    const asUser = t.withIdentity({ subject: "repo-user-1" });

    await t.run(async (ctx: any) => {
      await ctx.db.delete(data.repositoryId);
    });

    await expect(
      asUser.mutation(apiAny.sourceControl.repositories.setLocalPath, {
        repositoryId: data.repositoryId,
        localPath: "/Users/dev/example/backend-repo",
      }),
    ).rejects.toThrow("Repository not found");
  });
});
