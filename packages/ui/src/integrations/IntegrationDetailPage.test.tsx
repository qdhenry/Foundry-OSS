import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import IntegrationDetailPage from "./IntegrationDetailPage";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_1" } }),
}));

vi.mock("@foundry/ui/programs", () => ({
  useProgramContext: () => ({ programId: "prog_1", slug: "test-program" }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ integrationId: "int_1" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("./IntegrationFlowDiagram", () => ({
  IntegrationFlowDiagram: () => <div data-testid="flow-diagram" />,
}));

describe("IntegrationDetailPage", () => {
  it("renders loading state when integration is undefined", () => {
    render(<IntegrationDetailPage />);
    expect(screen.getByText("Loading integration...")).toBeInTheDocument();
  });
});
