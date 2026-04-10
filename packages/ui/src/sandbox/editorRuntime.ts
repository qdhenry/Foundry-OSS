export type EditorType = "monaco" | "codemirror" | "none";

type DesktopRuntimeWindow = Window & {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
};

export function isDesktopRuntimeEnvironment(
  runtimeWindow: Window | DesktopRuntimeWindow | undefined = typeof window === "undefined"
    ? undefined
    : window,
): boolean {
  if (!runtimeWindow) return false;
  const desktopWindow = runtimeWindow as DesktopRuntimeWindow;
  return Boolean(desktopWindow.__TAURI__ || desktopWindow.__TAURI_INTERNALS__);
}

export function normalizeEditorType(value: unknown): EditorType | undefined {
  if (value === "monaco" || value === "codemirror" || value === "none") {
    return value;
  }
  return undefined;
}

export function resolveEditorTypeForRuntime(
  value: unknown,
  options: { desktopRuntime?: boolean; fallback?: EditorType } = {},
): EditorType {
  const fallback = options.fallback ?? "none";
  const normalized = normalizeEditorType(value) ?? fallback;
  const desktopRuntime = options.desktopRuntime ?? isDesktopRuntimeEnvironment();
  if (desktopRuntime && normalized === "monaco") {
    return "codemirror";
  }
  return normalized;
}
