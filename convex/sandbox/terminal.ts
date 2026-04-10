import { v } from "convex/values";
import * as generatedApi from "../_generated/api";
import { action } from "../_generated/server";

const internalAny: any = (generatedApi as any).internal;

export const getConnectionInfo = action({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (
    ctx,
    { sessionId },
  ): Promise<{ wsUrl: string; token: string; sandboxId: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const session = await ctx.runQuery(internalAny.sandbox.sessions.getInternal, { sessionId });
    if (!session) throw new Error("Session not found");

    const workerUrl = (process.env.SANDBOX_WORKER_URL ?? "").trim();
    const apiSecret = (process.env.SANDBOX_API_SECRET ?? "").trim();
    if (!workerUrl || !apiSecret) throw new Error("Terminal connection not configured");
    const sandboxId: string = session.sandboxId;

    const timestamp = Date.now().toString();
    const payload = `${sandboxId}:${timestamp}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const token = `${timestamp}:${hex}`;

    const wsUrl = workerUrl.replace(/^http/, "ws").replace(/\/+$/, "");

    return {
      wsUrl: `${wsUrl}/sandbox/${sandboxId}/terminal`,
      token,
      sandboxId,
    };
  },
});
