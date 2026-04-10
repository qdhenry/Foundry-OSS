import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DirectoryPicker } from "./DirectoryPicker";

describe("DirectoryPicker", () => {
  it("renders directory scope label", () => {
    render(
      <DirectoryPicker
        repoId="r-1"
        owner="acme"
        repo="app"
        branch="main"
        onSelect={vi.fn()}
        selectedPath=""
      />,
    );
    expect(screen.getByText("Directory scope")).toBeInTheDocument();
  });

  it("renders text input with placeholder", () => {
    render(
      <DirectoryPicker
        repoId="r-1"
        owner="acme"
        repo="app"
        branch="main"
        onSelect={vi.fn()}
        selectedPath=""
      />,
    );
    expect(
      screen.getByPlaceholderText("e.g., src/features/checkout (leave empty for entire repo)"),
    ).toBeInTheDocument();
  });

  it("displays selected path", () => {
    render(
      <DirectoryPicker
        repoId="r-1"
        owner="acme"
        repo="app"
        branch="main"
        onSelect={vi.fn()}
        selectedPath="src/lib"
      />,
    );
    expect(screen.getByDisplayValue("src/lib")).toBeInTheDocument();
  });

  it("calls onSelect when typing", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <DirectoryPicker
        repoId="r-1"
        owner="acme"
        repo="app"
        branch="main"
        onSelect={onSelect}
        selectedPath=""
      />,
    );
    await user.type(
      screen.getByPlaceholderText("e.g., src/features/checkout (leave empty for entire repo)"),
      "s",
    );
    expect(onSelect).toHaveBeenCalled();
  });
});
