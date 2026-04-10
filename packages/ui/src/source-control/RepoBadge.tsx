"use client";

import { GithubIcon } from "./icons";

interface RepoBadgeProps {
  repoFullName: string;
  className?: string;
}

export function RepoBadge({ repoFullName, className }: RepoBadgeProps) {
  return (
    <a
      href={`https://github.com/${repoFullName}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 rounded bg-surface-raised px-1.5 py-0.5 text-[0.68rem] font-medium text-text-secondary transition-colors hover:bg-interactive-hover hover:text-text-primary ${className ?? ""}`}
      title={`Open ${repoFullName} on GitHub`}
    >
      <GithubIcon className="h-2.5 w-2.5" />
      {repoFullName}
    </a>
  );
}
