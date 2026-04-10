import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();
const mockCreateGate = vi.fn().mockResolvedValue("new_gate_id");
const mockRouter = { push: vi.fn(), back: vi.fn() };

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => mockCreateGate,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ programId: "prog_1", slug: "my-prog" }),
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_1" } }),
}));

import { ProgramGateNewRoute } from "./ProgramGateNewRoute";

describe("ProgramGateNewRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue([
      { _id: "ws1", name: "Frontend" },
      { _id: "ws2", name: "Backend" },
    ]);
  });

  it("renders form with required fields", () => {
    render(<ProgramGateNewRoute />);
    expect(screen.getByText("Create Sprint Gate")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Foundation Review Gate")).toBeInTheDocument();
    expect(screen.getByText("Select workstream...")).toBeInTheDocument();
  });

  it("renders gate type options", () => {
    render(<ProgramGateNewRoute />);
    const typeSelect = screen.getAllByRole("combobox")[0];
    expect(typeSelect).toBeInTheDocument();
    expect(screen.getByText("Foundation")).toBeInTheDocument();
  });

  it("renders workstream options from query", () => {
    render(<ProgramGateNewRoute />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("renders initial criterion input", () => {
    render(<ProgramGateNewRoute />);
    expect(screen.getByPlaceholderText("Criterion title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Description (optional)")).toBeInTheDocument();
  });

  it("adds criterion on button click", () => {
    render(<ProgramGateNewRoute />);
    fireEvent.click(screen.getByText("+ Add Criterion"));
    const titleInputs = screen.getAllByPlaceholderText("Criterion title");
    expect(titleInputs).toHaveLength(2);
  });

  it("disables submit when name or workstream is empty", () => {
    render(<ProgramGateNewRoute />);
    const submitBtn = screen.getByText("Create Gate");
    expect(submitBtn).toBeDisabled();
  });

  it("navigates back on cancel click", () => {
    render(<ProgramGateNewRoute />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("navigates back on back button click", () => {
    render(<ProgramGateNewRoute />);
    fireEvent.click(screen.getByText("Back to Gates"));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
