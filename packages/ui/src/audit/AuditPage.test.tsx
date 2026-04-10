import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let mockEntries: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockEntries,
}));

import { AuditPage } from "./AuditPage";

describe("AuditPage", () => {
  it("renders page heading", () => {
    mockEntries = [];
    render(<AuditPage programId="prog-1" />);
    expect(screen.getByText("Audit Trail")).toBeInTheDocument();
  });

  it("shows loading state when entries are undefined", () => {
    mockEntries = undefined;
    render(<AuditPage programId="prog-1" />);
    expect(screen.getByText("Loading audit trail...")).toBeInTheDocument();
  });

  it("shows entry count when entries are loaded", () => {
    mockEntries = [
      {
        _id: "e1",
        action: "create",
        entityType: "task",
        entityId: "t1",
        description: "Created task",
        userName: "Alice",
        timestamp: Date.now(),
      },
    ];
    render(<AuditPage programId="prog-1" />);
    expect(screen.getByText("1 entry shown")).toBeInTheDocument();
  });

  it("shows plural entry count", () => {
    mockEntries = [
      {
        _id: "e1",
        action: "create",
        entityType: "task",
        entityId: "t1",
        description: "Created task",
        userName: "Alice",
        timestamp: Date.now(),
      },
      {
        _id: "e2",
        action: "update",
        entityType: "task",
        entityId: "t2",
        description: "Updated task",
        userName: "Bob",
        timestamp: Date.now(),
      },
    ];
    render(<AuditPage programId="prog-1" />);
    expect(screen.getByText("2 entries shown")).toBeInTheDocument();
  });

  it("renders empty state when entries are empty", () => {
    mockEntries = [];
    render(<AuditPage programId="prog-1" />);
    expect(screen.getByText("No audit entries found")).toBeInTheDocument();
  });
});
