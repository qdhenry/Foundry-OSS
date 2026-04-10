import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisualDiscoveryGallery } from "./VisualDiscoveryGallery";

describe("VisualDiscoveryGallery", () => {
  it("shows loading state", () => {
    render(<VisualDiscoveryGallery programId="prog-1" analyses={undefined} />);

    expect(screen.getByText("Loading visual discovery gallery...")).toBeInTheDocument();
  });

  it("shows empty state when no analyses", () => {
    render(<VisualDiscoveryGallery programId="prog-1" analyses={[]} />);

    expect(screen.getByText("No video analyses yet")).toBeInTheDocument();
    const uploadLink = screen.getByRole("link", { name: "Upload First Video" });
    expect(uploadLink).toHaveAttribute("href", "/prog-1/videos/upload");
  });

  it("renders grouped keyframes, context, and linked findings", () => {
    render(
      <VisualDiscoveryGallery
        programId="prog-1"
        analyses={[
          {
            _id: "analysis_1",
            _creationTime: Date.now(),
            status: "complete",
            segmentOutputs: [
              {
                topic: "Commerce Constraints",
                summary: "Discussed checkout blockers and API limits.",
                startMs: 10000,
                endMs: 45000,
                keyframeUrls: ["https://example.com/keyframe-1.jpg"],
                risks: [
                  {
                    title: "Token expiration mismatch",
                    sourceTimestamp: 12000,
                    sourceExcerpt: "Checkout token expires before payment confirmation.",
                  },
                ],
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Commerce Constraints")).toBeInTheDocument();
    expect(screen.getByText("Discussed checkout blockers and API limits.")).toBeInTheDocument();
    expect(screen.getByText("Linked Findings")).toBeInTheDocument();
    expect(screen.getByText("Token expiration mismatch")).toBeInTheDocument();
    expect(screen.getByText("0:12")).toBeInTheDocument();
    expect(screen.getByAltText("Keyframe 1 from Commerce Constraints")).toBeInTheDocument();
  });

  it("shows per-analysis no-keyframes fallback", () => {
    render(
      <VisualDiscoveryGallery
        programId="prog-1"
        analyses={[
          {
            _id: "analysis_2",
            _creationTime: Date.now(),
            status: "analyzing",
            segmentOutputs: [
              {
                topic: "No visuals yet",
                summary: "Still processing.",
                startMs: 0,
                endMs: 5000,
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("No keyframes available yet")).toBeInTheDocument();
  });

  it("shows failed status banner with stage and error details", () => {
    render(
      <VisualDiscoveryGallery
        programId="prog-1"
        analyses={[
          {
            _id: "analysis_fail",
            _creationTime: Date.now(),
            status: "failed",
            failedError: "Timeout",
            failedStage: "transcribing",
            segmentOutputs: [],
          },
        ]}
      />,
    );

    expect(screen.getByText("Analysis failed")).toBeInTheDocument();
    expect(screen.getByText(/Stage: transcribing/)).toBeInTheDocument();
    expect(screen.getByText(/Timeout/)).toBeInTheDocument();
  });

  it("shows generic no-keyframes fallback for legacy awaiting_speakers status", () => {
    render(
      <VisualDiscoveryGallery
        programId="prog-1"
        analyses={[
          {
            _id: "analysis_speakers",
            _creationTime: Date.now(),
            status: "awaiting_speakers",
            segmentOutputs: [],
          },
        ]}
      />,
    );

    expect(screen.getByText("No keyframes available yet")).toBeInTheDocument();
  });
});
