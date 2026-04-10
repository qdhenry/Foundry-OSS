"use node";

import { ConvexError, v } from "convex/values";
import * as generatedApi from "../../_generated/api";
import { internalAction } from "../../_generated/server";

const internalApi: any = (generatedApi as any).internal;

const PRIORITY_MAP: Record<string, string> = {
  must_have: "Highest",
  should_have: "High",
  nice_to_have: "Medium",
  deferred: "Low",
};

function adfText(text: string) {
  return {
    type: "doc" as const,
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

export const pushWorkstreamAsEpic = internalAction({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    workstreamId: v.id("workstreams"),
    jiraProjectId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const atlassianInternal: any = internalApi.atlassian;

    const workstream = await ctx.runQuery(atlassianInternal.jira.mapperQueries.getWorkstreamQuery, {
      workstreamId: args.workstreamId,
    });
    if (!workstream) throw new ConvexError("Workstream not found");

    const fields = {
      project: { id: args.jiraProjectId },
      summary: `[${workstream.shortCode}] ${workstream.name}`,
      description: adfText(workstream.description ?? `Workstream: ${workstream.name}`),
      issuetype: { name: "Epic" },
    };

    const program = await ctx.runQuery(atlassianInternal.jira.mapperQueries.getProgramQuery, {
      programId: args.programId,
    });

    const queueItemId: string = await ctx.runMutation(
      atlassianInternal.jira.push.enqueueOperationInternal,
      {
        orgId: args.orgId,
        programId: args.programId,
        operationType: "create_issue" as const,
        payload: { fields, platformEntityType: "workstream" },
        platformEntityId: workstream._id,
      },
    );

    if (program?.jiraSyncMode === "auto") {
      await ctx.scheduler.runAfter(0, atlassianInternal.jira.executor.executeQueueItem, {
        queueItemId,
      });
    }

    return queueItemId;
  },
});

export const pushRequirementAsStory = internalAction({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    requirementId: v.id("requirements"),
    jiraProjectId: v.string(),
    epicKey: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const atlassianInternal: any = internalApi.atlassian;

    const requirement = await ctx.runQuery(
      atlassianInternal.jira.mapperQueries.getRequirementQuery,
      { requirementId: args.requirementId },
    );
    if (!requirement) throw new ConvexError("Requirement not found");

    const descParts = [
      `Priority: ${requirement.priority} | Fit/Gap: ${requirement.fitGap} | Effort: ${requirement.effortEstimate ?? "N/A"}`,
      "",
      requirement.description ?? "",
    ];

    const fields: Record<string, any> = {
      project: { id: args.jiraProjectId },
      summary: `[${requirement.refId}] ${requirement.title}`,
      description: adfText(descParts.join("\n")),
      issuetype: { name: "Story" },
      priority: { name: PRIORITY_MAP[requirement.priority] ?? "Medium" },
    };

    if (args.epicKey) {
      fields.parent = { key: args.epicKey };
    }

    const program = await ctx.runQuery(atlassianInternal.jira.mapperQueries.getProgramQuery, {
      programId: args.programId,
    });

    const queueItemId: string = await ctx.runMutation(
      atlassianInternal.jira.push.enqueueOperationInternal,
      {
        orgId: args.orgId,
        programId: args.programId,
        operationType: "create_issue" as const,
        payload: { fields, platformEntityType: "requirement" },
        platformEntityId: requirement._id,
      },
    );

    if (program?.jiraSyncMode === "auto") {
      await ctx.scheduler.runAfter(0, atlassianInternal.jira.executor.executeQueueItem, {
        queueItemId,
      });
    }

    return queueItemId;
  },
});

export const pushProgramToJira = internalAction({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    jiraProjectId: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    const atlassianInternal: any = internalApi.atlassian;

    const workstreams = await ctx.runQuery(
      atlassianInternal.jira.mapperQueries.listWorkstreamsInternal,
      { programId: args.programId },
    );

    const results: Array<{
      workstreamId: string;
      queueItemId: string;
      requirements: Array<{ requirementId: string; queueItemId: string }>;
    }> = [];

    for (const ws of workstreams) {
      const wsQueueId = await ctx.runAction(atlassianInternal.jira.mapper.pushWorkstreamAsEpic, {
        orgId: args.orgId,
        programId: args.programId,
        workstreamId: ws._id,
        jiraProjectId: args.jiraProjectId,
      });

      const requirements = await ctx.runQuery(
        atlassianInternal.jira.mapperQueries.listRequirementsByWorkstreamInternal,
        { workstreamId: ws._id },
      );

      const reqResults: Array<{
        requirementId: string;
        queueItemId: string;
      }> = [];
      for (const req of requirements) {
        const reqQueueId = await ctx.runAction(
          atlassianInternal.jira.mapper.pushRequirementAsStory,
          {
            orgId: args.orgId,
            programId: args.programId,
            requirementId: req._id,
            jiraProjectId: args.jiraProjectId,
          },
        );
        reqResults.push({ requirementId: req._id, queueItemId: reqQueueId });
      }

      results.push({
        workstreamId: ws._id,
        queueItemId: wsQueueId,
        requirements: reqResults,
      });
    }

    return results;
  },
});
