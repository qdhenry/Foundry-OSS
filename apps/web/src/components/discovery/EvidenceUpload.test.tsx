import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvidenceUpload } from "./EvidenceUpload";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    evidence: {
      generateUploadUrl: "evidence:generateUploadUrl",
      save: "evidence:save",
    },
  },
}));

describe("EvidenceUpload", () => {
  it("renders upload button", () => {
    render(<EvidenceUpload requirementId="req-1" orgId="org-1" />);
    expect(screen.getByText("Upload Evidence")).toBeInTheDocument();
  });

  it("has hidden file input", () => {
    const { container } = render(<EvidenceUpload requirementId="req-1" orgId="org-1" />);
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("hidden");
  });

  it("accepts correct file types", () => {
    const { container } = render(<EvidenceUpload requirementId="req-1" orgId="org-1" />);
    const input = container.querySelector('input[type="file"]');
    expect(input?.getAttribute("accept")).toBe(".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv");
  });
});
