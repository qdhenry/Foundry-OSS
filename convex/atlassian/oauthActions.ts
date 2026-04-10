"use node";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import {
  addJiraComment,
  createConfluencePage,
  createJiraIssue,
  exchangeCodeForTokenSet,
  getConfluencePage,
  getConfluencePageContent,
  getConfluenceSpaceByKey,
  getJiraIssue,
  listAccessibleResources,
  listConfluencePages,
  listConfluenceSpaces,
  listJiraProjects,
  refreshTokenSet,
  transitionJiraIssue,
  updateConfluencePage,
  updateJiraIssue,
} from "./client";

const ENCRYPTION_VERSION = "v1";

function resolveEncryptionKey(): Buffer {
  const raw = process.env.ATLASSIAN_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Missing ATLASSIAN_TOKEN_ENCRYPTION_KEY environment variable for token encryption",
    );
  }

  if (/^[A-Fa-f0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // fallthrough
  }

  return createHash("sha256").update(raw).digest();
}

function encryptWithAesGcm(plaintext: string): string {
  const key = resolveEncryptionKey();
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

function decryptWithAesGcm(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== ENCRYPTION_VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted token payload format");
  }

  const key = resolveEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export const exchangeCodeForTokens = internalAction({
  args: { code: v.string() },
  handler: async (_ctx, args) => {
    return await exchangeCodeForTokenSet(args.code);
  },
});

export const refreshAccessToken = internalAction({
  args: { refreshToken: v.string() },
  handler: async (_ctx, args) => {
    return await refreshTokenSet(args.refreshToken);
  },
});

export const discoverAccessibleResources = internalAction({
  args: { accessToken: v.string() },
  handler: async (_ctx, args) => {
    return await listAccessibleResources(args.accessToken);
  },
});

export const fetchJiraIssue = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
    issueKey: v.string(),
  },
  handler: async (_ctx, args) => {
    return await getJiraIssue(args.accessToken, args.cloudId, args.issueKey);
  },
});

export const fetchConfluencePage = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
    pageId: v.string(),
  },
  handler: async (_ctx, args) => {
    return await getConfluencePage(args.accessToken, args.cloudId, args.pageId);
  },
});

export const fetchConfluencePageContent = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
    pageId: v.string(),
  },
  handler: async (_ctx, args) => {
    return await getConfluencePageContent(args.accessToken, args.cloudId, args.pageId);
  },
});

export const fetchJiraProjects = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
  },
  handler: async (_ctx, args) => {
    return await listJiraProjects(args.accessToken, args.cloudId);
  },
});

export const fetchConfluenceSpaces = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
  },
  handler: async (_ctx, args) => {
    return await listConfluenceSpaces(args.accessToken, args.cloudId);
  },
});

export const fetchConfluencePages = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
    spaceId: v.string(),
  },
  handler: async (_ctx, args) => {
    return await listConfluencePages(args.accessToken, args.cloudId, args.spaceId);
  },
});

export const createIssue = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
    fields: v.any(),
  },
  handler: async (_ctx, args) => {
    return await createJiraIssue(args.accessToken, args.cloudId, args.fields);
  },
});

export const updateIssue = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
    issueKey: v.string(),
    fields: v.any(),
  },
  handler: async (_ctx, args) => {
    return await updateJiraIssue(args.accessToken, args.cloudId, args.issueKey, args.fields);
  },
});

export const transitionIssue = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
    issueKey: v.string(),
    transitionId: v.string(),
  },
  handler: async (_ctx, args) => {
    return await transitionJiraIssue(
      args.accessToken,
      args.cloudId,
      args.issueKey,
      args.transitionId,
    );
  },
});

export const addComment = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
    issueKey: v.string(),
    body: v.any(),
  },
  handler: async (_ctx, args) => {
    return await addJiraComment(args.accessToken, args.cloudId, args.issueKey, args.body);
  },
});

export const createPage = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
    spaceId: v.string(),
    parentId: v.string(),
    title: v.string(),
    body: v.string(),
  },
  handler: async (_ctx, args) => {
    return await createConfluencePage(
      args.accessToken,
      args.cloudId,
      args.spaceId,
      args.parentId,
      args.title,
      args.body,
    );
  },
});

export const updatePage = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
    pageId: v.string(),
    title: v.string(),
    body: v.string(),
    version: v.number(),
  },
  handler: async (_ctx, args) => {
    return await updateConfluencePage(
      args.accessToken,
      args.cloudId,
      args.pageId,
      args.title,
      args.body,
      args.version,
    );
  },
});

export const resolveSpaceByKey = internalAction({
  args: {
    accessToken: v.string(),
    cloudId: v.string(),
    spaceKey: v.string(),
  },
  handler: async (_ctx, args) => {
    return await getConfluenceSpaceByKey(args.accessToken, args.cloudId, args.spaceKey);
  },
});

export const encryptToken = internalAction({
  args: { token: v.string() },
  handler: async (_ctx, args) => {
    return encryptWithAesGcm(args.token);
  },
});

export const decryptToken = internalAction({
  args: { encryptedToken: v.string() },
  handler: async (_ctx, args) => {
    return decryptWithAesGcm(args.encryptedToken);
  },
});
