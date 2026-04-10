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

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock @untitledui/icons with the named exports used by DesignTokenEditor
vi.mock("@untitledui/icons", () => ({
  Palette: () => null,
  Code01: () => null,
  LayoutAlt04: () => null,
  TextInput: () => null,
  Trash01: () => null,
}));

import { DesignTokenEditor } from "./DesignTokenEditor";

const TOKEN_SET_WITH_COLORS = {
  _id: "ts-1",
  name: "Brand Tokens",
  colors: JSON.stringify({ primary: "#3B82F6", secondary: "#64748B" }),
  typography: JSON.stringify({}),
  spacing: JSON.stringify({}),
  tailwindConfig: null,
  cssVariables: null,
  scssVariables: null,
};

describe("DesignTokenEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue([]);
  });

  it("renders empty state when no token sets", () => {
    mockUseQuery.mockReturnValue([]);
    render(<DesignTokenEditor programId="prog-1" />);
    expect(screen.getByText("No design tokens imported")).toBeInTheDocument();
  });

  it("renders color swatches from object-shaped colors", () => {
    mockUseQuery.mockReturnValue([TOKEN_SET_WITH_COLORS]);
    render(<DesignTokenEditor programId="prog-1" />);
    expect(screen.getByText("primary")).toBeInTheDocument();
    expect(screen.getByText("secondary")).toBeInTheDocument();
  });

  it("switches to Typography tab when clicked", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue([TOKEN_SET_WITH_COLORS]);
    render(<DesignTokenEditor programId="prog-1" />);

    await user.click(screen.getByRole("button", { name: /typography/i }));
    expect(screen.getByText("No typography tokens found in this set.")).toBeInTheDocument();
  });

  it("switches to Spacing tab when clicked", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue([TOKEN_SET_WITH_COLORS]);
    render(<DesignTokenEditor programId="prog-1" />);

    await user.click(screen.getByRole("button", { name: /spacing/i }));
    expect(screen.getByText("No spacing tokens found in this set.")).toBeInTheDocument();
  });

  it("switches to Code Output tab when clicked", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue([TOKEN_SET_WITH_COLORS]);
    render(<DesignTokenEditor programId="prog-1" />);

    await user.click(screen.getByRole("button", { name: /code output/i }));
    expect(screen.getByText("Tailwind Config")).toBeInTheDocument();
  });

  it("renders Clear All button when token sets exist", () => {
    mockUseQuery.mockReturnValue([TOKEN_SET_WITH_COLORS]);
    render(<DesignTokenEditor programId="prog-1" />);
    expect(screen.getByText("Clear All")).toBeInTheDocument();
  });

  it("handles object-shaped colors without throwing a .map error", () => {
    // Colors as an object (not an array) — the component should handle this gracefully
    const objectColorSet = {
      ...TOKEN_SET_WITH_COLORS,
      colors: JSON.stringify({ primary: "#3B82F6", danger: "#EF4444" }),
    };
    mockUseQuery.mockReturnValue([objectColorSet]);

    // Should render without throwing
    expect(() => render(<DesignTokenEditor programId="prog-1" />)).not.toThrow();
    expect(screen.getByText("primary")).toBeInTheDocument();
    expect(screen.getByText("danger")).toBeInTheDocument();
  });
});
