import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useGitHubInstallation } from "./useGitHubInstallation";

let mockOrgValue: any = { id: "org-123" };
let mockQueryReturn: any;
const mockMutationFn = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: mockOrgValue }),
}));

vi.mock("convex/react", () => ({
  useQuery: (_fn: any, args: any) => {
    if (args === "skip") return undefined;
    return mockQueryReturn;
  },
  useMutation: () => mockMutationFn,
}));

describe("useGitHubInstallation", () => {
  it("returns isLoading true when installations are undefined", () => {
    mockQueryReturn = undefined;
    const { result } = renderHook(() => useGitHubInstallation());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.activeInstallation).toBeNull();
  });

  it("returns activeInstallation when one is active", () => {
    mockQueryReturn = [
      { installationId: "inst-1", status: "active" },
      { installationId: "inst-2", status: "suspended" },
    ];
    const { result } = renderHook(() => useGitHubInstallation());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.activeInstallation).toEqual({
      installationId: "inst-1",
      status: "active",
    });
    expect(result.current.isSuspended).toBe(false);
  });

  it("returns isSuspended true when only suspended installations exist", () => {
    mockQueryReturn = [{ installationId: "inst-1", status: "suspended" }];
    const { result } = renderHook(() => useGitHubInstallation());
    expect(result.current.isSuspended).toBe(true);
    expect(result.current.activeInstallation).toBeNull();
  });

  it("returns orgId from Clerk organization", () => {
    mockQueryReturn = [];
    mockOrgValue = { id: "org-456" };
    const { result } = renderHook(() => useGitHubInstallation());
    expect(result.current.orgId).toBe("org-456");
  });

  it("skips query when no organization", () => {
    mockOrgValue = null;
    mockQueryReturn = undefined;
    const { result } = renderHook(() => useGitHubInstallation());
    expect(result.current.orgId).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it("returns empty installations as not suspended", () => {
    mockQueryReturn = [];
    mockOrgValue = { id: "org-123" };
    const { result } = renderHook(() => useGitHubInstallation());
    expect(result.current.isSuspended).toBe(false);
    expect(result.current.activeInstallation).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
