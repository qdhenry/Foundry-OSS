import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisSidePanel } from "./AnalysisSidePanel";

let mockAnalysis: any;
let mockFindings: any;

vi.mock("convex/react", () => ({
  useQuery: (fnRef: string) => {
    if (fnRef === "documentAnalysis:getByDocument") return mockAnalysis;
    if (fnRef === "discoveryFindings:listByDocument") return mockFindings;
    return undefined;
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    documentAnalysis: {
      getByDocument: "documentAnalysis:getByDocument",
    },
    discoveryFindings: {
      listByDocument: "discoveryFindings:listByDocument",
    },
  },
}));

describe("AnalysisSidePanel", () => {
  beforeEach(() => {
    mockAnalysis = undefined;
    mockFindings = undefined;
  });

  it("renders action item findings with attribution chips", () => {
    mockAnalysis = {
      status: "complete",
      inputTokens: 100,
      outputTokens: 50,
      durationMs: 1200,
    };
    mockFindings = [
      {
        _id: "finding-1",
        type: "action_item",
        status: "pending",
        confidence: "high",
        data: { title: "Email vendor team" },
        sourceAttribution: {
          sourceTimestamp: 90000,
          sourceTimestampEnd: 120000,
          sourceSpeaker: { speakerId: "speaker_1", name: "Taylor" },
          sourceKeyframeUrls: ["https://example.com/keyframe-1.jpg"],
        },
      },
    ];

    render(<AnalysisSidePanel documentId="doc-1" isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText("Action Item")).toBeInTheDocument();
    expect(screen.getByText("Email vendor team")).toBeInTheDocument();
    expect(screen.getByText("1:30-2:00")).toBeInTheDocument();
    expect(screen.getByText("Taylor")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Keyframe" })).toHaveAttribute(
      "href",
      "https://example.com/keyframe-1.jpg",
    );
  });

  it("supports completed as an alias analysis status", () => {
    mockAnalysis = { status: "completed" };
    mockFindings = [];

    render(<AnalysisSidePanel documentId="doc-1" isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("calls onClose from close button", () => {
    const onClose = vi.fn();
    mockAnalysis = null;

    render(<AnalysisSidePanel documentId="doc-1" isOpen={true} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
