import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RepoBadge } from "./RepoBadge";

vi.mock("./icons", () => ({
  GithubIcon: ({ className }: { className?: string }) => (
    <span data-testid="github-icon" className={className} />
  ),
}));

describe("RepoBadge", () => {
  it("renders repo full name", () => {
    render(<RepoBadge repoFullName="org/my-repo" />);
    expect(screen.getByText("org/my-repo")).toBeInTheDocument();
  });

  it("links to GitHub repo", () => {
    render(<RepoBadge repoFullName="org/my-repo" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://github.com/org/my-repo");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows GitHub icon", () => {
    render(<RepoBadge repoFullName="org/my-repo" />);
    expect(screen.getByTestId("github-icon")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<RepoBadge repoFullName="org/my-repo" className="extra-class" />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("extra-class");
  });
});
