import { describe, expect, it } from "vitest";
import {
  collectFindingsFromOutput,
  findingSignature,
  normalizeFinding,
} from "../../convex/lib/videoFindingNormalization";

const DEFAULTS = {
  segmentIndex: 0,
  sourceTimestamp: 0,
  sourceExcerpt: "default excerpt",
};

describe("normalizeFinding", () => {
  it("returns a correct NormalizedFinding when all fields are populated", () => {
    const raw = {
      type: "requirement",
      data: { title: "Must support SSO", description: "Enterprise SSO" },
      synthesisNote: "Critical for enterprise rollout",
      confidence: "high",
      status: "approved",
      sourceTimestamp: 12000,
      sourceTimestampEnd: 15000,
      sourceExcerpt: "We need SSO for all users",
    };

    const result = normalizeFinding(raw, DEFAULTS);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("requirement");
    expect(result?.data.title).toBe("Must support SSO");
    expect(result?.synthesisNote).toBe("Critical for enterprise rollout");
    expect(result?.confidence).toBe("high");
    expect(result?.status).toBe("approved");
    expect(result?.sourceAttribution.sourceTimestamp).toBe(12000);
    expect(result?.sourceAttribution.sourceTimestampEnd).toBe(15000);
    expect(result?.sourceAttribution.sourceExcerpt).toBe("We need SSO for all users");
    expect(result?.segmentIndex).toBe(0);
  });

  it("extracts timestamps and excerpt from a nested sourceAttribution object", () => {
    const raw = {
      type: "risk",
      title: "Token mismatch",
      sourceAttribution: {
        sourceTimestamp: 45000,
        sourceTimestampEnd: 48000,
        sourceExcerpt: "Tokens expire before checkout",
      },
    };

    const result = normalizeFinding(raw, DEFAULTS);
    expect(result).not.toBeNull();
    expect(result?.sourceAttribution.sourceTimestamp).toBe(45000);
    expect(result?.sourceAttribution.sourceTimestampEnd).toBe(48000);
    expect(result?.sourceAttribution.sourceExcerpt).toBe("Tokens expire before checkout");
  });

  it("returns null when type is missing and no typeOverride is given", () => {
    const raw = { title: "Orphan finding", sourceExcerpt: "Something" };
    expect(normalizeFinding(raw, DEFAULTS)).toBeNull();
  });

  it("maps readyForReview alias to reviewReady boolean", () => {
    const raw = {
      type: "decision",
      title: "Approved vendor",
      readyForReview: false,
      sourceTimestamp: 1000,
      sourceExcerpt: "We decided on vendor A",
    };

    const result = normalizeFinding(raw, DEFAULTS);
    expect(result).not.toBeNull();
    expect(result?.reviewReady).toBe(false);
  });

  it("applies default confidence and status when fields are missing", () => {
    const raw = {
      type: "integration",
      title: "ERP connector needed",
      sourceTimestamp: 5000,
      sourceExcerpt: "Need to integrate with SAP",
    };

    const result = normalizeFinding(raw, DEFAULTS);
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe("medium");
    expect(result?.status).toBe("pending");
  });

  it("uses typeOverride when provided", () => {
    const raw = {
      title: "Follow-up with vendor",
      sourceTimestamp: 9000,
      sourceExcerpt: "Schedule meeting",
    };

    const result = normalizeFinding(raw, DEFAULTS, "action_item");
    expect(result).not.toBeNull();
    expect(result?.type).toBe("action_item");
  });
});

describe("collectFindingsFromOutput", () => {
  it("collects from a flat array input", () => {
    const output = [
      {
        type: "requirement",
        title: "Flat req",
        sourceTimestamp: 1000,
        sourceExcerpt: "excerpt",
      },
      {
        type: "risk",
        title: "Flat risk",
        sourceTimestamp: 2000,
        sourceExcerpt: "risk excerpt",
      },
    ];

    const results = collectFindingsFromOutput(output, DEFAULTS);
    expect(results.length).toBe(2);
    expect(results[0].type).toBe("requirement");
    expect(results[1].type).toBe("risk");
  });

  it("collects from root.findings container", () => {
    const output = {
      findings: [
        {
          type: "decision",
          title: "Go with option A",
          sourceTimestamp: 3000,
          sourceExcerpt: "decision excerpt",
        },
      ],
    };

    const results = collectFindingsFromOutput(output, DEFAULTS);
    expect(results.length).toBe(1);
    expect(results[0].type).toBe("decision");
    expect(results[0].data.title).toBe("Go with option A");
  });

  it("collects from root.synthesizedFindings with sourceTimestampsMs", () => {
    const output = {
      synthesizedFindings: [
        {
          type: "requirement",
          title: "Synthesized req",
          sourceTimestampsMs: [1000, 5000],
          sourceExcerpts: ["from synthesis"],
        },
      ],
    };

    const results = collectFindingsFromOutput(output, DEFAULTS);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].sourceAttribution.sourceTimestamp).toBe(1000);
    expect(results[0].sourceAttribution.sourceTimestampEnd).toBe(5000);
  });

  it("collects from grouped-by-type keys (requirements, risks, etc.)", () => {
    const output = {
      requirements: [
        {
          title: "Grouped req",
          sourceTimestamp: 10000,
          sourceExcerpt: "grouped",
        },
      ],
      risks: [
        {
          title: "Grouped risk",
          sourceTimestamp: 20000,
          sourceExcerpt: "risk grouped",
        },
      ],
    };

    const results = collectFindingsFromOutput(output, DEFAULTS);
    expect(results.length).toBe(2);
    const types = results.map((r) => r.type);
    expect(types).toContain("requirement");
    expect(types).toContain("risk");
  });

  it("returns empty array for null/undefined/empty input", () => {
    expect(collectFindingsFromOutput(null, DEFAULTS)).toEqual([]);
    expect(collectFindingsFromOutput(undefined, DEFAULTS)).toEqual([]);
    expect(collectFindingsFromOutput({}, DEFAULTS)).toEqual([]);
  });
});

describe("findingSignature", () => {
  it("produces the same signature for identical findings", () => {
    const finding = {
      type: "requirement" as const,
      segmentIndex: 0,
      sourceTimestamp: 12000,
      sourceExcerpt: "We need SSO for all users",
    };

    expect(findingSignature(finding)).toBe(findingSignature({ ...finding }));
  });

  it("produces different signatures for different findings", () => {
    const findingA = {
      type: "requirement" as const,
      segmentIndex: 0,
      sourceTimestamp: 12000,
      sourceExcerpt: "We need SSO for all users",
    };

    const findingB = {
      type: "risk" as const,
      segmentIndex: 1,
      sourceTimestamp: 45000,
      sourceExcerpt: "Token expiry mismatch",
    };

    expect(findingSignature(findingA)).not.toBe(findingSignature(findingB));
  });

  it("handles excerpts with special characters", () => {
    const finding = {
      type: "decision" as const,
      sourceTimestamp: 5000,
      sourceExcerpt: 'Said "yes" to <vendor> & agreed on $100k+',
    };

    const sig = findingSignature(finding);
    expect(typeof sig).toBe("string");
    expect(sig.length).toBeGreaterThan(0);
    expect(findingSignature({ ...finding })).toBe(sig);
  });

  it("includes optional fields when present", () => {
    const base = {
      type: "requirement" as const,
      sourceTimestamp: 1000,
      sourceExcerpt: "excerpt",
    };

    const withEnd = {
      ...base,
      sourceTimestampEnd: 2000,
    };

    const withNote = {
      ...base,
      synthesisNote: "important note",
    };

    expect(findingSignature(base)).not.toBe(findingSignature(withEnd));
    expect(findingSignature(base)).not.toBe(findingSignature(withNote));
  });
});
