import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SignIn, SignUp, useAuth, useClerk } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import {
  ProgramActivityRoute,
  ProgramAuditRoute,
  Header,
  ProgramDocumentUploadRoute,
  ProgramDocumentsRoute,
  ProgramGateDetailRoute,
  ProgramGateNewRoute,
  ProgramGatesRoute,
  ProgramDiscoveryRoute,
  ProgramIntegrationDetailRoute,
  ProgramIntegrationNewRoute,
  ProgramIntegrationsRoute,
  ProgramMissionControlRoute,
  ProgramOverviewRoute,
  ProgramPatternsRoute,
  ProgramPipelineLabRoute,
  ProgramPlaybookDetailRoute,
  ProgramPlaybookNewRoute,
  ProgramPlaybooksRoute,
  ProgramRiskDetailRoute,
  ProgramRiskNewRoute,
  ProgramRisksRoute,
  ProgramSettingsRoute,
  ProgramSkillDetailRoute,
  ProgramSkillNewRoute,
  ProgramSkillsRoute,
  ProgramSprintDetailRoute,
  ProgramSprintsRoute,
  ProgramTaskDetailRoute,
  ProgramTaskNewRoute,
  ProgramTasksRoute,
  ProgramVideoDetailRoute,
  ProgramVideoUploadRoute,
  ProgramVideosRoute,
  ProgramsPage,
  SearchProvider,
  Sidebar,
  ProgramWorkstreamDetailRoute,
  ProgramWorkstreamsRoute,
} from "./shared-shell";
import {
  SandboxHUDProvider,
  useSandboxHUD,
  type LocalLaunchHandler,
} from "@foundry/ui/sandbox/SandboxHUDContext";
import { SandboxHUD } from "@foundry/ui/sandbox/SandboxHUD";
import { SandboxConfigPanel } from "@foundry/ui/sandbox/SandboxConfigPanel";
import { SandboxManagerPage } from "@foundry/ui/sandbox/SandboxManagerPage";
import { SandboxSettingsPage } from "@foundry/ui/sandbox/SandboxSettingsPage";
import { DesktopFatalErrorOverlay } from "./components/DesktopFatalErrorOverlay";
import { DesktopRouteErrorBoundary } from "./components/DesktopRouteErrorBoundary";
import { logDesktop } from "./lib/desktop-logging";
import { getDesktopPathname, navigateDesktop } from "./shims/navigation";

type RouteId =
  | "signIn"
  | "signUp"
  | "programs"
  | "programOverview"
  | "missionControl"
  | "discovery"
  | "documents"
  | "documentsUpload"
  | "workstreams"
  | "workstreamDetail"
  | "tasks"
  | "taskNew"
  | "taskDetail"
  | "videos"
  | "videoUpload"
  | "videoDetail"
  | "sprints"
  | "sprintDetail"
  | "skills"
  | "skillNew"
  | "skillDetail"
  | "risks"
  | "riskNew"
  | "riskDetail"
  | "gates"
  | "gateNew"
  | "gateDetail"
  | "integrations"
  | "integrationNew"
  | "integrationDetail"
  | "playbooks"
  | "playbookNew"
  | "playbookDetail"
  | "patterns"
  | "pipelineLab"
  | "activity"
  | "audit"
  | "programSettings"
  | "manager"
  | "sandboxSettings";

interface RouteDefinition {
  id: RouteId;
  hideSidebar: boolean;
  render: () => ReactNode;
}

function RouteContent({
  route,
  fallback = null,
}: {
  route: RouteDefinition;
  fallback?: ReactNode;
}) {
  return <>{route.render() ?? fallback}</>;
}

const DESKTOP_AUTH_SCHEME =
  (import.meta.env.VITE_DESKTOP_AUTH_SCHEME as string | undefined)?.trim() ||
  "foundrydesktop";
const CLERK_TICKET_PARAM = "__clerk_ticket";

function isDesktopNativeBrowserAuthEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    import.meta.env.PROD &&
    window.location.protocol === "tauri:"
  );
}

function buildDesktopAuthCallbackUrl(targetPath: "/sign-in" | "/sign-up"): string {
  const callbackUrl = new URL(`${DESKTOP_AUTH_SCHEME}://auth/callback`);
  callbackUrl.searchParams.set("target", targetPath);
  return callbackUrl.toString();
}

function parseDesktopAuthCallbackUrl(rawUrl: string): URL | null {
  try {
    const parsedUrl = new URL(rawUrl);
    return parsedUrl.protocol === `${DESKTOP_AUTH_SCHEME}:` ? parsedUrl : null;
  } catch {
    return null;
  }
}

async function openExternalAuthUrl(url: string): Promise<void> {
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(url);
}

async function completeClerkSessionFromTicket(
  clerk: ReturnType<typeof useClerk>,
  ticket: string
): Promise<boolean> {
  const signInAttempt = await clerk.client?.signIn.create({
    strategy: "ticket",
    ticket,
  });
  if (signInAttempt?.status === "complete" && signInAttempt.createdSessionId) {
    await clerk.setActive({ session: signInAttempt.createdSessionId });
    return true;
  }

  const signUpAttempt = await clerk.client?.signUp.create({
    strategy: "ticket",
    ticket,
  });
  if (signUpAttempt?.status === "complete" && signUpAttempt.createdSessionId) {
    await clerk.setActive({ session: signUpAttempt.createdSessionId });
    return true;
  }

  return false;
}

function DesktopBrowserAuthRoute({ mode }: { mode: "signIn" | "signUp" }) {
  const clerk = useClerk();
  const [isOpeningBrowser, setIsOpeningBrowser] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processedTicketsRef = useRef<Set<string>>(new Set());

  const completeFromCallbackUrl = useCallback(
    async (rawUrl: string) => {
      const callbackUrl = parseDesktopAuthCallbackUrl(rawUrl);
      if (!callbackUrl) {
        return;
      }

      const ticket = callbackUrl.searchParams.get(CLERK_TICKET_PARAM)?.trim();
      if (!ticket || processedTicketsRef.current.has(ticket)) {
        return;
      }
      processedTicketsRef.current.add(ticket);

      setErrorMessage(null);
      setStatusMessage("Completing sign-in...");

      try {
        const completed = await completeClerkSessionFromTicket(clerk, ticket);
        if (!completed) {
          setStatusMessage(null);
          setErrorMessage(
            "The browser callback did not include a complete Clerk session. Please try again."
          );
          return;
        }

        setStatusMessage("Authentication complete. Redirecting...");
        navigateDesktop("/programs", { replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Clerk callback error.";
        logDesktop("error", "auth", "Desktop browser auth callback failed", {
          mode,
          error: message,
        });
        setStatusMessage(null);
        setErrorMessage(`Authentication callback failed: ${message}`);
      }
    },
    [clerk, mode]
  );

  useEffect(() => {
    if (!isDesktopNativeBrowserAuthEnabled()) {
      return;
    }

    let detachListener: (() => void) | undefined;
    let isActive = true;

    const attachDeepLinkListener = async () => {
      try {
        const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");

        const currentUrls = await getCurrent();
        if (isActive && Array.isArray(currentUrls)) {
          for (const url of currentUrls) {
            void completeFromCallbackUrl(url);
          }
        }

        const unlisten = await onOpenUrl((urls) => {
          for (const url of urls) {
            void completeFromCallbackUrl(url);
          }
        });

        if (!isActive) {
          unlisten();
          return;
        }

        detachListener = unlisten;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Deep-link listener initialization failed.";
        logDesktop("error", "auth", "Desktop deep-link listener setup failed", {
          mode,
          error: message,
        });
        setErrorMessage("Unable to listen for browser authentication callbacks.");
      }
    };

    void attachDeepLinkListener();

    return () => {
      isActive = false;
      if (detachListener) {
        detachListener();
      }
    };
  }, [completeFromCallbackUrl, mode]);

  const openBrowserFlow = useCallback(async () => {
    setErrorMessage(null);
    setStatusMessage("Opening browser...");
    setIsOpeningBrowser(true);

    try {
      const callbackUrl = buildDesktopAuthCallbackUrl(
        mode === "signIn" ? "/sign-in" : "/sign-up"
      );
      const authUrl =
        mode === "signIn"
          ? clerk.buildSignInUrl({ forceRedirectUrl: callbackUrl })
          : clerk.buildSignUpUrl({ forceRedirectUrl: callbackUrl });

      await openExternalAuthUrl(authUrl);
      setStatusMessage(
        mode === "signIn"
          ? "Finish signing in in your browser. This app will continue automatically."
          : "Finish signing up in your browser. This app will continue automatically."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to open browser authentication flow.";
      logDesktop("error", "auth", "Opening desktop browser auth flow failed", {
        mode,
        error: message,
      });
      setStatusMessage(null);
      setErrorMessage(`Unable to open browser flow: ${message}`);
    } finally {
      setIsOpeningBrowser(false);
    }
  }, [clerk, mode]);

  return (
    <div className="rounded-xl border border-border-default bg-surface-elevated p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Desktop Authentication
      </p>
      <h2 className="mt-2 text-lg font-semibold text-text-heading">
        {mode === "signIn" ? "Sign In In Browser" : "Sign Up In Browser"}
      </h2>
      <p className="mt-2 text-sm text-text-secondary">
        This production desktop build completes authentication through your default browser for
        reliable session handoff.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => void openBrowserFlow()}
          disabled={isOpeningBrowser}
        >
          {isOpeningBrowser
            ? "Opening browser..."
            : mode === "signIn"
              ? "Continue To Sign In"
              : "Continue To Sign Up"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-interactive-hover"
          onClick={() =>
            navigateDesktop(mode === "signIn" ? "/sign-up" : "/sign-in", { replace: true })
          }
        >
          {mode === "signIn" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>

      {statusMessage ? <p className="mt-4 text-xs text-text-secondary">{statusMessage}</p> : null}
      {errorMessage ? <p className="mt-2 text-xs text-status-error-fg">{errorMessage}</p> : null}
    </div>
  );
}

const ROUTES: Record<RouteId, RouteDefinition> = {
  signIn: {
    id: "signIn",
    hideSidebar: true,
    render: () =>
      isDesktopNativeBrowserAuthEnabled() ? (
        <DesktopBrowserAuthRoute mode="signIn" />
      ) : (
        <SignIn routing="hash" />
      ),
  },
  signUp: {
    id: "signUp",
    hideSidebar: true,
    render: () =>
      isDesktopNativeBrowserAuthEnabled() ? (
        <DesktopBrowserAuthRoute mode="signUp" />
      ) : (
        <SignUp routing="hash" />
      ),
  },
  programs: {
    id: "programs",
    hideSidebar: false,
    render: () => <ProgramsPage />,
  },
  programOverview: {
    id: "programOverview",
    hideSidebar: false,
    render: () => <ProgramOverviewRoute />,
  },
  missionControl: {
    id: "missionControl",
    hideSidebar: false,
    render: () => <ProgramMissionControlRoute />,
  },
  discovery: {
    id: "discovery",
    hideSidebar: false,
    render: () => <ProgramDiscoveryRoute />,
  },
  documents: {
    id: "documents",
    hideSidebar: false,
    render: () => <ProgramDocumentsRoute />,
  },
  documentsUpload: {
    id: "documentsUpload",
    hideSidebar: false,
    render: () => <ProgramDocumentUploadRoute />,
  },
  workstreams: {
    id: "workstreams",
    hideSidebar: false,
    render: () => <ProgramWorkstreamsRoute />,
  },
  workstreamDetail: {
    id: "workstreamDetail",
    hideSidebar: false,
    render: () => <ProgramWorkstreamDetailRoute />,
  },
  tasks: {
    id: "tasks",
    hideSidebar: false,
    render: () => <ProgramTasksRoute />,
  },
  taskNew: {
    id: "taskNew",
    hideSidebar: false,
    render: () => <ProgramTaskNewRoute />,
  },
  taskDetail: {
    id: "taskDetail",
    hideSidebar: false,
    render: () => <ProgramTaskDetailRoute />,
  },
  videos: {
    id: "videos",
    hideSidebar: false,
    render: () => <ProgramVideosRoute />,
  },
  videoUpload: {
    id: "videoUpload",
    hideSidebar: false,
    render: () => <ProgramVideoUploadRoute />,
  },
  videoDetail: {
    id: "videoDetail",
    hideSidebar: false,
    render: () => <ProgramVideoDetailRoute />,
  },
  sprints: {
    id: "sprints",
    hideSidebar: false,
    render: () => <ProgramSprintsRoute />,
  },
  sprintDetail: {
    id: "sprintDetail",
    hideSidebar: false,
    render: () => <ProgramSprintDetailRoute />,
  },
  skills: {
    id: "skills",
    hideSidebar: false,
    render: () => <ProgramSkillsRoute />,
  },
  skillNew: {
    id: "skillNew",
    hideSidebar: false,
    render: () => <ProgramSkillNewRoute />,
  },
  skillDetail: {
    id: "skillDetail",
    hideSidebar: false,
    render: () => <ProgramSkillDetailRoute />,
  },
  risks: {
    id: "risks",
    hideSidebar: false,
    render: () => <ProgramRisksRoute />,
  },
  riskNew: {
    id: "riskNew",
    hideSidebar: false,
    render: () => <ProgramRiskNewRoute />,
  },
  riskDetail: {
    id: "riskDetail",
    hideSidebar: false,
    render: () => <ProgramRiskDetailRoute />,
  },
  gates: {
    id: "gates",
    hideSidebar: false,
    render: () => <ProgramGatesRoute />,
  },
  gateNew: {
    id: "gateNew",
    hideSidebar: false,
    render: () => <ProgramGateNewRoute />,
  },
  gateDetail: {
    id: "gateDetail",
    hideSidebar: false,
    render: () => <ProgramGateDetailRoute />,
  },
  integrations: {
    id: "integrations",
    hideSidebar: false,
    render: () => <ProgramIntegrationsRoute />,
  },
  integrationNew: {
    id: "integrationNew",
    hideSidebar: false,
    render: () => <ProgramIntegrationNewRoute />,
  },
  integrationDetail: {
    id: "integrationDetail",
    hideSidebar: false,
    render: () => <ProgramIntegrationDetailRoute />,
  },
  playbooks: {
    id: "playbooks",
    hideSidebar: false,
    render: () => <ProgramPlaybooksRoute />,
  },
  playbookNew: {
    id: "playbookNew",
    hideSidebar: false,
    render: () => <ProgramPlaybookNewRoute />,
  },
  playbookDetail: {
    id: "playbookDetail",
    hideSidebar: false,
    render: () => <ProgramPlaybookDetailRoute />,
  },
  patterns: {
    id: "patterns",
    hideSidebar: false,
    render: () => <ProgramPatternsRoute />,
  },
  pipelineLab: {
    id: "pipelineLab",
    hideSidebar: false,
    render: () => <ProgramPipelineLabRoute />,
  },
  activity: {
    id: "activity",
    hideSidebar: false,
    render: () => <ProgramActivityRoute />,
  },
  audit: {
    id: "audit",
    hideSidebar: false,
    render: () => <ProgramAuditRoute />,
  },
  programSettings: {
    id: "programSettings",
    hideSidebar: false,
    render: () => <ProgramSettingsRoute />,
  },
  manager: {
    id: "manager",
    hideSidebar: true,
    render: () => <SandboxManagerPage />,
  },
  sandboxSettings: {
    id: "sandboxSettings",
    hideSidebar: true,
    render: () => <SandboxSettingsPage />,
  },
};

const KNOWN_ROOTS = new Set(["programs", "sandboxes", "sign-in", "sign-up"]);

function isAuthPathname(pathname: string): boolean {
  return pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
}

function isProgramScopedPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return Boolean(segments[0] && !KNOWN_ROOTS.has(segments[0]));
}

function getProgramScopedRoute(pathname: string): RouteDefinition | null {
  if (!isProgramScopedPath(pathname)) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const section = segments[1];
  const subSection = segments[2];
  const hasUnsupportedDepth = segments.length > 3;

  if (!section) {
    return ROUTES.programOverview;
  }
  if (hasUnsupportedDepth) {
    return ROUTES.programOverview;
  }

  switch (section) {
    case "mission-control":
      return ROUTES.programOverview;
    case "discovery":
      return subSection ? ROUTES.programOverview : ROUTES.discovery;
    case "documents":
      if (!subSection) return ROUTES.documents;
      if (subSection === "upload") return ROUTES.documentsUpload;
      return ROUTES.programOverview;
    case "workstreams":
      if (!subSection) return ROUTES.workstreams;
      return ROUTES.workstreamDetail;
    case "tasks":
      if (!subSection) return ROUTES.tasks;
      if (subSection === "new") return ROUTES.taskNew;
      return ROUTES.taskDetail;
    case "videos":
      if (!subSection) return ROUTES.videos;
      if (subSection === "upload") return ROUTES.videoUpload;
      return ROUTES.videoDetail;
    case "sprints":
      if (!subSection) return ROUTES.sprints;
      return ROUTES.sprintDetail;
    case "skills":
      if (!subSection) return ROUTES.skills;
      if (subSection === "new") return ROUTES.skillNew;
      return ROUTES.skillDetail;
    case "risks":
      if (!subSection) return ROUTES.risks;
      if (subSection === "new") return ROUTES.riskNew;
      return ROUTES.riskDetail;
    case "gates":
      if (!subSection) return ROUTES.gates;
      if (subSection === "new") return ROUTES.gateNew;
      return ROUTES.gateDetail;
    case "integrations":
      if (!subSection) return ROUTES.integrations;
      if (subSection === "new") return ROUTES.integrationNew;
      return ROUTES.integrationDetail;
    case "playbooks":
      if (!subSection) return ROUTES.playbooks;
      if (subSection === "new") return ROUTES.playbookNew;
      return ROUTES.playbookDetail;
    case "patterns":
      return subSection ? ROUTES.programOverview : ROUTES.patterns;
    case "pipeline-lab":
      return subSection ? ROUTES.programOverview : ROUTES.pipelineLab;
    case "activity":
      return subSection ? ROUTES.programOverview : ROUTES.activity;
    case "audit":
      return subSection ? ROUTES.programOverview : ROUTES.audit;
    case "settings":
      return subSection ? ROUTES.programOverview : ROUTES.programSettings;
    default:
      return ROUTES.programOverview;
  }
}

function getRouteFromPathname(pathname: string): RouteDefinition {
  if (pathname.startsWith("/sign-in")) {
    return ROUTES.signIn;
  }
  if (pathname.startsWith("/sign-up")) {
    return ROUTES.signUp;
  }
  if (pathname.startsWith("/sandboxes/settings")) {
    return ROUTES.sandboxSettings;
  }
  if (pathname.startsWith("/sandboxes")) {
    return ROUTES.manager;
  }
  if (pathname === "/" || pathname.startsWith("/programs")) {
    return ROUTES.programs;
  }

  const programScopedRoute = getProgramScopedRoute(pathname);
  if (programScopedRoute) {
    return programScopedRoute;
  }

  return ROUTES.programs;
}

function DesktopDashboardShell({
  route,
  pathname,
  isTasksRouteActive,
}: {
  route: RouteDefinition;
  pathname: string;
  isTasksRouteActive: boolean;
}) {
  if (route.id === "signIn" || route.id === "signUp") {
    return (
      <>
        <main className="flex min-h-screen items-center justify-center bg-surface-page p-6">
          <section className="w-full max-w-md">
            <DesktopRouteErrorBoundary routeId={route.id} pathname={pathname}>
              <RouteContent
                route={route}
                fallback={
                  <p className="text-center text-text-muted">
                    Loading authentication...
                  </p>
                }
              />
            </DesktopRouteErrorBoundary>
          </section>
        </main>
        <DesktopFatalErrorOverlay />
      </>
    );
  }

  const { isExpanded, tabs, isConfigPanelOpen, closeConfig } = useSandboxHUD();
  const hudHeight = tabs.length > 0 ? (isExpanded ? 400 : 36) : 0;

  useEffect(() => {
    if (!isTasksRouteActive && isConfigPanelOpen) {
      closeConfig();
    }
  }, [isTasksRouteActive, isConfigPanelOpen, closeConfig]);

  return (
    <main className="flex min-h-screen bg-surface-page">
      {!route.hideSidebar ? <Sidebar /> : null}
      <div className={`flex flex-1 flex-col ${!route.hideSidebar ? "ml-64" : ""}`}>
        <Header />
        <section
          className="flex-1 overflow-auto p-6"
          style={{ paddingBottom: hudHeight > 0 ? `calc(1.5rem + ${hudHeight}px)` : undefined }}
        >
          <DesktopRouteErrorBoundary routeId={route.id} pathname={pathname}>
            <RouteContent route={route} />
          </DesktopRouteErrorBoundary>
        </section>
      </div>
      <SandboxHUD />
      {isTasksRouteActive ? <SandboxConfigPanel /> : null}
      <DesktopFatalErrorOverlay />
      <style>{`:root { --hud-height: ${hudHeight}px; }`}</style>
    </main>
  );
}

export interface AppProps {
  localLaunchHandler?: LocalLaunchHandler;
}

export default function App({ localLaunchHandler }: AppProps = {}) {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();

  const guardedPathname = useMemo(() => {
    if (!isLoaded) {
      return pathname;
    }

    if (pathname === "/") {
      return isSignedIn ? "/programs" : "/sign-in";
    }

    if (isAuthPathname(pathname)) {
      return isSignedIn ? "/programs" : pathname;
    }

    return isSignedIn ? pathname : "/sign-in";
  }, [isLoaded, isSignedIn, pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || !isLoaded) return;

    const hasDesktopHashRoute = window.location.hash.startsWith("#/");
    const currentPathname = getDesktopPathname(window.location);
    if (!hasDesktopHashRoute || currentPathname !== guardedPathname) {
      navigateDesktop(guardedPathname, { replace: true });
    }
  }, [guardedPathname, isLoaded]);

  const activeRoute = useMemo(() => getRouteFromPathname(guardedPathname), [guardedPathname]);
  const isTasksRouteActive =
    activeRoute.id === "tasks" ||
    activeRoute.id === "taskNew" ||
    activeRoute.id === "taskDetail";

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    logDesktop("info", "routing", "Resolved desktop route", {
      pathname: guardedPathname,
      routeId: activeRoute.id,
      isTasksRouteActive,
      hideSidebar: activeRoute.hideSidebar,
    });
  }, [activeRoute.hideSidebar, activeRoute.id, guardedPathname, isLoaded, isTasksRouteActive]);

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-default">
        <p className="text-text-muted">Loading...</p>
      </main>
    );
  }

  return (
    <SearchProvider>
      <SandboxHUDProvider localLaunchHandler={localLaunchHandler}>
        <DesktopRouteErrorBoundary
          routeId={`app:${activeRoute.id}`}
          pathname={guardedPathname}
        >
          <DesktopDashboardShell
            route={activeRoute}
            pathname={guardedPathname}
            isTasksRouteActive={isTasksRouteActive}
          />
        </DesktopRouteErrorBoundary>
      </SandboxHUDProvider>
    </SearchProvider>
  );
}
