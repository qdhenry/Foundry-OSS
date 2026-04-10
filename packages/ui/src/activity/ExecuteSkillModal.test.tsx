import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExecuteSkillModal } from "./ExecuteSkillModal";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_1" } }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useAction: () => vi.fn(),
}));

vi.mock(
  "@untitledui/icons",
  () =>
    new Proxy(
      {},
      {
        get: (_target, name) => {
          const Stub = (props: any) => <svg data-testid={`icon-${String(name)}`} {...props} />;
          Stub.displayName = String(name);
          return Stub;
        },
      },
    ),
);

vi.mock("./ExecutionOutput", () => ({
  ExecutionOutput: () => <div data-testid="execution-output" />,
}));

describe("ExecuteSkillModal", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <ExecuteSkillModal programId="prog_1" isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders modal heading when open", () => {
    render(<ExecuteSkillModal programId="prog_1" isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Execute Skill")).toBeInTheDocument();
  });

  it("renders skill selector", () => {
    render(<ExecuteSkillModal programId="prog_1" isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Select a skill...")).toBeInTheDocument();
  });

  it("renders task type input", () => {
    render(<ExecuteSkillModal programId="prog_1" isOpen={true} onClose={vi.fn()} />);
    expect(
      screen.getByPlaceholderText("e.g. code_review, gap_analysis, implementation"),
    ).toBeInTheDocument();
  });

  it("renders task prompt textarea", () => {
    render(<ExecuteSkillModal programId="prog_1" isOpen={true} onClose={vi.fn()} />);
    expect(
      screen.getByPlaceholderText("Describe the specific task for the agent..."),
    ).toBeInTheDocument();
  });

  it("renders execute button disabled when no fields filled", () => {
    render(<ExecuteSkillModal programId="prog_1" isOpen={true} onClose={vi.fn()} />);
    const executeBtn = screen.getByText("Execute");
    expect(executeBtn.closest("button")).toBeDisabled();
  });
});
