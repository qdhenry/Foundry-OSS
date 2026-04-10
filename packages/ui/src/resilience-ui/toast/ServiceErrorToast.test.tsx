import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServiceErrorToast } from "./ServiceErrorToast";

describe("ServiceErrorToast", () => {
  it("renders service display name with unavailable", () => {
    render(<ServiceErrorToast service="github" />);
    expect(screen.getByText("GitHub unavailable")).toBeInTheDocument();
  });

  it("shows error message when provided", () => {
    render(<ServiceErrorToast service="convex" message="Connection refused" />);
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("truncates long messages to 150 chars", () => {
    const longMsg = "x".repeat(200);
    render(<ServiceErrorToast service="convex" message={longMsg} />);
    expect(screen.getByText("x".repeat(150))).toBeInTheDocument();
  });

  it("shows retry button when onRetry provided", () => {
    const onRetry = vi.fn();
    render(<ServiceErrorToast service="convex" onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Retry now"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("hides retry button when no onRetry", () => {
    render(<ServiceErrorToast service="convex" />);
    expect(screen.queryByText("Retry now")).not.toBeInTheDocument();
  });
});
