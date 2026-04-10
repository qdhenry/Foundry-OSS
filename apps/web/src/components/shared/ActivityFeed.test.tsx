import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityFeed } from "./ActivityFeed";

let mockResults: any[] = [];
let mockStatus = "Exhausted";
const mockLoadMore = vi.fn();

vi.mock("convex/react", () => ({
  usePaginatedQuery: () => ({
    results: mockResults,
    status: mockStatus,
    loadMore: mockLoadMore,
  }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    activityEvents: {
      listRecent: "activityEvents:listRecent",
    },
  },
}));

describe("ActivityFeed", () => {
  beforeEach(() => {
    mockResults = [];
    mockStatus = "Exhausted";
    mockLoadMore.mockReset();
  });

  it("shows loading state on first page", () => {
    mockStatus = "LoadingFirstPage";
    render(<ActivityFeed programId="prog-1" />);
    expect(screen.getByText("Loading activity…")).toBeInTheDocument();
  });

  it("renders nothing when there are no results", () => {
    mockResults = [];
    mockStatus = "Exhausted";
    const { container } = render(<ActivityFeed programId="prog-1" />);
    expect(container.querySelector("h3")).toBeNull();
  });

  it("renders activity items", () => {
    mockResults = [
      {
        _id: "e-1",
        message: "Requirement REQ-001 updated",
        userName: "Alice",
        eventType: "update",
        createdAt: Date.now() - 60000,
      },
    ];
    render(<ActivityFeed programId="prog-1" />);
    expect(screen.getByText("Requirement REQ-001 updated")).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it("shows Load more button when more pages available", async () => {
    mockResults = [
      {
        _id: "e-1",
        message: "Event 1",
        userName: "Bob",
        eventType: "create",
        createdAt: Date.now(),
      },
    ];
    mockStatus = "CanLoadMore";
    const user = userEvent.setup();
    render(<ActivityFeed programId="prog-1" />);
    const btn = screen.getByText("Load more");
    await user.click(btn);
    expect(mockLoadMore).toHaveBeenCalledWith(20);
  });

  it("respects custom initialPageSize", async () => {
    mockResults = [
      {
        _id: "e-1",
        message: "Event 1",
        userName: "Bob",
        eventType: "create",
        createdAt: Date.now(),
      },
    ];
    mockStatus = "CanLoadMore";
    const user = userEvent.setup();
    render(<ActivityFeed programId="prog-1" initialPageSize={10} />);
    await user.click(screen.getByText("Load more"));
    expect(mockLoadMore).toHaveBeenCalledWith(10);
  });
});
