"use client";

import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";

interface EvidenceUploadProps {
  requirementId: string;
  orgId: string;
}

interface UploadResponse {
  storageId: string;
}

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv";

export function EvidenceUpload({ requirementId, orgId }: EvidenceUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.evidence.generateUploadUrl);
  const saveEvidence = useMutation(api.evidence.save);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const uploadUrl = await generateUploadUrl({ orgId });

      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const uploadResponse = (await result.json()) as UploadResponse;
      const { storageId } = uploadResponse;

      await saveEvidence({
        orgId,
        requirementId: requirementId as any,
        storageId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-default px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-interactive-hover disabled:opacity-50"
      >
        {isUploading ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Uploading...
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Upload Evidence
          </>
        )}
      </button>
      {error && <p className="mt-1 text-sm text-status-error-fg">{error}</p>}
    </div>
  );
}
