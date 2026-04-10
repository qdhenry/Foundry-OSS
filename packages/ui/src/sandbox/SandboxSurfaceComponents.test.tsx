import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  SandboxSurfaceComponentsProvider,
  useSandboxSurfaceComponents,
} from "./SandboxSurfaceComponents";

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}));

function TestConsumer() {
  const { TaskAuditTrail, ConfirmModal } = useSandboxSurfaceComponents();
  return (
    <div>
      <TaskAuditTrail taskId="t1" />
      <ConfirmModal
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Confirm?"
        description="Are you sure?"
      />
    </div>
  );
}

describe("SandboxSurfaceComponents", () => {
  it("provides default TaskAuditTrail", () => {
    render(<TestConsumer />);
    expect(screen.getByText("Audit Trail")).toBeInTheDocument();
  });

  it("provides default ConfirmModal", () => {
    render(<TestConsumer />);
    expect(screen.getByText("Confirm?")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("accepts custom components via provider", () => {
    const Custom = () => <div>Custom Component</div>;
    render(
      <SandboxSurfaceComponentsProvider components={{ TaskAuditTrail: Custom }}>
        <TestConsumer />
      </SandboxSurfaceComponentsProvider>,
    );
    expect(screen.getByText("Custom Component")).toBeInTheDocument();
  });
});
