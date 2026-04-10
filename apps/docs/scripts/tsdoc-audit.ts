#!/usr/bin/env -S npx tsx
/**
 * TSDoc Audit Script for Foundry Convex Backend
 *
 * Scans convex/ files for public query/mutation/action exports and reports
 * TSDoc (JSDoc) coverage. Also checks table documentation in schema.ts.
 *
 * Usage:
 *   npx tsx apps/docs/scripts/tsdoc-audit.ts
 *   bun run apps/docs/scripts/tsdoc-audit.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONVEX_ROOT = join(import.meta.dirname ?? __dirname, "../../../convex");

/** Directories to exclude from scanning */
const EXCLUDED_DIRS = new Set(["_generated", "__tests__", "lib", "model", "shared", "testing"]);

/** Regex to match public Convex function exports (query, mutation, action) */
const PUBLIC_EXPORT_RE = /^export\s+const\s+(\w+)\s*=\s*(query|mutation|action)\s*\(/gm;

/** Regex to detect a JSDoc block ending at or near a given line */
const JSDOC_END_RE = /\*\/\s*$/;

/** Regex to match defineTable(...) in schema.ts */
const DEFINE_TABLE_RE = /^\s*(\w+)\s*:\s*defineTable\s*\(/gm;

/** Regex to match imported table definitions (e.g., `agentTemplates,`) */
const IMPORTED_TABLE_RE = /^\s+(\w+),?\s*$/gm;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FunctionInfo {
  name: string;
  type: "query" | "mutation" | "action";
  line: number;
  hasDoc: boolean;
}

interface FileAudit {
  filePath: string;
  relativePath: string;
  functions: FunctionInfo[];
  documented: number;
  undocumented: number;
}

interface TableInfo {
  name: string;
  line: number;
  hasDoc: boolean;
  isImported: boolean;
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function discoverFiles(dir: string, depth = 0): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (depth === 0 && !EXCLUDED_DIRS.has(entry)) {
        // Scan one level of subdirectories (convex/*/*.ts)
        results.push(...discoverFiles(fullPath, depth + 1));
      }
      // Skip deeper nesting and excluded dirs
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".d.ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Detect TSDoc preceding an export
// ---------------------------------------------------------------------------

function hasPrecedingJSDoc(lines: string[], exportLineIndex: number): boolean {
  // Walk backwards from the line before the export
  let i = exportLineIndex - 1;

  // Skip blank lines
  while (i >= 0 && lines[i].trim() === "") {
    i--;
  }

  if (i < 0) return false;

  // The line should end with */ (closing JSDoc)
  if (!JSDOC_END_RE.test(lines[i])) return false;

  // Walk further back to find the opening /**
  while (i >= 0) {
    if (lines[i].includes("/**")) return true;
    i--;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Audit a single file for public functions
// ---------------------------------------------------------------------------

function auditFile(filePath: string): FileAudit {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const relPath = relative(join(CONVEX_ROOT, ".."), filePath);
  const functions: FunctionInfo[] = [];

  // Reset regex state
  PUBLIC_EXPORT_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = PUBLIC_EXPORT_RE.exec(content)) !== null) {
    const name = match[1];
    const type = match[2] as "query" | "mutation" | "action";

    // Determine which line this match is on
    const beforeMatch = content.substring(0, match.index);
    const lineIndex = beforeMatch.split("\n").length - 1;

    const hasDoc = hasPrecedingJSDoc(lines, lineIndex);
    functions.push({ name, type, line: lineIndex + 1, hasDoc });
  }

  const documented = functions.filter((f) => f.hasDoc).length;
  const undocumented = functions.filter((f) => !f.hasDoc).length;

  return {
    filePath,
    relativePath: relPath,
    functions,
    documented,
    undocumented,
  };
}

// ---------------------------------------------------------------------------
// Audit schema.ts for table documentation
// ---------------------------------------------------------------------------

function auditSchema(): TableInfo[] {
  const schemaPath = join(CONVEX_ROOT, "schema.ts");
  const content = readFileSync(schemaPath, "utf-8");
  const lines = content.split("\n");
  const tables: TableInfo[] = [];

  // Find inline defineTable calls
  DEFINE_TABLE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DEFINE_TABLE_RE.exec(content)) !== null) {
    const name = match[1];
    const beforeMatch = content.substring(0, match.index);
    const lineIndex = beforeMatch.split("\n").length - 1;
    const hasDoc = hasPrecedingJSDoc(lines, lineIndex);
    tables.push({ name, line: lineIndex + 1, hasDoc, isImported: false });
  }

  // Find imported table definitions (at the end of defineSchema block)
  // These are lines like `  agentTemplates,` after the inline tables
  const importedTableSection = content.match(/\/\/ Agent Team[\s\S]*?(?=\}\);)/);
  if (importedTableSection) {
    const sectionStart = content.indexOf(importedTableSection[0]);
    IMPORTED_TABLE_RE.lastIndex = 0;
    let importMatch: RegExpExecArray | null;
    while ((importMatch = IMPORTED_TABLE_RE.exec(importedTableSection[0])) !== null) {
      const name = importMatch[1];
      // Imported tables do not have inline JSDoc in schema.ts
      // Check if there's a comment above the line
      const absoluteIndex = sectionStart + importMatch.index;
      const beforeMatch = content.substring(0, absoluteIndex);
      const lineIndex = beforeMatch.split("\n").length - 1;
      const hasDoc = hasPrecedingJSDoc(lines, lineIndex);
      tables.push({ name, line: lineIndex + 1, hasDoc, isImported: true });
    }
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const files = discoverFiles(CONVEX_ROOT);
  const audits = files.map(auditFile).filter((a) => a.functions.length > 0);

  // Aggregate stats
  const totalFunctions = audits.reduce((sum, a) => sum + a.functions.length, 0);
  const totalDocumented = audits.reduce((sum, a) => sum + a.documented, 0);
  const totalUndocumented = audits.reduce((sum, a) => sum + a.undocumented, 0);
  const coveragePct =
    totalFunctions > 0 ? ((totalDocumented / totalFunctions) * 100).toFixed(1) : "0.0";

  // Schema audit
  const tables = auditSchema();
  const totalTables = tables.length;
  const documentedTables = tables.filter((t) => t.hasDoc).length;
  const undocumentedTables = totalTables - documentedTables;
  const tableCoveragePct =
    totalTables > 0 ? ((documentedTables / totalTables) * 100).toFixed(1) : "0.0";

  // Determine if tables have inline comments (// N. TableName pattern)
  const schemaContent = readFileSync(join(CONVEX_ROOT, "schema.ts"), "utf-8");
  const inlineCommentTables = new Set<string>();
  const inlineCommentRE = /\/\/\s*\d+[a-z]?\.\s+([A-Z][\w\s]+?)(?:\s*[-—]|$)/gm;
  let icMatch: RegExpExecArray | null;
  while ((icMatch = inlineCommentRE.exec(schemaContent)) !== null) {
    inlineCommentTables.add(icMatch[1].trim());
  }

  // ---------------------------------------------------------------------------
  // Report: Header
  // ---------------------------------------------------------------------------
  console.log("");
  console.log("TSDoc Audit Report");
  console.log("==================");
  console.log(`Scan scope: convex/*.ts and convex/*/*.ts`);
  console.log(`Excluded: _generated, __tests__, lib, model, shared, testing`);
  console.log(`Files scanned: ${files.length}`);
  console.log(`Files with public functions: ${audits.length}`);
  console.log("");

  // ---------------------------------------------------------------------------
  // Report: Function coverage
  // ---------------------------------------------------------------------------
  console.log("Public Function Coverage");
  console.log("------------------------");
  console.log(`Total public functions: ${totalFunctions}`);
  console.log(`With TSDoc: ${totalDocumented} (${coveragePct}%)`);
  console.log(
    `Without TSDoc: ${totalUndocumented} (${(100 - Number.parseFloat(coveragePct)).toFixed(1)}%)`,
  );
  console.log("");

  // Breakdown by type
  const byType = { query: [0, 0], mutation: [0, 0], action: [0, 0] };
  for (const audit of audits) {
    for (const fn of audit.functions) {
      byType[fn.type][0]++;
      if (fn.hasDoc) byType[fn.type][1]++;
    }
  }
  console.log("By function type:");
  for (const [type, [total, documented]] of Object.entries(byType)) {
    const pct = total > 0 ? ((documented / total) * 100).toFixed(1) : "0.0";
    console.log(
      `  ${type.padEnd(10)} ${String(total).padStart(4)} total, ${String(documented).padStart(4)} documented (${pct}%)`,
    );
  }
  console.log("");

  // ---------------------------------------------------------------------------
  // Report: Files with most gaps
  // ---------------------------------------------------------------------------
  const filesWithGaps = audits
    .filter((a) => a.undocumented > 0)
    .sort((a, b) => b.undocumented - a.undocumented);

  console.log(`Files with most gaps (${filesWithGaps.length} files):`);
  for (const file of filesWithGaps.slice(0, 20)) {
    const total = file.functions.length;
    console.log(`  ${file.relativePath} -- ${total} functions, ${file.documented} documented`);
  }
  if (filesWithGaps.length > 20) {
    console.log(`  ... and ${filesWithGaps.length - 20} more files`);
  }
  console.log("");

  // ---------------------------------------------------------------------------
  // Report: All undocumented functions
  // ---------------------------------------------------------------------------
  const allUndocumented: { path: string; name: string; type: string }[] = [];
  for (const audit of audits) {
    for (const fn of audit.functions) {
      if (!fn.hasDoc) {
        allUndocumented.push({
          path: audit.relativePath,
          name: fn.name,
          type: fn.type,
        });
      }
    }
  }
  console.log(`All undocumented functions (${allUndocumented.length}):`);
  for (const fn of allUndocumented) {
    console.log(`  ${fn.path}:${fn.name} (${fn.type})`);
  }
  console.log("");

  // ---------------------------------------------------------------------------
  // Report: Table documentation coverage
  // ---------------------------------------------------------------------------
  console.log("Table Documentation Coverage (schema.ts)");
  console.log("-----------------------------------------");
  console.log(`Total tables: ${totalTables}`);
  console.log(`With JSDoc (/** */): ${documentedTables} (${tableCoveragePct}%)`);
  console.log(
    `Without JSDoc: ${undocumentedTables} (${(100 - Number.parseFloat(tableCoveragePct)).toFixed(1)}%)`,
  );
  console.log("");

  // Note: schema.ts uses inline comments (// N. TableName -- description) not JSDoc
  console.log("Note: schema.ts uses inline comments (// N. Title -- desc) rather than");
  console.log("/** JSDoc */ blocks. Tables have descriptive inline comments but lack");
  console.log("machine-parseable JSDoc that tooling can extract.");
  console.log("");

  const undocumentedTableNames = tables.filter((t) => !t.hasDoc).map((t) => t.name);
  const documentedTableNames = tables.filter((t) => t.hasDoc).map((t) => t.name);

  if (documentedTableNames.length > 0) {
    console.log(`Tables with JSDoc (${documentedTableNames.length}):`);
    for (const name of documentedTableNames) {
      console.log(`  ${name}`);
    }
    console.log("");
  }

  console.log(`Tables without JSDoc (${undocumentedTableNames.length}):`);
  for (const name of undocumentedTableNames) {
    console.log(`  ${name}`);
  }
  console.log("");

  // ---------------------------------------------------------------------------
  // Report: Summary table for all files
  // ---------------------------------------------------------------------------
  console.log("Full file breakdown:");
  console.log(
    "  File".padEnd(62) + "Total".padStart(6) + "  Doc".padStart(6) + "  Gap".padStart(6),
  );
  console.log("  " + "-".repeat(74));
  for (const audit of audits.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
    const total = audit.functions.length;
    console.log(
      `  ${audit.relativePath.padEnd(60)}${String(total).padStart(6)}${String(audit.documented).padStart(6)}${String(audit.undocumented).padStart(6)}`,
    );
  }
  console.log("");
}

main();
