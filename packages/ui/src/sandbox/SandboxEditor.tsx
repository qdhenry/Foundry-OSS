"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSandboxBackend } from "../backend";
import { type EditorType, resolveEditorTypeForRuntime } from "./editorRuntime";

type FileEntry = {
  name: string;
  type: "file" | "directory" | "other";
  size: number;
};

interface SandboxEditorProps {
  sessionId: string;
  editorType?: EditorType | null;
}

function safeErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
    if (message != null) {
      try {
        const serialized = JSON.stringify(message);
        if (serialized && serialized !== "{}") return serialized;
      } catch {
        // Fall through to fallback.
      }
    }
  }
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Fall through to fallback.
  }
  return fallback;
}

function isMissingFileError(error: unknown) {
  const message = safeErrorMessage(error, "").toLowerCase();
  return message.includes("no such file or directory") || message.includes("not found");
}

function logSandboxEditor(
  level: "info" | "warn" | "error",
  message: string,
  details?: Record<string, unknown>,
) {
  const prefix = `[SandboxEditor] ${message}`;
  try {
    if (level === "error") {
      if (details) {
        console.error(prefix, details);
      } else {
        console.error(prefix);
      }
      return;
    }
    if (level === "warn") {
      if (details) {
        console.warn(prefix, details);
      } else {
        console.warn(prefix);
      }
      return;
    }
    if (details) {
      console.info(prefix, details);
    } else {
      console.info(prefix);
    }
  } catch {
    // Logging must never impact UX.
  }
}

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
}) as any;

const CodeMirror = dynamic(() => import("@uiw/react-codemirror").then((module) => module.default), {
  ssr: false,
}) as any;

function normalizePath(path: string) {
  const cleaned = path.replace(/\\/g, "/").trim();
  if (!cleaned || cleaned === ".") return ".";
  return (
    cleaned.replace(/^\.\//, "").replace(/\/+/g, "/").replace(/^\/+/, "").replace(/\/+$/, "") || "."
  );
}

function parentPath(path: string) {
  const normalized = normalizePath(path);
  if (normalized === ".") return ".";
  const parts = normalized.split("/").filter(Boolean);
  parts.pop();
  return parts.length > 0 ? parts.join("/") : ".";
}

function joinPath(basePath: string, name: string) {
  const base = normalizePath(basePath);
  return base === "." ? name : `${base}/${name}`;
}

function languageForPath(path?: string | null) {
  if (!path) return "plaintext";
  const file = path.toLowerCase();
  if (file.endsWith(".ts")) return "typescript";
  if (file.endsWith(".tsx")) return "typescript";
  if (file.endsWith(".js")) return "javascript";
  if (file.endsWith(".jsx")) return "javascript";
  if (file.endsWith(".json")) return "json";
  if (file.endsWith(".md")) return "markdown";
  if (file.endsWith(".css")) return "css";
  if (file.endsWith(".scss")) return "scss";
  if (file.endsWith(".html")) return "html";
  if (file.endsWith(".yml") || file.endsWith(".yaml")) return "yaml";
  return "plaintext";
}

export function SandboxEditor({ sessionId, editorType }: SandboxEditorProps) {
  const { listFiles, readFile, writeFile } = useSandboxBackend();

  const [cwd, setCwd] = useState(".");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [pathInput, setPathInput] = useState("README.md");
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const normalizedCwd = useMemo(() => normalizePath(cwd), [cwd]);
  const normalizedPathInput = useMemo(() => normalizePath(pathInput), [pathInput]);
  const resolvedEditorType = useMemo(
    () => resolveEditorTypeForRuntime(editorType, { fallback: "none" }),
    [editorType],
  );
  const canEdit = resolvedEditorType === "monaco" || resolvedEditorType === "codemirror";

  const refreshDirectory = useCallback(
    async (requestedPath?: string) => {
      if (!canEdit) return;
      setIsLoadingEntries(true);
      setError(null);
      try {
        const result = (await listFiles({
          sessionId,
          path: requestedPath ? normalizePath(requestedPath) : undefined,
        })) as any;
        const nextCwd =
          typeof result?.cwd === "string" && result.cwd.trim() ? normalizePath(result.cwd) : ".";
        const nextEntries = Array.isArray(result?.entries)
          ? result.entries
              .map((entry: any) => {
                const name = typeof entry?.name === "string" ? entry.name : "";
                const type =
                  entry?.type === "directory" || entry?.type === "file" ? entry.type : "other";
                const size =
                  typeof entry?.size === "number" && Number.isFinite(entry.size) ? entry.size : 0;
                if (!name) return null;
                return { name, type, size } satisfies FileEntry;
              })
              .filter((entry: FileEntry | null): entry is FileEntry => entry !== null)
          : [];
        setCwd(nextCwd);
        setEntries(nextEntries);
      } catch (err: unknown) {
        setError(safeErrorMessage(err, "Failed to load files."));
      } finally {
        setIsLoadingEntries(false);
      }
    },
    [canEdit, listFiles, sessionId],
  );

  const openFile = useCallback(
    async (requestedPath: string) => {
      if (!canEdit) return;
      const normalizedPath = normalizePath(requestedPath);
      if (normalizedPath === ".") {
        setError("Select a file path to open.");
        return;
      }
      setIsOpeningFile(true);
      setError(null);
      setNotice(null);
      try {
        const applyReadResult = (result: any, noticeMessage: string) => {
          const nextPath =
            typeof result?.path === "string" && result.path.trim()
              ? normalizePath(result.path)
              : normalizedPath;
          setActiveFilePath(nextPath);
          setPathInput(nextPath);
          setContent(typeof result?.content === "string" ? result.content : "");
          setNotice(noticeMessage);
        };

        try {
          const result = (await readFile({
            sessionId,
            path: normalizedPath,
          })) as any;
          applyReadResult(result, "File loaded.");
        } catch (readError) {
          if (!isMissingFileError(readError)) {
            throw readError;
          }

          logSandboxEditor("warn", "File open failed; refreshing root and retrying", {
            sessionId,
            path: normalizedPath,
            cwd: normalizedCwd,
            message: safeErrorMessage(readError, "File read failed"),
          });

          await refreshDirectory(".");

          const retryResult = (await readFile({
            sessionId,
            path: normalizedPath,
          })) as any;
          applyReadResult(retryResult, "File loaded after refreshing workspace root.");
        }
      } catch (err: unknown) {
        const message = safeErrorMessage(err, "Failed to open file.");
        logSandboxEditor("error", "Open file failed", {
          sessionId,
          path: normalizedPath,
          cwd: normalizedCwd,
          message,
        });
        setError(message);
      } finally {
        setIsOpeningFile(false);
      }
    },
    [canEdit, normalizedCwd, readFile, refreshDirectory, sessionId],
  );

  const saveFile = useCallback(async () => {
    if (!canEdit) return;
    const targetPath = activeFilePath ?? normalizedPathInput;
    if (!targetPath || targetPath === ".") {
      setError("Provide a file path before saving.");
      return;
    }

    setIsSavingFile(true);
    setError(null);
    setNotice(null);
    try {
      await writeFile({
        sessionId,
        path: targetPath,
        content,
      });
      setActiveFilePath(targetPath);
      setPathInput(targetPath);
      setNotice("File saved.");
      await refreshDirectory(parentPath(targetPath));
    } catch (err: unknown) {
      setError(safeErrorMessage(err, "Failed to save file."));
    } finally {
      setIsSavingFile(false);
    }
  }, [
    activeFilePath,
    canEdit,
    content,
    normalizedPathInput,
    refreshDirectory,
    sessionId,
    writeFile,
  ]);

  useEffect(() => {
    if (!canEdit) return;
    void refreshDirectory(".");
  }, [canEdit, refreshDirectory, sessionId]);

  if (!canEdit) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-comp-terminal-text">
        Editor is disabled for this sandbox session. Relaunch with Monaco or CodeMirror selected.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-comp-terminal-border px-3 py-2">
        <button
          onClick={() => void refreshDirectory(normalizedCwd)}
          disabled={isLoadingEntries}
          className="rounded border border-comp-terminal-border bg-comp-terminal-bg px-2 py-1 text-xs text-comp-terminal-value hover:bg-comp-terminal-border disabled:opacity-60"
        >
          {isLoadingEntries ? "Refreshing..." : "Refresh"}
        </button>
        <button
          onClick={() => void refreshDirectory(parentPath(normalizedCwd))}
          disabled={isLoadingEntries || normalizedCwd === "."}
          className="rounded border border-comp-terminal-border bg-comp-terminal-bg px-2 py-1 text-xs text-comp-terminal-value hover:bg-comp-terminal-border disabled:opacity-60"
        >
          Up
        </button>
        <input
          value={pathInput}
          onChange={(event) => setPathInput(event.target.value)}
          placeholder="Path in repository (e.g. src/app/page.tsx)"
          className="min-w-[220px] flex-1 rounded border border-comp-terminal-border bg-comp-terminal-bg px-2 py-1.5 text-xs text-comp-terminal-value placeholder:text-comp-terminal-timestamp"
        />
        <button
          onClick={() => void openFile(pathInput)}
          disabled={isOpeningFile}
          className="rounded bg-accent-default px-2.5 py-1 text-xs font-medium text-text-on-brand hover:bg-accent-strong disabled:opacity-60"
        >
          {isOpeningFile ? "Opening..." : "Open"}
        </button>
        <button
          onClick={() => void saveFile()}
          disabled={isSavingFile || isOpeningFile}
          className="rounded bg-status-success-fg px-2.5 py-1 text-xs font-medium text-text-on-brand hover:opacity-90 disabled:opacity-60"
        >
          {isSavingFile ? "Saving..." : "Save"}
        </button>
      </div>

      {error ? (
        <div className="border-b border-status-error-border bg-status-error-bg px-3 py-1.5 text-xs text-status-error-fg">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="border-b border-status-success-border bg-status-success-bg px-3 py-1.5 text-xs text-status-success-fg">
          {notice}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-auto border-r border-comp-terminal-border bg-comp-terminal-bg">
          <div className="sticky top-0 border-b border-comp-terminal-border bg-comp-terminal-bg px-3 py-2 text-[11px] font-medium text-comp-terminal-text">
            {normalizedCwd}
          </div>
          <div className="space-y-1 p-2">
            {entries.length === 0 && !isLoadingEntries ? (
              <p className="px-2 py-1 text-xs text-comp-terminal-text">No files found.</p>
            ) : null}
            {entries.map((entry) => {
              const fullPath = joinPath(normalizedCwd, entry.name);
              const isDirectory = entry.type === "directory";
              const isActive = activeFilePath === normalizePath(fullPath);
              return (
                <button
                  key={`${entry.type}:${entry.name}`}
                  onClick={() =>
                    isDirectory ? void refreshDirectory(fullPath) : void openFile(fullPath)
                  }
                  className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-xs transition-colors ${
                    isActive
                      ? "bg-accent-default/25 text-comp-terminal-agent"
                      : "text-comp-terminal-value hover:bg-comp-terminal-border"
                  }`}
                >
                  <span className="truncate">
                    {isDirectory ? "[dir] " : "[file] "}
                    {entry.name}
                  </span>
                  {!isDirectory ? (
                    <span className="shrink-0 text-[10px] text-comp-terminal-timestamp">
                      {entry.size}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-h-0">
          {resolvedEditorType === "monaco" ? (
            <MonacoEditor
              theme="vs-dark"
              language={languageForPath(activeFilePath ?? normalizedPathInput)}
              value={content}
              onChange={(value: string | undefined) => setContent(value ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: "on",
                automaticLayout: true,
              }}
              height="100%"
            />
          ) : (
            <CodeMirror
              value={content}
              height="100%"
              theme="dark"
              basicSetup
              onChange={(value: string) => setContent(value)}
            />
          )}
        </section>
      </div>
    </div>
  );
}
