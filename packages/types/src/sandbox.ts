export type SandboxStatus =
  | "provisioning"
  | "cloning"
  | "ready"
  | "executing"
  | "finalizing"
  | "completed"
  | "failed"
  | "deleted";

export const RUNTIME_MODE_SEQUENCE = [
  "idle",
  "executing",
  "interactive",
  "hibernating",
] as const;

export type RuntimeMode = (typeof RUNTIME_MODE_SEQUENCE)[number];

export const SETUP_STAGE_SEQUENCE = [
  "containerProvision",
  "systemSetup",
  "authSetup",
  "claudeConfig",
  "gitClone",
  "depsInstall",
  "mcpInstall",
  "workspaceCustomization",
  "healthCheck",
  "ready",
] as const;

export type SetupStageName = (typeof SETUP_STAGE_SEQUENCE)[number];

export type SetupStageState =
  | { status: "pending" }
  | { status: "running"; startedAt: number }
  | { status: "completed"; startedAt: number; completedAt: number }
  | { status: "failed"; startedAt: number; failedAt: number; error: string }
  | { status: "skipped"; reason: string; skippedAt?: number };

export type StageState = SetupStageState;

export type SetupProgress = Record<SetupStageName, SetupStageState>;
export type SetupProgressUpdate = Partial<Record<SetupStageName, SetupStageState>>;

export interface SessionLifecycleMetadata {
  setupProgress: SetupProgress;
  runtimeMode: RuntimeMode;
}

export interface SessionMetadataSnapshot extends SessionLifecycleMetadata {
  sandboxId: string;
  status: SandboxStatus;
  mode: "cloudflare" | "in-memory";
  createdAt: string;
}

export type LogLevel = "info" | "stdout" | "stderr" | "system" | "error";

export interface LogEvent {
  sequence: number;
  sandboxId: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

export type SandboxLogStreamEvent =
  | {
      type: "log";
      log: LogEvent;
    }
  | {
      type: "status";
      sandboxId: string;
      status: SandboxStatus;
      timestamp: string;
      message?: string;
      setupProgress?: SetupProgressUpdate;
      runtimeMode?: RuntimeMode;
    }
  | {
      type: "heartbeat";
      timestamp: string;
    };
