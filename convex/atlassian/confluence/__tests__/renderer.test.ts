import { describe, expect, test } from "vitest";
import { renderGapAnalysis, renderProgramOverview } from "../renderer";

const baseProgram = {
  name: "AcmeCorp Migration",
  clientName: "AcmeCorp",
  sourcePlatform: "magento",
  targetPlatform: "salesforce_b2b",
  phase: "discovery",
  status: "active",
  startDate: 1700000000000,
  targetEndDate: 1710000000000,
  description: "Migrating from Magento to Salesforce B2B Commerce",
};

const baseWorkstreams = [
  {
    shortCode: "CAT",
    name: "Catalog & Products",
    status: "on_track",
    description: "Product data migration",
  },
  {
    shortCode: "ORD",
    name: "Orders & Fulfillment",
    status: "at_risk",
    description: "Order management migration",
  },
];

describe("renderProgramOverview", () => {
  test("returns HTML with program name in h1", () => {
    const { html } = renderProgramOverview(baseProgram, baseWorkstreams);
    expect(html).toContain("<h1>AcmeCorp Migration</h1>");
  });

  test("contains info panel with client, migration corridor, phase, status", () => {
    const { html } = renderProgramOverview(baseProgram, baseWorkstreams);
    expect(html).toContain('<ac:structured-macro ac:name="info">');
    expect(html).toContain("<strong>Client:</strong> AcmeCorp");
    expect(html).toContain("<strong>Migration:</strong> Magento");
    expect(html).toContain("Salesforce B2b");
    expect(html).toContain("<strong>Phase:</strong>");
    expect(html).toContain("<strong>Status:</strong>");
  });

  test("contains workstream table with rows for each workstream", () => {
    const { html } = renderProgramOverview(baseProgram, baseWorkstreams);
    expect(html).toContain("<th>Code</th>");
    expect(html).toContain("<th>Name</th>");
    expect(html).toContain("<strong>CAT</strong>");
    expect(html).toContain("Catalog &amp; Products");
    expect(html).toContain("<strong>ORD</strong>");
    expect(html).toContain("Orders &amp; Fulfillment");
  });

  test("handles empty workstreams array", () => {
    const { html } = renderProgramOverview(baseProgram, []);
    expect(html).toContain("No workstreams configured yet.");
    expect(html).not.toContain("<table>");
  });

  test("escapes HTML special characters in program and workstream names", () => {
    const program = {
      ...baseProgram,
      name: '<script>alert("xss")</script>',
      clientName: "Acme & Co <Ltd>",
    };
    const workstreams = [
      {
        shortCode: "T&S",
        name: 'Test "Workstream"',
        status: "active",
      },
    ];
    const { html } = renderProgramOverview(program, workstreams);
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(html).toContain("Acme &amp; Co &lt;Ltd&gt;");
    expect(html).toContain("T&amp;S");
    expect(html).toContain("Test &quot;Workstream&quot;");
  });

  test("returns a contentHash string", () => {
    const { contentHash } = renderProgramOverview(baseProgram, baseWorkstreams);
    expect(typeof contentHash).toBe("string");
    expect(contentHash.length).toBeGreaterThan(0);
    expect(contentHash).toContain(":");
  });

  test("different inputs produce different content hashes", () => {
    const result1 = renderProgramOverview(baseProgram, baseWorkstreams);
    const result2 = renderProgramOverview(
      { ...baseProgram, name: "Different Program" },
      baseWorkstreams,
    );
    expect(result1.contentHash).not.toBe(result2.contentHash);
  });

  test("includes program description when provided", () => {
    const { html } = renderProgramOverview(baseProgram, baseWorkstreams);
    expect(html).toContain("Migrating from Magento to Salesforce B2B Commerce");
  });

  test("omits description paragraph when not provided", () => {
    const { html } = renderProgramOverview(
      { ...baseProgram, description: undefined },
      baseWorkstreams,
    );
    // The description text should not appear between the info panel and workstreams heading
    const infoEnd = html.indexOf("</ac:rich-text-body></ac:structured-macro>");
    const h2Start = html.indexOf("<h2>Workstreams</h2>");
    const between = html.slice(infoEnd, h2Start);
    expect(between).not.toContain("<p>");
  });
});

const baseRequirements = [
  {
    refId: "DISC-01",
    title: "Product Catalog Migration",
    priority: "must_have",
    fitGap: "native",
    effortEstimate: "medium",
    status: "approved",
    workstreamId: "ws-1",
  },
  {
    refId: "DISC-02",
    title: "Custom Pricing Engine",
    priority: "should_have",
    fitGap: "custom_dev",
    effortEstimate: "very_high",
    status: "in_progress",
    workstreamId: "ws-1",
  },
  {
    refId: "DISC-03",
    title: "Shipping Integration",
    priority: "nice_to_have",
    fitGap: "third_party",
    effortEstimate: "high",
    status: "draft",
    workstreamId: "ws-2",
  },
  {
    refId: "DISC-04",
    title: "Legacy Report Export",
    priority: "deferred",
    fitGap: "not_feasible",
    status: "deferred",
    // no workstreamId — unassigned
  },
];

const gapWorkstreams = [
  { _id: "ws-1", shortCode: "CAT", name: "Catalog & Products" },
  { _id: "ws-2", shortCode: "ORD", name: "Orders & Fulfillment" },
];

describe("renderGapAnalysis", () => {
  test('returns HTML with "Gap Analysis Report" heading', () => {
    const { html } = renderGapAnalysis(baseRequirements, gapWorkstreams);
    expect(html).toContain("<h1>Gap Analysis Report</h1>");
  });

  test("summary panel shows total requirements count", () => {
    const { html } = renderGapAnalysis(baseRequirements, gapWorkstreams);
    expect(html).toContain("<strong>Total Requirements:</strong> 4");
  });

  test("summary panel shows by priority counts", () => {
    const { html } = renderGapAnalysis(baseRequirements, gapWorkstreams);
    expect(html).toContain("<strong>By Priority:</strong>");
    expect(html).toContain("Must Have: 1");
    expect(html).toContain("Should Have: 1");
    expect(html).toContain("Nice to Have: 1");
    expect(html).toContain("Deferred: 1");
  });

  test("summary panel shows by fitGap counts", () => {
    const { html } = renderGapAnalysis(baseRequirements, gapWorkstreams);
    expect(html).toContain("<strong>By Fit/Gap:</strong>");
    expect(html).toContain("Native: 1");
    expect(html).toContain("Custom Dev: 1");
    expect(html).toContain("Third Party: 1");
    expect(html).toContain("Not Feasible: 1");
  });

  test("groups requirements by workstream with section headers", () => {
    const { html } = renderGapAnalysis(baseRequirements, gapWorkstreams);
    expect(html).toContain("<h2>CAT - Catalog &amp; Products</h2>");
    expect(html).toContain("<h2>ORD - Orders &amp; Fulfillment</h2>");
  });

  test("renders unassigned requirements section", () => {
    const { html } = renderGapAnalysis(baseRequirements, gapWorkstreams);
    expect(html).toContain("<h2>Unassigned</h2>");
    expect(html).toContain("DISC-04");
  });

  test("does not render unassigned section when all requirements are assigned", () => {
    const allAssigned = baseRequirements.map((r) => ({
      ...r,
      workstreamId: "ws-1",
    }));
    const { html } = renderGapAnalysis(allAssigned, gapWorkstreams);
    expect(html).not.toContain("<h2>Unassigned</h2>");
  });

  test("table has correct columns", () => {
    const { html } = renderGapAnalysis(baseRequirements, gapWorkstreams);
    expect(html).toContain("<th>Ref ID</th>");
    expect(html).toContain("<th>Title</th>");
    expect(html).toContain("<th>Priority</th>");
    expect(html).toContain("<th>Fit/Gap</th>");
    expect(html).toContain("<th>Effort</th>");
    expect(html).toContain("<th>Status</th>");
  });

  test("priority labels map correctly", () => {
    const { html } = renderGapAnalysis(baseRequirements, gapWorkstreams);
    expect(html).toContain("Must Have");
    expect(html).toContain("Should Have");
    expect(html).toContain("Nice to Have");
    expect(html).toContain("Deferred");
  });

  test("fitGap labels map correctly", () => {
    const { html } = renderGapAnalysis(baseRequirements, gapWorkstreams);
    expect(html).toContain("Native");
    expect(html).toContain("Custom Dev");
    expect(html).toContain("Third Party");
    expect(html).toContain("Not Feasible");
  });

  test("effort labels map correctly including TBD for missing", () => {
    const { html } = renderGapAnalysis(baseRequirements, gapWorkstreams);
    expect(html).toContain("Medium");
    expect(html).toContain("Very High");
    expect(html).toContain("High");
    expect(html).toContain("TBD"); // DISC-04 has no effortEstimate
  });

  test("status badges use correct Confluence macro format", () => {
    const { html } = renderGapAnalysis(baseRequirements, gapWorkstreams);
    // approved status → Blue color
    expect(html).toContain(
      '<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Blue</ac:parameter><ac:parameter ac:name="title">Approved</ac:parameter></ac:structured-macro>',
    );
    // in_progress → Yellow
    expect(html).toContain(
      '<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Yellow</ac:parameter><ac:parameter ac:name="title">In Progress</ac:parameter></ac:structured-macro>',
    );
    // draft → Grey
    expect(html).toContain(
      '<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Grey</ac:parameter><ac:parameter ac:name="title">Draft</ac:parameter></ac:structured-macro>',
    );
    // deferred → Grey
    expect(html).toContain(
      '<ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">Grey</ac:parameter><ac:parameter ac:name="title">Deferred</ac:parameter></ac:structured-macro>',
    );
  });

  test("returns a contentHash", () => {
    const { contentHash } = renderGapAnalysis(baseRequirements, gapWorkstreams);
    expect(typeof contentHash).toBe("string");
    expect(contentHash.length).toBeGreaterThan(0);
    expect(contentHash).toContain(":");
  });

  test("different inputs produce different content hashes", () => {
    const result1 = renderGapAnalysis(baseRequirements, gapWorkstreams);
    const result2 = renderGapAnalysis(baseRequirements.slice(0, 2), gapWorkstreams);
    expect(result1.contentHash).not.toBe(result2.contentHash);
  });

  test("handles empty requirements array", () => {
    const { html } = renderGapAnalysis([], gapWorkstreams);
    expect(html).toContain("<h1>Gap Analysis Report</h1>");
    expect(html).toContain("<strong>Total Requirements:</strong> 0");
    expect(html).not.toContain("<h2>Unassigned</h2>");
  });
});
