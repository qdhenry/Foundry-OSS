import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommentThread } from "./CommentThread";

let mockComments: any;
const mockCreateComment = vi.fn();
const mockDeleteComment = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: () => mockComments,
  useMutation: (fnRef: string) => {
    if (fnRef === "comments:create") return mockCreateComment;
    if (fnRef === "comments:remove") return mockDeleteComment;
    return vi.fn();
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    comments: {
      listByEntity: "comments:listByEntity",
      create: "comments:create",
      remove: "comments:remove",
    },
  },
}));

describe("CommentThread", () => {
  const defaultProps = {
    entityType: "requirement" as const,
    entityId: "req-1",
    programId: "prog-1",
    orgId: "org-1",
  };

  it("renders heading", () => {
    mockComments = [];
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByText("Comments")).toBeInTheDocument();
  });

  it("renders empty state when no comments", () => {
    mockComments = [];
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByText("No comments yet. Start the conversation.")).toBeInTheDocument();
  });

  it("renders comment text input and Post button", () => {
    mockComments = [];
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument();
    expect(screen.getByText("Post")).toBeInTheDocument();
  });

  it("disables Post when textarea is empty", () => {
    mockComments = [];
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByText("Post")).toBeDisabled();
  });

  it("renders comments with author and content", () => {
    mockComments = [
      {
        _id: "c1",
        _creationTime: Date.now() - 60_000,
        authorId: "user-1",
        authorName: "Alice",
        content: "This looks good!",
      },
    ];
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("This looks good!")).toBeInTheDocument();
    expect(screen.getByText("Reply")).toBeInTheDocument();
  });

  it("shows comment count in heading", () => {
    mockComments = [
      {
        _id: "c1",
        _creationTime: Date.now(),
        authorId: "user-1",
        authorName: "Alice",
        content: "Hello",
      },
      {
        _id: "c2",
        _creationTime: Date.now(),
        authorId: "user-2",
        authorName: "Bob",
        content: "World",
      },
    ];
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByText("(2)")).toBeInTheDocument();
  });
});
