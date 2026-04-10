import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineEmptyState } from "./PipelineEmptyState";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/programContext", () => ({
  useProgramContext: () => ({ slug: "test-program" }),
}));

describe("PipelineEmptyState", () => {
  it("renders heading", () => {
    render(<PipelineEmptyState programId="prog-1" onCreateRequirement={vi.fn()} />);
    expect(screen.getByText("No Requirements in This Pipeline")).toBeInTheDocument();
  });

  it("renders pipeline illustration with aria label", () => {
    render(<PipelineEmptyState programId="prog-1" onCreateRequirement={vi.fn()} />);
    expect(
      screen.getByRole("img", { name: "Pipeline stages: Discovery through Review" }),
    ).toBeInTheDocument();
  });

  it("renders explanation text", () => {
    render(<PipelineEmptyState programId="prog-1" onCreateRequirement={vi.fn()} />);
    expect(
      screen.getByText(/This pipeline tracks each requirement from initial discovery/),
    ).toBeInTheDocument();
  });

  it("links to discovery page using program slug", () => {
    render(<PipelineEmptyState programId="prog-1" onCreateRequirement={vi.fn()} />);
    const link = screen.getByText("Upload a Document in Discovery Hub");
    expect(link).toHaveAttribute("href", "/test-program/discovery?section=documents");
  });

  it("calls onCreateRequirement when button clicked", async () => {
    const onCreateRequirement = vi.fn();
    const user = userEvent.setup();
    render(<PipelineEmptyState programId="prog-1" onCreateRequirement={onCreateRequirement} />);
    await user.click(screen.getByText("Create a Requirement Manually"));
    expect(onCreateRequirement).toHaveBeenCalledOnce();
  });
});
