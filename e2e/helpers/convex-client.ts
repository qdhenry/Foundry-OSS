/**
 * ConvexHttpClient wrapper for E2E test data seeding/cleanup.
 * Uses the HTTP client (not WebSocket) so it works outside React.
 */

export function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL must be set for E2E test seeding");
  }
  return url;
}
