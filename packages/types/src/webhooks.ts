export interface SandboxHookEventPayload {
  session_id: string;
  type: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  input?: Record<string, unknown>;
  timestamp?: number;
  [key: string]: unknown;
}

export interface SandboxCompletionWebhookPayload {
  session_id: string;
  status?: "completed" | "failed";
  commitSha?: string;
  filesChanged?: number;
  error?: string;
}

export interface SandboxTailTelemetryLog {
  level: string;
  message: string;
  timestamp: number;
}

export interface SandboxTailTelemetryException {
  name: string;
  message: string;
  timestamp: number;
}

export interface SandboxTailTelemetryPayload {
  sandboxId: string;
  route: string;
  method: string;
  outcome: string;
  eventTimestamp: number;
  cpuTimeMs?: number;
  logs?: SandboxTailTelemetryLog[];
  exceptions?: SandboxTailTelemetryException[];
}
