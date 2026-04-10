import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RuntimeModeBadge } from "./RuntimeModeBadge";

describe("RuntimeModeBadge", () => {
  it("returns null when mode is null", () => {
    const { container } = render(<RuntimeModeBadge mode={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when mode is undefined", () => {
    const { container } = render(<RuntimeModeBadge mode={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when mode is not a string", () => {
    const { container } = render(<RuntimeModeBadge mode={{} as any} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders Idle label for idle mode", () => {
    render(<RuntimeModeBadge mode="idle" />);
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("renders Executing label for executing mode", () => {
    render(<RuntimeModeBadge mode="executing" />);
    expect(screen.getByText("Executing")).toBeInTheDocument();
  });

  it("renders Interactive label for interactive mode", () => {
    render(<RuntimeModeBadge mode="interactive" />);
    expect(screen.getByText("Interactive")).toBeInTheDocument();
  });

  it("renders Hibernating label for hibernating mode", () => {
    render(<RuntimeModeBadge mode="hibernating" />);
    expect(screen.getByText("Hibernating")).toBeInTheDocument();
  });

  it("formats unknown mode labels from snake_case", () => {
    render(<RuntimeModeBadge mode="custom_mode" />);
    expect(screen.getByText("Custom Mode")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<RuntimeModeBadge mode="idle" className="mt-2" />);
    const badge = screen.getByText("Idle");
    expect(badge.className).toContain("mt-2");
  });
});
