import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExecuteSkillModal } from "./ExecuteSkillModal";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({
    organization: { id: "org-1" },
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [
    { _id: "skill-1", name: "Code Review", domain: "engineering" },
    { _id: "skill-2", name: "Gap Analysis", domain: "analysis" },
  ]),
  useAction: vi.fn(() => vi.fn()),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    skills: { listByProgram: "skills:listByProgram" },
    workstreams: { listByProgram: "workstreams:listByProgram" },
    ai: { executeSkill: "ai:executeSkill" },
  },
}));

vi.mock(
  "@untitledui/icons",
  () =>
    new Proxy(
      {},
      {
        get: (_, name) => (props: any) => <span data-testid={`icon-${String(name)}`} {...props} />,
      },
    ),
);

vi.mock("./ExecutionOutput", () => ({
  ExecutionOutput: () => <div data-testid="execution-output" />,
}));

describe("ExecuteSkillModal", () => {
  const defaultProps = {
    programId: "prog-1" as any,
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when not open", () => {
    const { container } = render(<ExecuteSkillModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Execute Skill heading when open", () => {
    render(<ExecuteSkillModal {...defaultProps} />);
    expect(screen.getByText("Execute Skill")).toBeInTheDocument();
  });

  it("renders skill dropdown with options", () => {
    render(<ExecuteSkillModal {...defaultProps} />);
    expect(screen.getByText("Select a skill...")).toBeInTheDocument();
    expect(screen.getByText("Code Review (engineering)")).toBeInTheDocument();
    expect(screen.getByText("Gap Analysis (analysis)")).toBeInTheDocument();
  });

  it("renders task type input", () => {
    render(<ExecuteSkillModal {...defaultProps} />);
    expect(
      screen.getByPlaceholderText("e.g. code_review, gap_analysis, implementation"),
    ).toBeInTheDocument();
  });

  it("renders task prompt textarea", () => {
    render(<ExecuteSkillModal {...defaultProps} />);
    expect(
      screen.getByPlaceholderText("Describe the specific task for the agent..."),
    ).toBeInTheDocument();
  });

  it("renders Execute button (initially disabled)", () => {
    render(<ExecuteSkillModal {...defaultProps} />);
    const executeButton = screen.getByText("Execute");
    expect(executeButton).toBeInTheDocument();
    expect(executeButton.closest("button")).toBeDisabled();
  });

  it("renders Cancel button", () => {
    render(<ExecuteSkillModal {...defaultProps} />);
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });
});
