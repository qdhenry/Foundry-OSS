import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GithubIcon, PlusIcon, RepoIcon, SearchIcon } from "./icons";

describe("Source Control Icons", () => {
  it("renders GithubIcon", () => {
    const { container } = render(<GithubIcon className="h-4 w-4" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders RepoIcon", () => {
    const { container } = render(<RepoIcon className="h-4 w-4" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders SearchIcon", () => {
    const { container } = render(<SearchIcon className="h-4 w-4" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders PlusIcon", () => {
    const { container } = render(<PlusIcon className="h-4 w-4" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("applies className prop to SVG element", () => {
    const { container } = render(<GithubIcon className="test-class" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("test-class");
  });
});
