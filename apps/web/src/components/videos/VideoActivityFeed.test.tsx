import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VideoActivityFeed } from "./VideoActivityFeed";

describe("VideoActivityFeed", () => {
  it("renders loading state when logs are undefined", () => {
    render(<VideoActivityFeed logs={undefined} />);
    expect(screen.getByText("Loading activity...")).toBeInTheDocument();
  });

  it("renders empty state when logs array is empty", () => {
    render(<VideoActivityFeed logs={[]} />);
    expect(screen.getByText("No activity recorded yet.")).toBeInTheDocument();
  });

  it("renders activity log entries with messages and timestamps", () => {
    const logs = [
      {
        _id: "log_1",
        _creationTime: new Date("2025-01-15T10:30:00Z").getTime(),
        step: "stage_started",
        message: "Stage extracting_media started",
        level: "info" as const,
      },
      {
        _id: "log_2",
        _creationTime: new Date("2025-01-15T10:30:05Z").getTime(),
        step: "stage_completed",
        message: "Stage extracting_media completed",
        level: "success" as const,
      },
      {
        _id: "log_3",
        _creationTime: new Date("2025-01-15T10:30:10Z").getTime(),
        step: "retry_exhausted",
        message: "Stage transcribing failed after 3 attempts.",
        level: "error" as const,
      },
    ];

    render(<VideoActivityFeed logs={logs} />);

    expect(screen.getByText("Stage extracting_media started")).toBeInTheDocument();
    expect(screen.getByText("Stage extracting_media completed")).toBeInTheDocument();
    expect(screen.getByText("Stage transcribing failed after 3 attempts.")).toBeInTheDocument();
  });

  it("renders the Activity Log heading", () => {
    render(<VideoActivityFeed logs={[]} />);
    expect(screen.getByText("Activity Log")).toBeInTheDocument();
  });
});
