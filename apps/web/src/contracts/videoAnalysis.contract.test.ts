import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const VIDEO_ANALYSIS_PATH = path.resolve(process.cwd(), "convex/videoAnalysis.ts");
const NORMALIZATION_PATH = path.resolve(process.cwd(), "convex/lib/videoFindingNormalization.ts");
const SCHEMA_PATH = path.resolve(process.cwd(), "convex/schema.ts");

function readVideoAnalysisSource(): string {
  return readFileSync(VIDEO_ANALYSIS_PATH, "utf8");
}

function readNormalizationSource(): string {
  return readFileSync(NORMALIZATION_PATH, "utf8");
}

function readSchemaSource(): string {
  return readFileSync(SCHEMA_PATH, "utf8");
}

describe("videoAnalysis PR3 contract", () => {
  it("includes baseline internal create and status APIs", () => {
    const source = readVideoAnalysisSource();

    expect(source).toMatch(/export const createAnalysis = internalMutation\(\{/);
    expect(source).toMatch(
      /createAnalysis[\s\S]*handler:\s*async[\s\S]*insertVideoAnalysis\(ctx,\s*args\)/,
    );

    expect(source).toMatch(/export const updateStatus = internalMutation\(\{/);
    expect(source).toMatch(/updateStatus[\s\S]*status:\s*videoAnalysisStatusValidator/);
    expect(source).toMatch(/updateStatus[\s\S]*analysisId:\s*v\.id\("videoAnalyses"\)/);
  });

  it("includes public get and status query APIs plus internal getById", () => {
    const source = readVideoAnalysisSource();

    expect(source).toMatch(/export const get = query\(\{/);
    expect(source).toMatch(/export const getStatus = query\(\{/);
    expect(source).toMatch(/export const getByDocument = query\(\{/);
    expect(source).toMatch(/export const listByProgram = query\(\{/);
    expect(source).toMatch(/export const logActivity = internalMutation\(\{/);
    expect(source).toMatch(/logActivity[\s\S]*analysisId:\s*v\.id\("videoAnalyses"\)/);
    expect(source).toMatch(/logActivity[\s\S]*ctx\.db\.insert\("videoActivityLogs"/);
    expect(source).toMatch(/export const getActivityLogs = query\(\{/);
    expect(source).toMatch(/getActivityLogs[\s\S]*programId:\s*v\.id\("programs"\)/);
    expect(source).toMatch(/query\("videoActivityLogs"\)[\s\S]*withIndex\("by_program"/);
    expect(source).toMatch(/export const getRetentionCleanupCandidates = internalQuery\(\{/);
    expect(source).toMatch(/export const markRetentionExpired = internalMutation\(\{/);
    expect(source).toMatch(/export const getById = internalQuery\(\{/);
  });

  it("includes persistence APIs for segment and synthesis outputs", () => {
    const source = readVideoAnalysisSource();
    const normSource = readNormalizationSource();

    expect(source).toMatch(/export const persistSegmentOutputs = internalMutation\(\{/);
    expect(source).toMatch(/persistSegmentOutputs[\s\S]*segmentOutputs:\s*v\.array\(v\.any\(\)\)/);
    expect(source).toMatch(/ctx\.db\.insert\("videoFindings"/);
    expect(source).toMatch(/ctx\.db\.insert\("discoveryFindings"/);

    expect(source).toMatch(/export const persistSynthesisOutputs = internalMutation\(\{/);
    expect(source).toMatch(/persistSynthesisOutputs[\s\S]*synthesisOutput:\s*v\.any\(\)/);

    // Normalization logic extracted to shared module
    expect(normSource).toMatch(/synthesizedFindings/);
    expect(normSource).toMatch(/sourceTimestampsMs/);
  });

  it("includes analysis-scoped activity log query", () => {
    const source = readVideoAnalysisSource();

    expect(source).toMatch(/export const getActivityLogsByAnalysis = query\(\{/);
    expect(source).toMatch(
      /getActivityLogsByAnalysis[\s\S]*analysisId:\s*v\.id\("videoAnalyses"\)/,
    );
    expect(source).toMatch(/getActivityLogsByAnalysis[\s\S]*withIndex\("by_analysis"/);
  });

  it("includes speaker mapping query/mutations for pause-resume flow", () => {
    const source = readVideoAnalysisSource();

    expect(source).toMatch(/export const getSpeakerMappingState = query\(\{/);
    expect(source).toMatch(/export const mapSpeakerToTeamMember = mutation\(\{/);
    expect(source).toMatch(/export const addExternalSpeakerMapping = mutation\(\{/);
    expect(source).toMatch(/export const completeSpeakerMapping = mutation\(\{/);
  });

  it("bootstraps new analyses with required defaults", () => {
    const source = readVideoAnalysisSource();

    expect(source).toMatch(/speakerMappingComplete:\s*true/);
    expect(source).toMatch(/analysisVersion:\s*1/);
    expect(source).toMatch(/retryCount:\s*0/);
    expect(source).toMatch(/retentionPolicy\s*=\s*args\.retentionPolicy\s*\?\?\s*"90_days"/);
    expect(source).toMatch(/stageTimestamps:\s*\{[\s\S]*stageTimestampPatch\("uploading"\)/);
  });

  it("does not clobber failure metadata when updateStatus omits optional fields", () => {
    const source = readVideoAnalysisSource();

    expect(source).toMatch(/if\s*\(args\.failedStage\s*!==\s*undefined\)/);
    expect(source).toMatch(/if\s*\(args\.failedError\s*!==\s*undefined\)/);
    expect(source).toMatch(/if\s*\(args\.retryCount\s*!==\s*undefined\)/);
    expect(source).not.toMatch(/failedStage:\s*args\.failedStage/);
    expect(source).not.toMatch(/failedError:\s*args\.failedError/);
  });

  it("defines videoActivityLogs schema table with program and analysis indexes", () => {
    const source = readSchemaSource();

    expect(source).toMatch(/videoActivityLogs:\s*defineTable\(\{/);
    expect(source).toMatch(/videoActivityLogs[\s\S]*analysisId:\s*v\.id\("videoAnalyses"\)/);
    expect(source).toMatch(/videoActivityLogs[\s\S]*\.index\("by_analysis",\s*\["analysisId"\]\)/);
    expect(source).toMatch(/videoActivityLogs[\s\S]*\.index\("by_program",\s*\["programId"\]\)/);
  });

  it("extends schema for mirrored video findings and persisted outputs", () => {
    const source = readSchemaSource();

    expect(source).toMatch(
      /discoveryFindings[\s\S]*analysisId:\s*v\.union\(v\.id\("documentAnalyses"\),\s*v\.id\("videoAnalyses"\)\)/,
    );
    expect(source).toMatch(
      /videoAnalyses[\s\S]*segmentOutputs:\s*v\.optional\(v\.array\(v\.any\(\)\)\)/,
    );
    expect(source).toMatch(/videoAnalyses[\s\S]*synthesisOutput:\s*v\.optional\(v\.any\(\)\)/);
    expect(source).toMatch(/videoAnalyses[\s\S]*tlIndexId:\s*v\.optional\(v\.string\(\)\)/);
    expect(source).toMatch(/videoAnalyses[\s\S]*tlVideoId:\s*v\.optional\(v\.string\(\)\)/);
    expect(source).toMatch(/videoAnalyses[\s\S]*tlTaskId:\s*v\.optional\(v\.string\(\)\)/);
    expect(source).toMatch(/videoAnalyses[\s\S]*indexingAt:\s*v\.optional\(v\.number\(\)\)/);
    expect(source).toMatch(/videoAnalyses[\s\S]*analyzingAt:\s*v\.optional\(v\.number\(\)\)/);
    expect(source).toMatch(
      /videoAnalyses[\s\S]*retentionStatus:\s*v\.optional\(v\.union\(v\.literal\("active"\),\s*v\.literal\("expired"\)\)\)/,
    );
    expect(source).toMatch(
      /videoAnalyses[\s\S]*retentionCleanupAt:\s*v\.optional\(v\.number\(\)\)/,
    );
    expect(source).toMatch(/twelveLabsIndexes:\s*defineTable\(\{/);
    expect(source).toMatch(/twelveLabsIndexes[\s\S]*\.index\("by_org",\s*\["orgId"\]\)/);
    expect(source).toMatch(
      /videoTranscripts[\s\S]*retentionExpiredAt:\s*v\.optional\(v\.number\(\)\)/,
    );
    expect(source).toMatch(
      /videoFrameExtractions[\s\S]*retentionExpiredAt:\s*v\.optional\(v\.number\(\)\)/,
    );
  });

  it("includes Twelve Labs helper mutations", () => {
    const source = readVideoAnalysisSource();

    expect(source).toMatch(/export const patchTwelveLabsFields = internalMutation\(\{/);
    expect(source).toMatch(/patchTwelveLabsFields[\s\S]*tlIndexId:\s*v\.optional\(v\.string\(\)\)/);
    expect(source).toMatch(/export const getOrCreateOrgIndex = internalMutation\(\{/);
    expect(source).toMatch(/query\("twelveLabsIndexes"\)/);
  });
});
