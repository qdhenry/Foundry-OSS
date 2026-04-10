import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NodeDetailPanel } from "./NodeDetailPanel";

describe("NodeDetailPanel", () => {
  it("renders node name", () => {
    render(
      <NodeDetailPanel
        node={{ name: "UserService", type: "class", layer: "service" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("UserService")).toBeInTheDocument();
  });

  it("shows type and layer badges", () => {
    render(
      <NodeDetailPanel
        node={{ name: "handleAuth", type: "function", layer: "api" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("function")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
  });

  it("shows language and file path", () => {
    render(
      <NodeDetailPanel
        node={{ name: "schema", language: "TypeScript", filePath: "convex/schema.ts" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("convex/schema.ts")).toBeInTheDocument();
  });

  it("shows description", () => {
    render(
      <NodeDetailPanel
        node={{ name: "test", description: "Handles user auth" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Handles user auth")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NodeDetailPanel node={{ name: "x" }} onClose={onClose} />);
    await user.click(screen.getByRole("button"));
    expect(onClose).toHaveBeenCalled();
  });
});
