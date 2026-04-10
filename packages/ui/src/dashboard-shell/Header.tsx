"use client";

import { SearchMd } from "@untitledui/icons";
import { GlobalStatusBar } from "../resilience-ui/status-bar/GlobalStatusBar";
import { Breadcrumbs } from "./Breadcrumbs";
import { NotificationBell } from "./NotificationBell";
import { useSearch } from "./SearchProvider";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

interface HeaderProps {
  showMenuButton?: boolean;
  onMenuClick?: () => void;
}

export function Header({ showMenuButton, onMenuClick }: HeaderProps = {}) {
  const { openSearch } = useSearch();

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border-default bg-surface-default px-6">
      <div className="flex items-center">
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuClick}
            className="mr-2 rounded-lg p-2 text-text-secondary hover:bg-interactive-hover md:hidden"
            aria-label="Open navigation menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
        )}
        <Breadcrumbs />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openSearch}
          className="flex items-center gap-2 rounded-lg border border-border-default px-3 py-1.5 text-sm text-text-muted hover:bg-interactive-hover hover:text-text-primary"
        >
          <SearchMd size={16} />
          <span>Search...</span>
          <kbd className="ml-2 rounded border border-border-default bg-interactive-subtle px-1.5 py-0.5 text-xs text-text-muted">
            Cmd+K
          </kbd>
        </button>
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
        <div className="ml-1 border-l border-border-default pl-2">
          <GlobalStatusBar />
        </div>
      </div>
    </header>
  );
}
