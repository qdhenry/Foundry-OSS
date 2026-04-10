const EXTERNAL_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

export interface DesktopNavigateOptions {
  replace?: boolean;
}

function normalizeInternalPath(href: string): string {
  if (!href) return "/";

  let pathWithSearch = href;
  if (pathWithSearch.startsWith("#/")) {
    pathWithSearch = pathWithSearch.slice(1);
  } else if (pathWithSearch.startsWith("#")) {
    pathWithSearch = pathWithSearch.slice(1) || "/";
  }

  const [pathWithoutHashFragment] = pathWithSearch.split("#");
  const normalizedPath = pathWithoutHashFragment || "/";

  if (normalizedPath.startsWith("/")) return normalizedPath;
  return `/${normalizedPath}`;
}

export function isExternalHref(href: string): boolean {
  return EXTERNAL_PROTOCOL_PATTERN.test(href) || href.startsWith("//");
}

export function toDesktopHashHref(href: string): string {
  if (isExternalHref(href)) return href;
  const path = normalizeInternalPath(href);
  return `#${path.startsWith("/") ? path : `/${path}`}`;
}

export function getDesktopPathname(currentLocation: Location): string {
  if (currentLocation.hash.startsWith("#/")) {
    const pathWithSearch = currentLocation.hash.slice(1);
    const [pathWithFragment] = pathWithSearch.split("?");
    const [path] = pathWithFragment.split("#");
    return path || "/";
  }

  return currentLocation.pathname || "/";
}

export function getDesktopSearchParams(currentLocation: Location): URLSearchParams {
  if (currentLocation.hash.startsWith("#/")) {
    const pathWithSearch = currentLocation.hash.slice(1);
    const [, rawSearch = ""] = pathWithSearch.split("?");
    const [search] = rawSearch.split("#");
    return new URLSearchParams(search);
  }

  return new URLSearchParams(currentLocation.search);
}

export function navigateDesktop(href: string, options: DesktopNavigateOptions = {}): void {
  if (typeof window === "undefined") return;
  if (!href.trim()) return;

  if (isExternalHref(href)) {
    window.location.assign(href);
    return;
  }

  const targetHash = toDesktopHashHref(href);
  if (!targetHash.startsWith("#")) {
    window.location.assign(targetHash);
    return;
  }

  if (options.replace) {
    const nextUrl = `${window.location.pathname}${window.location.search}${targetHash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }

  window.location.hash = targetHash.slice(1);
}
