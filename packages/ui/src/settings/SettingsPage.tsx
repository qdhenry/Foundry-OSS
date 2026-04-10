"use client";

import { useOrganization } from "@clerk/nextjs";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { BillingSettingsTab } from "../billing/BillingSettingsTab";
import { useProgramContext } from "../programs/ProgramContext";
import { AgentSettingsTab } from "./AgentSettingsTab";
import { GoogleDriveConnectionSettings } from "./GoogleDriveConnectionSettings";
import { ProvisionFromTemplate } from "./ProvisionFromTemplate";

interface AuthStatus {
  source: "manual_config" | "env_var" | "claude_code_oauth" | "none";
  isConfigured: boolean;
  claudeCodeInstalled: boolean;
  claudeCodeEmail?: string;
  apiKeyPrefix?: string;
}

type JiraSyncMode = "auto" | "auto_status_only" | "approval_required";

interface AtlassianConnection {
  status?: "connected" | "disconnected" | "setup_required";
  atlassianSiteUrl?: string;
  jiraProjectId?: string;
  jiraProjectKey?: string;
  confluenceSpaceKey?: string;
  confluenceParentPageId?: string;
  lastSyncAt?: number;
}

interface ProgramAtlassianSettings {
  jiraSyncMode?: JiraSyncMode;
  confluenceAutoIngest?: boolean;
  confluenceIngestFilter?: string;
}

const PHASES = ["discovery", "build", "test", "deploy", "complete"] as const;
const ROLES = ["director", "architect", "developer", "ba", "qa", "client"] as const;

const PHASE_COLORS: Record<string, string> = {
  discovery: "bg-status-info-bg text-status-info-fg border border-status-info-border",
  build: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  test: "bg-status-success-bg text-status-success-fg border border-status-success-border",
  deploy: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  complete: "bg-status-success-bg text-status-success-fg border border-status-success-border",
};

const ROLE_COLORS: Record<string, string> = {
  director: "bg-status-success-bg text-status-success-fg border border-status-success-border",
  architect: "bg-status-info-bg text-status-info-fg border border-status-info-border",
  developer: "bg-status-success-bg text-status-success-fg border border-status-success-border",
  ba: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  qa: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  client: "bg-surface-raised text-text-secondary",
};

const REPO_ROLES = [
  "storefront",
  "integration",
  "data_migration",
  "infrastructure",
  "extension",
  "documentation",
] as const;
type RepoRole = (typeof REPO_ROLES)[number];
interface SourceControlRepository {
  _id: GenericId<"sourceControlRepositories">;
  repoFullName: string;
  role: RepoRole;
  isMonorepo: boolean;
  localPath?: string;
  pathFilters?: string[];
  deployWorkflowNames?: string[];
  syncStatus?: string;
  lastWebhookAt?: number;
}

const REPO_ROLE_COLORS: Record<string, string> = {
  storefront: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  integration: "bg-status-info-bg text-status-info-fg border border-status-info-border",
  data_migration: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  infrastructure: "bg-surface-raised text-text-secondary",
  extension: "bg-status-success-bg text-status-success-fg border border-status-success-border",
  documentation: "bg-status-info-bg text-status-info-fg border border-status-info-border",
};

const SYNC_STATUS_COLORS: Record<string, string> = {
  healthy: "bg-status-success-fg",
  stale: "bg-status-warning-fg",
  error: "bg-status-error-fg",
};

const ATLASSIAN_STATUS_COLORS: Record<string, string> = {
  connected: "bg-status-success-bg text-status-success-fg border border-status-success-border",
  setup_required: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  disconnected: "bg-surface-raised text-text-secondary",
};

const ATLASSIAN_OAUTH_PARAM_KEYS = [
  "atlassian_oauth",
  "atlassian_oauth_reason",
  "atlassian_oauth_message",
  "atlassian_oauth_code",
  "atlassian_oauth_state",
] as const;

const GOOGLE_DRIVE_OAUTH_PARAM_KEYS = [
  "google_drive_oauth",
  "google_drive_oauth_reason",
  "google_drive_oauth_message",
  "google_drive_oauth_code",
  "google_drive_oauth_state",
] as const;

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred.";
}

function isMissingConvexFunctionError(message: string): boolean {
  return (
    message.includes("Could not find public function") ||
    message.includes("Could not find function") ||
    message.includes("is not a functionReference")
  );
}

function sanitizeErrorForUi(message: string): string {
  if (message.length > 240) {
    return `${message.slice(0, 237)}...`;
  }
  return message;
}

function isDesktopRuntimeEnvironment(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const runtimeWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return Boolean(runtimeWindow.__TAURI__ || runtimeWindow.__TAURI_INTERNALS__);
}

type DesktopInvokeWindow = Window & {
  __TAURI__?: { invoke?: <TResult>(command: string, args?: unknown) => Promise<TResult> };
  __TAURI_INTERNALS__?: {
    invoke?: <TResult>(command: string, args?: unknown) => Promise<TResult>;
  };
};

async function pickDirectoryInDesktopRuntime(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const runtimeWindow = window as DesktopInvokeWindow;
  const invoke = runtimeWindow.__TAURI__?.invoke ?? runtimeWindow.__TAURI_INTERNALS__?.invoke;
  if (typeof invoke !== "function") {
    return null;
  }

  const pickedPath = await invoke<string | null>("pick_directory");
  if (typeof pickedPath !== "string") {
    return null;
  }

  const trimmed = pickedPath.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readGithubAppSlug(): string | undefined {
  // Next.js statically replaces this literal at build time
  const staticValue = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
  if (typeof staticValue === "string" && staticValue.trim().length > 0) {
    return staticValue.trim();
  }

  // Fallback: runtime lookup for desktop (Tauri) where process.env may not exist
  const runtimeGlobal = globalThis as {
    process?: {
      env?: Record<string, unknown>;
    };
  };
  const env = runtimeGlobal.process?.env;
  if (!env || typeof env !== "object") {
    return undefined;
  }

  const value = env.NEXT_PUBLIC_GITHUB_APP_SLUG;
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function SettingsPage() {
  const { program, programId } = useProgramContext();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [isDesktopRuntime, setIsDesktopRuntime] = useState(false);
  const githubAppSlug = readGithubAppSlug();

  const convex = useConvex();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const billingRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (tabParam === "billing") {
      const timer = setTimeout(() => {
        billingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [tabParam]);

  const atlassianOAuthStatus = searchParams.get("atlassian_oauth");
  const atlassianOAuthReason = searchParams.get("atlassian_oauth_reason");
  const atlassianOAuthMessage = searchParams.get("atlassian_oauth_message");
  const atlassianOAuthCode = searchParams.get("atlassian_oauth_code");
  const atlassianOAuthState = searchParams.get("atlassian_oauth_state");

  const gdriveOAuthStatus = searchParams.get("google_drive_oauth");
  const gdriveOAuthReason = searchParams.get("google_drive_oauth_reason");
  const gdriveOAuthMessage = searchParams.get("google_drive_oauth_message");
  const gdriveOAuthCode = searchParams.get("google_drive_oauth_code");
  const gdriveOAuthState = searchParams.get("google_drive_oauth_state");
  const programAtlassianSettings = program as typeof program & ProgramAtlassianSettings;

  const updateProgram = useMutation("programs:update" as any);
  const updatePhase = useMutation("programs:updatePhase" as any);
  const removeProgram = useMutation("programs:remove" as any);
  const teamMembers = useQuery("teamMembers:listByProgram" as any, { programId });
  const orgUsers = useQuery("users:list" as any, orgId ? { orgId } : "skip");
  const workstreams = useQuery("workstreams:listByProgram" as any, { programId });
  const addMember = useMutation("teamMembers:add" as any);
  const updateMember = useMutation("teamMembers:update" as any);
  const removeMember = useMutation("teamMembers:remove" as any);

  // Program details form state
  const [name, setName] = useState(program.name);
  const [clientName, setClientName] = useState(program.clientName);
  const [description, setDescription] = useState(program.description || "");
  const [startDate, setStartDate] = useState(
    program.startDate ? new Date(program.startDate).toISOString().split("T")[0] : "",
  );
  const [targetEndDate, setTargetEndDate] = useState(
    program.targetEndDate ? new Date(program.targetEndDate).toISOString().split("T")[0] : "",
  );
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // AI auth state
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [authError, setAuthError] = useState("");

  // Atlassian state
  const [atlassianConnection, setAtlassianConnection] = useState<AtlassianConnection | null>(null);
  const [atlassianLoading, setAtlassianLoading] = useState(true);
  const [atlassianError, setAtlassianError] = useState("");
  const [atlassianBackendUnavailable, setAtlassianBackendUnavailable] = useState(false);
  const [atlassianNotice, setAtlassianNotice] = useState("");
  const [savingAtlassianBindings, setSavingAtlassianBindings] = useState(false);
  const [savingAtlassianSettings, setSavingAtlassianSettings] = useState(false);
  const [disconnectingAtlassian, setDisconnectingAtlassian] = useState(false);
  const [startingAtlassianOauth, setStartingAtlassianOauth] = useState(false);
  const [completingAtlassianOauth, setCompletingAtlassianOauth] = useState(false);
  const [confirmDisconnectAtlassian, setConfirmDisconnectAtlassian] = useState(false);

  // Google Drive OAuth state
  const [gdriveNotice, setGdriveNotice] = useState("");
  const [gdriveError, setGdriveError] = useState("");
  const [completingGdriveOauth, setCompletingGdriveOauth] = useState(false);

  const [jiraProjectId, setJiraProjectId] = useState("");
  const [jiraProjectKey, setJiraProjectKey] = useState("");
  const [confluenceSpaceKey, setConfluenceSpaceKey] = useState("");
  const [confluenceParentPageId, setConfluenceParentPageId] = useState("");

  // Dropdown data for Atlassian bindings
  const [jiraProjects, setJiraProjects] = useState<{ id: string; key: string; name: string }[]>([]);
  const [confluenceSpaces, setConfluenceSpaces] = useState<
    { id: string; key: string; name: string }[]
  >([]);
  const [confluencePages, setConfluencePages] = useState<{ id: string; title: string }[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [manualJiraProject, setManualJiraProject] = useState(false);
  const [manualConfluenceSpace, setManualConfluenceSpace] = useState(false);
  const [manualConfluencePage, setManualConfluencePage] = useState(false);
  // Track the selected Confluence space ID (needed for v2 API page listing)
  const [confluenceSpaceId, setConfluenceSpaceId] = useState("");
  // Track whether API fetches failed so we can auto-fallback to manual entry
  const [_projectsFetchFailed, setProjectsFetchFailed] = useState(false);
  const [_spacesFetchFailed, setSpacesFetchFailed] = useState(false);
  const [_pagesFetchFailed, setPagesFetchFailed] = useState(false);
  const [jiraSyncMode, setJiraSyncMode] = useState<JiraSyncMode>(
    programAtlassianSettings.jiraSyncMode ?? "auto",
  );
  const [confluenceAutoIngest, setConfluenceAutoIngest] = useState(
    programAtlassianSettings.confluenceAutoIngest ?? false,
  );
  const [confluenceIngestFilter, setConfluenceIngestFilter] = useState(
    programAtlassianSettings.confluenceIngestFilter ?? "",
  );

  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agent-auth");
      if (res.ok) {
        setAuthStatus(await res.json());
      }
    } catch {
      // Agent service may not be running
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthStatus();
  }, [fetchAuthStatus]);

  useEffect(() => {
    setIsDesktopRuntime(isDesktopRuntimeEnvironment());
  }, []);

  const handleSaveApiKey = async () => {
    setAuthError("");
    if (!apiKeyInput.startsWith("sk-ant-")) {
      setAuthError("Invalid key format. Expected prefix: sk-ant-");
      return;
    }
    setSavingKey(true);
    try {
      const res = await fetch("/api/agent-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput }),
      });
      if (res.ok) {
        setAuthStatus(await res.json());
        setApiKeyInput("");
      } else {
        const data = (await res.json()) as { error?: string };
        setAuthError(data.error ?? "Failed to save key");
      }
    } catch {
      setAuthError("Could not reach agent service");
    } finally {
      setSavingKey(false);
    }
  };

  const handleClearApiKey = async () => {
    try {
      const res = await fetch("/api/agent-auth", { method: "DELETE" });
      if (res.ok) {
        setAuthStatus(await res.json());
      }
    } catch {
      // ignore
    }
  };

  const clearAtlassianOauthParams = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    for (const key of ATLASSIAN_OAUTH_PARAM_KEYS) {
      nextParams.delete(key);
    }
    const queryString = nextParams.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }, [pathname, router, searchParams]);

  const clearGdriveOauthParams = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    for (const key of GOOGLE_DRIVE_OAUTH_PARAM_KEYS) {
      nextParams.delete(key);
    }
    const queryString = nextParams.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }, [pathname, router, searchParams]);

  const fetchAtlassianConnection = useCallback(async () => {
    setAtlassianLoading(true);
    try {
      const connection = await convex.query("atlassian/connections:getByProgram" as any, {
        programId,
      });
      setAtlassianConnection((connection ?? null) as AtlassianConnection | null);
      setAtlassianBackendUnavailable(false);
      setAtlassianError("");
    } catch (error) {
      const message = sanitizeErrorForUi(getErrorMessage(error));
      if (isMissingConvexFunctionError(message)) {
        setAtlassianBackendUnavailable(true);
        setAtlassianError(
          "Atlassian backend APIs are not deployed yet. Deploy the worker functions, then refresh this page.",
        );
      } else {
        setAtlassianBackendUnavailable(false);
        setAtlassianError(message);
      }
      setAtlassianConnection(null);
    } finally {
      setAtlassianLoading(false);
    }
  }, [convex, programId]);

  useEffect(() => {
    void fetchAtlassianConnection();
  }, [fetchAtlassianConnection]);

  useEffect(() => {
    setJiraSyncMode(programAtlassianSettings.jiraSyncMode ?? "auto");
    setConfluenceAutoIngest(programAtlassianSettings.confluenceAutoIngest ?? false);
    setConfluenceIngestFilter(programAtlassianSettings.confluenceIngestFilter ?? "");
  }, [
    programAtlassianSettings.confluenceAutoIngest,
    programAtlassianSettings.confluenceIngestFilter,
    programAtlassianSettings.jiraSyncMode,
  ]);

  useEffect(() => {
    setJiraProjectId(atlassianConnection?.jiraProjectId ?? "");
    setJiraProjectKey(atlassianConnection?.jiraProjectKey ?? "");
    setConfluenceSpaceKey(atlassianConnection?.confluenceSpaceKey ?? "");
    setConfluenceParentPageId(atlassianConnection?.confluenceParentPageId ?? "");
  }, [
    atlassianConnection?.confluenceParentPageId,
    atlassianConnection?.confluenceSpaceKey,
    atlassianConnection?.jiraProjectId,
    atlassianConnection?.jiraProjectKey,
  ]);

  // Fetch Jira projects and Confluence spaces when connected
  useEffect(() => {
    if (atlassianConnection?.status !== "connected") return;

    let cancelled = false;

    const fetchProjectsAndSpaces = async () => {
      setLoadingProjects(true);
      setLoadingSpaces(true);
      setProjectsFetchFailed(false);
      setSpacesFetchFailed(false);
      try {
        const [projectsResult, spacesResult] = await Promise.all([
          convex
            .action("atlassian/connections:listProjects" as any, {
              programId,
            })
            .catch(() => null),
          convex
            .action("atlassian/connections:listSpaces" as any, {
              programId,
            })
            .catch(() => null),
        ]);
        if (cancelled) return;
        if (projectsResult?.values) {
          const projects = projectsResult.values.map((p: any) => ({
            id: String(p.id),
            key: String(p.key),
            name: String(p.name),
          }));
          setJiraProjects(projects);
          // Reconcile: if stored jiraProjectKey matches a fetched project, update jiraProjectId to the API value
          if (atlassianConnection?.jiraProjectKey) {
            const match = projects.find(
              (p: { key: string }) => p.key === atlassianConnection.jiraProjectKey,
            );
            if (match) {
              setJiraProjectId(match.id);
              setJiraProjectKey(match.key);
            }
          }
        } else {
          // API returned no data or unexpected format — fall back to manual entry
          setProjectsFetchFailed(true);
          setManualJiraProject(true);
        }
        if (spacesResult?.results) {
          const spaces = spacesResult.results.map((s: any) => ({
            id: String(s.id),
            key: String(s.key),
            name: String(s.name),
          }));
          setConfluenceSpaces(spaces);
          // If we already have a spaceKey selected, resolve its ID for v2 API
          if (atlassianConnection?.confluenceSpaceKey) {
            const match = spaces.find(
              (s: { key: string }) => s.key === atlassianConnection.confluenceSpaceKey,
            );
            if (match) {
              setConfluenceSpaceId(match.id);
            }
          }
        } else {
          // API returned no data or unexpected format — fall back to manual entry
          setSpacesFetchFailed(true);
          setManualConfluenceSpace(true);
        }
      } catch {
        if (!cancelled) {
          // Network or permission error — fall back to manual entry
          setProjectsFetchFailed(true);
          setSpacesFetchFailed(true);
          setManualJiraProject(true);
          setManualConfluenceSpace(true);
        }
      } finally {
        if (!cancelled) {
          setLoadingProjects(false);
          setLoadingSpaces(false);
        }
      }
    };

    void fetchProjectsAndSpaces();
    return () => {
      cancelled = true;
    };
  }, [
    atlassianConnection?.status,
    atlassianConnection?.confluenceSpaceKey,
    atlassianConnection?.jiraProjectKey,
    convex,
    programId,
  ]);

  // Fetch Confluence pages when space changes (uses spaceId for v2 API)
  useEffect(() => {
    if (atlassianConnection?.status !== "connected" || !confluenceSpaceId) {
      setConfluencePages([]);
      return;
    }

    let cancelled = false;
    setPagesFetchFailed(false);
    const fetchPages = async () => {
      setLoadingPages(true);
      try {
        const result = await convex.action("atlassian/connections:listPages" as any, {
          programId,
          spaceId: confluenceSpaceId,
        });
        if (cancelled) return;
        if (result?.results) {
          setConfluencePages(
            result.results.map((p: any) => ({
              id: String(p.id),
              title: String(p.title),
            })),
          );
        } else {
          // Unexpected response format — fall back to manual entry
          setPagesFetchFailed(true);
          setManualConfluencePage(true);
          setConfluencePages([]);
        }
      } catch {
        if (!cancelled) {
          setPagesFetchFailed(true);
          setManualConfluencePage(true);
          setConfluencePages([]);
        }
      } finally {
        if (!cancelled) setLoadingPages(false);
      }
    };

    void fetchPages();
    return () => {
      cancelled = true;
    };
  }, [atlassianConnection?.status, confluenceSpaceId, convex, programId]);

  const handleStartAtlassianOauth = async () => {
    setAtlassianError("");
    setAtlassianNotice("");
    setStartingAtlassianOauth(true);
    try {
      const result = (await convex.mutation("atlassian/connections:startOAuth" as any, {
        programId,
      })) as { authorizationUrl?: string };

      if (!result?.authorizationUrl) {
        throw new Error("Atlassian authorization URL was not returned.");
      }

      window.location.assign(result.authorizationUrl);
    } catch (error) {
      const message = sanitizeErrorForUi(getErrorMessage(error));
      if (isMissingConvexFunctionError(message)) {
        setAtlassianBackendUnavailable(true);
      }
      setAtlassianError(message);
      setStartingAtlassianOauth(false);
    }
  };

  const handleSaveAtlassianBindings = async () => {
    setAtlassianError("");
    setAtlassianNotice("");
    setSavingAtlassianBindings(true);
    try {
      await convex.mutation("atlassian/connections:updateBindings" as any, {
        programId,
        jiraProjectId: jiraProjectId.trim(),
        jiraProjectKey: jiraProjectKey.trim(),
        confluenceSpaceKey: confluenceSpaceKey.trim(),
        confluenceParentPageId: confluenceParentPageId.trim(),
      });
      setAtlassianNotice("Atlassian bindings saved.");
      setAtlassianBackendUnavailable(false);
      await fetchAtlassianConnection();
    } catch (error) {
      const message = sanitizeErrorForUi(getErrorMessage(error));
      if (isMissingConvexFunctionError(message)) {
        setAtlassianBackendUnavailable(true);
      }
      setAtlassianError(message);
    } finally {
      setSavingAtlassianBindings(false);
    }
  };

  const handleSaveAtlassianSettings = async () => {
    setAtlassianError("");
    setAtlassianNotice("");
    setSavingAtlassianSettings(true);
    try {
      await convex.mutation("programs:updateAtlassianSettings" as any, {
        programId,
        jiraSyncMode,
        confluenceAutoIngest,
        confluenceIngestFilter: confluenceIngestFilter.trim() || undefined,
      });
      setAtlassianNotice("Atlassian sync settings saved.");
      setAtlassianBackendUnavailable(false);
    } catch (error) {
      const message = sanitizeErrorForUi(getErrorMessage(error));
      if (isMissingConvexFunctionError(message)) {
        setAtlassianBackendUnavailable(true);
      }
      setAtlassianError(message);
    } finally {
      setSavingAtlassianSettings(false);
    }
  };

  const handleDisconnectAtlassian = async () => {
    setAtlassianError("");
    setAtlassianNotice("");
    setDisconnectingAtlassian(true);
    try {
      await convex.mutation("atlassian/connections:disconnect" as any, {
        programId,
      });
      setAtlassianNotice("Atlassian disconnected.");
      setAtlassianBackendUnavailable(false);
      setConfirmDisconnectAtlassian(false);
      await fetchAtlassianConnection();
    } catch (error) {
      const message = sanitizeErrorForUi(getErrorMessage(error));
      if (isMissingConvexFunctionError(message)) {
        setAtlassianBackendUnavailable(true);
      }
      setAtlassianError(message);
    } finally {
      setDisconnectingAtlassian(false);
    }
  };

  const oauthCompletionStarted = useRef(false);

  useEffect(() => {
    if (atlassianOAuthStatus !== "callback") return;
    if (!atlassianOAuthCode || !atlassianOAuthState) {
      setAtlassianError("Missing OAuth callback parameters from Atlassian.");
      clearAtlassianOauthParams();
      return;
    }

    // Prevent double invocation from React Strict Mode
    if (oauthCompletionStarted.current) return;
    oauthCompletionStarted.current = true;

    let cancelled = false;
    const completeOauth = async () => {
      setCompletingAtlassianOauth(true);
      setAtlassianError("");
      setAtlassianNotice("Completing Atlassian authorization...");

      try {
        await convex.action("atlassian/connections:completeOAuth" as any, {
          code: atlassianOAuthCode,
          state: atlassianOAuthState,
        });

        if (cancelled) return;
        setAtlassianBackendUnavailable(false);
        setAtlassianNotice("Atlassian connected successfully.");
        await fetchAtlassianConnection();
      } catch (error) {
        if (cancelled) return;
        const message = sanitizeErrorForUi(getErrorMessage(error));
        if (isMissingConvexFunctionError(message)) {
          setAtlassianBackendUnavailable(true);
        }
        setAtlassianError(message);
      } finally {
        if (cancelled) return;
        setCompletingAtlassianOauth(false);
        clearAtlassianOauthParams();
      }
    };

    void completeOauth();

    return () => {
      cancelled = true;
      oauthCompletionStarted.current = false;
    };
  }, [
    atlassianOAuthCode,
    atlassianOAuthState,
    atlassianOAuthStatus,
    clearAtlassianOauthParams,
    convex,
    fetchAtlassianConnection,
  ]);

  useEffect(() => {
    if (atlassianOAuthStatus !== "error") return;
    const reason = atlassianOAuthReason ? `${atlassianOAuthReason}: ` : "";
    const message = atlassianOAuthMessage ?? "Atlassian OAuth failed.";
    setAtlassianError(`${reason}${message}`);
    clearAtlassianOauthParams();
  }, [
    atlassianOAuthMessage,
    atlassianOAuthReason,
    atlassianOAuthStatus,
    clearAtlassianOauthParams,
  ]);

  // Google Drive OAuth callback handler
  const gdOauthCompletionStarted = useRef(false);

  useEffect(() => {
    if (gdriveOAuthStatus !== "callback") return;
    if (!gdriveOAuthCode || !gdriveOAuthState) {
      setGdriveError("Missing OAuth callback parameters from Google.");
      clearGdriveOauthParams();
      return;
    }

    if (gdOauthCompletionStarted.current) return;
    gdOauthCompletionStarted.current = true;

    let cancelled = false;
    const completeGdrive = async () => {
      setCompletingGdriveOauth(true);
      setGdriveError("");
      setGdriveNotice("Completing Google Drive authorization...");

      try {
        await convex.action("googleDrive/credentials:completeOAuth" as any, {
          code: gdriveOAuthCode,
          state: gdriveOAuthState,
        });

        if (cancelled) return;
        setGdriveNotice("Google Drive connected successfully.");
      } catch (error) {
        if (cancelled) return;
        setGdriveError(getErrorMessage(error));
        setGdriveNotice("");
      } finally {
        if (cancelled) return;
        setCompletingGdriveOauth(false);
        clearGdriveOauthParams();
      }
    };

    void completeGdrive();

    return () => {
      cancelled = true;
    };
  }, [gdriveOAuthCode, gdriveOAuthState, gdriveOAuthStatus, clearGdriveOauthParams, convex]);

  useEffect(() => {
    if (gdriveOAuthStatus !== "error") return;
    const reason = gdriveOAuthReason ? `${gdriveOAuthReason}: ` : "";
    const message = gdriveOAuthMessage ?? "Google Drive authorization failed.";
    setGdriveError(`${reason}${message}`);
    clearGdriveOauthParams();
  }, [gdriveOAuthMessage, gdriveOAuthReason, gdriveOAuthStatus, clearGdriveOauthParams]);

  // Source control state
  const installations = useQuery(
    "sourceControl/installations:listByOrg" as any,
    orgId ? { orgId } : "skip",
  );
  const unboundInstallations = useQuery("sourceControl/installations:listUnbound" as any);
  const claimInstallation = useMutation("sourceControl/installations:claimInstallation" as any);
  const hasActiveInstallation = installations?.some((i: any) => i.status === "active");

  const listAvailableRepos = useAction(
    "sourceControl/listAvailableRepos:listAvailableRepos" as any,
  );
  const connectRepo = useMutation("sourceControl/repositories:connectRepository" as any);
  const [showConnectRepo, setShowConnectRepo] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<
    Array<{
      id: number;
      full_name: string;
      name: string;
      default_branch: string;
      language: string | null;
      private: boolean;
    }>
  >([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connectingRepo, setConnectingRepo] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<RepoRole>("storefront");
  const [repoSearchQuery, setRepoSearchQuery] = useState("");
  const filteredRepos = repoSearchQuery
    ? availableRepos.filter((r) =>
        r.full_name.toLowerCase().includes(repoSearchQuery.toLowerCase()),
      )
    : availableRepos;

  // Auto-claim unbound installations for the current org
  useEffect(() => {
    if (!orgId || !unboundInstallations || unboundInstallations.length === 0) return;
    // Claim all unbound active installations
    for (const toClaim of unboundInstallations) {
      claimInstallation({ installationId: toClaim.installationId, orgId });
    }
  }, [orgId, unboundInstallations, claimInstallation]);

  const handleConnectRepo = async () => {
    if (!orgId || !installations) return;
    const activeInstall = installations.find((i: any) => i.status === "active");
    if (!activeInstall) return;
    setShowConnectRepo(true);
    setLoadingRepos(true);
    try {
      const repos = await listAvailableRepos({
        installationId: activeInstall.installationId,
        orgId,
      });
      // Filter out already-connected repos
      const connectedNames = new Set(
        (repositories ?? []).map((r: SourceControlRepository) => r.repoFullName),
      );
      setAvailableRepos(repos.filter((r: any) => !connectedNames.has(r.full_name)));
    } catch (e) {
      console.error("Failed to list repos:", e);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleSelectRepo = async (repo: (typeof availableRepos)[number]) => {
    if (!installations) return;
    const activeInstall = installations.find((i: any) => i.status === "active");
    if (!activeInstall) return;
    setConnectingRepo(repo.full_name);
    try {
      await connectRepo({
        programId,
        installationId: activeInstall.installationId,
        repoFullName: repo.full_name,
        providerRepoId: String(repo.id),
        defaultBranch: repo.default_branch,
        language: repo.language ?? undefined,
        role: selectedRole,
        isMonorepo: false,
      });
      setShowConnectRepo(false);
      setAvailableRepos([]);
      setRepoSearchQuery("");
    } catch (e) {
      console.error("Failed to connect repo:", e);
    } finally {
      setConnectingRepo(null);
    }
  };
  const repositories = useQuery("sourceControl/repositories:listByProgram" as any, { programId });
  const disconnectRepo = useMutation("sourceControl/repositories:disconnectRepository" as any);
  const updateRepoRole = useMutation("sourceControl/repositories:updateRepositoryRole" as any);
  const updatePathFiltersMutation = useMutation(
    "sourceControl/repositories:updatePathFilters" as any,
  );
  const tagDeployWorkflows = useMutation("sourceControl/repositories:tagDeployWorkflows" as any);
  const setRepoLocalPath = useMutation("sourceControl/repositories:setLocalPath" as any);
  const [expandedRepoId, setExpandedRepoId] =
    useState<GenericId<"sourceControlRepositories"> | null>(null);
  const [disconnectingRepoId, setDisconnectingRepoId] =
    useState<GenericId<"sourceControlRepositories"> | null>(null);
  const [repoEditState, setRepoEditState] = useState<{
    role?: RepoRole;
    pathFilters?: string;
    deployWorkflows?: string;
    localPath?: string;
  }>({});
  const [localPathSaveState, setLocalPathSaveState] = useState<{
    repoId: GenericId<"sourceControlRepositories"> | null;
    status: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({
    repoId: null,
    status: "idle",
  });

  // Add member form state
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState<GenericId<"users"> | "">("");
  const [newMemberRole, setNewMemberRole] = useState<(typeof ROLES)[number]>("developer");
  const [newMemberWorkstreams, setNewMemberWorkstreams] = useState<GenericId<"workstreams">[]>([]);
  const [addingMember, setAddingMember] = useState(false);

  const handleExpandRepo = (repoId: GenericId<"sourceControlRepositories">) => {
    if (expandedRepoId === repoId) {
      setExpandedRepoId(null);
      setRepoEditState({});
      setLocalPathSaveState({ repoId: null, status: "idle" });
    } else {
      const repo = repositories?.find((r: SourceControlRepository) => r._id === repoId);
      setExpandedRepoId(repoId);
      setRepoEditState({
        role: repo?.role,
        pathFilters: repo?.pathFilters?.join(", ") ?? "",
        deployWorkflows: (repo as Record<string, unknown>)?.deployWorkflowNames
          ? ((repo as Record<string, unknown>).deployWorkflowNames as string[]).join(", ")
          : "",
        localPath: typeof repo?.localPath === "string" ? repo.localPath : "",
      });
      setLocalPathSaveState({ repoId: repoId, status: "idle" });
    }
  };

  const handleSaveRepoRole = async (repoId: GenericId<"sourceControlRepositories">) => {
    if (!repoEditState.role) return;
    await updateRepoRole({ repositoryId: repoId, role: repoEditState.role });
  };

  const handleSavePathFilters = async (repoId: GenericId<"sourceControlRepositories">) => {
    const filters = (repoEditState.pathFilters ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await updatePathFiltersMutation({
      repositoryId: repoId,
      pathFilters: filters,
    });
  };

  const handleSaveDeployWorkflows = async (repoId: GenericId<"sourceControlRepositories">) => {
    const workflows = (repoEditState.deployWorkflows ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await tagDeployWorkflows({
      repositoryId: repoId,
      deployWorkflowNames: workflows,
    });
  };

  const handleSaveLocalPath = async (repoId: GenericId<"sourceControlRepositories">) => {
    const trimmedLocalPath = (repoEditState.localPath ?? "").trim();
    if (trimmedLocalPath.length === 0) {
      setLocalPathSaveState({
        repoId,
        status: "error",
        message: "Select a folder path before saving.",
      });
      return;
    }

    setLocalPathSaveState({
      repoId,
      status: "saving",
      message: "Saving local path...",
    });

    try {
      await setRepoLocalPath({
        repositoryId: repoId,
        localPath: trimmedLocalPath,
      });

      setLocalPathSaveState({
        repoId,
        status: "saved",
        message: "Local repository path saved.",
      });
    } catch (error) {
      setLocalPathSaveState({
        repoId,
        status: "error",
        message: sanitizeErrorForUi(getErrorMessage(error)),
      });
    }
  };

  const handleBrowseLocalPath = async () => {
    try {
      const selectedPath = await pickDirectoryInDesktopRuntime();
      if (!selectedPath) {
        return;
      }

      setRepoEditState((s) => ({
        ...s,
        localPath: selectedPath,
      }));
      if (expandedRepoId) {
        setLocalPathSaveState({
          repoId: expandedRepoId,
          status: "idle",
        });
      }
    } catch (error) {
      console.error("Failed to pick a local repository path:", error);
    }
  };

  const handleDisconnectRepo = async (repoId: GenericId<"sourceControlRepositories">) => {
    await disconnectRepo({ repositoryId: repoId });
    setDisconnectingRepoId(null);
    if (expandedRepoId === repoId) {
      setExpandedRepoId(null);
      setRepoEditState({});
    }
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      await updateProgram({
        programId,
        name: name.trim(),
        clientName: clientName.trim(),
        description: description.trim() || undefined,
        startDate: startDate ? new Date(startDate).getTime() : undefined,
        targetEndDate: targetEndDate ? new Date(targetEndDate).getTime() : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAdvancePhase = async () => {
    const currentIdx = PHASES.indexOf(program.phase);
    if (currentIdx < PHASES.length - 1) {
      await updatePhase({ programId, phase: PHASES[currentIdx + 1] });
    }
  };

  const handleAddMember = async () => {
    if (!newMemberUserId || !orgId) return;
    setAddingMember(true);
    try {
      await addMember({
        orgId,
        programId,
        userId: newMemberUserId as GenericId<"users">,
        role: newMemberRole,
        workstreamIds: newMemberWorkstreams.length > 0 ? newMemberWorkstreams : undefined,
      });
      setShowAddMember(false);
      setNewMemberUserId("");
      setNewMemberRole("developer");
      setNewMemberWorkstreams([]);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRoleChange = async (
    memberId: GenericId<"teamMembers">,
    role: (typeof ROLES)[number],
  ) => {
    await updateMember({ memberId, role });
  };

  const handleRemoveMember = async (memberId: GenericId<"teamMembers">) => {
    await removeMember({ memberId });
  };

  const handleDeleteProgram = async () => {
    if (deleteConfirmText !== program.name) return;
    setDeleting(true);
    try {
      await removeProgram({ programId });
      router.push("/programs");
    } catch (_error) {
      setDeleting(false);
    }
  };

  const toggleWorkstream = (wsId: GenericId<"workstreams">) => {
    setNewMemberWorkstreams((prev) =>
      prev.includes(wsId) ? prev.filter((id) => id !== wsId) : [...prev, wsId],
    );
  };

  const currentPhaseIdx = PHASES.indexOf(program.phase);
  const atlassianStatus = atlassianConnection?.status ?? "disconnected";
  const atlassianStatusLabel =
    atlassianStatus === "setup_required"
      ? "Setup Required"
      : atlassianStatus.charAt(0).toUpperCase() + atlassianStatus.slice(1);
  const atlassianIsConnected = atlassianStatus === "connected";
  const atlassianSettingsDisabled = atlassianBackendUnavailable || !atlassianIsConnected;

  return (
    <div className="mx-auto container space-y-8">
      {/* Section 1: Program Details */}
      <section>
        <h1 className="mb-4 type-display-m text-text-heading">Program Settings</h1>

        <div className="card rounded-xl p-6">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">Program Details</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="settings-name" className="form-label">
                Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="settings-client" className="form-label">
                Client Name
              </label>
              <input
                id="settings-client"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="settings-desc" className="form-label">
                Description
              </label>
              <textarea
                id="settings-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="settings-start" className="form-label">
                  Start Date
                </label>
                <input
                  id="settings-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="settings-end" className="form-label">
                  Target End Date
                </label>
                <input
                  id="settings-end"
                  type="date"
                  value={targetEndDate}
                  onChange={(e) => setTargetEndDate(e.target.value)}
                  className="input"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSaveDetails}
                disabled={saving}
                className="btn-primary btn-sm disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Phase Progression */}
          <div className="mt-6 border-t border-border-default pt-6">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Phase Progression</h3>
            <div className="mb-4 flex items-center gap-2">
              {PHASES.map((phase, idx) => (
                <div key={phase} className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      idx <= currentPhaseIdx
                        ? PHASE_COLORS[phase]
                        : "bg-surface-raised text-text-muted"
                    }`}
                  >
                    {phase}
                  </span>
                  {idx < PHASES.length - 1 && (
                    <svg
                      className="h-4 w-4 text-text-muted"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
            {currentPhaseIdx < PHASES.length - 1 && (
              <button onClick={handleAdvancePhase} className="btn-secondary btn-sm">
                Advance to {PHASES[currentPhaseIdx + 1]}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Team Members */}
      <section>
        <div className="card rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Team Members</h2>
            <button onClick={() => setShowAddMember(!showAddMember)} className="btn-primary btn-sm">
              {showAddMember ? "Cancel" : "Add Member"}
            </button>
          </div>

          {/* Add Member Form */}
          {showAddMember && (
            <div className="mb-6 rounded-lg border border-border-default bg-surface-raised p-4">
              <div className="space-y-3">
                <div>
                  <label htmlFor="member-user" className="form-label">
                    User
                  </label>
                  <select
                    id="member-user"
                    value={newMemberUserId}
                    onChange={(e) => setNewMemberUserId(e.target.value as GenericId<"users">)}
                    className="select"
                  >
                    <option value="">Select a user...</option>
                    {orgUsers?.map(
                      (user: { _id: GenericId<"users">; name: string; email: string }) => (
                        <option key={user._id} value={user._id}>
                          {user.name} ({user.email})
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label htmlFor="member-role" className="form-label">
                    Role
                  </label>
                  <select
                    id="member-role"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as (typeof ROLES)[number])}
                    className="select"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                {workstreams && workstreams.length > 0 && (
                  <div>
                    <label className="form-label">Workstreams</label>
                    <div className="flex flex-wrap gap-2">
                      {workstreams.map(
                        (ws: { _id: GenericId<"workstreams">; shortCode: string }) => (
                          <button
                            key={ws._id}
                            type="button"
                            onClick={() => toggleWorkstream(ws._id)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                              newMemberWorkstreams.includes(ws._id)
                                ? "bg-status-warning-bg text-status-warning-fg border border-status-warning-border"
                                : "bg-surface-raised text-text-secondary hover:bg-interactive-hover"
                            }`}
                          >
                            {ws.shortCode}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={handleAddMember}
                    disabled={!newMemberUserId || addingMember}
                    className="btn-primary btn-sm disabled:opacity-50"
                  >
                    {addingMember ? "Adding..." : "Add Member"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Members List */}
          {teamMembers === undefined ? (
            <div className="flex h-32 items-center justify-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
            </div>
          ) : teamMembers.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-secondary">
              No team members yet. Add members to assign roles and workstreams.
            </p>
          ) : (
            <div className="space-y-3">
              {teamMembers.map(
                (member: {
                  _id: GenericId<"teamMembers">;
                  role: string;
                  workstreamIds?: GenericId<"workstreams">[];
                  user?: {
                    name: string;
                    email: string;
                    avatarUrl?: string;
                  } | null;
                }) => (
                  <div
                    key={member._id}
                    className="flex items-center justify-between rounded-lg border border-border-default p-3"
                  >
                    <div className="flex items-center gap-3">
                      {member.user?.avatarUrl ? (
                        <img src={member.user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-xs font-medium text-text-secondary">
                          {member.user?.name?.charAt(0) || "?"}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {member.user?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-text-muted">{member.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.workstreamIds && member.workstreamIds.length > 0 && (
                        <div className="flex gap-1">
                          {member.workstreamIds.map((wsId: GenericId<"workstreams">) => {
                            const ws = workstreams?.find(
                              (w: { _id: GenericId<"workstreams"> }) => w._id === wsId,
                            );
                            return ws ? (
                              <span
                                key={wsId}
                                className="rounded bg-surface-raised px-1.5 py-0.5 text-xs text-text-secondary"
                              >
                                {ws.shortCode}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member._id, e.target.value as (typeof ROLES)[number])
                        }
                        className="select text-xs"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[member.role]}`}
                      >
                        {member.role}
                      </span>
                      <button
                        onClick={() => handleRemoveMember(member._id)}
                        className="rounded p-1 text-text-muted hover:bg-status-error-bg hover:text-status-error-fg"
                        title="Remove member"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section 3: Billing */}
      {orgId && (
        <section ref={billingRef}>
          <BillingSettingsTab orgId={orgId} />
        </section>
      )}

      {/* Section 4: Source Control */}
      <section>
        <div className="card rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Source Control</h2>
            {hasActiveInstallation ? (
              <button onClick={handleConnectRepo} className="btn-primary btn-sm">
                Connect Repository
              </button>
            ) : githubAppSlug ? (
              <a
                href={`https://github.com/apps/${githubAppSlug}/installations/new?state=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "")}`}
                className="btn-primary btn-sm"
              >
                Install GitHub App
              </a>
            ) : (
              <button
                disabled
                title="Set NEXT_PUBLIC_GITHUB_APP_SLUG to enable GitHub App installation"
                className="btn-primary btn-sm opacity-60 cursor-not-allowed"
              >
                Connect Repository
              </button>
            )}
          </div>
          {!hasActiveInstallation && !githubAppSlug && (
            <p className="mb-4 text-xs text-text-secondary">
              Set{" "}
              <code className="rounded bg-surface-raised px-1 py-0.5 text-xs">
                NEXT_PUBLIC_GITHUB_APP_SLUG
              </code>{" "}
              in your environment to enable the GitHub App installation flow.
            </p>
          )}

          {/* Connect Repository Dialog */}
          {showConnectRepo && (
            <div className="mb-4 rounded-lg border border-status-warning-border bg-status-warning-bg p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Select a Repository</h3>
                <button
                  onClick={() => {
                    setShowConnectRepo(false);
                    setAvailableRepos([]);
                    setRepoSearchQuery("");
                  }}
                  className="rounded p-1 text-text-muted hover:bg-interactive-hover hover:text-text-primary"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mb-3">
                <label className="form-label">Repository Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as RepoRole)}
                  className="select"
                >
                  {REPO_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              {!loadingRepos && availableRepos.length > 0 && (
                <div className="mb-3">
                  <div className="relative">
                    <svg
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      value={repoSearchQuery}
                      onChange={(e) => setRepoSearchQuery(e.target.value)}
                      placeholder="Search repositories..."
                      className="input pl-9 pr-8"
                    />
                    {repoSearchQuery && (
                      <button
                        onClick={() => setRepoSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-muted hover:text-text-primary"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}
              {loadingRepos ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
                  <span className="ml-2 text-sm text-text-secondary">Loading repositories...</span>
                </div>
              ) : availableRepos.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-secondary">
                  No additional repositories available. All accessible repos are already connected.
                </p>
              ) : filteredRepos.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-secondary">
                  No repositories matching &ldquo;{repoSearchQuery}&rdquo;
                </p>
              ) : (
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {filteredRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between rounded-lg border border-border-default p-2.5 hover:border-border-accent hover:bg-interactive-hover"
                    >
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 text-text-muted"
                          viewBox="0 0 16 16"
                          fill="currentColor"
                        >
                          <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1h-8a1 1 0 00-1 1v6.708A2.486 2.486 0 014.5 9h8V1.5z" />
                        </svg>
                        <div>
                          <span className="text-sm font-medium text-text-primary">
                            {repo.full_name}
                          </span>
                          <div className="flex items-center gap-2">
                            {repo.language && (
                              <span className="text-xs text-text-muted">{repo.language}</span>
                            )}
                            {repo.private && (
                              <span className="text-xs text-text-muted">private</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelectRepo(repo)}
                        disabled={connectingRepo === repo.full_name}
                        className="btn-primary btn-sm disabled:opacity-50"
                      >
                        {connectingRepo === repo.full_name ? "Connecting..." : "Connect"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {repositories === undefined ? (
            <div className="flex h-32 items-center justify-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
            </div>
          ) : repositories.length === 0 ? (
            <div className="space-y-4">
              {/* Provision from template option */}
              {program.targetPlatform === "salesforce_b2b" &&
                hasActiveInstallation &&
                (() => {
                  // Prefer organization installations over user installations for repo creation
                  const activeInstalls = installations?.filter((i: any) => i.status === "active");
                  const orgInstall = activeInstalls.find(
                    (i: any) => i.accountType === "organization",
                  );
                  const selectedInstall = orgInstall || activeInstalls[0];
                  return (
                    <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-4">
                      <ProvisionFromTemplate
                        programId={programId}
                        clientName={program.clientName ?? program.name}
                        installationId={selectedInstall.installationId}
                        owner={selectedInstall.accountLogin}
                        templateRepoFullName="Architect-And-Bot/sf-b2b-commerce-template"
                      />
                    </div>
                  );
                })()}
              {/* Or connect existing */}
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-default py-12">
                <svg
                  className="mb-3 h-10 w-10 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 3v2.25M18 3v2.25M6 21v-2.25M18 21v-2.25M3 6h2.25M3 18h2.25M21 6h-2.25M21 18h-2.25M9.75 9.75h.008v.008H9.75V9.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
                <p className="text-sm font-medium text-text-secondary">
                  Or connect an existing repository
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Connect your GitHub repositories to track implementation progress.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {repositories.map((repo: SourceControlRepository) => (
                <Fragment key={repo._id}>
                  {/* Repository Row */}
                  <div
                    className={`rounded-lg border p-3 transition-colors ${
                      expandedRepoId === repo._id
                        ? "border-border-accent bg-interactive-subtle"
                        : "border-border-default hover:border-border-strong"
                    }`}
                  >
                    <div
                      className="flex cursor-pointer items-center justify-between"
                      onClick={() => handleExpandRepo(repo._id)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Sync status dot */}
                        <span
                          className={`h-2 w-2 rounded-full ${repo.syncStatus ? SYNC_STATUS_COLORS[repo.syncStatus] : "bg-text-muted"}`}
                          title={`Sync: ${repo.syncStatus}`}
                        />
                        {/* GitHub icon + repo name */}
                        <div className="flex items-center gap-1.5">
                          <svg
                            className="h-4 w-4 text-text-muted"
                            viewBox="0 0 16 16"
                            fill="currentColor"
                          >
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                          </svg>
                          <span className="text-sm font-medium text-text-primary">
                            {repo.repoFullName}
                          </span>
                        </div>
                        {/* Role badge */}
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${REPO_ROLE_COLORS[repo.role]}`}
                        >
                          {repo.role.replace("_", " ")}
                        </span>
                        {/* Monorepo indicator */}
                        {repo.isMonorepo && <span className="badge">monorepo</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Last webhook timestamp */}
                        {repo.lastWebhookAt && (
                          <span className="text-xs text-text-muted">
                            Last event: {formatRelativeTime(repo.lastWebhookAt)}
                          </span>
                        )}
                        {/* Expand chevron */}
                        <svg
                          className={`h-4 w-4 text-text-muted transition-transform ${expandedRepoId === repo._id ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {expandedRepoId === repo._id && (
                      <div className="mt-4 space-y-4 border-t border-border-default pt-4">
                        {/* Role Selector */}
                        <div>
                          <label className="form-label">Repository Role</label>
                          <div className="flex items-center gap-2">
                            <select
                              value={repoEditState.role ?? repo.role}
                              onChange={(e) =>
                                setRepoEditState((s) => ({
                                  ...s,
                                  role: e.target.value as RepoRole,
                                }))
                              }
                              className="select"
                            >
                              {REPO_ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {role.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleSaveRepoRole(repo._id)}
                              className="btn-primary btn-sm shrink-0"
                            >
                              Save
                            </button>
                          </div>
                        </div>

                        {/* Path Filters (monorepo) */}
                        <div>
                          <label className="form-label">
                            Path Filters{" "}
                            <span className="font-normal text-text-muted">
                              (comma-separated globs for monorepo)
                            </span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={repoEditState.pathFilters ?? ""}
                              onChange={(e) =>
                                setRepoEditState((s) => ({
                                  ...s,
                                  pathFilters: e.target.value,
                                }))
                              }
                              placeholder="packages/storefront/**, apps/admin/**"
                              className="input"
                            />
                            <button
                              onClick={() => handleSavePathFilters(repo._id)}
                              className="btn-primary btn-sm shrink-0"
                            >
                              Save
                            </button>
                          </div>
                        </div>

                        {/* Deploy Workflows */}
                        <div>
                          <label className="form-label">
                            Deploy Workflows{" "}
                            <span className="font-normal text-text-muted">
                              (comma-separated workflow names)
                            </span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={repoEditState.deployWorkflows ?? ""}
                              onChange={(e) =>
                                setRepoEditState((s) => ({
                                  ...s,
                                  deployWorkflows: e.target.value,
                                }))
                              }
                              placeholder="deploy-production, deploy-staging"
                              className="input"
                            />
                            <button
                              onClick={() => handleSaveDeployWorkflows(repo._id)}
                              className="btn-primary btn-sm shrink-0"
                            >
                              Save
                            </button>
                          </div>
                        </div>

                        {isDesktopRuntime ? (
                          <div>
                            <label className="form-label">
                              Local Repository Path{" "}
                              <span className="font-normal text-text-muted">
                                (desktop local runtime)
                              </span>
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={repoEditState.localPath ?? ""}
                                onChange={(e) =>
                                  setRepoEditState((s) => ({
                                    ...s,
                                    localPath: e.target.value,
                                  }))
                                }
                                placeholder="/Users/you/projects/repository"
                                className="input"
                              />
                              <button
                                onClick={handleBrowseLocalPath}
                                className="btn-secondary btn-sm shrink-0"
                              >
                                Browse
                              </button>
                              <button
                                onClick={() => handleSaveLocalPath(repo._id)}
                                disabled={
                                  localPathSaveState.repoId === repo._id &&
                                  localPathSaveState.status === "saving"
                                }
                                className="btn-primary btn-sm shrink-0"
                              >
                                {localPathSaveState.repoId === repo._id &&
                                localPathSaveState.status === "saving"
                                  ? "Saving..."
                                  : "Save"}
                              </button>
                            </div>
                            {localPathSaveState.repoId === repo._id &&
                            localPathSaveState.status !== "idle" ? (
                              <p
                                className={`mt-1 text-xs ${
                                  localPathSaveState.status === "saved"
                                    ? "text-status-success-fg"
                                    : localPathSaveState.status === "error"
                                      ? "text-status-error-fg"
                                      : "text-text-secondary"
                                }`}
                              >
                                {localPathSaveState.message}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {/* Disconnect Button */}
                        <div className="flex justify-end border-t border-border-default pt-3">
                          {disconnectingRepoId === repo._id ? (
                            <div className="space-y-2">
                              <p className="text-sm text-text-secondary">
                                Disconnect{" "}
                                <strong className="text-status-error-fg">
                                  {repo.repoFullName}
                                </strong>
                                ? Historical data will be preserved but new events will not be
                                tracked.
                              </p>
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleDisconnectRepo(repo._id)}
                                  className="rounded-lg bg-status-error-fg px-3 py-1.5 text-sm font-medium text-text-on-brand hover:opacity-90"
                                >
                                  Confirm Disconnect
                                </button>
                                <button
                                  onClick={() => setDisconnectingRepoId(null)}
                                  className="btn-secondary btn-sm"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDisconnectingRepoId(repo._id)}
                              className="text-sm font-medium text-status-error-fg hover:text-status-error-fg"
                            >
                              Disconnect
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Section 5: Atlassian */}
      <section>
        <div className="card rounded-xl p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-text-primary">
                Atlassian (Jira + Confluence)
              </h2>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${ATLASSIAN_STATUS_COLORS[atlassianStatus]}`}
              >
                {atlassianStatusLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {atlassianIsConnected ? (
                confirmDisconnectAtlassian ? (
                  <>
                    <button
                      onClick={handleDisconnectAtlassian}
                      disabled={disconnectingAtlassian}
                      className="rounded-lg bg-status-error-fg px-3 py-1.5 text-sm font-medium text-text-on-brand hover:opacity-90 disabled:opacity-50"
                    >
                      {disconnectingAtlassian ? "Disconnecting..." : "Confirm Disconnect"}
                    </button>
                    <button
                      onClick={() => setConfirmDisconnectAtlassian(false)}
                      className="btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDisconnectAtlassian(true)}
                    className="rounded-lg border border-status-error-border px-3 py-1.5 text-sm font-medium text-status-error-fg hover:bg-status-error-bg"
                  >
                    Disconnect
                  </button>
                )
              ) : (
                <button
                  onClick={handleStartAtlassianOauth}
                  disabled={startingAtlassianOauth || completingAtlassianOauth}
                  className="btn-primary btn-sm disabled:opacity-50"
                >
                  {startingAtlassianOauth ? "Redirecting..." : "Connect Atlassian"}
                </button>
              )}
            </div>
          </div>

          {atlassianConnection?.atlassianSiteUrl && (
            <p className="mb-4 text-xs text-text-secondary">
              Connected Site:{" "}
              <a
                href={atlassianConnection.atlassianSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent-default underline hover:text-accent-strong"
              >
                {atlassianConnection.atlassianSiteUrl}
              </a>
              {atlassianConnection.lastSyncAt && (
                <span> · Last sync {formatRelativeTime(atlassianConnection.lastSyncAt)}</span>
              )}
            </p>
          )}

          {atlassianLoading || completingAtlassianOauth ? (
            <div className="flex h-20 items-center justify-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
            </div>
          ) : (
            <div className="space-y-4">
              {atlassianNotice && <div className="status-banner-success">{atlassianNotice}</div>}
              {atlassianError && <div className="status-banner-error">{atlassianError}</div>}

              <div className="space-y-4">
                {/* Jira Project dropdown */}
                <div>
                  <label htmlFor="jira-project" className="form-label">
                    Jira Project
                  </label>
                  {manualJiraProject ? (
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          value={jiraProjectId}
                          onChange={(e) => setJiraProjectId(e.target.value)}
                          disabled={atlassianSettingsDisabled || savingAtlassianBindings}
                          placeholder="Project ID (e.g. 10012)"
                          className="input disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <input
                          type="text"
                          value={jiraProjectKey}
                          onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
                          disabled={atlassianSettingsDisabled || savingAtlassianBindings}
                          placeholder="Project Key (e.g. BM)"
                          className="input disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setManualJiraProject(false)}
                        className="text-xs font-medium text-accent-default hover:text-accent-strong"
                      >
                        Back to list
                      </button>
                    </div>
                  ) : (
                    <select
                      id="jira-project"
                      value={jiraProjectId ? `${jiraProjectId}::${jiraProjectKey}` : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__manual__") {
                          setManualJiraProject(true);
                          return;
                        }
                        if (!val) {
                          setJiraProjectId("");
                          setJiraProjectKey("");
                          return;
                        }
                        const [id, key] = val.split("::");
                        setJiraProjectId(id);
                        setJiraProjectKey(key);
                      }}
                      disabled={
                        atlassianSettingsDisabled || savingAtlassianBindings || loadingProjects
                      }
                      className="select disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="" disabled>
                        {loadingProjects ? "Loading projects..." : "Select a Jira project..."}
                      </option>
                      {jiraProjects.map((p) => (
                        <option key={p.id} value={`${p.id}::${p.key}`}>
                          {p.name} ({p.key})
                        </option>
                      ))}
                      <option value="__manual__">Enter manually...</option>
                    </select>
                  )}
                </div>

                {/* Confluence Space dropdown */}
                <div>
                  <label htmlFor="confluence-space" className="form-label">
                    Confluence Space
                  </label>
                  {manualConfluenceSpace ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={confluenceSpaceKey}
                        onChange={(e) => setConfluenceSpaceKey(e.target.value.toUpperCase())}
                        disabled={atlassianSettingsDisabled || savingAtlassianBindings}
                        placeholder="Space Key (e.g. BM)"
                        className="input disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setManualConfluenceSpace(false)}
                        className="text-xs font-medium text-accent-default hover:text-accent-strong"
                      >
                        Back to list
                      </button>
                    </div>
                  ) : (
                    <select
                      id="confluence-space"
                      value={confluenceSpaceKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__manual__") {
                          setManualConfluenceSpace(true);
                          return;
                        }
                        setConfluenceSpaceKey(val);
                        // Resolve the space ID for the v2 pages API
                        const selectedSpace = confluenceSpaces.find((s) => s.key === val);
                        setConfluenceSpaceId(selectedSpace?.id ?? "");
                        // Reset parent page when space changes
                        setConfluenceParentPageId("");
                        setPagesFetchFailed(false);
                        setManualConfluencePage(false);
                      }}
                      disabled={
                        atlassianSettingsDisabled || savingAtlassianBindings || loadingSpaces
                      }
                      className="select disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="" disabled>
                        {loadingSpaces
                          ? "Loading spaces..."
                          : confluenceSpaces.length === 0 && !loadingSpaces
                            ? "No spaces found (try manual entry)"
                            : "Select a Confluence space..."}
                      </option>
                      {confluenceSpaces.map((s) => (
                        <option key={s.id} value={s.key}>
                          {s.name} ({s.key})
                        </option>
                      ))}
                      <option value="__manual__">Enter manually...</option>
                    </select>
                  )}
                </div>

                {/* Confluence Parent Page dropdown */}
                <div>
                  <label htmlFor="confluence-parent-page" className="form-label">
                    Confluence Parent Page
                  </label>
                  {manualConfluencePage ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={confluenceParentPageId}
                        onChange={(e) => setConfluenceParentPageId(e.target.value)}
                        disabled={atlassianSettingsDisabled || savingAtlassianBindings}
                        placeholder="Page ID (e.g. 12345678)"
                        className="input disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => setManualConfluencePage(false)}
                        className="text-xs font-medium text-accent-default hover:text-accent-strong"
                      >
                        Back to list
                      </button>
                    </div>
                  ) : (
                    <select
                      id="confluence-parent-page"
                      value={confluenceParentPageId}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__manual__") {
                          setManualConfluencePage(true);
                          return;
                        }
                        setConfluenceParentPageId(val);
                      }}
                      disabled={
                        atlassianSettingsDisabled ||
                        savingAtlassianBindings ||
                        loadingPages ||
                        !confluenceSpaceKey
                      }
                      className="select disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="" disabled>
                        {!confluenceSpaceKey
                          ? "Select a space first..."
                          : loadingPages
                            ? "Loading pages..."
                            : confluencePages.length === 0 && !loadingPages && confluenceSpaceId
                              ? "No pages found (try manual entry)"
                              : "Select a parent page..."}
                      </option>
                      {confluencePages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                      <option value="__manual__">Enter manually...</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveAtlassianBindings}
                  disabled={atlassianSettingsDisabled || savingAtlassianBindings}
                  className="btn-secondary btn-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingAtlassianBindings ? "Saving..." : "Save Atlassian Bindings"}
                </button>
              </div>

              <div className="rounded-lg border border-border-default p-4">
                <h3 className="mb-3 text-sm font-semibold text-text-primary">
                  Jira + Confluence Sync Behavior
                </h3>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="jira-sync-mode" className="form-label">
                      Jira Sync Mode
                    </label>
                    <select
                      id="jira-sync-mode"
                      value={jiraSyncMode}
                      onChange={(e) => setJiraSyncMode(e.target.value as JiraSyncMode)}
                      disabled={atlassianBackendUnavailable || savingAtlassianSettings}
                      className="select disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="auto">Auto</option>
                      <option value="auto_status_only">Auto Status Only</option>
                      <option value="approval_required">Approval Required</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={confluenceAutoIngest}
                      onChange={(e) => setConfluenceAutoIngest(e.target.checked)}
                      disabled={atlassianBackendUnavailable || savingAtlassianSettings}
                      className="h-4 w-4 rounded border-border-default text-accent-default focus:ring-accent-default disabled:cursor-not-allowed"
                    />
                    Enable Confluence ambient ingestion
                  </label>
                  <div>
                    <label htmlFor="confluence-ingest-filter" className="form-label">
                      Confluence Ingest Filter (label or ancestor key)
                    </label>
                    <input
                      id="confluence-ingest-filter"
                      type="text"
                      value={confluenceIngestFilter}
                      onChange={(e) => setConfluenceIngestFilter(e.target.value)}
                      disabled={atlassianBackendUnavailable || savingAtlassianSettings}
                      placeholder="migration,technical-spec OR TECHDOCS"
                      className="input disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveAtlassianSettings}
                    disabled={atlassianBackendUnavailable || savingAtlassianSettings}
                    className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingAtlassianSettings ? "Saving..." : "Save Sync Settings"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 6: Google Drive */}
      <section>
        <div className="card rounded-xl p-6">
          {completingGdriveOauth && (
            <div className="mb-4 status-banner-info">Completing Google Drive authorization...</div>
          )}
          {gdriveNotice && !completingGdriveOauth && (
            <div className="mb-4 status-banner-success">{gdriveNotice}</div>
          )}
          {gdriveError && <div className="mb-4 status-banner-error">{gdriveError}</div>}
          <GoogleDriveConnectionSettings />
        </div>
      </section>

      {/* Section 7: AI Agent Configuration */}
      <section>
        <div className="card rounded-xl p-6">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">AI Agent Configuration</h2>

          {authLoading ? (
            <div className="flex h-20 items-center justify-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
            </div>
          ) : !authStatus ? (
            <p className="text-sm text-text-secondary">
              Unable to connect to the agent service. Make sure it is running.
            </p>
          ) : authStatus.source === "none" ? (
            /* Not configured */
            <div>
              <div className="mb-4 status-banner-warning">
                <p className="text-sm font-medium text-status-warning-fg">No API key configured</p>
                <p className="mt-1 text-xs text-status-warning-fg">
                  An Anthropic API key is required for AI agent features. Get one at{" "}
                  <a
                    href="https://console.anthropic.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    console.anthropic.com
                  </a>
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label htmlFor="api-key-input" className="form-label">
                    API Key
                  </label>
                  <input
                    id="api-key-input"
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="sk-ant-..."
                    className="input"
                  />
                </div>
                {authError && <p className="text-xs text-status-error-fg">{authError}</p>}
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!apiKeyInput || savingKey}
                    className="btn-primary btn-sm disabled:opacity-50"
                  >
                    {savingKey ? "Saving..." : "Save Key"}
                  </button>
                </div>
              </div>
            </div>
          ) : authStatus.source === "claude_code_oauth" ? (
            /* Claude Code OAuth */
            <div className="flex items-center gap-3">
              <span className="badge badge-success">Connected</span>
              <span className="text-sm text-text-secondary">
                Using Claude Code authentication ({authStatus.claudeCodeEmail})
              </span>
            </div>
          ) : (
            /* Configured via manual config or env var */
            <div>
              <div className="flex items-center gap-3">
                <span className="badge badge-success">Configured</span>
                <span className="text-sm text-text-secondary">{authStatus.apiKeyPrefix}</span>
                <span className="text-xs text-text-muted">
                  ({authStatus.source === "manual_config" ? "Manual" : "Environment variable"})
                </span>
              </div>
              {authStatus.source === "manual_config" && (
                <div className="mt-4 flex gap-2">
                  <button onClick={handleClearApiKey} className="btn-secondary btn-sm">
                    Clear Key
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Section 8: Agent Team */}
      <section>
        <div className="card rounded-xl p-6">
          <AgentSettingsTab />
        </div>
      </section>

      {/* Section 9: Danger Zone */}
      <section>
        <div className="card rounded-xl border-status-error-border p-6">
          <h2 className="mb-2 text-lg font-semibold text-status-error-fg">Danger Zone</h2>
          <p className="mb-4 text-sm text-text-secondary">
            Permanently delete this program and all associated data. This action cannot be undone.
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg border border-status-error-border px-4 py-2 text-sm font-medium text-status-error-fg transition-colors hover:bg-status-error-bg"
            >
              Delete Program
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                Type <strong className="text-status-error-fg">{program.name}</strong> to confirm
                deletion:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type program name to confirm"
                className="input border-status-error-border focus:border-status-error-fg"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteProgram}
                  disabled={deleteConfirmText !== program.name || deleting}
                  className="rounded-lg bg-status-error-fg px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Permanently Delete"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                  className="btn-secondary btn-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
