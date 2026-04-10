import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopFatalErrorOverlay } from "./DesktopFatalErrorOverlay";
import { DESKTOP_FATAL_ERROR_EVENT } from "../lib/desktop-logging";

const mocks = vi.hoisted(() => ({
  navigateDesktop: vi.fn(),
}));

vi.mock("../shims/navigation", () => ({
  navigateDesktop: (...args: unknown[]) => mocks.navigateDesktop(...args),
}));

describe("DesktopFatalErrorOverlay", () => {
  beforeEach(() => {
    window.__FOUNDRY_DESKTOP_FATAL_ERROR__ = null;
    mocks.navigateDesktop.mockReset();
  });

  it("renders nothing when there is no fatal runtime error", () => {
    render(<DesktopFatalErrorOverlay />);
    expect(screen.queryByText("Runtime Error")).not.toBeInTheDocument();
  });

  it("shows current fatal error and supports dismiss", async () => {
    window.__FOUNDRY_DESKTOP_FATAL_ERROR__ = {
      timestamp: new Date().toISOString(),
      pathname: "/acme/tasks/task-1",
      source: "window.error",
      message: "TypeError: No default value",
    };

    render(<DesktopFatalErrorOverlay />);

    expect(screen.getByText("TypeError: No default value")).toBeInTheDocument();
    expect(screen.getByText("/acme/tasks/task-1")).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("TypeError: No default value")).not.toBeInTheDocument();
    expect(window.__FOUNDRY_DESKTOP_FATAL_ERROR__).toBeNull();
  });

  it("responds to fatal error events and provides route recovery action", async () => {
    render(<DesktopFatalErrorOverlay />);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(DESKTOP_FATAL_ERROR_EVENT, {
          detail: {
            timestamp: new Date().toISOString(),
            pathname: "/acme/tasks/task-2",
            source: "unhandledrejection",
            message: "Unhandled promise rejection",
          },
        })
      );
    });

    expect(
      await screen.findByText("Unhandled promise rejection")
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Go to Programs" }));

    expect(mocks.navigateDesktop).toHaveBeenCalledWith("/programs", {
      replace: true,
    });
  });
});
