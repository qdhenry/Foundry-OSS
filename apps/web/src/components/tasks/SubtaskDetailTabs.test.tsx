import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubtaskDetailTabs } from "./SubtaskDetailTabs";

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {},
}));

vi.mock("../../../convex/_generated/dataModel", () => ({}));

vi.mock(
  "lucide-react",
  () =>
    new Proxy(
      {},
      {
        get: (_, name) => {
          const component = (props: any) => (
            <span data-testid={`icon-${String(name)}`} {...props} />
          );
          component.displayName = String(name);
          return component;
        },
      },
    ),
);

function makeSubtask(overrides = {}) {
  return {
    _id: "subtask-1" as any,
    title: "Setup database schema",
    description: "Create the initial database tables",
    prompt: "Create the database schema with users and posts tables",
    estimatedFiles: 3,
    complexityScore: 2,
    estimatedDurationMs: 300000,
    order: 0,
    isPausePoint: false,
    status: "pending",
    ...overrides,
  };
}

describe("SubtaskDetailTabs", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders metadata fields", () => {
    render(<SubtaskDetailTabs subtask={makeSubtask()} />);
    expect(screen.getByText("Est. Files: 3")).toBeInTheDocument();
    expect(screen.getByText("Complexity: 2/5")).toBeInTheDocument();
    expect(screen.getByText("Est. Time: ~5 min")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<SubtaskDetailTabs subtask={makeSubtask()} />);
    expect(screen.getByText("Create the initial database tables")).toBeInTheDocument();
  });

  it("shows prompt tab by default", () => {
    render(<SubtaskDetailTabs subtask={makeSubtask()} />);
    expect(
      screen.getByText("Create the database schema with users and posts tables"),
    ).toBeInTheDocument();
  });

  it("shows no prompt message when prompt is empty", () => {
    render(<SubtaskDetailTabs subtask={makeSubtask({ prompt: "" })} />);
    expect(screen.getByText("No prompt generated yet.")).toBeInTheDocument();
  });

  it("shows actual execution duration when available", () => {
    render(<SubtaskDetailTabs subtask={makeSubtask({ executionDurationMs: 45000 })} />);
    expect(screen.getByText("Actual: 45s")).toBeInTheDocument();
  });

  it("renders tab buttons", () => {
    render(<SubtaskDetailTabs subtask={makeSubtask()} />);
    expect(screen.getByText("Prompt")).toBeInTheDocument();
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Diff")).toBeInTheDocument();
    expect(screen.getByText("Logs")).toBeInTheDocument();
  });

  it("switches to Files tab and shows no file info message", () => {
    render(<SubtaskDetailTabs subtask={makeSubtask()} />);
    fireEvent.click(screen.getByText("Files"));
    expect(screen.getByText("No file information available.")).toBeInTheDocument();
  });

  it("shows allowed files on Files tab", () => {
    render(
      <SubtaskDetailTabs
        subtask={makeSubtask({ allowedFiles: ["src/schema.ts", "src/index.ts"] })}
      />,
    );
    fireEvent.click(screen.getByText("Files"));
    expect(screen.getByText("Allowed Files")).toBeInTheDocument();
    expect(screen.getByText("src/schema.ts")).toBeInTheDocument();
    expect(screen.getByText("src/index.ts")).toBeInTheDocument();
  });

  it("shows changed files on Files tab", () => {
    render(<SubtaskDetailTabs subtask={makeSubtask({ filesChanged: ["src/db.ts"] })} />);
    fireEvent.click(screen.getByText("Files"));
    expect(screen.getByText("Files Changed")).toBeInTheDocument();
    expect(screen.getByText("src/db.ts")).toBeInTheDocument();
  });

  it("highlights scope violations", () => {
    render(
      <SubtaskDetailTabs
        subtask={makeSubtask({
          filesChanged: ["src/db.ts", "src/auth.ts"],
          scopeViolations: ["src/auth.ts"],
        })}
      />,
    );
    fireEvent.click(screen.getByText("Files"));
    expect(screen.getByText("src/auth.ts")).toBeInTheDocument();
  });

  it("enables diff tab when commitSha is present", () => {
    render(<SubtaskDetailTabs subtask={makeSubtask({ commitSha: "abc12345def" })} />);
    fireEvent.click(screen.getByText("Diff"));
    expect(screen.getByText("abc12345")).toBeInTheDocument();
  });

  it("disables diff tab when no commitSha", () => {
    render(<SubtaskDetailTabs subtask={makeSubtask()} />);
    const diffButton = screen.getByText("Diff").closest("button");
    expect(diffButton).toBeDisabled();
  });

  it("disables logs tab when status is pending", () => {
    render(<SubtaskDetailTabs subtask={makeSubtask({ status: "pending" })} />);
    const logsButton = screen.getByText("Logs").closest("button");
    expect(logsButton).toBeDisabled();
  });

  it("enables logs tab when status is not pending", () => {
    render(<SubtaskDetailTabs subtask={makeSubtask({ status: "executing" })} />);
    const logsButton = screen.getByText("Logs").closest("button");
    expect(logsButton).not.toBeDisabled();
  });
});
