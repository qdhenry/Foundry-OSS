"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut01, User01 } from "@untitledui/icons";
import { useEffect, useRef, useState } from "react";

export function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="User account menu"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
      >
        <User01 size={20} />
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border-default bg-surface-raised shadow-2xl">
          <div className="border-b border-border-default px-4 py-3">
            <p className="truncate text-sm font-medium text-text-primary">
              {user?.fullName ?? "Account"}
            </p>
            <p className="truncate text-xs text-text-muted">
              {user?.primaryEmailAddress?.emailAddress}
            </p>
          </div>
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                void signOut({ redirectUrl: "/" });
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text-primary transition-colors hover:bg-interactive-hover"
            >
              <LogOut01 size={16} />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
