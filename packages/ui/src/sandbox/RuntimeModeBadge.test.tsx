import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RuntimeModeBadge } from "./RuntimeModeBadge";

describe("RuntimeModeBadge", () => {
  it("returns null for null mode", () => {
    const { container } = render(<RuntimeModeBadge mode={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null for undefined mode", () => {
    const { container } = render(<RuntimeModeBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null for empty string mode", () => {
    const { container } = render(<RuntimeModeBadge mode="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders known mode with correct label", () => {
    render(<RuntimeModeBadge mode="idle" />);
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("renders executing mode", () => {
    render(<RuntimeModeBadge mode="executing" />);
    expect(screen.getByText("Executing")).toBeInTheDocument();
  });

  it("renders interactive mode", () => {
    render(<RuntimeModeBadge mode="interactive" />);
    expect(screen.getByText("Interactive")).toBeInTheDocument();
  });

  it("renders unknown mode with formatted label", () => {
    render(<RuntimeModeBadge mode="custom_mode" />);
    expect(screen.getByText("Custom Mode")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<RuntimeModeBadge mode="idle" className="my-class" />);
    expect(container.firstChild).toHaveClass("my-class");
  });
});
