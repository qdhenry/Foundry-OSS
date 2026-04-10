import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  decryptWithAesGcm,
  encryptWithAesGcm,
  resolveEncryptionKey,
} from "../../googleDrive/encryption";

// Fixed 64-char hex key for deterministic tests (32 bytes)
const FIXED_HEX_KEY = "a".repeat(64);

describe("google-drive-encryption: resolveEncryptionKey", () => {
  const originalKey = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY = FIXED_HEX_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
    }
  });

  test("accepts 64-char hex string and returns 32-byte buffer", () => {
    process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY = FIXED_HEX_KEY;
    const key = resolveEncryptionKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
    expect(key.toString("hex")).toBe(FIXED_HEX_KEY);
  });

  test("accepts 32-byte base64 string and returns 32-byte buffer", () => {
    const rawBytes = Buffer.alloc(32, 0xab);
    const base64Key = rawBytes.toString("base64");
    process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY = base64Key;
    const key = resolveEncryptionKey();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
    expect(key.equals(rawBytes)).toBe(true);
  });

  test("derives 32-byte key via SHA-256 for arbitrary string secrets", () => {
    const arbitrarySecret = "my-arbitrary-secret-phrase";
    process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY = arbitrarySecret;
    const key = resolveEncryptionKey();
    const expected = createHash("sha256").update(arbitrarySecret).digest();
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
    expect(key.equals(expected)).toBe(true);
  });

  test("throws when GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY is missing", () => {
    delete process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
    expect(() => resolveEncryptionKey()).toThrowError(/Missing GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY/);
  });
});

describe("google-drive-encryption: encryptWithAesGcm / decryptWithAesGcm", () => {
  beforeEach(() => {
    process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY = FIXED_HEX_KEY;
  });

  afterEach(() => {
    delete process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  });

  test("round-trip: encrypt then decrypt returns original plaintext", () => {
    const plaintext = "my-secret-oauth-token";
    const encrypted = encryptWithAesGcm(plaintext);
    const decrypted = decryptWithAesGcm(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  test("encrypted payload uses v1:iv:tag:ciphertext format", () => {
    const encrypted = encryptWithAesGcm("test-token");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe("v1");
    // IV should be 12 bytes -> 16-char base64
    expect(Buffer.from(parts[1], "base64").length).toBe(12);
    // Tag should be 16 bytes -> 24-char base64
    expect(Buffer.from(parts[2], "base64").length).toBe(16);
  });

  test("generates unique IVs for each encryption call", () => {
    const plaintext = "same-token";
    const encrypted1 = encryptWithAesGcm(plaintext);
    const encrypted2 = encryptWithAesGcm(plaintext);
    const iv1 = encrypted1.split(":")[1];
    const iv2 = encrypted2.split(":")[1];
    expect(iv1).not.toBe(iv2);
    expect(encrypted1).not.toBe(encrypted2);
  });

  test("throws on tampered ciphertext (auth tag mismatch)", () => {
    const encrypted = encryptWithAesGcm("secret");
    const parts = encrypted.split(":");
    // Corrupt the ciphertext portion
    const corrupted = parts[3] === "AAAA" ? "BBBB" : "AAAA";
    const tampered = [parts[0], parts[1], parts[2], corrupted].join(":");
    expect(() => decryptWithAesGcm(tampered)).toThrow();
  });

  test("throws on wrong version prefix", () => {
    const encrypted = encryptWithAesGcm("secret");
    const parts = encrypted.split(":");
    const wrongVersion = ["v2", parts[1], parts[2], parts[3]].join(":");
    expect(() => decryptWithAesGcm(wrongVersion)).toThrowError(
      /Invalid encrypted token payload format/,
    );
  });

  test("empty string encrypts to v1 format but decryption fails (empty ciphertext falsy guard)", () => {
    // AES-GCM of empty plaintext produces empty ciphertext (""), which the
    // decryptor's `!dataB64` guard rejects as an invalid payload. This is a
    // known limitation of the current implementation.
    const encrypted = encryptWithAesGcm("");
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(() => decryptWithAesGcm(encrypted)).toThrowError(
      /Invalid encrypted token payload format/,
    );
  });
});
