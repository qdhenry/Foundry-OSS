import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopRouteErrorBoundary } from "./DesktopRouteErrorBoundary";

const mocks = vi.hoisted(() => ({
  navigateDesktop: vi.fn(),
}));

vi.mock("../shims/navigation", () => ({
  navigateDesktop: (...args: unknown[]) => mocks.navigateDesktop(...args),
}));

function ThrowingChild() {
  throw new Error("Boundary boom");
}

describe("DesktopRouteErrorBoundary", () => {
  beforeEach(() => {
    mocks.navigateDesktop.mockReset();
  });

  it("renders fallback content when a route child throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      render(
        <DesktopRouteErrorBoundary routeId="tasks" pathname="/acme/tasks">
          <ThrowingChild />
        </DesktopRouteErrorBoundary>
      );

      expect(
        await screen.findByRole("heading", {
          name: "This page hit an unexpected error",
        })
      ).toBeInTheDocument();
      expect(screen.getByText("Boundary boom")).toBeInTheDocument();
      expect(screen.getByText("/acme/tasks")).toBeInTheDocument();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("navigates back to /programs from fallback action", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      render(
        <DesktopRouteErrorBoundary routeId="tasks" pathname="/acme/tasks">
          <ThrowingChild />
        </DesktopRouteErrorBoundary>
      );

      const user = userEvent.setup();
      await user.click(
        await screen.findByRole("button", { name: "Go to Programs" })
      );

      expect(mocks.navigateDesktop).toHaveBeenCalledWith("/programs", {
        replace: true,
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("resets fallback state when route changes", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const { rerender } = render(
        <DesktopRouteErrorBoundary routeId="tasks" pathname="/acme/tasks">
          <ThrowingChild />
        </DesktopRouteErrorBoundary>
      );

      await screen.findByRole("heading", {
        name: "This page hit an unexpected error",
      });

      rerender(
        <DesktopRouteErrorBoundary routeId="programOverview" pathname="/acme">
          <h1>Recovered route</h1>
        </DesktopRouteErrorBoundary>
      );

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Recovered route" })
        ).toBeInTheDocument();
      });
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
