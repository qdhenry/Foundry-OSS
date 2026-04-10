import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IntegrationsPage from "./IntegrationsPage";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@foundry/ui/programs", () => ({
  useProgramContext: () => ({
    programId: "prog-1",
    slug: "test-program",
  }),
}));

describe("IntegrationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page heading", () => {
    render(<IntegrationsPage />);
    expect(screen.getByText("Integrations")).toBeInTheDocument();
  });

  it("renders loading state when integrations are undefined", () => {
    render(<IntegrationsPage />);
    expect(screen.getByText("Loading integrations...")).toBeInTheDocument();
  });

  it("renders empty state when no integrations", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([]);

    render(<IntegrationsPage />);
    expect(screen.getByText("No integrations yet")).toBeInTheDocument();
    expect(screen.getByText("Add First Integration")).toBeInTheDocument();
  });

  it("renders Add Integration button", () => {
    render(<IntegrationsPage />);
    expect(screen.getByText("Add Integration")).toBeInTheDocument();
  });

  it("renders table with integrations", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        _id: "int-1",
        name: "Order Sync",
        type: "api",
        sourceSystem: "Magento",
        targetSystem: "Salesforce",
        status: "live",
        requirementIds: [],
      },
    ]);

    render(<IntegrationsPage />);
    expect(screen.getByText("Order Sync")).toBeInTheDocument();
    expect(screen.getByText("1 integration")).toBeInTheDocument();
  });
});
