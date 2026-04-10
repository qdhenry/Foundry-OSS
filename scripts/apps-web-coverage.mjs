#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const coverageDir = path.join(repoRoot, "coverage", "web-and-ui");
const summaryPath = path.join(coverageDir, "coverage-summary.json");
const reportPath = path.join(coverageDir, "gap-report.md");
const vitestBin = path.join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vitest.cmd" : "vitest"
);

const coverageArgs = [
  "run",
  "--project",
  "unit",
  "--reporter=dot",
  "--coverage.enabled",
  "--coverage.provider=v8",
  "--coverage.reportOnFailure",
  "--coverage.reporter=text-summary",
  "--coverage.reporter=json-summary",
  `--coverage.reportsDirectory=${path.relative(repoRoot, coverageDir)}`,
  "--coverage.include=apps/web/src/**/*.{ts,tsx}",
  "--coverage.include=packages/ui/src/**/*.{ts,tsx}",
  "--coverage.exclude=**/*.test.{ts,tsx}",
  "--coverage.exclude=**/*.spec.{ts,tsx}",
  "--coverage.exclude=**/*.stories.{ts,tsx}",
  "--coverage.exclude=**/test/**",
  "--coverage.exclude=**/__tests__/**",
  "apps/web/src",
  "packages/ui/src",
];

function formatPct(value) {
  return `${Number(value).toFixed(2)}%`;
}

function formatMetric(metric) {
  return `${metric.covered}/${metric.total} (${formatPct(metric.pct)})`;
}

function normalizePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function bucketFor(relativePath) {
  if (relativePath.startsWith("packages/ui/src/")) {
    const withoutPrefix = relativePath.replace(/^packages\/ui\/src\//, "");
    const [first] = withoutPrefix.split("/");
    return `ui/${first ?? "(root)"}`;
  }
  const withoutPrefix = relativePath.replace(/^apps\/web\/src\//, "");
  const [first, second] = withoutPrefix.split("/");

  if (first === "components") return `components/${second ?? "(root)"}`;
  if (first === "app") return `app/${second ?? "(root)"}`;
  return first ?? "(root)";
}

function compareCoverageGaps(a, b) {
  if (b.uncoveredStatements !== a.uncoveredStatements) {
    return b.uncoveredStatements - a.uncoveredStatements;
  }
  if (a.statements.pct !== b.statements.pct) {
    return a.statements.pct - b.statements.pct;
  }
  return a.file.localeCompare(b.file);
}

function toTable(rows, headers) {
  const head = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  return [head, divider, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
}

async function writeGapReport(summary, exitCode) {
  const entries = Object.entries(summary)
    .filter(([file]) => file !== "total")
    .map(([file, stats]) => ({
      file: normalizePath(file),
      lines: stats.lines,
      statements: stats.statements,
      functions: stats.functions,
      branches: stats.branches,
    }))
    .filter((entry) => entry.statements.total > 0);

  const withGaps = entries.map((entry) => ({
    ...entry,
    uncoveredStatements: entry.statements.total - entry.statements.covered,
  }));

  const topFiles = withGaps
    .filter((entry) => entry.uncoveredStatements > 0)
    .sort(compareCoverageGaps)
    .slice(0, 20);

  const buckets = new Map();
  for (const entry of entries) {
    const bucket = bucketFor(entry.file);
    const current = buckets.get(bucket) ?? {
      files: 0,
      statements: { covered: 0, total: 0 },
      branches: { covered: 0, total: 0 },
    };
    current.files += 1;
    current.statements.covered += entry.statements.covered;
    current.statements.total += entry.statements.total;
    current.branches.covered += entry.branches.covered;
    current.branches.total += entry.branches.total;
    buckets.set(bucket, current);
  }

  const topBuckets = [...buckets.entries()]
    .map(([bucket, stats]) => {
      const uncoveredStatements =
        stats.statements.total - stats.statements.covered;
      const statementPct =
        stats.statements.total === 0
          ? 100
          : (stats.statements.covered / stats.statements.total) * 100;
      const branchPct =
        stats.branches.total === 0
          ? 100
          : (stats.branches.covered / stats.branches.total) * 100;
      return {
        bucket,
        files: stats.files,
        uncoveredStatements,
        statementPct,
        branchPct,
      };
    })
    .sort((a, b) => b.uncoveredStatements - a.uncoveredStatements)
    .slice(0, 10);

  const zeroCoverageFiles = entries.filter(
    (entry) => entry.statements.covered === 0
  ).length;
  const fullCoverageFiles = entries.filter(
    (entry) => entry.statements.pct === 100
  ).length;

  const reportLines = [
    "# Apps/Web + Packages/UI Coverage Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Command: \`bun run test:coverage:web\``,
    `Vitest exit code: \`${exitCode}\``,
    "",
    exitCode === 0
      ? "Coverage was generated from a passing test run."
      : "Coverage was generated with `reportOnFailure`, so the numbers are still usable even though the current test run is failing.",
    "",
    "## Overall Source Coverage",
    "",
    toTable(
      [
        ["Statements", formatMetric(summary.total.statements)],
        ["Lines", formatMetric(summary.total.lines)],
        ["Functions", formatMetric(summary.total.functions)],
        ["Branches", formatMetric(summary.total.branches)],
      ],
      ["Metric", "Coverage"]
    ),
    "",
    "## File Coverage Snapshot",
    "",
    `- Files with executable statements: ${entries.length}`,
    `- Files at 0% statement coverage: ${zeroCoverageFiles}`,
    `- Files at 100% statement coverage: ${fullCoverageFiles}`,
    "",
    "## Top 10 Areas By Uncovered Statements",
    "",
    toTable(
      topBuckets.map((bucket) => [
        bucket.bucket,
        String(bucket.files),
        String(bucket.uncoveredStatements),
        formatPct(bucket.statementPct),
        formatPct(bucket.branchPct),
      ]),
      ["Area", "Files", "Uncovered Statements", "Statement Coverage", "Branch Coverage"]
    ),
    "",
    "## Top 20 File Gaps",
    "",
    toTable(
      topFiles.map((entry) => [
        `\`${entry.file}\``,
        String(entry.uncoveredStatements),
        formatPct(entry.statements.pct),
        formatPct(entry.functions.pct),
        formatPct(entry.branches.pct),
      ]),
      ["File", "Uncovered Statements", "Statements", "Functions", "Branches"]
    ),
    "",
  ];

  await writeFile(reportPath, `${reportLines.join("\n")}`, "utf8");
}

async function main() {
  if (!existsSync(vitestBin)) {
    console.error(`Vitest binary not found at ${vitestBin}`);
    process.exit(1);
  }

  await mkdir(coverageDir, { recursive: true });

  const result = spawnSync(vitestBin, coverageArgs, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  const exitCode = typeof result.status === "number" ? result.status : 1;

  if (!existsSync(summaryPath)) {
    console.error(`Coverage summary not found at ${summaryPath}`);
    process.exit(exitCode || 1);
  }

  const summary = JSON.parse(await readFile(summaryPath, "utf8"));
  await writeGapReport(summary, exitCode);

  console.log("");
  console.log(`Coverage summary: ${summaryPath}`);
  console.log(`Gap report: ${reportPath}`);

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
