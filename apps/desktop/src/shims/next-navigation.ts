import { useMemo, useSyncExternalStore } from "react";
import {
  getDesktopPathname,
  getDesktopSearchParams,
  navigateDesktop,
} from "./navigation";

interface NavigateOptions {
  scroll?: boolean;
}

interface PrefetchOptions {
  kind?: string;
}

type RouteParams = Record<string, string | string[]>;

const KNOWN_ROOTS = new Set(["programs", "sandboxes", "sign-in", "sign-up"]);

const DETAIL_ROUTE_PARAM_BY_SECTION: Record<string, string> = {
  tasks: "taskId",
  videos: "analysisId",
  sprints: "sprintId",
  skills: "skillId",
  risks: "riskId",
  gates: "gateId",
  integrations: "integrationId",
  playbooks: "playbookId",
  workstreams: "workstreamId",
};

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("hashchange", onStoreChange);
  window.addEventListener("popstate", onStoreChange);

  return () => {
    window.removeEventListener("hashchange", onStoreChange);
    window.removeEventListener("popstate", onStoreChange);
  };
}

function getPathnameSnapshot(): string {
  if (typeof window === "undefined") return "/";
  return getDesktopPathname(window.location);
}

function getSearchSnapshot(): string {
  if (typeof window === "undefined") return "";
  return getDesktopSearchParams(window.location).toString();
}

export interface AppRouterInstance {
  back: () => void;
  forward: () => void;
  prefetch: (href: string, options?: PrefetchOptions) => Promise<void>;
  push: (href: string, options?: NavigateOptions) => void;
  refresh: () => void;
  replace: (href: string, options?: NavigateOptions) => void;
}

export function useRouter(): AppRouterInstance {
  return useMemo<AppRouterInstance>(
    () => ({
      back: () => {
        if (typeof window !== "undefined") {
          window.history.back();
        }
      },
      forward: () => {
        if (typeof window !== "undefined") {
          window.history.forward();
        }
      },
      prefetch: async () => {},
      push: (href: string) => {
        navigateDesktop(href, { replace: false });
      },
      refresh: () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new HashChangeEvent("hashchange"));
        }
      },
      replace: (href: string) => {
        navigateDesktop(href, { replace: true });
      },
    }),
    []
  );
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, getPathnameSnapshot, () => "/");
}

export function useParams<T extends RouteParams = RouteParams>(): T {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const params: RouteParams = {};

  if (!segments[0] || KNOWN_ROOTS.has(segments[0])) {
    return params as T;
  }

  params.programId = segments[0];

  const section = segments[1];
  const detailId = segments[2];
  if (!section || !detailId || segments.length > 3) {
    return params as T;
  }

  const detailParamName = DETAIL_ROUTE_PARAM_BY_SECTION[section];
  if (!detailParamName) {
    return params as T;
  }

  if (detailId === "new" || (section === "videos" && detailId === "upload")) {
    return params as T;
  }

  params[detailParamName] = detailId;
  return params as T;
}

export function useSearchParams(): URLSearchParams {
  const snapshot = useSyncExternalStore(subscribe, getSearchSnapshot, () => "");
  return useMemo(() => new URLSearchParams(snapshot), [snapshot]);
}

export function redirect(href: string): never {
  navigateDesktop(href, { replace: true });
  throw new Error("NEXT_REDIRECT");
}

export function notFound(): never {
  throw new Error("NEXT_NOT_FOUND");
}
