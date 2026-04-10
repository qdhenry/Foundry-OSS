import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProvisionFromTemplate } from "./ProvisionFromTemplate";

const mockActionFn = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => mockActionFn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sourceControl: {
      provisioning: {
        provisionFromTemplate: "sourceControl.provisioning:provisionFromTemplate",
      },
    },
  },
}));

const baseProps = {
  programId: "prog-1" as any,
  clientName: "Acme Corp",
  installationId: "inst-1",
  owner: "org",
  templateRepoFullName: "org/template-repo",
};

describe("ProvisionFromTemplate", () => {
  it("renders form with heading", () => {
    render(<ProvisionFromTemplate {...baseProps} />);
    expect(screen.getByText("Create Repository from Template")).toBeInTheDocument();
  });

  it("auto-suggests repo name from client name", () => {
    render(<ProvisionFromTemplate {...baseProps} />);
    const repoNameInput = screen.getByLabelText("Repository Name") as HTMLInputElement;
    expect(repoNameInput.value).toBe("acme-corp-sf-b2b");
  });

  it("auto-suggests project prefix from client name", () => {
    render(<ProvisionFromTemplate {...baseProps} />);
    const prefixInput = screen.getByLabelText("Project Prefix (PascalCase)") as HTMLInputElement;
    expect(prefixInput.value).toBe("AcmeCorp");
  });

  it("renders integration select fields", () => {
    render(<ProvisionFromTemplate {...baseProps} />);
    expect(screen.getByLabelText("ERP System")).toBeInTheDocument();
    expect(screen.getByLabelText("CPQ System")).toBeInTheDocument();
    expect(screen.getByLabelText("Tax System")).toBeInTheDocument();
    expect(screen.getByLabelText("Payment Gateway")).toBeInTheDocument();
  });

  it("renders private repo checkbox checked by default", () => {
    render(<ProvisionFromTemplate {...baseProps} />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("shows skip button when onSkip provided", () => {
    const onSkip = vi.fn();
    render(<ProvisionFromTemplate {...baseProps} onSkip={onSkip} />);
    expect(screen.getByText(/Skip/)).toBeInTheDocument();
  });

  it("does not show skip button when onSkip not provided", () => {
    render(<ProvisionFromTemplate {...baseProps} />);
    expect(screen.queryByText(/Skip/)).not.toBeInTheDocument();
  });

  it("calls provision action on Create Repository click", async () => {
    mockActionFn.mockResolvedValue({
      repoUrl: "https://github.com/org/acme-corp-sf-b2b",
      repoFullName: "org/acme-corp-sf-b2b",
    });
    const user = userEvent.setup();
    render(<ProvisionFromTemplate {...baseProps} />);
    await user.click(screen.getByText("Create Repository"));
    expect(mockActionFn).toHaveBeenCalled();
  });

  it("shows success state after provisioning", async () => {
    mockActionFn.mockResolvedValue({
      repoUrl: "https://github.com/org/acme-corp-sf-b2b",
      repoFullName: "org/acme-corp-sf-b2b",
    });
    const user = userEvent.setup();
    render(<ProvisionFromTemplate {...baseProps} />);
    await user.click(screen.getByText("Create Repository"));
    expect(await screen.findByText("Repository Created")).toBeInTheDocument();
    expect(screen.getByText("Open on GitHub")).toBeInTheDocument();
  });

  it("disables Create button when repo name is empty", async () => {
    const user = userEvent.setup();
    render(<ProvisionFromTemplate {...baseProps} />);
    const repoNameInput = screen.getByLabelText("Repository Name");
    await user.clear(repoNameInput);
    const createBtn = screen.getByText("Create Repository");
    expect(createBtn).toBeDisabled();
  });
});
