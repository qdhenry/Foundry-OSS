import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskImplementationPanel } from "./TaskImplementationPanel";

let mockQueryResults: Record<string, any> = {};
const mockActionFn = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (fn: any) => {
    const key = typeof fn === "string" ? fn : (fn?.toString?.() ?? "");
    return mockQueryResults[key] ?? mockQueryResults["default"];
  },
  useAction: () => mockActionFn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sourceControl: {
      tasks: {
        prLifecycle: { getActiveHeroPR: "prLifecycle:getActiveHeroPR" },
        prActionsInternal: {
          refreshFromGitHub: "prActions:refreshFromGitHub",
          syncBranchActivity: "prActions:syncBranchActivity",
          listBranchFiles: "prActions:listBranchFiles",
        },
      },
    },
    sandbox: {
      sessions: { getBranchInfoForTask: "sandbox:getBranchInfoForTask" },
    },
  },
}));

vi.mock("./HeroPRCard", () => ({
  HeroPRCard: () => <div>HeroPR Card Mock</div>,
}));
vi.mock("./ChangedFilesSection", () => ({
  ChangedFilesSection: () => <div>Changed Files Mock</div>,
}));
vi.mock("./CommitsSection", () => ({
  CommitsSection: () => <div>Commits Mock</div>,
}));
vi.mock("./ActivityFeedSection", () => ({
  ActivityFeedSection: () => <div>Activity Feed Mock</div>,
}));
vi.mock("./PreviousPRsSection", () => ({
  PreviousPRsSection: () => <div>Previous PRs Mock</div>,
}));

describe("TaskImplementationPanel", () => {
  beforeEach(() => {
    mockQueryResults = {};
    mockActionFn.mockReset();
  });

  it("shows loading skeleton when heroPR is undefined", () => {
    mockQueryResults["default"] = undefined;
    const { container } = render(<TaskImplementationPanel taskId={"task-1" as any} />);
    expect(screen.getByText("Implementation")).toBeInTheDocument();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state with Sync Branch when heroPR is null and no branch", () => {
    // First call (heroPR) = null, second call (branchInfo) = null
    const callCount = 0;
    vi.mocked(vi.fn()).mockReset();
    mockQueryResults["default"] = null;
    render(<TaskImplementationPanel taskId={"task-1" as any} />);
    expect(screen.getByText("No implementation activity yet")).toBeInTheDocument();
    expect(screen.getByText("Sync Branch")).toBeInTheDocument();
  });

  it("renders Implementation heading in active PR state", () => {
    // heroPR exists with data
    mockQueryResults["default"] = {
      _id: "pr-1",
      number: 42,
      title: "Add feature",
      state: "open",
      filesChanged: 5,
      additions: 100,
      deletions: 20,
      commits: [{ _id: "c1", message: "init" }],
    };
    render(<TaskImplementationPanel taskId={"task-1" as any} />);
    expect(screen.getByText("Implementation")).toBeInTheDocument();
  });
});
