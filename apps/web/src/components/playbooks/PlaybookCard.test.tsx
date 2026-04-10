import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlaybookCard } from "./PlaybookCard";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/programContext", () => ({
  useProgramContext: () => ({
    program: { _id: "prog-1", name: "Test" },
    programId: "prog-1",
    slug: "test-program",
  }),
}));

const mockPlaybook = {
  _id: "playbook-1",
  name: "Magento to Salesforce B2B Migration",
  description: "Step-by-step migration playbook.",
  targetPlatform: "salesforce_b2b" as const,
  steps: [{ title: "Discovery" }, { title: "Data Mapping" }, { title: "Integration" }],
  status: "published" as const,
};

describe("PlaybookCard", () => {
  it("renders playbook name", () => {
    render(<PlaybookCard playbook={mockPlaybook} programId="prog-1" />);
    expect(screen.getByText("Magento to Salesforce B2B Migration")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<PlaybookCard playbook={mockPlaybook} programId="prog-1" />);
    expect(screen.getByText("Step-by-step migration playbook.")).toBeInTheDocument();
  });

  it("renders platform badge", () => {
    render(<PlaybookCard playbook={mockPlaybook} programId="prog-1" />);
    expect(screen.getByText("Salesforce B2B")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<PlaybookCard playbook={mockPlaybook} programId="prog-1" />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("renders step count", () => {
    render(<PlaybookCard playbook={mockPlaybook} programId="prog-1" />);
    expect(screen.getByText(/3 steps/)).toBeInTheDocument();
  });

  it("renders draft status", () => {
    render(<PlaybookCard playbook={{ ...mockPlaybook, status: "draft" }} programId="prog-1" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
});
