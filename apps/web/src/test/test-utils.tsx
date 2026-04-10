import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";

// ── Mock Program Data ──────────────────────────────────────────────

export const mockProgram = {
  _id: "prog-1" as Id<"programs">,
  _creationTime: Date.now(),
  orgId: "org_test",
  name: "AcmeCorp Migration",
  clientName: "AcmeCorp",
  sourcePlatform: "magento" as const,
  targetPlatform: "salesforce_b2b" as const,
  phase: "build" as const,
  status: "active" as const,
  description: "Migration from Magento to Salesforce B2B Commerce",
  stats: {
    totalRequirements: 118,
    completedRequirements: 42,
    completionPercent: 36,
    workstreamCount: 7,
    riskCount: 5,
    agentExecutionCount: 12,
  },
};

export const mockProgramId = "prog-1" as Id<"programs">;

// ── Mock Factories ─────────────────────────────────────────────────

export function createMockWorkstream(overrides: Record<string, unknown> = {}) {
  return {
    _id: "ws-1" as Id<"workstreams">,
    _creationTime: Date.now(),
    name: "Product Data Migration",
    shortCode: "PDM",
    status: "on_track",
    currentSprint: 2,
    sprintCadence: 2,
    ...overrides,
  };
}

export function createMockRequirement(overrides: Record<string, unknown> = {}) {
  return {
    _id: "req-1",
    refId: "REQ-001",
    title: "Product catalog migration",
    priority: "must_have",
    status: "approved",
    fitGap: "native",
    workstreamId: "ws-1",
    ...overrides,
  };
}

export function createMockTask(overrides: Record<string, unknown> = {}) {
  return {
    _id: "task-1",
    title: "Implement product sync",
    priority: "high",
    status: "in_progress",
    workstreamId: "ws-1",
    ...overrides,
  };
}

export function createMockRisk(overrides: Record<string, unknown> = {}) {
  return {
    _id: "risk-1",
    title: "Data loss during migration",
    severity: "high",
    status: "open",
    ...overrides,
  };
}

export function createMockSkill(overrides: Record<string, unknown> = {}) {
  return {
    _id: "skill-1",
    name: "Product Sync Architect",
    domain: "architecture",
    targetPlatform: "salesforce_b2b",
    currentVersion: "1.0.0",
    status: "active",
    lineCount: 250,
    linkedRequirements: ["req-1"],
    ...overrides,
  };
}

export function createMockGate(overrides: Record<string, unknown> = {}) {
  return {
    _id: "gate-1",
    name: "Foundation Gate",
    gateType: "foundation",
    status: "pending",
    workstreamId: "ws-1",
    criteria: [
      { title: "Schema validated", passed: true },
      { title: "Data mapping complete", passed: false },
    ],
    ...overrides,
  };
}

export function createMockSprint(overrides: Record<string, unknown> = {}) {
  return {
    _id: "sprint-1",
    name: "Sprint 1",
    status: "active",
    workstreamId: "ws-1",
    startDate: Date.now(),
    endDate: Date.now() + 14 * 24 * 60 * 60 * 1000,
    goal: "Complete product data mapping",
    ...overrides,
  };
}

export function createMockPlaybook(overrides: Record<string, unknown> = {}) {
  return {
    _id: "playbook-1",
    name: "Catalog Migration Playbook",
    status: "published",
    targetPlatform: "salesforce_b2b",
    description: "Step-by-step guide for catalog migration",
    ...overrides,
  };
}

export function createMockIntegration(overrides: Record<string, unknown> = {}) {
  return {
    _id: "int-1",
    name: "ERP Sync",
    type: "api",
    status: "active",
    ...overrides,
  };
}

export function createMockExecution(overrides: Record<string, unknown> = {}) {
  return {
    _id: "exec-1",
    skillName: "Product Sync Architect",
    status: "completed",
    reviewStatus: "accepted",
    startedAt: Date.now() - 60_000,
    completedAt: Date.now(),
    ...overrides,
  };
}

export function createMockVideoAnalysis(overrides: Record<string, unknown> = {}) {
  return {
    _id: "va-1",
    title: "Discovery Call Recording",
    status: "complete",
    duration: 3600,
    ...overrides,
  };
}

// ── Mock Next.js Navigation ────────────────────────────────────────

export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

export const mockSearchParams = new URLSearchParams();

export function setupNextNavigation(params: Record<string, string> = { programId: "prog-1" }) {
  vi.mock("next/navigation", () => ({
    useRouter: () => mockRouter,
    useParams: () => params,
    usePathname: () => "/prog-1",
    useSearchParams: () => mockSearchParams,
  }));
}

// ── Mock useProgramContext ──────────────────────────────────────────

export function setupProgramContext(overrides: Record<string, unknown> = {}) {
  const program = { ...mockProgram, ...overrides };
  vi.mock("@/lib/programContext", () => ({
    useProgramContext: () => ({
      program,
      programId: program._id,
    }),
  }));
}

// ── Custom Render ──────────────────────────────────────────────────

function AllProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function renderPage(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export { act, render, screen, waitFor, within } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
