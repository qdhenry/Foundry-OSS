"use client";

import Link from "next/link";
import { useProgramContext } from "../programs/ProgramContext";

const UTILITIES = [
  {
    id: "code-analyzer",
    title: "Code Analyzer",
    description:
      "Analyze repository codebases to generate knowledge graphs, guided tours, and AI-powered Q&A about your code architecture.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
        />
      </svg>
    ),
    href: (slug: string) => `/${slug}/utilities/code-analyzer`,
  },
];

export function UtilitiesPage() {
  const { slug } = useProgramContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="type-display-m text-text-heading">Utilities</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Tools and utilities to help you analyze, understand, and improve your project delivery.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {UTILITIES.map((utility) => (
          <Link
            key={utility.id}
            href={utility.href(slug)}
            className="group rounded-xl border border-border-default bg-surface-secondary p-5 transition-all duration-200 hover:border-border-accent hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-surface-default text-accent-default">
              {utility.icon}
            </div>
            <h3 className="text-sm font-semibold text-text-heading group-hover:text-accent-default">
              {utility.title}
            </h3>
            <p className="mt-1 text-xs text-text-secondary leading-relaxed">
              {utility.description}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-default opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Open
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
