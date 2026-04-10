import {
  createContext,
  StrictMode,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import {
  SandboxBackendProvider,
} from "@foundry/ui/backend";
import { ThemeProvider } from "@foundry/ui/theme";
import { SETUP_STAGE_SEQUENCE, type RuntimeMode } from "@foundry/types/sandbox";
import App from "./App";
import {
  buildLocalDeviceId,
  resolveLocalDeviceInfo,
  useLocalLaunch,
} from "./hooks/useLocalLaunch";
import { installDesktopGlobalErrorLogging, logDesktop } from "./lib/desktop-logging";
import { createLocalSandboxBackend } from "./lib/local-backend";
import { TauriBridgeUnavailableError, tauriBridge } from "./lib/tauri-bridge";
import { navigateDesktop } from "./shims/navigation";
import "./styles.css";

interface DesktopShellContextValue {
  apiBaseUrl: string;
  runtimeMode: RuntimeMode;
  setupStageSequence: readonly string[];
}

const DesktopShellContext = createContext<DesktopShellContextValue | null>(null);

function readStringEnvValue(key: string): string | undefined {
  const rawValue = (import.meta.env as Record<string, unknown>)[key];
  if (typeof rawValue !== "string") {
    return undefined;
  }
  const trimmedValue = rawValue.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function resolveClerkPublishableKey(): string | undefined {
  return (
    readStringEnvValue("VITE_CLERK_PUBLISHABLE_KEY") ??
    readStringEnvValue("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
  );
}

function resolveDesktopAuthScheme(): string {
  const configuredScheme = readStringEnvValue("VITE_DESKTOP_AUTH_SCHEME");
  return configuredScheme ?? "foundrydesktop";
}

function isClerkDevelopmentPublishableKey(publishableKey: string | undefined): boolean {
  return typeof publishableKey === "string" && publishableKey.startsWith("pk_test_");
}

function DesktopConvexFallback({ issue }: { issue: string }) {
  return (
    <main className="desktop-fallback">
      <section className="desktop-fallback-card">
        <p className="desktop-fallback-eyebrow">Sandbox Disabled</p>
        <h1>Convex connection is not configured</h1>
        <p>
          Shared sandbox pages require a Convex URL. Set
          ` VITE_CONVEX_URL ` in the desktop environment, then restart the app.
        </p>
        <p className="desktop-fallback-detail">{issue}</p>
      </section>
    </main>
  );
}

function DesktopAuthFallback({ issue }: { issue?: string }) {
  return (
    <main className="desktop-fallback">
      <section className="desktop-fallback-card">
        <p className="desktop-fallback-eyebrow">Authentication Disabled</p>
        <h1>Clerk is not configured</h1>
        <p>
          Desktop auth requires a Clerk publishable key. Set
          ` VITE_CLERK_PUBLISHABLE_KEY ` (or ` NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY `),
          then restart the app.
        </p>
        {issue ? <p className="desktop-fallback-detail">{issue}</p> : null}
      </section>
    </main>
  );
}

function DesktopConvexSyncBootstrap({ convexUrl }: { convexUrl: string | null }) {
  const { getToken, isLoaded, isSignedIn, sessionId, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    let isCancelled = false;

    const syncConvexConfig = async () => {
      try {
        let token: string | null = null;
        if (isSignedIn) {
          try {
            token = await getToken({ template: "convex" });
          } catch {
            token = null;
          }

          if (!token) {
            token = await getToken();
          }
        }

        if (isCancelled) {
          return;
        }

        const { localDeviceId, localDeviceName } = resolveLocalDeviceInfo();
        const syncDeviceId = buildLocalDeviceId(
          localDeviceId,
          userId ?? undefined,
          sessionId ?? undefined
        );
        await tauriBridge.configureConvexSync({
          baseUrl: convexUrl ?? "",
          authToken: typeof token === "string" ? token : "",
          localDeviceId: syncDeviceId,
          localDeviceName,
        });
      } catch (error) {
        if (error instanceof TauriBridgeUnavailableError) {
          return;
        }

        console.warn("Failed to configure desktop Convex sync runtime.", error);
      }
    };

    void syncConvexConfig();
    let refreshInterval: number | null = null;

    if (typeof window !== "undefined" && isSignedIn) {
      refreshInterval = window.setInterval(() => {
        void syncConvexConfig();
      }, 10 * 60 * 1_000);
    }

    return () => {
      isCancelled = true;
      if (refreshInterval !== null) {
        window.clearInterval(refreshInterval);
      }
    };
  }, [convexUrl, getToken, isLoaded, isSignedIn, sessionId, userId]);

  return null;
}

function DesktopAppWithLocalLaunch() {
  const localLaunchHandler = useLocalLaunch();
  return <App localLaunchHandler={localLaunchHandler} />;
}

export function DesktopShellProvider() {
  const backend = useMemo(() => createLocalSandboxBackend(), []);
  const clerkPublishableKey = useMemo(() => resolveClerkPublishableKey(), []);
  const desktopAuthScheme = useMemo(() => resolveDesktopAuthScheme(), []);
  const convexUrl = (import.meta.env.VITE_CONVEX_URL as string | undefined)?.trim();
  const isTestMode = import.meta.env.MODE === "test";
  const isTauriProtocol =
    typeof window !== "undefined" && window.location.protocol === "tauri:";
  const isProductionBuild = import.meta.env.PROD;
  const allowedRedirectProtocols = useMemo(
    () =>
      Array.from(
        new Set([
          "http",
          "https",
          "tauri",
          desktopAuthScheme,
          "http:",
          "https:",
          "tauri:",
          `${desktopAuthScheme}:`,
        ])
      ),
    [desktopAuthScheme]
  );
  const allowedRedirectOrigins = useMemo(
    () => [
      /^https?:\/\/localhost(?::\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
      "tauri://localhost",
      `${desktopAuthScheme}://auth`,
    ],
    [desktopAuthScheme]
  );
  const clerkAuthIssue = useMemo(() => {
    if (!clerkPublishableKey) {
      return "Missing Clerk publishable key.";
    }

    if (isProductionBuild && isClerkDevelopmentPublishableKey(clerkPublishableKey)) {
      return (
        "Production desktop bundles cannot use a Clerk development publishable key (pk_test_*). " +
        "Set VITE_CLERK_PUBLISHABLE_KEY (or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) to a production key (pk_live_*), then rebuild."
      );
    }

    return null;
  }, [clerkPublishableKey, isProductionBuild]);
  const convexState = useMemo<{ client: ConvexReactClient | null; issue: string | null }>(() => {
    if (!convexUrl) {
      return {
        client: null,
        issue: "Missing VITE_CONVEX_URL. Example: https://<your-deployment>.convex.cloud",
      };
    }

    try {
      return { client: new ConvexReactClient(convexUrl), issue: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Convex client error.";
      return {
        client: null,
        issue: `Invalid VITE_CONVEX_URL value (${convexUrl}): ${message}`,
      };
    }
  }, [convexUrl]);
  const value = useMemo<DesktopShellContextValue>(
    () => ({
      apiBaseUrl: "tauri://localhost",
      runtimeMode: "idle",
      setupStageSequence: SETUP_STAGE_SEQUENCE,
    }),
    []
  );

  return (
    <DesktopShellContext.Provider value={value}>
      <ThemeProvider>
        {clerkAuthIssue && !isTestMode ? (
          <DesktopAuthFallback issue={clerkAuthIssue} />
        ) : (
          <ClerkProvider
            publishableKey={clerkPublishableKey ?? ""}
            __internal_bypassMissingPublishableKey={isTestMode}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            afterSignOutUrl="/sign-in"
            standardBrowser={!isTauriProtocol}
            allowedRedirectProtocols={allowedRedirectProtocols}
            allowedRedirectOrigins={allowedRedirectOrigins}
            routerPush={(to) => {
              navigateDesktop(to);
            }}
            routerReplace={(to) => {
              navigateDesktop(to, { replace: true });
            }}
          >
            <DesktopConvexSyncBootstrap convexUrl={convexUrl ?? null} />
            <SandboxBackendProvider backend={backend}>
              {convexState.client ? (
                <ConvexProviderWithClerk client={convexState.client} useAuth={useAuth}>
                  <DesktopAppWithLocalLaunch />
                </ConvexProviderWithClerk>
              ) : isTestMode ? (
                <App />
              ) : (
                <DesktopConvexFallback issue={convexState.issue ?? "Convex client unavailable."} />
              )}
            </SandboxBackendProvider>
          </ClerkProvider>
        )}
      </ThemeProvider>
    </DesktopShellContext.Provider>
  );
}

export function useDesktopShellContext(): DesktopShellContextValue {
  const value = useContext(DesktopShellContext);
  if (!value) {
    throw new Error("useDesktopShellContext must be used within DesktopShellProvider");
  }
  return value;
}

export function mountDesktopApp(rootElement: HTMLElement): void {
  logDesktop("info", "bootstrap", "Mounting desktop app", {
    mode: import.meta.env.MODE,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  });

  createRoot(rootElement).render(
    <StrictMode>
      <DesktopShellProvider />
    </StrictMode>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  installDesktopGlobalErrorLogging();
  mountDesktopApp(rootElement);
}
