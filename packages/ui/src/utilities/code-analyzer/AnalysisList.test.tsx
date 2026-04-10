import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalysisList } from "./AnalysisList";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("AnalysisList", () => {
  it("renders analysis items with repo names", () => {
    const analyses = [
      {
        _id: "a-1",
        repoUrl: "https://github.com/owner/repo",
        status: "completed",
        _creationTime: 1700000000000,
      },
      {
        _id: "a-2",
        repoUrl: "https://github.com/org/lib",
        status: "scanning",
        _creationTime: 1700000001000,
      },
    ];
    render(<AnalysisList analyses={analyses} slug="test-prog" />);
    expect(screen.getByText("owner/repo")).toBeInTheDocument();
    expect(screen.getByText("org/lib")).toBeInTheDocument();
  });

  it("shows status badges", () => {
    const analyses = [
      {
        _id: "a-1",
        repoUrl: "https://github.com/o/r",
        status: "completed",
        _creationTime: 1700000000000,
      },
    ];
    render(<AnalysisList analyses={analyses} slug="test-prog" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("links to detail page", () => {
    const analyses = [
      {
        _id: "a-1",
        repoUrl: "https://github.com/o/r",
        status: "pending",
        _creationTime: 1700000000000,
      },
    ];
    render(<AnalysisList analyses={analyses} slug="test-prog" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/test-prog/utilities/code-analyzer/a-1");
  });

  it("shows Unknown repository when no URL", () => {
    const analyses = [{ _id: "a-1", status: "pending", _creationTime: 1700000000000 }];
    render(<AnalysisList analyses={analyses} slug="s" />);
    expect(screen.getByText("Unknown repository")).toBeInTheDocument();
  });
});
