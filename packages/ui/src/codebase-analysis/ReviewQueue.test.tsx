import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewQueue } from "./ReviewQueue";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org-1" } }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: () => vi.fn(),
}));

vi.mock("./ImplementationBadge", () => ({
  ImplementationBadge: () => null,
}));

describe("ReviewQueue", () => {
  it("shows empty message when no pending reviews", () => {
    render(<ReviewQueue programId="prog-1" />);
    expect(
      screen.getByText("No pending reviews. All analysis results have been processed."),
    ).toBeInTheDocument();
  });
});
