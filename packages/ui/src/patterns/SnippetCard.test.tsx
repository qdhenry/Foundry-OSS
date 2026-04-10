import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PatternSnippet } from "./SnippetCard";
import { SnippetCard } from "./SnippetCard";

const mockUpvote = vi.fn();
const mockFlag = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: vi.fn((fn: string) => {
    if (fn.includes("upvote")) return mockUpvote;
    if (fn.includes("flag")) return mockFlag;
    return vi.fn();
  }),
}));

function makeSnippet(overrides: Partial<PatternSnippet> = {}): PatternSnippet {
  return {
    _id: "snip-1",
    title: "Cart Price Calculator",
    description: "Calculates cart total with discounts",
    code: "const total = items.reduce((s, i) => s + i.price, 0);",
    requirementCategory: "Commerce",
    targetPlatform: "salesforce_b2b",
    language: "TypeScript",
    successRating: "high",
    upvotes: 12,
    flagCount: 0,
    ...overrides,
  };
}

describe("SnippetCard", () => {
  it("renders snippet title", () => {
    render(<SnippetCard snippet={makeSnippet()} />);
    expect(screen.getByText("Cart Price Calculator")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<SnippetCard snippet={makeSnippet()} />);
    expect(screen.getByText("Calculates cart total with discounts")).toBeInTheDocument();
  });

  it("renders code block", () => {
    render(<SnippetCard snippet={makeSnippet()} />);
    expect(screen.getByText(/const total/)).toBeInTheDocument();
  });

  it("renders platform label", () => {
    render(<SnippetCard snippet={makeSnippet()} />);
    expect(screen.getByText("Salesforce B2B")).toBeInTheDocument();
  });

  it("renders language badge", () => {
    render(<SnippetCard snippet={makeSnippet()} />);
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("renders category badge", () => {
    render(<SnippetCard snippet={makeSnippet()} />);
    expect(screen.getByText("Commerce")).toBeInTheDocument();
  });

  it("renders upvote count", () => {
    render(<SnippetCard snippet={makeSnippet()} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders annotations when present", () => {
    render(<SnippetCard snippet={makeSnippet({ annotations: "Use with caution" })} />);
    expect(screen.getByText("Use with caution")).toBeInTheDocument();
  });

  it("renders Flag button", () => {
    render(<SnippetCard snippet={makeSnippet()} />);
    expect(screen.getByText("Flag")).toBeInTheDocument();
  });

  it("calls upvote mutation on upvote click", async () => {
    render(<SnippetCard snippet={makeSnippet()} />);
    await userEvent.click(screen.getByText("12"));
    expect(mockUpvote).toHaveBeenCalled();
  });
});
