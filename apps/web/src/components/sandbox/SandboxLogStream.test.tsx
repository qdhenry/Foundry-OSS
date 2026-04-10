import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SandboxLogStream } from "./SandboxLogStream";

vi.mock("./SandboxTerminal", () => ({
  SandboxTerminal: () => <div data-testid="sandbox-terminal">Terminal</div>,
}));

let mockSession: any;
let mockLogs: any;
const mockUpdateStatus = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (fnRef: string) => {
    if (fnRef === "sandbox/sessions:get") return mockSession;
    if (fnRef === "sandbox/logs:listBySession") return mockLogs;
    return undefined;
  },
  useAction: (fnRef: string) => {
    if (fnRef === "sandbox/orchestrator:stop") return mockUpdateStatus;
    return vi.fn();
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sandbox: {
      sessions: {
        get: "sandbox/sessions:get",
      },
      logs: {
        listBySession: "sandbox/logs:listBySession",
      },
      orchestrator: {
        stop: "sandbox/orchestrator:stop",
      },
    },
  },
}));

describe("SandboxLogStream", () => {
  beforeEach(() => {
    mockSession = { _id: "session-1", status: "executing" };
    mockLogs = undefined;
    mockUpdateStatus.mockReset();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("shows loading message while waiting for logs", () => {
    render(<SandboxLogStream sessionId="session-1" />);

    expect(screen.getByText("Connecting to sandbox log stream...")).toBeInTheDocument();
    expect(screen.getByText("Executing")).toBeInTheDocument();
  });

  it("supports suppressing embedded terminal rendering", () => {
    mockLogs = [];

    const { rerender } = render(<SandboxLogStream sessionId="session-1" showTerminal={false} />);
    expect(screen.queryByRole("button", { name: "Connect" })).not.toBeInTheDocument();

    rerender(<SandboxLogStream sessionId="session-1" />);
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
  });

  it("renders log entries, autoscrolls, and cancels active sessions", async () => {
    const user = userEvent.setup();
    const scrollToMock = vi.spyOn(HTMLElement.prototype, "scrollTo");
    mockLogs = [
      { _id: "log-1", timestamp: 1700000000000, level: "system", message: "Sandbox booting" },
      { _id: "log-2", timestamp: 1700000001000, level: "stderr", message: "npm WARN warning" },
    ];

    render(<SandboxLogStream sessionId="session-1" />);

    expect(screen.getByText("Sandbox booting")).toBeInTheDocument();
    expect(screen.getByText("npm WARN warning")).toBeInTheDocument();
    await waitFor(() => {
      expect(scrollToMock).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(mockUpdateStatus).toHaveBeenCalledWith({
      sessionId: "session-1",
    });
  });

  it("omits cancel action for completed sessions", () => {
    mockSession = {
      _id: "session-1",
      status: "completed",
      prUrl: "https://github.com/acme/storefront/pull/8",
    };
    mockLogs = [];

    render(<SandboxLogStream sessionId="session-1" />);

    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View PR" })).toHaveAttribute(
      "href",
      "https://github.com/acme/storefront/pull/8",
    );
  });

  it("shows restart action for failed sessions and emits session context", async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();
    const onRestartNow = vi.fn();
    mockSession = {
      _id: "session-9",
      status: "failed",
      repositoryId: "repo-1",
      skillId: "skill-1",
      taskPrompt: "Retry implementation",
      error: "Execution failed",
    };
    mockLogs = [];

    render(
      <SandboxLogStream sessionId="session-9" onRestart={onRestart} onRestartNow={onRestartNow} />,
    );

    await user.click(screen.getByRole("button", { name: "Restart Now" }));

    await user.click(screen.getByRole("button", { name: "Restart Implementation" }));

    expect(onRestartNow).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "session-9",
        repositoryId: "repo-1",
      }),
    );
    expect(onRestart).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "session-9",
        status: "failed",
        repositoryId: "repo-1",
        skillId: "skill-1",
        taskPrompt: "Retry implementation",
      }),
    );
    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
  });

  it("disables restart now when failed session has no repository context", () => {
    mockSession = {
      _id: "session-10",
      status: "failed",
      taskPrompt: "Retry implementation",
    };
    mockLogs = [];

    render(
      <SandboxLogStream
        sessionId="session-10"
        onRestartNow={vi.fn()}
        restartNowError="Missing repository context"
      />,
    );

    expect(screen.getByRole("button", { name: "Restart Now" })).toBeDisabled();
    expect(screen.getByText("Missing repository context")).toBeInTheDocument();
  });
});
