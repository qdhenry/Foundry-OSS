import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AuditEntryData } from "./AuditEntry";
import { AuditTimeline } from "./AuditTimeline";

function makeEntry(overrides: Partial<AuditEntryData> = {}): AuditEntryData {
  return {
    _id: "e1",
    action: "create",
    entityType: "requirement",
    entityId: "req-1",
    description: "Created REQ-001",
    userName: "Alice",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("AuditTimeline", () => {
  it("renders empty state when no entries", () => {
    render(<AuditTimeline entries={[]} />);
    expect(screen.getByText("No audit entries found")).toBeInTheDocument();
  });

  it("renders entries grouped by date with Today label", () => {
    render(
      <AuditTimeline
        entries={[
          makeEntry({ _id: "e1", description: "Created REQ-001" }),
          makeEntry({ _id: "e2", description: "Updated REQ-002" }),
        ]}
      />,
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Created REQ-001")).toBeInTheDocument();
    expect(screen.getByText("Updated REQ-002")).toBeInTheDocument();
  });

  it("groups entries from different days separately", () => {
    const yesterday = Date.now() - 86_400_000 - 1000;
    render(
      <AuditTimeline
        entries={[
          makeEntry({ _id: "e1", timestamp: Date.now() }),
          makeEntry({ _id: "e2", timestamp: yesterday }),
        ]}
      />,
    );
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });
});
