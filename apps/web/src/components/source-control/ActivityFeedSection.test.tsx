import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ActivityFeedSection } from "./ActivityFeedSection";

let mockQueryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockQueryReturn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sourceControl: {
      tasks: {
        prLifecycle: {
          getActivityFeed: "sourceControl.tasks.prLifecycle:getActivityFeed",
        },
      },
    },
  },
}));

const mockEvents = [
  {
    _id: "evt-1",
    eventType: "pr_created",
    metadata: { prNumber: 42 },
    actorLogin: "dev1",
    occurredAt: Date.now() - 60_000,
  },
  {
    _id: "evt-2",
    eventType: "ci_passed",
    metadata: {},
    actorLogin: null,
    occurredAt: Date.now() - 120_000,
  },
  {
    _id: "evt-3",
    eventType: "review_submitted",
    metadata: { reviewer: "alice" },
    actorLogin: "alice",
    occurredAt: Date.now() - 180_000,
  },
];

describe("ActivityFeedSection", () => {
  it("shows loading skeleton when data is undefined", () => {
    mockQueryReturn = undefined;
    const { container } = render(<ActivityFeedSection taskId={"task-1" as any} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows empty state when events array is empty", () => {
    mockQueryReturn = [];
    render(<ActivityFeedSection taskId={"task-1" as any} />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("renders event count in header", () => {
    mockQueryReturn = mockEvents;
    render(<ActivityFeedSection taskId={"task-1" as any} />);
    expect(screen.getByText("3 events")).toBeInTheDocument();
  });

  it("renders singular event count", () => {
    mockQueryReturn = [mockEvents[0]];
    render(<ActivityFeedSection taskId={"task-1" as any} />);
    expect(screen.getByText("1 event")).toBeInTheDocument();
  });

  it("renders event labels from config", () => {
    mockQueryReturn = mockEvents;
    render(<ActivityFeedSection taskId={"task-1" as any} />);
    expect(screen.getByText(/PR #42 created/)).toBeInTheDocument();
    expect(screen.getByText("CI checks passed")).toBeInTheDocument();
    expect(screen.getByText(/Review submitted by alice/)).toBeInTheDocument();
  });

  it("shows actor login when present", () => {
    mockQueryReturn = [mockEvents[0]];
    render(<ActivityFeedSection taskId={"task-1" as any} />);
    expect(screen.getByText("by dev1")).toBeInTheDocument();
  });

  it("collapses and expands on header click", async () => {
    mockQueryReturn = mockEvents;
    const user = userEvent.setup();
    render(<ActivityFeedSection taskId={"task-1" as any} />);
    expect(screen.getByText(/PR #42 created/)).toBeInTheDocument();

    await user.click(screen.getByText("Activity Feed"));
    expect(screen.queryByText(/PR #42 created/)).not.toBeInTheDocument();

    await user.click(screen.getByText("Activity Feed"));
    expect(screen.getByText(/PR #42 created/)).toBeInTheDocument();
  });
});
