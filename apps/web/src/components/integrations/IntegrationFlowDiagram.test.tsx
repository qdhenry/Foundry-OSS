import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntegrationFlowDiagram } from "./IntegrationFlowDiagram";

describe("IntegrationFlowDiagram", () => {
  it("renders source and target system names", () => {
    render(
      <IntegrationFlowDiagram sourceSystem="Magento" targetSystem="Salesforce B2B" type="api" />,
    );
    expect(screen.getByText("Magento")).toBeInTheDocument();
    expect(screen.getByText("Salesforce B2B")).toBeInTheDocument();
  });

  it("renders integration type label", () => {
    render(
      <IntegrationFlowDiagram sourceSystem="Magento" targetSystem="Salesforce" type="webhook" />,
    );
    expect(screen.getByText("Webhook")).toBeInTheDocument();
  });

  it("renders file transfer type", () => {
    render(
      <IntegrationFlowDiagram sourceSystem="ERP" targetSystem="Data Lake" type="file_transfer" />,
    );
    expect(screen.getByText("File Transfer")).toBeInTheDocument();
  });

  it("renders with database type", () => {
    render(<IntegrationFlowDiagram sourceSystem="MySQL" targetSystem="Postgres" type="database" />);
    expect(screen.getByText("Database")).toBeInTheDocument();
    expect(screen.getByText("MySQL")).toBeInTheDocument();
    expect(screen.getByText("Postgres")).toBeInTheDocument();
  });
});
