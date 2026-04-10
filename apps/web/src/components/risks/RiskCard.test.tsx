import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RiskCard } from "./RiskCard";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const baseRisk = {
  _id: "risk-1",
  title: "Data Migration Failure",
  description: "Potential data loss during Magento to Salesforce migration",
  severity: "high" as const,
  probability: "likely" as const,
  status: "open" as const,
  ownerName: "Alice",
  resolvedWorkstreams: [{ _id: "ws-1", name: "Commerce", shortCode: "COM" }],
};

describe("RiskCard", () => {
  it("renders risk title", () => {
    render(<RiskCard risk={baseRisk} programId="prog-1" />);
    expect(screen.getByText("Data Migration Failure")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<RiskCard risk={baseRisk} programId="prog-1" />);
    expect(screen.getByText(/data loss during Magento/)).toBeInTheDocument();
  });

  it("renders severity and probability badges", () => {
    render(<RiskCard risk={baseRisk} programId="prog-1" />);
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Likely")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<RiskCard risk={baseRisk} programId="prog-1" />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders workstream tags", () => {
    render(<RiskCard risk={baseRisk} programId="prog-1" />);
    expect(screen.getByText("COM")).toBeInTheDocument();
  });

  it("renders owner name", () => {
    render(<RiskCard risk={baseRisk} programId="prog-1" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("navigates to risk detail on click", async () => {
    const user = userEvent.setup();
    render(<RiskCard risk={baseRisk} programId="prog-1" />);
    await user.click(screen.getByText("Data Migration Failure"));
    expect(mockPush).toHaveBeenCalledWith("/prog-1/risks/risk-1");
  });

  it("hides description when not provided", () => {
    const risk = { ...baseRisk, description: undefined };
    render(<RiskCard risk={risk} programId="prog-1" />);
    expect(screen.queryByText(/data loss/)).toBeNull();
  });

  it("hides owner when not provided", () => {
    const risk = { ...baseRisk, ownerName: undefined };
    render(<RiskCard risk={risk} programId="prog-1" />);
    expect(screen.queryByText("Alice")).toBeNull();
  });
});
