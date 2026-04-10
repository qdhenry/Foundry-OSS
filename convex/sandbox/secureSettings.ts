"use node";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ConvexError, v } from "convex/values";
import * as generatedApi from "../_generated/api";
import { action, internalAction } from "../_generated/server";

const ENCRYPTION_VERSION = "v1";

const aiProviderValidator = v.union(
  v.literal("anthropic"),
  v.literal("bedrock"),
  v.literal("vertex"),
  v.literal("azure"),
);

const apiAny: any = (generatedApi as any).api;

function resolveBaseEncryptionKey(): Buffer {
  const raw =
    process.env.SANDBOX_SECRET_ENCRYPTION_KEY ?? process.env.ATLASSIAN_TOKEN_ENCRYPTION_KEY;

  if (!raw) {
    throw new Error(
      "Missing SANDBOX_SECRET_ENCRYPTION_KEY (or ATLASSIAN_TOKEN_ENCRYPTION_KEY) for sandbox secret encryption.",
    );
  }

  if (/^[A-Fa-f0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // Fall through to hashing.
  }

  return createHash("sha256").update(raw).digest();
}

function deriveOrgEncryptionKey(orgId: string): Buffer {
  const baseKey = resolveBaseEncryptionKey();
  return createHash("sha256").update(baseKey).update(":").update(orgId).digest();
}

function encryptForOrg(orgId: string, plaintext: string): string {
  const key = deriveOrgEncryptionKey(orgId);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

function decryptForOrg(orgId: string, encryptedValue: string): string {
  const [version, ivB64, tagB64, dataB64] = encryptedValue.split(":");
  if (version !== ENCRYPTION_VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload format");
  }

  const key = deriveOrgEncryptionKey(orgId);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

async function getAuthorizedActionUser(ctx: any, orgId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Not authenticated");

  const user = await ctx.runQuery(apiAny.users.getByClerkId, {
    clerkId: identity.subject,
  });
  if (!user) throw new ConvexError("Authenticated user not found");
  if (!user.orgIds.includes(orgId)) throw new ConvexError("Access denied");

  return user;
}

export const encryptForOrgAction = action({
  args: {
    orgId: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    await getAuthorizedActionUser(ctx, args.orgId);
    return encryptForOrg(args.orgId, args.value);
  },
});

export const upsertEnvVar = action({
  args: {
    orgId: v.string(),
    name: v.string(),
    value: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await getAuthorizedActionUser(ctx, args.orgId);
    const encryptedValue = encryptForOrg(args.orgId, args.value);
    return await ctx.runMutation(apiAny.sandbox.envVault.upsert, {
      orgId: args.orgId,
      name: args.name,
      encryptedValue,
      description: args.description,
    });
  },
});

export const upsertAiProvider = action({
  args: {
    orgId: v.string(),
    provider: aiProviderValidator,
    credentials: v.string(),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await getAuthorizedActionUser(ctx, args.orgId);
    const encryptedCredentials = encryptForOrg(args.orgId, args.credentials);
    return await ctx.runMutation(apiAny.sandbox.aiProviders.upsertMine, {
      orgId: args.orgId,
      provider: args.provider,
      encryptedCredentials,
      isDefault: args.isDefault,
    });
  },
});

export const decryptForOrgInternal = internalAction({
  args: {
    orgId: v.string(),
    encryptedValue: v.string(),
  },
  handler: async (_ctx, args) => {
    return decryptForOrg(args.orgId, args.encryptedValue);
  },
});

export const __test__ = {
  encryptForOrg,
  decryptForOrg,
};
