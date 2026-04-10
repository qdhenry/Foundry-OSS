"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

const MODEL_OPTIONS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5 v2" },
  { value: "claude-sonnet-4-5-20250514", label: "Claude Sonnet 4.5" },
] as const;

export function AgentConfigTab({ agent }: { agent: any }) {
  const [raw, setRaw] = useState(false);
  const [name, setName] = useState<string>(agent.name ?? "");
  const [model, setModel] = useState<string>(agent.model ?? "claude-sonnet-4-5-20250929");
  const [systemPrompt, setSystemPrompt] = useState<string>(agent.systemPrompt ?? "");
  const [constraints, setConstraints] = useState<string>((agent.constraints ?? []).join("\n"));
  const [saving, setSaving] = useState(false);

  const updateAgent = useMutation("agentTeam/agents:update" as any);

  async function handleSave() {
    setSaving(true);
    try {
      await updateAgent({
        agentId: agent._id,
        name,
        model,
        systemPrompt,
        constraints: constraints.split("\n").filter(Boolean),
      });
      toast.success("Agent configuration saved");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }

  if (raw) {
    return (
      <div className="space-y-3">
        <button
          className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-elevated"
          onClick={() => setRaw(false)}
          type="button"
        >
          Show form view
        </button>
        <pre className="max-h-80 overflow-auto rounded-lg bg-surface-elevated p-3 text-xs">
          {JSON.stringify(agent, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-elevated"
        onClick={() => setRaw(true)}
        type="button"
      >
        Show raw JSON
      </button>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-text-secondary">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border-default bg-surface-subtle px-3 py-2 text-sm text-text-heading"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-text-secondary">Model</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border-default bg-surface-subtle px-3 py-2 text-sm text-text-heading"
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-text-secondary">System Prompt</span>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={8}
            className="mt-1 w-full rounded-lg border border-border-default bg-surface-subtle px-3 py-2 text-sm text-text-heading"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-text-secondary">Constraints</span>
          <textarea
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            rows={5}
            placeholder={"ALWAYS read existing code before modifying\nNEVER skip tests"}
            className="mt-1 w-full rounded-lg border border-border-default bg-surface-subtle px-3 py-2 text-sm text-text-heading placeholder:text-text-muted"
          />
          <span className="mt-0.5 block text-xs text-text-muted">One constraint per line</span>
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        type="button"
        className="w-full rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-white hover:bg-accent-emphasis disabled:opacity-50"
      >
        {saving ? "Saving\u2026" : "Save Configuration"}
      </button>
    </div>
  );
}
