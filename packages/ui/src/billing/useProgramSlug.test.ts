import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBillingSettingsUrl, useProgramSettingsPath } from "./useProgramSlug";

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

describe("useProgramSlug hooks", () => {
  beforeEach(() => {
    mocks.usePathname.mockReset();
  });

  describe("useBillingSettingsUrl", () => {
    it('returns "/boston-beer-merchtank/settings?tab=billing" when pathname is "/boston-beer-merchtank/tasks"', () => {
      mocks.usePathname.mockReturnValue("/boston-beer-merchtank/tasks");
      const { result } = renderHook(() => useBillingSettingsUrl());
      expect(result.current).toBe("/boston-beer-merchtank/settings?tab=billing");
    });

    it('returns "/settings?tab=billing" when pathname is "/"', () => {
      mocks.usePathname.mockReturnValue("/");
      const { result } = renderHook(() => useBillingSettingsUrl());
      expect(result.current).toBe("/settings?tab=billing");
    });

    it('returns "/settings?tab=billing" when pathname is null', () => {
      mocks.usePathname.mockReturnValue(null);
      const { result } = renderHook(() => useBillingSettingsUrl());
      expect(result.current).toBe("/settings?tab=billing");
    });
  });

  describe("useProgramSettingsPath", () => {
    it('returns "/boston-beer-merchtank/settings" from pathname "/boston-beer-merchtank/tasks"', () => {
      mocks.usePathname.mockReturnValue("/boston-beer-merchtank/tasks");
      const { result } = renderHook(() => useProgramSettingsPath());
      expect(result.current).toBe("/boston-beer-merchtank/settings");
    });

    it('returns "/settings" when pathname is "/"', () => {
      mocks.usePathname.mockReturnValue("/");
      const { result } = renderHook(() => useProgramSettingsPath());
      expect(result.current).toBe("/settings");
    });

    it('returns "/settings" when pathname is null', () => {
      mocks.usePathname.mockReturnValue(null);
      const { result } = renderHook(() => useProgramSettingsPath());
      expect(result.current).toBe("/settings");
    });
  });
});
