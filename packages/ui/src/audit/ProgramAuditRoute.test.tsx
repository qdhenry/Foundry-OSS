import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let mockEntries: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockEntries,
}));

import { ProgramAuditRoute } from "./ProgramAuditRoute";

describe("ProgramAuditRoute", () => {
  it("renders AuditPage with programId from context", () => {
    mockEntries = [];
    const useProgramContext = () => ({ programId: "prog-1" });
    render(<ProgramAuditRoute useProgramContext={useProgramContext} />);
    expect(screen.getByText("Audit Trail")).toBeInTheDocument();
  });
});
