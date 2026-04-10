import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ── GSAP mocks (barrel export triggers gsap loading) ──────────────
vi.mock("gsap", () => {
  const gsapMock = {
    set: vi.fn(),
    to: vi.fn(),
    from: vi.fn(),
    matchMedia: vi.fn(() => ({ add: vi.fn() })),
    registerPlugin: vi.fn(),
  };
  return { default: gsapMock };
});
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));
vi.mock("gsap/Flip", () => ({ Flip: { getState: vi.fn(), from: vi.fn() } }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));

import { TaskBoard } from "@foundry/ui/tasks";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

function makeTask(overrides: Partial<Parameters<typeof TaskBoard>[0]["tasks"][0]> = {}) {
  return {
    _id: overrides._id ?? "task-1",
    title: overrides.title ?? "Test Task",
    priority: overrides.priority ?? ("medium" as const),
    status: overrides.status ?? ("backlog" as const),
    ...overrides,
  };
}

const defaultProps = {
  programId: "prog-1",
  programSlug: "acme",
};

describe("TaskBoard", () => {
  it("renders all 5 column headers", () => {
    render(<TaskBoard tasks={[]} {...defaultProps} />);

    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("shows task count per column", () => {
    const tasks = [
      makeTask({ _id: "t1", status: "backlog" }),
      makeTask({ _id: "t2", status: "backlog" }),
      makeTask({ _id: "t3", status: "in_progress" }),
    ];
    render(<TaskBoard tasks={tasks} {...defaultProps} />);

    // Backlog column should show 2, In Progress should show 1
    const counts = screen.getAllByText(/^\d+$/);
    // 5 columns: backlog=2, todo=0, in_progress=1, review=0, done=0
    expect(counts.map((c) => c.textContent)).toEqual(["2", "0", "1", "0", "0"]);
  });

  it("distributes tasks into correct columns by status", () => {
    const tasks = [
      makeTask({ _id: "t1", title: "Backlog Task", status: "backlog" }),
      makeTask({ _id: "t2", title: "Done Task", status: "done" }),
      makeTask({ _id: "t3", title: "Review Task", status: "review" }),
    ];
    render(<TaskBoard tasks={tasks} {...defaultProps} />);

    expect(screen.getByText("Backlog Task")).toBeInTheDocument();
    expect(screen.getByText("Done Task")).toBeInTheDocument();
    expect(screen.getByText("Review Task")).toBeInTheDocument();
  });

  it("shows 'No tasks' for empty columns", () => {
    const tasks = [makeTask({ _id: "t1", status: "backlog" })];
    render(<TaskBoard tasks={tasks} {...defaultProps} />);

    // 4 empty columns should each show "No tasks"
    const noTasksLabels = screen.getAllByText("No tasks");
    expect(noTasksLabels).toHaveLength(4);
  });

  it("handles empty tasks array (all columns show 'No tasks')", () => {
    render(<TaskBoard tasks={[]} {...defaultProps} />);

    const noTasksLabels = screen.getAllByText("No tasks");
    expect(noTasksLabels).toHaveLength(5);
  });

  it("renders select mode toggle button", () => {
    render(<TaskBoard tasks={[]} {...defaultProps} />);
    expect(screen.getByText("Select")).toBeInTheDocument();
  });
});
