"use node";
/**
 * AES-256-GCM encryption helpers for Google Drive OAuth tokens.
 * Mirrors the pattern from convex/atlassian/oauthActions.ts.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTION_VERSION = "v1";

export function resolveEncryptionKey(): Buffer {
  const raw = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("Missing GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY environment variable");
  }

  // Accept 64-char hex string (32 bytes)
  if (/^[A-Fa-f0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  // Accept 32-byte base64 string
  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // fallthrough to SHA-256 derivation
  }

  // Derive 32-byte key via SHA-256 for arbitrary-length secrets
  return createHash("sha256").update(raw).digest();
}

export function encryptWithAesGcm(plaintext: string): string {
  const key = resolveEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptWithAesGcm(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== ENCRYPTION_VERSION || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted token payload format");
  }

  const key = resolveEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
