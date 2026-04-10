import { Hono } from "hono";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service";
import type { Env } from "../types";

const GraphNodeSchema = z.object({
  nodeType: z.enum(["file", "function", "class", "module"]),
  name: z.string(),
  filePath: z.string(),
  layer: z.enum(["api", "service", "data", "ui", "utility", "config", "test"]),
  description: z.string(),
  language: z.string(),
  lineStart: z.number().optional(),
  lineEnd: z.number().optional(),
});

const GraphEdgeSchema = z.object({
  sourceIndex: z.number(),
  targetIndex: z.number(),
  edgeType: z.enum(["imports", "calls", "extends", "implements", "contains"]),
});

const TourStepSchema = z.object({
  nodeIndex: z.number(),
  title: z.string(),
  explanation: z.string(),
  order: z.number(),
});

const AnalysisResultSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  summary: z.object({
    totalFiles: z.number(),
    totalFunctions: z.number(),
    totalClasses: z.number(),
    languages: z.array(z.string()),
    frameworks: z.array(z.string()),
    layerBreakdown: z.array(z.object({ layer: z.string(), count: z.number() })),
  }),
  tours: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      steps: z.array(TourStepSchema),
    }),
  ),
});

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  const { repoUrl, accessToken } = await c.req.json();
  const orgId = c.req.header("x-org-id") ?? "unknown";

  if (!repoUrl) {
    return c.json({ error: { code: "MISSING_REPO_URL", message: "repoUrl is required" } }, 400);
  }

  // Extract owner/repo from GitHub URL
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    return c.json(
      { error: { code: "INVALID_REPO_URL", message: "Must be a valid GitHub repository URL" } },
      400,
    );
  }
  const [, owner, repo] = match;
  const repoName = `${owner}/${repo.replace(/\.git$/, "")}`;

  // Fetch repo file tree via GitHub API
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Foundry-Agent-Worker",
  };
  if (accessToken) {
    headers.Authorization = `token ${accessToken}`;
  }

  const treeResponse = await fetch(
    `https://api.github.com/repos/${repoName}/git/trees/HEAD?recursive=1`,
    { headers },
  );

  if (!treeResponse.ok) {
    return c.json(
      {
        error: {
          code: "GITHUB_API_ERROR",
          message: `Failed to fetch repo tree: ${treeResponse.status} ${treeResponse.statusText}`,
        },
      },
      502,
    );
  }

  const treeData = (await treeResponse.json()) as {
    tree: Array<{ path: string; type: string; size?: number }>;
  };

  // Filter to source files only (skip binaries, node_modules, etc.)
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

  // Fetch a sample of key files for deeper analysis (up to 30 files)
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
  const keyFiles = sourceFiles
    .filter((f) => keyExtensions.some((ext) => f.endsWith(ext)))
    .slice(0, 30);

  const fileContents: Array<{ path: string; content: string }> = [];
  for (const filePath of keyFiles) {
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

  const systemPrompt = `You are an expert codebase architecture analyzer. Analyze the provided repository structure and source files, then produce a comprehensive knowledge graph.

Organization: ${orgId}
Repository: ${repoName}

Your analysis must follow the Understand-Anything methodology:
1. **Project Scanning** — Identify languages, frameworks, and project structure
2. **File Analysis** — Extract functions, classes, imports, and build graph nodes
3. **Architecture Analysis** — Classify nodes into architectural layers (api, service, data, ui, utility, config, test)
4. **Tour Building** — Create 1-3 guided walkthroughs that teach the architecture
5. **Graph Review** — Validate completeness and add missing relationships

For each node, provide a clear plain-English description of what it does.
For edges, identify import/call/extend/implement/contain relationships between nodes.
For tours, create meaningful learning paths ordered by dependency depth.

Node indices in edges and tour steps reference the position in the nodes array (0-based).

Respond with valid JSON matching the required schema.`;

  const fileTreeSummary = sourceFiles.join("\n");
  const fileContentsSummary = fileContents
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");

  const prompt = `Analyze this repository and produce a knowledge graph.

## File Tree (${sourceFiles.length} source files)
${fileTreeSummary}

## Key File Contents (${fileContents.length} files sampled)
${fileContentsSummary}

Produce a comprehensive knowledge graph with nodes, edges, summary statistics, and architecture tours.`;

  const result = await runAgentQuery(
    AnalysisResultSchema,
    {
      prompt,
      systemPrompt,
      maxThinkingTokens: 8000,
    },
    c.env.ANTHROPIC_API_KEY,
  );

  return c.json({ analysis: result.data, metadata: result.metadata });
});

export { app as analyzeCodebaseRoute };
