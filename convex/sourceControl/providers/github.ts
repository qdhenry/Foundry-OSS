"use node";

import { createHmac, createSign, timingSafeEqual } from "node:crypto";
import type {
  BranchComparison,
  CodeSearchResult,
  CommitHistoryOptions,
  FileTreeNode,
  InstallationToken,
  NormalizedCIStatus,
  NormalizedCollaborator,
  NormalizedComment,
  NormalizedCommit,
  NormalizedDeployment,
  NormalizedEvent,
  NormalizedEventType,
  NormalizedIssue,
  NormalizedIssueCreate,
  NormalizedPR,
  NormalizedPRFile,
  ReviewPayload,
  SourceControlProvider,
} from "../types";

const GITHUB_API = "https://api.github.com";

// ---------------------------------------------------------------------------
// GitHub Provider
// ---------------------------------------------------------------------------

export class GitHubProvider implements SourceControlProvider {
  readonly providerType = "github" as const;
  private token: string | null = null;

  /** Set the installation token for authenticated API calls. */
  setToken(token: string): void {
    this.token = token;
  }

  /** Get the current installation token. */
  getToken(): string {
    if (!this.token) {
      throw new Error("No installation token set. Call setToken() first.");
    }
    return this.token;
  }

  // =========================================================================
  // Connection / auth
  // =========================================================================

  async getInstallationToken(installationId: string): Promise<InstallationToken> {
    const jwt = this.createAppJWT();

    const res = await this.request(
      `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    return {
      token: res.token,
      expiresAt: new Date(res.expires_at).getTime(),
    };
  }

  async validateWebhook(headers: Headers, body: string): Promise<boolean> {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return false;

    const signature = headers.get("x-hub-signature-256");
    if (!signature) return false;

    const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  // =========================================================================
  // Repository operations
  // =========================================================================

  async getRepoStructure(repoId: string, path?: string): Promise<FileTreeNode[]> {
    const { owner, repo } = this.parseRepoId(repoId);
    const treePath = path ? `/${path}` : "";
    const data = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/contents${treePath}`,
    );

    if (!Array.isArray(data)) {
      // Single file was returned — wrap as one-item array
      return [this.toFileTreeNode(data)];
    }

    return data.map((item: any) => this.toFileTreeNode(item));
  }

  async getFileContents(repoId: string, path: string, ref?: string): Promise<string> {
    const { owner, repo } = this.parseRepoId(repoId);
    const qs = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    const data = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}${qs}`,
      {
        headers: { Accept: "application/vnd.github.raw+json" },
        rawResponse: true,
      },
    );
    return data as unknown as string;
  }

  async searchCode(repoId: string, query: string): Promise<CodeSearchResult[]> {
    const { owner, repo } = this.parseRepoId(repoId);
    const q = encodeURIComponent(`${query} repo:${owner}/${repo}`);
    const data = await this.authedRequest(`${GITHUB_API}/search/code?q=${q}&per_page=100`);

    return (data.items ?? []).map((item: any) => ({
      file: item.path,
      lineNumber: 0,
      lineContent: item.name,
      matchHighlights: [],
    }));
  }

  // =========================================================================
  // Pull request operations
  // =========================================================================

  async getPullRequest(repoId: string, prNumber: number): Promise<NormalizedPR> {
    const { owner, repo } = this.parseRepoId(repoId);
    const data = await this.authedRequest(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`);
    return this.normalizePR(data);
  }

  async getPullRequestDiff(repoId: string, prNumber: number): Promise<string> {
    const { owner, repo } = this.parseRepoId(repoId);
    const data = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: { Accept: "application/vnd.github.diff" },
        rawResponse: true,
      },
    );
    return data as unknown as string;
  }

  async getPullRequestComments(repoId: string, prNumber: number): Promise<NormalizedComment[]> {
    const { owner, repo } = this.parseRepoId(repoId);
    const data = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/comments?per_page=100`,
    );

    return (data as any[]).map((c: any) => ({
      id: c.id,
      authorLogin: c.user?.login ?? "unknown",
      body: c.body ?? "",
      path: c.path ?? undefined,
      line: c.line ?? c.original_line ?? undefined,
      createdAt: new Date(c.created_at).getTime(),
      updatedAt: new Date(c.updated_at).getTime(),
    }));
  }

  async postPullRequestReview(
    repoId: string,
    prNumber: number,
    review: ReviewPayload,
  ): Promise<{ reviewId: number }> {
    const { owner, repo } = this.parseRepoId(repoId);
    const data = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      {
        method: "POST",
        body: JSON.stringify({
          body: review.body,
          event: review.event,
          comments: review.comments.map((c) => ({
            path: c.path,
            line: c.line,
            body: c.body,
          })),
        }),
      },
    );

    return { reviewId: data.id };
  }

  async createPullRequest(
    repoId: string,
    head: string,
    base: string,
    title: string,
    body: string,
    draft = false,
  ): Promise<NormalizedPR> {
    const { owner, repo } = this.parseRepoId(repoId);
    const data = await this.authedRequest(`${GITHUB_API}/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({ head, base, title, body, draft }),
    });
    return this.normalizePR(data);
  }

  async updatePullRequest(
    repoId: string,
    prNumber: number,
    updates: { title?: string; body?: string; state?: "open" | "closed"; draft?: boolean },
  ): Promise<NormalizedPR> {
    const { owner, repo } = this.parseRepoId(repoId);
    const data = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...(updates.title !== undefined && { title: updates.title }),
          ...(updates.body !== undefined && { body: updates.body }),
          ...(updates.state !== undefined && { state: updates.state }),
          ...(updates.draft !== undefined && { draft: updates.draft }),
        }),
      },
    );
    return this.normalizePR(data);
  }

  async mergePullRequest(
    repoId: string,
    prNumber: number,
    strategy: "merge" | "squash" | "rebase",
    commitTitle?: string,
  ): Promise<void> {
    const { owner, repo } = this.parseRepoId(repoId);
    await this.authedRequest(`${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
      method: "PUT",
      body: JSON.stringify({
        merge_method: strategy,
        ...(commitTitle !== undefined && { commit_title: commitTitle }),
      }),
    });
  }

  async requestReviewers(repoId: string, prNumber: number, reviewers: string[]): Promise<void> {
    const { owner, repo } = this.parseRepoId(repoId);
    await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`,
      {
        method: "POST",
        body: JSON.stringify({ reviewers }),
      },
    );
  }

  async getRepoCollaborators(repoId: string): Promise<NormalizedCollaborator[]> {
    const { owner, repo } = this.parseRepoId(repoId);
    const data = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/collaborators?per_page=100`,
    );
    return (data as any[]).map((c: any) => ({
      login: c.login,
      avatarUrl: c.avatar_url ?? "",
      permissions: {
        admin: c.permissions?.admin ?? false,
        push: c.permissions?.push ?? false,
        pull: c.permissions?.pull ?? false,
      },
    }));
  }

  async getPullRequestFiles(repoId: string, prNumber: number): Promise<NormalizedPRFile[]> {
    const { owner, repo } = this.parseRepoId(repoId);
    const data = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
    );
    return (data as any[]).map((f: any) => ({
      filename: f.filename,
      status: f.status as NormalizedPRFile["status"],
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
      ...(f.patch !== undefined && { patch: f.patch }),
    }));
  }

  // =========================================================================
  // Issue operations
  // =========================================================================

  async createIssue(repoId: string, issue: NormalizedIssueCreate): Promise<NormalizedIssue> {
    const { owner, repo } = this.parseRepoId(repoId);
    const data = await this.authedRequest(`${GITHUB_API}/repos/${owner}/${repo}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
        assignees: issue.assignees,
      }),
    });
    return this.normalizeIssue(data);
  }

  async updateIssue(
    repoId: string,
    issueNumber: number,
    updates: Partial<NormalizedIssueCreate>,
  ): Promise<void> {
    const { owner, repo } = this.parseRepoId(repoId);
    await this.authedRequest(`${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.body !== undefined && { body: updates.body }),
        ...(updates.labels !== undefined && { labels: updates.labels }),
        ...(updates.assignees !== undefined && {
          assignees: updates.assignees,
        }),
      }),
    });
  }

  async getIssue(repoId: string, issueNumber: number): Promise<NormalizedIssue> {
    const { owner, repo } = this.parseRepoId(repoId);
    const data = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/issues/${issueNumber}`,
    );
    return this.normalizeIssue(data);
  }

  // =========================================================================
  // Branch operations
  // =========================================================================

  async branchExists(repoId: string, branch: string): Promise<boolean> {
    const { owner, repo } = this.parseRepoId(repoId);
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
      {
        headers: this.authHeaders,
      },
    );
    return res.status === 200;
  }

  async createBranch(repoId: string, branchName: string, fromRef: string): Promise<void> {
    const { owner, repo } = this.parseRepoId(repoId);

    // Resolve the ref to a SHA first
    const refData = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(fromRef)}`,
    );

    await this.authedRequest(`${GITHUB_API}/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: refData.object.sha,
      }),
    });
  }

  async compareBranches(repoId: string, base: string, head: string): Promise<BranchComparison> {
    const { owner, repo } = this.parseRepoId(repoId);
    const data = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    );

    return {
      aheadBy: data.ahead_by ?? 0,
      behindBy: data.behind_by ?? 0,
      commits: (data.commits ?? []).map((c: any) => this.normalizeCommit(c)),
      files: (data.files ?? []).map((f: any) => ({
        filename: f.filename,
        status: f.status as "added" | "removed" | "modified" | "renamed",
        additions: f.additions ?? 0,
        deletions: f.deletions ?? 0,
      })),
    };
  }

  // =========================================================================
  // CI/CD operations
  // =========================================================================

  async getCIStatus(repoId: string, ref: string): Promise<NormalizedCIStatus> {
    const { owner, repo } = this.parseRepoId(repoId);
    const data = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}/check-runs?per_page=100`,
    );

    const checks = (data.check_runs ?? []).map((cr: any) => ({
      name: cr.name,
      status: this.mapCheckStatus(cr.status, cr.conclusion),
      conclusion: cr.conclusion,
      url: cr.html_url,
    }));

    return {
      state: this.aggregateCIState(checks),
      checks,
    };
  }

  async getDeployments(repoId: string, environment?: string): Promise<NormalizedDeployment[]> {
    const { owner, repo } = this.parseRepoId(repoId);
    const qs = environment
      ? `?environment=${encodeURIComponent(environment)}&per_page=30`
      : "?per_page=30";
    const data = await this.authedRequest(`${GITHUB_API}/repos/${owner}/${repo}/deployments${qs}`);

    const deployments: NormalizedDeployment[] = [];
    for (const dep of data as any[]) {
      // Fetch latest status for each deployment
      const statuses = await this.authedRequest(
        `${GITHUB_API}/repos/${owner}/${repo}/deployments/${dep.id}/statuses?per_page=1`,
      );
      const latest = (statuses as any[])[0];

      deployments.push({
        id: dep.id,
        environment: dep.environment ?? "unknown",
        status: this.mapDeployStatus(latest?.state),
        sha: dep.sha,
        ref: dep.ref,
        deployedBy: dep.creator?.login ?? null,
        deployedAt: new Date(dep.created_at).getTime(),
        completedAt: latest?.created_at ? new Date(latest.created_at).getTime() : null,
      });
    }

    return deployments;
  }

  // =========================================================================
  // Commit operations
  // =========================================================================

  async getCommitHistory(
    repoId: string,
    options: CommitHistoryOptions,
  ): Promise<NormalizedCommit[]> {
    const { owner, repo } = this.parseRepoId(repoId);
    const params = new URLSearchParams();
    if (options.branch) params.set("sha", options.branch);
    if (options.path) params.set("path", options.path);
    if (options.since) params.set("since", new Date(options.since).toISOString());
    if (options.until) params.set("until", new Date(options.until).toISOString());
    params.set("per_page", String(options.limit ?? 50));

    const data = await this.authedRequest(
      `${GITHUB_API}/repos/${owner}/${repo}/commits?${params.toString()}`,
    );

    return (data as any[]).map((c: any) => this.normalizeCommit(c));
  }

  async getCommitsBetween(
    repoId: string,
    baseSha: string,
    headSha: string,
  ): Promise<NormalizedCommit[]> {
    const comparison = await this.compareBranches(repoId, baseSha, headSha);
    return comparison.commits;
  }

  // =========================================================================
  // Labels & task list issues
  // =========================================================================

  async ensureLabel(
    repoId: string,
    name: string,
    color: string,
    description?: string,
  ): Promise<void> {
    const { owner, repo } = this.parseRepoId(repoId);
    try {
      await this.authedRequest(`${GITHUB_API}/repos/${owner}/${repo}/labels`, {
        method: "POST",
        body: JSON.stringify({ name, color, description }),
      });
    } catch (err: any) {
      // 422 means label already exists — update it instead
      if (err.status === 422) {
        await this.authedRequest(
          `${GITHUB_API}/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`,
          {
            method: "PATCH",
            body: JSON.stringify({ color, description }),
          },
        );
        return;
      }
      throw err;
    }
  }

  async createTaskListIssue(
    repoId: string,
    title: string,
    childIssueNumbers: number[],
  ): Promise<NormalizedIssue> {
    const taskList = childIssueNumbers.map((n) => `- [ ] #${n}`).join("\n");

    return this.createIssue(repoId, {
      title,
      body: taskList,
    });
  }

  // =========================================================================
  // Repository creation (template provisioning)
  // =========================================================================

  async createRepoWithContent(
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
  }> {
    // 1. Determine if owner is an org or user
    const ownerData = await this.authedRequest(`${GITHUB_API}/users/${owner}`);
    const isOrg = ownerData.type === "Organization";

    // 2. Create empty repo
    let repoData: any;
    if (isOrg) {
      try {
        repoData = await this.authedRequest(`${GITHUB_API}/orgs/${owner}/repos`, {
          method: "POST",
          body: JSON.stringify({
            name: repoName,
            description,
            private: isPrivate,
            auto_init: true,
          }),
        });
      } catch (err: any) {
        if (err.status === 404 || err.status === 403) {
          throw new Error(
            `Cannot create repository in "${owner}". Ensure the GitHub App has "Administration: Read & Write" permission and repository creation is allowed for the organization.`,
          );
        }
        throw err;
      }
    } else {
      // For user accounts, installation tokens can't use POST /user/repos.
      // Instead use POST /repos which works with installation tokens for user installs.
      try {
        repoData = await this.authedRequest(`${GITHUB_API}/user/repos`, {
          method: "POST",
          body: JSON.stringify({
            name: repoName,
            description,
            private: isPrivate,
            auto_init: true,
          }),
        });
      } catch (_err: any) {
        throw new Error(
          `Cannot create repository for user "${owner}". GitHub App installation tokens for personal accounts require the App to have "Administration: Read & Write" permission. If the issue persists, install the GitHub App on an organization instead.`,
        );
      }
    }

    const fullName = repoData.full_name;
    const defaultBranch = repoData.default_branch ?? "main";

    // Wait for GitHub to finish initializing the repo (auto_init creates first commit)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get the initial commit SHA from the default branch
    console.log(`[provisioning] Getting initial commit from ${defaultBranch}`);
    const refData = await this.authedRequest(
      `${GITHUB_API}/repos/${fullName}/git/ref/heads/${defaultBranch}`,
    );
    const parentCommitSha = refData.object.sha;

    // 2. Create blobs for all files (in parallel batches for speed)
    const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
    const BLOB_BATCH_SIZE = 10;

    console.log(`[provisioning] Creating blobs for ${files.length} files in ${fullName}`);

    for (let i = 0; i < files.length; i += BLOB_BATCH_SIZE) {
      const batch = files.slice(i, i + BLOB_BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          const blobData = await this.authedRequest(`${GITHUB_API}/repos/${fullName}/git/blobs`, {
            method: "POST",
            body: JSON.stringify({
              content: file.content,
              encoding: file.encoding ?? "utf-8",
            }),
          });
          return { path: file.path, sha: blobData.sha };
        }),
      );

      for (const result of results) {
        treeItems.push({
          path: result.path,
          mode: "100644",
          type: "blob",
          sha: result.sha,
        });
      }
      console.log(
        `[provisioning] Blobs created: ${Math.min(i + BLOB_BATCH_SIZE, files.length)}/${files.length}`,
      );
    }

    // 3. Create tree from all blobs
    console.log(`[provisioning] Creating tree with ${treeItems.length} items`);
    const treeData = await this.authedRequest(`${GITHUB_API}/repos/${fullName}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        tree: treeItems,
      }),
    });

    // 4. Create commit with the initial commit as parent
    console.log(
      `[provisioning] Creating commit with tree ${treeData.sha}, parent ${parentCommitSha}`,
    );
    const commitData = await this.authedRequest(`${GITHUB_API}/repos/${fullName}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: "Initial commit from template",
        tree: treeData.sha,
        parents: [parentCommitSha],
      }),
    });

    // 5. Update the default branch ref to point to our new commit
    console.log(`[provisioning] Updating ref heads/${defaultBranch} -> ${commitData.sha}`);
    await this.authedRequest(`${GITHUB_API}/repos/${fullName}/git/refs/heads/${defaultBranch}`, {
      method: "PATCH",
      body: JSON.stringify({
        sha: commitData.sha,
        force: true,
      }),
    });

    console.log(`[provisioning] Done! ${fullName} created with ${files.length} files`);
    return {
      repoFullName: fullName,
      defaultBranch,
      htmlUrl: repoData.html_url,
      repoId: repoData.id,
    };
  }

  // =========================================================================
  // Installation repository listing
  // =========================================================================

  async listInstallationRepos(): Promise<
    Array<{
      id: number;
      full_name: string;
      name: string;
      default_branch: string;
      language: string | null;
      private: boolean;
    }>
  > {
    const repos: Array<any> = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const data = await this.authedRequest(
        `${GITHUB_API}/installation/repositories?per_page=100&page=${page}`,
      );
      repos.push(...(data.repositories ?? []));
      hasMore = repos.length < (data.total_count ?? 0);
      page++;
      if (page > 10) break; // safety limit
    }
    return repos.map((r: any) => ({
      id: r.id,
      full_name: r.full_name,
      name: r.name,
      default_branch: r.default_branch,
      language: r.language,
      private: r.private,
    }));
  }

  // =========================================================================
  // Webhook normalization
  // =========================================================================

  normalizeWebhookEvent(eventType: string, payload: unknown): NormalizedEvent {
    const p = payload as any;
    const installationId = String(p.installation?.id ?? "");
    const repoFullName: string | null = p.repository?.full_name ?? null;

    const mapping = this.mapEventToEntity(eventType, p);

    return {
      eventType: eventType as NormalizedEventType,
      action: p.action ?? null,
      entityType: mapping.entityType,
      entityId: mapping.entityId,
      repoFullName,
      installationId,
      payload,
    };
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private createAppJWT(): string {
    const appId = process.env.GITHUB_APP_ID;
    const rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    if (!appId || !rawPrivateKey) {
      throw new Error(
        "GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY environment variables are required",
      );
    }

    // Support escaped newlines from env var storage (e.g. Convex Dashboard)
    const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({
        iss: appId,
        iat: now - 60,
        exp: now + 600,
      }),
    ).toString("base64url");

    const sign = createSign("RSA-SHA256");
    sign.update(`${header}.${body}`);
    const signature = sign.sign(privateKey, "base64url");

    return `${header}.${body}.${signature}`;
  }

  private parseRepoId(repoId: string): { owner: string; repo: string } {
    const [owner, repo] = repoId.split("/");
    if (!owner || !repo) {
      throw new Error(`Invalid repo ID "${repoId}". Expected "owner/repo" format.`);
    }
    return { owner, repo };
  }

  private get authHeaders(): Record<string, string> {
    if (!this.token) {
      throw new Error("No installation token set. Call setToken() before making API requests.");
    }
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  /**
   * Make an authenticated request using the installation token.
   */
  private async authedRequest(
    url: string,
    options?: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
      rawResponse?: boolean;
    },
  ): Promise<any> {
    return this.request(url, {
      method: options?.method ?? "GET",
      headers: { ...this.authHeaders, ...(options?.headers ?? {}) },
      body: options?.body,
      rawResponse: options?.rawResponse,
    });
  }

  /**
   * Low-level fetch wrapper with error handling.
   */
  private async request(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      rawResponse?: boolean;
    },
  ): Promise<any> {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: options.body,
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      const err: any = new Error(
        `GitHub API error: ${res.status} ${res.statusText} — ${errorBody}`,
      );
      err.status = res.status;
      err.rateLimitRemaining = res.headers.get("x-ratelimit-remaining");
      err.rateLimitReset = res.headers.get("x-ratelimit-reset");
      err.retryAfter = res.headers.get("retry-after");
      throw err;
    }

    if (options.rawResponse) {
      return res.text();
    }

    return res.json();
  }

  // ---------------------------------------------------------------------------
  // Normalization helpers
  // ---------------------------------------------------------------------------

  private normalizePR(data: any): NormalizedPR {
    return {
      number: data.number,
      title: data.title,
      body: data.body ?? null,
      state: data.merged_at ? "merged" : (data.state as "open" | "closed"),
      isDraft: data.draft ?? false,
      authorLogin: data.user?.login ?? "unknown",
      sourceBranch: data.head?.ref ?? "",
      targetBranch: data.base?.ref ?? "",
      reviewState: "none",
      ciStatus: "none",
      commitCount: data.commits ?? 0,
      filesChanged: data.changed_files ?? 0,
      additions: data.additions ?? 0,
      deletions: data.deletions ?? 0,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      mergedAt: data.merged_at ? new Date(data.merged_at).getTime() : null,
      providerUrl: data.html_url ?? "",
    };
  }

  private normalizeIssue(data: any): NormalizedIssue {
    return {
      number: data.number,
      title: data.title,
      body: data.body ?? null,
      state: data.state as "open" | "closed",
      assignees: (data.assignees ?? []).map((a: any) => a.login),
      labels: (data.labels ?? []).map((l: any) => (typeof l === "string" ? l : l.name)),
      url: data.html_url ?? "",
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
    };
  }

  private normalizeCommit(data: any): NormalizedCommit {
    const commit = data.commit ?? data;
    return {
      sha: data.sha ?? "",
      message: commit.message ?? "",
      authorLogin: data.author?.login ?? data.committer?.login ?? commit.author?.name ?? "unknown",
      filesChanged: data.files?.length ?? 0,
      additions: data.stats?.additions ?? 0,
      deletions: data.stats?.deletions ?? 0,
      committedAt: new Date(commit.committer?.date ?? commit.author?.date ?? 0).getTime(),
    };
  }

  private toFileTreeNode(item: any): FileTreeNode {
    return {
      name: item.name,
      path: item.path,
      type: item.type === "dir" ? "directory" : item.type === "symlink" ? "symlink" : "file",
      size: item.size ?? undefined,
    };
  }

  private mapCheckStatus(
    status: string,
    conclusion: string | null,
  ): "success" | "failure" | "pending" | "neutral" | "skipped" {
    if (status !== "completed") return "pending";
    switch (conclusion) {
      case "success":
        return "success";
      case "failure":
      case "timed_out":
        return "failure";
      case "skipped":
        return "skipped";
      case "neutral":
        return "neutral";
      default:
        return "neutral";
    }
  }

  private aggregateCIState(
    checks: Array<{ status: string }>,
  ): "passing" | "failing" | "pending" | "none" {
    if (checks.length === 0) return "none";
    if (checks.some((c) => c.status === "failure")) return "failing";
    if (checks.some((c) => c.status === "pending")) return "pending";
    return "passing";
  }

  private mapDeployStatus(state: string | undefined): NormalizedDeployment["status"] {
    switch (state) {
      case "success":
        return "success";
      case "failure":
        return "failure";
      case "error":
        return "error";
      case "inactive":
        return "inactive";
      case "in_progress":
        return "in_progress";
      case "queued":
      case "pending":
        return "pending";
      default:
        return "pending";
    }
  }

  private mapEventToEntity(
    eventType: string,
    payload: any,
  ): { entityType: NormalizedEvent["entityType"]; entityId: string } {
    const repoName = payload.repository?.full_name ?? "";

    switch (eventType) {
      case "pull_request":
      case "pull_request_review":
        return {
          entityType: "pr",
          entityId: `${repoName}#${payload.pull_request?.number ?? 0}`,
        };
      case "issues":
      case "issue_comment":
        return {
          entityType: "issue",
          entityId: `${repoName}#${payload.issue?.number ?? 0}`,
        };
      case "push":
        return {
          entityType: "push",
          entityId: `${repoName}@${payload.ref ?? "unknown"}`,
        };
      case "deployment":
      case "deployment_status":
        return {
          entityType: "deployment",
          entityId: `${repoName}/deploy/${payload.deployment?.id ?? 0}`,
        };
      case "installation":
        return {
          entityType: "installation",
          entityId: `installation/${payload.installation?.id ?? 0}`,
        };
      case "repository":
        return {
          entityType: "repository",
          entityId: repoName,
        };
      case "workflow_run":
        return {
          entityType: "deployment",
          entityId: `${repoName}/run/${payload.workflow_run?.id ?? 0}`,
        };
      default:
        return {
          entityType: "push",
          entityId: `${repoName}/${eventType}`,
        };
    }
  }
}
