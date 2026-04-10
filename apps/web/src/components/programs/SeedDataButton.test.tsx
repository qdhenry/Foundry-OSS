import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeedDataButton } from "./SeedDataButton";

const mockSeedMutation = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockSeedMutation,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { seed: { seedAcmeCorp: "seed:seedAcmeCorp" } },
}));

describe("SeedDataButton", () => {
  beforeEach(() => {
    mockSeedMutation.mockReset();
  });

  it("renders the button with correct label", () => {
    render(<SeedDataButton orgId="org-1" />);
    expect(screen.getByText("Load Demo Data (AcmeCorp)")).toBeInTheDocument();
  });

  it("shows loading state when clicked", async () => {
    mockSeedMutation.mockReturnValue(new Promise(() => {}));
    render(<SeedDataButton orgId="org-1" />);
    fireEvent.click(screen.getByText("Load Demo Data (AcmeCorp)"));
    expect(screen.getByText("Loading demo data...")).toBeInTheDocument();
  });

  it("shows success message after successful seed", async () => {
    mockSeedMutation.mockResolvedValue(undefined);
    render(<SeedDataButton orgId="org-1" />);
    fireEvent.click(screen.getByText("Load Demo Data (AcmeCorp)"));
    await waitFor(() => {
      expect(
        screen.getByText("Demo data loaded successfully. Refresh to see AcmeCorp."),
      ).toBeInTheDocument();
    });
  });

  it("shows error message on failure", async () => {
    mockSeedMutation.mockRejectedValue(new Error("Network error"));
    render(<SeedDataButton orgId="org-1" />);
    fireEvent.click(screen.getByText("Load Demo Data (AcmeCorp)"));
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("handles non-Error rejection", async () => {
    mockSeedMutation.mockRejectedValue("string error");
    render(<SeedDataButton orgId="org-1" />);
    fireEvent.click(screen.getByText("Load Demo Data (AcmeCorp)"));
    await waitFor(() => {
      expect(screen.getByText("Failed to seed data")).toBeInTheDocument();
    });
  });
});
