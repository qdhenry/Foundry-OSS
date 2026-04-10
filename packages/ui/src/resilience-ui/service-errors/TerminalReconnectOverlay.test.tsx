import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TerminalReconnectOverlay } from "./TerminalReconnectOverlay";

describe("TerminalReconnectOverlay", () => {
  it("renders attempt count", () => {
    render(
      <TerminalReconnectOverlay
        attempt={2}
        maxAttempts={5}
        nextRetryAt={Date.now() + 3000}
        onCancel={vi.fn()}
        onManualConnect={vi.fn()}
      />,
    );
    expect(screen.getByText(/attempt 2\/5/)).toBeInTheDocument();
  });

  it("renders connection lost message", () => {
    render(
      <TerminalReconnectOverlay
        attempt={1}
        maxAttempts={3}
        nextRetryAt={Date.now() + 1000}
        onCancel={vi.fn()}
        onManualConnect={vi.fn()}
      />,
    );
    expect(screen.getByText("Connection lost")).toBeInTheDocument();
  });

  it("calls onCancel when Cancel clicked", () => {
    const onCancel = vi.fn();
    render(
      <TerminalReconnectOverlay
        attempt={1}
        maxAttempts={3}
        nextRetryAt={Date.now() + 1000}
        onCancel={onCancel}
        onManualConnect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onManualConnect when Connect manually clicked", () => {
    const onManualConnect = vi.fn();
    render(
      <TerminalReconnectOverlay
        attempt={1}
        maxAttempts={3}
        nextRetryAt={Date.now() + 1000}
        onCancel={vi.fn()}
        onManualConnect={onManualConnect}
      />,
    );
    fireEvent.click(screen.getByText("Connect manually"));
    expect(onManualConnect).toHaveBeenCalledTimes(1);
  });
});
