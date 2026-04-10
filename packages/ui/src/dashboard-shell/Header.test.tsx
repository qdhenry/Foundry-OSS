import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

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

const mockOpenSearch = vi.fn();

vi.mock("./SearchProvider", () => ({
  useSearch: () => ({ openSearch: mockOpenSearch }),
}));

vi.mock("./Breadcrumbs", () => ({
  Breadcrumbs: () => <nav data-testid="breadcrumbs" />,
}));

vi.mock("./NotificationBell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock("./ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock("./UserMenu", () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

vi.mock("../resilience-ui/status-bar/GlobalStatusBar", () => ({
  GlobalStatusBar: () => <div data-testid="status-bar" />,
}));

describe("Header", () => {
  it("renders breadcrumbs", () => {
    render(<Header />);
    expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
  });

  it("renders search button with Cmd+K", () => {
    render(<Header />);
    expect(screen.getByText("Search...")).toBeInTheDocument();
    expect(screen.getByText("Cmd+K")).toBeInTheDocument();
  });

  it("renders notification bell", () => {
    render(<Header />);
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });

  it("renders theme toggle", () => {
    render(<Header />);
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("renders user menu", () => {
    render(<Header />);
    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
  });

  it("calls openSearch on search button click", async () => {
    render(<Header />);
    await userEvent.click(screen.getByText("Search..."));
    expect(mockOpenSearch).toHaveBeenCalledOnce();
  });

  it("renders menu button when showMenuButton is true", () => {
    render(<Header showMenuButton onMenuClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Open navigation menu" })).toBeInTheDocument();
  });

  it("hides menu button by default", () => {
    render(<Header />);
    expect(screen.queryByRole("button", { name: "Open navigation menu" })).not.toBeInTheDocument();
  });
});
