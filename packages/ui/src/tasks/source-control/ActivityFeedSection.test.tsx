import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityFeedSection } from "./ActivityFeedSection";

let queryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: () => queryReturn,
}));

function makeEvent(overrides = {}) {
  return {
    _id: "evt-1",
    eventType: "pr_created",
    metadata: { prNumber: 42 },
    occurredAt: Date.now() - 60_000 * 3,
    actorLogin: "octocat",
    ...overrides,
  };
}

describe("ActivityFeedSection", () => {
  it("renders header", () => {
    queryReturn = undefined;
    render(<ActivityFeedSection taskId="task-1" />);
    expect(screen.getByText("Activity Feed")).toBeInTheDocument();
  });

  it("shows loading skeleton when events undefined", () => {
    queryReturn = undefined;
    const { container } = render(<ActivityFeedSection taskId="task-1" />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no events", () => {
    queryReturn = [];
    render(<ActivityFeedSection taskId="task-1" />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("shows event count in header", () => {
    queryReturn = [makeEvent(), makeEvent({ _id: "evt-2", eventType: "ci_passed" })];
    render(<ActivityFeedSection taskId="task-1" />);
    expect(screen.getByText("2 events")).toBeInTheDocument();
  });

  it("renders pr_created event label", () => {
    queryReturn = [makeEvent()];
    render(<ActivityFeedSection taskId="task-1" />);
    expect(screen.getByText(/PR #42 created/)).toBeInTheDocument();
  });

  it("renders actor login", () => {
    queryReturn = [makeEvent()];
    render(<ActivityFeedSection taskId="task-1" />);
    expect(screen.getByText(/by octocat/)).toBeInTheDocument();
  });

  it("renders ci_passed event label", () => {
    queryReturn = [makeEvent({ eventType: "ci_passed", metadata: {} })];
    render(<ActivityFeedSection taskId="task-1" />);
    expect(screen.getByText("CI checks passed")).toBeInTheDocument();
  });

  it("renders pr_merged event label", () => {
    queryReturn = [makeEvent({ eventType: "pr_merged", metadata: { prNumber: 99 } })];
    render(<ActivityFeedSection taskId="task-1" />);
    expect(screen.getByText(/PR #99 merged/)).toBeInTheDocument();
  });

  it("collapses on header click", () => {
    queryReturn = [makeEvent()];
    render(<ActivityFeedSection taskId="task-1" />);
    expect(screen.getByText(/PR #42 created/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Activity Feed"));
    expect(screen.queryByText(/PR #42 created/)).not.toBeInTheDocument();
  });
});
