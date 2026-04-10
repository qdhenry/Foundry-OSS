import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMobileBreakpoint } from "./useMobileBreakpoint";

describe("useMobileBreakpoint", () => {
  let listeners: Array<(event: { matches: boolean }) => void> = [];
  let currentMatches = false;

  beforeEach(() => {
    listeners = [];
    currentMatches = false;
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: currentMatches,
        media: query,
        addEventListener: (_: string, handler: any) => listeners.push(handler),
        removeEventListener: (_: string, handler: any) => {
          listeners = listeners.filter((l) => l !== handler);
        },
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false on desktop (above 768px)", () => {
    currentMatches = false;
    const { result } = renderHook(() => useMobileBreakpoint());
    expect(result.current).toBe(false);
  });

  it("returns true on mobile (below 768px)", () => {
    currentMatches = true;
    const { result } = renderHook(() => useMobileBreakpoint());
    expect(result.current).toBe(true);
  });

  it("updates when viewport changes", () => {
    currentMatches = false;
    const { result } = renderHook(() => useMobileBreakpoint());
    expect(result.current).toBe(false);

    act(() => {
      listeners.forEach((l) => l({ matches: true }));
    });
    expect(result.current).toBe(true);
  });
});
