/**
 * MCP server factory that creates read-only Convex data access tools.
 * These tools are used by the Agent SDK to fetch project context during AI calls.
 */

export interface ConvexMcpConfig {
  convexUrl: string;
  deploymentToken: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

async function callConvexHttpApi(
  config: ConvexMcpConfig,
  functionPath: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const url = `${config.convexUrl}/api/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.deploymentToken}`,
    },
    body: JSON.stringify({
      path: functionPath,
      args,
    }),
  });

  if (!response.ok) {
    throw new Error(`Convex API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export function createConvexMcpTools(config: ConvexMcpConfig): McpTool[] {
  return [
    {
      name: "get_requirement_context",
      description:
        "Fetches requirements for a given program and optional workstream, including status and priority data.",
      inputSchema: {
        type: "object",
        properties: {
          programId: { type: "string", description: "The program ID" },
          workstreamId: { type: "string", description: "Optional workstream ID filter" },
        },
        required: ["programId"],
      },
      execute: async (args) =>
        callConvexHttpApi(config, "requirements:listByProgram", {
          programId: args.programId,
          ...(typeof args.workstreamId === "string" ? { workstreamId: args.workstreamId } : {}),
        }),
    },
    {
      name: "get_team_members",
      description: "Fetches team member information for a program including roles and skills.",
      inputSchema: {
        type: "object",
        properties: {
          programId: { type: "string", description: "The program ID" },
        },
        required: ["programId"],
      },
      execute: async (args) =>
        callConvexHttpApi(config, "teamMembers:listByProgram", {
          programId: args.programId,
        }),
    },
    {
      name: "get_sprint_data",
      description: "Fetches sprint gate data including tasks, progress, and blockers.",
      inputSchema: {
        type: "object",
        properties: {
          programId: { type: "string", description: "The program ID" },
          sprintId: { type: "string", description: "Optional specific sprint ID" },
        },
        required: ["programId"],
      },
      execute: async (args) =>
        callConvexHttpApi(config, "sprintGates:listByProgram", {
          programId: args.programId,
          ...(typeof args.sprintId === "string" ? { sprintId: args.sprintId } : {}),
        }),
    },
    {
      name: "get_active_skills",
      description: "Fetches active skill definitions and their latest versions for a program.",
      inputSchema: {
        type: "object",
        properties: {
          programId: { type: "string", description: "The program ID" },
        },
        required: ["programId"],
      },
      execute: async (args) =>
        callConvexHttpApi(config, "skills:listByProgram", {
          programId: args.programId,
        }),
    },
    {
      name: "get_program_context",
      description:
        "Fetches high-level program context including migration corridor, phase, and key metrics.",
      inputSchema: {
        type: "object",
        properties: {
          programId: { type: "string", description: "The program ID" },
        },
        required: ["programId"],
      },
      execute: async (args) =>
        callConvexHttpApi(config, "programs:get", {
          programId: args.programId,
        }),
    },
  ];
}
