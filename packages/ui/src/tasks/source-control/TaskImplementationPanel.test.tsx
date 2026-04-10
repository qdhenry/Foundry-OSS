import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskImplementationPanel } from "./TaskImplementationPanel";

const mocks = vi.hoisted(() => ({
  queryState: {
    heroPR: null as any,
    branchInfo: { branchName: "foundry/task-1" } as any,
  },
  actions: {
    refreshFromGitHub: vi.fn(),
    syncBranch: vi.fn(),
    listBranchFiles: vi.fn(),
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (name: unknown) => {
    switch (String(name)) {
      case "sourceControl/tasks/prLifecycle:getActiveHeroPR":
        return mocks.queryState.heroPR;
      case "sandbox/sessions:getBranchInfoForTask":
        return mocks.queryState.branchInfo;
      default:
        return [];
    }
  },
  useAction: (name: unknown) => {
    switch (String(name)) {
      case "sourceControl/tasks/prActionsInternal:refreshFromGitHub":
        return mocks.actions.refreshFromGitHub;
      case "sourceControl/tasks/prActionsInternal:syncBranchActivity":
        return mocks.actions.syncBranch;
      case "sourceControl/tasks/prActionsInternal:listBranchFiles":
        return mocks.actions.listBranchFiles;
      default:
        return vi.fn();
    }
  },
  useMutation: () => vi.fn(),
}));

describe("TaskImplementationPanel", () => {
  beforeEach(() => {
    mocks.queryState.heroPR = null;
    mocks.queryState.branchInfo = { branchName: "foundry/task-1" };
    mocks.actions.refreshFromGitHub.mockReset();
    mocks.actions.syncBranch.mockReset();
    mocks.actions.listBranchFiles.mockReset();
  });

  it("does not crash when sync payload contains non-coercible synced values", async () => {
    const nonCoercibleSynced = {
      [Symbol.toPrimitive](hint: string) {
        if (hint === "default") {
          throw new TypeError("No default value");
        }
        return 0;
      },
    };

    mocks.actions.syncBranch.mockResolvedValue({
      synced: nonCoercibleSynced,
      prScheduled: false,
    });

    render(<TaskImplementationPanel taskId="task-1" />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Sync Branch" }));

    await waitFor(() => {
      expect(screen.getByText("Branch is up to date")).toBeInTheDocument();
    });
  });

  it("renders a safe string for non-string branch-not-found messages", async () => {
    mocks.actions.syncBranch.mockResolvedValue({
      status: "branch_not_found",
      message: { code: 404, reason: "Branch not found" },
    });

    render(<TaskImplementationPanel taskId="task-1" />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Sync Branch" }));

    await waitFor(() => {
      expect(screen.getByText('{"code":404,"reason":"Branch not found"}')).toBeInTheDocument();
    });
  });
});
