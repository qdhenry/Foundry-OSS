"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { OrchestrationWizard } from "../orchestration/OrchestrationWizard";
import { AgentDrawer } from "./AgentDrawer";
import { type AgentRow, AgentTable } from "./AgentTable";
import { CreateAgentModal } from "./CreateAgentModal";
import { DispatchAgentModal } from "./DispatchAgentModal";
import { GenerateWizard } from "./GenerateWizard";

export function AgentsPage({ programId }: { programId: string }) {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const router = useRouter();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showOrchWizard, setShowOrchWizard] = useState(false);
  const [dispatchAgentId, setDispatchAgentId] = useState<string | null>(null);

  const agents = useQuery("agentTeam/agents:listByProgram" as any, {
    programId: programId as any,
  });

  const executions = useQuery("agentTeam/executions:listByProgram" as any, {
    programId: programId as any,
  });

  const repos = useQuery("sourceControl/repositories:listByProgram" as any, {
    programId: programId as any,
  });

  const archiveAgent = useMutation("agentTeam/agents:archive" as any);

  const agentRows: AgentRow[] = useMemo(() => {
    if (!agents || !executions) return [];
    return agents.map((agent: any) => {
      const agentExecs = executions.filter((e: any) => e.agentId === agent._id);
      const completed = agentExecs.filter((e: any) => e.status === "success").length;
      const finalized = agentExecs.filter(
        (e: any) => e.status === "success" || e.status === "failed",
      ).length;
      const successRate = finalized > 0 ? Math.round((completed / finalized) * 100) : 0;
      const latest =
        agentExecs.length > 0
          ? agentExecs.sort((a: any, b: any) => (b._creationTime ?? 0) - (a._creationTime ?? 0))[0]
          : null;
      const latestActivity = latest?.outputSummary || latest?.inputSummary || "";
      return {
        _id: agent._id,
        name: agent.name,
        role: agent.role,
        model: agent.model,
        status: agent.status,
        avatarSeed: agent.avatarSeed ?? agent.name,
        specializations: agent.specializations ?? [],
        tasksCompleted: completed,
        successRate,
        latestActivity,
      };
    });
  }, [agents, executions]);

  function handleArchive(agentId: string) {
    archiveAgent({ agentId: agentId as any })
      .then(() => toast.success("Agent archived"))
      .catch(() => toast.error("Failed to archive agent"));
  }

  function handleDispatch(agentId: string) {
    setDispatchAgentId(agentId);
  }

  const loading = agents === undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-text-heading">Agent Team</h1>
          <p className="text-sm text-text-secondary">Manage AI delivery agents for this program.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setShowCreate(true)}
          >
            Create agent
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => setShowOrchWizard(true)}
          >
            Start Orchestration
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={() => setShowWizard(true)}>
            Generate team
          </button>
        </div>
      </div>

      {repos !== undefined && repos.length === 0 && (
        <div className="rounded-lg border border-status-warning-border bg-status-warning-bg px-4 py-3 text-sm text-status-warning-fg">
          No repositories connected. Connect a repository in Settings to enable agent execution.
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="h-14 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="h-14 animate-pulse rounded-lg bg-surface-elevated" />
          <div className="h-14 animate-pulse rounded-lg bg-surface-elevated" />
        </div>
      )}

      {!loading && (
        <AgentTable
          agents={agentRows}
          onSelect={(agentId) => setSelectedAgentId(agentId)}
          onDispatch={handleDispatch}
          onArchive={handleArchive}
        />
      )}

      {selectedAgentId && (
        <AgentDrawer agentId={selectedAgentId} onClose={() => setSelectedAgentId(null)} />
      )}
      {showWizard && orgId && (
        <GenerateWizard
          orgId={orgId}
          programId={programId}
          onClose={() => setShowWizard(false)}
          onComplete={() => setShowWizard(false)}
        />
      )}
      {showCreate && orgId && (
        <CreateAgentModal
          programId={programId}
          orgId={orgId}
          onClose={() => setShowCreate(false)}
        />
      )}
      {showOrchWizard && orgId && (
        <OrchestrationWizard
          orgId={orgId}
          programId={programId}
          onClose={() => setShowOrchWizard(false)}
          onComplete={(orchRunId) => {
            setShowOrchWizard(false);
            router.push(`/${programId}/orchestration/${orchRunId}`);
          }}
        />
      )}
      {dispatchAgentId &&
        orgId &&
        (() => {
          const agentData = agents?.find((a: any) => a._id === dispatchAgentId);
          if (!agentData) return null;
          return (
            <DispatchAgentModal
              agent={{
                _id: agentData._id,
                name: agentData.name,
                role: agentData.role,
                avatarSeed: agentData.avatarSeed ?? agentData.name,
                model: agentData.model,
              }}
              programId={programId}
              orgId={orgId}
              onClose={() => setDispatchAgentId(null)}
            />
          );
        })()}
    </div>
  );
}
