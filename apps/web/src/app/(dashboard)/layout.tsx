"use client";

import { useAuth } from "@clerk/nextjs";
import { DashboardShellLayout } from "@foundry/ui/dashboard-shell";
import { redirect } from "next/navigation";

const KNOWN_ROOTS = new Set(["programs", "sandboxes", "sign-in", "sign-up"]);

function showConfigPanelOnTaskRoutes(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const programSlug = segments[0];
  const section = segments[1];
  const subSection = segments[2];

  if (!programSlug || KNOWN_ROOTS.has(programSlug)) {
    return false;
  }

  if (section !== "tasks") {
    return false;
  }

  // Restrict config panel to task-detail routes only.
  if (!subSection || subSection === "new") {
    return false;
  }

  return segments.length === 3;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && !isSignedIn) {
    redirect("/sign-in");
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-default">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <DashboardShellLayout
      hideSidebarWhen={(pathname) =>
        pathname === "/sandboxes" || pathname.startsWith("/sandboxes/")
      }
      showConfigPanelWhen={showConfigPanelOnTaskRoutes}
    >
      {children}
    </DashboardShellLayout>
  );
}
