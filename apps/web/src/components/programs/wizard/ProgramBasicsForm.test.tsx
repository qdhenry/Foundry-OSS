import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type ProgramBasicsData, ProgramBasicsForm } from "./ProgramBasicsForm";

// Mock convex/react to avoid real backend calls
vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));

const defaultData: ProgramBasicsData = {
  name: "",
  clientName: "",
  engagementType: "",
  techStack: [],
  description: "",
  startDate: "",
  targetEndDate: "",
  workstreams: [],
};

const filledData: ProgramBasicsData = {
  name: "AcmeCorp Delivery",
  clientName: "AcmeCorp",
  engagementType: "migration",
  techStack: [{ category: "commerce_platform", technologies: ["Salesforce Commerce"] }],
  description: "B2B delivery project",
  startDate: "2026-03-01",
  targetEndDate: "2026-09-01",
  workstreams: [],
};

let mockOnChange: ReturnType<typeof vi.fn>;
let mockOnNext: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockOnChange = vi.fn();
  mockOnNext = vi.fn();
});

describe("ProgramBasicsForm", () => {
  it("renders engagement type cards and form fields", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    expect(screen.getByText("Program Setup")).toBeInTheDocument();
    expect(screen.getByText("Greenfield Build")).toBeInTheDocument();
    expect(screen.getByText("Platform Migration")).toBeInTheDocument();
    expect(screen.getByText("System Integration")).toBeInTheDocument();
    expect(screen.getByText("Ongoing Product Dev")).toBeInTheDocument();
    expect(screen.getByLabelText(/Program Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Client Name/)).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("calls onChange when program name is typed", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    const nameInput = screen.getByLabelText(/Program Name/);
    fireEvent.change(nameInput, { target: { value: "New Program" } });

    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultData,
      name: "New Program",
    });
  });

  it("calls onChange when client name is typed", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    const clientInput = screen.getByLabelText(/Client Name/);
    fireEvent.change(clientInput, { target: { value: "Acme Corp" } });

    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultData,
      clientName: "Acme Corp",
    });
  });

  it("calls onChange when description is typed", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    const textarea = screen.getByLabelText("Description");
    fireEvent.change(textarea, { target: { value: "Some description" } });

    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultData,
      description: "Some description",
    });
  });

  // ---- Validation ----

  it("shows validation error when name is empty and Next is clicked", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Program name is required")).toBeInTheDocument();
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it("shows validation error when client name is empty and Next is clicked", () => {
    render(
      <ProgramBasicsForm
        data={{ ...defaultData, name: "Valid Name", engagementType: "greenfield" }}
        onChange={mockOnChange}
        onNext={mockOnNext}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Client name is required")).toBeInTheDocument();
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it("shows engagement type validation error when not selected", () => {
    render(
      <ProgramBasicsForm
        data={{ ...defaultData, name: "Valid", clientName: "Client" }}
        onChange={mockOnChange}
        onNext={mockOnNext}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Engagement type is required")).toBeInTheDocument();
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it("treats whitespace-only name as empty", () => {
    render(
      <ProgramBasicsForm
        data={{ ...filledData, name: "   " }}
        onChange={mockOnChange}
        onNext={mockOnNext}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Program name is required")).toBeInTheDocument();
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it("clears error when the errored field is edited", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    // Trigger validation error
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Program name is required")).toBeInTheDocument();

    // Type in name field — onChange fires and error should clear
    const nameInput = screen.getByLabelText(/Program Name/);
    fireEvent.change(nameInput, { target: { value: "x" } });

    // The error message should now be gone (internal state cleared)
    expect(screen.queryByText("Program name is required")).not.toBeInTheDocument();
  });

  // ---- Engagement Type Card Selection ----

  it("renders all 4 engagement type cards with labels and descriptions", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    expect(screen.getByText("Greenfield Build")).toBeInTheDocument();
    expect(screen.getByText("New application from the ground up")).toBeInTheDocument();
    expect(screen.getByText("Platform Migration")).toBeInTheDocument();
    expect(screen.getByText("Move between platforms or systems")).toBeInTheDocument();
    expect(screen.getByText("System Integration")).toBeInTheDocument();
    expect(screen.getByText("Connect existing systems and data")).toBeInTheDocument();
    expect(screen.getByText("Ongoing Product Dev")).toBeInTheDocument();
    expect(screen.getByText("Continuous development on a live product")).toBeInTheDocument();
  });

  it("calls onChange with selected engagement type when card is clicked", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    fireEvent.click(screen.getByText("Greenfield Build"));

    expect(mockOnChange).toHaveBeenCalledWith({
      ...defaultData,
      engagementType: "greenfield",
    });
  });

  it("highlights selected engagement type card", () => {
    render(
      <ProgramBasicsForm
        data={{ ...defaultData, engagementType: "migration" }}
        onChange={mockOnChange}
        onNext={mockOnNext}
      />,
    );

    const migrationCard = screen.getByText("Platform Migration").closest("button");
    expect(migrationCard?.className).toContain("border-accent-default");
  });

  // ---- Tech Stack Selector ----

  it("renders tech stack toggle button", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    expect(screen.getByText("Tech Stack")).toBeInTheDocument();
    expect(screen.getByText("(optional)")).toBeInTheDocument();
  });

  it("expands tech stack section when toggle clicked", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    // Categories should not be visible initially
    expect(screen.queryByText("Frontend")).not.toBeInTheDocument();

    // Click the toggle button
    fireEvent.click(screen.getByText("Tech Stack"));

    // Now category labels should appear
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("Database")).toBeInTheDocument();
    expect(screen.getByText("Cloud")).toBeInTheDocument();
    expect(screen.getByText("Commerce")).toBeInTheDocument();
    expect(screen.getByText("CMS")).toBeInTheDocument();
  });

  it("calls onChange with tech stack when checkbox toggled", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    // Expand tech stack
    fireEvent.click(screen.getByText("Tech Stack"));

    // Click the React checkbox
    fireEvent.click(screen.getByLabelText("React"));

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        techStack: [{ category: "frontend", technologies: ["React"] }],
      }),
    );
  });

  // ---- Workstream Editor ----

  it("shows workstream editor when workstreams exist in data", () => {
    // The workstream editor is shown via internal showWorkstreams state.
    // We can trigger it by rendering with filled data and clicking Next,
    // which calls handleGenerateWorkstreams. Since the mock action will
    // throw (returns undefined), it falls back to default workstreams.
    const { container } = render(
      <ProgramBasicsForm data={filledData} onChange={mockOnChange} onNext={mockOnNext} />,
    );

    // Click Next to trigger workstream generation (will fallback to defaults)
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // Wait for the workstream editor to appear (async fallback)
    // The mock useAction returns vi.fn() which resolves to undefined,
    // causing the fallback to default workstreams
    return vi.waitFor(() => {
      expect(screen.getByText("Workstreams")).toBeInTheDocument();
    });
  });

  it("renders Add Workstream and Regenerate buttons in workstream editor", () => {
    render(<ProgramBasicsForm data={filledData} onChange={mockOnChange} onNext={mockOnNext} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    return vi.waitFor(() => {
      expect(screen.getByText("+ Add Workstream")).toBeInTheDocument();
      expect(screen.getByText("Regenerate")).toBeInTheDocument();
    });
  });

  // ---- Additional Validation ----

  it("shows all three validation errors when all fields empty", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Program name is required")).toBeInTheDocument();
    expect(screen.getByText("Client name is required")).toBeInTheDocument();
    expect(screen.getByText("Engagement type is required")).toBeInTheDocument();
  });

  it("does not show engagement type error when type is selected", () => {
    render(
      <ProgramBasicsForm
        data={{ ...defaultData, engagementType: "greenfield" }}
        onChange={mockOnChange}
        onNext={mockOnNext}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // Name and client errors should show, but not engagement type
    expect(screen.getByText("Program name is required")).toBeInTheDocument();
    expect(screen.getByText("Client name is required")).toBeInTheDocument();
    expect(screen.queryByText("Engagement type is required")).not.toBeInTheDocument();
  });

  // ---- Button States ----

  it("shows 'Next' button initially", () => {
    render(<ProgramBasicsForm data={defaultData} onChange={mockOnChange} onNext={mockOnNext} />);

    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("shows 'Continue' button after workstreams are generated", () => {
    render(<ProgramBasicsForm data={filledData} onChange={mockOnChange} onNext={mockOnNext} />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    return vi.waitFor(() => {
      expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    });
  });

  // ---- Interface/Type Exports ----

  it("ProgramBasicsData interface has all required fields", () => {
    // TypeScript compile-time check: if this object compiles, the interface is correct
    const data: ProgramBasicsData = {
      name: "test",
      clientName: "test client",
      engagementType: "greenfield",
      techStack: [{ category: "frontend", technologies: ["React"] }],
      description: "desc",
      startDate: "2026-01-01",
      targetEndDate: "2026-12-31",
      workstreams: [{ name: "Dev", shortCode: "DEV", sortOrder: 0, description: "Development" }],
    };
    expect(data.name).toBe("test");
    expect(data.engagementType).toBe("greenfield");
    expect(data.techStack).toHaveLength(1);
    expect(data.workstreams).toHaveLength(1);
  });
});
