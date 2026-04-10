import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommitsSection } from "./CommitsSection";

function makeCommit(overrides = {}) {
  return {
    sha: "abc1234567890",
    message: "feat: add user auth",
    authorLogin: "octocat",
    timestamp: Date.now() - 60_000 * 5,
    ...overrides,
  };
}

describe("CommitsSection", () => {
  it("renders header with commit count", () => {
    render(<CommitsSection commits={[makeCommit(), makeCommit({ sha: "def456" })]} />);
    expect(screen.getByText("Commits")).toBeInTheDocument();
    expect(screen.getByText("2 commits")).toBeInTheDocument();
  });

  it("renders singular commit label", () => {
    render(<CommitsSection commits={[makeCommit()]} />);
    expect(screen.getByText("1 commit")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<CommitsSection commits={[]} />);
    expect(screen.getByText("No commits yet")).toBeInTheDocument();
  });

  it("renders shortened SHA", () => {
    render(<CommitsSection commits={[makeCommit()]} />);
    expect(screen.getByText("abc1234")).toBeInTheDocument();
  });

  it("renders commit first line", () => {
    render(<CommitsSection commits={[makeCommit()]} />);
    expect(screen.getByText("feat: add user auth")).toBeInTheDocument();
  });

  it("renders author name when provided", () => {
    render(<CommitsSection commits={[makeCommit({ authorName: "Octocat" })]} />);
    expect(screen.getByText("Octocat")).toBeInTheDocument();
  });

  it("falls back to authorLogin", () => {
    render(<CommitsSection commits={[makeCommit()]} />);
    expect(screen.getByText("octocat")).toBeInTheDocument();
  });

  it("renders file change stats", () => {
    render(
      <CommitsSection commits={[makeCommit({ filesChanged: 3, additions: 50, deletions: 10 })]} />,
    );
    expect(screen.getByText("3 files")).toBeInTheDocument();
    expect(screen.getByText("+50")).toBeInTheDocument();
    expect(screen.getByText("-10")).toBeInTheDocument();
  });

  it("renders SHA as link when url provided", () => {
    render(
      <CommitsSection commits={[makeCommit({ url: "https://github.com/repo/commit/abc" })]} />,
    );
    const link = screen.getByText("abc1234").closest("a");
    expect(link).toHaveAttribute("href", "https://github.com/repo/commit/abc");
  });

  it("collapses when header is clicked", () => {
    render(<CommitsSection commits={[makeCommit()]} />);
    expect(screen.getByText("abc1234")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Commits"));
    expect(screen.queryByText("abc1234")).not.toBeInTheDocument();
  });

  it("shows more button for multi-line messages", () => {
    render(<CommitsSection commits={[makeCommit({ message: "first line\n\nsecond line" })]} />);
    expect(screen.getByText("more")).toBeInTheDocument();
  });

  it("expands full message on more click", () => {
    render(<CommitsSection commits={[makeCommit({ message: "first line\n\nsecond line" })]} />);
    fireEvent.click(screen.getByText("more"));
    expect(screen.getByText(/second line/)).toBeInTheDocument();
    expect(screen.getByText("less")).toBeInTheDocument();
  });
});
