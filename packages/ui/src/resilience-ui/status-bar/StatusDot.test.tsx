import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusDot } from "./StatusDot";

describe("StatusDot", () => {
  it("renders with healthy status", () => {
    render(<StatusDot status="healthy" />);
    const dot = screen.getByRole("status");
    expect(dot).toHaveAttribute("aria-label", "Status: healthy");
  });

  it("renders with outage status", () => {
    render(<StatusDot status="outage" />);
    const dot = screen.getByRole("status");
    expect(dot).toHaveAttribute("aria-label", "Status: outage");
  });

  it("renders with degraded status", () => {
    render(<StatusDot status="degraded" />);
    const dot = screen.getByRole("status");
    expect(dot).toHaveAttribute("aria-label", "Status: degraded");
  });

  it("renders with unknown status", () => {
    render(<StatusDot status="unknown" />);
    const dot = screen.getByRole("status");
    expect(dot).toHaveAttribute("aria-label", "Status: unknown");
  });
});
