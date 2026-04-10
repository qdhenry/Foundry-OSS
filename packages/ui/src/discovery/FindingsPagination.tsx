"use client";

interface FindingsPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function FindingsPagination({
  currentPage,
  totalPages,
  onPageChange,
}: FindingsPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <button
        type="button"
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
        className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-interactive-hover disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-xs text-text-secondary">
        Page {currentPage + 1} of {totalPages}
      </span>
      <button
        type="button"
        disabled={currentPage >= totalPages - 1}
        onClick={() => onPageChange(currentPage + 1)}
        className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-interactive-hover disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
