"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { SandboxBackendProvider } from "../backend";
import { TrialBanner } from "../billing/TrialBanner";
import { useOrchestrationNotifications } from "../orchestration/useOrchestrationNotifications";
import { ResilienceProvider } from "../resilience/ResilienceProvider";
import { ReadOnlyModeBanner } from "../resilience-ui/banners/ReadOnlyModeBanner";
import { ServiceDegradedBanner } from "../resilience-ui/banners/ServiceDegradedBanner";
import { StaleDataBanner } from "../resilience-ui/banners/StaleDataBanner";
import { ResilienceDevTools } from "../resilience-ui/dev-tools/ResilienceDevTools";
import { ResilienceToaster } from "../resilience-ui/toast/ResilienceToaster";
import { useResilienceToast } from "../resilience-ui/toast/useResilienceToast";
import { SandboxHUDProvider, useSandboxHUD } from "../sandbox/SandboxHUDContext";
import { Header } from "./Header";
import { SearchProvider } from "./SearchProvider";
import { Sidebar } from "./Sidebar";
import { useMobileBreakpoint } from "./useMobileBreakpoint";

const SandboxHUD = dynamic(
  () => import("../sandbox/SandboxHUD").then((module) => module.SandboxHUD),
  { ssr: false },
);

const SandboxConfigPanel = dynamic(
  () => import("../sandbox/SandboxConfigPanel").then((module) => module.SandboxConfigPanel),
  { ssr: false },
);

export interface DashboardShellLayoutProps {
  children: ReactNode;
  hideSidebarWhen?: (pathname: string) => boolean;
  showConfigPanelWhen?: (pathname: string) => boolean;
}

function defaultHideSidebarWhen(pathname: string) {
  return pathname === "/sandboxes" || pathname.startsWith("/sandboxes/");
}

function defaultShowConfigPanelWhen() {
  return true;
}

function DashboardShellContent({
  children,
  hideSidebarWhen,
  showConfigPanelWhen,
}: DashboardShellLayoutProps) {
  useResilienceToast();
  useOrchestrationNotifications();
  const { isExpanded, tabs, isConfigPanelOpen, closeConfig } = useSandboxHUD();
  const pathname = usePathname();
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const ensureTrialInitialized = useMutation("billing/trial:ensureTrialInitialized" as any);
  const trialInitOrgRef = useRef<string | null>(null);
  useEffect(() => {
    if (orgId && trialInitOrgRef.current !== orgId) {
      trialInitOrgRef.current = orgId;
      ensureTrialInitialized({ orgId }).catch(() => {});
    }
  }, [orgId, ensureTrialInitialized]);

  const isMobile = useMobileBreakpoint();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  const hudHeight = tabs.length > 0 ? (isExpanded ? 400 : 36) : 0;
  const hideSidebar = (hideSidebarWhen ?? defaultHideSidebarWhen)(pathname);
  const showConfigPanel = (showConfigPanelWhen ?? defaultShowConfigPanelWhen)(pathname);

  useEffect(() => {
    if (!showConfigPanel && isConfigPanelOpen) {
      closeConfig();
    }
  }, [showConfigPanel, isConfigPanelOpen, closeConfig]);

  return (
    <div className="flex min-h-screen bg-surface-page">
      {!hideSidebar ? (
        <Sidebar mobileOpen={mobileSidebarOpen} onMobileClose={() => setMobileSidebarOpen(false)} />
      ) : null}

      <div
        className="flex flex-1 flex-col"
        style={!hideSidebar && !isMobile ? { marginLeft: "16rem" } : undefined}
      >
        <Header
          showMenuButton={!hideSidebar && isMobile}
          onMenuClick={() => setMobileSidebarOpen(true)}
        />

        {orgId ? <TrialBanner orgId={orgId} /> : null}
        <StaleDataBanner />
        <ReadOnlyModeBanner />
        <ServiceDegradedBanner />

        <main
          className="flex-1 overflow-auto p-6"
          style={{
            paddingBottom: hudHeight > 0 ? `calc(1.5rem + ${hudHeight}px)` : undefined,
          }}
        >
          {children}
        </main>
      </div>

      <SandboxHUD />
      <ResilienceToaster />
      <ResilienceDevTools />
      {showConfigPanel && isConfigPanelOpen ? <SandboxConfigPanel /> : null}

      <style>{`:root { --hud-height: ${hudHeight}px; }`}</style>
    </div>
  );
}

export function DashboardShellLayout({
  children,
  hideSidebarWhen,
  showConfigPanelWhen,
}: DashboardShellLayoutProps) {
  return (
    <SearchProvider>
      <SandboxBackendProvider>
        <SandboxHUDProvider>
          <ResilienceProvider>
            <DashboardShellContent
              hideSidebarWhen={hideSidebarWhen}
              showConfigPanelWhen={showConfigPanelWhen}
            >
              {children}
            </DashboardShellContent>
          </ResilienceProvider>
        </SandboxHUDProvider>
      </SandboxBackendProvider>
    </SearchProvider>
  );
}
