/**
 * Tail Worker for sandbox session telemetry.
 *
 * Cloudflare invokes `tail()` for every invocation of the producer worker
 * (migration-sandbox-worker). We extract per-request metrics (CPU time,
 * outcome, console logs, exceptions) and POST them to the Convex HTTP
 * endpoint for enrichment of executionAuditRecords.metadata.tailTelemetry.
 *
 * Best-effort delivery — failures here must never affect the producer.
 */

interface TailEnv {
  CONVEX_URL: string;
  SANDBOX_API_SECRET: string;
}

interface TraceLog {
  level: string;
  message: unknown[];
  timestamp: number;
}

interface TraceException {
  name: string;
  message: string;
  timestamp: number;
}

interface TraceEvent {
  request?: {
    url: string;
    method: string;
  };
  response?: {
    cpuTime?: number;
    status?: number;
  };
}

interface TraceItem {
  event: TraceEvent | null;
  eventTimestamp: number;
  outcome: string;
  logs: TraceLog[];
  exceptions: TraceException[];
  scriptName?: string;
}

export default {
  async tail(events: TraceItem[], env: TailEnv) {
    for (const event of events) {
      // Skip non-HTTP events (cron, alarm, etc.)
      if (event.event?.request?.url == null) continue;

      // Extract sandboxId from URL path: /sandbox/:sandboxId/...
      let url: URL;
      try {
        url = new URL(event.event.request.url);
      } catch {
        continue;
      }

      const match = url.pathname.match(/^\/sandbox\/([^/]+)/);
      if (!match) continue; // Skip /health and other non-sandbox routes

      const sandboxId = decodeURIComponent(match[1]);
      const route = url.pathname.replace(/\/sandbox\/[^/]+/, "/sandbox/:id");

      const telemetryPayload = {
        sandboxId,
        route,
        method: event.event.request.method,
        outcome: event.outcome,
        eventTimestamp: event.eventTimestamp,
        cpuTimeMs: event.event.response?.cpuTime,
        logs: event.logs.map((l) => ({
          level: l.level,
          message:
            typeof l.message === "string"
              ? (l.message as string).slice(0, 500)
              : JSON.stringify(l.message).slice(0, 500),
          timestamp: l.timestamp,
        })),
        exceptions: event.exceptions.map((e) => ({
          name: e.name,
          message: e.message?.slice(0, 1000),
          timestamp: e.timestamp,
        })),
      };

      try {
        await fetch(`${env.CONVEX_URL}/api/sandbox/tail-telemetry`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.SANDBOX_API_SECRET}`,
          },
          body: JSON.stringify(telemetryPayload),
        });
      } catch {
        // Tail Workers are best-effort; swallow errors
      }
    }
  },
};
