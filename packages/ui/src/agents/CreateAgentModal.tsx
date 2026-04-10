"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { value: "architect", label: "Architect" },
  { value: "backend_engineer", label: "Backend Engineer" },
  { value: "frontend_engineer", label: "Frontend Engineer" },
  { value: "fullstack_engineer", label: "Fullstack Engineer" },
  { value: "qa_engineer", label: "QA Engineer" },
  { value: "devops", label: "DevOps" },
  { value: "reviewer", label: "Reviewer" },
  { value: "project_manager", label: "Project Manager" },
  { value: "integration_specialist", label: "Integration Specialist" },
  { value: "orchestrator", label: "Orchestrator" },
] as const;

const MODEL_OPTIONS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5 v2" },
  { value: "claude-sonnet-4-5-20250514", label: "Claude Sonnet 4.5" },
] as const;

export function CreateAgentModal({
  programId,
  orgId,
  onClose,
}: {
  programId: string;
  orgId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState("fullstack_engineer");
  const [model, setModel] = useState("claude-sonnet-4-5-20250929");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [constraints, setConstraints] = useState("");
  const [specializations, setSpecializations] = useState("");
  const [saving, setSaving] = useState(false);

  const createAgent = useMutation("agentTeam/agents:create" as any);

  async function handleSave() {
    setSaving(true);
    try {
      await createAgent({
        orgId,
        programId: programId as any,
        name,
        description,
        role,
        model,
        tools: ["read", "write", "edit", "bash", "grep", "glob"],
        systemPrompt,
        constraints: constraints.split("\n").filter(Boolean),
        specializations: specializations
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        avatarSeed: name,
        skillIds: [],
        tokenBudget: { perExecution: 12000, perDay: 150000 },
      });
      toast.success("Agent created");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create agent");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-border-default bg-surface-subtle px-3 py-2 text-sm text-text-heading";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border-default bg-surface-default p-5">
        <h3 className="text-lg font-semibold text-text-heading">Create Agent</h3>

        <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          <label className="block">
            <span className="text-xs font-medium text-text-secondary">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Frontend Builder"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-text-secondary">Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this agent does"
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-text-secondary">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-text-secondary">Model</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={inputClass}
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-text-secondary">System Prompt</span>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              placeholder="Instructions for the agent"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-text-secondary">Constraints</span>
            <textarea
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              rows={3}
              placeholder={"ALWAYS read existing code before modifying\nNEVER skip tests"}
              className={`${inputClass} placeholder:text-text-muted`}
            />
            <span className="mt-0.5 block text-xs text-text-muted">One per line</span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-text-secondary">Specializations</span>
            <input
              value={specializations}
              onChange={(e) => setSpecializations(e.target.value)}
              placeholder="React, TypeScript, testing"
              className={inputClass}
            />
            <span className="mt-0.5 block text-xs text-text-muted">Comma-separated</span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-white hover:bg-accent-emphasis disabled:opacity-50"
            onClick={handleSave}
            disabled={saving || !name.trim() || !description.trim()}
            type="button"
          >
            {saving ? "Creating\u2026" : "Create Agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
