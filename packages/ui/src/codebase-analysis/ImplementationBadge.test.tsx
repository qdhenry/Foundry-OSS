import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImplementationBadge } from "./ImplementationBadge";

describe("ImplementationBadge", () => {
  it("returns null when no status", () => {
    const { container } = render(
      <ImplementationBadge status={undefined} confidence={90} lastAnalyzedAt={Date.now()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null when no lastAnalyzedAt", () => {
    const { container } = render(
      <ImplementationBadge status="fully_implemented" confidence={90} lastAnalyzedAt={undefined} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders confidence percentage", () => {
    render(
      <ImplementationBadge
        status="fully_implemented"
        confidence={95}
        lastAnalyzedAt={Date.now()}
      />,
    );
    expect(screen.getByText("95%")).toBeInTheDocument();
  });

  it("renders relative time", () => {
    render(
      <ImplementationBadge
        status="partially_implemented"
        confidence={60}
        lastAnalyzedAt={Date.now()}
      />,
    );
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("returns null for unknown status", () => {
    const { container } = render(
      <ImplementationBadge status="unknown_status" confidence={50} lastAnalyzedAt={Date.now()} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
