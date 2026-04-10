import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let mockRequirement: any;
let mockWorkstreams: any;
let mockAllRequirements: any;

vi.mock("convex/react", () => ({
  useQuery: (ref: any) => {
    if (ref?.toString?.().includes("requirements.get") || ref === "requirements:get")
      return mockRequirement;
    if (
      ref?.toString?.().includes("workstreams.listByProgram") ||
      ref === "workstreams:listByProgram"
    )
      return mockWorkstreams;
    if (
      ref?.toString?.().includes("requirements.listByProgram") ||
      ref === "requirements:listByProgram"
    )
      return mockAllRequirements;
    return undefined;
  },
  useMutation: () => vi.fn(),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    requirements: {
      get: "requirements:get",
      listByProgram: "requirements:listByProgram",
      update: "requirements:update",
      updateStatus: "requirements:updateStatus",
      linkDependency: "requirements:linkDependency",
      unlinkDependency: "requirements:unlinkDependency",
    },
    workstreams: { listByProgram: "workstreams:listByProgram" },
    evidence: { remove: "evidence:remove" },
  },
}));

vi.mock("../../../convex/_generated/dataModel", () => ({}));

vi.mock("@/components/ai-features", () => ({
  RequirementRefinementPanel: () => <div data-testid="refinement-panel" />,
  TaskDecompositionPanel: () => <div data-testid="decomposition-panel" />,
}));

vi.mock("../comments/CommentThread", () => ({
  CommentThread: () => <div data-testid="comment-thread" />,
}));

vi.mock("./EvidenceUpload", () => ({
  EvidenceUpload: () => <div data-testid="evidence-upload" />,
}));

import { RequirementDetailPanel } from "./RequirementDetailPanel";

describe("RequirementDetailPanel", () => {
  const defaultProps = {
    requirementId: "req-1",
    programId: "prog-1",
    orgId: "org-1",
    onClose: vi.fn(),
  };

  it("renders loading state when requirement is null", () => {
    mockRequirement = null;
    mockWorkstreams = [];
    mockAllRequirements = [];
    render(<RequirementDetailPanel {...defaultProps} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders requirement title and refId", () => {
    mockRequirement = {
      _id: "req-1",
      title: "Cart Migration",
      refId: "REQ-001",
      priority: "must_have",
      status: "draft",
      fitGap: "native",
      description: "Migrate cart data",
    };
    mockWorkstreams = [];
    mockAllRequirements = [];
    render(<RequirementDetailPanel {...defaultProps} />);
    expect(screen.getByText("Cart Migration")).toBeInTheDocument();
    expect(screen.getByText("REQ-001")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    mockRequirement = {
      _id: "req-1",
      title: "Test",
      refId: "REQ-001",
      priority: "must_have",
      status: "draft",
      fitGap: "native",
    };
    mockWorkstreams = [];
    mockAllRequirements = [];
    render(<RequirementDetailPanel {...defaultProps} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders priority and fit/gap selects", () => {
    mockRequirement = {
      _id: "req-1",
      title: "Test",
      refId: "REQ-001",
      priority: "must_have",
      status: "draft",
      fitGap: "native",
    };
    mockWorkstreams = [];
    mockAllRequirements = [];
    render(<RequirementDetailPanel {...defaultProps} />);
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Native")).toBeInTheDocument();
  });

  it("renders description text", () => {
    mockRequirement = {
      _id: "req-1",
      title: "Test",
      refId: "REQ-001",
      priority: "must_have",
      status: "draft",
      fitGap: "native",
      description: "Migrate all cart data to new platform",
    };
    mockWorkstreams = [];
    mockAllRequirements = [];
    render(<RequirementDetailPanel {...defaultProps} />);
    expect(screen.getByText("Migrate all cart data to new platform")).toBeInTheDocument();
  });
});
