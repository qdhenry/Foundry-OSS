"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { type DragEvent, useCallback, useRef, useState } from "react";
import { useProgramContext } from "../programs";

const MAX_VIDEO_FILE_SIZE_BYTES = 1_024 * 1_024 * 1_024; // 1 GiB
const MAX_UPLOAD_ATTEMPTS = 3;
const RETRY_BACKOFF_BASE_MS = 1_000;
const UPLOAD_TIMEOUT_MS = 15 * 60 * 1_000;

const RETENTION_POLICIES = [
  { value: "30_days", label: "30 days" },
  { value: "60_days", label: "60 days" },
  { value: "90_days", label: "90 days" },
  { value: "180_days", label: "180 days" },
  { value: "indefinite", label: "Indefinite" },
] as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type UploadStage = "preparing" | "uploading" | "finalizing" | null;

class UploadRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UploadRequestError";
    this.status = status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientUploadFailure(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function getUploadStageText(stage: UploadStage): string {
  if (stage === "preparing") return "Preparing upload...";
  if (stage === "uploading") return "Uploading video...";
  if (stage === "finalizing") return "Finalizing upload...";
  return "";
}

function uploadFileWithProgress({
  uploadUrl,
  file,
  fileType,
  onProgress,
}: {
  uploadUrl: string;
  file: File;
  fileType: string;
  onProgress: (loadedBytes: number, totalBytes: number) => void;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.responseType = "json";
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader("Content-Type", fileType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };

    xhr.onerror = () => {
      reject(new UploadRequestError("Network error while uploading video", 0));
    };

    xhr.ontimeout = () => {
      reject(new UploadRequestError("Upload timed out. Please try again.", 408));
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new UploadRequestError("Failed to upload video to storage", xhr.status));
        return;
      }

      const responseBody =
        typeof xhr.response === "object" && xhr.response !== null
          ? (xhr.response as { storageId?: string })
          : ((JSON.parse(xhr.responseText || "{}") as { storageId?: string }) ?? {});

      if (!responseBody.storageId) {
        reject(new UploadRequestError("Upload response did not include storageId", xhr.status));
        return;
      }

      resolve(responseBody.storageId);
    };

    xhr.send(file);
  });
}

export function VideoUploadPage() {
  const router = useRouter();
  const { programId, slug } = useProgramContext();
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";

  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [retentionPolicy, setRetentionPolicy] = useState<string>("90_days");
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>(null);
  const [uploadAttempt, setUploadAttempt] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalUploadBytes, setTotalUploadBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getVideoUploadUrl = useMutation("documents:getVideoUploadUrl" as any);
  const confirmVideoUpload = useMutation("documents:confirmVideoUpload" as any);

  const setValidatedFile = useCallback((file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      setError(null);
      return;
    }

    if (!file.type.startsWith("video/")) {
      setSelectedFile(null);
      setError("Please choose a supported video file.");
      return;
    }

    if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setError("Video must be 1 GB or smaller.");
      return;
    }

    setSelectedFile(file);
    setError(null);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) setValidatedFile(file);
    },
    [setValidatedFile],
  );

  const handleUpload = async () => {
    if (!selectedFile || !orgId) return;

    setUploading(true);
    setUploadStage("preparing");
    setUploadAttempt(1);
    setUploadedBytes(0);
    setTotalUploadBytes(selectedFile.size);
    setError(null);

    try {
      const fileType = selectedFile.type || "application/octet-stream";
      let storageId: string | null = null;

      for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
        setUploadAttempt(attempt);
        setUploadStage("preparing");

        try {
          const uploadTarget = await getVideoUploadUrl({
            orgId,
            programId,
            fileName: selectedFile.name,
            fileType,
            fileSize: selectedFile.size,
          });

          setUploadStage("uploading");
          storageId = await uploadFileWithProgress({
            uploadUrl: uploadTarget.uploadUrl,
            file: selectedFile,
            fileType,
            onProgress: (loaded, total) => {
              setUploadedBytes(loaded);
              setTotalUploadBytes(total || selectedFile.size);
            },
          });
          break;
        } catch (uploadError) {
          const status = uploadError instanceof UploadRequestError ? uploadError.status : 0;
          const canRetry = attempt < MAX_UPLOAD_ATTEMPTS && isTransientUploadFailure(status);

          if (!canRetry) {
            throw uploadError;
          }

          const backoffMs = RETRY_BACKOFF_BASE_MS * 2 ** (attempt - 1);
          await sleep(backoffMs);
        }
      }

      if (!storageId) {
        throw new Error("Upload response did not include storageId");
      }

      setUploadedBytes(selectedFile.size);
      setTotalUploadBytes(selectedFile.size);
      setUploadStage("finalizing");

      await confirmVideoUpload({
        orgId,
        programId,
        fileName: selectedFile.name,
        fileType,
        fileSize: selectedFile.size,
        description: description.trim() || undefined,
        storageId: storageId as any,
        retentionPolicy: retentionPolicy as any,
      });

      router.push(`/${slug}/videos`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setUploadStage(null);
      setUploadAttempt(0);
      setUploading(false);
    }
  };

  const progressPercent =
    totalUploadBytes > 0 ? Math.min(100, Math.round((uploadedBytes / totalUploadBytes) * 100)) : 0;

  return (
    <div className="space-y-6">
      <button
        onClick={() => router.push(`/${slug}/videos`)}
        className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-secondary"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
          />
        </svg>
        Back to Visual Discovery
      </button>

      <div>
        <h1 className="type-display-m text-text-heading">Upload Video</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Upload a meeting recording to create a new visual discovery analysis.
        </p>
      </div>

      {selectedFile ? (
        <div className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-interactive-subtle">
                <svg
                  className="h-5 w-5 text-accent-default"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 10.5l4.72-2.36A.75.75 0 0121.75 8.8v6.4a.75.75 0 01-1.28.53l-4.72-2.36m0-3.6a.75.75 0 00-.75-.75h-8.25a.75.75 0 00-.75.75v4.5a.75.75 0 00.75.75H15a.75.75 0 00.75-.75v-4.5z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-text-muted">
                  {formatFileSize(selectedFile.size)} • {selectedFile.type || "video"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setValidatedFile(null)}
              disabled={uploading}
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-secondary"
              aria-label="Remove selected video"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? "border-border-accent bg-interactive-subtle"
              : "border-border-default hover:border-border-strong"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(event) => setValidatedFile(event.target.files?.[0] ?? null)}
          />
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised">
            <svg
              className="h-6 w-6 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5l4.72-2.36A.75.75 0 0121.75 8.8v6.4a.75.75 0 01-1.28.53l-4.72-2.36m0-3.6a.75.75 0 00-.75-.75h-8.25a.75.75 0 00-.75.75v4.5a.75.75 0 00.75.75H15a.75.75 0 00.75-.75v-4.5z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-secondary">
            {isDragging ? "Drop video here" : "Drag and drop a video, or click to browse"}
          </p>
          <p className="mt-1 text-xs text-text-muted">MP4, MOV, AVI, MKV, WEBM up to 1 GB</p>
        </div>
      )}

      <div>
        <label htmlFor="video-retention-policy" className="form-label">
          Retention Policy
        </label>
        <select
          id="video-retention-policy"
          value={retentionPolicy}
          onChange={(event) => setRetentionPolicy(event.target.value)}
          className="select w-full"
        >
          {RETENTION_POLICIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="video-description" className="form-label">
          Description <span className="font-normal text-text-muted">(optional)</span>
        </label>
        <textarea
          id="video-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="What should this recording help the team understand?"
          className="textarea w-full resize-none"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-status-error-border bg-status-error-bg px-4 py-3 text-sm text-status-error-fg">
          {error}
        </div>
      )}

      {uploading && selectedFile && (
        <div className="space-y-2 rounded-lg border border-border-default bg-surface-raised p-3">
          <p className="text-sm font-medium text-text-secondary">
            {getUploadStageText(uploadStage)}
            {uploadAttempt > 1 && uploadStage !== "finalizing"
              ? ` (attempt ${uploadAttempt} of ${MAX_UPLOAD_ATTEMPTS})`
              : ""}
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-interactive-subtle"
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <div
              className="h-full bg-accent-default transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-text-muted">
            {progressPercent}%{" "}
            {uploadStage === "uploading"
              ? `(${formatFileSize(uploadedBytes)} / ${formatFileSize(totalUploadBytes || selectedFile.size)})`
              : `(${formatFileSize(totalUploadBytes || selectedFile.size)})`}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Uploading...
            </>
          ) : (
            "Upload Video"
          )}
        </button>
        <button
          onClick={() => router.push(`/${slug}/videos`)}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default VideoUploadPage;
