import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkstreamDetailPage } from "./WorkstreamDetailPage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ programId: "prog-1", slug: "test-prog" }),
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org-1" } }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => null,
  useMutation: () => vi.fn(),
  useConvexAuth: () => ({ isAuthenticated: true }),
  useAction: () => vi.fn(),
}));

vi.mock("../source-control", () => ({
  GitHubInstallCTA: () => <div>GitHubInstallCTA</div>,
  RepoPickerDropdown: () => <div>RepoPickerDropdown</div>,
}));

vi.mock("../codebase-analysis/ImplementationBadge", () => ({
  ImplementationBadge: () => null,
}));

vi.mock("../codebase-analysis/WorkstreamAnalysisTab", () => ({
  WorkstreamAnalysisTab: () => <div>WorkstreamAnalysisTab</div>,
}));

vi.mock("./CreateRequirementForm", () => ({
  CreateRequirementForm: () => <div>CreateRequirementForm</div>,
}));

vi.mock("./pipeline/WorkstreamPipelineTab", () => ({
  WorkstreamPipelineTab: () => <div>WorkstreamPipelineTab</div>,
}));

describe("WorkstreamDetailPage", () => {
  it("renders not found when workstream is null", () => {
    render(<WorkstreamDetailPage workstreamId="ws-1" />);
    expect(screen.getByText("Workstream not found")).toBeInTheDocument();
  });

  it("renders go back button on not found", () => {
    render(<WorkstreamDetailPage workstreamId="ws-1" />);
    expect(screen.getByText("Go back")).toBeInTheDocument();
  });
});
