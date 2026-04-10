import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();
const mockCreateRisk = vi.fn().mockResolvedValue("new_risk_id");
const mockRouter = { push: vi.fn(), back: vi.fn() };

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => mockCreateRisk,
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

import { ProgramRiskNewRoute } from "./ProgramRiskNewRoute";

describe("ProgramRiskNewRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue([{ _id: "ws1", name: "Frontend", shortCode: "FE" }]);
  });

  it("renders form with required fields", () => {
    render(<ProgramRiskNewRoute />);
    expect(screen.getByText("Create Risk")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Data migration may exceed/)).toBeInTheDocument();
  });

  it("renders severity and probability selects", () => {
    render(<ProgramRiskNewRoute />);
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it("renders workstream toggle buttons", () => {
    render(<ProgramRiskNewRoute />);
    expect(screen.getByText("FE - Frontend")).toBeInTheDocument();
  });

  it("disables submit when title is empty", () => {
    render(<ProgramRiskNewRoute />);
    const submitBtn = screen.getByRole("button", { name: "Create Risk" });
    expect(submitBtn).toBeDisabled();
  });

  it("navigates back on cancel click", () => {
    render(<ProgramRiskNewRoute />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("enables submit when title is filled", () => {
    render(<ProgramRiskNewRoute />);
    fireEvent.change(screen.getByPlaceholderText(/Data migration may exceed/), {
      target: { value: "New Risk" },
    });
    const submitBtn = screen.getByRole("button", { name: "Create Risk" });
    expect(submitBtn).not.toBeDisabled();
  });
});
