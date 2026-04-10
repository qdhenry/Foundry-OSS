import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel";

let queryReturn: any;
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: () => queryReturn,
  useMutation: () => vi.fn(),
}));

describe("ChatPanel", () => {
  it("shows empty state when no messages", () => {
    queryReturn = [];
    render(<ChatPanel analysisId="a-1" orgId="org-1" />);
    expect(screen.getByText("Ask questions about the codebase.")).toBeInTheDocument();
  });

  it("renders chat input placeholder", () => {
    queryReturn = [];
    render(<ChatPanel analysisId="a-1" orgId="org-1" />);
    expect(screen.getByPlaceholderText("Ask about the codebase...")).toBeInTheDocument();
  });

  it("renders messages", () => {
    queryReturn = [
      { _id: "m1", role: "user", content: "What does this do?" },
      { _id: "m2", role: "assistant", content: "It handles auth." },
    ];
    render(<ChatPanel analysisId="a-1" orgId="org-1" />);
    expect(screen.getByText("What does this do?")).toBeInTheDocument();
    expect(screen.getByText("It handles auth.")).toBeInTheDocument();
  });

  it("send button disabled when input empty", () => {
    queryReturn = [];
    render(<ChatPanel analysisId="a-1" orgId="org-1" />);
    const buttons = screen.getAllByRole("button");
    const sendBtn = buttons[buttons.length - 1];
    expect(sendBtn).toBeDisabled();
  });
});
