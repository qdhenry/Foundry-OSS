import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserMenu } from "./UserMenu";

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: {
      fullName: "John Doe",
      primaryEmailAddress: { emailAddress: "john@example.com" },
    },
  }),
  useClerk: () => ({
    signOut: vi.fn(),
  }),
}));

vi.mock(
  "@untitledui/icons",
  () =>
    new Proxy(
      {},
      {
        get: (_, name) => (props: any) => <span data-testid={`icon-${String(name)}`} {...props} />,
      },
    ),
);

describe("UserMenu", () => {
  it("renders user menu button", () => {
    render(<UserMenu />);
    expect(screen.getByLabelText("User account menu")).toBeInTheDocument();
  });

  it("does not show dropdown by default", () => {
    render(<UserMenu />);
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  it("shows dropdown when clicked", () => {
    render(<UserMenu />);
    fireEvent.click(screen.getByLabelText("User account menu"));
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("shows sign out button in dropdown", () => {
    render(<UserMenu />);
    fireEvent.click(screen.getByLabelText("User account menu"));
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("closes dropdown on second click", () => {
    render(<UserMenu />);
    const button = screen.getByLabelText("User account menu");
    fireEvent.click(button);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  it("closes dropdown on Escape key", () => {
    render(<UserMenu />);
    fireEvent.click(screen.getByLabelText("User account menu"));
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });
});
