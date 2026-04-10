"use client";

import { AgentAvatar } from "./AgentAvatar";

export function AgentProfileTab({ agent }: { agent: any }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <AgentAvatar seed={agent.avatarSeed ?? agent.name} name={agent.name} />
        <div>
          <div className="font-semibold text-text-heading">{agent.name}</div>
          <div className="text-sm text-text-secondary">{agent.role}</div>
        </div>
      </div>
      <p className="text-sm text-text-secondary">{agent.description}</p>
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase text-text-muted">Specializations</h4>
        <div className="flex flex-wrap gap-2">
          {(agent.specializations ?? []).map((item: string) => (
            <span
              key={item}
              className="rounded-md bg-surface-elevated px-2 py-1 text-xs text-text-primary"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
