import { type NextRequest, NextResponse } from "next/server";

function parseProgramIdFromState(state: string | null): string | null {
  if (!state) return null;
  const [programId] = state.split(":");
  return programId || null;
}

function buildSettingsUrl(request: NextRequest, programId: string | null): URL {
  const path = programId ? `/${programId}/settings` : "/programs";
  return new URL(path, request.url);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  const errorDescription = params.get("error_description");

  const programId = parseProgramIdFromState(state);
  const redirectUrl = buildSettingsUrl(request, programId);

  if (error) {
    redirectUrl.searchParams.set("atlassian_oauth", "error");
    redirectUrl.searchParams.set("atlassian_oauth_reason", error);
    if (errorDescription) {
      redirectUrl.searchParams.set("atlassian_oauth_message", errorDescription);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !state) {
    redirectUrl.searchParams.set("atlassian_oauth", "error");
    redirectUrl.searchParams.set("atlassian_oauth_reason", "missing_callback_params");
    redirectUrl.searchParams.set(
      "atlassian_oauth_message",
      "Missing OAuth callback code/state from Atlassian.",
    );
    return NextResponse.redirect(redirectUrl);
  }

  redirectUrl.searchParams.set("atlassian_oauth", "callback");
  redirectUrl.searchParams.set("atlassian_oauth_code", code);
  redirectUrl.searchParams.set("atlassian_oauth_state", state);

  return NextResponse.redirect(redirectUrl);
}
