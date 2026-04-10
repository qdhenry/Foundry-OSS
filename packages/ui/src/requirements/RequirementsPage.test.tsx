import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock convex/react
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn(() => vi.fn());
vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
}));

// Mock next/navigation
const mockRouter = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
}));

// Mock program context
vi.mock("../programs", () => ({
  useProgramContext: () => ({
    programId: "prog-1",
    slug: "test-program",
  }),
}));

import { RequirementsPage } from "./RequirementsPage";

const mockRequirements = [
  {
    _id: "req-1",
    refId: "REQ-001",
    title: "Product catalog migration",
    description: "Migrate product catalog from source to target platform",
    priority: "must_have" as const,
    status: "approved" as const,
    fitGap: "custom_dev" as const,
    effortEstimate: "high" as const,
    deliveryPhase: "phase_1" as const,
    workstreamId: "ws-1",
    workstreamName: "Product Data Migration",
    taskCount: 3,
  },
  {
    _id: "req-2",
    refId: "REQ-002",
    title: "User authentication setup",
    description: undefined,
    priority: "should_have" as const,
    status: "draft" as const,
    fitGap: "native" as const,
    effortEstimate: undefined,
    deliveryPhase: undefined,
    workstreamId: undefined,
    workstreamName: null,
    taskCount: 0,
  },
];

const mockWorkstreams = [{ _id: "ws-1", name: "Product Data Migration", shortCode: "PDM" }];

function setupQueries({
  items = mockRequirements,
  workstreams = mockWorkstreams,
}: {
  items?: typeof mockRequirements;
  workstreams?: typeof mockWorkstreams;
} = {}) {
  mockUseQuery.mockImplementation((queryName: string) => {
    if (queryName === "workstreams:listByProgram") return workstreams;
    if (queryName === "requirements:listAllByProgram") {
      return { items, totalCount: items.length, hasMore: false };
    }
    return undefined;
  });
}

describe("RequirementsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders table column headers", () => {
    setupQueries();
    render(<RequirementsPage />);

    expect(screen.getByText("Ref ID")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Workstream")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("renders requirement rows with data", () => {
    setupQueries();
    render(<RequirementsPage />);

    expect(screen.getByText("REQ-001")).toBeInTheDocument();
    expect(screen.getByText("Product catalog migration")).toBeInTheDocument();
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Product Data Migration")).toBeInTheDocument();
  });

  it("shows 'Unassigned' text for unassigned requirements", () => {
    setupQueries();
    render(<RequirementsPage />);
    // "Unassigned" appears as italic text in the workstream column for unassigned reqs
    const unassignedTexts = screen.getAllByText("Unassigned");
    const italicUnassigned = unassignedTexts.find((el) => el.classList.contains("italic"));
    expect(italicUnassigned).toBeDefined();
  });

  it("renders filter pills for All and Unassigned", () => {
    setupQueries();
    render(<RequirementsPage />);
    // "All" filter button
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    // "Unassigned" filter button (also appears as text in table row)
    const unassignedButtons = screen.getAllByText("Unassigned");
    expect(unassignedButtons.length).toBeGreaterThanOrEqual(1);
    // First one is the filter button
    expect(unassignedButtons[0].closest("button")).not.toBeNull();
  });

  it("shows bulk action bar when items are selected", async () => {
    setupQueries();
    const user = userEvent.setup();
    render(<RequirementsPage />);

    // Select first requirement via its row checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    // checkboxes[0] = select-all, checkboxes[1] = first row
    await user.click(checkboxes[1]);

    expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    expect(screen.getByText("Create Tasks")).toBeInTheDocument();
    expect(screen.getByText("Clear selection")).toBeInTheDocument();
  });

  it("shows empty state when no requirements", () => {
    setupQueries({ items: [] });
    render(<RequirementsPage />);
    expect(screen.getByText("No requirements found")).toBeInTheDocument();
  });

  it("shows total count in header", () => {
    setupQueries();
    render(<RequirementsPage />);
    expect(screen.getByText("2 requirements total")).toBeInTheDocument();
  });

  it("renders Actions column with three-dot menu buttons", () => {
    setupQueries();
    render(<RequirementsPage />);

    // Each row should have a RowActionMenu button with an aria-label
    const actionButtons = screen.getAllByRole("button", {
      name: /Actions for requirement/,
    });
    expect(actionButtons).toHaveLength(mockRequirements.length);
  });

  it("shows new bulk actions when items are selected", async () => {
    setupQueries();
    const user = userEvent.setup();
    render(<RequirementsPage />);

    // Select first requirement via its row checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    // checkboxes[0] = select-all, checkboxes[1] = first row
    await user.click(checkboxes[1]);

    // Verify bulk action controls appear
    const statusSelect = screen.getByDisplayValue("Change Status...");
    expect(statusSelect).toBeInTheDocument();

    const prioritySelect = screen.getByDisplayValue("Change Priority...");
    expect(prioritySelect).toBeInTheDocument();

    expect(screen.getByText("Export")).toBeInTheDocument();
    expect(screen.getByText("Delete Selected")).toBeInTheDocument();
  });

  it("shows delete confirmation modal when Delete Selected is clicked", async () => {
    setupQueries();
    const user = userEvent.setup();
    render(<RequirementsPage />);

    // Select first requirement
    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);

    // Click Delete Selected
    const deleteBtn = screen.getByText("Delete Selected");
    await user.click(deleteBtn);

    // Verify modal appears
    expect(await screen.findByText("Delete Requirement?")).toBeInTheDocument();
  });
});
