import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

const mockToggleTheme = vi.fn();
let mockTheme = "light";

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ theme: mockTheme, toggleTheme: mockToggleTheme }),
}));

vi.mock("@untitledui/icons", () => ({
  Sun: () => <span data-testid="sun-icon" />,
  Moon01: () => <span data-testid="moon-icon" />,
}));

describe("ThemeToggle", () => {
  it("renders a toggle button with accessible label", () => {
    mockTheme = "light";
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument();
  });

  it("shows moon icon in light mode", () => {
    mockTheme = "light";
    render(<ThemeToggle />);
    expect(screen.getByTestId("moon-icon")).toBeInTheDocument();
  });

  it("shows sun icon in dark mode", () => {
    mockTheme = "dark";
    render(<ThemeToggle />);
    expect(screen.getByTestId("sun-icon")).toBeInTheDocument();
  });

  it("calls toggleTheme on click", async () => {
    mockTheme = "light";
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(mockToggleTheme).toHaveBeenCalledOnce();
  });
});
