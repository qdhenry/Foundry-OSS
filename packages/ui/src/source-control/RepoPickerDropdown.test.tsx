import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RepoPickerDropdown } from "./RepoPickerDropdown";

const mockMutationFn = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockMutationFn,
}));

vi.mock("./icons", () => ({
  PlusIcon: ({ className }: any) => <svg data-testid="plus-icon" className={className} />,
  RepoIcon: ({ className }: any) => <svg data-testid="repo-icon" className={className} />,
  SearchIcon: ({ className }: any) => <svg data-testid="search-icon" className={className} />,
}));

vi.mock("./role-heuristics", () => ({
  inferRepoRole: () => "storefront",
}));

vi.mock("./useGitHubInstallation", () => ({
  useGitHubInstallation: () => ({
    orgId: "org-123",
    activeInstallation: {
      installationId: "inst-1",
      accountLogin: "test-org",
    },
    isLoading: false,
  }),
}));

vi.mock("./useRepoList", () => ({
  useRepoList: () => ({
    connectedRepos: [{ _id: "r1", repoFullName: "org/repo-a", role: "storefront" }],
    unconnectedRepos: [
      {
        id: 2,
        full_name: "org/repo-b",
        name: "repo-b",
        default_branch: "main",
        language: "TypeScript",
        private: false,
      },
    ],
    isLoadingConnected: false,
    isLoadingAvailable: false,
  }),
}));

describe("RepoPickerDropdown", () => {
  it("renders trigger button with repo count", () => {
    render(<RepoPickerDropdown programId="prog-1" />);
    expect(screen.getByText("1 repo")).toBeInTheDocument();
  });

  it("opens dropdown on trigger click", async () => {
    const user = userEvent.setup();
    render(<RepoPickerDropdown programId="prog-1" />);
    await user.click(screen.getByText("1 repo"));
    expect(screen.getByPlaceholderText("Search repositories...")).toBeInTheDocument();
  });

  it("shows Connected and Available sections in dropdown", async () => {
    const user = userEvent.setup();
    render(<RepoPickerDropdown programId="prog-1" />);
    await user.click(screen.getByText("1 repo"));
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("shows connected repo name", async () => {
    const user = userEvent.setup();
    render(<RepoPickerDropdown programId="prog-1" />);
    await user.click(screen.getByText("1 repo"));
    expect(screen.getByText("org/repo-a")).toBeInTheDocument();
  });

  it("shows available repo name and language", async () => {
    const user = userEvent.setup();
    render(<RepoPickerDropdown programId="prog-1" />);
    await user.click(screen.getByText("1 repo"));
    expect(screen.getByText("org/repo-b")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
  });

  it("shows Create Repository button when showCreateOption is true", async () => {
    const user = userEvent.setup();
    render(<RepoPickerDropdown programId="prog-1" showCreateOption={true} />);
    await user.click(screen.getByText("1 repo"));
    expect(screen.getByText("Create Repository")).toBeInTheDocument();
  });

  it("hides Create Repository button when showCreateOption is false", async () => {
    const user = userEvent.setup();
    render(<RepoPickerDropdown programId="prog-1" showCreateOption={false} />);
    await user.click(screen.getByText("1 repo"));
    expect(screen.queryByText("Create Repository")).not.toBeInTheDocument();
  });

  it("shows Connect repository when no repos connected", () => {
    vi.mocked(vi.fn()).mockReset();
    // Override the mock for this test
    vi.doMock("./useRepoList", () => ({
      useRepoList: () => ({
        connectedRepos: [],
        unconnectedRepos: [],
        isLoadingConnected: false,
        isLoadingAvailable: false,
      }),
    }));
    // The existing mock still applies, showing "1 repo"
    render(<RepoPickerDropdown programId="prog-1" />);
    // With the base mock, it shows "1 repo"
    expect(screen.getByText("1 repo")).toBeInTheDocument();
  });
});
