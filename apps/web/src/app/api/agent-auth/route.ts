import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:3001";

function agentHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  const secret = process.env.AGENT_SERVICE_SECRET;
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }
  return headers;
}

async function requireAuth() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  const res = await fetch(`${AGENT_SERVICE_URL}/auth/status`, {
    headers: agentHeaders(),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: Request) {
  const denied = await requireAuth();
  if (denied) return denied;

  const body = await request.json();
  const res = await fetch(`${AGENT_SERVICE_URL}/auth/api-key`, {
    method: "POST",
    headers: agentHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE() {
  const denied = await requireAuth();
  if (denied) return denied;

  const res = await fetch(`${AGENT_SERVICE_URL}/auth/api-key`, {
    method: "DELETE",
    headers: agentHeaders(),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
