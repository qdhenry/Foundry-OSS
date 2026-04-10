import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const hudState = vi.hoisted(() => ({
  isExpanded: false,
  tabs: [],
  isConfigPanelOpen: false,
  closeConfig: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  isLoaded: true,
  isSignedIn: true,
}));

const routeRenderState = vi.hoisted(() => ({
  throwTasksRoute: false,
  throwSandboxHud: false,
}));

vi.mock("next/navigation", async () => {
  return await import("./shims/next-navigation");
});

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => authState,
  SignIn: () => <h1>Sign In</h1>,
  SignUp: () => <h1>Sign Up</h1>,
}));

vi.mock("./shared-shell", () => ({
  Header: () => <header>Desktop Header</header>,
  Sidebar: () => <aside data-testid="desktop-sidebar">Desktop Sidebar</aside>,
  SearchProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  ProgramsPage: () => <h1>Programs</h1>,
  ProgramOverviewRoute: () => <h1>Program Overview</h1>,
  ProgramMissionControlRoute: () => <h1>Mission Control</h1>,
  ProgramDiscoveryRoute: () => <h1>Discovery</h1>,
  ProgramDocumentsRoute: () => <h1>Documents</h1>,
  ProgramDocumentUploadRoute: () => <h1>Document Upload</h1>,
  ProgramWorkstreamsRoute: () => <h1>Workstreams</h1>,
  ProgramWorkstreamDetailRoute: () => <h1>Workstream Detail</h1>,
  ProgramTasksRoute: () => {
    if (routeRenderState.throwTasksRoute) {
      throw new Error("Task route exploded");
    }
    return <h1>Tasks</h1>;
  },
  ProgramTaskNewRoute: () => <h1>New Task</h1>,
  ProgramTaskDetailRoute: () => <h1>Task Detail</h1>,
  ProgramVideosRoute: () => <h1>Videos</h1>,
  ProgramVideoUploadRoute: () => <h1>Video Upload</h1>,
  ProgramVideoDetailRoute: () => <h1>Video Detail</h1>,
  ProgramSprintsRoute: () => <h1>Sprints</h1>,
  ProgramSprintDetailRoute: () => <h1>Sprint Detail</h1>,
  ProgramSkillsRoute: () => <h1>Skills</h1>,
  ProgramSkillNewRoute: () => <h1>New Skill</h1>,
  ProgramSkillDetailRoute: () => <h1>Skill Detail</h1>,
  ProgramRisksRoute: () => <h1>Risks</h1>,
  ProgramRiskNewRoute: () => <h1>New Risk</h1>,
  ProgramRiskDetailRoute: () => <h1>Risk Detail</h1>,
  ProgramGatesRoute: () => <h1>Gates</h1>,
  ProgramGateNewRoute: () => <h1>New Gate</h1>,
  ProgramGateDetailRoute: () => <h1>Gate Detail</h1>,
  ProgramIntegrationsRoute: () => <h1>Integrations</h1>,
  ProgramIntegrationNewRoute: () => <h1>New Integration</h1>,
  ProgramIntegrationDetailRoute: () => <h1>Integration Detail</h1>,
  ProgramPlaybooksRoute: () => <h1>Playbooks</h1>,
  ProgramPlaybookNewRoute: () => <h1>New Playbook</h1>,
  ProgramPlaybookDetailRoute: () => <h1>Playbook Detail</h1>,
  ProgramPatternsRoute: () => <h1>Patterns</h1>,
  ProgramPipelineLabRoute: () => <h1>Pipeline Lab</h1>,
  ProgramActivityRoute: () => <h1>Activity</h1>,
  ProgramAuditRoute: () => <h1>Audit</h1>,
  ProgramSettingsRoute: () => <h1>Program Settings</h1>,
}));

vi.mock("@foundry/ui/sandbox/SandboxHUDContext", () => ({
  SandboxHUDProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSandboxHUD: () => hudState,
}));

vi.mock("@foundry/ui/sandbox/SandboxHUD", () => ({
  SandboxHUD: () => {
    if (routeRenderState.throwSandboxHud) {
      throw new Error("Sandbox HUD exploded");
    }
    return <div data-testid="sandbox-hud" />;
  },
}));

vi.mock("@foundry/ui/sandbox/SandboxConfigPanel", () => ({
  SandboxConfigPanel: () => <div data-testid="sandbox-config" />,
}));

vi.mock("@foundry/ui/sandbox/SandboxManagerPage", () => ({
  SandboxManagerPage: () => <h1>Sandbox Manager</h1>,
}));

vi.mock("@foundry/ui/sandbox/SandboxSettingsPage", () => ({
  SandboxSettingsPage: () => <h1>Sandbox Settings</h1>,
}));

function setHashRoute(path?: string): void {
  window.history.replaceState({}, "", "/");
  if (path) {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    window.location.hash = normalized;
  }
}

let App: (typeof import("./App"))["default"];

const PROGRAM_ROUTE_CASES: Array<{
  path: string;
  heading: string;
  showsConfig?: boolean;
}> = [
  { path: "/acme", heading: "Program Overview" },
  { path: "/acme/mission-control", heading: "Program Overview" },
  { path: "/acme/discovery", heading: "Discovery" },
  { path: "/acme/documents", heading: "Documents" },
  { path: "/acme/documents/upload", heading: "Document Upload" },
  { path: "/acme/workstreams", heading: "Workstreams" },
  { path: "/acme/workstreams/ws-1", heading: "Workstream Detail" },
  { path: "/acme/tasks", heading: "Tasks", showsConfig: true },
  { path: "/acme/tasks/new", heading: "New Task", showsConfig: true },
  { path: "/acme/tasks/task-123", heading: "Task Detail", showsConfig: true },
  { path: "/acme/videos", heading: "Videos" },
  { path: "/acme/videos/upload", heading: "Video Upload" },
  { path: "/acme/videos/analysis-1", heading: "Video Detail" },
  { path: "/acme/sprints", heading: "Sprints" },
  { path: "/acme/sprints/sprint-1", heading: "Sprint Detail" },
  { path: "/acme/skills", heading: "Skills" },
  { path: "/acme/skills/new", heading: "New Skill" },
  { path: "/acme/skills/skill-1", heading: "Skill Detail" },
  { path: "/acme/risks", heading: "Risks" },
  { path: "/acme/risks/new", heading: "New Risk" },
  { path: "/acme/risks/risk-1", heading: "Risk Detail" },
  { path: "/acme/gates", heading: "Gates" },
  { path: "/acme/gates/new", heading: "New Gate" },
  { path: "/acme/gates/gate-1", heading: "Gate Detail" },
  { path: "/acme/integrations", heading: "Integrations" },
  { path: "/acme/integrations/new", heading: "New Integration" },
  { path: "/acme/integrations/int-1", heading: "Integration Detail" },
  { path: "/acme/playbooks", heading: "Playbooks" },
  { path: "/acme/playbooks/new", heading: "New Playbook" },
  { path: "/acme/playbooks/pb-1", heading: "Playbook Detail" },
  { path: "/acme/patterns", heading: "Patterns" },
  { path: "/acme/pipeline-lab", heading: "Pipeline Lab" },
  { path: "/acme/activity", heading: "Activity" },
  { path: "/acme/audit", heading: "Audit" },
  { path: "/acme/settings", heading: "Program Settings" },
];

describe("desktop App routes", () => {
  beforeAll(async () => {
    App = (await import("./App")).default;
  });

  beforeEach(() => {
    setHashRoute();
    authState.isLoaded = true;
    authState.isSignedIn = true;
    routeRenderState.throwTasksRoute = false;
    routeRenderState.throwSandboxHud = false;
    hudState.isConfigPanelOpen = false;
    hudState.closeConfig.mockReset();
  });

  it("defaults to /programs when no desktop hash route exists", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Programs" })).toBeInTheDocument();
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    expect(screen.queryByTestId("sandbox-config")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.hash).toBe("#/programs");
    });
  });

  it("shows a loading screen while auth state is unresolved", () => {
    authState.isLoaded = false;
    setHashRoute("/programs");
    render(<App />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Programs" })).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#/programs");
  });

  it("does not trigger hook-order errors when auth resolves from loading to loaded", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      authState.isLoaded = false;
      authState.isSignedIn = false;
      setHashRoute("/programs");
      const { rerender } = render(<App />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();

      authState.isLoaded = true;
      rerender(<App />);

      expect(await screen.findByRole("heading", { name: "Sign In" })).toBeInTheDocument();
      expect(
        consoleErrorSpy.mock.calls.some(([firstArg]) =>
          typeof firstArg === "string" && firstArg.includes("change in the order of Hooks")
        )
      ).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("redirects root to /sign-in when auth is loaded and the user is signed out", async () => {
    authState.isSignedIn = false;
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.hash).toBe("#/sign-in");
    });
  });

  it("canonicalizes path-only /sign-in launches to desktop hash routing", async () => {
    authState.isSignedIn = false;
    window.history.replaceState({}, "", "/sign-in");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.hash).toBe("#/sign-in");
    });
  });

  it("redirects protected routes to /sign-in when auth is loaded and the user is signed out", async () => {
    authState.isSignedIn = false;
    setHashRoute("/programs");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.hash).toBe("#/sign-in");
    });
  });

  it("redirects signed-in users away from /sign-in to /programs", async () => {
    setHashRoute("/sign-in");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Programs" })).toBeInTheDocument();
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.hash).toBe("#/programs");
    });
  });

  it("renders /sign-in and /sign-up auth route screens when signed out", async () => {
    authState.isSignedIn = false;

    setHashRoute("/sign-in");
    const { rerender } = render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#/sign-in");

    setHashRoute("/sign-up");
    rerender(<App />);

    expect(await screen.findByRole("heading", { name: "Sign Up" })).toBeInTheDocument();
    expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#/sign-up");
  });

  it("renders sandbox manager on /sandboxes and hides the sidebar shell", async () => {
    setHashRoute("/sandboxes");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sandbox Manager" })).toBeInTheDocument();
    expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sandbox-config")).not.toBeInTheDocument();
  });

  it("renders workstreams list route for /:programId/workstreams", async () => {
    setHashRoute("/acme/workstreams");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Workstreams" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Workstream Detail" })).not.toBeInTheDocument();
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    expect(screen.queryByTestId("sandbox-config")).not.toBeInTheDocument();
  });

  it.each(PROGRAM_ROUTE_CASES)(
    "renders $heading route for $path",
    async ({ path, heading, showsConfig }) => {
      setHashRoute(path);
      render(<App />);

      expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
      expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
      if (showsConfig) {
        expect(screen.getByTestId("sandbox-config")).toBeInTheDocument();
      } else {
        expect(screen.queryByTestId("sandbox-config")).not.toBeInTheDocument();
      }
    }
  );

  it("renders sandbox settings on /sandboxes/settings", async () => {
    setHashRoute("/sandboxes/settings");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sandbox Settings" })).toBeInTheDocument();
    expect(screen.queryByTestId("desktop-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sandbox-config")).not.toBeInTheDocument();
  });

  it("falls back to program overview for unknown program-scoped routes", async () => {
    setHashRoute("/acme/not-supported");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Program Overview" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Programs" })).not.toBeInTheDocument();
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    expect(screen.queryByTestId("sandbox-config")).not.toBeInTheDocument();
  });

  it("falls back to program overview for unsupported nested task paths", async () => {
    setHashRoute("/acme/tasks/task-123/unsupported");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Program Overview" })).toBeInTheDocument();
    expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    expect(screen.queryByTestId("sandbox-config")).not.toBeInTheDocument();
  });

  it("closes sandbox config state after leaving /tasks routes", async () => {
    hudState.isConfigPanelOpen = true;
    setHashRoute("/acme/tasks/task-123");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Task Detail" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Programs" })).not.toBeInTheDocument();
    expect(screen.getByTestId("sandbox-config")).toBeInTheDocument();

    setHashRoute("/programs");
    await waitFor(() => {
      expect(hudState.closeConfig).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId("sandbox-config")).not.toBeInTheDocument();
  });

  it("shows a route error boundary fallback instead of crashing when tasks route throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      routeRenderState.throwTasksRoute = true;
      setHashRoute("/acme/tasks");
      render(<App />);

      expect(
        await screen.findByRole("heading", {
          name: "This page hit an unexpected error",
        })
      ).toBeInTheDocument();
      expect(screen.getByText("Task route exploded")).toBeInTheDocument();
      expect(screen.getByTestId("desktop-sidebar")).toBeInTheDocument();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("shows app-shell boundary fallback when shared HUD crashes", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      routeRenderState.throwSandboxHud = true;
      setHashRoute("/acme/tasks");
      render(<App />);

      expect(
        await screen.findByRole("heading", {
          name: "This page hit an unexpected error",
        })
      ).toBeInTheDocument();
      expect(screen.getByText("Sandbox HUD exploded")).toBeInTheDocument();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
