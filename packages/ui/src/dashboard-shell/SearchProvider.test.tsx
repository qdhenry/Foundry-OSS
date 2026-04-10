import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchProvider, useSearch } from "./SearchProvider";

vi.mock("./CommandPalette", () => ({
  CommandPalette: ({ onClose }: any) => (
    <div data-testid="command-palette">
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

function SearchConsumer() {
  const { isOpen, openSearch, closeSearch } = useSearch();
  return (
    <div>
      <span data-testid="open-state">{String(isOpen)}</span>
      <button type="button" onClick={openSearch}>
        Open
      </button>
      <button type="button" onClick={closeSearch}>
        CloseBtn
      </button>
    </div>
  );
}

describe("SearchProvider", () => {
  it("renders children", () => {
    render(
      <SearchProvider>
        <div>Content</div>
      </SearchProvider>,
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("starts with search closed", () => {
    render(
      <SearchProvider>
        <SearchConsumer />
      </SearchProvider>,
    );
    expect(screen.getByTestId("open-state")).toHaveTextContent("false");
  });

  it("throws when useSearch used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<SearchConsumer />)).toThrow(
      "useSearch must be used within SearchProvider",
    );
    spy.mockRestore();
  });
});
