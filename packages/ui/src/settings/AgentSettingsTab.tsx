"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ModelOption = "claude-opus-4-6" | "claude-sonnet-4-5-20250929" | "claude-sonnet-4-5-20250514";

const MODEL_LABELS: Record<ModelOption, string> = {
  "claude-opus-4-6": "Claude Opus 4.6 (Flagship)",
  "claude-sonnet-4-5-20250929": "Claude Sonnet 4.5 v2 (Balanced)",
  "claude-sonnet-4-5-20250514": "Claude Sonnet 4.5 (Fast)",
};

export function AgentSettingsTab() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const settings = useQuery("agentTeam/settings:get" as any, orgId ? { orgId } : "skip");
  const upsert = useMutation("agentTeam/settings:upsert" as any);

  const [monthlyTokenBudget, setMonthlyTokenBudget] = useState<number>(1_000_000);
  const [maxConcurrentSandboxes, setMaxConcurrentSandboxes] = useState<number>(4);
  const [defaultModel, setDefaultModel] = useState<ModelOption>("claude-sonnet-4-5-20250929");
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWebhook, setNotifWebhook] = useState(false);
  const [notifInApp, setNotifInApp] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setMonthlyTokenBudget(settings.monthlyTokenBudget ?? 1_000_000);
    setMaxConcurrentSandboxes(settings.maxConcurrentSandboxes ?? 4);
    setDefaultModel(settings.defaultModel ?? "claude-sonnet-4-5-20250929");
    setNotifEmail(settings.notificationPreferences?.email ?? true);
    setNotifWebhook(settings.notificationPreferences?.webhook ?? false);
    setNotifInApp(settings.notificationPreferences?.inApp ?? true);
  }, [settings]);

  async function save() {
    if (!orgId) return;
    setSaving(true);
    try {
      await upsert({
        orgId,
        monthlyTokenBudget,
        maxConcurrentSandboxes,
        defaultModel,
        notificationPreferences: {
          email: notifEmail,
          webhook: notifWebhook,
          inApp: notifInApp,
        },
      });
      toast.success("Agent settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-text-heading">Agent Team Settings</h3>

      <div className="rounded-xl border border-border-default p-4 space-y-3">
        <h4 className="text-lg font-semibold text-text-heading">Budgets & Limits</h4>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Monthly token budget</label>
          <input
            type="number"
            value={monthlyTokenBudget}
            onChange={(e) => setMonthlyTokenBudget(Number(e.target.value))}
            className="w-full rounded-md border border-border-default bg-surface-subtle px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Max concurrent sandboxes</label>
          <input
            type="number"
            value={maxConcurrentSandboxes}
            onChange={(e) => setMaxConcurrentSandboxes(Number(e.target.value))}
            min={1}
            max={20}
            className="w-full rounded-md border border-border-default bg-surface-subtle px-3 py-2"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border-default p-4 space-y-3">
        <h4 className="text-lg font-semibold text-text-heading">Defaults & Notifications</h4>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Default model</label>
          <select
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value as ModelOption)}
            className="w-full rounded-md border border-border-default bg-surface-subtle px-3 py-2"
          >
            {(Object.entries(MODEL_LABELS) as [ModelOption, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <span className="block text-sm text-text-secondary">Notification preferences</span>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={notifEmail}
              onChange={(e) => setNotifEmail(e.target.checked)}
            />
            Email
          </label>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={notifWebhook}
              onChange={(e) => setNotifWebhook(e.target.checked)}
            />
            Webhook
          </label>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={notifInApp}
              onChange={(e) => setNotifInApp(e.target.checked)}
            />
            In-App
          </label>
        </div>
      </div>

      <button
        type="button"
        className="btn-primary btn-sm mt-4"
        onClick={save}
        disabled={!orgId || saving}
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
