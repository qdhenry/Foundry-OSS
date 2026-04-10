"use node";

import { TwelveLabs } from "twelvelabs-js";

const DEFAULT_TWELVE_LABS_API_BASE_URL = "https://api.twelvelabs.io/v1.3";
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;

type JsonRecord = Record<string, unknown>;

type RequestOptions = {
  path: string;
  method?: "GET" | "POST";
  body?: JsonRecord;
  fallbackPaths?: string[];
  optional?: boolean;
};

export type TwelveLabsModelSpec = {
  name: string;
  options?: string[];
};

export const DEFAULT_TWELVE_LABS_MODELS: TwelveLabsModelSpec[] = [
  { name: "marengo3.0", options: ["visual", "audio"] },
  { name: "pegasus1.2", options: ["visual", "audio"] },
];

export type TwelveLabsTaskStatus = {
  taskId: string;
  status: "processing" | "ready" | "failed";
  rawStatus: string;
  videoId?: string;
  indexId?: string;
  progress?: number;
  error?: string;
  raw: unknown;
};

export type RetrievedTwelveLabsVideoData = {
  transcript: unknown | null;
  summary: unknown | null;
  chapters: unknown | null;
  gist: unknown | null;
  warnings: string[];
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function getByPath(root: unknown, dottedPath: string): unknown {
  const keys = dottedPath.split(".");
  let cursor: unknown = root;
  for (const key of keys) {
    const cursorRecord = asRecord(cursor);
    if (!cursorRecord) return undefined;
    cursor = cursorRecord[key];
  }
  return cursor;
}

function pickString(root: unknown, paths: string[]): string | undefined {
  for (const path of paths) {
    const value = getByPath(root, path);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function pickNumber(root: unknown, paths: string[]): number | undefined {
  for (const path of paths) {
    const value = getByPath(root, path);
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function extractErrorMessage(responseStatus: number, responseBody: unknown): string {
  const parsed = asRecord(responseBody);
  const nestedError = asRecord(parsed?.error);

  const message =
    (typeof parsed?.message === "string" && parsed.message) ||
    (typeof nestedError?.message === "string" && nestedError.message) ||
    (typeof parsed?.detail === "string" && parsed.detail) ||
    (typeof nestedError?.detail === "string" && nestedError.detail);

  if (message) return message;
  return `HTTP ${responseStatus}`;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { rawText: text };
  }
}

function normalizeBaseUrl(): string {
  return (
    process.env.TWELVE_LABS_API_BASE_URL?.trim().replace(/\/+$/, "") ??
    DEFAULT_TWELVE_LABS_API_BASE_URL
  );
}

function assertApiKey(): string {
  const apiKey = process.env.TWELVE_LABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "TWELVE_LABS_API_KEY is not set. Configure it in Convex environment variables.",
    );
  }
  return apiKey;
}

export function getTwelveLabsClient() {
  const apiKey = assertApiKey();
  const baseUrl = normalizeBaseUrl();
  const sdk = new TwelveLabs({
    apiKey,
  });

  async function requestJson<T>(options: RequestOptions): Promise<T | null> {
    const method = options.method ?? "GET";
    const candidates = [options.path, ...(options.fallbackPaths ?? [])];
    let lastError: Error | null = null;

    for (let index = 0; index < candidates.length; index += 1) {
      const candidatePath = candidates[index];
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`${baseUrl}${candidatePath}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            Authorization: `Bearer ${apiKey}`,
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        const responseBody = await parseResponseBody(response);

        if (!response.ok) {
          const notFoundLike =
            response.status === 404 || response.status === 405 || response.status === 410;
          if (notFoundLike && index < candidates.length - 1) {
            continue;
          }

          const message = extractErrorMessage(response.status, responseBody);
          throw new Error(`Twelve Labs ${method} ${candidatePath} failed: ${message}`);
        }

        return responseBody as T;
      } catch (error) {
        const abortError = error instanceof DOMException && error.name === "AbortError";
        lastError = new Error(
          abortError
            ? `Twelve Labs ${method} ${candidatePath} timed out after ${DEFAULT_REQUEST_TIMEOUT_MS}ms`
            : error instanceof Error
              ? error.message
              : String(error),
        );

        if (index === candidates.length - 1) {
          if (options.optional) return null;
          throw lastError;
        }
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    if (options.optional) return null;
    throw lastError ?? new Error("Twelve Labs request failed");
  }

  return { sdk, requestJson };
}

export async function createIndex(
  name: string,
  models: TwelveLabsModelSpec[] = DEFAULT_TWELVE_LABS_MODELS,
): Promise<{ indexId: string; indexName: string; raw: unknown }> {
  const client = getTwelveLabsClient();
  let payload: unknown = null;

  try {
    if (typeof (client.sdk as any).indexes?.create === "function") {
      payload = await (client.sdk as any).indexes.create({
        indexName: name,
        models: models.map((model) => ({
          modelName: model.name,
          modelOptions: model.options,
        })),
      });
    }
  } catch {
    payload = null;
  }

  if (!payload) {
    // TODO: Keep fallback payloads/paths until we lock a single TL API/SDK version.
    payload = await client.requestJson<unknown>({
      path: "/indexes",
      method: "POST",
      body: {
        index_name: name,
        models,
      },
      fallbackPaths: ["/index"],
    });
  }

  if (!payload) {
    payload = await client.requestJson<unknown>({
      path: "/indexes",
      method: "POST",
      body: {
        name,
        models,
      },
      fallbackPaths: ["/index"],
    });
  }

  const indexId = pickString(payload, [
    "id",
    "_id",
    "index_id",
    "indexId",
    "data.id",
    "data._id",
    "index.id",
  ]);
  if (!indexId) {
    throw new Error("Twelve Labs createIndex response did not include an index id");
  }

  const indexName =
    pickString(payload, ["index_name", "name", "data.index_name", "data.name"]) ?? name;

  return { indexId, indexName, raw: payload };
}

export async function submitVideo(
  indexId: string,
  videoUrl: string,
): Promise<{ taskId: string; raw: unknown }> {
  const client = getTwelveLabsClient();
  let payload: unknown = null;

  try {
    if (typeof (client.sdk as any).tasks?.create === "function") {
      payload = await (client.sdk as any).tasks.create({
        indexId,
        videoUrl,
      });
    }
  } catch {
    payload = null;
  }

  if (!payload) {
    // TODO: Keep fallback payloads/paths until we lock a single TL API/SDK version.
    payload = await client.requestJson<unknown>({
      path: "/tasks",
      method: "POST",
      body: {
        index_id: indexId,
        video_url: videoUrl,
      },
      fallbackPaths: ["/task"],
    });
  }

  if (!payload) {
    payload = await client.requestJson<unknown>({
      path: "/tasks",
      method: "POST",
      body: {
        indexId,
        videoUrl,
      },
      fallbackPaths: ["/task"],
    });
  }

  const taskId = pickString(payload, [
    "id",
    "_id",
    "task_id",
    "taskId",
    "data.id",
    "data._id",
    "task.id",
  ]);
  if (!taskId) {
    throw new Error("Twelve Labs submitVideo response did not include a task id");
  }

  return { taskId, raw: payload };
}

function normalizeTaskStatus(rawStatus?: string): "processing" | "ready" | "failed" {
  const status = rawStatus?.toLowerCase() ?? "processing";
  if (status.includes("fail") || status.includes("error") || status.includes("cancel")) {
    return "failed";
  }
  if (
    status === "ready" ||
    status === "completed" ||
    status === "done" ||
    status === "succeeded" ||
    status === "finished" ||
    status === "indexed"
  ) {
    return "ready";
  }
  return "processing";
}

export async function getTaskStatus(taskId: string): Promise<TwelveLabsTaskStatus> {
  const client = getTwelveLabsClient();
  let payload: unknown = null;
  try {
    if (typeof (client.sdk as any).tasks?.retrieve === "function") {
      payload = await (client.sdk as any).tasks.retrieve(taskId);
    }
  } catch {
    payload = null;
  }

  if (!payload) {
    payload = await client.requestJson<unknown>({
      path: `/tasks/${taskId}`,
      method: "GET",
      fallbackPaths: [`/task/${taskId}`],
    });
  }

  const rawStatus =
    pickString(payload, [
      "status",
      "task_status",
      "taskStatus",
      "state",
      "data.status",
      "data.state",
    ]) ?? "processing";
  const normalized = normalizeTaskStatus(rawStatus);

  const videoId = pickString(payload, [
    "video_id",
    "videoId",
    "video.id",
    "video._id",
    "output.video_id",
    "result.video_id",
    "data.video_id",
    "data.video.id",
  ]);
  const indexId = pickString(payload, ["index_id", "indexId", "data.index_id", "data.indexId"]);
  const progress = pickNumber(payload, [
    "progress",
    "percentage",
    "percent_complete",
    "data.progress",
    "data.percentage",
  ]);
  const error = pickString(payload, [
    "error",
    "message",
    "error_message",
    "data.error",
    "data.message",
    "error.message",
  ]);

  return {
    taskId,
    status: normalized,
    rawStatus,
    videoId,
    indexId,
    progress,
    error,
    raw: payload,
  };
}

async function fetchSummaryLike(videoId: string, type: "summary" | "chapter") {
  const client = getTwelveLabsClient();
  try {
    if (typeof (client.sdk as any).summarize === "function") {
      return await (client.sdk as any).summarize({
        videoId,
        type,
      });
    }
  } catch {
    // fall through to REST fallback
  }

  return await client.requestJson<unknown>({
    path: "/summarize",
    method: "POST",
    body: {
      video_id: videoId,
      type,
    },
    // TODO: Keep endpoint fallbacks until Twelve Labs SDK/API method is pinned in package.json.
    fallbackPaths: ["/summaries"],
  });
}

async function fetchTranscript(indexId: string, videoId: string) {
  const client = getTwelveLabsClient();
  try {
    if (typeof (client.sdk as any).indexes?.videos?.retrieve === "function") {
      return await (client.sdk as any).indexes.videos.retrieve(indexId, videoId, {
        transcription: true,
      });
    }
  } catch {
    // fall through to REST fallback
  }

  return await client.requestJson<unknown>({
    path: `/indexes/${indexId}/videos/${videoId}/transcription`,
    method: "GET",
    fallbackPaths: [
      `/indexes/${indexId}/videos/${videoId}/transcript`,
      `/videos/${videoId}/transcription`,
      `/videos/${videoId}/transcript`,
      `/indexes/${indexId}/videos/${videoId}?transcription=true`,
    ],
  });
}

async function fetchGist(videoId: string) {
  const client = getTwelveLabsClient();
  try {
    if (typeof (client.sdk as any).gist === "function") {
      return await (client.sdk as any).gist({
        videoId,
        types: ["title", "topic", "hashtag"],
      });
    }
  } catch {
    // fall through to REST fallback
  }

  return await client.requestJson<unknown>({
    path: "/gist",
    method: "POST",
    body: {
      video_id: videoId,
      types: ["title", "topic", "hashtag"],
    },
    fallbackPaths: [`/videos/${videoId}/gist`],
  });
}

export async function retrieveVideoData(
  indexId: string,
  videoId: string,
): Promise<RetrievedTwelveLabsVideoData> {
  const [transcriptResult, summaryResult, chaptersResult, gistResult] = await Promise.allSettled([
    fetchTranscript(indexId, videoId),
    fetchSummaryLike(videoId, "summary"),
    fetchSummaryLike(videoId, "chapter"),
    fetchGist(videoId),
  ]);

  const warnings: string[] = [];
  const transcript =
    transcriptResult.status === "fulfilled"
      ? transcriptResult.value
      : (() => {
          warnings.push(
            `Transcript retrieval failed: ${
              transcriptResult.reason instanceof Error
                ? transcriptResult.reason.message
                : String(transcriptResult.reason)
            }`,
          );
          return null;
        })();

  const summary =
    summaryResult.status === "fulfilled"
      ? summaryResult.value
      : (() => {
          warnings.push(
            `Summary retrieval failed: ${
              summaryResult.reason instanceof Error
                ? summaryResult.reason.message
                : String(summaryResult.reason)
            }`,
          );
          return null;
        })();

  const chapters =
    chaptersResult.status === "fulfilled"
      ? chaptersResult.value
      : (() => {
          warnings.push(
            `Chapter retrieval failed: ${
              chaptersResult.reason instanceof Error
                ? chaptersResult.reason.message
                : String(chaptersResult.reason)
            }`,
          );
          return null;
        })();

  const gist =
    gistResult.status === "fulfilled"
      ? gistResult.value
      : (() => {
          warnings.push(
            `Gist retrieval failed: ${
              gistResult.reason instanceof Error
                ? gistResult.reason.message
                : String(gistResult.reason)
            }`,
          );
          return null;
        })();

  return {
    transcript,
    summary,
    chapters,
    gist,
    warnings,
  };
}
