import {
  forwardRef,
  type AnchorHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { isExternalHref, navigateDesktop, toDesktopHashHref } from "./navigation";

type LinkHref =
  | string
  | URL
  | {
      pathname?: string;
      query?: Record<string, string | number | boolean | null | undefined>;
      hash?: string;
    };

interface DesktopLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: LinkHref;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
}

function resolveHref(href: LinkHref): string {
  if (typeof href === "string") return href;
  if (href instanceof URL) return href.toString();

  const pathname = href.pathname ?? "/";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(href.query ?? {})) {
    if (value === null || value === undefined) continue;
    params.set(key, String(value));
  }
  const search = params.size > 0 ? `?${params.toString()}` : "";
  const hash = href.hash ? `#${href.hash.replace(/^#/, "")}` : "";
  return `${pathname}${search}${hash}`;
}

function shouldUseBrowserDefault(event: ReactMouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey
  );
}

const Link = forwardRef<HTMLAnchorElement, DesktopLinkProps>(function Link(
  {
    href,
    onClick,
    target,
    download,
    replace = false,
    prefetch,
    scroll,
    ...props
  },
  ref
) {
  const rawHref = resolveHref(href);
  const resolvedHref = isExternalHref(rawHref) ? rawHref : toDesktopHashHref(rawHref);

  return (
    <a
      {...props}
      ref={ref}
      href={resolvedHref}
      target={target}
      download={download}
      onClick={(event) => {
        onClick?.(event);
        if (shouldUseBrowserDefault(event) || target === "_blank" || Boolean(download)) {
          return;
        }
        if (isExternalHref(rawHref)) {
          return;
        }
        event.preventDefault();
        navigateDesktop(rawHref, { replace });
      }}
    />
  );
});

export default Link;
