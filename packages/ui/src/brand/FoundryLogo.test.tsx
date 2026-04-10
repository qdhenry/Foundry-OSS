import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoundryLogo } from "./FoundryLogo";

describe("FoundryLogo", () => {
  it("renders the FOUNDRY text", () => {
    render(<FoundryLogo variant="dark" />);
    expect(screen.getByText("FOUNDRY")).toBeInTheDocument();
  });

  it("renders the FoundryMark SVG", () => {
    const { container } = render(<FoundryLogo variant="dark" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<FoundryLogo variant="dark" className="my-class" />);
    expect(container.firstChild).toHaveClass("my-class");
  });

  it("renders small size", () => {
    const { container } = render(<FoundryLogo size="sm" variant="dark" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "20");
  });

  it("renders large size", () => {
    const { container } = render(<FoundryLogo size="lg" variant="dark" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "40");
  });
});
