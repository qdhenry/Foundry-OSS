import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuditEntry, type AuditEntryData } from "./AuditEntry";

function makeEntry(overrides: Partial<AuditEntryData> = {}): AuditEntryData {
  return {
    _id: "e1",
    action: "create",
    entityType: "requirement",
    entityId: "req-1",
    description: "Created requirement REQ-001",
    userName: "Alice",
    timestamp: Date.now() - 120_000,
    ...overrides,
  };
}

describe("AuditEntry", () => {
  it("renders entity type badge", () => {
    render(<AuditEntry entry={makeEntry()} />);
    expect(screen.getByText("requirement")).toBeInTheDocument();
  });

  it("renders description text", () => {
    render(<AuditEntry entry={makeEntry()} />);
    expect(screen.getByText("Created requirement REQ-001")).toBeInTheDocument();
  });

  it("renders user name", () => {
    render(<AuditEntry entry={makeEntry()} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders relative time", () => {
    render(<AuditEntry entry={makeEntry({ timestamp: Date.now() - 120_000 })} />);
    expect(screen.getByText("2 minutes ago")).toBeInTheDocument();
  });

  it("shows just now for recent timestamps", () => {
    render(<AuditEntry entry={makeEntry({ timestamp: Date.now() - 5_000 })} />);
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("renders all action types without error", () => {
    const actions = ["create", "update", "delete", "status_change"] as const;
    for (const action of actions) {
      const { unmount } = render(<AuditEntry entry={makeEntry({ action })} />);
      expect(screen.getByText("requirement")).toBeInTheDocument();
      unmount();
    }
  });
});
