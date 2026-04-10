import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StageNextSteps } from "./StageNextSteps";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("StageNextSteps", () => {
  it("renders nothing when steps is empty", () => {
    const { container } = render(<StageNextSteps steps={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders step labels and descriptions", () => {
    render(
      <StageNextSteps
        steps={[
          { label: "Step one", description: "Do this first" },
          { label: "Step two", description: "Then do this" },
        ]}
      />,
    );
    expect(screen.getByText("Step one")).toBeInTheDocument();
    expect(screen.getByText("Do this first")).toBeInTheDocument();
    expect(screen.getByText("Step two")).toBeInTheDocument();
  });

  it("renders link when href is provided", () => {
    render(
      <StageNextSteps steps={[{ label: "Go here", description: "Click it", href: "/test" }]} />,
    );
    const link = screen.getByText("Go here");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/test");
  });

  it("renders button when onClick is provided", () => {
    const handleClick = vi.fn();
    render(
      <StageNextSteps
        steps={[{ label: "Click me", description: "Do it", onClick: handleClick }]}
      />,
    );
    const button = screen.getByText("Click me");
    expect(button.tagName).toBe("BUTTON");
  });

  it("renders heading", () => {
    render(<StageNextSteps steps={[{ label: "Test", description: "desc" }]} />);
    expect(screen.getByText("Next Steps")).toBeInTheDocument();
  });
});
