import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockProgramContext = vi.hoisted(() => ({
  programId: "prog-1",
  slug: "acme-program",
}));

vi.mock("../../../../lib/programContext", () => ({
  useProgramContext: () => mockProgramContext,
}));

vi.mock("@foundry/ui", () => ({
  TasksPage: ({ programId, programSlug }: { programId: string; programSlug: string }) => (
    <div data-testid="shared-tasks-page">
      {programId}:{programSlug}
    </div>
  ),
}));

import ProgramTasksPage from "./page";

describe("ProgramTasksPage wrapper", () => {
  beforeEach(() => {
    mockProgramContext.programId = "prog-1";
    mockProgramContext.slug = "acme-program";
  });

  it("passes program context values to shared TasksPage", () => {
    render(<ProgramTasksPage />);

    expect(screen.getByTestId("shared-tasks-page")).toHaveTextContent("prog-1:acme-program");
  });

  it("falls back to programId when slug is unavailable", () => {
    mockProgramContext.slug = "";
    render(<ProgramTasksPage />);

    expect(screen.getByTestId("shared-tasks-page")).toHaveTextContent("prog-1:prog-1");
  });
});
