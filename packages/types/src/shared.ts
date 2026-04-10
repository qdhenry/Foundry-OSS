function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyHmacSha256(
  secret: string,
  payload: string,
  signatureHeader: string
): Promise<boolean> {
  const normalized = signatureHeader.trim();
  const stripped = normalized.startsWith("sha256=")
    ? normalized.slice("sha256=".length)
    : normalized;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const digestBytes = new Uint8Array(digest);

  const expectedHex = bytesToHex(digestBytes);
  const expectedBase64 = bytesToBase64(digestBytes);

  return (
    constantTimeEqual(stripped, expectedHex) ||
    constantTimeEqual(stripped, expectedBase64) ||
    constantTimeEqual(normalized, `sha256=${expectedHex}`)
  );
}
