"use node";

import { v } from "convex/values";
import * as generatedApi from "../../_generated/api";
import { internalAction } from "../../_generated/server";

const MAX_EVENT_RETRIES = 5;
const internalApi: any = (generatedApi as any).internal;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "Unknown Atlassian webhook processing error";
}

export const processEvent = internalAction({
  args: { eventId: v.id("atlassianWebhookEvents") },
  handler: async (ctx, args) => {
    const atlassianInternal = internalApi.atlassian;

    const event = await ctx.runQuery(atlassianInternal.webhooks.handler.getEventById, {
      eventId: args.eventId,
    });

    if (!event) {
      console.error(`[atlassian-webhook] event ${args.eventId} not found`);
      return;
    }

    if (event.status === "processed" || event.status === "filtered") {
      return;
    }

    await ctx.runMutation(atlassianInternal.webhooks.handler.updateEventStatus, {
      eventId: args.eventId,
      status: "processing",
    });

    try {
      await routeEvent(ctx, event);

      await ctx.runMutation(atlassianInternal.webhooks.handler.updateEventStatus, {
        eventId: args.eventId,
        status: "processed",
        processedAt: Date.now(),
        lastError: undefined,
      });
    } catch (error) {
      const nextRetryCount = (event.retryCount ?? 0) + 1;
      const message = toErrorMessage(error);

      if (nextRetryCount >= MAX_EVENT_RETRIES) {
        await ctx.runMutation(atlassianInternal.webhooks.handler.updateEventStatus, {
          eventId: args.eventId,
          status: "failed",
          retryCount: nextRetryCount,
          processedAt: Date.now(),
          lastError: message,
        });
        return;
      }

      const retryDelayMs = Math.min(2 ** nextRetryCount * 1000, 300_000);
      await ctx.runMutation(atlassianInternal.webhooks.handler.updateEventStatus, {
        eventId: args.eventId,
        status: "pending",
        retryCount: nextRetryCount,
        lastError: message,
      });

      await ctx.scheduler.runAfter(
        retryDelayMs,
        atlassianInternal.webhooks.processor.processEvent,
        { eventId: args.eventId },
      );
    }
  },
});

async function routeEvent(
  ctx: any,
  event: {
    providerType: "jira" | "confluence";
    orgId: string;
    programId?: string;
    eventType: string;
    action?: string;
    payload: Record<string, unknown>;
  },
) {
  const atlassianInternal = internalApi.atlassian;

  if (event.providerType === "jira") {
    await ctx.runMutation(atlassianInternal.jira.sync.handleJiraWebhookEvent, {
      orgId: event.orgId,
      programId: event.programId,
      eventType: event.eventType,
      action: event.action,
      payload: event.payload,
    });
    return;
  }

  const result = await ctx.runMutation(
    atlassianInternal.confluence.ingest.handleConfluenceWebhookEvent,
    {
      orgId: event.orgId,
      programId: event.programId,
      eventType: event.eventType,
      action: event.action,
      payload: event.payload,
    },
  );

  // After storing the webhook event, check if auto-ingest should fetch full content
  if (result?.processed && event.programId && result.confluencePageId) {
    const program = await ctx.runQuery(atlassianInternal.confluence.ingest.getProgramInternal, {
      programId: event.programId,
    });

    if (program?.confluenceAutoIngest) {
      const pageTitle = result.confluencePageTitle ?? "";
      const filter = program.confluenceIngestFilter;
      const passesFilter = !filter || pageTitle.toLowerCase().includes(filter.toLowerCase());

      if (passesFilter) {
        await ctx.scheduler.runAfter(0, atlassianInternal.confluence.ingester.processIngestedPage, {
          programId: event.programId,
          confluencePageId: result.confluencePageId,
          confluencePageTitle: result.confluencePageTitle ?? "",
          confluenceVersion: result.confluenceVersion ?? 1,
        });
      }
    }
  }
}
