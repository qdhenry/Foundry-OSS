import {
  Activity,
  AlertTriangle,
  BarChart01,
  BookOpen01,
  BracketsCheck,
  CheckSquare,
  Clock,
  ClockRewind,
  Compass01,
  Dataflow03,
  FileCheck02,
  GitBranch01,
  Grid01,
  HelpCircle,
  LayersThree01,
  Link01,
  List,
  Palette,
  Server01,
  Settings01,
  Shield01,
  Tool01,
} from "@untitledui/icons";
import type { FC, SVGProps } from "react";

export interface NavItem {
  label: string;
  href: string;
  icon: FC<SVGProps<SVGSVGElement> & { size?: number }>;
  badge?: number;
  readiness?: "ready" | "active" | "empty";
  badgeLabel?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface NavigationState {
  discoveryPending: number;
  requirementsTotal: number;
  requirementsUnassigned: number;
  workstreamsCount: number;
  sprintsActive: number;
  sprintsPlanning: number;
  tasksTotal: number;
  tasksInProgress: number;
  skillsCount: number;
  risksCount: number;
  gatesCount: number;
  designAssetsTotal: number;
}

function readiness(count: number, hasActive?: boolean): "ready" | "active" | "empty" {
  if (hasActive) return "active";
  return count > 0 ? "ready" : "empty";
}

export function getNavigation(programId: string | null, state: NavigationState): NavSection[] {
  return [
    {
      title: "Main",
      items: [
        { label: "Programs", href: "/programs", icon: Grid01 },
        ...(programId
          ? [
              {
                label: "Mission Control",
                href: `/${programId}`,
                icon: Compass01,
                readiness: "ready" as const,
              },
            ]
          : [{ label: "Mission Control", href: "#", icon: Compass01 }]),
      ],
    },
    {
      title: "Plan",
      items: programId
        ? [
            {
              label: "Discovery",
              href: `/${programId}/discovery`,
              icon: List,
              badge: state.discoveryPending > 0 ? state.discoveryPending : undefined,
              readiness: readiness(state.discoveryPending, state.discoveryPending > 0),
              badgeLabel:
                state.discoveryPending > 0 ? `${state.discoveryPending} pending` : undefined,
            },
            {
              label: "Requirements",
              href: `/${programId}/requirements`,
              icon: FileCheck02,
              readiness: readiness(state.requirementsTotal),
              badgeLabel: state.requirementsTotal > 0 ? `${state.requirementsTotal}` : undefined,
            },
            {
              label: "Workstreams",
              href: `/${programId}/workstreams`,
              icon: LayersThree01,
              readiness: readiness(state.workstreamsCount),
              badgeLabel: state.workstreamsCount > 0 ? `${state.workstreamsCount}` : undefined,
            },
          ]
        : [
            { label: "Discovery", href: "#", icon: List, readiness: "empty" as const },
            { label: "Requirements", href: "#", icon: FileCheck02, readiness: "empty" as const },
            { label: "Workstreams", href: "#", icon: LayersThree01, readiness: "empty" as const },
          ],
    },
    {
      title: "Design",
      items: programId
        ? [
            {
              label: "Design System",
              href: `/${programId}/design`,
              icon: Palette,
              readiness: readiness(state.designAssetsTotal),
              badgeLabel: state.designAssetsTotal > 0 ? `${state.designAssetsTotal}` : undefined,
            },
          ]
        : [],
    },
    {
      title: "Build",
      items: programId
        ? [
            {
              label: "Agents",
              href: `/${programId}/agents`,
              icon: Server01,
            },
            {
              label: "Orchestration",
              href: `/${programId}/orchestration`,
              icon: Dataflow03,
            },
            {
              label: "Sprints",
              href: `/${programId}/sprints`,
              icon: Clock,
              readiness: readiness(
                state.sprintsActive + state.sprintsPlanning,
                state.sprintsActive > 0,
              ),
              badgeLabel: state.sprintsActive > 0 ? `${state.sprintsActive} active` : undefined,
            },
            {
              label: "Tasks",
              href: `/${programId}/tasks`,
              icon: CheckSquare,
              readiness: readiness(state.tasksTotal, state.tasksInProgress > 0),
              badgeLabel: state.tasksTotal > 0 ? `${state.tasksTotal}` : undefined,
            },
            {
              label: "Analysis",
              href: `/${programId}/analysis`,
              icon: BarChart01,
            },
          ]
        : [
            { label: "Agents", href: "#", icon: Server01, readiness: "empty" as const },
            { label: "Orchestration", href: "#", icon: Dataflow03, readiness: "empty" as const },
            { label: "Sprints", href: "#", icon: Clock, readiness: "empty" as const },
            { label: "Tasks", href: "#", icon: CheckSquare, readiness: "empty" as const },
            { label: "Analysis", href: "#", icon: BarChart01, readiness: "empty" as const },
          ],
    },
    {
      title: "Knowledge",
      items: programId
        ? [
            {
              label: "Skills",
              href: `/${programId}/skills`,
              icon: BookOpen01,
              readiness: readiness(state.skillsCount),
              badgeLabel: state.skillsCount > 0 ? `${state.skillsCount}` : undefined,
            },
            {
              label: "Risks",
              href: `/${programId}/risks`,
              icon: AlertTriangle,
              readiness: readiness(state.risksCount),
              badgeLabel: state.risksCount > 0 ? `${state.risksCount}` : undefined,
            },
            {
              label: "Gates",
              href: `/${programId}/gates`,
              icon: Shield01,
              readiness: readiness(state.gatesCount),
              badgeLabel: state.gatesCount > 0 ? `${state.gatesCount}` : undefined,
            },
            {
              label: "Integrations",
              href: `/${programId}/integrations`,
              icon: Link01,
            },
            {
              label: "Playbooks",
              href: `/${programId}/playbooks`,
              icon: FileCheck02,
            },
            {
              label: "Patterns",
              href: `/${programId}/patterns`,
              icon: BracketsCheck,
            },
          ]
        : [
            { label: "Skills", href: "#", icon: BookOpen01, readiness: "empty" as const },
            { label: "Risks", href: "#", icon: AlertTriangle, readiness: "empty" as const },
            { label: "Gates", href: "#", icon: Shield01, readiness: "empty" as const },
            { label: "Integrations", href: "#", icon: Link01, readiness: "empty" as const },
            { label: "Playbooks", href: "#", icon: FileCheck02, readiness: "empty" as const },
            { label: "Patterns", href: "#", icon: BracketsCheck, readiness: "empty" as const },
          ],
    },
    {
      title: "Utilities",
      items: programId
        ? [
            {
              label: "Code Analyzer",
              href: `/${programId}/utilities/code-analyzer`,
              icon: Tool01,
            },
            {
              label: "Help",
              href: "#",
              icon: HelpCircle,
            },
          ]
        : [
            { label: "Code Analyzer", href: "#", icon: Tool01 },
            { label: "Help", href: "#", icon: HelpCircle },
          ],
    },
    {
      title: "Activity",
      items: programId
        ? [
            {
              label: "AI Traces",
              href: `/${programId}/traces`,
              icon: BarChart01,
            },
            {
              label: "Agent Log",
              href: `/${programId}/activity`,
              icon: Activity,
            },
            {
              label: "Audit Log",
              href: `/${programId}/audit`,
              icon: ClockRewind,
            },
            {
              label: "Repositories",
              href: `/${programId}/settings/repositories`,
              icon: GitBranch01,
            },
            {
              label: "Settings",
              href: `/${programId}/settings`,
              icon: Settings01,
            },
            {
              label: "Sandbox Settings",
              href: "/sandboxes/settings",
              icon: Server01,
            },
          ]
        : [
            { label: "Agent Log", href: "#", icon: Activity },
            { label: "Audit Log", href: "#", icon: ClockRewind },
            { label: "Manage Sandboxes", href: "/sandboxes", icon: Server01 },
          ],
    },
  ];
}
