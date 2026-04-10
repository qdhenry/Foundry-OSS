/**
 * Timing-safe bearer token validation for the agent worker.
 * Compares provided token against the AGENT_SERVICE_SECRET.
 */
export async function validateBearerToken(request: Request, secret: string): Promise<boolean> {
  const header = request.headers.get("authorization");
  if (!header) return false;

  const [scheme, ...tokenParts] = header.trim().split(/\s+/);
  if (scheme.toLowerCase() !== "bearer" || tokenParts.length === 0) return false;

  const token = tokenParts.join(" ").trim();
  return timingSafeEqual(token, secret);
}

async function timingSafeEqual(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const providedBytes = new Uint8Array(providedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  if (providedBytes.length !== expectedBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < providedBytes.length; i++) {
    diff |= providedBytes[i] ^ expectedBytes[i];
  }
  return diff === 0;
}
