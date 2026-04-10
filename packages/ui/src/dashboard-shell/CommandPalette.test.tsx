import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: () => undefined,
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_123" } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock(
  "@untitledui/icons",
  () =>
    new Proxy(
      {},
      {
        get: (_target, name) => {
          const Stub = (props: any) => <svg data-testid={`icon-${String(name)}`} {...props} />;
          Stub.displayName = String(name);
          return Stub;
        },
      },
    ),
);

describe("CommandPalette", () => {
  it("renders search input", () => {
    render(<CommandPalette onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/search requirements/i)).toBeInTheDocument();
  });

  it("renders Esc key hint", () => {
    render(<CommandPalette onClose={vi.fn()} />);
    expect(screen.getByText("Esc")).toBeInTheDocument();
  });

  it("shows start typing message when query is short", () => {
    render(<CommandPalette onClose={vi.fn()} />);
    expect(screen.getByText("Start typing to search...")).toBeInTheDocument();
  });
});
