import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineEmptyState } from "./PipelineEmptyState";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../programs", () => ({
  useProgramContext: () => ({ slug: "test-program" }),
}));

describe("PipelineEmptyState", () => {
  it("renders heading and description", () => {
    render(<PipelineEmptyState programId="prog-1" onCreateRequirement={vi.fn()} />);
    expect(screen.getByText("No Requirements in This Pipeline")).toBeInTheDocument();
    expect(screen.getByText(/tracks each requirement/)).toBeInTheDocument();
  });

  it("renders discovery hub link with correct href", () => {
    render(<PipelineEmptyState programId="prog-1" onCreateRequirement={vi.fn()} />);
    const link = screen.getByText("Upload a Document in Discovery Hub");
    expect(link).toHaveAttribute("href", "/test-program/discovery?section=documents");
  });

  it("renders create requirement button", () => {
    const onCreateRequirement = vi.fn();
    render(<PipelineEmptyState programId="prog-1" onCreateRequirement={onCreateRequirement} />);
    const button = screen.getByText("Create a Requirement Manually");
    button.click();
    expect(onCreateRequirement).toHaveBeenCalledOnce();
  });

  it("renders pipeline SVG illustration", () => {
    render(<PipelineEmptyState programId="prog-1" onCreateRequirement={vi.fn()} />);
    const svg = screen.getByRole("img", { name: /Pipeline stages/i });
    expect(svg).toBeInTheDocument();
  });
});
