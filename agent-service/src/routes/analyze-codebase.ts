import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service.js";
import { type CodeEntity, extractEntities, languageFromExtension } from "../lib/ast-chunker.js";
import { embedBatch, formatEntityForEmbedding } from "../lib/embeddings.js";

// ---------------------------------------------------------------------------
// Lenient enum helper — normalize LLM output variance
// ---------------------------------------------------------------------------
const NODE_TYPES = ["file", "function", "class", "module"] as const;
const LAYERS = ["api", "service", "data", "ui", "utility", "config", "test"] as const;
const EDGE_TYPES = ["imports", "calls", "extends", "implements", "contains"] as const;

function closestEnum<T extends string>(value: string, values: readonly T[], fallback: T): T {
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, "_");
  if ((values as readonly string[]).includes(normalized)) return normalized as T;
  // Fuzzy: check if any enum value is a substring or vice versa
  for (const v of values) {
    if (normalized.includes(v) || v.includes(normalized)) return v;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Raw schema — accepts whatever Claude returns with minimal validation
// ---------------------------------------------------------------------------
const RawResponseSchema = z.object({
  nodes: z.array(z.any()),
  edges: z.array(z.any()).optional(),
  summary: z.any().optional(),
  tours: z.array(z.any()).optional(),
});

// ---------------------------------------------------------------------------
// Normalizer — transforms raw Claude output to expected format
// ---------------------------------------------------------------------------
function normalizeAnalysis(raw: any) {
  // Build a node-id-to-index map for edge resolution
  const nodeIdMap = new Map<string, number>();
  const rawEdges = raw.edges ?? [];
  const rawTours = raw.tours ?? [];
  const rawSummary = raw.summary ?? {};

  const nodes = raw.nodes.map((n: any, i: number) => {
    if (n.id) nodeIdMap.set(String(n.id), i);
    if (n.name) nodeIdMap.set(String(n.name), i);

    const rawType = String(n.nodeType || n.node_type || n.type || "file");
    const rawLayer = String(n.layer || n.architectural_layer || "utility");
    const metadata = n.metadata || {};

    return {
      nodeType: closestEnum(rawType, NODE_TYPES, "file"),
      name: String(n.name || n.label || n.id || "unknown"),
      filePath: String(
        n.filePath || n.file_path || n.file || n.path || metadata.file || metadata.path || "",
      ),
      layer: closestEnum(rawLayer, LAYERS, "utility"),
      description: String(n.description || ""),
      language: String(n.language || n.lang || metadata.language || "unknown"),
      lineStart: n.lineStart ?? n.line_start ?? metadata.line_start,
      lineEnd: n.lineEnd ?? n.line_end ?? metadata.line_end,
    };
  });

  const edges = rawEdges.map((e: any) => {
    let sourceIndex: number;
    let targetIndex: number;

    if (typeof e.sourceIndex === "number") {
      sourceIndex = e.sourceIndex;
      targetIndex = e.targetIndex ?? 0;
    } else if (typeof e.source_index === "number") {
      sourceIndex = e.source_index;
      targetIndex = e.target_index ?? 0;
    } else {
      // Resolve by node ID/name (Claude uses "from"/"to" with node IDs)
      const fromKey = String(e.from ?? e.source ?? "");
      const toKey = String(e.to ?? e.target ?? "");
      sourceIndex = nodeIdMap.get(fromKey) ?? 0;
      targetIndex = nodeIdMap.get(toKey) ?? 0;
    }

    const rawEdgeType = String(e.edgeType || e.edge_type || e.relationship || e.type || "imports");

    return {
      sourceIndex,
      targetIndex,
      edgeType: closestEnum(rawEdgeType, EDGE_TYPES, "imports"),
    };
  });

  const s = rawSummary;
  const summary = {
    totalFiles: Number(
      s.totalFiles ?? s.total_files ?? nodes.filter((n: any) => n.nodeType === "file").length,
    ),
    totalFunctions: Number(
      s.totalFunctions ??
        s.total_functions ??
        nodes.filter((n: any) => n.nodeType === "function").length,
    ),
    totalClasses: Number(
      s.totalClasses ?? s.total_classes ?? nodes.filter((n: any) => n.nodeType === "class").length,
    ),
    languages: Array.isArray(s.languages)
      ? s.languages.map(String)
      : Array.isArray(s.key_technologies)
        ? s.key_technologies.map(String)
        : [],
    frameworks: Array.isArray(s.frameworks) ? s.frameworks.map(String) : [],
    layerBreakdown: Array.isArray(s.layerBreakdown)
      ? s.layerBreakdown
      : Array.isArray(s.layer_breakdown)
        ? s.layer_breakdown
        : Array.isArray(s.architectural_layers)
          ? (s.architectural_layers as any[]).map((l: any) => ({
              layer: String(l.layer || l.name || "utility"),
              count: Number(l.count || l.node_count || 0),
            }))
          : [],
  };

  const tours = rawTours.map((t: any) => ({
    title: String(t.title || t.name || "Tour"),
    description: String(t.description || ""),
    steps: Array.isArray(t.steps)
      ? t.steps.map((step: any, i: number) => ({
          nodeIndex: Number(
            step.nodeIndex ??
              step.node_index ??
              step.node_id ??
              nodeIdMap.get(String(step.node || "")) ??
              0,
          ),
          title: String(step.title || step.name || `Step ${i + 1}`),
          explanation: String(step.explanation || step.description || ""),
          order: Number(step.order ?? i),
        }))
      : [],
  }));

  return { nodes, edges, summary, tours };
}

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { repoUrl, accessToken } = req.body;
    const orgId = req.headers["x-org-id"] as string;

    if (!repoUrl) {
      res.status(400).json({ error: { code: "MISSING_REPO_URL", message: "repoUrl is required" } });
      return;
    }

    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      res.status(400).json({
        error: { code: "INVALID_REPO_URL", message: "Must be a valid GitHub repository URL" },
      });
      return;
    }
    const [, owner, repo] = match;
    const repoName = `${owner}/${repo.replace(/\.git$/, "")}`;

    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Foundry-Agent-Service",
    };
    if (accessToken) {
      headers.Authorization = `token ${accessToken}`;
    }

    const treeResponse = await fetch(
      `https://api.github.com/repos/${repoName}/git/trees/HEAD?recursive=1`,
      { headers },
    );

    if (!treeResponse.ok) {
      res.status(502).json({
        error: {
          code: "GITHUB_API_ERROR",
          message: `Failed to fetch repo tree: ${treeResponse.status} ${treeResponse.statusText}`,
        },
      });
      return;
    }

    const treeData = (await treeResponse.json()) as {
      tree: Array<{ path: string; type: string; size?: number }>;
    };

    const sourceFiles = treeData.tree
      .filter(
        (f) =>
          f.type === "blob" &&
          !f.path.includes("node_modules/") &&
          !f.path.includes(".git/") &&
          !f.path.includes("dist/") &&
          !f.path.includes("build/") &&
          !f.path.startsWith(".") &&
          (f.size ?? 0) < 100_000,
      )
      .map((f) => f.path);

    const keyExtensions = [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".py",
      ".rs",
      ".go",
      ".java",
      ".rb",
      ".vue",
      ".svelte",
    ];
    const allKeyFiles = sourceFiles.filter((f) => keyExtensions.some((ext) => f.endsWith(ext)));
    // LLM prompt sample: first 30 files, truncated to 3KB each
    const promptSampleFiles = allKeyFiles.slice(0, 30);

    const fileContents: Array<{ path: string; content: string }> = [];
    for (const filePath of promptSampleFiles) {
      try {
        const fileResp = await fetch(
          `https://api.github.com/repos/${repoName}/contents/${filePath}`,
          { headers },
        );
        if (fileResp.ok) {
          const fileData = (await fileResp.json()) as { content?: string; encoding?: string };
          if (fileData.content && fileData.encoding === "base64") {
            const decoded = atob(fileData.content.replace(/\n/g, ""));
            fileContents.push({ path: filePath, content: decoded.slice(0, 3000) });
          }
        }
      } catch {
        // Skip files that can't be fetched
      }
    }

    const systemPrompt = `You are an expert codebase architecture analyzer. Analyze the provided repository and produce a knowledge graph as JSON.

Organization: ${orgId ?? "unknown"}
Repository: ${repoName}

You MUST respond with a single JSON object (no markdown fences) with this EXACT structure:

{
  "nodes": [
    {
      "nodeType": "file" | "function" | "class" | "module",
      "name": "string",
      "filePath": "string (path in repo)",
      "layer": "api" | "service" | "data" | "ui" | "utility" | "config" | "test",
      "description": "string",
      "language": "string"
    }
  ],
  "edges": [
    {
      "sourceIndex": 0,
      "targetIndex": 1,
      "edgeType": "imports" | "calls" | "extends" | "implements" | "contains"
    }
  ],
  "summary": {
    "totalFiles": 0,
    "totalFunctions": 0,
    "totalClasses": 0,
    "languages": ["typescript"],
    "frameworks": ["react"],
    "layerBreakdown": [{"layer": "ui", "count": 5}]
  },
  "tours": [
    {
      "title": "string",
      "description": "string",
      "steps": [
        {"nodeIndex": 0, "title": "string", "explanation": "string", "order": 0}
      ]
    }
  ]
}

IMPORTANT:
- sourceIndex and targetIndex in edges are 0-based indices into the nodes array
- nodeIndex in tour steps is a 0-based index into the nodes array
- Include 10-40 nodes covering the most important files, functions, and classes
- Include edges for import/call/extend relationships
- Create 1-3 tours that teach the architecture`;

    const fileTreeSummary = sourceFiles.join("\n");
    const fileContentsSummary = fileContents
      .map((f) => `--- ${f.path} ---\n${f.content}`)
      .join("\n\n");

    const prompt = `Analyze this repository and produce a knowledge graph.

## File Tree (${sourceFiles.length} source files)
${fileTreeSummary}

## Key File Contents (${fileContents.length} files sampled)
${fileContentsSummary}`;

    const result = await runAgentQuery(RawResponseSchema, {
      prompt,
      systemPrompt,
      maxThinkingTokens: 8000,
    });

    const analysis = normalizeAnalysis(result.data);

    // --- Entity extraction + embedding (from full source set, not LLM sample) ---
    const allEntities: Array<CodeEntity & { filePath: string; embedding: number[] }> = [];

    // Fetch full file contents for all key files (not truncated) for AST parsing
    // Limit to 200 files to stay within reasonable API limits
    const entityFiles = allKeyFiles.slice(0, 200);
    const entityFileContents: Array<{ path: string; content: string }> = [];

    // Fetch in batches of 10 to avoid overwhelming the API
    for (let i = 0; i < entityFiles.length; i += 10) {
      const batch = entityFiles.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (filePath) => {
          const fileResp = await fetch(
            `https://api.github.com/repos/${repoName}/contents/${filePath}`,
            { headers },
          );
          if (!fileResp.ok) return null;
          const fileData = (await fileResp.json()) as { content?: string; encoding?: string };
          if (fileData.content && fileData.encoding === "base64") {
            return { path: filePath, content: atob(fileData.content.replace(/\n/g, "")) };
          }
          return null;
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          entityFileContents.push(r.value);
        }
      }
    }

    for (const file of entityFileContents) {
      const ext = path.extname(file.path);
      const language = languageFromExtension(ext);
      if (!language) continue;

      try {
        const entities = await extractEntities(file.content, language);
        for (const entity of entities) {
          allEntities.push({ ...entity, filePath: file.path, embedding: [] });
        }
      } catch (err) {
        console.warn(
          `[ast-chunker] Failed to parse ${file.path}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (allEntities.length > 0) {
      try {
        const texts = allEntities.map((e) =>
          formatEntityForEmbedding({
            type: e.type,
            name: e.name,
            signature: e.signature,
            docstring: e.docstring,
            filePath: e.filePath,
          }),
        );
        const embeddings = await embedBatch(texts);
        for (let i = 0; i < allEntities.length; i++) {
          allEntities[i].embedding = embeddings[i];
        }
      } catch (err) {
        console.warn(
          "[embeddings] Failed to generate embeddings:",
          err instanceof Error ? err.message : err,
        );
      }
    }

    const entities = allEntities.map((e) => ({
      type: e.type,
      name: e.name,
      filePath: e.filePath,
      lineStart: e.lineStart,
      lineEnd: e.lineEnd,
      signature: e.signature,
      docstring: e.docstring,
      bodyPreview: e.body.slice(0, 500),
      embedding: e.embedding,
    }));

    res.json({
      analysis: { ...analysis, entities },
      metadata: {
        ...result.metadata,
        fileCount: sourceFiles.length,
        sampledFileCount: fileContents.length,
        entityFileCount: entityFileContents.length,
        entityCount: entities.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

export { router as analyzeCodebaseRouter };
