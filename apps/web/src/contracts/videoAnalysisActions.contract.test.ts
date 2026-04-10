import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const VIDEO_ANALYSIS_ACTIONS_PATH = path.resolve(process.cwd(), "convex/videoAnalysisActions.ts");
const VIDEO_ANALYSIS_ACTIONS_TL_PATH = path.resolve(
  process.cwd(),
  "convex/videoAnalysisActionsTL.ts",
);

function readVideoAnalysisActionsSource(): string {
  return readFileSync(VIDEO_ANALYSIS_ACTIONS_PATH, "utf8");
}

function readVideoAnalysisActionsTLSource(): string {
  return readFileSync(VIDEO_ANALYSIS_ACTIONS_TL_PATH, "utf8");
}

describe("videoAnalysisActions contract", () => {
  it("keeps persistence and retention actions in the legacy module", () => {
    const source = readVideoAnalysisActionsSource();

    expect(source).toMatch(/export const persistSegmentOutputs = internalAction\(\{/);
    expect(source).toMatch(/export const persistSynthesisOutputs = internalAction\(\{/);
    expect(source).toMatch(/export const runRetentionCleanup = internalAction\(\{/);

    expect(source).not.toMatch(/export const startOrResumeAnalysis = internalAction\(\{/);
    expect(source).not.toMatch(/export const runExtractingMedia = internalAction\(\{/);
    expect(source).not.toMatch(/export const runAwaitingSpeakers = internalAction\(\{/);
  });

  it("uses videoAnalysis persistence APIs and valid status transitions", () => {
    const source = readVideoAnalysisActionsSource();

    expect(source).toMatch(/ctx\.runMutation\(internal\.videoAnalysis\.persistSegmentOutputs/);
    expect(source).toMatch(/ctx\.runMutation\(internal\.videoAnalysis\.persistSynthesisOutputs/);
    expect(source).toMatch(/status:\s*"analyzing"/);
    expect(source).toMatch(/status:\s*"complete"/);
    expect(source).toMatch(/ctx\.runQuery\(internal\.videoAnalysis\.getRetentionCleanupCandidates/);
    expect(source).toMatch(/ctx\.runMutation\(internal\.videoAnalysis\.markRetentionExpired/);
  });
});

describe("videoAnalysisActionsTL contract", () => {
  it("exports Twelve Labs pipeline actions", () => {
    const source = readVideoAnalysisActionsTLSource();

    expect(source).toMatch(/export const submitToTwelveLabs = internalAction\(\{/);
    expect(source).toMatch(/export const pollTwelveLabsStatus = internalAction\(\{/);
    expect(source).toMatch(/export const retrieveAndAnalyze = internalAction\(\{/);
    expect(source).toMatch(/const POLL_INTERVAL_MS = 15_000/);
  });

  it("polls indexing status and schedules follow-up actions", () => {
    const source = readVideoAnalysisActionsTLSource();

    expect(source).toMatch(
      /ctx\.scheduler\.runAfter\(\s*POLL_INTERVAL_MS,\s*internalTLActions\.pollTwelveLabsStatus/,
    );
    expect(source).toMatch(
      /ctx\.scheduler\.runAfter\(\s*0,\s*internalTLActions\.retrieveAndAnalyze/,
    );
    expect(source).toMatch(/status:\s*"indexing"/);
    expect(source).toMatch(/status:\s*"failed"/);
  });

  it("retrieves TL artifacts, writes transcript, and persists findings", () => {
    const source = readVideoAnalysisActionsTLSource();

    expect(source).toMatch(/retrieveVideoData\(/);
    expect(source).toMatch(/ctx\.runMutation\(\s*internal\.videoAnalysis\.createTranscript/);
    expect(source).toMatch(/ctx\.runMutation\(\s*internal\.videoAnalysis\.patchTwelveLabsFields/);
    expect(source).toMatch(/ctx\.runMutation\(\s*internal\.videoAnalysis\.persistSegmentOutputs/);
    expect(source).toMatch(/ctx\.runMutation\(\s*internal\.videoAnalysis\.persistSynthesisOutputs/);
    expect(source).toMatch(/status:\s*"complete"/);
  });
});
