import { describe, expect, it } from "vitest";

import {
  isDesktopRuntimeEnvironment,
  normalizeEditorType,
  resolveEditorTypeForRuntime,
} from "./editorRuntime";

describe("editorRuntime", () => {
  it("normalizes supported editor types", () => {
    expect(normalizeEditorType("monaco")).toBe("monaco");
    expect(normalizeEditorType("codemirror")).toBe("codemirror");
    expect(normalizeEditorType("none")).toBe("none");
    expect(normalizeEditorType("vscode")).toBeUndefined();
  });

  it("detects desktop runtime from tauri globals", () => {
    expect(isDesktopRuntimeEnvironment(undefined)).toBe(false);
    expect(isDesktopRuntimeEnvironment({} as Window)).toBe(false);
    expect(
      isDesktopRuntimeEnvironment({
        __TAURI__: { invoke: () => Promise.resolve() },
      } as unknown as Window),
    ).toBe(true);
    expect(isDesktopRuntimeEnvironment({ __TAURI_INTERNALS__: {} } as unknown as Window)).toBe(
      true,
    );
  });

  it("falls back from monaco to codemirror in desktop runtime", () => {
    expect(
      resolveEditorTypeForRuntime("monaco", {
        desktopRuntime: true,
        fallback: "none",
      }),
    ).toBe("codemirror");
    expect(
      resolveEditorTypeForRuntime("codemirror", {
        desktopRuntime: true,
        fallback: "none",
      }),
    ).toBe("codemirror");
    expect(resolveEditorTypeForRuntime("none", { desktopRuntime: true, fallback: "none" })).toBe(
      "none",
    );
    expect(
      resolveEditorTypeForRuntime(undefined, {
        desktopRuntime: false,
        fallback: "monaco",
      }),
    ).toBe("monaco");
  });
});
