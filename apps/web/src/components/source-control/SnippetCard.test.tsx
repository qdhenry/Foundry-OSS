import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SnippetCard } from "./SnippetCard";

const mockMutationFn = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockMutationFn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sourceControl: {
      patterns: {
        snippetStorage: {
          upvoteSnippet: "sourceControl.patterns.snippetStorage:upvoteSnippet",
          flagSnippet: "sourceControl.patterns.snippetStorage:flagSnippet",
        },
      },
    },
  },
}));

const baseSnippet = {
  _id: "snippet-1" as any,
  title: "Payment Integration Helper",
  description: "A utility for processing Stripe payments in B2B context",
  code: "const stripe = new Stripe(apiKey);",
  requirementCategory: "Payments",
  targetPlatform: "salesforce_b2b",
  language: "TypeScript",
  successRating: "high",
  upvotes: 5,
  flagCount: 0,
};

describe("SnippetCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and description", () => {
    render(<SnippetCard snippet={baseSnippet} />);
    expect(screen.getByText("Payment Integration Helper")).toBeInTheDocument();
    expect(
      screen.getByText("A utility for processing Stripe payments in B2B context"),
    ).toBeInTheDocument();
  });

  it("renders code block", () => {
    render(<SnippetCard snippet={baseSnippet} />);
    expect(screen.getByText("const stripe = new Stripe(apiKey);")).toBeInTheDocument();
  });

  it("displays platform label mapped from value", () => {
    render(<SnippetCard snippet={baseSnippet} />);
    expect(screen.getByText("Salesforce B2B")).toBeInTheDocument();
  });

  it("displays language and category badges", () => {
    render(<SnippetCard snippet={baseSnippet} />);
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
  });

  it("shows annotations when provided", () => {
    render(
      <SnippetCard snippet={{ ...baseSnippet, annotations: "Use with caution in production" }} />,
    );
    expect(screen.getByText("Use with caution in production")).toBeInTheDocument();
  });

  it("does not show annotations when not provided", () => {
    render(<SnippetCard snippet={baseSnippet} />);
    expect(screen.queryByText(/caution/)).not.toBeInTheDocument();
  });

  it("displays upvote count", () => {
    render(<SnippetCard snippet={baseSnippet} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("calls mutation on upvote button click", async () => {
    const user = userEvent.setup();
    render(<SnippetCard snippet={baseSnippet} />);
    // Click the upvote button (contains the upvote count)
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]); // first button is upvote
    expect(mockMutationFn).toHaveBeenCalled();
  });

  it("shows Flag button", () => {
    render(<SnippetCard snippet={baseSnippet} />);
    expect(screen.getByText("Flag")).toBeInTheDocument();
  });
});
