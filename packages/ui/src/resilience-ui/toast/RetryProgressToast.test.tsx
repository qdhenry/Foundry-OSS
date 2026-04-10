import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RetryAttempt } from "../../resilience/types";
import { RetryProgressToast } from "./RetryProgressToast";

function makeAttempt(overrides?: Partial<RetryAttempt>): RetryAttempt {
  return {
    service: "convex",
    operationId: "op-1",
    operationLabel: "Test",
    attempt: 1,
    maxAttempts: 3,
    nextRetryAt: Date.now() + 5000,
    error: "timeout",
    status: "retrying",
    ...overrides,
  };
}

describe("RetryProgressToast", () => {
  it("renders service name and attempt count", () => {
    render(<RetryProgressToast attempt={makeAttempt()} />);
    expect(screen.getByText("Database")).toBeInTheDocument();
    expect(screen.getByText(/Attempt 1\/3/)).toBeInTheDocument();
  });

  it("shows cancel button when onCancel provided", () => {
    const onCancel = vi.fn();
    render(<RetryProgressToast attempt={makeAttempt()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("hides cancel button when no onCancel", () => {
    render(<RetryProgressToast attempt={makeAttempt()} />);
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("renders progress bar", () => {
    const { container } = render(
      <RetryProgressToast attempt={makeAttempt({ attempt: 2, maxAttempts: 4 })} />,
    );
    const bar = container.querySelector("[style]");
    expect(bar).toBeTruthy();
  });
});
