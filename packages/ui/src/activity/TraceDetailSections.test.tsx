import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CostSection, OutputSection } from "./TraceDetailSections";

describe("OutputSection", () => {
  it("renders formatted output", () => {
    render(<OutputSection output="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("pretty-prints JSON output", () => {
    render(<OutputSection output='{"key":"value"}' />);
    expect(screen.getByText(/"key": "value"/)).toBeInTheDocument();
  });

  it("shows prompt toggle when input is provided", () => {
    render(<OutputSection output="output" input="prompt text" />);
    expect(screen.getByText("Show prompt")).toBeInTheDocument();
  });

  it("toggles prompt visibility on click", () => {
    render(<OutputSection output="output" input="my prompt" />);
    fireEvent.click(screen.getByText("Show prompt"));
    expect(screen.getByText("my prompt")).toBeInTheDocument();
    expect(screen.getByText("Hide prompt")).toBeInTheDocument();
  });

  it("does not show toggle when no input", () => {
    render(<OutputSection output="output" />);
    expect(screen.queryByText("Show prompt")).not.toBeInTheDocument();
  });
});

describe("CostSection", () => {
  const costBreakdown = {
    inputTokens: 10000,
    outputTokens: 5000,
    cacheReadTokens: 8000,
    cacheCreationTokens: 2000,
    costUsd: 0.045,
    modelId: "claude-sonnet-4-5-20250514",
  };

  it("renders cost heading", () => {
    render(<CostSection costBreakdown={costBreakdown} />);
    expect(screen.getByText("Cost & Performance")).toBeInTheDocument();
  });

  it("renders token values", () => {
    render(<CostSection costBreakdown={costBreakdown} />);
    expect(screen.getByText("10.0K")).toBeInTheDocument();
    expect(screen.getByText("5.0K")).toBeInTheDocument();
  });

  it("renders cache hit rate percentage", () => {
    render(<CostSection costBreakdown={costBreakdown} />);
    expect(screen.getByText("(80%)")).toBeInTheDocument();
  });
});
