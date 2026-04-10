import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiskMatrix } from "./RiskMatrix";

describe("RiskMatrix", () => {
  it("renders Risk Matrix heading", () => {
    render(<RiskMatrix severity="medium" probability="possible" />);
    expect(screen.getByText("Risk Matrix")).toBeInTheDocument();
  });

  it("renders severity column headers", () => {
    render(<RiskMatrix severity="low" probability="unlikely" />);
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("renders probability row labels", () => {
    render(<RiskMatrix severity="low" probability="unlikely" />);
    expect(screen.getByText("Very Likely")).toBeInTheDocument();
    expect(screen.getByText("Likely")).toBeInTheDocument();
    expect(screen.getByText("Possible")).toBeInTheDocument();
    expect(screen.getByText("Unlikely")).toBeInTheDocument();
  });

  it("renders severity axis label", () => {
    render(<RiskMatrix severity="low" probability="unlikely" />);
    expect(screen.getByText(/Severity/)).toBeInTheDocument();
  });

  it("renders the active cell indicator (circle SVG)", () => {
    const { container } = render(<RiskMatrix severity="high" probability="likely" />);
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(1);
  });
});
