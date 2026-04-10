import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SandboxStatusBadge } from "./SandboxStatusBadge";

describe("SandboxStatusBadge", () => {
  it("renders a known status label", () => {
    render(<SandboxStatusBadge status="provisioning" />);

    expect(screen.getByText("Provisioning")).toBeInTheDocument();
  });

  it("renders a PR link when completed with prUrl", () => {
    render(
      <SandboxStatusBadge status="completed" prUrl="https://github.com/example/repo/pull/17" />,
    );

    const link = screen.getByRole("link", { name: "View PR" });
    expect(link).toHaveAttribute("href", "https://github.com/example/repo/pull/17");
  });

  it("falls back to formatted label for unknown statuses", () => {
    render(<SandboxStatusBadge status="awaiting_review" />);

    expect(screen.getByText("Awaiting Review")).toBeInTheDocument();
  });

  it("renders setup progress and runtime mode metadata", () => {
    render(
      <SandboxStatusBadge
        status="executing"
        runtimeMode="interactive"
        setupProgress={{
          containerProvision: { status: "running", startedAt: Date.now() },
          systemSetup: { status: "pending" },
          authSetup: { status: "pending" },
          claudeConfig: { status: "pending" },
          gitClone: { status: "pending" },
          depsInstall: { status: "pending" },
          mcpInstall: { status: "pending" },
          workspaceCustomization: { status: "pending" },
          healthCheck: { status: "pending" },
        }}
      />,
    );

    expect(screen.getByText("Setup 0/10")).toBeInTheDocument();
    expect(screen.getByText("Interactive")).toBeInTheDocument();
  });

  it("handles non-string status and runtime values safely", () => {
    render(<SandboxStatusBadge status={{} as any} runtimeMode={{} as any} />);

    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.queryByText("Interactive")).not.toBeInTheDocument();
  });
});
