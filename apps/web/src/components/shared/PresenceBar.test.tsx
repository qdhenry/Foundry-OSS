import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresenceBar } from "./PresenceBar";

let mockProgramId: string | undefined = "prog-1";
let mockPathname = "/prog-1/discovery";
let mockLivePresence: any[] | undefined;
let mockListByPageArgs: any = null;
const mockUpsertPresence = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ programId: mockProgramId }),
  usePathname: () => mockPathname,
}));

vi.mock("convex/react", () => ({
  useMutation: (fnRef: string) => {
    if (fnRef === "presence:upsert") return mockUpsertPresence;
    return vi.fn();
  },
  useQuery: (fnRef: string, args: unknown) => {
    if (fnRef === "presence:listByPage") {
      mockListByPageArgs = args;
      return mockLivePresence;
    }
    return undefined;
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    presence: {
      upsert: "presence:upsert",
      listByPage: "presence:listByPage",
    },
  },
}));

describe("PresenceBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    mockProgramId = "prog-1";
    mockPathname = "/prog-1/discovery";
    mockLivePresence = [];
    mockListByPageArgs = null;
    mockUpsertPresence.mockReset();
    mockUpsertPresence.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends presence heartbeat on mount and at interval", async () => {
    render(<PresenceBar />);

    expect(mockUpsertPresence).toHaveBeenCalledWith({
      programId: "prog-1",
      page: "discovery",
    });
    expect(mockListByPageArgs).toEqual({ programId: "prog-1", page: "discovery" });

    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(mockUpsertPresence).toHaveBeenCalledTimes(2);
  });

  it("renders collaborator avatars and names from listByPage data", () => {
    mockLivePresence = [
      { _id: "p-1", userName: "Alice Smith", userAvatarUrl: "https://example.com/alice.jpg" },
      { _id: "p-2", userName: "Bob Johnson", userAvatarUrl: null },
    ];

    render(<PresenceBar />);

    expect(screen.getByText("Viewing: Discovery")).toBeInTheDocument();
    expect(screen.getByAltText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("BJ")).toBeInTheDocument();
    expect(screen.getByText("Bob Johnson")).toBeInTheDocument();
  });
});
