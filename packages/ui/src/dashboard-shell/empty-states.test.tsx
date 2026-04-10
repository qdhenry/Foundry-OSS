import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock convex/react — useQuery returns empty arrays to trigger empty states
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/test-program/sprints",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock Clerk
vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_test" } }),
}));

// Mock program context
vi.mock("../programs", () => ({
  useProgramContext: () => ({
    programId: "prog-1",
    slug: "test-program",
    program: { name: "Test Program" },
  }),
}));

vi.mock("@foundry/ui/programs", () => ({
  useProgramContext: () => ({
    programId: "prog-1",
    slug: "test-program",
    program: { name: "Test Program" },
  }),
}));

// Mock animation hooks
vi.mock("../theme/useAnimations", () => ({
  useStaggerEntrance: vi.fn(),
}));

// Mock child components that are not relevant
vi.mock("../sprints/SprintFilters", () => ({
  SprintFilters: () => <div data-testid="sprint-filters" />,
}));

vi.mock("../sprints/SprintCard", () => ({
  SprintCard: () => <div data-testid="sprint-card" />,
}));

vi.mock("../risks/RiskFilters", () => ({
  RiskFilters: () => <div data-testid="risk-filters" />,
}));

vi.mock("../risks/RiskCard", () => ({
  RiskCard: () => <div data-testid="risk-card" />,
}));

vi.mock("../risks/RiskAssessmentPanel", () => ({
  RiskAssessmentPanel: () => <div data-testid="risk-assessment" />,
}));

vi.mock("../skills/SkillTemplateModal", () => ({
  SkillTemplateModal: () => null,
}));

describe("Empty States", () => {
  describe("ProgramSprintsRoute", () => {
    it("shows 'No sprints yet' with workstreams CTA when no workstreams", async () => {
      mockUseQuery.mockImplementation((queryName: string) => {
        if (queryName === "sprints:listByProgram") return [];
        if (queryName === "workstreams:listByProgram") return [];
        return undefined;
      });

      const { ProgramSprintsRoute } = await import("../sprints/ProgramSprintsRoute");
      render(<ProgramSprintsRoute />);

      expect(screen.getByText("No sprints yet")).toBeInTheDocument();
      expect(screen.getByText("Set up workstreams first")).toBeInTheDocument();
    });
  });

  describe("WorkstreamsPage", () => {
    it("shows 'No workstreams yet' with requirements CTA", async () => {
      mockUseQuery.mockReturnValue([]);

      const { WorkstreamsPage } = await import("../workstreams/WorkstreamsPage");
      render(<WorkstreamsPage programId="prog-1" programSlug="test-program" />);

      expect(screen.getByText("No workstreams yet")).toBeInTheDocument();
      expect(screen.getByText("Create requirements first")).toBeInTheDocument();
    });
  });

  describe("SkillsPage", () => {
    it("shows 'No skills yet'", async () => {
      mockUseQuery.mockReturnValue([]);

      const mod = await import("../skills/SkillsPage");
      const SkillsPage = mod.default;
      render(<SkillsPage />);

      expect(screen.getByText("No skills yet")).toBeInTheDocument();
    });
  });

  describe("ProgramRisksRoute", () => {
    it("shows 'No risks yet'", async () => {
      mockUseQuery.mockReturnValue([]);

      const { ProgramRisksRoute } = await import("../risks/ProgramRisksRoute");
      render(<ProgramRisksRoute />);

      expect(screen.getByText("No risks yet")).toBeInTheDocument();
    });
  });
});
