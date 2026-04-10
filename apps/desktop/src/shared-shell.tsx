"use client";

import { Suspense, type ReactNode } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { usePathname } from "next/navigation";
import { ProgramActivityRoute as SharedProgramActivityRoute } from "@foundry/ui/activity";
import { ProgramAuditRoute as SharedProgramAuditRoute } from "@foundry/ui/audit";
import {
  ProgramDiscoveryRoute as SharedProgramDiscoveryRoute,
  ProgramDocumentsRoute as SharedProgramDocumentsRoute,
  ProgramDocumentUploadRoute as SharedProgramDocumentUploadRoute,
} from "@foundry/ui/discovery";
import {
  ProgramGateDetailRoute as SharedProgramGateDetailRoute,
  ProgramGateNewRoute as SharedProgramGateNewRoute,
  ProgramGatesRoute as SharedProgramGatesRoute,
} from "@foundry/ui/gates";
import {
  ProgramIntegrationDetailRoute as SharedProgramIntegrationDetailRoute,
  ProgramIntegrationNewRoute as SharedProgramIntegrationNewRoute,
  ProgramIntegrationsRoute as SharedProgramIntegrationsRoute,
} from "@foundry/ui/integrations";
import { ProgramOverviewRoute as SharedProgramOverviewRoute } from "@foundry/ui/overview";
import { ProgramPatternsRoute as SharedProgramPatternsRoute } from "@foundry/ui/patterns";
import { ProgramPipelineLabRoute as SharedProgramPipelineLabRoute } from "@foundry/ui/pipeline-lab";
import {
  ProgramPlaybookDetailRoute as SharedProgramPlaybookDetailRoute,
  ProgramPlaybookNewRoute as SharedProgramPlaybookNewRoute,
  ProgramPlaybooksRoute as SharedProgramPlaybooksRoute,
} from "@foundry/ui/playbooks";
import { ProgramProvider, useProgramContext } from "@foundry/ui/programs";
import {
  ProgramRiskDetailRoute as SharedProgramRiskDetailRoute,
  ProgramRiskNewRoute as SharedProgramRiskNewRoute,
  ProgramRisksRoute as SharedProgramRisksRoute,
} from "@foundry/ui/risks";
import {
  ProgramSkillDetailRoute as SharedProgramSkillDetailRoute,
  ProgramSkillNewRoute as SharedProgramSkillNewRoute,
  ProgramSkillsRoute as SharedProgramSkillsRoute,
} from "@foundry/ui/skills";
import {
  ProgramSprintDetailRoute as SharedProgramSprintDetailRoute,
  ProgramSprintsRoute as SharedProgramSprintsRoute,
} from "@foundry/ui/sprints";
import {
  ProgramSettingsRoute as SharedProgramSettingsRoute,
} from "@foundry/ui/settings";
import {
  ProgramTaskDetailRoute as SharedProgramTaskDetailRoute,
  ProgramTaskNewRoute as SharedProgramTaskNewRoute,
} from "@foundry/ui/tasks";
import {
  ProgramWorkstreamDetailRoute as SharedProgramWorkstreamDetailRoute,
} from "@foundry/ui/workstreams";
import {
  ProgramVideoDetailRoute as SharedProgramVideoDetailRoute,
  ProgramVideoUploadRoute as SharedProgramVideoUploadRoute,
  ProgramVideosRoute as SharedProgramVideosRoute,
} from "@foundry/ui/videos";

export { Header, SearchProvider, Sidebar } from "@foundry/ui/dashboard-shell";
export { ProgramsPage } from "@foundry/ui/programs";
export { ProgramTasksRoute } from "@foundry/ui/tasks";
export { ProgramWorkstreamsRoute } from "@foundry/ui/workstreams";

const KNOWN_ROOTS = new Set(["programs", "sandboxes", "sign-in", "sign-up"]);

function getProgramSlugFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const candidate = segments[0];
  if (!candidate || KNOWN_ROOTS.has(candidate)) {
    return null;
  }
  return candidate;
}

function TaskRouteFallback({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="card rounded-xl p-8">
      <h1 className="type-display-m text-text-heading">{title}</h1>
      <p className="mt-2 text-sm text-text-secondary">{message}</p>
    </div>
  );
}

export function ProgramTaskDetailRoute() {
  return (
    <ProgramScopedRoute title="Task" messageNoun="task details">
      <SharedProgramTaskDetailRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramOverviewRoute() {
  return (
    <ProgramScopedRoute title="Program" messageNoun="program overview">
      <SharedProgramOverviewRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramMissionControlRoute() {
  return (
    <ProgramScopedRoute title="Mission Control" messageNoun="mission control">
      <SharedProgramOverviewRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramDiscoveryRoute() {
  return (
    <ProgramScopedRoute title="Discovery" messageNoun="discovery">
      <SharedProgramDiscoveryRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramDocumentsRoute() {
  return (
    <ProgramScopedRoute title="Documents" messageNoun="documents">
      <SharedProgramDocumentsRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramDocumentUploadRoute() {
  return (
    <ProgramScopedRoute title="Document Upload" messageNoun="document upload form">
      <SharedProgramDocumentUploadRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramWorkstreamDetailRoute() {
  return (
    <ProgramScopedRoute title="Workstream" messageNoun="workstream details">
      <SharedProgramWorkstreamDetailRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramTaskNewRoute() {
  return (
    <ProgramScopedRoute title="New Task" messageNoun="task creation form">
      <SharedProgramTaskNewRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramVideosRoute() {
  return (
    <ProgramScopedRoute title="Videos" messageNoun="videos">
      <SharedProgramVideosRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramVideoUploadRoute() {
  return (
    <ProgramScopedRoute title="Video Upload" messageNoun="video upload form">
      <SharedProgramVideoUploadRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramVideoDetailRoute() {
  return (
    <ProgramScopedRoute title="Video Analysis" messageNoun="video analysis details">
      <SharedProgramVideoDetailRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramSprintsRoute() {
  return (
    <ProgramScopedRoute title="Sprints" messageNoun="sprints">
      <SharedProgramSprintsRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramSprintDetailRoute() {
  return (
    <ProgramScopedRoute title="Sprint" messageNoun="sprint details">
      <SharedProgramSprintDetailRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramSkillsRoute() {
  return (
    <ProgramScopedRoute title="Skills" messageNoun="skills">
      <SharedProgramSkillsRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramSkillNewRoute() {
  return (
    <ProgramScopedRoute title="New Skill" messageNoun="skill creation form">
      <SharedProgramSkillNewRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramSkillDetailRoute() {
  return (
    <ProgramScopedRoute title="Skill" messageNoun="skill details">
      <SharedProgramSkillDetailRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramRisksRoute() {
  return (
    <ProgramScopedRoute title="Risks" messageNoun="risks">
      <SharedProgramRisksRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramRiskNewRoute() {
  return (
    <ProgramScopedRoute title="New Risk" messageNoun="risk creation form">
      <SharedProgramRiskNewRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramRiskDetailRoute() {
  return (
    <ProgramScopedRoute title="Risk" messageNoun="risk details">
      <SharedProgramRiskDetailRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramGatesRoute() {
  return (
    <ProgramScopedRoute title="Gates" messageNoun="gates">
      <SharedProgramGatesRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramGateNewRoute() {
  return (
    <ProgramScopedRoute title="New Gate" messageNoun="gate creation form">
      <SharedProgramGateNewRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramGateDetailRoute() {
  return (
    <ProgramScopedRoute title="Gate" messageNoun="gate details">
      <SharedProgramGateDetailRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramIntegrationsRoute() {
  return (
    <ProgramScopedRoute title="Integrations" messageNoun="integrations">
      <SharedProgramIntegrationsRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramIntegrationNewRoute() {
  return (
    <ProgramScopedRoute title="New Integration" messageNoun="integration setup form">
      <SharedProgramIntegrationNewRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramIntegrationDetailRoute() {
  return (
    <ProgramScopedRoute title="Integration" messageNoun="integration details">
      <SharedProgramIntegrationDetailRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramPlaybooksRoute() {
  return (
    <ProgramScopedRoute title="Playbooks" messageNoun="playbooks">
      <SharedProgramPlaybooksRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramPlaybookNewRoute() {
  return (
    <ProgramScopedRoute title="New Playbook" messageNoun="playbook creation form">
      <SharedProgramPlaybookNewRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramPlaybookDetailRoute() {
  return (
    <ProgramScopedRoute title="Playbook" messageNoun="playbook details">
      <SharedProgramPlaybookDetailRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramPatternsRoute() {
  return <SharedProgramPatternsRoute />;
}

export function ProgramPipelineLabRoute() {
  return <SharedProgramPipelineLabRoute />;
}

export function ProgramActivityRoute() {
  return (
    <ProgramScopedRoute title="Activity" messageNoun="activity logs">
      <SharedProgramActivityRoute />
    </ProgramScopedRoute>
  );
}

export function ProgramAuditRoute() {
  return (
    <ProgramScopedRoute title="Audit" messageNoun="audit logs">
      <SharedProgramAuditRoute useProgramContext={useProgramContext} />
    </ProgramScopedRoute>
  );
}

export function ProgramSettingsRoute() {
  return (
    <ProgramScopedRoute title="Settings" messageNoun="program settings">
      <SharedProgramSettingsRoute />
    </ProgramScopedRoute>
  );
}

function ProgramScopedRoute({
  title,
  messageNoun,
  children,
}: {
  title: string;
  messageNoun: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const programSlug = getProgramSlugFromPath(pathname);
  const { isAuthenticated } = useConvexAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;

  if (!isAuthenticated) {
    return (
      <TaskRouteFallback
        title={title}
        message={`Sign in to load ${messageNoun}.`}
      />
    );
  }

  if (!orgId) {
    return (
      <TaskRouteFallback
        title={title}
        message={`Select an organization to load ${messageNoun}.`}
      />
    );
  }

  if (!programSlug) {
    return (
      <TaskRouteFallback
        title={title}
        message={`Select a program to load ${messageNoun}.`}
      />
    );
  }

  return (
    <ProgramProvider slug={programSlug}>
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          </div>
        }
      >
        {children}
      </Suspense>
    </ProgramProvider>
  );
}
