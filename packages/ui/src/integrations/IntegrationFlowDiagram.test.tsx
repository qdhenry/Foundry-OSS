import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntegrationFlowDiagram } from "./IntegrationFlowDiagram";

describe("IntegrationFlowDiagram", () => {
  it("renders source system name", () => {
    render(<IntegrationFlowDiagram sourceSystem="Magento" targetSystem="Salesforce" type="api" />);
    expect(screen.getByText("Magento")).toBeInTheDocument();
  });

  it("renders target system name", () => {
    render(<IntegrationFlowDiagram sourceSystem="Magento" targetSystem="Salesforce" type="api" />);
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
  });

  it("renders type label for API", () => {
    render(<IntegrationFlowDiagram sourceSystem="Magento" targetSystem="Salesforce" type="api" />);
    expect(screen.getByText("API")).toBeInTheDocument();
  });

  it("renders type label for webhook", () => {
    render(<IntegrationFlowDiagram sourceSystem="A" targetSystem="B" type="webhook" />);
    expect(screen.getByText("Webhook")).toBeInTheDocument();
  });

  it("renders source and target labels", () => {
    render(<IntegrationFlowDiagram sourceSystem="A" targetSystem="B" type="api" />);
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Target")).toBeInTheDocument();
  });

  it("falls back to raw type for unknown types", () => {
    render(<IntegrationFlowDiagram sourceSystem="A" targetSystem="B" type="custom_type" />);
    expect(screen.getByText("custom_type")).toBeInTheDocument();
  });
});
