import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchProvider, useSearch } from "./SearchProvider";

vi.mock("./CommandPalette", () => ({
  CommandPalette: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="command-palette">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

function TestConsumer() {
  const { isOpen, openSearch, closeSearch } = useSearch();
  return (
    <div>
      <span data-testid="is-open">{isOpen ? "open" : "closed"}</span>
      <button onClick={openSearch}>Open</button>
      <button onClick={closeSearch}>Close Search</button>
    </div>
  );
}

describe("SearchProvider", () => {
  it("provides isOpen as false initially", () => {
    render(
      <SearchProvider>
        <TestConsumer />
      </SearchProvider>,
    );
    expect(screen.getByTestId("is-open").textContent).toBe("closed");
  });

  it("opens search when openSearch is called", async () => {
    render(
      <SearchProvider>
        <TestConsumer />
      </SearchProvider>,
    );
    await act(async () => {
      screen.getByText("Open").click();
    });
    expect(screen.getByTestId("is-open").textContent).toBe("open");
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();
  });

  it("closes search when closeSearch is called", async () => {
    render(
      <SearchProvider>
        <TestConsumer />
      </SearchProvider>,
    );
    await act(async () => {
      screen.getByText("Open").click();
    });
    expect(screen.getByTestId("is-open").textContent).toBe("open");
    await act(async () => {
      screen.getByText("Close Search").click();
    });
    expect(screen.getByTestId("is-open").textContent).toBe("closed");
  });

  it("throws when useSearch is used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow("useSearch must be used within SearchProvider");
    consoleError.mockRestore();
  });
});
