import { type NextRequest, NextResponse } from "next/server";

/**
 * GitHub App installation callback route.
 *
 * After a user installs the GitHub App, GitHub redirects here with
 * `installation_id` and `setup_action` query parameters. We forward
 * these to the programs page so the frontend can bind the installation
 * to the current org via a Convex mutation.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const installationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");
  const state = searchParams.get("state");

  if (!installationId) {
    return NextResponse.redirect(new URL("/programs", request.url));
  }

  // If a return path was passed via state, redirect back there.
  // Otherwise fall back to /programs.
  const returnPath = state?.startsWith("/") ? state : "/programs";

  const redirectUrl = new URL(returnPath, request.url);
  redirectUrl.searchParams.set("github_installation_id", installationId);
  if (setupAction) {
    redirectUrl.searchParams.set("github_setup_action", setupAction);
  }

  return NextResponse.redirect(redirectUrl);
}
