import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryPage } from "./DiscoveryPage";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_1" } }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({
    program: { name: "Test" },
    programId: "prog_1",
    slug: "test-program",
  }),
}));

vi.mock("./CreateRequirementForm", () => ({
  CreateRequirementForm: () => null,
}));

vi.mock("./DiscoveryDocumentZone", () => ({
  DiscoveryDocumentZone: () => <div data-testid="document-zone" />,
}));

vi.mock("./DiscoveryEmptyState", () => ({
  DiscoveryEmptyState: () => null,
}));

vi.mock("./DiscoveryFindingsReview", () => ({
  DiscoveryFindingsReview: () => null,
}));

vi.mock("./DiscoveryNextStepCard", () => ({
  DiscoveryNextStepCard: () => null,
}));

vi.mock("./DiscoveryStats", () => ({
  DiscoveryStats: () => <div data-testid="discovery-stats" />,
}));

vi.mock("./DiscoveryTabBar", () => ({
  DiscoveryTabBar: ({ activeTab }: any) => <div data-testid="tab-bar">{activeTab}</div>,
}));

vi.mock("./DiscoveryWorkflowBanner", () => ({
  DiscoveryWorkflowBanner: () => null,
}));

vi.mock("./RecentlyImportedTable", () => ({
  RecentlyImportedTable: () => null,
}));

vi.mock("../videos/VideosPage", () => ({
  VideosPage: () => null,
}));

describe("DiscoveryPage", () => {
  it("renders the tab bar defaulting to documents", () => {
    render(<DiscoveryPage />);
    expect(screen.getByTestId("tab-bar")).toHaveTextContent("documents");
  });

  it("renders document zone on documents tab", () => {
    render(<DiscoveryPage />);
    expect(screen.getByTestId("document-zone")).toBeInTheDocument();
  });
});
