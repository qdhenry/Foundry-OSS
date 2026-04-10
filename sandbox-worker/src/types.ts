/// <reference types="@cloudflare/workers-types" />

import type { Sandbox as CloudflareSandbox } from "@cloudflare/sandbox";
import type { ApiError, SetupStageName } from "@foundry/types";

export type * from "@foundry/types";

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
] as const satisfies readonly SetupStageName[];

export interface WorkerExecutionContext {
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException?: () => void;
}

export interface Env {
  SANDBOX_API_SECRET: string;
  SANDBOX_LOG_LEVEL?: string;
  SANDBOX_LOG_FORMAT?: string;
  Sandbox?: DurableObjectNamespace<CloudflareSandbox>;
  SessionStore: DurableObjectNamespace;
}

export type ManagerResult<T> =
  | {
      ok: true;
      status: number;
      data: T;
    }
  | {
      ok: false;
      status: number;
      error: ApiError;
    };
