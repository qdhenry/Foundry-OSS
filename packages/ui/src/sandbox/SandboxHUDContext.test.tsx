import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SandboxHUDProvider, useSandboxHUD } from "./SandboxHUDContext";

function wrapper({ children }: { children: ReactNode }) {
  return <SandboxHUDProvider>{children}</SandboxHUDProvider>;
}

describe("SandboxHUDContext", () => {
  it("starts with empty tabs", () => {
    const { result } = renderHook(() => useSandboxHUD(), { wrapper });
    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTabId).toBeNull();
    expect(result.current.isExpanded).toBe(false);
  });

  it("openTab adds a tab and activates it", () => {
    const { result } = renderHook(() => useSandboxHUD(), { wrapper });
    act(() => {
      result.current.openTab({
        sessionId: "s1",
        taskId: "t1",
        programSlug: "prog",
        taskTitle: "My Task",
        status: "executing",
      });
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe("s1");
    expect(result.current.isExpanded).toBe(true);
    expect(result.current.tabs[0].subTab).toBe("logs");
  });

  it("closeTab removes the tab", () => {
    const { result } = renderHook(() => useSandboxHUD(), { wrapper });
    act(() => {
      result.current.openTab({
        sessionId: "s1",
        taskId: "t1",
        programSlug: "p",
        taskTitle: "T",
        status: "ready",
      });
    });
    act(() => {
      result.current.closeTab("s1");
    });
    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.activeTabId).toBeNull();
    expect(result.current.isExpanded).toBe(false);
  });

  it("focusTab changes active tab", () => {
    const { result } = renderHook(() => useSandboxHUD(), { wrapper });
    act(() => {
      result.current.openTab({
        sessionId: "s1",
        taskId: "t1",
        programSlug: "p",
        taskTitle: "T1",
        status: "ready",
      });
      result.current.openTab({
        sessionId: "s2",
        taskId: "t2",
        programSlug: "p",
        taskTitle: "T2",
        status: "ready",
      });
    });
    act(() => {
      result.current.focusTab("s1");
    });
    expect(result.current.activeTabId).toBe("s1");
  });

  it("setSubTab changes active tab sub-tab", () => {
    const { result } = renderHook(() => useSandboxHUD(), { wrapper });
    act(() => {
      result.current.openTab({
        sessionId: "s1",
        taskId: "t1",
        programSlug: "p",
        taskTitle: "T",
        status: "ready",
      });
    });
    act(() => {
      result.current.setSubTab("terminal");
    });
    expect(result.current.tabs[0].subTab).toBe("terminal");
  });

  it("toggleExpanded flips expanded state", () => {
    const { result } = renderHook(() => useSandboxHUD(), { wrapper });
    act(() => {
      result.current.openTab({
        sessionId: "s1",
        taskId: "t1",
        programSlug: "p",
        taskTitle: "T",
        status: "ready",
      });
    });
    const before = result.current.isExpanded;
    act(() => {
      result.current.toggleExpanded();
    });
    expect(result.current.isExpanded).toBe(!before);
  });

  it("openConfig sets config panel state", () => {
    const { result } = renderHook(() => useSandboxHUD(), { wrapper });
    act(() => {
      result.current.openConfig({ taskId: "t1", programId: "p1", programSlug: "p", task: {} });
    });
    expect(result.current.isConfigPanelOpen).toBe(true);
    expect(result.current.configPanelContext?.taskId).toBe("t1");
  });

  it("closeConfig clears config panel", () => {
    const { result } = renderHook(() => useSandboxHUD(), { wrapper });
    act(() => {
      result.current.openConfig({ taskId: "t1", programId: "p1", programSlug: "p", task: {} });
    });
    act(() => {
      result.current.closeConfig();
    });
    expect(result.current.isConfigPanelOpen).toBe(false);
    expect(result.current.configPanelContext).toBeNull();
  });

  it("throws when useSandboxHUD called outside provider", () => {
    expect(() => {
      renderHook(() => useSandboxHUD());
    }).toThrow("useSandboxHUD must be used within a SandboxHUDProvider");
  });

  it("deduplicates tabs by taskId", () => {
    const { result } = renderHook(() => useSandboxHUD(), { wrapper });
    act(() => {
      result.current.openTab({
        sessionId: "s1",
        taskId: "t1",
        programSlug: "p",
        taskTitle: "T1",
        status: "ready",
      });
      result.current.openTab({
        sessionId: "s2",
        taskId: "t1",
        programSlug: "p",
        taskTitle: "T1-v2",
        status: "executing",
      });
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].sessionId).toBe("s2");
  });
});
