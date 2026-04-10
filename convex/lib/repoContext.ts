import * as generatedApi from "../_generated/api";

const internalApi: any = (generatedApi as any).internal;

/**
 * Repo context helpers for AI prompt assembly.
 * Used from internalActions (Node.js runtime) to fetch repository structure
 * from the linked GitHub repository via the source control MCP server.
 */

interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size?: number;
  children?: FileTreeNode[];
}

/**
 * Format a flat file tree into an indented string suitable for AI prompts.
 */
function formatFileTree(nodes: FileTreeNode[], indent = ""): string {
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.type === "directory") {
      lines.push(`${indent}${node.name}/`);
      if (node.children) {
        lines.push(formatFileTree(node.children, `${indent}  `));
      }
    } else {
      lines.push(`${indent}${node.name}`);
    }
  }
  return lines.join("\n");
}

/**
 * Get formatted repository structure for a program's linked repositories.
 * Returns a string suitable for embedding in AI prompts, or null if no repos are linked.
 *
 * Used by subtask generation (Level 2) — fetches full structure.
 */
export async function getRepoStructureForTask(ctx: any, programId: string): Promise<string | null> {
  return getRepoStructureForProgram(ctx, programId);
}

/**
 * Get formatted repository structure for a program.
 * Returns a string suitable for embedding in AI prompts, or null if no repos are linked.
 *
 * Used by both Level 1 (task decomposition) and Level 2 (subtask generation).
 */
export async function getRepoStructureForProgram(
  ctx: any,
  programId: string,
): Promise<string | null> {
  try {
    const repos = await ctx.runQuery(internalApi.sourceControl.repositories.listByProgramInternal, {
      programId,
    });

    if (!repos || repos.length === 0) {
      return null;
    }

    const sections: string[] = [];

    for (const repo of repos) {
      try {
        const tree: FileTreeNode[] = await ctx.runAction(
          internalApi.sourceControl.mcp.sourceControlMcpServer.getRepoStructure,
          { repositoryId: repo._id },
        );

        if (tree && tree.length > 0) {
          const formatted = formatFileTree(tree);
          sections.push(
            `Repository: ${repo.repoFullName} (${repo.role ?? "unknown"})` +
              `\nDefault branch: ${repo.defaultBranch ?? "main"}` +
              `\nLanguage: ${repo.language ?? "unknown"}` +
              `\n\n${formatted}`,
          );
        }
      } catch {
        // If a single repo fails (e.g. token expired), skip it gracefully
        sections.push(`Repository: ${repo.repoFullName} (structure unavailable)`);
      }
    }

    return sections.length > 0 ? sections.join("\n\n---\n\n") : null;
  } catch {
    // Graceful fallback — don't fail subtask generation if repo fetch fails
    return null;
  }
}
