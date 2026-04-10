import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NewIntegrationPage from "./NewIntegrationPage";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_1" } }),
}));

vi.mock("@foundry/ui/programs", () => ({
  useProgramContext: () => ({ programId: "prog_1", slug: "test-program" }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("NewIntegrationPage", () => {
  it("renders the page heading", () => {
    render(<NewIntegrationPage />);
    expect(screen.getByText("Add Integration")).toBeInTheDocument();
  });

  it("renders integration name input", () => {
    render(<NewIntegrationPage />);
    expect(screen.getByPlaceholderText("e.g. Order Sync API")).toBeInTheDocument();
  });

  it("renders source and target system inputs", () => {
    render(<NewIntegrationPage />);
    expect(screen.getByPlaceholderText("e.g. Magento 2")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Salesforce B2B Commerce")).toBeInTheDocument();
  });

  it("renders create button", () => {
    render(<NewIntegrationPage />);
    expect(screen.getByText("Create Integration")).toBeInTheDocument();
  });
});
