import { describe, expect, it } from "vitest";
import { ProgramProvider, useProgramContext } from "./programContext";

describe("programContext", () => {
  it("exports ProgramProvider", () => {
    expect(ProgramProvider).toBeDefined();
    expect(typeof ProgramProvider).toBe("function");
  });

  it("exports useProgramContext", () => {
    expect(useProgramContext).toBeDefined();
    expect(typeof useProgramContext).toBe("function");
  });
});
