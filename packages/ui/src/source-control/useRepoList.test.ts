import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRepoList } from "./useRepoList";

let mockQueryReturn: any;
const mockActionFn = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (_fn: any, args: any) => {
    if (args === "skip") return undefined;
    return mockQueryReturn;
  },
  useAction: () => mockActionFn,
}));

describe("useRepoList", () => {
  it("returns isLoadingConnected true when query is undefined", () => {
    mockQueryReturn = undefined;
    const { result } = renderHook(() =>
      useRepoList({ programId: "prog-1", installationId: undefined, orgId: undefined }),
    );
    expect(result.current.isLoadingConnected).toBe(true);
    expect(result.current.connectedRepos).toEqual([]);
  });

  it("returns connected repos from query", () => {
    mockQueryReturn = [
      { _id: "r1", repoFullName: "org/repo-a", role: "storefront" },
      { _id: "r2", repoFullName: "org/repo-b", role: "integration" },
    ];
    const { result } = renderHook(() =>
      useRepoList({ programId: "prog-1", installationId: undefined, orgId: undefined }),
    );
    expect(result.current.connectedRepos).toHaveLength(2);
    expect(result.current.connectedRepos[0].repoFullName).toBe("org/repo-a");
    expect(result.current.isLoadingConnected).toBe(false);
  });

  it("returns empty unconnected repos when no installationId", () => {
    mockQueryReturn = [];
    const { result } = renderHook(() =>
      useRepoList({ programId: "prog-1", installationId: undefined, orgId: undefined }),
    );
    expect(result.current.unconnectedRepos).toEqual([]);
    expect(result.current.isLoadingAvailable).toBe(false);
  });

  it("skips connected query when programId is undefined", () => {
    mockQueryReturn = undefined;
    const { result } = renderHook(() =>
      useRepoList({ programId: undefined, installationId: "inst-1", orgId: "org-1" }),
    );
    expect(result.current.isLoadingConnected).toBe(true);
  });
});
