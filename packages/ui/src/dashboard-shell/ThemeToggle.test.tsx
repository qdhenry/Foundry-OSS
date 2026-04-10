import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

vi.mock(
  "@untitledui/icons",
  () =>
    new Proxy(
      {},
      {
        get: (_, name) => (props: any) => <span data-testid={`icon-${String(name)}`} {...props} />,
      },
    ),
);

const mockToggleTheme = vi.fn();

vi.mock("../theme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: mockToggleTheme }),
}));

describe("ThemeToggle", () => {
  it("renders toggle button", () => {
    render(<ThemeToggle />);
    expect(screen.getByLabelText("Toggle theme")).toBeInTheDocument();
  });

  it("calls toggleTheme on click", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText("Toggle theme"));
    expect(mockToggleTheme).toHaveBeenCalledOnce();
  });

  it("renders moon icon in light mode", () => {
    render(<ThemeToggle />);
    expect(screen.getByTestId("icon-Moon01")).toBeInTheDocument();
  });
});
