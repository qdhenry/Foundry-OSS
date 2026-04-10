import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageDiscovery } from "./PipelineStageDiscovery";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../../programs", () => ({
  useProgramContext: () => ({ slug: "test-prog" }),
}));

const baseProps = {
  requirement: { _id: "req-1", refId: "REQ-001", title: "Test Req", description: "Desc" },
  programId: "prog-1",
  workstreamId: "ws-1",
  tasks: [],
};

describe("PipelineStageDiscovery", () => {
  it("renders manual creation message when no finding", () => {
    render(<PipelineStageDiscovery {...baseProps} />);
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText(/created manually/)).toBeInTheDocument();
  });

  it("renders finding details when finding provided", () => {
    render(
      <PipelineStageDiscovery
        {...baseProps}
        finding={{
          _id: "f-1",
          status: "approved",
          type: "requirement",
          confidence: "high",
          sourceExcerpt: "Some excerpt text",
          documentName: "specs.pdf",
        }}
      />,
    );
    expect(screen.getByText("Discovery Finding")).toBeInTheDocument();
    expect(screen.getByText("high confidence")).toBeInTheDocument();
    expect(screen.getByText(/Some excerpt text/)).toBeInTheDocument();
    expect(screen.getByText("Source: specs.pdf")).toBeInTheDocument();
  });

  it("shows confidence badge with correct style", () => {
    render(
      <PipelineStageDiscovery
        {...baseProps}
        finding={{ _id: "f-1", status: "pending", type: "requirement", confidence: "medium" }}
      />,
    );
    expect(screen.getByText("medium confidence")).toBeInTheDocument();
  });

  it("renders extracted description from finding data", () => {
    render(
      <PipelineStageDiscovery
        {...baseProps}
        finding={{
          _id: "f-1",
          status: "approved",
          type: "requirement",
          data: { description: "Extracted description text" },
        }}
      />,
    );
    expect(screen.getByText("Extracted description text")).toBeInTheDocument();
  });
});
