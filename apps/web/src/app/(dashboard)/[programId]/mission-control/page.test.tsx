import { describe, expect, it, vi } from "vitest";

const mockRedirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import MissionControlRedirect from "./page";

describe("MissionControlRedirect", () => {
  it("redirects to the program root", async () => {
    const params = Promise.resolve({ programId: "my-program" });
    await MissionControlRedirect({ params });
    expect(mockRedirect).toHaveBeenCalledWith("/my-program");
  });
});
