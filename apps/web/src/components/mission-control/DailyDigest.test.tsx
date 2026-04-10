import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DailyDigest } from "./DailyDigest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockDigestQuery: any;
const mockGenerateDigest = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useAction: () => mockGenerateDigest,
  useQuery: () => mockDigestQuery,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    missionControl: {
      getDailyDigest: "missionControl:getDailyDigest",
    },
    missionControlActions: {
      generateDailyDigest: "missionControlActions:generateDailyDigest",
    },
  },
}));

vi.mock("../../../convex/_generated/dataModel", () => ({}));

beforeEach(() => {
  mockDigestQuery = undefined;
  mockGenerateDigest.mockReset();
});

const defaultProps = {
  programId: "prog-1" as any,
  lastVisitTime: Date.now() - 86400000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DailyDigest", () => {
  it("shows skeleton loading UI when query returns undefined", () => {
    mockDigestQuery = undefined;

    render(<DailyDigest {...defaultProps} />);

    expect(screen.getByText("Mission Control Pulse")).toBeInTheDocument();
    // Skeleton has animated placeholder bars
    const skeletonContainer = document.querySelector(".animate-pulse");
    expect(skeletonContainer).toBeInTheDocument();
  });

  it("always displays the Mission Control Pulse heading", () => {
    mockDigestQuery = undefined;

    render(<DailyDigest {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Mission Control Pulse" })).toBeInTheDocument();
  });

  it("shows cached digest text when source is cache", async () => {
    mockDigestQuery = {
      digest: "Your migration is 75% complete with 3 blockers remaining.",
      source: "cache",
      metadata: { generatedAt: Date.now(), version: 1 },
    };

    render(<DailyDigest {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByText("Your migration is 75% complete with 3 blockers remaining."),
      ).toBeInTheDocument();
    });
  });

  it("triggers generateDailyDigest action when source is generate", async () => {
    mockGenerateDigest.mockResolvedValue({
      success: true,
      digest: "AI-generated digest content here.",
    });

    mockDigestQuery = {
      digest: null,
      source: "generate",
      context: {
        orgId: "org-1",
        programId: "prog-1",
        userId: "user-1",
        lastVisitTime: defaultProps.lastVisitTime,
        changesSummary: { added: 5, modified: 2 },
        workstreamSummary: { total: 7, completed: 3 },
        taskSummary: { open: 4, closed: 10 },
      },
    };

    render(<DailyDigest {...defaultProps} />);

    await waitFor(() => {
      expect(mockGenerateDigest).toHaveBeenCalledOnce();
    });

    expect(mockGenerateDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org-1",
        programId: "prog-1",
        userId: "user-1",
      }),
    );
  });

  it("shows generated digest text after successful action", async () => {
    mockGenerateDigest.mockResolvedValue({
      success: true,
      digest: "AI-generated digest content here.",
    });

    mockDigestQuery = {
      digest: null,
      source: "generate",
      context: {
        orgId: "org-1",
        programId: "prog-1",
        userId: "user-1",
        lastVisitTime: defaultProps.lastVisitTime,
        changesSummary: {},
        workstreamSummary: {},
        taskSummary: {},
      },
    };

    render(<DailyDigest {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("AI-generated digest content here.")).toBeInTheDocument();
    });
  });

  it("shows error banner when action returns failure", async () => {
    mockGenerateDigest.mockResolvedValue({
      success: false,
      error: "Claude API rate limited",
    });

    mockDigestQuery = {
      digest: null,
      source: "generate",
      context: {
        orgId: "org-1",
        programId: "prog-1",
        userId: "user-1",
        lastVisitTime: defaultProps.lastVisitTime,
        changesSummary: {},
        workstreamSummary: {},
        taskSummary: {},
      },
    };

    render(<DailyDigest {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Claude API rate limited")).toBeInTheDocument();
    });
  });

  it("shows error banner when action throws an exception", async () => {
    mockGenerateDigest.mockRejectedValue(new Error("Network failure"));

    mockDigestQuery = {
      digest: null,
      source: "generate",
      context: {
        orgId: "org-1",
        programId: "prog-1",
        userId: "user-1",
        lastVisitTime: defaultProps.lastVisitTime,
        changesSummary: {},
        workstreamSummary: {},
        taskSummary: {},
      },
    };

    render(<DailyDigest {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Network failure")).toBeInTheDocument();
    });
  });

  it("shows loading indicator while generation is in progress", async () => {
    // Never-resolving promise to keep loading state active
    mockGenerateDigest.mockReturnValue(new Promise(() => {}));

    mockDigestQuery = {
      digest: null,
      source: "generate",
      context: {
        orgId: "org-1",
        programId: "prog-1",
        userId: "user-1",
        lastVisitTime: defaultProps.lastVisitTime,
        changesSummary: {},
        workstreamSummary: {},
        taskSummary: {},
      },
    };

    render(<DailyDigest {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Analyzing your migration progress...")).toBeInTheDocument();
    });
  });

  it("does not call generate action more than once", async () => {
    mockGenerateDigest.mockResolvedValue({
      success: true,
      digest: "Generated once.",
    });

    mockDigestQuery = {
      digest: null,
      source: "generate",
      context: {
        orgId: "org-1",
        programId: "prog-1",
        userId: "user-1",
        lastVisitTime: defaultProps.lastVisitTime,
        changesSummary: {},
        workstreamSummary: {},
        taskSummary: {},
      },
    };

    const { rerender } = render(<DailyDigest {...defaultProps} />);

    await waitFor(() => {
      expect(mockGenerateDigest).toHaveBeenCalledOnce();
    });

    // Re-render should not trigger a second call
    rerender(<DailyDigest {...defaultProps} />);

    expect(mockGenerateDigest).toHaveBeenCalledOnce();
  });
});
