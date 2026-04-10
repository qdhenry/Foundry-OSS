import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const contextState = vi.hoisted(() => ({
  programId: "prog-1",
  slug: "acme",
}));

const workstreamsPageSpy = vi.fn(() => null);

vi.mock("../../../../lib/programContext", () => ({
  useProgramContext: () => contextState,
}));

vi.mock("@foundry/ui", () => ({
  WorkstreamsPage: (props: { programId: string; programSlug: string }) => {
    workstreamsPageSpy(props);
    return null;
  },
}));

import ProgramWorkstreamsPage from "./page";

describe("ProgramWorkstreamsPage", () => {
  beforeEach(() => {
    contextState.programId = "prog-1";
    contextState.slug = "acme";
    workstreamsPageSpy.mockClear();
  });

  it("passes program id and slug to shared WorkstreamsPage", () => {
    render(<ProgramWorkstreamsPage />);

    expect(workstreamsPageSpy).toHaveBeenCalledWith({
      programId: "prog-1",
      programSlug: "acme",
    });
  });

  it("falls back to program id when slug is missing", () => {
    contextState.slug = "";

    render(<ProgramWorkstreamsPage />);

    expect(workstreamsPageSpy).toHaveBeenCalledWith({
      programId: "prog-1",
      programSlug: "prog-1",
    });
  });
});
