import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || "http://localhost:3001";

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const res = await fetch(`${AGENT_SERVICE_URL}/summarize-discovery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(orgId ? { "x-org-id": orgId } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
