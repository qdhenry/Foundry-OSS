import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntegrationCard } from "./IntegrationCard";

describe("IntegrationCard", () => {
  const defaultIntegration = {
    _id: "int-1",
    name: "Order Sync API",
    type: "api",
    sourceSystem: "Magento",
    targetSystem: "Salesforce",
    status: "live",
    requirementIds: ["req-1", "req-2"],
  };

  it("renders integration name", () => {
    render(
      <table>
        <tbody>
          <IntegrationCard integration={defaultIntegration} onClick={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getByText("Order Sync API")).toBeInTheDocument();
  });

  it("renders type badge", () => {
    render(
      <table>
        <tbody>
          <IntegrationCard integration={defaultIntegration} onClick={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getByText("API")).toBeInTheDocument();
  });

  it("renders source and target systems", () => {
    render(
      <table>
        <tbody>
          <IntegrationCard integration={defaultIntegration} onClick={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getByText("Magento")).toBeInTheDocument();
    expect(screen.getByText("Salesforce")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(
      <table>
        <tbody>
          <IntegrationCard integration={defaultIntegration} onClick={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("renders requirement count", () => {
    render(
      <table>
        <tbody>
          <IntegrationCard integration={defaultIntegration} onClick={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("calls onClick when row clicked", () => {
    const onClick = vi.fn();
    render(
      <table>
        <tbody>
          <IntegrationCard integration={defaultIntegration} onClick={onClick} />
        </tbody>
      </table>,
    );
    fireEvent.click(screen.getByText("Order Sync API"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders 0 for missing requirementIds", () => {
    const integration = { ...defaultIntegration, requirementIds: undefined };
    render(
      <table>
        <tbody>
          <IntegrationCard integration={integration} onClick={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
