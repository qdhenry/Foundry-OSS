import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecentlyImportedTable } from "./RecentlyImportedTable";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/programContext", () => ({
  useProgramContext: () => ({ slug: "test-program" }),
}));

vi.mock("../../../convex/shared/pipelineStage", () => ({
  PIPELINE_STAGES: [
    "discovery",
    "requirement",
    "sprint_planning",
    "task_generation",
    "subtask_generation",
    "implementation",
    "testing",
    "review",
  ],
  PIPELINE_STAGE_ORDER: {
    discovery: 0,
    requirement: 1,
    sprint_planning: 2,
    task_generation: 3,
    subtask_generation: 4,
    implementation: 5,
    testing: 6,
    review: 7,
  },
  PIPELINE_STAGE_CONFIG: {
    discovery: { label: "Discovery", shortLabel: "Disc.", order: 0 },
    requirement: { label: "Requirement", shortLabel: "Req", order: 1 },
    sprint_planning: { label: "Sprint Planning", shortLabel: "Sprint", order: 2 },
    task_generation: { label: "Task Generation", shortLabel: "Tasks", order: 3 },
    subtask_generation: { label: "Subtask Generation", shortLabel: "Subtasks", order: 4 },
    implementation: { label: "Implementation", shortLabel: "Impl", order: 5 },
    testing: { label: "Testing", shortLabel: "Test", order: 6 },
    review: { label: "Review", shortLabel: "Rev", order: 7 },
  },
}));

describe("RecentlyImportedTable", () => {
  const workstreams = [{ _id: "ws-1", name: "Commerce" }];

  it("renders loading skeleton when data is undefined", () => {
    const { container } = render(
      <RecentlyImportedTable programId="prog-1" data={undefined} workstreams={workstreams} />,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders empty message when no items", () => {
    render(
      <RecentlyImportedTable programId="prog-1" data={{ items: [] }} workstreams={workstreams} />,
    );
    expect(
      screen.getByText(/No requirements have been imported from discovery findings yet/),
    ).toBeInTheDocument();
  });

  it("renders table with item data", () => {
    const data = {
      items: [
        {
          _id: "req-1",
          refId: "REQ-001",
          title: "Product Catalog",
          pipelineStage: "requirement",
          workstreamId: "ws-1",
          workstreamName: "Commerce",
          sourceDocumentName: "spec.pdf",
          importedAt: Date.now(),
        },
      ],
    };
    render(<RecentlyImportedTable programId="prog-1" data={data} workstreams={workstreams} />);
    expect(screen.getByText("Recently Imported (1)")).toBeInTheDocument();
    expect(screen.getByText("REQ-001")).toBeInTheDocument();
    expect(screen.getByText("Product Catalog")).toBeInTheDocument();
    expect(screen.getByText("Requirement")).toBeInTheDocument();
    expect(screen.getByText("Commerce")).toBeInTheDocument();
    expect(screen.getByText("spec.pdf")).toBeInTheDocument();
  });

  it("shows View All Workstreams link when workstreams exist", () => {
    const data = {
      items: [
        {
          _id: "req-1",
          refId: "REQ-001",
          title: "Test",
          pipelineStage: "discovery",
          sourceDocumentName: "doc.pdf",
          importedAt: Date.now(),
        },
      ],
    };
    render(<RecentlyImportedTable programId="prog-1" data={data} workstreams={workstreams} />);
    expect(screen.getByText("View All Workstreams")).toBeInTheDocument();
  });
});
