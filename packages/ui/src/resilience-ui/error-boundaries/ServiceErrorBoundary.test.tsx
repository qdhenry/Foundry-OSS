import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServiceErrorBoundary } from "./ServiceErrorBoundary";

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error");
  return <div>Safe content</div>;
}

describe("ServiceErrorBoundary", () => {
  // Suppress React error boundary console.error noise
  const origError = console.error;
  beforeAll(() => {
    console.error = vi.fn();
  });
  afterAll(() => {
    console.error = origError;
  });

  it("renders children when no error", () => {
    render(
      <ServiceErrorBoundary>
        <div>Hello</div>
      </ServiceErrorBoundary>,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders ErrorFallback on child error", () => {
    render(
      <ServiceErrorBoundary>
        <ThrowingChild shouldThrow />
      </ServiceErrorBoundary>,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("shows service-specific message when service prop provided", () => {
    render(
      <ServiceErrorBoundary service="convex">
        <ThrowingChild shouldThrow />
      </ServiceErrorBoundary>,
    );
    expect(screen.getByText("Database is temporarily unavailable")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ServiceErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingChild shouldThrow />
      </ServiceErrorBoundary>,
    );
    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
  });

  it("calls onError callback on error", () => {
    const onError = vi.fn();
    render(
      <ServiceErrorBoundary onError={onError}>
        <ThrowingChild shouldThrow />
      </ServiceErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });
});
