import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

const mockOpenSearch = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/search/SearchProvider", () => ({
  useSearch: () => ({ openSearch: mockOpenSearch }),
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_test" } }),
  useUser: () => ({
    user: {
      id: "user_test",
      fullName: "Test User",
      primaryEmailAddress: { emailAddress: "test@example.com" },
    },
  }),
  useClerk: () => ({ signOut: vi.fn() }),
}));

vi.mock("@untitledui/icons", () => ({
  SearchMd: (props: any) => <span data-testid="search-icon" {...props} />,
  ChevronRight: (props: any) => <span data-testid="chevron" {...props} />,
  Home01: (props: any) => <span data-testid="home-icon" {...props} />,
  Sun: () => <span data-testid="sun-icon" />,
  Moon01: () => <span data-testid="moon-icon" />,
}));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

describe("Header", () => {
  it("renders breadcrumbs area", () => {
    render(<Header />);
    expect(screen.getByLabelText("Breadcrumb")).toBeInTheDocument();
  });

  it("renders search button with placeholder text", () => {
    render(<Header />);
    expect(screen.getByText("Search...")).toBeInTheDocument();
  });

  it("renders keyboard shortcut hint", () => {
    render(<Header />);
    expect(screen.getByText("Cmd+K")).toBeInTheDocument();
  });

  it("opens search on search button click", async () => {
    const user = userEvent.setup();
    render(<Header />);
    const searchButton = screen.getByText("Search...").closest("button")!;
    await user.click(searchButton);
    expect(mockOpenSearch).toHaveBeenCalledOnce();
  });

  it("renders UserButton", () => {
    render(<Header />);
    expect(screen.getByTestId("user-button")).toBeInTheDocument();
  });

  it("renders theme toggle", () => {
    render(<Header />);
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument();
  });
});
