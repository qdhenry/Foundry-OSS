import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("renders nothing when steps array is empty", () => {
    const { container } = render(<StageNextSteps steps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders step label and description", () => {
    render(
      <StageNextSteps
        steps={[{ label: "Do something", description: "Detailed instructions here." }]}
      />,
    );
    expect(screen.getByText("Do something")).toBeInTheDocument();
    expect(screen.getByText("Detailed instructions here.")).toBeInTheDocument();
  });

  it("renders Next Steps heading", () => {
    render(<StageNextSteps steps={[{ label: "Step one", description: "Desc" }]} />);
    expect(screen.getByText("Next Steps")).toBeInTheDocument();
  });

  it("renders step with link when href is provided", () => {
    render(
      <StageNextSteps
        steps={[{ label: "Go to discovery", description: "Navigate to hub.", href: "/discovery" }]}
      />,
    );
    const link = screen.getByText("Go to discovery");
    expect(link.closest("a")).toHaveAttribute("href", "/discovery");
  });

  it("calls onClick when clickable step is clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <StageNextSteps steps={[{ label: "Click me", description: "Do the thing.", onClick }]} />,
    );
    await user.click(screen.getByText("Click me"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders multiple steps with numbered indicators", () => {
    render(
      <StageNextSteps
        steps={[
          { label: "First", description: "First desc" },
          { label: "Second", description: "Second desc" },
        ]}
      />,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });
});
