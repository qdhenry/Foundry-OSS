#!/usr/bin/env bun
/**
 * Reference Auto-Generation Script for Foundry Docs
 *
 * Reads convex/schema.ts and convex function files, then emits MDX reference
 * pages into apps/docs/src/content/docs/reference/generated/.
 *
 * Whitelist of tables and functions is defined in reference-scope.json.
 *
 * Usage:
 *   bun run apps/docs/scripts/generate-reference.ts
 *   bun --cwd apps/docs run reference:gen
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const REPO_ROOT = join(import.meta.dirname ?? __dirname, "../../..");
const CONVEX_ROOT = join(REPO_ROOT, "convex");
const SCOPE_PATH = join(import.meta.dirname ?? __dirname, "reference-scope.json");
const GENERATED_ROOT = join(REPO_ROOT, "apps/docs/src/content/docs/reference/generated");
const SCHEMA_OUT = join(GENERATED_ROOT, "schema");
const FUNCTIONS_OUT = join(GENERATED_ROOT, "functions");

// ---------------------------------------------------------------------------
// Load scope whitelist
// ---------------------------------------------------------------------------

const scope: {
  tables: string[];
  functions: Record<string, string[]>;
} = JSON.parse(readFileSync(SCOPE_PATH, "utf-8"));

// ---------------------------------------------------------------------------
// Git SHA
// ---------------------------------------------------------------------------

let gitSha = "unknown";
try {
  gitSha = execSync("git rev-parse --short HEAD", {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  }).trim();
} catch {
  console.warn("Warning: could not determine git SHA, using 'unknown'");
}

const TODAY = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Utility: read file safely
// ---------------------------------------------------------------------------

function readFileSafe(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Type parsing: v.* validators -> human-readable type strings
// ---------------------------------------------------------------------------

function parseValidatorType(raw: string): { type: string; required: boolean } {
  const trimmed = raw.trim();

  // v.optional(...)
  const optionalMatch = trimmed.match(/^v\.optional\((.+)\)$/s);
  if (optionalMatch) {
    const inner = parseValidatorType(optionalMatch[1]);
    return { type: inner.type, required: false };
  }

  // v.string()
  if (trimmed === "v.string()") return { type: "string", required: true };
  // v.number()
  if (trimmed === "v.number()") return { type: "number", required: true };
  // v.boolean()
  if (trimmed === "v.boolean()") return { type: "boolean", required: true };
  // v.float64()
  if (trimmed === "v.float64()") return { type: "number", required: true };
  // v.int64()
  if (trimmed === "v.int64()") return { type: "number", required: true };
  // v.bytes()
  if (trimmed === "v.bytes()") return { type: "bytes", required: true };
  // v.null()
  if (trimmed === "v.null()") return { type: "null", required: true };
  // v.any()
  if (trimmed === "v.any()") return { type: "any", required: true };

  // v.id("tableName")
  const idMatch = trimmed.match(/^v\.id\("(\w+)"\)$/);
  if (idMatch) return { type: `Id<"${idMatch[1]}">`, required: true };

  // v.array(...)
  const arrayMatch = trimmed.match(/^v\.array\((.+)\)$/s);
  if (arrayMatch) {
    const inner = parseValidatorType(arrayMatch[1]);
    return { type: `${inner.type}[]`, required: true };
  }

  // v.union(v.literal("a"), v.literal("b"), ...)
  const unionLiteralMatch = trimmed.match(/^v\.union\(\s*(v\.literal\(.+)\)$/s);
  if (unionLiteralMatch) {
    const literalRe = /v\.literal\(([^)]+)\)/g;
    const literals: string[] = [];
    let m: RegExpExecArray | null;
    m = literalRe.exec(trimmed);
    while (m !== null) {
      literals.push(m[1].trim());
      m = literalRe.exec(trimmed);
    }
    if (literals.length > 0) {
      return { type: literals.join(" | "), required: true };
    }
  }

  // v.union(...) with non-literal variants
  if (trimmed.startsWith("v.union(")) {
    return { type: "union", required: true };
  }

  // v.object({...})
  if (trimmed.startsWith("v.object(")) {
    return { type: "object", required: true };
  }

  // v.record(...)
  if (trimmed.startsWith("v.record(")) {
    return { type: "Record", required: true };
  }

  // Named validator references (imported from other files)
  if (!trimmed.startsWith("v.") && /^[a-zA-Z_]\w*$/.test(trimmed)) {
    return { type: trimmed, required: true };
  }

  // Fallback
  return { type: trimmed, required: true };
}

// ---------------------------------------------------------------------------
// Schema parsing: extract fields and indexes from defineTable blocks
// ---------------------------------------------------------------------------

interface FieldInfo {
  name: string;
  type: string;
  required: boolean;
}

interface IndexInfo {
  name: string;
  fields: string[];
}

interface TableInfo {
  fields: FieldInfo[];
  indexes: IndexInfo[];
  jsDoc: string | null;
}

/**
 * Find the defineTable block for a given table name in schema source.
 * Handles both inline definitions and imported table references.
 */
function findTableDefinition(schemaSource: string, tableName: string): string | null {
  // Pattern 1: tableName: defineTable({...}).index(...)
  // Build a regex that finds the start, then use brace-counting to find the end.
  const startPatterns = [
    // Inline in schema: `tableName: defineTable({`
    new RegExp(`(?:^|\\n)\\s*(?:\\/\\/[^\\n]*\\n\\s*)*${tableName}:\\s*defineTable\\(\\{`),
    // Exported from sub-schema: `export const tableName = defineTable({`
    new RegExp(
      `(?:^|\\n)\\s*(?:\\/\\/[^\\n]*\\n\\s*)*export\\s+const\\s+${tableName}\\s*=\\s*defineTable\\(\\{`,
    ),
  ];

  for (const startRe of startPatterns) {
    const startMatch = startRe.exec(schemaSource);
    if (!startMatch) continue;

    // Find the position of `defineTable({`
    const dtIdx = schemaSource.indexOf("defineTable({", startMatch.index);
    if (dtIdx === -1) continue;

    // Start from the opening brace of the defineTable argument
    const braceStart = dtIdx + "defineTable(".length;
    let depth = 0;
    let i = braceStart;
    let defineTableEnd = -1;

    // Find the matching closing brace of the object literal
    for (; i < schemaSource.length; i++) {
      if (schemaSource[i] === "{") depth++;
      else if (schemaSource[i] === "}") {
        depth--;
        if (depth === 0) {
          defineTableEnd = i + 1;
          break;
        }
      }
    }

    if (defineTableEnd === -1) continue;

    // Now continue to capture .index() and .searchIndex() chains
    const chainEnd = defineTableEnd;
    // Skip the closing paren of defineTable(...)
    let j = chainEnd;
    // Skip whitespace
    while (j < schemaSource.length && /\s/.test(schemaSource[j])) j++;
    // Expect closing paren of defineTable(...)
    if (schemaSource[j] === ")") j++;

    // Capture .index() / .searchIndex() chains
    while (j < schemaSource.length) {
      // Skip whitespace and newlines
      while (j < schemaSource.length && /\s/.test(schemaSource[j])) j++;
      if (
        schemaSource.substring(j, j + 6) === ".index" ||
        schemaSource.substring(j, j + 12) === ".searchIndex"
      ) {
        // Skip to the end of this chain call
        const parenStart = schemaSource.indexOf("(", j);
        if (parenStart === -1) break;
        let pd = 0;
        let k = parenStart;
        for (; k < schemaSource.length; k++) {
          if (schemaSource[k] === "(") pd++;
          else if (schemaSource[k] === ")") {
            pd--;
            if (pd === 0) {
              j = k + 1;
              break;
            }
          }
        }
      } else {
        break;
      }
    }

    return schemaSource.substring(startMatch.index, j);
  }

  return null;
}

/**
 * Extract field definitions from the body of a defineTable({ ... }) call.
 */
function extractFields(tableBlock: string): FieldInfo[] {
  // Isolate the object literal inside defineTable({...})
  const dtStart = tableBlock.indexOf("defineTable({");
  if (dtStart === -1) return [];

  const braceStart = dtStart + "defineTable({".length - 1;
  let depth = 0;
  let bodyEnd = -1;

  for (let i = braceStart; i < tableBlock.length; i++) {
    if (tableBlock[i] === "{") depth++;
    else if (tableBlock[i] === "}") {
      depth--;
      if (depth === 0) {
        bodyEnd = i;
        break;
      }
    }
  }

  if (bodyEnd === -1) return [];
  const body = tableBlock.substring(braceStart + 1, bodyEnd);

  // Parse top-level field: value pairs
  const fields: FieldInfo[] = [];
  const lines = body.split("\n");

  let currentField: string | null = null;
  let currentValue = "";
  let parenDepth = 0;
  let braceDepthLocal = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("//")) continue;

    if (currentField === null) {
      // Look for a field start: `fieldName: v.something(`
      const fieldMatch = trimmedLine.match(/^(\w+):\s*(.+)/);
      if (fieldMatch) {
        currentField = fieldMatch[1];
        currentValue = fieldMatch[2];

        // Count parens/braces to see if the value is complete
        parenDepth = 0;
        braceDepthLocal = 0;
        for (const ch of currentValue) {
          if (ch === "(") parenDepth++;
          else if (ch === ")") parenDepth--;
          else if (ch === "{") braceDepthLocal++;
          else if (ch === "}") braceDepthLocal--;
        }

        if (parenDepth <= 0 && braceDepthLocal <= 0) {
          // Value is complete on this line
          const cleanValue = currentValue.replace(/,\s*$/, "").trim();
          const parsed = parseValidatorType(cleanValue);
          fields.push({
            name: currentField,
            type: parsed.type,
            required: parsed.required,
          });
          currentField = null;
          currentValue = "";
        }
      }
    } else {
      // Continuation of a multi-line value
      currentValue += "\n" + trimmedLine;

      for (const ch of trimmedLine) {
        if (ch === "(") parenDepth++;
        else if (ch === ")") parenDepth--;
        else if (ch === "{") braceDepthLocal++;
        else if (ch === "}") braceDepthLocal--;
      }

      if (parenDepth <= 0 && braceDepthLocal <= 0) {
        const cleanValue = currentValue.replace(/,\s*$/, "").trim();
        const parsed = parseValidatorType(cleanValue);
        fields.push({
          name: currentField,
          type: parsed.type,
          required: parsed.required,
        });
        currentField = null;
        currentValue = "";
      }
    }
  }

  return fields;
}

/**
 * Extract index definitions from a table block's .index() chains.
 */
function extractIndexes(tableBlock: string): IndexInfo[] {
  const indexes: IndexInfo[] = [];

  // Match .index("name", ["field1", "field2"])
  const indexRe = /\.index\(\s*"([^"]+)"\s*,\s*\[([^\]]*)\]\s*\)/g;
  let m: RegExpExecArray | null;
  m = indexRe.exec(tableBlock);
  while (m !== null) {
    const name = m[1];
    const fieldsStr = m[2];
    const fields = fieldsStr
      .split(",")
      .map((f) => f.trim().replace(/"/g, ""))
      .filter(Boolean);
    indexes.push({ name, fields });
    m = indexRe.exec(tableBlock);
  }

  // Match .searchIndex("name", { ... })
  const searchIdxRe = /\.searchIndex\(\s*"([^"]+)"/g;
  m = searchIdxRe.exec(tableBlock);
  while (m !== null) {
    indexes.push({ name: `${m[1]} (search)`, fields: ["(search index)"] });
    m = searchIdxRe.exec(tableBlock);
  }

  return indexes;
}

/**
 * Extract JSDoc comment immediately preceding a table definition.
 */
function extractTableJsDoc(schemaSource: string, tableName: string): string | null {
  // Look for // comment on the line immediately above the table definition
  const lineCommentRe = new RegExp(
    `\\/\\/\\s*(?:\\d+\\.?\\s*)?([^\\n]+)\\n\\s*${tableName}:\\s*defineTable`,
  );
  const lcMatch = lineCommentRe.exec(schemaSource);
  if (lcMatch) {
    return lcMatch[1].trim().replace(/^—\s*/, "");
  }

  // Look for /** */ block comment
  const jsdocRe = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*\\n\\s*${tableName}:\\s*defineTable`);
  const jdMatch = jsdocRe.exec(schemaSource);
  if (jdMatch) {
    return jdMatch[1]
      .split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter(Boolean)
      .join(" ");
  }

  return null;
}

// ---------------------------------------------------------------------------
// Function parsing
// ---------------------------------------------------------------------------

interface FunctionInfo {
  name: string;
  fnType: "query" | "mutation" | "action";
  args: string;
  jsDoc: string | null;
}

/**
 * Find and extract information about an exported Convex function.
 */
function extractFunction(source: string, funcName: string): FunctionInfo | null {
  // Find `export const <name> = (query|mutation|action)({`
  // Do NOT include JSDoc in the match -- we extract it separately via lookback.
  const exportRe = new RegExp(
    `export\\s+const\\s+${funcName}\\s*=\\s*(query|mutation|action)\\s*\\(\\{`,
  );
  const match = exportRe.exec(source);
  if (!match) return null;

  const fnType = match[1] as "query" | "mutation" | "action";
  const fullMatch = match[0];
  const matchStart = match.index;

  // Extract JSDoc or line comment immediately before the export statement.
  // Only look at the 500 chars preceding the `export` keyword to avoid
  // capturing unrelated JSDoc blocks from earlier in the file.
  let jsDoc: string | null = null;
  const lookback = source.substring(Math.max(0, matchStart - 500), matchStart);

  // Find the LAST /** ... */ block in the lookback window.
  // We search for all `/** ... */` blocks and take the final one,
  // which is the one immediately preceding the export statement.
  const jsdocAllRe = /\/\*\*([\s\S]*?)\*\//g;
  let jdMatch: RegExpExecArray | null;
  let lastJsdocBody: string | null = null;
  let lastJsdocEnd = -1;
  jdMatch = jsdocAllRe.exec(lookback);
  while (jdMatch !== null) {
    lastJsdocBody = jdMatch[1];
    lastJsdocEnd = jdMatch.index + jdMatch[0].length;
    jdMatch = jsdocAllRe.exec(lookback);
  }
  // Only use it if the JSDoc block ends near the end of the lookback
  // (i.e., it's immediately before the export, not some distant comment).
  if (lastJsdocBody !== null && lookback.length - lastJsdocEnd < 20) {
    jsDoc = lastJsdocBody
      .split("\n")
      .map((l) => l.replace(/^\s*\*\s?/, "").trim())
      .filter(Boolean)
      .join("\n");
  }

  // Fall back to // line comment right before export
  if (!jsDoc) {
    const lineCommentMatch = lookback.match(/\/\/\s*([^\n]+)\n\s*$/);
    if (lineCommentMatch) {
      jsDoc = lineCommentMatch[1].trim();
    }
  }

  // Extract the args block
  // Find `args:` within the function definition
  const funcBodyStart = source.indexOf("{", matchStart + fullMatch.length - 1);
  if (funcBodyStart === -1) return null;

  // Find the args key in the object literal
  const argsSearchStart = funcBodyStart;
  const argsRe = /args:\s*\{/;
  const argsSlice = source.substring(argsSearchStart, argsSearchStart + 2000);
  const argsMatch = argsRe.exec(argsSlice);

  let argsStr = "{}";
  if (argsMatch) {
    const argsStart = argsSearchStart + argsMatch.index + argsMatch[0].length - 1;
    let depth = 0;
    let argsEnd = -1;
    for (let i = argsStart; i < source.length && i < argsStart + 3000; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) {
          argsEnd = i + 1;
          break;
        }
      }
    }
    if (argsEnd !== -1) {
      argsStr = source.substring(argsStart, argsEnd);
    }
  } else {
    // Check for `args: {}` (empty args)
    const emptyArgsRe = /args:\s*\{\s*\}/;
    if (emptyArgsRe.test(argsSlice)) {
      argsStr = "{}";
    }
  }

  return { name: funcName, fnType, args: formatArgs(argsStr), jsDoc };
}

/**
 * Convert a Convex args validator block to a TypeScript-like signature.
 */
function formatArgs(argsBlock: string): string {
  // Simple transform: replace v.string() etc. with TS types
  let formatted = argsBlock
    .replace(/v\.string\(\)/g, "string")
    .replace(/v\.number\(\)/g, "number")
    .replace(/v\.boolean\(\)/g, "boolean")
    .replace(/v\.float64\(\)/g, "number")
    .replace(/v\.int64\(\)/g, "number")
    .replace(/v\.any\(\)/g, "any")
    .replace(/v\.null\(\)/g, "null")
    .replace(/v\.bytes\(\)/g, "bytes");

  // v.id("tableName") -> Id<"tableName">
  formatted = formatted.replace(/v\.id\("(\w+)"\)/g, 'Id<"$1">');

  // v.optional(...) -> ... | undefined  (simplified: just remove the wrapper)
  // We'll do a simple approach: mark optional fields
  formatted = formatted.replace(/v\.optional\(([^)]+)\)/g, "$1 /* optional */");

  // v.array(TYPE) -> TYPE[]
  formatted = formatted.replace(/v\.array\(([^)]+)\)/g, "$1[]");

  // v.union(v.literal("a"), ...) -> "a" | "b" | ...
  formatted = formatted.replace(
    /v\.union\(\s*(v\.literal\([^)]+\)(?:\s*,\s*v\.literal\([^)]+\))*)\s*\)/g,
    (_match, group) => {
      const literals = group.match(/v\.literal\(([^)]+)\)/g);
      if (literals) {
        return literals
          .map((l: string) => {
            const inner = l.match(/v\.literal\(([^)]+)\)/);
            return inner ? inner[1] : l;
          })
          .join(" | ");
      }
      return group;
    },
  );

  // v.literal("x") remaining
  formatted = formatted.replace(/v\.literal\(([^)]+)\)/g, "$1");

  // v.object({...}) -> object
  formatted = formatted.replace(/v\.object\(\{[^}]*\}\)/g, "object");

  return formatted;
}

// ---------------------------------------------------------------------------
// MDX generation helpers
// ---------------------------------------------------------------------------

function escapeForTable(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/**
 * Wrap a type string in backticks if it contains angle brackets or other
 * characters that MDX would try to parse as JSX.
 */
function formatTypeForTable(s: string): string {
  const escaped = escapeForTable(s);
  // If the type contains < or { (e.g. Id<"programs">), wrap in backticks
  if (escaped.includes("<") || escaped.includes("{")) {
    return `\`${escaped}\``;
  }
  return escaped;
}

function generateSchemaPage(tableName: string, info: TableInfo): string {
  const desc = info.jsDoc ?? `Database table for ${tableName} records.`;

  let mdx = `---
title: "${tableName}"
description: "Schema reference for the ${tableName} table."
lastReviewed: "${TODAY}"
versionTag: latest
generatedFrom: "convex/schema.ts@${gitSha}"
---

{/* DO NOT EDIT — regenerate with: bun --cwd apps/docs run reference:gen */}

${desc}

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
`;

  for (const field of info.fields) {
    const typeStr = formatTypeForTable(field.type);
    const reqStr = field.required ? "Yes" : "No";
    let descStr = "";
    if (field.name === "orgId") descStr = "Organization ID for multi-tenant isolation";
    else if (field.name === "programId") descStr = "Parent program reference";
    else if (field.name === "workstreamId") descStr = "Parent workstream reference";
    mdx += `| ${field.name} | ${typeStr} | ${reqStr} | ${descStr} |\n`;
  }

  if (info.indexes.length > 0) {
    mdx += `\n## Indexes\n\n| Name | Fields |\n|------|--------|\n`;
    for (const idx of info.indexes) {
      mdx += `| ${idx.name} | ${idx.fields.join(", ")} |\n`;
    }
  }

  return mdx;
}

function generateFunctionPage(moduleName: string, func: FunctionInfo): string {
  const sourceFile = moduleName.includes("/")
    ? `convex/${moduleName}.ts`
    : `convex/${moduleName}.ts`;

  const descLine = func.jsDoc
    ? `${func.fnType} — ${func.jsDoc.split("\n")[0]}`
    : `${func.fnType} in ${sourceFile}`;

  let mdx = `---
title: "${moduleName}.${func.name}"
description: "${escapeForFrontmatter(descLine)}"
lastReviewed: "${TODAY}"
versionTag: latest
generatedFrom: "${sourceFile}@${gitSha}"
---

{/* DO NOT EDIT — regenerate with: bun --cwd apps/docs run reference:gen */}

import { Aside } from '@astrojs/starlight/components';

**Type:** \`${func.fnType}\`
**Module:** \`${sourceFile}\`

## Arguments

\`\`\`typescript
${func.args}
\`\`\`
`;

  if (func.jsDoc) {
    mdx += `\n${func.jsDoc}\n`;
  } else {
    mdx += `\n<Aside type="caution">This function is not yet documented. Contributions welcome.</Aside>\n`;
  }

  return mdx;
}

function escapeForFrontmatter(s: string): string {
  return s
    .replace(/\*\//g, "")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 200);
}

// ---------------------------------------------------------------------------
// Stale file cleanup
// ---------------------------------------------------------------------------

function cleanStaleFiles(dir: string, validNames: Set<string>) {
  if (!existsSync(dir)) return;
  const files = readdirSync(dir);
  for (const file of files) {
    if (file === "index.mdx") continue;
    if (!file.endsWith(".mdx")) continue;
    const name = file.replace(/\.mdx$/, "");
    if (!validNames.has(name)) {
      rmSync(join(dir, file));
      console.log(`  Removed stale: ${file}`);
    }
  }
}

function cleanStaleFunctionDirs(baseDir: string, validModules: Set<string>) {
  if (!existsSync(baseDir)) return;
  const entries = readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "index.mdx") continue;
    const fullPath = join(baseDir, entry.name);
    if (entry.isDirectory()) {
      // Check if this is a valid module directory
      const moduleName = entry.name;
      // Check if any valid module starts with this directory name
      const hasValidChild = [...validModules].some(
        (m) => m === moduleName || m.startsWith(`${moduleName}/`),
      );
      if (!hasValidChild) {
        rmSync(fullPath, { recursive: true });
        console.log(`  Removed stale dir: ${entry.name}/`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nFoundry Reference Generator`);
  console.log(`Git SHA: ${gitSha} | Date: ${TODAY}\n`);

  // Read all schema sources
  const schemaSource = readFileSafe(join(CONVEX_ROOT, "schema.ts"));
  if (!schemaSource) {
    console.error("ERROR: Could not read convex/schema.ts");
    process.exit(1);
  }

  // Also read imported schema files for tables defined externally
  const importedSchemas: Record<string, string> = {};
  const importRe = /import\s*\{([^}]+)\}\s*from\s*"\.\/([^"]+)"/g;
  let importMatch: RegExpExecArray | null;
  importMatch = importRe.exec(schemaSource);
  while (importMatch !== null) {
    const importPath = importMatch[2];
    const importedFile = readFileSafe(join(CONVEX_ROOT, `${importPath}.ts`));
    if (importedFile) {
      // Map each imported name to the source content
      const names = importMatch[1].split(",").map((n) => n.trim());
      for (const name of names) {
        if (name && !name.includes("Validator")) {
          importedSchemas[name] = importedFile;
        }
      }
    }
    importMatch = importRe.exec(schemaSource);
  }

  // Combine schema + imported schemas for table lookups
  const combinedSource =
    schemaSource +
    "\n\n// --- Imported schemas ---\n\n" +
    Object.values(importedSchemas).join("\n\n");

  // -----------------------------------------------------------------------
  // Phase 1: Generate schema pages
  // -----------------------------------------------------------------------

  console.log("--- Schema Reference ---");
  mkdirSync(SCHEMA_OUT, { recursive: true });

  const schemaStats = { generated: 0, skipped: 0 };
  const generatedTables: string[] = [];

  // Clean stale files
  cleanStaleFiles(SCHEMA_OUT, new Set(scope.tables));

  for (const tableName of scope.tables) {
    const tableBlock = findTableDefinition(combinedSource, tableName);
    if (!tableBlock) {
      console.warn(`  SKIP: ${tableName} — could not find defineTable block`);
      schemaStats.skipped++;
      continue;
    }

    const fields = extractFields(tableBlock);
    const indexes = extractIndexes(tableBlock);
    const jsDoc = extractTableJsDoc(combinedSource, tableName);

    const info: TableInfo = { fields, indexes, jsDoc };
    const mdx = generateSchemaPage(tableName, info);
    const outPath = join(SCHEMA_OUT, `${tableName}.mdx`);
    writeFileSync(outPath, mdx);
    generatedTables.push(tableName);
    schemaStats.generated++;
    console.log(`  OK: ${tableName} (${fields.length} fields, ${indexes.length} indexes)`);
  }

  // -----------------------------------------------------------------------
  // Phase 2: Generate function pages
  // -----------------------------------------------------------------------

  console.log("\n--- Functions Reference ---");
  mkdirSync(FUNCTIONS_OUT, { recursive: true });

  const funcStats = { generated: 0, skipped: 0 };
  const generatedFunctions: { module: string; name: string }[] = [];

  // Build set of valid module names for cleanup
  const validModules = new Set(Object.keys(scope.functions));
  cleanStaleFunctionDirs(FUNCTIONS_OUT, validModules);

  for (const [moduleName, funcNames] of Object.entries(scope.functions)) {
    const sourcePath = join(CONVEX_ROOT, `${moduleName}.ts`);
    const source = readFileSafe(sourcePath);
    if (!source) {
      console.warn(`  SKIP module: ${moduleName} — file not found at ${sourcePath}`);
      funcStats.skipped += funcNames.length;
      continue;
    }

    const moduleOutDir = join(FUNCTIONS_OUT, moduleName);
    mkdirSync(moduleOutDir, { recursive: true });

    // Clean stale files in module directory
    cleanStaleFiles(moduleOutDir, new Set(funcNames));

    for (const funcName of funcNames) {
      const funcInfo = extractFunction(source, funcName);
      if (!funcInfo) {
        console.warn(`  SKIP: ${moduleName}.${funcName} — could not parse export`);
        funcStats.skipped++;
        continue;
      }

      const mdx = generateFunctionPage(moduleName, funcInfo);
      const outPath = join(moduleOutDir, `${funcName}.mdx`);
      writeFileSync(outPath, mdx);
      generatedFunctions.push({ module: moduleName, name: funcName });
      funcStats.generated++;
    }

    console.log(`  OK: ${moduleName} (${funcNames.length} functions)`);
  }

  // -----------------------------------------------------------------------
  // Phase 3: Generate index pages
  // -----------------------------------------------------------------------

  console.log("\n--- Index Pages ---");

  // Schema index
  const schemaIndex = `---
title: Schema reference
description: Auto-generated schema reference for all documented Convex tables.
lastReviewed: "${TODAY}"
versionTag: latest
generatedFrom: "convex/schema.ts@${gitSha}"
---

{/* DO NOT EDIT — regenerate with: bun --cwd apps/docs run reference:gen */}

import { LinkCard, CardGrid } from '@astrojs/starlight/components';

This section contains auto-generated schema documentation for **${generatedTables.length}** Convex database tables
used by the Foundry platform. Each page describes fields, types, and indexes.

Generated from \`convex/schema.ts\` at commit \`${gitSha}\`.

## Tables

<CardGrid>
${generatedTables.map((t) => `  <LinkCard title="${t}" href="/reference/generated/schema/${t}/" />`).join("\n")}
</CardGrid>
`;
  writeFileSync(join(SCHEMA_OUT, "index.mdx"), schemaIndex);
  console.log("  OK: schema/index.mdx");

  // Functions index
  const moduleGroups = Object.entries(scope.functions)
    .map(([mod, funcs]) => {
      const generatedForModule = generatedFunctions.filter((f) => f.module === mod);
      if (generatedForModule.length === 0) return "";
      return `### ${mod}

| Function | Link |
|----------|------|
${generatedForModule.map((f) => `| \`${f.name}\` | [${mod}.${f.name}](/reference/generated/functions/${f.module}/${f.name}/) |`).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const functionsIndex = `---
title: Functions reference
description: Auto-generated reference for whitelisted public Convex queries, mutations, and actions.
lastReviewed: "${TODAY}"
versionTag: latest
generatedFrom: "convex/*.ts@${gitSha}"
---

{/* DO NOT EDIT — regenerate with: bun --cwd apps/docs run reference:gen */}

This section contains auto-generated documentation for **${generatedFunctions.length}** Convex functions
across **${Object.keys(scope.functions).length}** modules. Each page shows the function type, arguments, and any available documentation.

Generated from Convex source files at commit \`${gitSha}\`.

## Modules

${moduleGroups}
`;
  writeFileSync(join(FUNCTIONS_OUT, "index.mdx"), functionsIndex);
  console.log("  OK: functions/index.mdx");

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------

  console.log("\n=== Summary ===");
  console.log(`Schema:    ${schemaStats.generated} generated, ${schemaStats.skipped} skipped`);
  console.log(`Functions: ${funcStats.generated} generated, ${funcStats.skipped} skipped`);
  console.log(
    `Total:     ${schemaStats.generated + funcStats.generated} MDX files + 2 index pages\n`,
  );

  if (schemaStats.skipped > 0 || funcStats.skipped > 0) {
    console.log("Some items were skipped. Check warnings above for details.\n");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
