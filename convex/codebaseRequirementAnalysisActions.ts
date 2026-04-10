"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { callAgentService } from "./lib/agentServiceClient";
import { getProvider } from "./sourceControl/factory";
import type { GitHubProvider } from "./sourceControl/providers/github";

interface AnalysisResponse {
  implementationStatus: string;
  confidence: number;
  confidenceReasoning: string;
  evidence: {
    files: Array<{
      filePath: string;
      lineStart?: number;
      lineEnd?: number;
      snippet?: string;
      relevance: string;
    }>;
  };
  gapDescription?: string;
  metadata: {
    totalTokensUsed: number;
    inputTokens: number;
    outputTokens: number;
    processedAt: string;
  };
}

function deriveProposedStatus(implStatus: string, currentReqStatus: string): string | undefined {
  if (implStatus === "fully_implemented") {
    if (currentReqStatus !== "complete") return "complete";
  }
  if (implStatus === "partially_implemented") {
    if (currentReqStatus === "draft" || currentReqStatus === "approved") {
      return "in_progress";
    }
  }
  return undefined;
}

function isRegression(newStatus: string, currentImplStatus: string | undefined): boolean {
  if (!currentImplStatus) return false;
  const order: Record<string, number> = {
    not_found: 0,
    needs_verification: 1,
    partially_implemented: 2,
    fully_implemented: 3,
  };
  return (order[newStatus] ?? 0) < (order[currentImplStatus] ?? 0);
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "to",
  "in",
  "of",
  "with",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "have",
  "has",
  "do",
  "does",
  "will",
  "would",
  "could",
  "should",
  "may",
  "must",
  "can",
  "need",
  "each",
  "every",
  "all",
  "any",
  "both",
  "some",
  "such",
  "no",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "as",
  "at",
  "by",
  "from",
  "up",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "between",
  "under",
  "over",
]);

function extractSearchTerms(title: string, description?: string): string[] {
  const terms: string[] = [];
  // Split title on / , ; — and extract meaningful phrases
  const phrases = title
    .split(/[/,;—-]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const phrase of phrases) {
    const words = phrase
      .split(/\s+/)
      .filter((w) => !STOP_WORDS.has(w.toLowerCase()) && w.length > 2);
    if (words.length > 0) terms.push(words.join(" "));
  }
  // Also extract individual significant words for broader matching
  const allWords = title
    .split(/[\s/,;—-]+/)
    .filter((w) => !STOP_WORDS.has(w.toLowerCase()) && w.length > 4);
  for (const word of allWords) {
    if (!terms.includes(word)) terms.push(word);
  }
  // Add description keywords
  if (description) {
    const descWords = description
      .slice(0, 100)
      .split(/\s+/)
      .filter((w) => !STOP_WORDS.has(w.toLowerCase()) && w.length > 4)
      .slice(0, 5);
    if (descWords.length > 0) terms.push(descWords.join(" "));
  }
  return terms.slice(0, 5);
}

export const runWorkstreamAnalysis = action({
  args: {
    orgId: v.string(),
    runId: v.id("codebaseAnalysisRuns"),
    programId: v.id("programs"),
    workstreamId: v.id("workstreams"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    // Mark run as running
    await ctx.runMutation(internal.codebaseRequirementAnalysis.updateRunStatus, {
      runId: args.runId,
      status: "running",
    });

    try {
      // Fetch run config
      const run = await ctx.runQuery(internal.codebaseRequirementAnalysis.getRunInternal, {
        runId: args.runId,
      });
      if (!run) throw new Error("Run not found");

      // Fetch requirements for this workstream
      const allRequirements: Array<{
        _id: string;
        refId: string;
        title: string;
        description?: string;
        acceptanceCriteria?: string[];
        status: string;
        implementationStatus?: string;
        workstreamId?: string;
      }> = await ctx.runQuery(internal.requirements.listByProgramInternal, {
        programId: args.programId,
      });

      const requirements = allRequirements.filter((r) => r.workstreamId === args.workstreamId);

      // Fetch repo details
      const repos: Array<{
        _id: string;
        repoFullName: string;
        installationId: string;
        defaultBranch?: string;
        providerType: string;
      }> = await ctx.runQuery(internal.sourceControl.repositories.getRepoDetailsInternal, {
        repositoryIds: run.repositoryIds.map(String),
      });

      if (repos.length === 0) {
        throw new Error("No repositories found for this analysis run");
      }

      // Get installation token via provider
      const provider = getProvider(repos[0].providerType as any);
      const tokenResult = await provider.getInstallationToken(repos[0].installationId);

      // Optionally fetch knowledge graph nodes
      let graphNodes: Array<{ name: string; layer: string; filePath: string }> = [];
      if (run.config.useKnowledgeGraph) {
        // Get latest codebase analysis for this program
        const analyses: any[] = await ctx.runQuery(
          internal.codebaseAnalysis.listByProgramInternal as any,
          { orgId: args.orgId, programId: args.programId },
        );
        if (analyses.length > 0) {
          const latestAnalysis = analyses[0];
          const graph: { nodes: any[]; edges: any[] } = await ctx.runQuery(
            internal.codebaseAnalysis.getGraphInternal,
            { analysisId: latestAnalysis._id },
          );
          graphNodes = graph.nodes.map((n: any) => ({
            name: n.name,
            layer: n.layer,
            filePath: n.filePath,
          }));
        }
      }

      let totalInput = 0;
      let totalOutput = 0;
      let totalCost = 0;
      const statusCounts = {
        notFound: 0,
        partiallyImplemented: 0,
        fullyImplemented: 0,
        needsVerification: 0,
        autoApplied: 0,
        pendingReview: 0,
      };

      // Set up provider token for file content fetching
      (provider as GitHubProvider).setToken(tokenResult.token);

      // Analyze each requirement
      for (const req of requirements) {
        try {
          const maxFiles =
            run.config.modelTier === "fast" ? 5 : run.config.modelTier === "standard" ? 10 : 15;

          const candidateFiles: Array<{
            repoId: string;
            path: string;
            content: string;
          }> = [];
          const seenPaths = new Set<string>();

          // Pass 1: Semantic search for relevant code entities
          let semanticResults: Array<{
            entityType: string;
            name: string;
            filePath: string;
            lineStart: number;
            lineEnd: number;
            signature: string;
            docstring?: string;
            bodyPreview?: string;
            similarity: number;
          }> = [];

          try {
            semanticResults = await ctx.runAction(internal.codebaseAnalysisActions.semanticSearch, {
              orgId: args.orgId,
              programId: args.programId,
              queryText: `${req.title} ${req.description ?? ""}`.slice(0, 500),
              limit: maxFiles,
            });
            console.log(`Semantic search for ${req.refId}: ${semanticResults.length} results`);
          } catch (searchErr) {
            console.warn(
              `Semantic search failed for ${req.refId}: ${searchErr instanceof Error ? searchErr.message : searchErr}. Falling back to GitHub search.`,
            );
          }

          // Fetch file contents for semantic matches
          if (semanticResults.length > 0) {
            const branch = run.config.branch || repos[0].defaultBranch || "main";
            for (const entity of semanticResults) {
              if (seenPaths.has(entity.filePath)) continue;
              if (
                run.config.fileTypeFilter &&
                run.config.fileTypeFilter.length > 0 &&
                !run.config.fileTypeFilter.some((ext: string) => entity.filePath.endsWith(ext))
              ) {
                continue;
              }
              seenPaths.add(entity.filePath);
              try {
                const content = await provider.getFileContents(
                  repos[0].repoFullName,
                  entity.filePath,
                  branch,
                );
                candidateFiles.push({
                  repoId: repos[0]._id,
                  path: entity.filePath,
                  content: content.slice(0, 5000),
                });
              } catch {
                // File may have been deleted/moved since analysis — skip
              }
            }
          }

          // Fallback: GitHub search when semantic search returns no results
          if (candidateFiles.length === 0) {
            console.log(`No semantic results for ${req.refId}, falling back to GitHub search`);
            const searchQueries = extractSearchTerms(req.title, req.description);

            for (const repo of repos) {
              const repoFullName = repo.repoFullName;
              const branch = run.config.branch || repo.defaultBranch || "main";

              for (const query of searchQueries) {
                try {
                  const headers: Record<string, string> = {
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "Foundry-Agent",
                    Authorization: `token ${tokenResult.token}`,
                  };

                  const q = encodeURIComponent(
                    `${query} repo:${repoFullName}${run.config.directoryFilter ? ` path:${run.config.directoryFilter}` : ""}`,
                  );
                  const searchResp = await fetch(
                    `https://api.github.com/search/code?q=${q}&per_page=10`,
                    { headers },
                  );

                  if (searchResp.ok) {
                    const searchData = (await searchResp.json()) as {
                      items: Array<{ path: string; name: string }>;
                    };
                    console.log(
                      `GitHub search "${query}" in ${repoFullName}: ${searchData.items?.length ?? 0} results`,
                    );
                    for (const item of searchData.items ?? []) {
                      if (seenPaths.has(item.path)) continue;
                      if (
                        run.config.fileTypeFilter &&
                        run.config.fileTypeFilter.length > 0 &&
                        !run.config.fileTypeFilter.some((ext: string) => item.path.endsWith(ext))
                      ) {
                        continue;
                      }
                      seenPaths.add(item.path);

                      const fileResp = await fetch(
                        `https://api.github.com/repos/${repoFullName}/contents/${item.path}?ref=${branch}`,
                        {
                          headers: {
                            ...headers,
                            Accept: "application/vnd.github.raw+json",
                          },
                        },
                      );
                      if (fileResp.ok) {
                        const content = await fileResp.text();
                        candidateFiles.push({
                          repoId: repo._id,
                          path: item.path,
                          content: content.slice(0, 5000),
                        });
                      }
                    }
                  }
                } catch (ghErr) {
                  console.warn(
                    `GitHub search error for "${query}": ${ghErr instanceof Error ? ghErr.message : ghErr}`,
                  );
                }
              }
            }
          }

          const limitedFiles = candidateFiles.slice(0, maxFiles);

          // Pass 2: Claude analysis via agent worker
          const analysisResult = await callAgentService<AnalysisResponse>({
            endpoint: "/analyze-requirement",
            body: {
              requirementId: req.refId,
              requirementText: req.title,
              requirementDescription: req.description,
              acceptanceCriteria: req.acceptanceCriteria,
              candidateFiles: limitedFiles,
              knowledgeGraphNodes: graphNodes.length > 0 ? graphNodes : undefined,
              semanticMatches:
                semanticResults.length > 0
                  ? semanticResults.map((e) => ({
                      name: e.name,
                      type: e.entityType,
                      filePath: e.filePath,
                      signature: e.signature,
                      docstring: e.docstring,
                      similarity: Math.round(e.similarity * 100),
                    }))
                  : undefined,
              config: { modelTier: run.config.modelTier },
            },
            orgId: args.orgId,
            timeoutMs: 120_000,
          });

          // Track token costs
          if (analysisResult.metadata) {
            totalInput += analysisResult.metadata.inputTokens;
            totalOutput += analysisResult.metadata.outputTokens;
          }

          // Determine review status
          const implStatus = analysisResult.implementationStatus;
          const confidence = analysisResult.confidence;
          const proposedStatus = deriveProposedStatus(implStatus, req.status);
          const regression = isRegression(implStatus, req.implementationStatus);

          let reviewStatus: string;
          if (regression) {
            reviewStatus = "regression_flagged";
            statusCounts.pendingReview++;
          } else if (implStatus === "needs_verification") {
            // Always route needs_verification to pending review for human verification
            reviewStatus = "pending_review";
            statusCounts.pendingReview++;
          } else if (confidence >= run.config.confidenceThreshold && proposedStatus) {
            reviewStatus = "auto_applied";
            statusCounts.autoApplied++;
          } else if (proposedStatus) {
            reviewStatus = "pending_review";
            statusCounts.pendingReview++;
          } else {
            reviewStatus = "auto_applied"; // No status change needed
            statusCounts.autoApplied++;
          }

          // Count statuses
          if (implStatus === "not_found") statusCounts.notFound++;
          else if (implStatus === "partially_implemented") statusCounts.partiallyImplemented++;
          else if (implStatus === "fully_implemented") statusCounts.fullyImplemented++;
          else statusCounts.needsVerification++;

          // Add repositoryId to evidence files
          const evidenceWithRepo = {
            files: analysisResult.evidence.files.map((f) => ({
              ...f,
              repositoryId: repos[0]?._id ?? "unknown",
            })),
          };

          // Write result
          await ctx.runMutation(internal.codebaseRequirementAnalysis.insertResult, {
            runId: args.runId,
            programId: args.programId,
            orgId: args.orgId,
            requirementId: req._id as any,
            implementationStatus: implStatus as any,
            confidence,
            confidenceReasoning: analysisResult.confidenceReasoning,
            evidence: evidenceWithRepo,
            gapDescription: analysisResult.gapDescription,
            previousStatus: req.status,
            proposedStatus,
            reviewStatus: reviewStatus as any,
          });

          // Auto-apply high-confidence status changes
          if (reviewStatus === "auto_applied" && proposedStatus && !regression) {
            await ctx.runMutation(internal.requirements.updateStatusInternal, {
              requirementId: req._id as any,
              status: proposedStatus,
            });
          }

          // Increment progress
          await ctx.runMutation(internal.codebaseRequirementAnalysis.incrementAnalyzedCount, {
            runId: args.runId,
          });
        } catch (error) {
          // Log error for this requirement but continue with others
          console.error(
            `Analysis failed for ${req.refId}:`,
            error instanceof Error ? error.message : error,
          );
          await ctx.runMutation(internal.codebaseRequirementAnalysis.incrementAnalyzedCount, {
            runId: args.runId,
          });
        }
      }

      // Calculate rough cost (Sonnet: ~$3/1M input, ~$15/1M output)
      totalCost = (totalInput * 3) / 1_000_000 + (totalOutput * 15) / 1_000_000;

      // Mark run complete
      await ctx.runMutation(internal.codebaseRequirementAnalysis.updateRunStatus, {
        runId: args.runId,
        status: "completed",
        summary: statusCounts,
        tokenUsage: {
          input: totalInput,
          output: totalOutput,
          cost: Math.round(totalCost * 10000) / 10000,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.codebaseRequirementAnalysis.updateRunStatus, {
        runId: args.runId,
        status: "failed",
        errorMessage: msg,
      });
      throw error;
    }
  },
});
