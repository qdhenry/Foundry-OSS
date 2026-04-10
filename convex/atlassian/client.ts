const ATLASSIAN_AUTH_BASE = "https://auth.atlassian.com";
const ATLASSIAN_API_BASE = "https://api.atlassian.com";

export type AtlassianTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
  tokenType?: string;
  obtainedAt: number;
  accessTokenExpiresAt: number;
};

export type AtlassianAccessibleResource = {
  id: string;
  name: string;
  url: string;
  scopes: string[];
  avatarUrl?: string;
};

type OAuthEnvironment = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

function getOAuthEnvironment(): OAuthEnvironment {
  const clientId = process.env.ATLASSIAN_CLIENT_ID;
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET;
  const redirectUri = process.env.ATLASSIAN_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Atlassian OAuth environment (ATLASSIAN_CLIENT_ID, ATLASSIAN_CLIENT_SECRET, ATLASSIAN_OAUTH_REDIRECT_URI)",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function toTokenSet(payload: Record<string, any>): AtlassianTokenSet {
  const obtainedAt = Date.now();
  const expiresIn = Number(payload.expires_in ?? 3600);

  return {
    accessToken: String(payload.access_token ?? ""),
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : undefined,
    expiresIn,
    scope: typeof payload.scope === "string" ? payload.scope : undefined,
    tokenType: typeof payload.token_type === "string" ? payload.token_type : undefined,
    obtainedAt,
    accessTokenExpiresAt: obtainedAt + expiresIn * 1000,
  };
}

async function requestJson(url: string, init: RequestInit): Promise<Record<string, any>> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Atlassian request failed (${response.status} ${response.statusText}): ${body}`,
    );
  }
  return (await response.json()) as Record<string, any>;
}

async function requestAuthedJson(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<Record<string, any>> {
  return await requestJson(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    body: init?.body,
  });
}

export async function exchangeCodeForTokenSet(code: string): Promise<AtlassianTokenSet> {
  const env = getOAuthEnvironment();
  const payload = await requestJson(`${ATLASSIAN_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code,
      redirect_uri: env.redirectUri,
    }),
  });

  return toTokenSet(payload);
}

export async function refreshTokenSet(refreshToken: string): Promise<AtlassianTokenSet> {
  const env = getOAuthEnvironment();
  const payload = await requestJson(`${ATLASSIAN_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  return toTokenSet(payload);
}

export async function listAccessibleResources(
  accessToken: string,
): Promise<AtlassianAccessibleResource[]> {
  const response = await fetch(`${ATLASSIAN_API_BASE}/oauth/token/accessible-resources`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Atlassian resource discovery failed (${response.status}): ${body}`);
  }

  const resources = (await response.json()) as Array<Record<string, any>>;
  return resources.map((resource) => ({
    id: String(resource.id ?? ""),
    name: String(resource.name ?? ""),
    url: String(resource.url ?? ""),
    scopes: Array.isArray(resource.scopes) ? resource.scopes.map((scope) => String(scope)) : [],
    avatarUrl: typeof resource.avatarUrl === "string" ? resource.avatarUrl : undefined,
  }));
}

export async function getJiraIssue(
  accessToken: string,
  cloudId: string,
  issueKey: string,
): Promise<Record<string, any>> {
  return await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
  );
}

export async function listJiraProjects(
  accessToken: string,
  cloudId: string,
): Promise<Record<string, any>> {
  // TODO: add pagination and permission-scope filtering when UI consumes this.
  return await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3/project/search?maxResults=100`,
  );
}

export async function getConfluencePage(
  accessToken: string,
  cloudId: string,
  pageId: string,
): Promise<Record<string, any>> {
  return await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(pageId)}`,
  );
}

export async function getConfluencePageContent(
  accessToken: string,
  cloudId: string,
  pageId: string,
): Promise<Record<string, any>> {
  return await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(pageId)}?body-format=storage`,
  );
}

export async function listConfluenceSpaces(
  accessToken: string,
  cloudId: string,
): Promise<Record<string, any>> {
  // v2 API requires granular scope: read:space:confluence
  return await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/api/v2/spaces?limit=100`,
  );
}

export async function listConfluencePages(
  accessToken: string,
  cloudId: string,
  spaceId: string,
): Promise<Record<string, any>> {
  // v2 API requires granular scope: read:page:confluence
  return await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/api/v2/pages?space-id=${encodeURIComponent(spaceId)}&limit=100&sort=title`,
  );
}

export async function createJiraIssue(
  accessToken: string,
  cloudId: string,
  fields: Record<string, any>,
): Promise<Record<string, any>> {
  return await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3/issue`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    },
  );
}

export async function updateJiraIssue(
  accessToken: string,
  cloudId: string,
  issueKey: string,
  fields: Record<string, any>,
): Promise<Record<string, any>> {
  return await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    },
  );
}

export async function transitionJiraIssue(
  accessToken: string,
  cloudId: string,
  issueKey: string,
  transitionId: string,
): Promise<Record<string, any>> {
  return await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transition: { id: transitionId } }),
    },
  );
}

export async function addJiraComment(
  accessToken: string,
  cloudId: string,
  issueKey: string,
  body: Record<string, any>,
): Promise<Record<string, any>> {
  return await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
}

export async function createConfluencePage(
  accessToken: string,
  cloudId: string,
  spaceId: string,
  parentId: string,
  title: string,
  body: string,
): Promise<Record<string, any>> {
  return await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/api/v2/pages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spaceId,
        parentId,
        title,
        body: { representation: "storage", value: body },
        status: "current",
      }),
    },
  );
}

export async function updateConfluencePage(
  accessToken: string,
  cloudId: string,
  pageId: string,
  title: string,
  body: string,
  version: number,
): Promise<Record<string, any>> {
  return await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/api/v2/pages/${encodeURIComponent(pageId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: pageId,
        title,
        body: { representation: "storage", value: body },
        version: { number: version },
        status: "current",
      }),
    },
  );
}

export async function getConfluenceSpaceByKey(
  accessToken: string,
  cloudId: string,
  spaceKey: string,
): Promise<Record<string, any> | null> {
  const result = await requestAuthedJson(
    accessToken,
    `${ATLASSIAN_API_BASE}/ex/confluence/${cloudId}/wiki/api/v2/spaces?keys=${encodeURIComponent(spaceKey)}&limit=1`,
  );
  const spaces = result.results as Array<Record<string, any>> | undefined;
  return spaces && spaces.length > 0 ? spaces[0] : null;
}
