import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

async function buildReturnUrl(request: NextRequest): Promise<URL> {
  const cookieStore = await cookies();
  const returnPath = cookieStore.get("gdrive_return_url")?.value;
  if (returnPath) {
    try {
      return new URL(decodeURIComponent(returnPath), request.url);
    } catch {
      // fallthrough to default
    }
  }
  return new URL("/programs", request.url);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  const errorDescription = params.get("error_description");

  const redirectUrl = await buildReturnUrl(request);

  if (error) {
    redirectUrl.searchParams.set("google_drive_oauth", "error");
    redirectUrl.searchParams.set("google_drive_oauth_reason", error);
    if (errorDescription) {
      redirectUrl.searchParams.set("google_drive_oauth_message", errorDescription);
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !state) {
    redirectUrl.searchParams.set("google_drive_oauth", "error");
    redirectUrl.searchParams.set("google_drive_oauth_reason", "missing_callback_params");
    redirectUrl.searchParams.set(
      "google_drive_oauth_message",
      "Missing OAuth callback code/state from Google.",
    );
    return NextResponse.redirect(redirectUrl);
  }

  // Pass code + state back to the frontend. The settings page calls a Convex
  // action (has GOOGLE_CLIENT_SECRET) to exchange the code for tokens,
  // encrypt them, and store them in googleDriveCredentials.
  redirectUrl.searchParams.set("google_drive_oauth", "callback");
  redirectUrl.searchParams.set("google_drive_oauth_code", code);
  redirectUrl.searchParams.set("google_drive_oauth_state", state);

  return NextResponse.redirect(redirectUrl);
}
