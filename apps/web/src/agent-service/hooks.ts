interface ToolUseEvent {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  durationMs: number;
}

interface CostEvent {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  modelId: string;
}

// Audit logging hook — logs each tool use for debugging and compliance
export function createAuditHook(analysisId: string) {
  const toolUseLogs: ToolUseEvent[] = [];

  return {
    onToolUse: (event: ToolUseEvent) => {
      toolUseLogs.push(event);
      console.log(`[Analysis ${analysisId}] Tool: ${event.toolName} (${event.durationMs}ms)`);
    },
    getLogs: () => toolUseLogs,
  };
}

// Cost tracking hook — accumulates token usage across the analysis
export function createCostTrackingHook() {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheCreationTokens = 0;
  let modelId = "";

  return {
    onResponse: (event: CostEvent) => {
      totalInputTokens += event.inputTokens;
      totalOutputTokens += event.outputTokens;
      totalCacheReadTokens += event.cacheReadTokens ?? 0;
      totalCacheCreationTokens += event.cacheCreationTokens ?? 0;
      modelId = event.modelId;
    },
    getTotals: () => ({
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheReadTokens: totalCacheReadTokens,
      cacheCreationTokens: totalCacheCreationTokens,
      modelId,
    }),
  };
}
