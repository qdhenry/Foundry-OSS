import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CommitsSection } from "./CommitsSection";

const mockCommits = [
  {
    sha: "abc1234567890",
    message: "feat: add login form\n\nAdded new login form with validation",
    authorLogin: "dev1",
    authorName: "Developer One",
    timestamp: Date.now() - 3600_000,
    url: "https://github.com/org/repo/commit/abc1234",
    filesChanged: 3,
    additions: 50,
    deletions: 10,
  },
  {
    sha: "def5678901234",
    message: "fix: typo in header",
    authorLogin: "dev2",
    timestamp: Date.now() - 7200_000,
    filesChanged: 1,
    additions: 1,
    deletions: 1,
  },
];

describe("CommitsSection", () => {
  it("renders header with commit count", () => {
    render(<CommitsSection commits={mockCommits} />);
    expect(screen.getByText("Commits")).toBeInTheDocument();
    expect(screen.getByText("2 commits")).toBeInTheDocument();
  });

  it("renders singular commit count", () => {
    render(<CommitsSection commits={[mockCommits[0]]} />);
    expect(screen.getByText("1 commit")).toBeInTheDocument();
  });

  it("shows empty state when no commits", () => {
    render(<CommitsSection commits={[]} />);
    expect(screen.getByText("No commits yet")).toBeInTheDocument();
  });

  it("displays commit first line and shortened SHA", () => {
    render(<CommitsSection commits={mockCommits} />);
    expect(screen.getByText("feat: add login form")).toBeInTheDocument();
    expect(screen.getByText("abc1234")).toBeInTheDocument();
    expect(screen.getByText("fix: typo in header")).toBeInTheDocument();
  });

  it("shows author name when available, falls back to login", () => {
    render(<CommitsSection commits={mockCommits} />);
    expect(screen.getByText("Developer One")).toBeInTheDocument();
    expect(screen.getByText("dev2")).toBeInTheDocument();
  });

  it("collapses and expands on header click", async () => {
    const user = userEvent.setup();
    render(<CommitsSection commits={mockCommits} />);
    expect(screen.getByText("feat: add login form")).toBeInTheDocument();

    await user.click(screen.getByText("Commits"));
    expect(screen.queryByText("feat: add login form")).not.toBeInTheDocument();

    await user.click(screen.getByText("Commits"));
    expect(screen.getByText("feat: add login form")).toBeInTheDocument();
  });

  it("renders commit URL as link when provided", () => {
    render(<CommitsSection commits={mockCommits} />);
    const link = screen.getByText("abc1234");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "https://github.com/org/repo/commit/abc1234");
  });

  it("shows 'more' button for multi-line commit messages", async () => {
    const user = userEvent.setup();
    render(<CommitsSection commits={mockCommits} />);
    const moreBtn = screen.getByText("more");
    expect(moreBtn).toBeInTheDocument();

    await user.click(moreBtn);
    // Full message is rendered in a <pre> element
    const preElement = document.querySelector("pre");
    expect(preElement?.textContent).toContain("Added new login form with validation");
    expect(screen.getByText("less")).toBeInTheDocument();
  });

  it("displays file change stats", () => {
    render(<CommitsSection commits={mockCommits} />);
    expect(screen.getByText("3 files")).toBeInTheDocument();
    expect(screen.getByText("+50")).toBeInTheDocument();
    expect(screen.getByText("-10")).toBeInTheDocument();
  });
});
