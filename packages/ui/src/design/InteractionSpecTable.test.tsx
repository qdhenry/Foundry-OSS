import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock convex/react — MUST be before component import
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
  useAction: () => vi.fn(),
}));

import { InteractionSpecTable } from "./InteractionSpecTable";

const MOCK_INTERACTIONS = [
  {
    _id: "int-1",
    componentName: "PrimaryButton",
    trigger: "hover",
    animationType: "fade",
    duration: "200ms",
    description: "Fade on hover",
  },
  {
    _id: "int-2",
    componentName: "NavItem",
    trigger: "click",
    animationType: "slide",
    duration: "300ms",
    description: "Slide on click",
  },
];

const BASE_PROPS = {
  programId: "prog-1",
  orgId: "org-test",
};

describe("InteractionSpecTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue([]);
  });

  it("renders empty state when no interactions", () => {
    mockUseQuery.mockReturnValue([]);
    render(<InteractionSpecTable {...BASE_PROPS} />);
    expect(screen.getByText("No interaction specs defined yet")).toBeInTheDocument();
  });

  it("renders table with interactions when data exists", () => {
    mockUseQuery.mockReturnValue(MOCK_INTERACTIONS);
    render(<InteractionSpecTable {...BASE_PROPS} />);
    expect(screen.getByText("PrimaryButton")).toBeInTheDocument();
    expect(screen.getByText("NavItem")).toBeInTheDocument();
  });

  it("toggles add form visible when Add button is clicked", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue([]);
    render(<InteractionSpecTable {...BASE_PROPS} />);

    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByPlaceholderText("e.g. PrimaryButton")).toBeInTheDocument();
  });

  it("hides add form when Cancel is clicked after Add", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue([]);
    render(<InteractionSpecTable {...BASE_PROPS} />);

    // Open the form
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByPlaceholderText("e.g. PrimaryButton")).toBeInTheDocument();

    // Cancel closes the form
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByPlaceholderText("e.g. PrimaryButton")).not.toBeInTheDocument();
  });
});
