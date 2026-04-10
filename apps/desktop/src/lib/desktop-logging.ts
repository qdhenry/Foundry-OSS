type DesktopLogLevel = "info" | "warn" | "error";

interface DesktopLogEntry {
  timestamp: string;
  level: DesktopLogLevel;
  scope: string;
  message: string;
  details?: unknown;
}

export interface DesktopFatalError {
  timestamp: string;
  pathname: string;
  source: "window.error" | "unhandledrejection";
  message: string;
  details?: unknown;
}

const LOG_BUFFER_LIMIT = 250;
let globalListenersInstalled = false;

export const DESKTOP_FATAL_ERROR_EVENT = "foundry-desktop:fatal-error";

declare global {
  interface Window {
    __FOUNDRY_DESKTOP_LOG_BUFFER__?: DesktopLogEntry[];
    __FOUNDRY_DESKTOP_FATAL_ERROR__?: DesktopFatalError | null;
  }
}

function summarizePrimitive(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return `${value.toString()}n`;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  return "[unserializable]";
}

function toSerializable(
  value: unknown,
  seen: WeakSet<object>,
  depth: number
): unknown {
  if (depth > 4) {
    return "[MaxDepth]";
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? value.toISOString() : "Invalid Date";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => toSerializable(entry, seen, depth + 1));
  }

  if (typeof value === "object") {
    const objectValue = value as object;
    if (seen.has(objectValue)) {
      return "[Circular]";
    }
    seen.add(objectValue);

    const output: Record<string, unknown> = {};
    let keys: string[] = [];
    try {
      keys = Object.keys(objectValue).slice(0, 50);
    } catch (error) {
      return {
        type: Object.prototype.toString.call(objectValue),
        readError: summarizePrimitive(error),
      };
    }

    for (const key of keys) {
      try {
        output[key] = toSerializable(
          (objectValue as Record<string, unknown>)[key],
          seen,
          depth + 1
        );
      } catch (error) {
        output[key] = `[Thrown: ${summarizePrimitive(error)}]`;
      }
    }
    return output;
  }

  return summarizePrimitive(value);
}

function normalizePathnameForLog(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  const hashPath = window.location.hash.replace(/^#/, "").trim();
  if (hashPath.startsWith("/")) {
    return hashPath;
  }

  const pathname = window.location.pathname.trim();
  return pathname.length > 0 ? pathname : "/";
}

function setDesktopFatalError(
  source: DesktopFatalError["source"],
  message: string,
  details: unknown
) {
  if (typeof window === "undefined") {
    return;
  }

  const fatalError: DesktopFatalError = {
    timestamp: new Date().toISOString(),
    pathname: normalizePathnameForLog(),
    source,
    message,
    details: sanitizeForLog(details),
  };

  window.__FOUNDRY_DESKTOP_FATAL_ERROR__ = fatalError;
  window.dispatchEvent(
    new CustomEvent<DesktopFatalError>(DESKTOP_FATAL_ERROR_EVENT, {
      detail: fatalError,
    })
  );
}

export function sanitizeForLog(value: unknown): unknown {
  return toSerializable(value, new WeakSet<object>(), 0);
}

export function resolveErrorMessage(error: unknown, fallback = "Unknown error"): string {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
    if (
      typeof message === "number" ||
      typeof message === "boolean" ||
      typeof message === "bigint"
    ) {
      return String(message);
    }
  }
  return fallback;
}

export function normalizeErrorForLog(error: unknown): Record<string, unknown> {
  return {
    message: resolveErrorMessage(error),
    detail: sanitizeForLog(error),
  };
}

function pushLogBuffer(entry: DesktopLogEntry) {
  if (typeof window === "undefined") {
    return;
  }

  const currentBuffer = window.__FOUNDRY_DESKTOP_LOG_BUFFER__ ?? [];
  currentBuffer.push(entry);
  if (currentBuffer.length > LOG_BUFFER_LIMIT) {
    currentBuffer.splice(0, currentBuffer.length - LOG_BUFFER_LIMIT);
  }
  window.__FOUNDRY_DESKTOP_LOG_BUFFER__ = currentBuffer;
}

export function logDesktop(
  level: DesktopLogLevel,
  scope: string,
  message: string,
  details?: unknown
) {
  const entry: DesktopLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    ...(details !== undefined ? { details: sanitizeForLog(details) } : {}),
  };

  const prefix = `[desktop:${scope}] ${message}`;
  try {
    if (level === "error") {
      if (entry.details !== undefined) {
        console.error(prefix, entry.details);
      } else {
        console.error(prefix);
      }
    } else if (level === "warn") {
      if (entry.details !== undefined) {
        console.warn(prefix, entry.details);
      } else {
        console.warn(prefix);
      }
    } else if (entry.details !== undefined) {
      console.info(prefix, entry.details);
    } else {
      console.info(prefix);
    }
  } catch {
    // Guard logging itself from crashing runtime.
  }

  pushLogBuffer(entry);
}

export function installDesktopGlobalErrorLogging(): void {
  if (globalListenersInstalled || typeof window === "undefined") {
    return;
  }
  globalListenersInstalled = true;

  window.addEventListener("error", (event) => {
    const message = event.message || resolveErrorMessage(event.error, "Unhandled window error");
    const details = {
      pathname: normalizePathnameForLog(),
      message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: normalizeErrorForLog(event.error),
    };

    logDesktop("error", "runtime", "Unhandled window error", {
      ...details,
    });
    setDesktopFatalError("window.error", message, details);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = normalizeErrorForLog(event.reason);
    const message = resolveErrorMessage(event.reason, "Unhandled promise rejection");
    const details = {
      pathname: normalizePathnameForLog(),
      reason,
    };

    logDesktop("error", "runtime", "Unhandled promise rejection", {
      ...details,
    });
    setDesktopFatalError("unhandledrejection", message, details);
  });
}

export function readDesktopFatalError(): DesktopFatalError | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.__FOUNDRY_DESKTOP_FATAL_ERROR__ ?? null;
}

export function clearDesktopFatalError(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.__FOUNDRY_DESKTOP_FATAL_ERROR__ = null;
}
