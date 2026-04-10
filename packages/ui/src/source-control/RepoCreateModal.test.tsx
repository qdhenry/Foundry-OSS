import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RepoCreateModal } from "./RepoCreateModal";

const mockActionFn = vi.fn().mockResolvedValue([]);

vi.mock("convex/react", () => ({
  useAction: () => mockActionFn,
}));

vi.mock("./useGitHubInstallation", () => ({
  useGitHubInstallation: () => ({
    orgId: "org-123",
    activeInstallation: {
      installationId: "inst-1",
      accountLogin: "test-org",
    },
  }),
}));

describe("RepoCreateModal", () => {
  it("returns null when not open", () => {
    const { container } = render(
      <RepoCreateModal programId="prog-1" isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders Create Repository heading when open", () => {
    render(<RepoCreateModal programId="prog-1" isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Create Repository" })).toBeInTheDocument();
  });

  it("renders repository name input", () => {
    render(<RepoCreateModal programId="prog-1" isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Repository Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("my-repo-name")).toBeInTheDocument();
  });

  it("renders visibility toggle with Private and Public", () => {
    render(<RepoCreateModal programId="prog-1" isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
  });

  it("renders template selector", async () => {
    render(<RepoCreateModal programId="prog-1" isOpen={true} onClose={vi.fn()} />);
    expect(await screen.findByLabelText("Template")).toBeInTheDocument();
  });

  it("renders Cancel and Create Repository buttons", () => {
    render(<RepoCreateModal programId="prog-1" isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    const createBtn = screen.getByRole("button", { name: "Create Repository" });
    expect(createBtn).toBeInTheDocument();
  });

  it("disables Create Repository button when name is empty", () => {
    render(<RepoCreateModal programId="prog-1" isOpen={true} onClose={vi.fn()} />);
    const createBtn = screen.getByRole("button", { name: "Create Repository" });
    expect(createBtn).toBeDisabled();
  });

  it("calls onClose when Cancel clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RepoCreateModal programId="prog-1" isOpen={true} onClose={onClose} />);
    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when close button (X) clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RepoCreateModal programId="prog-1" isOpen={true} onClose={onClose} />);
    const closeBtn = screen.getByRole("button", { name: "Close" });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders platform templates in select", async () => {
    render(<RepoCreateModal programId="prog-1" isOpen={true} onClose={vi.fn()} />);
    const select = await screen.findByLabelText("Template");
    expect(select).toBeInTheDocument();
    // "None" is one of the options
    const options = select.querySelectorAll("option");
    expect(options.length).toBeGreaterThanOrEqual(1);
  });
});
