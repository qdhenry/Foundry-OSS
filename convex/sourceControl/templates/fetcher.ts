"use node";

import type { GitHubProvider } from "../providers/github";

// ---------------------------------------------------------------------------
// Files/directories to exclude when fetching template content
// ---------------------------------------------------------------------------

const EXCLUDE_PATHS = new Set([
  "template.json",
  ".git",
  "node_modules",
  "bun.lock",
  ".DS_Store",
  ".sf",
  ".sfdx",
]);

function shouldExclude(path: string): boolean {
  // Check exact match or if the path starts with an excluded directory
  for (const excluded of EXCLUDE_PATHS) {
    if (path === excluded || path.startsWith(`${excluded}/`)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Recursively collect all file paths from repo structure
// ---------------------------------------------------------------------------

async function collectFilePaths(
  provider: GitHubProvider,
  repoId: string,
  path: string,
): Promise<string[]> {
  const entries = await provider.getRepoStructure(repoId, path || undefined);
  const filePaths: string[] = [];

  for (const entry of entries) {
    if (shouldExclude(entry.path)) continue;

    if (entry.type === "file") {
      filePaths.push(entry.path);
    } else if (entry.type === "directory") {
      const children = await collectFilePaths(provider, repoId, entry.path);
      filePaths.push(...children);
    }
  }

  return filePaths;
}

// ---------------------------------------------------------------------------
// Fetch template manifest (template.json)
// ---------------------------------------------------------------------------

export interface TemplateManifest {
  name: string;
  version: string;
  platform: string;
  description: string;
  variables: {
    required: string[];
    optional: string[];
  };
  defaults: Record<string, string>;
}

export async function fetchTemplateManifest(
  provider: GitHubProvider,
  templateRepoFullName: string,
  ref?: string,
): Promise<TemplateManifest> {
  const content = await provider.getFileContents(templateRepoFullName, "template.json", ref);
  return JSON.parse(content);
}

// ---------------------------------------------------------------------------
// Fetch all template files from the template repo
// ---------------------------------------------------------------------------

export async function fetchTemplateFiles(
  provider: GitHubProvider,
  templateRepoFullName: string,
  ref?: string,
): Promise<Array<{ path: string; content: string }>> {
  // 1. Collect all file paths (excluding template.json and ignored dirs)
  const filePaths = await collectFilePaths(provider, templateRepoFullName, "");

  // 2. Fetch content for each file (in batches to avoid rate limits)
  const BATCH_SIZE = 10;
  const files: Array<{ path: string; content: string }> = [];

  for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
    const batch = filePaths.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (filePath) => {
        try {
          const content = await provider.getFileContents(templateRepoFullName, filePath, ref);
          return { path: filePath, content };
        } catch (err) {
          console.warn(`Failed to fetch ${filePath}:`, err);
          return null;
        }
      }),
    );
    files.push(...(results.filter(Boolean) as Array<{ path: string; content: string }>));
  }

  return files;
}
