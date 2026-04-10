import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ slug: "test-slug" }),
}));

vi.mock("./ProgramDiscoveryRoute", () => ({
  ProgramDiscoveryRoute: () => <div data-testid="discovery-route">Discovery</div>,
}));

import { ProgramDocumentsRoute } from "./ProgramDocumentsRoute";

describe("ProgramDocumentsRoute", () => {
  it("renders ProgramDiscoveryRoute and triggers redirect", () => {
    render(<ProgramDocumentsRoute />);
    expect(screen.getByTestId("discovery-route")).toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith("/test-slug/discovery?section=documents");
  });
});
