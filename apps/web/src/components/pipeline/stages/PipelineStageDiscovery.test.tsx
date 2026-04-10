import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageDiscovery } from "./PipelineStageDiscovery";

vi.mock("@/lib/programContext", () => ({
  useProgramContext: () => ({
    program: { _id: "prog-1", name: "Test" },
    programId: "prog-1",
    slug: "test-program",
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const baseProps = {
  requirement: { _id: "req-1", refId: "BM-001", title: "Test Requirement" },
  programId: "prog-1" as any,
  workstreamId: "ws-1" as any,
  tasks: [],
};

describe("PipelineStageDiscovery", () => {
  it("renders manual creation message when no finding", () => {
    render(<PipelineStageDiscovery {...baseProps} finding={null} />);
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText(/created manually and did not originate/)).toBeInTheDocument();
  });

  it("renders discovery finding details with confidence badge", () => {
    render(
      <PipelineStageDiscovery
        {...baseProps}
        finding={{
          _id: "f-1",
          status: "imported",
          type: "requirement",
          confidence: "high",
          sourceExcerpt: "Source text here",
          documentName: "doc.pdf",
          data: { description: "Extracted desc" },
        }}
      />,
    );
    expect(screen.getByText("Discovery Finding")).toBeInTheDocument();
    expect(screen.getByText("high confidence")).toBeInTheDocument();
    expect(screen.getByText("imported")).toBeInTheDocument();
  });

  it("renders source excerpt when provided", () => {
    render(
      <PipelineStageDiscovery
        {...baseProps}
        finding={{
          _id: "f-1",
          status: "imported",
          type: "requirement",
          sourceExcerpt: "Excerpt text",
        }}
      />,
    );
    expect(screen.getByText("Source Excerpt")).toBeInTheDocument();
  });

  it("renders document name when provided", () => {
    render(
      <PipelineStageDiscovery
        {...baseProps}
        finding={{
          _id: "f-1",
          status: "imported",
          type: "requirement",
          documentName: "test-doc.pdf",
        }}
      />,
    );
    expect(screen.getByText(/Source: test-doc\.pdf/)).toBeInTheDocument();
  });

  it("renders extracted description from finding data", () => {
    render(
      <PipelineStageDiscovery
        {...baseProps}
        finding={{
          _id: "f-1",
          status: "imported",
          type: "requirement",
          data: { description: "AI extracted content" },
        }}
      />,
    );
    expect(screen.getByText("Extracted Description")).toBeInTheDocument();
    expect(screen.getByText("AI extracted content")).toBeInTheDocument();
  });

  it("renders next steps link to discovery hub", () => {
    render(<PipelineStageDiscovery {...baseProps} finding={null} />);
    expect(screen.getByText("Review the finding in Discovery Hub")).toBeInTheDocument();
  });
});
