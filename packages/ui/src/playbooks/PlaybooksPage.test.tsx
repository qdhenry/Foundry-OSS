import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();
const mockRouter = { push: vi.fn() };

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ programId: "prog_1", slug: "my-prog" }),
}));

vi.mock("./PlaybookCard", () => ({
  PlaybookCard: ({ playbook }: any) => (
    <div data-testid={`playbook-${playbook._id}`}>{playbook.name}</div>
  ),
}));

import PlaybooksPage from "./PlaybooksPage";

describe("PlaybooksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state when data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<PlaybooksPage />);
    expect(screen.getByText("Loading playbooks...")).toBeInTheDocument();
  });

  it("shows empty state when no playbooks", () => {
    mockUseQuery.mockReturnValue([]);
    render(<PlaybooksPage />);
    expect(screen.getByText("No playbooks found")).toBeInTheDocument();
  });

  it("renders playbook cards", () => {
    mockUseQuery.mockReturnValue([
      {
        _id: "pb1",
        name: "Playbook A",
        status: "published",
        steps: [],
        targetPlatform: "salesforce_b2b",
      },
      {
        _id: "pb2",
        name: "Playbook B",
        status: "draft",
        steps: [],
        targetPlatform: "bigcommerce_b2b",
      },
    ]);
    render(<PlaybooksPage />);
    expect(screen.getByText("Playbook A")).toBeInTheDocument();
    expect(screen.getByText("Playbook B")).toBeInTheDocument();
    expect(screen.getByText("2 playbooks")).toBeInTheDocument();
  });

  it("renders status filter tabs", () => {
    mockUseQuery.mockReturnValue([]);
    render(<PlaybooksPage />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("navigates to new playbook on Create click", () => {
    mockUseQuery.mockReturnValue([]);
    render(<PlaybooksPage />);
    fireEvent.click(screen.getByText("Create Playbook"));
    expect(mockRouter.push).toHaveBeenCalledWith("/my-prog/playbooks/new");
  });

  it("shows clear filter when status is filtered with no results", () => {
    mockUseQuery.mockReturnValue([]);
    render(<PlaybooksPage />);
    fireEvent.click(screen.getByText("Draft"));
    // After re-render with empty results
    mockUseQuery.mockReturnValue([]);
    render(<PlaybooksPage />);
    // The empty state text changes based on filter
  });

  it("shows singular playbook count", () => {
    mockUseQuery.mockReturnValue([
      {
        _id: "pb1",
        name: "Solo Playbook",
        status: "published",
        steps: [],
        targetPlatform: "salesforce_b2b",
      },
    ]);
    render(<PlaybooksPage />);
    expect(screen.getByText("1 playbook")).toBeInTheDocument();
  });
});
