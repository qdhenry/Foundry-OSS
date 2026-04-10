import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequirementPipelinePanel } from "./RequirementPipelinePanel";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../programs", () => ({
  useProgramContext: () => ({ slug: "test-prog" }),
}));

let queryReturn: any;
vi.mock("convex/react", () => ({
  useQuery: () => queryReturn,
}));

vi.mock("./PipelineStepper", () => ({
  PipelineStepper: () => <div data-testid="stepper">Stepper</div>,
}));

vi.mock("./PipelineStageContent", () => ({
  PipelineStageContent: () => <div data-testid="stage-content">StageContent</div>,
}));

vi.mock("./PipelineActivityLog", () => ({
  PipelineActivityLog: () => <div data-testid="activity-log">ActivityLog</div>,
}));

const baseProps = {
  requirementId: "req-1",
  programId: "prog-1",
  workstreamId: "ws-1",
  onClose: vi.fn(),
};

describe("RequirementPipelinePanel", () => {
  it("shows loading spinner when requirement is undefined", () => {
    queryReturn = undefined;
    const { container } = render(<RequirementPipelinePanel {...baseProps} />);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("returns null when requirement is null", () => {
    queryReturn = null;
    const { container } = render(<RequirementPipelinePanel {...baseProps} />);
    // Panel should not render any visible content (just overlay/null)
    expect(container.querySelector("[data-testid='stepper']")).toBeNull();
  });
});
