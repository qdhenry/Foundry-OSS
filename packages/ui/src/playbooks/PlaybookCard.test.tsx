import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlaybookCard } from "./PlaybookCard";

const mockPush = vi.fn();

vi.mock("@foundry/ui/programs", () => ({
  useProgramContext: () => ({ slug: "test-program" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("PlaybookCard", () => {
  const defaultPlaybook = {
    _id: "pb-1",
    name: "Migration Playbook",
    description: "Step-by-step migration guide",
    targetPlatform: "salesforce_b2b" as const,
    steps: [{ title: "Setup" }, { title: "Migrate" }, { title: "Validate" }],
    status: "published" as const,
  };

  it("renders playbook name", () => {
    render(<PlaybookCard playbook={defaultPlaybook} programId="prog-1" />);
    expect(screen.getByText("Migration Playbook")).toBeInTheDocument();
  });

  it("renders Published status badge", () => {
    render(<PlaybookCard playbook={defaultPlaybook} programId="prog-1" />);
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("renders Draft status badge", () => {
    render(<PlaybookCard playbook={{ ...defaultPlaybook, status: "draft" }} programId="prog-1" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<PlaybookCard playbook={defaultPlaybook} programId="prog-1" />);
    expect(screen.getByText("Step-by-step migration guide")).toBeInTheDocument();
  });

  it("renders platform label", () => {
    render(<PlaybookCard playbook={defaultPlaybook} programId="prog-1" />);
    expect(screen.getByText("Salesforce B2B")).toBeInTheDocument();
  });

  it("renders step count", () => {
    render(<PlaybookCard playbook={defaultPlaybook} programId="prog-1" />);
    expect(screen.getByText("3 steps")).toBeInTheDocument();
  });

  it("renders singular step for 1 step", () => {
    render(
      <PlaybookCard
        playbook={{ ...defaultPlaybook, steps: [{ title: "Only" }] }}
        programId="prog-1"
      />,
    );
    expect(screen.getByText("1 step")).toBeInTheDocument();
  });

  it("navigates to detail page on click", async () => {
    render(<PlaybookCard playbook={defaultPlaybook} programId="prog-1" />);
    await userEvent.click(screen.getByText("Migration Playbook"));
    expect(mockPush).toHaveBeenCalledWith("/test-program/playbooks/pb-1");
  });
});
