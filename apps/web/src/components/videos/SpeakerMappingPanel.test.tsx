import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpeakerMappingPanel } from "./SpeakerMappingPanel";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

describe("SpeakerMappingPanel", () => {
  const mapSpeaker = vi.fn();
  const addExternal = vi.fn();
  const complete = vi.fn().mockResolvedValue({ ok: true });

  beforeEach(() => {
    vi.clearAllMocks();
    let call = 0;
    mockUseQuery.mockImplementation(() => {
      call += 1;
      if (call % 2 === 1) {
        return {
          analysisId: "analysis_1",
          status: "awaiting_speakers",
          speakerMappingComplete: false,
          totalSpeakers: 2,
          unmappedSpeakers: ["speaker_1"],
          mappings: [],
        };
      }
      return [{ userId: "user_1", role: "architect", user: { name: "Taylor" } }];
    });

    let mutationCall = 0;
    mockUseMutation.mockImplementation(() => {
      mutationCall += 1;
      const slot = ((mutationCall - 1) % 3) + 1;
      if (slot === 1) return mapSpeaker;
      if (slot === 2) return addExternal;
      return complete;
    });
  });

  it("renders unmapped speaker and invokes mapping actions", async () => {
    render(<SpeakerMappingPanel programId="program_1" analysisId="analysis_1" />);

    expect(screen.getByText("speaker_1")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "user_1" },
    });
    fireEvent.click(screen.getByText("Map Team"));
    expect(mapSpeaker).toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("External participant"), {
      target: { value: "Vendor Speaker" },
    });
    fireEvent.click(screen.getByText("Add External"));
    expect(addExternal).toHaveBeenCalled();

    fireEvent.click(screen.getByText("Continue Analysis"));
    expect(complete).toHaveBeenCalled();
  });

  it("renders loading state when query data is not yet available", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<SpeakerMappingPanel programId="program_1" analysisId="analysis_1" />);
    expect(screen.getByText("Loading speaker mapping...")).toBeInTheDocument();
  });

  it("shows all-mapped message when unmappedSpeakers is empty and speakers exist", () => {
    let call = 0;
    mockUseQuery.mockImplementation(() => {
      call += 1;
      if (call % 2 === 1) {
        return {
          analysisId: "analysis_1",
          status: "awaiting_speakers",
          speakerMappingComplete: false,
          totalSpeakers: 2,
          unmappedSpeakers: [],
          mappings: [
            { speakerId: "speaker_1", userId: "user_1" },
            { speakerId: "speaker_2", userId: "user_2" },
          ],
        };
      }
      return [{ userId: "user_1", role: "architect", user: { name: "Taylor" } }];
    });

    render(<SpeakerMappingPanel programId="program_1" analysisId="analysis_1" />);
    expect(screen.getByText("All speakers mapped. Continue when ready.")).toBeInTheDocument();
  });

  it("calls complete mutation with skipped: true when Skip and Continue is clicked", () => {
    render(<SpeakerMappingPanel programId="program_1" analysisId="analysis_1" />);
    fireEvent.click(screen.getByText("Skip and Continue"));
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ skipped: true }));
  });

  it("shows no-speakers-detected when totalSpeakers is 0 and not complete", () => {
    let call = 0;
    mockUseQuery.mockImplementation(() => {
      call += 1;
      if (call % 2 === 1) {
        return {
          analysisId: "analysis_1",
          status: "awaiting_speakers",
          speakerMappingComplete: false,
          totalSpeakers: 0,
          unmappedSpeakers: [],
          mappings: [],
        };
      }
      return [{ userId: "user_1", role: "architect", user: { name: "Taylor" } }];
    });

    render(<SpeakerMappingPanel programId="program_1" analysisId="analysis_1" />);
    expect(screen.getByText(/No speakers detected yet/)).toBeInTheDocument();
  });

  it("shows completion message when speakerMappingComplete is true", () => {
    let call = 0;
    mockUseQuery.mockImplementation(() => {
      call += 1;
      if (call % 2 === 1) {
        return {
          analysisId: "analysis_1",
          status: "analyzing",
          speakerMappingComplete: true,
          totalSpeakers: 0,
          unmappedSpeakers: [],
          mappings: [],
        };
      }
      return [{ userId: "user_1", role: "architect", user: { name: "Taylor" } }];
    });

    render(<SpeakerMappingPanel programId="program_1" analysisId="analysis_1" />);
    expect(
      screen.getByText("Speaker mapping was already completed. The pipeline is continuing."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Continue Analysis")).not.toBeInTheDocument();
  });

  it("shows success state after continue click", async () => {
    render(<SpeakerMappingPanel programId="program_1" analysisId="analysis_1" />);
    fireEvent.click(screen.getByText("Continue Analysis"));

    // Wait for the async mutation to resolve
    await screen.findByText("Pipeline continuing...");
    expect(screen.getByText("Pipeline continuing...")).toBeInTheDocument();
  });
});
