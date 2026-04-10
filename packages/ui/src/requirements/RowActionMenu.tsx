"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
  { value: "deferred", label: "Deferred" },
] as const;

interface RowActionMenuProps {
  requirementId: string;
  currentStatus: "draft" | "approved" | "in_progress" | "complete" | "deferred";
  onEdit: () => void;
  onViewDetails: () => void;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
}

export function RowActionMenu({
  requirementId,
  currentStatus,
  onEdit,
  onViewDetails,
  onStatusChange,
  onDelete,
}: RowActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showStatusSubmenu, setShowStatusSubmenu] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setShowStatusSubmenu(false);
  }, []);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [close]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={`Actions for requirement ${requirementId}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
          setShowStatusSubmenu(false);
        }}
        className="p-1 rounded hover:bg-interactive-hover text-text-muted hover:text-text-secondary"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-border-default bg-surface-default shadow-lg py-1">
          {/* Edit */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
              close();
            }}
            className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-interactive-hover flex items-center gap-2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>

          {/* Change Status */}
          <div
            className="relative"
            onMouseEnter={() => setShowStatusSubmenu(true)}
            onMouseLeave={() => setShowStatusSubmenu(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowStatusSubmenu((prev) => !prev);
              }}
              className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-interactive-hover flex items-center gap-2"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              Change Status
              <svg
                className="ml-auto"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Status submenu — positioned to the left */}
            {showStatusSubmenu ? (
              <div className="absolute right-full top-0 mr-1 z-50 w-44 rounded-lg border border-border-default bg-surface-default shadow-lg py-1">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(opt.value);
                      close();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-interactive-hover flex items-center gap-2"
                  >
                    {currentStatus === opt.value ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-accent-default"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span className="inline-block w-[14px]" />
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* View Details */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
              close();
            }}
            className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-interactive-hover flex items-center gap-2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            View Details
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-border-default" />

          {/* Delete */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              close();
            }}
            className="w-full px-3 py-2 text-left text-sm text-status-error-fg hover:bg-status-error-bg flex items-center gap-2"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
