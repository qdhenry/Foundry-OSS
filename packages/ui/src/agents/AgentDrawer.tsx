"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { AgentConfigTab } from "./AgentConfigTab";
import { AgentHistoryTab } from "./AgentHistoryTab";
import { AgentProfileTab } from "./AgentProfileTab";
import { AgentStatusBadge } from "./AgentStatusBadge";
import { AgentVersionsTab } from "./AgentVersionsTab";

const TABS = ["profile", "config", "history", "versions"] as const;
type Tab = (typeof TABS)[number];

export function AgentDrawer({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("profile");
  const agent = useQuery("agentTeam/agents:get" as any, { agentId: agentId as any });

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!agent) {
    return (
      <DrawerShell onClose={onClose}>
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
        </div>
      </DrawerShell>
    );
  }

  return (
    <DrawerShell onClose={onClose}>
      <div className="border-b border-border-default px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: `hsl(${hashSeed(agent.avatarSeed ?? agent.name)} 70% 45%)` }}
            title={agent.name}
          >
            {agent.name
              .split(" ")
              .map((p: string) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-text-heading">{agent.name}</h2>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span>{agent.role}</span>
              <AgentStatusBadge status={agent.status} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border-default px-5">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`relative px-3 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === item ? "text-accent-default" : "text-text-secondary hover:text-text-heading"
            }`}
          >
            {item}
            {tab === item && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent-default" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {tab === "profile" && <AgentProfileTab agent={agent} />}
        {tab === "config" && <AgentConfigTab agent={agent} />}
        {tab === "history" && <AgentHistoryTab agentId={agentId} />}
        {tab === "versions" && <AgentVersionsTab agentId={agentId} />}
      </div>
    </DrawerShell>
  );
}

function hashSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function DrawerShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-surface-default shadow-lg">
        <button
          type="button"
          className="absolute right-3 top-3 z-10 rounded p-1 text-text-muted hover:bg-surface-subtle hover:text-text-heading"
          onClick={onClose}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M15 5L5 15M5 5l10 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
