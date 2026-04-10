"use client";

import { useOrganization } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type EditorType = "monaco" | "codemirror" | "none";
type ProviderType = "anthropic" | "bedrock" | "vertex" | "azure";
type McpTransport = "stdio" | "sse" | "streamable-http";
type McpLevel = "global" | "project" | "task";

type HookEventType =
  | "preToolUse"
  | "postToolUse"
  | "stop"
  | "notification"
  | "error"
  | "gitOperation"
  | "fileChange"
  | "testResult";

const HOOK_EVENT_TYPES: { key: HookEventType; label: string }[] = [
  { key: "preToolUse", label: "Pre Tool Use" },
  { key: "postToolUse", label: "Post Tool Use" },
  { key: "stop", label: "Stop" },
  { key: "notification", label: "Notification" },
  { key: "error", label: "Error" },
  { key: "gitOperation", label: "Git Operation" },
  { key: "fileChange", label: "File Change" },
  { key: "testResult", label: "Test Result" },
];

interface HookEntry {
  matcher: string;
  command: string;
}

type HookBuckets = Record<HookEventType, HookEntry[]>;

interface McpServer {
  name: string;
  package: string;
  config: Record<string, unknown>;
  level: McpLevel;
}

interface Dotfile {
  path: string;
  content: string;
}

interface DevToolConfig {
  tool: string;
  config: string;
}

interface SetupScript {
  name: string;
  script: string;
  runOrder: number;
}

interface SandboxConfigRecord {
  claudeSettings?: unknown;
  hooks?: HookBuckets;
  mcpServers?: McpServer[];
  shellAliases?: Array<{ name?: string; command?: string }>;
  dotfiles?: Dotfile[];
  devToolConfigs?: DevToolConfig[];
  setupScripts?: SetupScript[];
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function parseJsonInput(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed);
}

function validateJson(raw: string): { valid: boolean; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "{}") return { valid: true };
  try {
    JSON.parse(trimmed);
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err?.message ?? "Invalid JSON" };
  }
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function parseShellAliasLines(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...rest] = line.split("=");
      const command = rest.join("=").trim();
      const aliasName = name?.trim();
      if (!aliasName || !command) return null;
      return { name: aliasName, command };
    })
    .filter((entry): entry is { name: string; command: string } => entry !== null);
}

function defaultHooks(): HookBuckets {
  return {
    preToolUse: [],
    postToolUse: [],
    stop: [],
    notification: [],
    error: [],
    gitOperation: [],
    fileChange: [],
    testResult: [],
  };
}

// ---------------------------------------------------------------------------
// Shared UI atoms
// ---------------------------------------------------------------------------

const btnDanger =
  "rounded-md border border-status-error-border px-2 py-1 text-xs text-status-error-fg hover:bg-status-error-bg";
const listItemClass =
  "flex items-center justify-between rounded-lg border border-border-default bg-surface-raised px-2.5 py-2";

function StatusMessage({ message, error }: { message: string | null; error: string | null }) {
  return (
    <>
      {message ? <p className="text-xs text-status-success-fg">{message}</p> : null}
      {error ? <p className="text-xs text-status-error-fg">{error}</p> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SandboxSettingsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  // ---- Queries ----
  const sandboxConfig = useQuery(
    "sandbox/configs:getByOrg" as any,
    orgId ? { orgId: orgId as any } : "skip",
  ) as SandboxConfigRecord | null | undefined;

  const envVars = useQuery(
    "sandbox/envVault:listByOrg" as any,
    orgId ? { orgId: orgId as any } : "skip",
  ) as Array<{ _id: string; name: string; description?: string }> | undefined;

  const orgPresets = useQuery(
    "sandbox/presets:listForOrg" as any,
    orgId ? { orgId: orgId as any, includeOrgOnly: true } : "skip",
  ) as
    | Array<{
        _id: string;
        name: string;
        editorType: EditorType;
        ttlMinutes: number;
        isDefault: boolean;
      }>
    | undefined;

  const aiProviders = useQuery(
    "sandbox/aiProviders:listMine" as any,
    orgId ? { orgId: orgId as any } : "skip",
  ) as
    | Array<{
        _id: string;
        provider: ProviderType;
        isDefault: boolean;
        updatedAt: number;
      }>
    | undefined;

  // ---- Mutations / Actions ----
  const upsertConfig = useMutation("sandbox/configs:upsert" as any);
  const upsertEnvVar = useAction("sandbox/secureSettings:upsertEnvVar" as any);
  const removeEnvVar = useMutation("sandbox/envVault:remove" as any);
  const upsertPreset = useMutation("sandbox/presets:upsert" as any);
  const removePreset = useMutation("sandbox/presets:remove" as any);
  const upsertAiProvider = useAction("sandbox/secureSettings:upsertAiProvider" as any);
  const setDefaultProvider = useMutation("sandbox/aiProviders:setDefault" as any);
  const removeProvider = useMutation("sandbox/aiProviders:remove" as any);

  // ---- Claude Settings state ----
  const [claudeSettingsJson, setClaudeSettingsJson] = useState("{}");
  const [jsonValidation, setJsonValidation] = useState<{ valid: boolean; error?: string }>({
    valid: true,
  });

  // ---- Hooks state ----
  const [hooks, setHooks] = useState<HookBuckets>(defaultHooks);
  const [activeHookTab, setActiveHookTab] = useState<HookEventType>("preToolUse");
  const [newHookMatcher, setNewHookMatcher] = useState("");
  const [newHookCommand, setNewHookCommand] = useState("");

  // ---- MCP Servers state ----
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [newMcpName, setNewMcpName] = useState("");
  const [newMcpPackage, setNewMcpPackage] = useState("");
  const [newMcpConfig, setNewMcpConfig] = useState("{}");
  const [newMcpLevel, setNewMcpLevel] = useState<McpLevel>("global");

  // ---- Shell Aliases state ----
  const [shellAliasesText, setShellAliasesText] = useState("");

  // ---- Workspace Customization state ----
  const [dotfiles, setDotfiles] = useState<Dotfile[]>([]);
  const [newDotfilePath, setNewDotfilePath] = useState("");
  const [newDotfileContent, setNewDotfileContent] = useState("");
  const [devToolConfigs, setDevToolConfigs] = useState<DevToolConfig[]>([]);
  const [newDevTool, setNewDevTool] = useState("");
  const [newDevToolConfig, setNewDevToolConfig] = useState("");
  const [setupScripts, setSetupScripts] = useState<SetupScript[]>([]);
  const [newScriptName, setNewScriptName] = useState("");
  const [newScriptBody, setNewScriptBody] = useState("");

  // ---- Config save state ----
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // ---- Env Vault state ----
  const [envName, setEnvName] = useState("");
  const [envValue, setEnvValue] = useState("");
  const [envDescription, setEnvDescription] = useState("");
  const [envMessage, setEnvMessage] = useState<string | null>(null);
  const [envError, setEnvError] = useState<string | null>(null);
  const [savingEnv, setSavingEnv] = useState(false);
  const [revealedEnvIds, setRevealedEnvIds] = useState<Set<string>>(new Set());

  // ---- Presets state ----
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [presetEditorType, setPresetEditorType] = useState<EditorType>("monaco");
  const [presetTtl, setPresetTtl] = useState(15);
  const [presetDefault, setPresetDefault] = useState(false);
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [savingPreset, setSavingPreset] = useState(false);

  // ---- AI Providers state ----
  const [providerType, setProviderType] = useState<ProviderType>("anthropic");
  const [providerCredentials, setProviderCredentials] = useState("");
  const [providerDefault, setProviderDefault] = useState(false);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);

  // ---- Active settings tab ----
  const [activeTab, setActiveTab] = useState<
    "config" | "hooks" | "mcp" | "workspace" | "vault" | "presets" | "providers"
  >("config");

  // ---- Hydrate from backend ----
  useEffect(() => {
    if (sandboxConfig === undefined) return;
    setClaudeSettingsJson(formatJson(sandboxConfig?.claudeSettings ?? {}));
    setHooks({ ...defaultHooks(), ...(sandboxConfig?.hooks ?? {}) });
    setMcpServers(sandboxConfig?.mcpServers ?? []);
    setShellAliasesText(
      (sandboxConfig?.shellAliases ?? [])
        .map((alias) => {
          const name = alias.name?.trim();
          const command = alias.command?.trim();
          return name && command ? `${name}=${command}` : "";
        })
        .filter(Boolean)
        .join("\n"),
    );
    setDotfiles(sandboxConfig?.dotfiles ?? []);
    setDevToolConfigs(sandboxConfig?.devToolConfigs ?? []);
    setSetupScripts(sandboxConfig?.setupScripts ?? []);
  }, [sandboxConfig]);

  // JSON validation on change
  useEffect(() => {
    setJsonValidation(validateJson(claudeSettingsJson));
  }, [claudeSettingsJson]);

  const isLoading =
    orgId &&
    (sandboxConfig === undefined ||
      envVars === undefined ||
      orgPresets === undefined ||
      aiProviders === undefined);

  const sortedProviders = useMemo(() => {
    return [...(aiProviders ?? [])].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [aiProviders]);

  // ---- Handlers ----

  async function handleSaveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;

    setSavingConfig(true);
    setConfigMessage(null);
    setConfigError(null);
    try {
      const claudeSettings = parseJsonInput(claudeSettingsJson);
      const shellAliases = parseShellAliasLines(shellAliasesText);

      await upsertConfig({
        orgId,
        claudeSettings,
        hooks,
        mcpServers,
        shellAliases,
        dotfiles,
        devToolConfigs,
        setupScripts,
      });
      setConfigMessage("Sandbox organization config saved.");
    } catch (error: any) {
      setConfigError(error?.message ?? "Failed to save sandbox configuration.");
    } finally {
      setSavingConfig(false);
    }
  }

  function handleAddHook() {
    if (!newHookMatcher.trim() || !newHookCommand.trim()) return;
    setHooks((prev) => ({
      ...prev,
      [activeHookTab]: [
        ...prev[activeHookTab],
        { matcher: newHookMatcher.trim(), command: newHookCommand.trim() },
      ],
    }));
    setNewHookMatcher("");
    setNewHookCommand("");
  }

  function handleRemoveHook(eventType: HookEventType, index: number) {
    setHooks((prev) => ({
      ...prev,
      [eventType]: prev[eventType].filter((_, i) => i !== index),
    }));
  }

  function handleAddMcpServer() {
    if (!newMcpName.trim() || !newMcpPackage.trim()) return;
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(newMcpConfig);
    } catch {
      // keep empty
    }
    setMcpServers((prev) => [
      ...prev,
      { name: newMcpName.trim(), package: newMcpPackage.trim(), config, level: newMcpLevel },
    ]);
    setNewMcpName("");
    setNewMcpPackage("");
    setNewMcpConfig("{}");
    setNewMcpLevel("global");
  }

  function handleRemoveMcpServer(index: number) {
    setMcpServers((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddDotfile() {
    if (!newDotfilePath.trim() || !newDotfileContent.trim()) return;
    setDotfiles((prev) => [...prev, { path: newDotfilePath.trim(), content: newDotfileContent }]);
    setNewDotfilePath("");
    setNewDotfileContent("");
  }

  function handleRemoveDotfile(index: number) {
    setDotfiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddDevTool() {
    if (!newDevTool.trim() || !newDevToolConfig.trim()) return;
    setDevToolConfigs((prev) => [
      ...prev,
      { tool: newDevTool.trim(), config: newDevToolConfig.trim() },
    ]);
    setNewDevTool("");
    setNewDevToolConfig("");
  }

  function handleRemoveDevTool(index: number) {
    setDevToolConfigs((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddSetupScript() {
    if (!newScriptName.trim() || !newScriptBody.trim()) return;
    setSetupScripts((prev) => [
      ...prev,
      { name: newScriptName.trim(), script: newScriptBody, runOrder: prev.length + 1 },
    ]);
    setNewScriptName("");
    setNewScriptBody("");
  }

  function handleRemoveSetupScript(index: number) {
    setSetupScripts((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, runOrder: i + 1 })),
    );
  }

  async function handleSaveEnvVar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;

    setSavingEnv(true);
    setEnvMessage(null);
    setEnvError(null);
    try {
      await upsertEnvVar({
        orgId,
        name: envName.trim(),
        value: envValue,
        description: envDescription.trim() || undefined,
      });
      setEnvName("");
      setEnvValue("");
      setEnvDescription("");
      setEnvMessage("Environment variable saved.");
    } catch (error: any) {
      setEnvError(error?.message ?? "Failed to save environment variable.");
    } finally {
      setSavingEnv(false);
    }
  }

  function toggleRevealEnv(id: string) {
    setRevealedEnvIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const resetPresetForm = useCallback(() => {
    setEditingPresetId(null);
    setPresetName("");
    setPresetEditorType("monaco");
    setPresetTtl(15);
    setPresetDefault(false);
  }, []);

  function handleEditPreset(preset: {
    _id: string;
    name: string;
    editorType: EditorType;
    ttlMinutes: number;
    isDefault: boolean;
  }) {
    setEditingPresetId(preset._id);
    setPresetName(preset.name);
    setPresetEditorType(preset.editorType);
    setPresetTtl(preset.ttlMinutes);
    setPresetDefault(preset.isDefault);
  }

  function handleClonePreset(preset: { name: string; editorType: EditorType; ttlMinutes: number }) {
    setEditingPresetId(null);
    setPresetName(`${preset.name} (copy)`);
    setPresetEditorType(preset.editorType);
    setPresetTtl(preset.ttlMinutes);
    setPresetDefault(false);
  }

  async function handleSavePreset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;

    setSavingPreset(true);
    setPresetMessage(null);
    setPresetError(null);
    try {
      await upsertPreset({
        ...(editingPresetId ? { presetId: editingPresetId } : {}),
        orgId,
        name: presetName.trim(),
        editorType: presetEditorType,
        ttlMinutes: Math.min(60, Math.max(5, Math.round(presetTtl))),
        envVarOverrides: [],
        mcpServerOverrides: [],
        isDefault: presetDefault,
        scope: "org",
      });
      resetPresetForm();
      setPresetMessage(editingPresetId ? "Preset updated." : "Org preset saved.");
    } catch (error: any) {
      setPresetError(error?.message ?? "Failed to save preset.");
    } finally {
      setSavingPreset(false);
    }
  }

  async function handleSaveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!orgId) return;

    setSavingProvider(true);
    setProviderMessage(null);
    setProviderError(null);
    try {
      await upsertAiProvider({
        orgId,
        provider: providerType,
        credentials: providerCredentials,
        isDefault: providerDefault,
      });
      setProviderCredentials("");
      setProviderDefault(false);
      setProviderMessage("AI provider credentials saved.");
    } catch (error: any) {
      setProviderError(error?.message ?? "Failed to save provider credentials.");
    } finally {
      setSavingProvider(false);
    }
  }

  // ---- Guard states ----

  if (!orgId) {
    return (
      <div className="card card-body type-body-s text-text-secondary">
        Select an organization to configure sandbox settings.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card card-body type-body-s text-text-secondary">
        Loading sandbox settings...
      </div>
    );
  }

  // ---- Tab navigation ----
  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "config", label: "Claude Settings" },
    { key: "hooks", label: "Hooks" },
    { key: "mcp", label: "MCP Servers" },
    { key: "workspace", label: "Workspace" },
    { key: "vault", label: "Env Vault" },
    { key: "presets", label: "Presets" },
    { key: "providers", label: "AI Providers" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="type-display-m text-text-heading">Sandbox Settings</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Manage org defaults, hooks, MCP servers, secrets, presets, and AI provider credentials.
          </p>
        </div>
        <Link href="/sandboxes" className="btn-secondary btn-sm">
          Back to Manager
        </Link>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border-default bg-surface-raised p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default ${
              activeTab === tab.key
                ? "bg-surface-default text-text-heading shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================= */}
      {/* TAB: Claude Settings + Shell Aliases */}
      {/* ================================================================= */}
      {activeTab === "config" && (
        <section className="card card-body">
          <h2 className="type-body-m font-semibold text-text-heading">Organization Defaults</h2>
          <form className="mt-3 space-y-3" onSubmit={handleSaveConfig}>
            <div>
              <label className="form-label">
                Claude Settings (JSON)
                <textarea
                  value={claudeSettingsJson}
                  onChange={(event) => setClaudeSettingsJson(event.target.value)}
                  rows={10}
                  className={`textarea type-code mt-1${
                    !jsonValidation.valid ? " border-status-error-border" : ""
                  }`}
                />
              </label>
              {!jsonValidation.valid && (
                <p className="mt-1 text-xs text-status-error-fg">{jsonValidation.error}</p>
              )}
              {jsonValidation.valid &&
                claudeSettingsJson.trim() !== "{}" &&
                claudeSettingsJson.trim() !== "" && (
                  <p className="mt-1 text-xs text-status-success-fg">Valid JSON</p>
                )}
            </div>

            <label className="form-label">
              Shell Aliases (`name=command`, one per line)
              <textarea
                value={shellAliasesText}
                onChange={(event) => setShellAliasesText(event.target.value)}
                rows={4}
                placeholder="ll=ls -la&#10;gs=git status"
                className="textarea type-code mt-1"
              />
            </label>

            <StatusMessage message={configMessage} error={configError} />

            <button
              type="submit"
              disabled={savingConfig || !jsonValidation.valid}
              className="btn-primary btn-sm"
            >
              {savingConfig ? "Saving..." : "Save Org Config"}
            </button>
          </form>
        </section>
      )}

      {/* ================================================================= */}
      {/* TAB: Hooks */}
      {/* ================================================================= */}
      {activeTab === "hooks" && (
        <section className="card card-body">
          <h2 className="type-body-m font-semibold text-text-heading">Hook Configuration</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Configure hooks that run on sandbox events. Each hook has a matcher pattern and a shell
            command.
          </p>

          {/* Event type tabs */}
          <div className="mt-3 flex flex-wrap gap-1">
            {HOOK_EVENT_TYPES.map(({ key, label }) => {
              const count = hooks[key]?.length ?? 0;
              return (
                <button
                  key={key}
                  onClick={() => setActiveHookTab(key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeHookTab === key
                      ? "bg-accent-default/10 text-accent-default"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-default/10 px-1 text-xs font-semibold text-accent-default">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Add hook form */}
          <div className="mt-3 space-y-2">
            <input
              value={newHookMatcher}
              onChange={(e) => setNewHookMatcher(e.target.value)}
              placeholder="Matcher pattern (e.g., *.ts, Write, Bash)"
              className="input"
            />
            <input
              value={newHookCommand}
              onChange={(e) => setNewHookCommand(e.target.value)}
              placeholder="Shell command (e.g., echo 'hook fired')"
              className="input type-code"
            />
            <button
              type="button"
              onClick={handleAddHook}
              disabled={!newHookMatcher.trim() || !newHookCommand.trim()}
              className="btn-primary btn-sm"
            >
              Add Hook
            </button>
          </div>

          {/* Hook list for active event type */}
          <div className="mt-3 space-y-2">
            {(hooks[activeHookTab] ?? []).map((hook, i) => (
              <div key={i} className={listItemClass}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-primary">{hook.matcher}</p>
                  <p className="truncate type-code text-text-secondary">{hook.command}</p>
                </div>
                <button onClick={() => handleRemoveHook(activeHookTab, i)} className={btnDanger}>
                  Remove
                </button>
              </div>
            ))}
            {(hooks[activeHookTab] ?? []).length === 0 && (
              <p className="type-body-s text-text-secondary">
                No hooks configured for{" "}
                {HOOK_EVENT_TYPES.find((h) => h.key === activeHookTab)?.label}.
              </p>
            )}
          </div>

          {/* Save button (saves entire config) */}
          <div className="mt-4 border-t border-border-default pt-3">
            <StatusMessage message={configMessage} error={configError} />
            <button
              type="button"
              onClick={(_e) => {
                const form = document.createElement("form");
                handleSaveConfig({ preventDefault: () => {}, currentTarget: form } as any);
              }}
              disabled={savingConfig}
              className="btn-primary btn-sm"
            >
              {savingConfig ? "Saving..." : "Save All Config"}
            </button>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* TAB: MCP Servers */}
      {/* ================================================================= */}
      {activeTab === "mcp" && (
        <section className="card card-body">
          <h2 className="type-body-m font-semibold text-text-heading">MCP Server Management</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Configure Model Context Protocol servers injected into sandboxes.
          </p>

          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={newMcpName}
                onChange={(e) => setNewMcpName(e.target.value)}
                placeholder="Server name"
                className="input"
              />
              <input
                value={newMcpPackage}
                onChange={(e) => setNewMcpPackage(e.target.value)}
                placeholder="Package / URL"
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newMcpLevel}
                onChange={(e) => setNewMcpLevel(e.target.value as McpLevel)}
                className="select"
              >
                <option value="global">Global</option>
                <option value="project">Project</option>
                <option value="task">Task</option>
              </select>
              <input
                value={newMcpConfig}
                onChange={(e) => setNewMcpConfig(e.target.value)}
                placeholder='Config JSON (e.g., {"key":"val"})'
                className="input type-code"
              />
            </div>
            <button
              type="button"
              onClick={handleAddMcpServer}
              disabled={!newMcpName.trim() || !newMcpPackage.trim()}
              className="btn-primary btn-sm"
            >
              Add Server
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {mcpServers.map((server, i) => (
              <div key={i} className={listItemClass}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-primary">{server.name}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {server.package} · {server.level}
                    {Object.keys(server.config).length > 0
                      ? ` · ${JSON.stringify(server.config)}`
                      : ""}
                  </p>
                </div>
                <button onClick={() => handleRemoveMcpServer(i)} className={btnDanger}>
                  Remove
                </button>
              </div>
            ))}
            {mcpServers.length === 0 && (
              <p className="type-body-s text-text-secondary">No MCP servers configured yet.</p>
            )}
          </div>

          <div className="mt-4 border-t border-border-default pt-3">
            <StatusMessage message={configMessage} error={configError} />
            <button
              type="button"
              onClick={() => {
                handleSaveConfig({ preventDefault: () => {} } as any);
              }}
              disabled={savingConfig}
              className="btn-primary btn-sm"
            >
              {savingConfig ? "Saving..." : "Save All Config"}
            </button>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* TAB: Workspace Customization */}
      {/* ================================================================= */}
      {activeTab === "workspace" && (
        <div className="space-y-4">
          {/* Dotfiles */}
          <section className="card card-body">
            <h2 className="type-body-m font-semibold text-text-heading">Dotfiles</h2>
            <p className="mt-1 text-xs text-text-secondary">
              Files placed in the sandbox home directory (e.g., .bashrc, .gitconfig).
            </p>
            <div className="mt-3 space-y-2">
              <input
                value={newDotfilePath}
                onChange={(e) => setNewDotfilePath(e.target.value)}
                placeholder="File path (e.g., .bashrc)"
                className="input"
              />
              <textarea
                value={newDotfileContent}
                onChange={(e) => setNewDotfileContent(e.target.value)}
                rows={4}
                placeholder="File content"
                className="textarea type-code"
              />
              <button
                type="button"
                onClick={handleAddDotfile}
                disabled={!newDotfilePath.trim() || !newDotfileContent.trim()}
                className="btn-primary btn-sm"
              >
                Add Dotfile
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {dotfiles.map((df, i) => (
                <div key={i} className={listItemClass}>
                  <div className="min-w-0 flex-1">
                    <p className="type-code font-medium text-text-primary">{df.path}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {df.content.slice(0, 80)}
                      {df.content.length > 80 ? "..." : ""}
                    </p>
                  </div>
                  <button onClick={() => handleRemoveDotfile(i)} className={btnDanger}>
                    Remove
                  </button>
                </div>
              ))}
              {dotfiles.length === 0 && (
                <p className="type-body-s text-text-secondary">No dotfiles configured.</p>
              )}
            </div>
          </section>

          {/* Dev Tool Configs */}
          <section className="card card-body">
            <h2 className="type-body-m font-semibold text-text-heading">Dev Tool Configurations</h2>
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newDevTool}
                  onChange={(e) => setNewDevTool(e.target.value)}
                  placeholder="Tool name (e.g., prettier)"
                  className="input"
                />
                <input
                  value={newDevToolConfig}
                  onChange={(e) => setNewDevToolConfig(e.target.value)}
                  placeholder="Config string or JSON"
                  className="input"
                />
              </div>
              <button
                type="button"
                onClick={handleAddDevTool}
                disabled={!newDevTool.trim() || !newDevToolConfig.trim()}
                className="btn-primary btn-sm"
              >
                Add Dev Tool
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {devToolConfigs.map((dt, i) => (
                <div key={i} className={listItemClass}>
                  <div>
                    <p className="text-xs font-medium text-text-primary">{dt.tool}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {dt.config.slice(0, 80)}
                      {dt.config.length > 80 ? "..." : ""}
                    </p>
                  </div>
                  <button onClick={() => handleRemoveDevTool(i)} className={btnDanger}>
                    Remove
                  </button>
                </div>
              ))}
              {devToolConfigs.length === 0 && (
                <p className="type-body-s text-text-secondary">No dev tool configs.</p>
              )}
            </div>
          </section>

          {/* Setup Scripts */}
          <section className="card card-body">
            <h2 className="type-body-m font-semibold text-text-heading">Setup Scripts</h2>
            <p className="mt-1 text-xs text-text-secondary">
              Scripts run in order when a sandbox initializes.
            </p>
            <div className="mt-3 space-y-2">
              <input
                value={newScriptName}
                onChange={(e) => setNewScriptName(e.target.value)}
                placeholder="Script name (e.g., install-deps)"
                className="input"
              />
              <textarea
                value={newScriptBody}
                onChange={(e) => setNewScriptBody(e.target.value)}
                rows={4}
                placeholder="#!/bin/bash&#10;npm install"
                className="textarea type-code"
              />
              <button
                type="button"
                onClick={handleAddSetupScript}
                disabled={!newScriptName.trim() || !newScriptBody.trim()}
                className="btn-primary btn-sm"
              >
                Add Script
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {setupScripts.map((script, i) => (
                <div key={i} className={listItemClass}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text-primary">
                      #{script.runOrder} {script.name}
                    </p>
                    <p className="truncate type-code text-text-secondary">
                      {script.script.split("\n")[0]}
                    </p>
                  </div>
                  <button onClick={() => handleRemoveSetupScript(i)} className={btnDanger}>
                    Remove
                  </button>
                </div>
              ))}
              {setupScripts.length === 0 && (
                <p className="type-body-s text-text-secondary">No setup scripts configured.</p>
              )}
            </div>
          </section>

          {/* Workspace save */}
          <div>
            <StatusMessage message={configMessage} error={configError} />
            <button
              type="button"
              onClick={() => {
                handleSaveConfig({ preventDefault: () => {} } as any);
              }}
              disabled={savingConfig}
              className="btn-primary btn-sm"
            >
              {savingConfig ? "Saving..." : "Save All Config"}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Environment Vault */}
      {/* ================================================================= */}
      {activeTab === "vault" && (
        <section className="card card-body">
          <h2 className="type-body-m font-semibold text-text-heading">Environment Vault</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Encrypted secrets injected into sandboxes as environment variables.
          </p>
          <form className="mt-3 space-y-2" onSubmit={handleSaveEnvVar}>
            <input
              value={envName}
              onChange={(event) => setEnvName(event.target.value)}
              placeholder="Variable name (e.g., ANTHROPIC_API_KEY)"
              required
              className="input"
            />
            <input
              value={envValue}
              onChange={(event) => setEnvValue(event.target.value)}
              placeholder="Secret value"
              type="password"
              required
              className="input"
            />
            <input
              value={envDescription}
              onChange={(event) => setEnvDescription(event.target.value)}
              placeholder="Description (optional)"
              className="input"
            />

            <StatusMessage message={envMessage} error={envError} />

            <button type="submit" disabled={savingEnv} className="btn-primary btn-sm">
              {savingEnv ? "Saving..." : "Save Secret"}
            </button>
          </form>

          <div className="mt-3 space-y-2">
            {(envVars ?? []).map((entry) => (
              <div key={entry._id} className={listItemClass}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-primary">{entry.name}</p>
                  <div className="flex items-center gap-2">
                    <p className="type-code text-text-secondary">
                      {revealedEnvIds.has(entry._id)
                        ? "(encrypted - stored securely)"
                        : "***************"}
                    </p>
                    <button
                      onClick={() => toggleRevealEnv(entry._id)}
                      className="text-xs text-accent-default hover:text-accent-strong"
                    >
                      {revealedEnvIds.has(entry._id) ? "Hide" : "Reveal"}
                    </button>
                  </div>
                  {entry.description ? (
                    <p className="text-xs text-text-secondary">{entry.description}</p>
                  ) : null}
                </div>
                <button
                  onClick={() => removeEnvVar({ envVarId: entry._id as any })}
                  className={btnDanger}
                >
                  Delete
                </button>
              </div>
            ))}
            {(envVars ?? []).length === 0 ? (
              <p className="type-body-s text-text-secondary">No secrets configured yet.</p>
            ) : null}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* TAB: Presets */}
      {/* ================================================================= */}
      {activeTab === "presets" && (
        <section className="card card-body">
          <h2 className="type-body-m font-semibold text-text-heading">
            Org Presets
            {editingPresetId && (
              <span className="ml-2 text-xs font-normal text-accent-default">(editing)</span>
            )}
          </h2>
          <form className="mt-3 space-y-2" onSubmit={handleSavePreset}>
            <input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="Preset name"
              required
              className="input"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={presetEditorType}
                onChange={(event) => setPresetEditorType(event.target.value as EditorType)}
                className="select"
              >
                <option value="monaco">Monaco</option>
                <option value="codemirror">CodeMirror</option>
                <option value="none">None</option>
              </select>
              <input
                type="number"
                min={5}
                max={60}
                value={presetTtl}
                onChange={(event) => setPresetTtl(Number(event.target.value))}
                className="input"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={presetDefault}
                onChange={(event) => setPresetDefault(event.target.checked)}
                className="h-4 w-4 rounded border-border-default accent-accent-default"
              />
              Set as org default
            </label>

            <StatusMessage message={presetMessage} error={presetError} />

            <div className="flex gap-2">
              <button type="submit" disabled={savingPreset} className="btn-primary btn-sm">
                {savingPreset ? "Saving..." : editingPresetId ? "Update Preset" : "Save Org Preset"}
              </button>
              {editingPresetId && (
                <button type="button" onClick={resetPresetForm} className="btn-secondary btn-sm">
                  Cancel Edit
                </button>
              )}
            </div>
          </form>

          <div className="mt-3 space-y-2">
            {(orgPresets ?? []).map((preset) => (
              <div key={preset._id} className={listItemClass}>
                <div>
                  <p className="text-xs font-medium text-text-primary">{preset.name}</p>
                  <p className="text-xs text-text-secondary">
                    {preset.editorType} · {preset.ttlMinutes}m{preset.isDefault ? " · default" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleEditPreset(preset)} className="btn-secondary btn-sm">
                    Edit
                  </button>
                  <button
                    onClick={() => handleClonePreset(preset)}
                    className="btn-secondary btn-sm"
                  >
                    Clone
                  </button>
                  <button
                    onClick={() => removePreset({ presetId: preset._id as any })}
                    className={btnDanger}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {(orgPresets ?? []).length === 0 ? (
              <p className="type-body-s text-text-secondary">No org presets created yet.</p>
            ) : null}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* TAB: AI Providers */}
      {/* ================================================================= */}
      {activeTab === "providers" && (
        <section className="card card-body">
          <h2 className="type-body-m font-semibold text-text-heading">
            My AI Provider Credentials
          </h2>
          <form className="mt-3 space-y-2" onSubmit={handleSaveProvider}>
            <select
              value={providerType}
              onChange={(event) => setProviderType(event.target.value as ProviderType)}
              className="select"
            >
              <option value="anthropic">Anthropic API</option>
              <option value="bedrock">AWS Bedrock</option>
              <option value="vertex">Google Vertex</option>
              <option value="azure">Azure</option>
            </select>
            <textarea
              value={providerCredentials}
              onChange={(event) => setProviderCredentials(event.target.value)}
              rows={4}
              required
              placeholder="Provider credentials payload (API key or provider-specific JSON)"
              className="textarea"
            />
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={providerDefault}
                onChange={(event) => setProviderDefault(event.target.checked)}
                className="h-4 w-4 rounded border-border-default accent-accent-default"
              />
              Set as default provider
            </label>

            <StatusMessage message={providerMessage} error={providerError} />

            <button type="submit" disabled={savingProvider} className="btn-primary btn-sm">
              {savingProvider ? "Saving..." : "Save Provider Credentials"}
            </button>
          </form>

          <div className="mt-3 space-y-2">
            {sortedProviders.map((provider) => (
              <div key={provider._id} className={listItemClass}>
                <div>
                  <p className="text-xs font-medium text-text-primary">{provider.provider}</p>
                  <p className="text-xs text-text-secondary">
                    {provider.isDefault ? "Default provider" : "Secondary provider"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!provider.isDefault ? (
                    <button
                      onClick={() => setDefaultProvider({ configId: provider._id as any })}
                      className="btn-secondary btn-sm"
                    >
                      Make Default
                    </button>
                  ) : null}
                  <button
                    onClick={() => removeProvider({ configId: provider._id as any })}
                    className={btnDanger}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {sortedProviders.length === 0 ? (
              <p className="type-body-s text-text-secondary">No provider credentials saved yet.</p>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
