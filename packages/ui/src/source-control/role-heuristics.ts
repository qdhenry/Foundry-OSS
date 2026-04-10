import type { RepoRole } from "./types";

/**
 * Infer a likely repo role based on entity context.
 * Used for silent auto-assignment when connecting repos from non-Settings surfaces.
 */
export function inferRepoRole(context: {
  entityType?: "task" | "workstream" | "sandbox";
  workstreamName?: string;
  taskTitle?: string;
  repoLanguage?: string | null;
}): RepoRole {
  const text = [context.workstreamName ?? "", context.taskTitle ?? ""].join(" ").toLowerCase();

  if (/frontend|storefront|ui|checkout|cart|theme|headless/.test(text)) return "storefront";
  if (/integrat|api|middleware|connector/.test(text)) return "integration";
  if (/migrat|data|etl|import|export/.test(text)) return "data_migration";
  if (/infra|devops|ci|cd|deploy|pipeline|terraform|docker/.test(text)) return "infrastructure";
  if (/doc|readme|wiki|guide|onboard/.test(text)) return "documentation";
  if (/plugin|extension|addon|module/.test(text)) return "extension";

  const lang = (context.repoLanguage ?? "").toLowerCase();
  if (/typescript|javascript|css|html/.test(lang)) return "storefront";
  if (/python|java|go|rust/.test(lang)) return "integration";

  return "storefront";
}
