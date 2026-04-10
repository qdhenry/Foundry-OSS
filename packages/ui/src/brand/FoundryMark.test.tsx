import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoundryMark } from "./FoundryMark";

describe("FoundryMark", () => {
  it("renders an SVG element", () => {
    const { container } = render(<FoundryMark />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("uses default size of 24", () => {
    const { container } = render(<FoundryMark />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "24");
  });

  it("applies custom size", () => {
    const { container } = render(<FoundryMark size={48} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "48");
  });

  it("renders with aria-label", () => {
    const { container } = render(<FoundryMark />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-label", "Foundry mark");
  });

  it("applies className", () => {
    const { container } = render(<FoundryMark className="test-class" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("test-class");
  });

  it("renders inner circles for large variants", () => {
    const { container } = render(<FoundryMark size={30} variant="dark" />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(7); // 5 main + 2 inner
  });

  it("does not render inner circles for flat variant", () => {
    const { container } = render(<FoundryMark size={30} variant="flat" />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(5); // 5 main only
  });

  it("does not render inner circles for small sizes", () => {
    const { container } = render(<FoundryMark size={20} variant="dark" />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(5); // 5 main only
  });
});
