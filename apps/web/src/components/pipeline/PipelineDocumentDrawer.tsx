"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface PipelineDocumentDrawerProps {
  programId: Id<"programs">;
  isOpen: boolean;
  onClose: () => void;
}

export function PipelineDocumentDrawer({
  programId,
  isOpen,
  onClose,
}: PipelineDocumentDrawerProps) {
  const documents = useQuery(api.documents.listByProgram, isOpen ? { programId } : "skip");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-surface-default shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <h2 className="text-sm font-semibold text-text-heading">Documents</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-interactive-hover"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto p-5">
          {documents === undefined ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-raised" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-text-secondary">No documents uploaded for this program.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc: any) => (
                <div
                  key={doc._id}
                  className="flex items-center gap-3 rounded-lg border border-border-default p-3"
                >
                  <svg
                    className="h-5 w-5 shrink-0 text-text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-heading">{doc.fileName}</p>
                    <p className="text-xs text-text-secondary">
                      {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : "Unknown size"}
                      {doc.analysisStatus && ` · ${doc.analysisStatus}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
