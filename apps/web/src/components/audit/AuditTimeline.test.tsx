import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AuditEntryData } from "./AuditEntry";
import { AuditTimeline } from "./AuditTimeline";

const makeEntry = (overrides: Partial<AuditEntryData> = {}): AuditEntryData => ({
  _id: "entry-1",
  action: "create",
  entityType: "requirement",
  entityId: "req-1",
  description: "Created requirement",
  userName: "John",
  timestamp: Date.now(),
  ...overrides,
});

describe("AuditTimeline", () => {
  it("renders empty state when no entries", () => {
    render(<AuditTimeline entries={[]} />);
    expect(screen.getByText("No audit entries found")).toBeInTheDocument();
    expect(
      screen.getByText("Activity will appear here as changes are made to this program."),
    ).toBeInTheDocument();
  });

  it("renders entries grouped by date", () => {
    const entries = [
      makeEntry({ _id: "e1", timestamp: Date.now() }),
      makeEntry({ _id: "e2", timestamp: Date.now() - 1000 }),
    ];
    render(<AuditTimeline entries={entries} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getAllByText("Created requirement")).toHaveLength(2);
  });

  it("groups entries from different days separately", () => {
    const today = Date.now();
    const yesterday = today - 86_400_000;
    const entries = [
      makeEntry({ _id: "e1", timestamp: today }),
      makeEntry({ _id: "e2", timestamp: yesterday }),
    ];
    render(<AuditTimeline entries={entries} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });
});
