import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VersionDiff } from "./VersionDiff";

let queryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: () => queryReturn,
}));

describe("VersionDiff", () => {
  it("shows loading when comparison is undefined", () => {
    queryReturn = undefined;
    render(<VersionDiff versionAId="v1" versionBId="v2" onClose={vi.fn()} />);
    expect(screen.getByText("Loading comparison...")).toBeInTheDocument();
  });

  it("renders version labels", () => {
    queryReturn = {
      versionA: { version: "v1.0", content: "line one" },
      versionB: { version: "v2.0", content: "line one" },
    };
    render(<VersionDiff versionAId="v1" versionBId="v2" onClose={vi.fn()} />);
    expect(screen.getByText("v1.0")).toBeInTheDocument();
    expect(screen.getByText("v2.0")).toBeInTheDocument();
  });

  it("renders heading", () => {
    queryReturn = {
      versionA: { version: "v1.0", content: "hello" },
      versionB: { version: "v2.0", content: "hello" },
    };
    render(<VersionDiff versionAId="v1" versionBId="v2" onClose={vi.fn()} />);
    expect(screen.getByText("Version Diff")).toBeInTheDocument();
  });

  it("shows added and removed counts", () => {
    queryReturn = {
      versionA: { version: "v1.0", content: "old line" },
      versionB: { version: "v2.0", content: "new line" },
    };
    render(<VersionDiff versionAId="v1" versionBId="v2" onClose={vi.fn()} />);
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("-1")).toBeInTheDocument();
  });

  it("renders diff content lines", () => {
    queryReturn = {
      versionA: { version: "v1.0", content: "same\nremoved" },
      versionB: { version: "v2.0", content: "same\nadded" },
    };
    render(<VersionDiff versionAId="v1" versionBId="v2" onClose={vi.fn()} />);
    expect(screen.getByText("same")).toBeInTheDocument();
    expect(screen.getByText("removed")).toBeInTheDocument();
    expect(screen.getByText("added")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    queryReturn = {
      versionA: { version: "v1.0", content: "a" },
      versionB: { version: "v2.0", content: "a" },
    };
    const onClose = vi.fn();
    render(<VersionDiff versionAId="v1" versionBId="v2" onClose={onClose} />);
    // Close button is the only button in the component
    const buttons = screen.getAllByRole("button");
    buttons[0].click();
    expect(onClose).toHaveBeenCalled();
  });
});
