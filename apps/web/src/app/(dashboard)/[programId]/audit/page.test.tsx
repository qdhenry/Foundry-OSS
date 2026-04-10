import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const contextState = vi.hoisted(() => ({
  programId: "prog-1",
  slug: "acme-program",
}));

const auditRouteSpy = vi.fn(() => null);

vi.mock("../../../../lib/programContext", () => ({
  useProgramContext: () => contextState,
}));

vi.mock("@foundry/ui/audit", () => ({
  ProgramAuditRoute: (props: {
    useProgramContext: () => {
      programId: string;
      slug: string;
    };
  }) => {
    auditRouteSpy(props);
    return null;
  },
}));

import AuditPage from "./page";

describe("AuditPage wrapper", () => {
  beforeEach(() => {
    contextState.programId = "prog-1";
    contextState.slug = "acme-program";
    auditRouteSpy.mockClear();
  });

  it("passes the program context hook to shared ProgramAuditRoute", () => {
    render(<AuditPage />);

    expect(auditRouteSpy).toHaveBeenCalledWith({
      useProgramContext: expect.any(Function),
    });

    const call = auditRouteSpy.mock.calls[0];
    const hook = call?.[0]?.useProgramContext;
    expect(hook()).toEqual(contextState);
  });
});
