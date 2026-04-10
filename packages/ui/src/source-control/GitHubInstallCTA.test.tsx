import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GitHubInstallCTA } from "./GitHubInstallCTA";

let mockInstallState: any = {};

vi.mock("./useGitHubInstallation", () => ({
  useGitHubInstallation: () => mockInstallState,
}));

vi.mock("./icons", () => ({
  GithubIcon: ({ className }: any) => <svg data-testid="github-icon" className={className} />,
}));

describe("GitHubInstallCTA", () => {
  it("returns null when loading", () => {
    mockInstallState = {
      activeInstallation: null,
      isSuspended: false,
      isLoading: true,
      installUrl: undefined,
    };
    const { container } = render(<GitHubInstallCTA purpose="manage repos" />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when already connected", () => {
    mockInstallState = {
      activeInstallation: { installationId: "123" },
      isSuspended: false,
      isLoading: false,
      installUrl: undefined,
    };
    const { container } = render(<GitHubInstallCTA purpose="manage repos" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders suspended warning", () => {
    mockInstallState = {
      activeInstallation: null,
      isSuspended: true,
      isLoading: false,
      installUrl: undefined,
    };
    render(<GitHubInstallCTA purpose="manage repos" />);
    expect(screen.getByText("GitHub App installation is suspended")).toBeInTheDocument();
    expect(screen.getByText(/Re-enable the Foundry GitHub App/)).toBeInTheDocument();
    expect(screen.getByText(/manage repos/)).toBeInTheDocument();
  });

  it("renders install CTA with button when installUrl is set", () => {
    mockInstallState = {
      activeInstallation: null,
      isSuspended: false,
      isLoading: false,
      installUrl: "https://github.com/apps/test/installations/new",
    };
    render(<GitHubInstallCTA purpose="launch sandboxes" />);
    expect(screen.getByText("Connect GitHub to launch sandboxes")).toBeInTheDocument();
    expect(screen.getByText("Install GitHub App")).toBeInTheDocument();
  });

  it("renders env var hint when installUrl is undefined", () => {
    mockInstallState = {
      activeInstallation: null,
      isSuspended: false,
      isLoading: false,
      installUrl: undefined,
    };
    render(<GitHubInstallCTA purpose="connect repos" />);
    expect(screen.getByText("NEXT_PUBLIC_GITHUB_APP_SLUG")).toBeInTheDocument();
  });

  it("includes purpose text in install CTA", () => {
    mockInstallState = {
      activeInstallation: null,
      isSuspended: false,
      isLoading: false,
      installUrl: "https://example.com",
    };
    render(<GitHubInstallCTA purpose="track deployments" />);
    expect(screen.getByText("Connect GitHub to track deployments")).toBeInTheDocument();
  });
});
