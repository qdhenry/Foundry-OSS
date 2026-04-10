import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorFallback } from "./ErrorFallback";

describe("ErrorFallback", () => {
  it("renders default title when no serviceName", () => {
    render(<ErrorFallback error={null} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders service-specific title", () => {
    render(<ErrorFallback error={null} serviceName="Database" />);
    expect(screen.getByText("Database is temporarily unavailable")).toBeInTheDocument();
  });

  it("shows non-critical description by default", () => {
    render(<ErrorFallback error={null} />);
    expect(screen.getByText(/Some features may be limited/)).toBeInTheDocument();
  });

  it("shows critical description when isCritical", () => {
    render(<ErrorFallback error={null} isCritical />);
    expect(screen.getByText(/requires a connection/)).toBeInTheDocument();
  });

  it("displays error message when provided", () => {
    render(<ErrorFallback error={new Error("Connection refused")} />);
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  it("truncates long error messages to 200 chars", () => {
    const longMsg = "x".repeat(300);
    render(<ErrorFallback error={new Error(longMsg)} />);
    const el = screen.getByText("x".repeat(200));
    expect(el).toBeInTheDocument();
  });

  it("renders retry button and calls onRetry", () => {
    const onRetry = vi.fn();
    render(<ErrorFallback error={null} onRetry={onRetry} />);
    fireEvent.click(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders dismiss button for non-critical errors", () => {
    const onDismiss = vi.fn();
    render(<ErrorFallback error={null} onDismiss={onDismiss} serviceName="GitHub" />);
    fireEvent.click(screen.getByText("Continue without github"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("hides dismiss button when isCritical", () => {
    const onDismiss = vi.fn();
    render(<ErrorFallback error={null} onDismiss={onDismiss} isCritical />);
    expect(screen.queryByText(/Continue without/)).not.toBeInTheDocument();
  });
});
