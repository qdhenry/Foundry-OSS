import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiskMatrix } from "./RiskMatrix";

describe("RiskMatrix", () => {
  it("renders the heading", () => {
    render(<RiskMatrix severity="high" probability="likely" />);
    expect(screen.getByText("Risk Matrix")).toBeInTheDocument();
  });

  it("renders severity column headers", () => {
    render(<RiskMatrix severity="medium" probability="possible" />);
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });

  it("renders probability row headers", () => {
    render(<RiskMatrix severity="medium" probability="possible" />);
    expect(screen.getByText("Unlikely")).toBeInTheDocument();
    expect(screen.getByText("Possible")).toBeInTheDocument();
    expect(screen.getByText("Likely")).toBeInTheDocument();
    expect(screen.getByText("Very Likely")).toBeInTheDocument();
  });

  it("renders the active cell indicator", () => {
    const { container } = render(<RiskMatrix severity="high" probability="likely" />);
    const activeCellSvg = container.querySelector("svg circle");
    expect(activeCellSvg).not.toBeNull();
  });

  it("renders severity axis label", () => {
    render(<RiskMatrix severity="low" probability="unlikely" />);
    expect(screen.getByText(/Severity/)).toBeInTheDocument();
  });
});
