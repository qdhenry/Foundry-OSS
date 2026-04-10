import { useEffect, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as convexReact from "convex/react";
import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SandboxHUDProvider,
  SandboxManagerPage,
  SandboxSettingsPage,
} from "@foundry/ui/sandbox";

const routeState = vi.hoisted(() => {
  function normalizePath(pathLike: string): string {
    const trimmed = pathLike.trim();
    if (!trimmed) {
      return "/sandboxes";
    }

    const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
    const withLeadingSlash = withoutHash.startsWith("/")
      ? withoutHash
      : `/${withoutHash}`;

    return withLeadingSlash.replace(/\/$/, "") || "/";
  }

  function setHash(pathLike: string): void {
    window.location.hash = `#${normalizePath(pathLike)}`;
  }

  const push = vi.fn((href: string) => {
    setHash(href);
  });

  const replace = vi.fn((href: string) => {
    setHash(href);
  });

  return {
    normalizePath,
    setHash,
    push,
    replace,
    prefetch: vi.fn(async () => undefined),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routeState.push,
    replace: routeState.replace,
    prefetch: routeState.prefetch,
    refresh: routeState.refresh,
    back: routeState.back,
    forward: routeState.forward,
  }),
  usePathname: () => routeState.normalizePath(window.location.hash.slice(1)),
}));

vi.mock("next/link", async () => {
  const React = await import("react");

  const NextLinkShim = React.forwardRef<
    HTMLAnchorElement,
    {
      href: string | { pathname?: string };
      children: React.ReactNode;
      onClick?: React.MouseEventHandler<HTMLAnchorElement>;
      className?: string;
    }
  >(({ href, children, onClick, ...rest }, ref) => {
    const targetPath =
      typeof href === "string"
        ? routeState.normalizePath(href)
        : routeState.normalizePath(href.pathname ?? "/sandboxes");

    return (
      <a
        {...rest}
        ref={ref}
        href={`#${targetPath}`}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) {
            return;
          }
          event.preventDefault();
          routeState.push(targetPath);
        }}
      >
        {children}
      </a>
    );
  });

  NextLinkShim.displayName = "NextLinkShim";

  return { default: NextLinkShim };
});

function getHashRoute(): string {
  return routeState.normalizePath(window.location.hash.slice(1));
}

function DesktopSharedUiAppHarness() {
  const [route, setRoute] = useState(() => getHashRoute());

  useEffect(() => {
    const syncRoute = () => {
      setRoute(getHashRoute());
    };

    window.addEventListener("hashchange", syncRoute);

    if (!window.location.hash) {
      routeState.setHash("/sandboxes");
    } else {
      syncRoute();
    }

    return () => {
      window.removeEventListener("hashchange", syncRoute);
    };
  }, []);

  return (
    <SandboxHUDProvider>
      {route === "/sandboxes/settings" ? (
        <SandboxSettingsPage />
      ) : (
        <SandboxManagerPage />
      )}
    </SandboxHUDProvider>
  );
}

function NextNavigationProbe() {
  const router = useRouter();

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push("/sandboxes/settings")}
      >
        Push Settings Route
      </button>
      <button type="button" onClick={() => router.replace("/sandboxes")}
      >
        Replace Manager Route
      </button>
    </div>
  );
}

describe("desktop shared-ui app integration", () => {
  beforeEach(() => {
    window.location.hash = "";

    routeState.push.mockClear();
    routeState.replace.mockClear();
    routeState.prefetch.mockClear();
    routeState.refresh.mockClear();
    routeState.back.mockClear();
    routeState.forward.mockClear();

    vi.spyOn(convexReact, "useMutation").mockReturnValue(vi.fn(async () => null));
    vi.spyOn(convexReact, "useAction").mockReturnValue(vi.fn(async () => null));
    vi.spyOn(convexReact, "useConvex").mockReturnValue({
      query: vi.fn(),
      mutation: vi.fn(async () => null),
      action: vi.fn(async () => null),
    } as any);

    vi.spyOn(convexReact, "useQuery").mockImplementation((queryName: unknown) => {
      switch (String(queryName)) {
        case "programs:list":
          return [];
        case "sandbox/sessions:listByOrg":
          return [];
        case "sandbox/configs:getByOrg":
          return {};
        case "sandbox/envVault:listByOrg":
          return [];
        case "sandbox/presets:listForOrg":
          return [];
        case "sandbox/aiProviders:listMine":
          return [];
        default:
          return [];
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.location.hash = "";
  });

  it("routes between #/sandboxes and #/sandboxes/settings via shared next/link navigation", async () => {
    routeState.setHash("/sandboxes");
    render(<DesktopSharedUiAppHarness />);

    expect(
      await screen.findByRole("heading", { name: "Sandbox Manager" })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/sandboxes");

    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "Sandbox Settings" }));

    expect(
      await screen.findByRole("heading", { name: "Sandbox Settings" })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/sandboxes/settings");

    await user.click(screen.getByRole("link", { name: "Back to Manager" }));
    expect(
      await screen.findByRole("heading", { name: "Sandbox Manager" })
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("#/sandboxes");
  });

  it("renders shared page headings when Clerk and Convex hooks are mocked", async () => {
    routeState.setHash("/sandboxes");
    const { rerender } = render(<DesktopSharedUiAppHarness />);

    expect(
      await screen.findByRole("heading", { name: "Sandbox Manager" })
    ).toBeInTheDocument();

    routeState.setHash("/sandboxes/settings");
    rerender(<DesktopSharedUiAppHarness />);

    expect(
      await screen.findByRole("heading", { name: "Sandbox Settings" })
    ).toBeInTheDocument();
  });

  it("supports next/navigation push and replace without crashing route updates", async () => {
    routeState.setHash("/sandboxes");
    render(
      <>
        <NextNavigationProbe />
        <DesktopSharedUiAppHarness />
      </>
    );

    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Push Settings Route" }));
    expect(routeState.push).toHaveBeenCalledWith("/sandboxes/settings");
    expect(window.location.hash).toBe("#/sandboxes/settings");
    expect(
      await screen.findByRole("heading", { name: "Sandbox Settings" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Replace Manager Route" }));
    expect(routeState.replace).toHaveBeenCalledWith("/sandboxes");
    expect(window.location.hash).toBe("#/sandboxes");
    expect(
      await screen.findByRole("heading", { name: "Sandbox Manager" })
    ).toBeInTheDocument();
  });
});
