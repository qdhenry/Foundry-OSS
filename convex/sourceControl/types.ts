/**
 * Source Control Provider Abstraction Layer
 *
 * Provider-agnostic types for the source control integration.
 * V1 implements GitHub only; the interface supports future providers
 * (Azure DevOps, GitLab, Bitbucket) without platform code changes.
 */

// ---------------------------------------------------------------------------
// Provider type union
// ---------------------------------------------------------------------------

export type ProviderType = "github" | "azure_devops" | "gitlab" | "bitbucket";

// ---------------------------------------------------------------------------
// Repository roles (how a repo maps to a migration program)
// ---------------------------------------------------------------------------

export type RepositoryRole =
  | "storefront"
  | "integration"
  | "data_migration"
  | "infrastructure"
  | "extension"
  | "documentation";

// ---------------------------------------------------------------------------
// File tree
// ---------------------------------------------------------------------------

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size?: number;
  children?: FileTreeNode[];
}

// ---------------------------------------------------------------------------
// Code search
// ---------------------------------------------------------------------------

export interface CodeSearchResult {
  file: string;
  lineNumber: number;
  lineContent: string;
  matchHighlights: Array<{ start: number; end: number }>;
}

// ---------------------------------------------------------------------------
// Pull requests (normalized)
// ---------------------------------------------------------------------------

export interface NormalizedPR {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed" | "merged";
  isDraft: boolean;
  authorLogin: string;
  sourceBranch: string;
  targetBranch: string;
  reviewState: "none" | "pending" | "approved" | "changes_requested";
  ciStatus: "none" | "passing" | "failing" | "pending";
  commitCount: number;
  filesChanged: number;
  additions: number;
  deletions: number;
  createdAt: number;
  updatedAt: number;
  mergedAt: number | null;
  providerUrl: string;
}

// ---------------------------------------------------------------------------
// PR comments (normalized)
// ---------------------------------------------------------------------------

export interface NormalizedComment {
  id: number;
  authorLogin: string;
  body: string;
  path?: string;
  line?: number;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Review payload (outbound - what we send to the provider)
// ---------------------------------------------------------------------------

export interface ReviewPayload {
  body: string;
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  comments: Array<{
    path: string;
    line: number;
    body: string;
  }>;
}

// ---------------------------------------------------------------------------
// PR review result (structured AI review output)
// ---------------------------------------------------------------------------

export interface PRReviewResult {
  overall_assessment: "approve" | "request_changes" | "comment";
  requirement_alignment: {
    score: number;
    covered_criteria: string[];
    missing_criteria: string[];
    scope_concerns: string[];
  };
  platform_specific_issues: Array<{
    file: string;
    line: number;
    severity: "critical" | "warning" | "suggestion";
    issue: string;
    recommendation: string;
    pattern_source?: string;
  }>;
  migration_risks: Array<{
    risk: string;
    impact: string;
    mitigation: string;
  }>;
  pattern_matches: Array<{
    pattern_id: string;
    description: string;
    relevance: string;
    recommendation: string;
  }>;
  branch_deviation_note?: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Issues (normalized)
// ---------------------------------------------------------------------------

export interface NormalizedIssue {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  assignees: string[];
  labels: string[];
  url: string;
  createdAt: number;
  updatedAt: number;
}

export interface NormalizedIssueCreate {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export interface BranchComparison {
  aheadBy: number;
  behindBy: number;
  commits: NormalizedCommit[];
  files: Array<{
    filename: string;
    status: "added" | "removed" | "modified" | "renamed";
    additions: number;
    deletions: number;
  }>;
}

// ---------------------------------------------------------------------------
// CI/CD status (normalized)
// ---------------------------------------------------------------------------

export interface NormalizedCIStatus {
  state: "passing" | "failing" | "pending" | "none";
  checks: Array<{
    name: string;
    status: "success" | "failure" | "pending" | "neutral" | "skipped";
    conclusion: string | null;
    url: string | null;
  }>;
}

// ---------------------------------------------------------------------------
// Deployments (normalized)
// ---------------------------------------------------------------------------

export interface NormalizedDeployment {
  id: number;
  environment: string;
  status: "pending" | "in_progress" | "success" | "failure" | "error" | "inactive";
  sha: string;
  ref: string;
  deployedBy: string | null;
  deployedAt: number;
  completedAt: number | null;
}

// ---------------------------------------------------------------------------
// Commits (normalized)
// ---------------------------------------------------------------------------

export interface NormalizedCommit {
  sha: string;
  message: string;
  authorLogin: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  committedAt: number;
}

export interface CommitHistoryOptions {
  branch?: string;
  path?: string;
  since?: number;
  until?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// PR files (normalized)
// ---------------------------------------------------------------------------

export interface NormalizedPRFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  patch?: string;
}

// ---------------------------------------------------------------------------
// Collaborators (normalized)
// ---------------------------------------------------------------------------

export interface NormalizedCollaborator {
  login: string;
  avatarUrl: string;
  permissions: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export interface LabelInfo {
  name: string;
  color: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Webhook events (normalized)
// ---------------------------------------------------------------------------

export type NormalizedEventType =
  | "push"
  | "pull_request"
  | "pull_request_review"
  | "issues"
  | "issue_comment"
  | "deployment"
  | "deployment_status"
  | "workflow_run"
  | "installation"
  | "repository";

export interface NormalizedEvent {
  eventType: NormalizedEventType;
  action: string | null;
  entityType: "pr" | "issue" | "push" | "deployment" | "installation" | "repository";
  entityId: string;
  repoFullName: string | null;
  installationId: string;
  payload: unknown;
}

// ---------------------------------------------------------------------------
// Installation token
// ---------------------------------------------------------------------------

export interface InstallationToken {
  token: string;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Environment mapping
// ---------------------------------------------------------------------------

export interface EnvironmentMapping {
  development: string[];
  staging: string[];
  qa: string[];
  production: string[];
}

// ---------------------------------------------------------------------------
// Branch strategy recommendation
// ---------------------------------------------------------------------------

export interface BranchStrategyRecommendation {
  strategy_type: "feature_branches" | "workstream_branches" | "shared_integration" | "trunk_based";
  rationale: string;
  recommended_branches: Array<{
    branch_name: string;
    purpose: string;
    parent_branch: string;
    workstreams: string[];
    tasks: string[];
    merge_timing: string;
  }>;
  overlap_warnings: Array<{
    file_or_module: string;
    workstreams: string[];
    conflict_risk: "high" | "medium" | "low";
    recommendation: string;
  }>;
  merge_order: Array<{
    branch: string;
    merge_into: string;
    order: number;
    rationale: string;
  }>;
  integration_points: Array<{
    description: string;
    timing: string;
    branches_involved: string[];
  }>;
}

// ---------------------------------------------------------------------------
// Source Control Provider Interface
// ---------------------------------------------------------------------------

export interface SourceControlProvider {
  readonly providerType: ProviderType;

  // -- Connection / auth ---------------------------------------------------
  getInstallationToken(installationId: string): Promise<InstallationToken>;
  validateWebhook(headers: Headers, body: string): Promise<boolean>;

  // -- Repository operations -----------------------------------------------
  getRepoStructure(repoId: string, path?: string): Promise<FileTreeNode[]>;
  getFileContents(repoId: string, path: string, ref?: string): Promise<string>;
  searchCode(repoId: string, query: string): Promise<CodeSearchResult[]>;

  // -- Pull request operations ---------------------------------------------
  getPullRequest(repoId: string, prNumber: number): Promise<NormalizedPR>;
  getPullRequestDiff(repoId: string, prNumber: number): Promise<string>;
  getPullRequestComments(repoId: string, prNumber: number): Promise<NormalizedComment[]>;
  postPullRequestReview(
    repoId: string,
    prNumber: number,
    review: ReviewPayload,
  ): Promise<{ reviewId: number }>;
  createPullRequest(
    repoId: string,
    head: string,
    base: string,
    title: string,
    body: string,
    draft?: boolean,
  ): Promise<NormalizedPR>;
  updatePullRequest(
    repoId: string,
    prNumber: number,
    updates: { title?: string; body?: string; state?: "open" | "closed"; draft?: boolean },
  ): Promise<NormalizedPR>;
  mergePullRequest(
    repoId: string,
    prNumber: number,
    strategy: "merge" | "squash" | "rebase",
    commitTitle?: string,
  ): Promise<void>;
  requestReviewers(repoId: string, prNumber: number, reviewers: string[]): Promise<void>;
  getRepoCollaborators(repoId: string): Promise<NormalizedCollaborator[]>;
  getPullRequestFiles(repoId: string, prNumber: number): Promise<NormalizedPRFile[]>;

  // -- Issue operations ----------------------------------------------------
  createIssue(repoId: string, issue: NormalizedIssueCreate): Promise<NormalizedIssue>;
  updateIssue(
    repoId: string,
    issueNumber: number,
    updates: Partial<NormalizedIssueCreate>,
  ): Promise<void>;
  getIssue(repoId: string, issueNumber: number): Promise<NormalizedIssue>;

  // -- Branch operations ---------------------------------------------------
  branchExists(repoId: string, branch: string): Promise<boolean>;
  createBranch(repoId: string, branchName: string, fromRef: string): Promise<void>;
  compareBranches(repoId: string, base: string, head: string): Promise<BranchComparison>;

  // -- CI/CD operations ----------------------------------------------------
  getCIStatus(repoId: string, ref: string): Promise<NormalizedCIStatus>;
  getDeployments(repoId: string, environment?: string): Promise<NormalizedDeployment[]>;

  // -- Commit operations ---------------------------------------------------
  getCommitHistory(repoId: string, options: CommitHistoryOptions): Promise<NormalizedCommit[]>;
  getCommitsBetween(repoId: string, baseSha: string, headSha: string): Promise<NormalizedCommit[]>;

  // -- Labels & milestones -------------------------------------------------
  ensureLabel(repoId: string, name: string, color: string, description?: string): Promise<void>;
  createTaskListIssue(
    repoId: string,
    title: string,
    childIssueNumbers: number[],
  ): Promise<NormalizedIssue>;

  // -- Repository creation (template provisioning) ----------------------------
  createRepoWithContent(
    owner: string,
    repoName: string,
    description: string,
    files: Array<{ path: string; content: string; encoding?: "utf-8" | "base64" }>,
    isPrivate: boolean,
  ): Promise<{
    repoFullName: string;
    defaultBranch: string;
    htmlUrl: string;
    repoId: number;
  }>;

  // -- Webhook normalization -----------------------------------------------
  normalizeWebhookEvent(eventType: string, payload: unknown): NormalizedEvent;
}
