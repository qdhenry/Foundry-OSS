"use client";

import { OrganizationSwitcher, useOrganization } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { FoundryLogo } from "../brand";
import { EASE_SMOOTH, gsap } from "../theme/gsap";
import { getNavigation, type NavigationState } from "./navigation";

interface ProgramBySlugResult {
  _id: string;
}

const EMPTY_NAV_STATE: NavigationState = {
  discoveryPending: 0,
  requirementsTotal: 0,
  requirementsUnassigned: 0,
  workstreamsCount: 0,
  sprintsActive: 0,
  sprintsPlanning: 0,
  tasksTotal: 0,
  tasksInProgress: 0,
  skillsCount: 0,
  risksCount: 0,
  gatesCount: 0,
  designAssetsTotal: 0,
};

const GROUPED_SECTIONS = new Set(["Plan", "Build", "Knowledge"]);

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useConvexAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const segments = pathname.split("/").filter(Boolean);
  const knownRoots = ["programs", "sign-in", "sign-up"];
  const programSlug = segments[0] && !knownRoots.includes(segments[0]) ? segments[0] : null;

  const resolvedProgram = useQuery(
    "programs:getBySlug" as any,
    isAuthenticated && programSlug && orgId ? { orgId, slug: programSlug } : "skip",
  ) as ProgramBySlugResult | null | undefined;

  const programId = programSlug;

  const navState = useQuery(
    "programs:getNavigationState" as any,
    resolvedProgram ? { programId: resolvedProgram._id } : "skip",
  ) as NavigationState | undefined;

  const currentNavState = navState ?? EMPTY_NAV_STATE;
  const navigation = useMemo(
    () => getNavigation(programId, currentNavState),
    [programId, currentNavState],
  );

  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  const movePill = useCallback(() => {
    if (!navRef.current || !pillRef.current) return;
    const activeLink = navRef.current.querySelector(
      "[data-nav-active='true']",
    ) as HTMLElement | null;
    if (!activeLink) {
      gsap.set(pillRef.current, { opacity: 0 });
      return;
    }
    const navRect = navRef.current.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    const targetY = linkRect.top - navRect.top;
    const targetHeight = linkRect.height;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(pillRef.current!, {
        y: targetY,
        height: targetHeight,
        opacity: 1,
        duration: 0.3,
        ease: EASE_SMOOTH,
        overwrite: true,
      });
    });
    mm.add("(prefers-reduced-motion: reduce)", () => {
      if (pillRef.current) {
        pillRef.current.style.transform = `translateY(${targetY}px)`;
        pillRef.current.style.height = `${targetHeight}px`;
        pillRef.current.style.opacity = "1";
      }
    });
  }, []);

  // Move pill on pathname/searchParams changes
  useEffect(() => {
    movePill();
  }, [pathname, searchParams, movePill, navigation]);

  // Set initial position without animation on mount
  useEffect(() => {
    if (!navRef.current || !pillRef.current) return;
    const activeLink = navRef.current.querySelector(
      "[data-nav-active='true']",
    ) as HTMLElement | null;
    if (!activeLink) {
      gsap.set(pillRef.current, { opacity: 0 });
      return;
    }
    const navRect = navRef.current.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    gsap.set(pillRef.current, {
      y: linkRect.top - navRect.top,
      height: linkRect.height,
      opacity: 1,
    });
  }, []);

  const sidebarContent = (
    <aside className="fixed inset-y-0 left-0 z-30 flex h-screen w-64 flex-col border-r border-border-default bg-surface-default">
      <div className="flex h-16 items-center border-b border-border-default px-6">
        <FoundryLogo size="md" />
      </div>

      <nav ref={navRef} className="relative flex-1 overflow-y-auto px-3 py-4">
        <div
          ref={pillRef}
          className="absolute left-2 right-2 rounded-md bg-surface-secondary"
          style={{ pointerEvents: "none", opacity: 0 }}
        />
        {navigation.map((section) => (
          <div key={section.title} className="mb-6">
            {GROUPED_SECTIONS.has(section.title) ? (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                {section.title}
              </p>
            ) : (
              <p className="type-caption mb-2 px-3 text-accent-label">{section.title}</p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const disabled = item.href === "#";
                const isEmpty = item.readiness === "empty";

                let isActive = false;
                if (!disabled) {
                  const [hrefPath, hrefQuery] = item.href.split("?");

                  if (hrefQuery) {
                    const params = new URLSearchParams(hrefQuery);
                    const sectionParam = params.get("section");
                    isActive =
                      pathname === hrefPath && searchParams.get("section") === sectionParam;
                  } else {
                    isActive =
                      item.href === `/${programId}`
                        ? pathname === item.href
                        : pathname.startsWith(item.href) && item.href !== "#";
                  }
                }

                const Icon = item.icon;

                return (
                  <li key={item.label}>
                    {disabled ? (
                      <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-muted">
                        <Icon size={20} />
                        {item.label}
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        data-nav-active={isActive ? "true" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? "text-accent-default"
                            : isEmpty
                              ? "text-text-muted opacity-60 hover:bg-interactive-hover hover:opacity-100"
                              : "text-text-secondary hover:bg-interactive-hover hover:text-text-primary"
                        }`}
                      >
                        <Icon size={20} />
                        <span>{item.label}</span>
                        {item.badge !== undefined && (
                          <span className="ml-auto rounded-full bg-accent-default px-1.5 py-0.5 text-xs font-semibold text-text-on-brand">
                            {item.badge}
                          </span>
                        )}
                        {item.badgeLabel && !item.badge && (
                          <span className="ml-auto text-xs text-text-muted">{item.badgeLabel}</span>
                        )}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border-default p-4">
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/programs"
          afterCreateOrganizationUrl="/programs"
          appearance={{
            elements: {
              rootBox: "w-full",
              organizationSwitcherTrigger:
                "w-full rounded-lg bg-surface-raised px-3 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors",
            },
          }}
        />
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop: always visible, hidden on mobile */}
      <div className="hidden md:block">{sidebarContent}</div>

      {/* Mobile: overlay when open */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="relative z-50">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
