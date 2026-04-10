import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditEntry, type AuditEntryData } from "./AuditEntry";

const makeEntry = (overrides: Partial<AuditEntryData> = {}): AuditEntryData => ({
  _id: "entry-1",
  action: "create",
  entityType: "requirement",
  entityId: "req-1",
  description: "Created requirement REQ-001",
  userName: "John Doe",
  timestamp: Date.now() - 60_000, // 1 minute ago
  ...overrides,
});

describe("AuditEntry", () => {
  it("renders entity type badge", () => {
    render(<AuditEntry entry={makeEntry()} />);
    expect(screen.getByText("requirement")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<AuditEntry entry={makeEntry()} />);
    expect(screen.getByText("Created requirement REQ-001")).toBeInTheDocument();
  });

  it("renders user name", () => {
    render(<AuditEntry entry={makeEntry()} />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders relative time for recent events", () => {
    render(<AuditEntry entry={makeEntry({ timestamp: Date.now() - 60_000 })} />);
    expect(screen.getByText("1 minute ago")).toBeInTheDocument();
  });

  it("renders just now for very recent events", () => {
    render(<AuditEntry entry={makeEntry({ timestamp: Date.now() - 10_000 })} />);
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("renders all action types without crashing", () => {
    const actions = ["create", "update", "delete", "status_change"] as const;
    for (const action of actions) {
      const { unmount } = render(<AuditEntry entry={makeEntry({ action })} />);
      unmount();
    }
  });
});
