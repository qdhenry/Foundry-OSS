"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSandboxBackend } from "../backend";
import { useTabIndicator } from "../theme/useAnimations";
import { ChatPanel } from "./ChatPanel";
import { resolveEditorTypeForRuntime } from "./editorRuntime";
import { SandboxEditor } from "./SandboxEditor";
import { type HUDTab, useSandboxHUD } from "./SandboxHUDContext";
import { SandboxLogStream } from "./SandboxLogStream";
import { SandboxStatusBadge } from "./SandboxStatusBadge";
import { useSandboxSurfaceComponents } from "./SandboxSurfaceComponents";
import { SandboxTerminal } from "./SandboxTerminal";
import { StageProgress } from "./StageProgress";

const COLLAPSED_HEIGHT = 36;
const DEFAULT_EXPANDED_HEIGHT = 400;
const MIN_EXPANDED_HEIGHT = 220;
const MIN_VISIBLE_TOP_MARGIN = 96;
const HUD_HEIGHT_STORAGE_KEY = "sandboxHUD.expandedHeight";

const SUB_TABS: { id: HUDTab["subTab"]; label: string }[] = [
  { id: "logs", label: "Logs" },
  { id: "terminal", label: "Terminal" },
  { id: "files", label: "File Changes" },
  { id: "editor", label: "Editor" },
  { id: "audit", label: "Audit" },
  { id: "chat", label: "Claude Chat" },
];

function getDotClass(status: string) {
  if (["executing", "provisioning", "cloning", "finalizing"].includes(status)) {
    return "animate-pulse bg-status-warning-fg";
  }
  if (status === "completed") return "bg-status-success-fg";
  if (status === "failed") return "bg-status-error-fg";
  if (status === "sleeping") return "bg-status-warning-fg";
  if (status === "ready") return "bg-status-success-fg";
  return "bg-text-muted";
}

function TabStatusPill({ tab }: { tab: HUDTab }) {
  const session = useQuery(
    "sandbox/sessions:get" as any,
    tab.sessionId ? { sessionId: tab.sessionId as any } : "skip",
  ) as any;
  const status = (session?.status as string | undefined) ?? tab.status;
  const runtimeMode = (session?.runtimeMode as string | undefined) ?? tab.runtimeMode ?? null;
  const setupProgress = session?.setupProgress ?? tab.setupProgress;

  return (
    <button
      key={tab.sessionId}
      className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-raised px-2 py-0.5 text-[10px] font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
      title={tab.taskTitle}
    >
      <span className="max-w-[120px] truncate">{tab.taskTitle}</span>
      <SandboxStatusBadge
        status={status}
        runtimeMode={runtimeMode}
        setupProgress={setupProgress}
        showSetupProgress={false}
        className="scale-90"
      />
    </button>
  );
}

function SessionTabButton({
  tab,
  isActive,
  focusTab,
  closeTab,
}: {
  tab: HUDTab;
  isActive: boolean;
  focusTab: (sessionId: string) => void;
  closeTab: (sessionId: string) => void;
}) {
  const router = useRouter();
  const session = useQuery(
    "sandbox/sessions:get" as any,
    tab.sessionId ? { sessionId: tab.sessionId as any } : "skip",
  ) as any;
  const status = (session?.status as string | undefined) ?? tab.status;

  function handleClick() {
    focusTab(tab.sessionId);
    router.push(`/${tab.programSlug}/tasks/${tab.taskId}`);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleClick();
        }
      }}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
        isActive
          ? "bg-interactive-active text-text-primary"
          : "text-text-secondary hover:bg-interactive-hover hover:text-text-primary"
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${getDotClass(status)}`} />
      <span className="max-w-[140px] truncate">{tab.taskTitle}</span>
      <button
        onClick={(event) => {
          event.stopPropagation();
          closeTab(tab.sessionId);
        }}
        className="ml-0.5 rounded p-0.5 text-text-muted hover:bg-interactive-hover hover:text-text-primary"
        aria-label="Close tab"
      >
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function PinButton({ sessionId, isPinned }: { sessionId: string; isPinned?: boolean }) {
  const pinSession = useMutation("sandbox/sessions:pin" as any);
  const unpinSession = useMutation("sandbox/sessions:unpin" as any);
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);
    try {
      if (isPinned) {
        await unpinSession({ sessionId: sessionId as any });
      } else {
        await pinSession({ sessionId: sessionId as any });
      }
    } catch {
      /* best effort */
    }
    setPending(false);
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
        isPinned
          ? "text-status-warning-fg hover:bg-status-warning-bg"
          : "text-text-secondary hover:bg-interactive-hover hover:text-text-primary"
      } disabled:opacity-40`}
    >
      {pending ? "..." : isPinned ? "Unpin" : "Pin"}
    </button>
  );
}

export function SandboxHUD() {
  const { tabs, activeTabId, isExpanded, focusTab, closeTab, setSubTab, toggleExpanded } =
    useSandboxHUD();

  const activeTab = tabs.find((t) => t.sessionId === activeTabId) ?? null;
  const { cancelSession } = useSandboxBackend();
  const { TaskAuditTrail } = useSandboxSurfaceComponents();
  const activeSession = useQuery(
    "sandbox/sessions:get" as any,
    activeTabId ? { sessionId: activeTabId as any } : "skip",
  ) as any;
  const designSnapshot = useQuery(
    "taskDesignSnapshots:getByTask" as any,
    activeTab?.taskId ? { taskId: activeTab.taskId } : "skip",
  ) as any;
  const pinSession = useMutation("sandbox/sessions:pin" as any);
  const unpinSession = useMutation("sandbox/sessions:unpin" as any);
  const activeStatus =
    (activeSession?.status as string | undefined) ?? activeTab?.status ?? "provisioning";
  const activeSetupProgress = activeSession?.setupProgress ?? activeTab?.setupProgress;
  const activeRuntimeMode =
    (activeSession?.runtimeMode as string | undefined) ?? activeTab?.runtimeMode ?? null;

  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const subTabContainerRef = useRef<HTMLDivElement>(null);
  const subTabIndicatorRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [expandedHeight, setExpandedHeight] = useState(DEFAULT_EXPANDED_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);

  const clampExpandedHeight = useCallback((height: number) => {
    const viewportMax = Math.max(MIN_EXPANDED_HEIGHT, window.innerHeight - MIN_VISIBLE_TOP_MARGIN);
    return Math.min(viewportMax, Math.max(MIN_EXPANDED_HEIGHT, Math.round(height)));
  }, []);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(HUD_HEIGHT_STORAGE_KEY);
    if (!storedValue) return;

    const parsed = Number(storedValue);
    if (!Number.isFinite(parsed)) return;
    setExpandedHeight(clampExpandedHeight(parsed));
  }, [clampExpandedHeight]);

  useEffect(() => {
    window.localStorage.setItem(HUD_HEIGHT_STORAGE_KEY, String(expandedHeight));
  }, [expandedHeight]);

  useEffect(() => {
    function handleViewportResize() {
      setExpandedHeight((current) => clampExpandedHeight(current));
    }
    window.addEventListener("resize", handleViewportResize);
    return () => window.removeEventListener("resize", handleViewportResize);
  }, [clampExpandedHeight]);

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isExpanded) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStartRef.current = {
        startY: event.clientY,
        startHeight: expandedHeight,
      };
      setIsResizing(true);
    },
    [expandedHeight, isExpanded],
  );

  const handleResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragState = dragStartRef.current;
      if (!dragState) return;
      const delta = dragState.startY - event.clientY;
      setExpandedHeight(clampExpandedHeight(dragState.startHeight + delta));
    },
    [clampExpandedHeight],
  );

  const handleResizePointerUp = useCallback(() => {
    dragStartRef.current = null;
    setIsResizing(false);
  }, []);

  const subTabSelector = useMemo(
    () => `[data-subtab="${activeTab?.subTab ?? "logs"}"]`,
    [activeTab?.subTab],
  );
  useTabIndicator(subTabIndicatorRef, subTabContainerRef, subTabSelector);

  // When terminal tab becomes visible, trigger a fit
  useEffect(() => {
    if (activeTab?.subTab === "terminal" && isExpanded) {
      // Brief delay to allow layout to settle
      const id = setTimeout(() => {
        const fitEvent = new Event("resize");
        window.dispatchEvent(fitEvent);
      }, 50);
      return () => clearTimeout(id);
    }
  }, [activeTab?.subTab, isExpanded]);

  if (tabs.length === 0) return null;

  const height = isExpanded ? expandedHeight : COLLAPSED_HEIGHT;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 flex flex-col border-t border-border-default bg-surface-default text-text-primary ${
        isResizing ? "transition-none" : "transition-[height] duration-200"
      }`}
      style={{ height }}
    >
      {isExpanded ? (
        <div
          role="separator"
          aria-label="Resize sandbox HUD"
          aria-orientation="horizontal"
          className="z-10 h-4 shrink-0 cursor-row-resize touch-none select-none border-b border-border-subtle bg-surface-default"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onLostPointerCapture={handleResizePointerUp}
          onDoubleClick={() => setExpandedHeight(DEFAULT_EXPANDED_HEIGHT)}
        >
          <div
            className={`mx-auto mt-[7px] h-0.5 w-20 rounded-full transition-colors ${
              isResizing ? "bg-accent-default" : "bg-border-strong hover:bg-text-muted"
            }`}
          />
        </div>
      ) : null}

      {/* ── Collapsed bar / always-visible header ── */}
      <div
        className="flex h-9 shrink-0 items-center gap-2 border-b border-border-subtle px-3"
        style={{ borderBottom: isExpanded ? undefined : "none" }}
      >
        {/* Outer session tabs */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <SessionTabButton
              key={tab.sessionId}
              tab={tab}
              isActive={tab.sessionId === activeTabId}
              focusTab={focusTab}
              closeTab={closeTab}
            />
          ))}
        </div>

        {/* Collapsed mini pills — only when collapsed */}
        {!isExpanded && (
          <div className="flex shrink-0 items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <TabStatusPill key={tab.sessionId} tab={tab} />
            ))}
          </div>
        )}

        {/* Toggle expand / collapse */}
        <button
          onClick={toggleExpanded}
          className="ml-1 rounded p-1 text-text-secondary transition-colors hover:bg-interactive-hover hover:text-text-primary"
          aria-label={isExpanded ? "Collapse HUD" : "Expand HUD"}
        >
          <svg
            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* ── Expanded body ── */}
      {isExpanded && activeTab && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Sub-tab bar */}
          <div
            ref={subTabContainerRef}
            className="relative flex shrink-0 items-center gap-0 border-b border-border-subtle px-3"
          >
            {SUB_TABS.map((st) => (
              <button
                key={st.id}
                data-subtab={st.id}
                onClick={() => setSubTab(st.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab.subTab === st.id
                    ? "text-accent-default"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {st.label}
              </button>
            ))}
            <div
              ref={subTabIndicatorRef}
              className="absolute bottom-0 h-0.5 bg-accent-default transition-none"
              style={{ pointerEvents: "none" }}
            />
          </div>

          <div className="shrink-0 border-b border-border-subtle px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <SandboxStatusBadge
                status={activeStatus}
                prUrl={activeSession?.prUrl ?? null}
                runtimeMode={activeRuntimeMode}
                setupProgress={activeSetupProgress}
              />
              {activeSession?.worktreeBranch ? (
                <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                  {activeSession.worktreeBranch}
                </span>
              ) : null}
              {designSnapshot && !designSnapshot.degraded && (
                <span className="rounded bg-status-info-bg px-1.5 py-0.5 text-[10px] font-medium text-status-info-fg">
                  Design
                </span>
              )}
              {designSnapshot?.degraded && (
                <span className="rounded bg-status-warning-bg px-1.5 py-0.5 text-[10px] font-medium text-status-warning-fg">
                  Design (degraded)
                </span>
              )}
              <button
                onClick={async () => {
                  if (!activeTabId) return;
                  try {
                    if (activeSession?.isPinned) {
                      await unpinSession({ sessionId: activeTabId as any });
                    } else {
                      await pinSession({ sessionId: activeTabId as any });
                    }
                  } catch {}
                }}
                className="ml-auto rounded p-1 text-text-secondary transition-colors hover:bg-interactive-hover hover:text-text-primary"
                title={activeSession?.isPinned ? "Unpin session" : "Pin session"}
              >
                {activeSession?.isPinned ? (
                  <svg
                    className="h-4 w-4 text-status-warning-fg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                ) : (
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"
                    />
                  </svg>
                )}
              </button>
            </div>
            <StageProgress setupProgress={activeSetupProgress} className="mt-2" />
          </div>

          {/* Sub-tab content — use CSS display:none to keep xterm WebSocket alive */}
          <div className="relative min-h-0 flex-1 overflow-auto">
            {tabs.map((tab) => (
              <div
                key={tab.sessionId}
                style={{ display: tab.sessionId === activeTabId ? "block" : "none" }}
                className="h-full"
              >
                {/* Logs sub-tab */}
                <div
                  style={{ display: tab.subTab === "logs" ? "block" : "none" }}
                  className="h-full overflow-auto p-2"
                >
                  <SandboxLogStream sessionId={tab.sessionId} showTerminal={false} />
                </div>

                {/* Terminal sub-tab — always rendered to keep WebSocket alive */}
                <div
                  ref={tab.sessionId === activeTabId ? terminalContainerRef : undefined}
                  style={{ display: tab.subTab === "terminal" ? "block" : "none" }}
                  className="h-full"
                >
                  <SandboxTerminal sessionId={tab.sessionId} />
                </div>

                {/* File Changes sub-tab */}
                <div
                  style={{ display: tab.subTab === "files" ? "block" : "none" }}
                  className="h-full overflow-auto p-2"
                >
                  <div className="py-4 text-center text-xs text-text-muted">
                    Switch to Logs tab to see live file changes.
                  </div>
                </div>

                {/* Editor sub-tab */}
                <div
                  style={{ display: tab.subTab === "editor" ? "block" : "none" }}
                  className="h-full"
                >
                  {tab.sessionId === activeTabId ? (
                    <SandboxEditor
                      sessionId={tab.sessionId}
                      editorType={resolveEditorTypeForRuntime(activeSession?.editorType, {
                        fallback: "none",
                      })}
                    />
                  ) : null}
                </div>

                {/* Audit sub-tab */}
                <div
                  style={{ display: tab.subTab === "audit" ? "block" : "none" }}
                  className="h-full overflow-auto p-2"
                >
                  <TaskAuditTrail taskId={tab.taskId} />
                </div>

                {/* Chat sub-tab */}
                <div
                  style={{ display: tab.subTab === "chat" ? "block" : "none" }}
                  className="h-full"
                >
                  {tab.sessionId === activeTabId ? <ChatPanel sessionId={tab.sessionId} /> : null}
                </div>
              </div>
            ))}
          </div>

          {/* HUD Footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-border-subtle px-3 py-1.5">
            <div className="flex items-center gap-2">
              <PinButton sessionId={activeTabId!} isPinned={activeSession?.isPinned} />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!activeTabId) return;
                  if (window.confirm("Terminate this sandbox?")) {
                    void cancelSession({ sessionId: activeTabId });
                  }
                }}
                disabled={
                  !activeTabId ||
                  ["completed", "failed", "cancelled", "deleted"].includes(activeStatus)
                }
                className="rounded px-2.5 py-1 text-xs font-medium text-status-error-fg transition-colors hover:bg-status-error-bg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Terminate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
