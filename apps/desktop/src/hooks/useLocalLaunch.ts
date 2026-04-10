import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useAction, useConvex } from "convex/react";
import type { LocalLaunchHandler, LocalLaunchResult } from "@foundry/ui/sandbox";
import { logDesktop, normalizeErrorForLog } from "../lib/desktop-logging";
import { tauriBridge } from "../lib/tauri-bridge";

interface SourceControlRepositoryRecord {
  _id: string;
  repoFullName?: string;
  defaultBranch?: string;
  localPath?: string;
}

type SandboxEditorType = "monaco" | "codemirror" | "none";

export function resolveDesktopEditorType(
  editorType: SandboxEditorType | undefined
): SandboxEditorType | undefined {
  if (editorType === "monaco") {
    return "codemirror";
  }
  return editorType;
}

function extractSessionId(result: unknown): string | null {
  if (typeof result === "string") {
    return result;
  }

  if (!result || typeof result !== "object") {
    return null;
  }

  const record = result as Record<string, unknown>;
  if (typeof record.sessionId === "string") {
    return record.sessionId;
  }
  if (typeof record._id === "string") {
    return record._id;
  }
  if (typeof record.id === "string") {
    return record.id;
  }

  return null;
}

function extractWorktreeBranch(result: unknown): string | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const record = result as Record<string, unknown>;
  if (typeof record.worktreeBranch === "string" && record.worktreeBranch.trim()) {
    return record.worktreeBranch.trim();
  }

  return null;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveLocalDeviceInfo(): {
  localDeviceId: string;
  localDeviceName: string;
} {
  if (typeof window === "undefined") {
    return {
      localDeviceId: "desktop-unknown",
      localDeviceName: "Foundry Desktop",
    };
  }

  const host = window.location.hostname.trim() || "tauri";
  const platform = window.navigator?.platform?.trim() || "unknown";

  return {
    localDeviceId: `desktop-${host}-${platform}`,
    localDeviceName: `Foundry Desktop (${platform})`,
  };
}

export function buildLocalDeviceId(
  localDeviceId: string,
  userId?: string | null,
  sessionId?: string | null
): string {
  const combined = [localDeviceId, userId ?? undefined, sessionId ?? undefined]
    .map((part) => normalizeOptionalString(part))
    .filter((part): part is string => Boolean(part))
    .join("-");

  let normalized = "";
  for (const character of combined) {
    if (/[a-zA-Z0-9]/.test(character)) {
      normalized += character.toLowerCase();
    } else if (character === "-" || character === "_" || character === ".") {
      normalized += character;
    } else {
      normalized += "-";
    }
  }

  const trimmed = normalized.replace(/^-+|-+$/g, "");
  return trimmed.length > 0 ? trimmed : "desktop-unknown";
}

export function useLocalLaunch(): LocalLaunchHandler {
  const convex = useConvex();
  const { sessionId, userId } = useAuth();

  const startLocal = useAction("sandbox/orchestrator:startLocal" as any);
  const startSubtaskExecution = useAction(
    "sandbox/orchestrator:startSubtaskExecution" as any
  );
  const executeSingleSubtask = useAction(
    "sandbox/orchestrator:executeSingleSubtask" as any
  );

  return useCallback<LocalLaunchHandler>(
    async (args): Promise<LocalLaunchResult> => {
      try {
        const programId = normalizeOptionalString(args.programId);
        if (!programId) {
          throw new Error("Program context is required for local launch.");
        }

        const repositoryId = normalizeOptionalString(args.repositoryId);
        if (!repositoryId) {
          throw new Error("Select a repository before launching locally.");
        }

        const taskPrompt = args.taskPrompt.trim();
        if (!taskPrompt) {
          throw new Error("Task prompt is required for local launch.");
        }

        logDesktop("info", "local-launch", "Starting local launch request", {
          taskId: args.taskId,
          programId,
          repositoryId,
          mode: args.mode ?? "task",
          subtaskId: args.subtaskId ?? null,
          subtaskCount: Array.isArray(args.subtaskIds) ? args.subtaskIds.length : 0,
          hasModel: Boolean(args.model),
          promptLength: taskPrompt.length,
        });

        const repositories = (await convex.query(
          "sourceControl/repositories:listByProgram" as any,
          { programId: programId as any }
        )) as SourceControlRepositoryRecord[] | null;

        logDesktop("info", "local-launch", "Resolved repositories for local launch", {
          programId,
          repositoryCount: Array.isArray(repositories) ? repositories.length : 0,
        });

        const repository = Array.isArray(repositories)
          ? repositories.find((entry) => String(entry?._id ?? "") === repositoryId)
          : null;
        if (!repository) {
          throw new Error("Selected repository is unavailable for this program.");
        }

        const repositoryPath = normalizeOptionalString(repository.localPath);
        if (!repositoryPath) {
          const repositoryLabel = repository.repoFullName ?? "the selected repository";
          throw new Error(
            `Set a local repository path for ${repositoryLabel} in Settings before launching locally.`
          );
        }

        const localDeviceInfo = resolveLocalDeviceInfo();
        const localDeviceId = buildLocalDeviceId(
          localDeviceInfo.localDeviceId,
          userId ?? undefined,
          sessionId ?? undefined
        );

        const payload: Record<string, unknown> = {
          taskId: args.taskId as any,
          repositoryId: repositoryId as any,
          taskPrompt,
          ...(args.skillId ? { skillId: args.skillId as any } : {}),
          ...(args.model ? { model: args.model } : {}),
          ...(args.editorType
            ? { editorType: resolveDesktopEditorType(args.editorType) }
            : {}),
          ...(typeof args.ttlMinutes === "number" ? { ttlMinutes: args.ttlMinutes } : {}),
          ...(args.authProvider ? { authProvider: args.authProvider } : {}),
          ...(args.presetId ? { presetId: args.presetId as any } : {}),
        };

        const mcpPayload =
          Array.isArray(args.mcpServerOverrides) && args.mcpServerOverrides.length > 0
            ? { mcpServerOverrides: args.mcpServerOverrides }
            : {};

        let startResult: unknown;
        let launchKind: "singleSubtask" | "subtasks" | "task" = "task";

        if (args.subtaskId) {
          launchKind = "singleSubtask";
          startResult = await executeSingleSubtask({
            ...payload,
            ...mcpPayload,
            subtaskId: args.subtaskId as any,
            runtime: "local",
            localDeviceId,
            localDeviceName: localDeviceInfo.localDeviceName,
          });
        } else if (
          (Array.isArray(args.subtaskIds) && args.subtaskIds.length > 0) ||
          args.mode === "allSubtasks" ||
          args.mode === "all"
        ) {
          launchKind = "subtasks";
          startResult = await startSubtaskExecution({
            ...payload,
            ...mcpPayload,
            ...(Array.isArray(args.subtaskIds) && args.subtaskIds.length > 0
              ? { subtaskIds: args.subtaskIds as any }
              : {}),
            runtime: "local",
            localDeviceId,
            localDeviceName: localDeviceInfo.localDeviceName,
          });
        } else {
          startResult = await startLocal({
            ...payload,
            localDeviceId,
            localDeviceName: localDeviceInfo.localDeviceName,
          });
        }

        const convexSessionId = extractSessionId(startResult);
        if (!convexSessionId) {
          throw new Error("Local launch failed: missing Convex session ID.");
        }

        const worktreeBranch =
          extractWorktreeBranch(startResult) ?? `foundry/task-${String(args.taskId)}`;
        const baseBranch = normalizeOptionalString(repository.defaultBranch) ?? "main";

        logDesktop("info", "local-launch", "Local launch action succeeded", {
          launchKind,
          convexSessionId,
          worktreeBranch,
          repositoryPath,
          baseBranch,
        });

        await tauriBridge.launchLocalSession({
          convexSessionId,
          worktreeBranch,
          repositoryPath,
          baseBranch,
          prompt: taskPrompt,
          ...(args.model ? { model: args.model } : {}),
          ...(Array.isArray(args.mcpServerOverrides) &&
          args.mcpServerOverrides.length > 0
            ? { mcpServerOverrides: args.mcpServerOverrides }
            : {}),
          ...(args.workspaceCustomization
            ? { workspaceCustomization: args.workspaceCustomization }
            : {}),
        });

        logDesktop("info", "local-launch", "Tauri session launch request submitted", {
          convexSessionId,
          worktreeBranch,
        });

        return { sessionId: convexSessionId };
      } catch (error) {
        logDesktop("error", "local-launch", "Local launch failed", {
          taskId: args.taskId,
          programId: args.programId,
          repositoryId: args.repositoryId,
          error: normalizeErrorForLog(error),
        });
        throw error;
      }
    },
    [
      convex,
      executeSingleSubtask,
      sessionId,
      startLocal,
      startSubtaskExecution,
      userId,
    ]
  );
}
