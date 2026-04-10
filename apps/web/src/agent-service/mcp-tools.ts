import { ConvexHttpClient } from "convex/browser";
import * as generatedApi from "../../convex/_generated/api";

const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const api: any = (generatedApi as any).api;

// Tool definitions for the Agent SDK MCP server
export const mcpTools = {
  getProgramContext: {
    name: "getProgramContext",
    description: "Get program details including name, client, target platform, and current phase",
    parameters: {
      type: "object" as const,
      properties: {
        programId: { type: "string", description: "The Convex program ID" },
      },
      required: ["programId"],
    },
    execute: async ({ programId }: { programId: string }) => {
      const program = await convexClient.query(api.programs.get, {
        programId: programId as any,
      });
      return {
        name: program.name,
        clientName: program.clientName,
        sourcePlatform: program.sourcePlatform,
        targetPlatform: program.targetPlatform,
        phase: program.phase,
        description: program.description,
      };
    },
  },

  getWorkstreams: {
    name: "getWorkstreams",
    description: "Get all workstreams for a program with their short codes and names",
    parameters: {
      type: "object" as const,
      properties: {
        programId: { type: "string", description: "The Convex program ID" },
      },
      required: ["programId"],
    },
    execute: async ({ programId }: { programId: string }) => {
      const workstreams = await convexClient.query(api.workstreams.listByProgram, {
        programId: programId as any,
      });
      return workstreams.map((ws: any) => ({
        shortCode: ws.shortCode,
        name: ws.name,
        description: ws.description,
      }));
    },
  },

  getExistingRequirements: {
    name: "getExistingRequirements",
    description: "Get existing requirement titles to avoid duplicate extraction",
    parameters: {
      type: "object" as const,
      properties: {
        programId: { type: "string", description: "The Convex program ID" },
      },
      required: ["programId"],
    },
    execute: async ({ programId }: { programId: string }) => {
      const requirements = await convexClient.query(api.requirements.listByProgram, {
        programId: programId as any,
      });
      return requirements.map((r: any) => r.title);
    },
  },
};

export type McpTools = typeof mcpTools;
