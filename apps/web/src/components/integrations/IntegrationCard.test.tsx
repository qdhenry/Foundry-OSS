import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IntegrationCard } from "./IntegrationCard";

const mockIntegration = {
  _id: "int-1",
  name: "Customer Orders API",
  type: "api",
  sourceSystem: "Magento",
  targetSystem: "Salesforce B2B",
  status: "live",
  requirementIds: ["req-1", "req-2"],
};

describe("IntegrationCard", () => {
  it("renders integration name", () => {
    render(
      <table>
        <tbody>
          <IntegrationCard integration={mockIntegration} onClick={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getByText("Customer Orders API")).toBeInTheDocument();
  });

  it("renders type badge", () => {
    render(
      <table>
        <tbody>
          <IntegrationCard integration={mockIntegration} onClick={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getByText("API")).toBeInTheDocument();
  });

  it("renders source and target systems", () => {
    render(
      <table>
        <tbody>
          <IntegrationCard integration={mockIntegration} onClick={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getByText(/Magento/)).toBeInTheDocument();
    expect(screen.getByText(/Salesforce B2B/)).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(
      <table>
        <tbody>
          <IntegrationCard integration={mockIntegration} onClick={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("calls onClick when row is clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <table>
        <tbody>
          <IntegrationCard integration={mockIntegration} onClick={onClick} />
        </tbody>
      </table>,
    );
    await user.click(screen.getByText("Customer Orders API"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders requirement count", () => {
    render(
      <table>
        <tbody>
          <IntegrationCard integration={mockIntegration} onClick={vi.fn()} />
        </tbody>
      </table>,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
