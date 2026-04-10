import { createRequire } from "node:module";
import path from "node:path";
import Parser from "web-tree-sitter";

export interface CodeEntity {
  type: "function" | "class" | "method" | "interface" | "type_alias" | "arrow_function";
  name: string;
  lineStart: number;
  lineEnd: number;
  signature: string;
  body: string;
  docstring: string | null;
}

const LANGUAGE_MAP: Record<string, string> = {
  typescript: "tree-sitter-typescript",
  tsx: "tree-sitter-tsx",
  javascript: "tree-sitter-javascript",
  jsx: "tree-sitter-javascript",
  python: "tree-sitter-python",
  go: "tree-sitter-go",
  rust: "tree-sitter-rust",
  java: "tree-sitter-java",
};

const ENTITY_NODE_TYPES = new Set([
  "function_declaration",
  "class_declaration",
  "method_definition",
  "interface_declaration",
  "type_alias_declaration",
  // Python
  "function_definition",
  "class_definition",
  // Go
  "method_declaration",
  "type_declaration",
]);

let parserInitialized = false;
const languageCache = new Map<string, Parser.Language>();

async function ensureParserInit(): Promise<void> {
  if (parserInitialized) return;
  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve("web-tree-sitter/tree-sitter.wasm");
  await Parser.init({ locateFile: () => wasmPath });
  parserInitialized = true;
}

async function getLanguage(language: string): Promise<Parser.Language> {
  const cached = languageCache.get(language);
  if (cached) return cached;

  const wasmFile = LANGUAGE_MAP[language];
  if (!wasmFile) {
    throw new Error(
      `Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGE_MAP).join(", ")}`,
    );
  }

  const require = createRequire(import.meta.url);
  const wasmDir = path.dirname(require.resolve("tree-sitter-wasms/package.json"));
  const wasmPath = path.join(wasmDir, "out", `${wasmFile}.wasm`);

  const lang = await Parser.Language.load(wasmPath);
  languageCache.set(language, lang);
  return lang;
}

function mapNodeType(nodeType: string): CodeEntity["type"] {
  switch (nodeType) {
    case "function_declaration":
    case "function_definition":
      return "function";
    case "class_declaration":
    case "class_definition":
      return "class";
    case "method_definition":
    case "method_declaration":
      return "method";
    case "interface_declaration":
      return "interface";
    case "type_alias_declaration":
    case "type_declaration":
      return "type_alias";
    default:
      return "function";
  }
}

function extractName(node: Parser.SyntaxNode): string | null {
  const nameNode = node.childForFieldName("name");
  if (nameNode) return nameNode.text;

  // For Go type_declaration, the actual type spec is nested
  if (node.type === "type_declaration") {
    const spec = node.namedChildren[0];
    if (spec) {
      const specName = spec.childForFieldName("name");
      if (specName) return specName.text;
    }
  }

  return null;
}

function extractDocstring(node: Parser.SyntaxNode): string | null {
  const prev = node.previousNamedSibling;
  if (!prev) return null;

  if (prev.type === "comment" || prev.type === "block_comment") {
    const text = prev.text.trim();
    return text
      .replace(/^\/\*\*?\s*/, "")
      .replace(/\s*\*\/$/, "")
      .replace(/^\/\/\s?/gm, "")
      .replace(/^\s*\*\s?/gm, "")
      .trim();
  }

  // Python docstrings are the first expression_statement child of the body
  if (node.type === "function_definition" || node.type === "class_definition") {
    const body = node.childForFieldName("body");
    if (body) {
      const firstChild = body.namedChildren[0];
      if (firstChild?.type === "expression_statement") {
        const str = firstChild.namedChildren[0];
        if (str?.type === "string" || str?.type === "concatenated_string") {
          return str.text.replace(/^["']{1,3}|["']{1,3}$/g, "").trim();
        }
      }
    }
  }

  return null;
}

function isArrowFunctionAssignment(node: Parser.SyntaxNode): boolean {
  if (node.type !== "lexical_declaration" && node.type !== "variable_declaration") return false;
  const declarator = node.namedChildren.find((c) => c.type === "variable_declarator");
  if (!declarator) return false;
  const value = declarator.childForFieldName("value");
  return value?.type === "arrow_function" || value?.type === "function";
}

function extractArrowFunctionEntity(node: Parser.SyntaxNode): CodeEntity | null {
  const declarator = node.namedChildren.find((c) => c.type === "variable_declarator");
  if (!declarator) return null;
  const nameNode = declarator.childForFieldName("name");
  if (!nameNode) return null;

  const fullText = node.text;
  return {
    type: "arrow_function",
    name: nameNode.text,
    lineStart: node.startPosition.row + 1,
    lineEnd: node.endPosition.row + 1,
    signature: fullText.split("\n")[0],
    body: fullText.slice(0, 2000),
    docstring: extractDocstring(node),
  };
}

export async function extractEntities(source: string, language: string): Promise<CodeEntity[]> {
  await ensureParserInit();

  const lang = await getLanguage(language);
  const parser = new Parser();
  parser.setLanguage(lang);

  const tree = parser.parse(source);
  const entities: CodeEntity[] = [];
  const cursor = tree.walk();

  function visit(): void {
    const node = cursor.currentNode;

    if (isArrowFunctionAssignment(node)) {
      const entity = extractArrowFunctionEntity(node);
      if (entity) entities.push(entity);
    } else if (ENTITY_NODE_TYPES.has(node.type)) {
      const name = extractName(node);
      if (name) {
        const fullText = node.text;
        entities.push({
          type: mapNodeType(node.type),
          name,
          lineStart: node.startPosition.row + 1,
          lineEnd: node.endPosition.row + 1,
          signature: fullText.split("\n")[0],
          body: fullText.slice(0, 2000),
          docstring: extractDocstring(node),
        });
      }
      // For classes, recurse to find methods
      if (node.type === "class_declaration" || node.type === "class_definition") {
        if (cursor.gotoFirstChild()) {
          do {
            visit();
          } while (cursor.gotoNextSibling());
          cursor.gotoParent();
        }
      }
    } else {
      if (cursor.gotoFirstChild()) {
        do {
          visit();
        } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    }
  }

  visit();

  cursor.delete();
  tree.delete();
  parser.delete();

  return entities;
}

/** Map file extension to language name */
export function languageFromExtension(ext: string): string | null {
  const map: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
  };
  return map[ext] ?? null;
}
