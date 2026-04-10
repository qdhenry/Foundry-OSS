import { httpRouter } from "convex/server";
import { Webhook } from "svix";
import * as generatedApi from "./_generated/api";
import { httpAction } from "./_generated/server";
import { extractEntityInfo as extractAtlassianEntityInfo } from "./atlassian/webhooks/handler";
import { extractEntityInfo as extractGitHubEntityInfo } from "./sourceControl/webhooks/handler";

const http = httpRouter();
const internalApi: any = (generatedApi as any).internal;

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response("Missing svix headers", { status: 400 });
    }

    const body = await request.text();

    const wh = new Webhook(webhookSecret);
    let evt: any;

    try {
      evt = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }

    const eventType = evt.type;

    if (eventType === "user.created" || eventType === "user.updated") {
      const { id, email_addresses, first_name, last_name, image_url, organization_memberships } =
        evt.data;

      const email = email_addresses?.[0]?.email_address ?? "";
      const name = [first_name, last_name].filter(Boolean).join(" ") || email;
      const orgIds = (organization_memberships ?? []).map((m: any) => m.organization.id);

      await ctx.runMutation(internalApi.users.upsertFromClerk, {
        clerkId: id,
        email,
        name,
        avatarUrl: image_url ?? undefined,
        orgIds,
      });
    }

    if (
      eventType === "organizationMembership.created" ||
      eventType === "organizationMembership.updated" ||
      eventType === "organizationMembership.deleted"
    ) {
      const { organization, public_user_data } = evt.data;
      const clerkUserId = public_user_data?.user_id;
      if (clerkUserId && organization?.id) {
        if (eventType === "organizationMembership.deleted") {
          await ctx.runMutation(internalApi.users.removeOrgId, {
            clerkId: clerkUserId,
            orgId: organization.id,
          });
        } else {
          await ctx.runMutation(internalApi.users.addOrgId, {
            clerkId: clerkUserId,
            orgId: organization.id,
          });
        }
      }
    }

    return new Response("OK", { status: 200 });
  }),
});

// ---------------------------------------------------------------------------
// Sandbox Hook Events — POST /api/sandbox/hook-events
// Receives real-time tool use events from Claude Code hooks running inside
// sandbox containers. Auth via SANDBOX_API_SECRET bearer token.
// ---------------------------------------------------------------------------

http.route({
  path: "/api/sandbox/hook-events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expectedSecret = process.env.SANDBOX_API_SECRET;
    if (!expectedSecret) {
      return new Response("Hook secret not configured", { status: 500 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    let event: Record<string, any>;
    try {
      event = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const sessionId = event.session_id;
    if (!sessionId || typeof sessionId !== "string") {
      return new Response("Missing session_id", { status: 400 });
    }

    const hookEventType = typeof event.type === "string" ? event.type : "unknown";
    const toolName = typeof event.tool_name === "string" ? event.tool_name : undefined;
    const message = buildHookLogMessage(hookEventType, toolName, event);

    await ctx.runMutation(internalApi.sandbox.logs.appendFromHook, {
      sessionId,
      hookEventType,
      toolName,
      message,
      metadata: event,
      timestamp: typeof event.timestamp === "number" ? event.timestamp : Date.now(),
    });

    return new Response("OK", { status: 200 });
  }),
});

function buildHookLogMessage(
  hookEventType: string,
  toolName: string | undefined,
  event: Record<string, any>,
): string {
  if (hookEventType === "Stop") {
    return "Claude Code execution stopped";
  }
  if (toolName) {
    const input = event.tool_input ?? event.input;
    if (toolName === "Write" || toolName === "Edit") {
      const filePath = input?.file_path ?? "file";
      return `${toolName === "Write" ? "Wrote" : "Edited"} ${filePath}`;
    }
    if (toolName === "Bash") {
      const cmd = typeof input?.command === "string" ? input.command.slice(0, 80) : "command";
      return `Ran: ${cmd}`;
    }
    return `Tool used: ${toolName}`;
  }
  return `Hook event: ${hookEventType}`;
}

// ---------------------------------------------------------------------------
// Sandbox Completion Webhook — POST /api/sandbox/completion
// Worker pushes completion after executeInBackground finishes, eliminating
// the finalize race condition. Auth via SANDBOX_API_SECRET bearer token.
// ---------------------------------------------------------------------------

http.route({
  path: "/api/sandbox/completion",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expectedSecret = process.env.SANDBOX_API_SECRET;
    if (!expectedSecret) {
      return new Response("Hook secret not configured", { status: 500 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    let payload: Record<string, any>;
    try {
      payload = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const sandboxId = payload.session_id;
    if (!sandboxId || typeof sandboxId !== "string") {
      return new Response("Missing session_id", { status: 400 });
    }

    // Resolve the worker's sandboxId to a Convex session document
    const session = await ctx.runQuery(internalApi.sandbox.sessions.getBySandboxId, { sandboxId });
    if (!session) {
      return new Response("Session not found", { status: 404 });
    }

    const status = typeof payload.status === "string" ? payload.status : "completed";

    await ctx.scheduler.runAfter(0, internalApi.sandbox.orchestrator.completeSession, {
      sessionId: session._id,
      commitSha: typeof payload.commitSha === "string" ? payload.commitSha : undefined,
      filesChanged: typeof payload.filesChanged === "number" ? payload.filesChanged : undefined,
      error: status === "failed" && typeof payload.error === "string" ? payload.error : undefined,
    });

    return new Response("OK", { status: 200 });
  }),
});

// ---------------------------------------------------------------------------
// Sandbox Tail Telemetry — POST /api/sandbox/tail-telemetry
// Receives per-invocation telemetry from the Cloudflare Tail Worker
// observing migration-sandbox-worker. Auth via SANDBOX_API_SECRET bearer token.
// ---------------------------------------------------------------------------

http.route({
  path: "/api/sandbox/tail-telemetry",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expectedSecret = process.env.SANDBOX_API_SECRET;
    if (!expectedSecret) {
      return new Response("Tail secret not configured", { status: 500 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    let payload: Record<string, any>;
    try {
      payload = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const sandboxId = payload.sandboxId;
    if (!sandboxId || typeof sandboxId !== "string") {
      return new Response("Missing sandboxId", { status: 400 });
    }

    await ctx.runMutation(internalApi.sandbox.telemetry.recordFromTail, {
      sandboxId,
      route: typeof payload.route === "string" ? payload.route : "",
      method: typeof payload.method === "string" ? payload.method : "",
      outcome: typeof payload.outcome === "string" ? payload.outcome : "unknown",
      eventTimestamp:
        typeof payload.eventTimestamp === "number" ? payload.eventTimestamp : Date.now(),
      cpuTimeMs: typeof payload.cpuTimeMs === "number" ? payload.cpuTimeMs : undefined,
      logs: Array.isArray(payload.logs) ? payload.logs : undefined,
      exceptions: Array.isArray(payload.exceptions) ? payload.exceptions : undefined,
    });

    return new Response("OK", { status: 200 });
  }),
});

// ---------------------------------------------------------------------------
// GitHub Webhook — POST /api/webhooks/github
// Validates HMAC SHA-256 signature, stores raw event, schedules processing.
// Target: < 500ms response time (validate + store + schedule).
// ---------------------------------------------------------------------------

http.route({
  path: "/api/webhooks/github",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[github-webhook] GITHUB_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // 1. Validate HMAC SHA-256 signature
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      return new Response("Missing signature header", { status: 400 });
    }

    const body = await request.text();

    const isValid = await verifyGitHubSignature(webhookSecret, body, signature);
    if (!isValid) {
      console.error("[github-webhook] Invalid signature");
      return new Response("Invalid signature", { status: 400 });
    }

    // 2. Extract event metadata
    const eventType = request.headers.get("x-github-event") ?? "unknown";
    const payload = JSON.parse(body) as Record<string, any>;
    const action = payload.action ?? null;
    const installationId = String(payload.installation?.id ?? "");

    if (!installationId) {
      return new Response("Missing installation ID", { status: 400 });
    }

    // 3. Resolve orgId from installation
    const orgId: string | null = await ctx.runQuery(
      internalApi.sourceControl.webhooks.handler.resolveOrgFromInstallation,
      { installationId },
    );

    // For installation events, orgId may not exist yet — use empty string
    const resolvedOrgId = orgId ?? "";

    // 4. Extract entityType + entityId for sequential processing
    const { entityType, entityId } = extractGitHubEntityInfo(eventType, payload);

    // 5. Store raw event in sourceControlEvents
    const eventId = await ctx.runMutation(internalApi.sourceControl.webhooks.handler.storeEvent, {
      orgId: resolvedOrgId,
      providerType: "github",
      eventType,
      action: action ?? undefined,
      entityType,
      entityId,
      payload,
    });

    // 6. Schedule async processing immediately
    await ctx.scheduler.runAfter(0, internalApi.sourceControl.webhooks.processor.processEvent, {
      eventId,
    });

    // 7. Return 200 OK immediately
    return new Response("OK", { status: 200 });
  }),
});

// ---------------------------------------------------------------------------
// verifyGitHubSignature — HMAC SHA-256 verification
// ---------------------------------------------------------------------------

async function verifyGitHubSignature(
  secret: string,
  payload: string,
  signatureHeader: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const expectedSignature =
    "sha256=" +
    Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  // Constant-time comparison
  if (expectedSignature.length !== signatureHeader.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// Atlassian Webhooks — POST /api/webhooks/jira + /api/webhooks/confluence
// Validates HMAC signatures, stores raw events, schedules async processing.
// ---------------------------------------------------------------------------

http.route({
  path: "/api/webhooks/jira",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    return await handleAtlassianWebhook(ctx, request, "jira");
  }),
});

http.route({
  path: "/api/webhooks/confluence",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    return await handleAtlassianWebhook(ctx, request, "confluence");
  }),
});

async function handleAtlassianWebhook(
  ctx: any,
  request: Request,
  providerType: "jira" | "confluence",
) {
  const webhookSecret = process.env.ATLASSIAN_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[atlassian-webhook] ATLASSIAN_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const signatureHeader = pickAtlassianSignatureHeader(request);
  if (!signatureHeader) {
    return new Response("Missing signature header", { status: 400 });
  }

  const body = await request.text();
  const isValid = await verifyAtlassianSignature(webhookSecret, body, signatureHeader);

  if (!isValid) {
    console.error("[atlassian-webhook] Invalid signature");
    return new Response("Invalid signature", { status: 400 });
  }

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(body) as Record<string, any>;
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  const atlassianSiteId = resolveAtlassianSiteId(payload);
  const eventType = resolveAtlassianEventType(providerType, payload, request);
  const action = resolveAtlassianAction(payload);

  const atlassianInternal = internalApi.atlassian;
  let resolved: { orgId: string; programId: string; connectionId: string } | null = null;

  if (providerType === "jira") {
    const jiraProjectKey =
      payload.issue?.fields?.project?.key ?? payload.project?.key ?? payload.projectKey;

    resolved = await ctx.runQuery(
      atlassianInternal.webhooks.handler.resolveProgramFromJiraPayload,
      {
        atlassianSiteId,
        jiraProjectKey: typeof jiraProjectKey === "string" ? jiraProjectKey : undefined,
      },
    );
  } else {
    const confluenceSpaceKey =
      payload.space?.key ??
      payload.page?.space?.key ??
      payload.content?.space?.key ??
      payload.spaceKey;

    resolved = await ctx.runQuery(
      atlassianInternal.webhooks.handler.resolveProgramFromConfluencePayload,
      {
        atlassianSiteId,
        confluenceSpaceKey: typeof confluenceSpaceKey === "string" ? confluenceSpaceKey : undefined,
      },
    );
  }

  const { entityType, entityId } = extractAtlassianEntityInfo(providerType, payload);

  const eventId = await ctx.runMutation(atlassianInternal.webhooks.handler.storeEvent, {
    orgId: resolved?.orgId ?? "",
    programId: resolved?.programId,
    providerType,
    atlassianSiteId,
    eventType,
    action,
    entityType,
    entityId,
    payload,
  });

  await ctx.scheduler.runAfter(0, atlassianInternal.webhooks.processor.processEvent, {
    eventId,
  });

  return new Response("OK", { status: 200 });
}

function pickAtlassianSignatureHeader(request: Request): string | null {
  return (
    request.headers.get("x-atlassian-webhook-signature") ??
    request.headers.get("x-hub-signature") ??
    request.headers.get("x-signature")
  );
}

function resolveAtlassianSiteId(payload: Record<string, any>): string | undefined {
  const candidate =
    payload.cloudId ??
    payload.atlassianSiteId ??
    payload.siteId ??
    payload.tenantId ??
    payload.tenant?.id;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
}

function resolveAtlassianEventType(
  providerType: "jira" | "confluence",
  payload: Record<string, any>,
  request: Request,
): string {
  if (typeof payload.webhookEvent === "string") return payload.webhookEvent;
  if (typeof payload.eventType === "string") return payload.eventType;
  if (typeof payload.event === "string") return payload.event;
  if (providerType === "confluence") {
    return request.headers.get("x-confluence-webhook-event") ?? "confluence_event";
  }
  return request.headers.get("x-jira-webhook-event") ?? "jira_event";
}

function resolveAtlassianAction(payload: Record<string, any>): string | undefined {
  const candidate =
    payload.action ?? payload.eventAction ?? payload.transition?.to_status ?? payload.event?.action;
  return typeof candidate === "string" ? candidate : undefined;
}

async function verifyAtlassianSignature(
  secret: string,
  payload: string,
  signatureHeader: string,
): Promise<boolean> {
  const normalizedSignature = signatureHeader.trim();
  const strippedSignature = normalizedSignature.startsWith("sha256=")
    ? normalizedSignature.slice("sha256=".length)
    : normalizedSignature;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const digestBytes = new Uint8Array(digest);

  const expectedHex = Array.from(digestBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const expectedBase64 = bytesToBase64(digestBytes);

  return (
    constantTimeEqual(strippedSignature, expectedHex) ||
    constantTimeEqual(strippedSignature, expectedBase64) ||
    constantTimeEqual(normalizedSignature, `sha256=${expectedHex}`)
  );
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i++) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return result === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Verification Results — POST /api/verification/results
// Worker pushes verification results (checks, screenshots, summary) after
// a verification run completes. Auth via VERIFICATION_API_SECRET bearer token.
// ---------------------------------------------------------------------------

http.route({
  path: "/api/verification/results",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expectedSecret = process.env.VERIFICATION_API_SECRET;
    if (!expectedSecret) {
      return new Response("Verification secret not configured", { status: 500 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    let payload: Record<string, any>;
    try {
      payload = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const verificationId = payload.verificationId;
    if (!verificationId || typeof verificationId !== "string") {
      return new Response("Missing verificationId", { status: 400 });
    }

    const payloadType = typeof payload.type === "string" ? payload.type : "final_results";

    if (payloadType === "status_update") {
      await ctx.scheduler.runAfter(0, internalApi.taskVerifications.processStatusUpdate, {
        verificationId: payload.verificationId,
        status: payload.status,
        startedAt: payload.startedAt,
        error: payload.error,
        durationMs: payload.durationMs,
      });
      return new Response("OK", { status: 200 });
    }

    if (payloadType !== "final_results") {
      return new Response("Unsupported verification payload type", { status: 400 });
    }

    await ctx.scheduler.runAfter(0, internalApi.taskVerifications.processResults, {
      verificationId: payload.verificationId,
      status: payload.status,
      checks: payload.checks,
      screenshotStorageIds: payload.screenshotStorageIds,
      aiSummary: payload.aiSummary,
      durationMs: payload.durationMs,
    });

    return new Response("OK", { status: 200 });
  }),
});

// Stripe Webhook — POST /api/webhooks/stripe
// Validates Stripe signature manually (no SDK import), stores raw event in
// billingEvents table, schedules async processing. Follows the durable event
// buffer pattern used by GitHub and Atlassian webhooks.
// ---------------------------------------------------------------------------

http.route({
  path: "/api/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // 1. Validate Stripe signature header
    const signatureHeader = request.headers.get("stripe-signature");
    if (!signatureHeader) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const body = await request.text();

    const isValid = await verifyStripeSignature(webhookSecret, body, signatureHeader);
    if (!isValid) {
      console.error("[stripe-webhook] Invalid signature");
      return new Response("Invalid signature", { status: 400 });
    }

    // 2. Parse payload
    let payload: Record<string, any>;
    try {
      payload = JSON.parse(body) as Record<string, any>;
    } catch {
      return new Response("Invalid JSON payload", { status: 400 });
    }

    const stripeEventId = payload.id;
    const eventType = payload.type;

    if (!stripeEventId || !eventType) {
      return new Response("Missing event id or type", { status: 400 });
    }

    // 3. Idempotency check — skip if event already received
    const existingEvent = await ctx.runQuery(
      internalApi.billing.webhookProcessor.getEventByStripeId,
      { stripeEventId },
    );
    if (existingEvent) {
      return new Response("Event already processed", { status: 200 });
    }

    // 4. Store raw event in billingEvents with status "pending"
    const eventId = await ctx.runMutation(internalApi.billing.webhookProcessor.storeEvent, {
      stripeEventId,
      eventType,
      payload,
    });

    // 5. Schedule async processing immediately
    await ctx.scheduler.runAfter(0, internalApi.billing.webhookProcessor.processEvent, { eventId });

    // 6. Return 200 OK immediately
    return new Response("OK", { status: 200 });
  }),
});

// ---------------------------------------------------------------------------
// Verification Screenshot Upload — POST /api/verification/screenshot
// Worker uploads screenshot blobs during verification. Returns storageId.
// Auth via VERIFICATION_API_SECRET bearer token.
// ---------------------------------------------------------------------------

http.route({
  path: "/api/verification/screenshot",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expectedSecret = process.env.VERIFICATION_API_SECRET;
    if (!expectedSecret) {
      return new Response("Verification secret not configured", { status: 500 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const blob = await request.blob();
      const storageId = await ctx.storage.store(blob);
      return new Response(JSON.stringify({ storageId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(`Storage error: ${err.message}`, { status: 500 });
    }
  }),
});
// verifyStripeSignature — manual HMAC SHA-256 verification for Stripe webhooks
// Stripe signature format: t=timestamp,v1=signature1,v1=signature2,...
// Signed payload: `${timestamp}.${body}`, HMAC SHA-256 with webhook secret.
// ---------------------------------------------------------------------------

async function verifyStripeSignature(
  secret: string,
  body: string,
  signatureHeader: string,
): Promise<boolean> {
  const parts = signatureHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  // Check timestamp freshness (5 min tolerance)
  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > tolerance) return false;

  const signedPayload = `${timestamp}.${body}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.some((s) => constantTimeEqual(s, expected));
}

export default http;
