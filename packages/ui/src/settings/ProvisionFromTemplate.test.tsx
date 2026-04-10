import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProvisionFromTemplate } from "./ProvisionFromTemplate";

vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
}));

const defaultProps = {
  programId: "prog_1",
  clientName: "Acme Corp",
  installationId: "inst_1",
  owner: "test-org",
  templateRepoFullName: "foundry/sf-b2b-template",
};

describe("ProvisionFromTemplate", () => {
  it("renders heading", () => {
    render(<ProvisionFromTemplate {...defaultProps} />);
    expect(screen.getByText("Create Repository from Template")).toBeInTheDocument();
  });

  it("auto-suggests repository name from client name", () => {
    render(<ProvisionFromTemplate {...defaultProps} />);
    const repoInput = screen.getByLabelText("Repository Name") as HTMLInputElement;
    expect(repoInput.value).toBe("acme-corp-sf-b2b");
  });

  it("auto-suggests project prefix from client name", () => {
    render(<ProvisionFromTemplate {...defaultProps} />);
    const prefixInput = screen.getByLabelText("Project Prefix (PascalCase)") as HTMLInputElement;
    expect(prefixInput.value).toBe("AcmeCorp");
  });

  it("renders ERP system selector", () => {
    render(<ProvisionFromTemplate {...defaultProps} />);
    expect(screen.getByLabelText("ERP System")).toBeInTheDocument();
  });

  it("renders Create Repository button", () => {
    render(<ProvisionFromTemplate {...defaultProps} />);
    expect(screen.getByText("Create Repository")).toBeInTheDocument();
  });

  it("renders skip button when onSkip provided", () => {
    render(<ProvisionFromTemplate {...defaultProps} onSkip={vi.fn()} />);
    expect(screen.getByText(/Skip/)).toBeInTheDocument();
  });

  it("hides skip button when onSkip not provided", () => {
    render(<ProvisionFromTemplate {...defaultProps} />);
    expect(screen.queryByText(/Skip/)).not.toBeInTheDocument();
  });
});
