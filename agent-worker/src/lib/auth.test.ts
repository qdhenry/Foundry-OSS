import { describe, expect, it } from "vitest";
import { validateBearerToken } from "./auth";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://agent.example/test", { headers });
}

describe("validateBearerToken", () => {
  const SECRET = "my-secret-token";

  it("returns false when Authorization header is missing", async () => {
    const req = makeRequest();
    expect(await validateBearerToken(req, SECRET)).toBe(false);
  });

  it("returns false for non-Bearer scheme", async () => {
    const req = makeRequest({ Authorization: `Basic ${SECRET}` });
    expect(await validateBearerToken(req, SECRET)).toBe(false);
  });

  it("returns false for empty token after 'Bearer '", async () => {
    const req = makeRequest({ Authorization: "Bearer " });
    expect(await validateBearerToken(req, SECRET)).toBe(false);
  });

  it("returns false for incorrect token", async () => {
    const req = makeRequest({ Authorization: "Bearer wrong-token" });
    expect(await validateBearerToken(req, SECRET)).toBe(false);
  });

  it("returns true for correct token", async () => {
    const req = makeRequest({ Authorization: `Bearer ${SECRET}` });
    expect(await validateBearerToken(req, SECRET)).toBe(true);
  });

  it("is case-insensitive on the 'Bearer' scheme", async () => {
    const req = makeRequest({ Authorization: `bearer ${SECRET}` });
    expect(await validateBearerToken(req, SECRET)).toBe(true);
  });

  it("handles extra whitespace between scheme and token", async () => {
    const req = makeRequest({ Authorization: `Bearer   ${SECRET}` });
    expect(await validateBearerToken(req, SECRET)).toBe(true);
  });

  it("returns false when token differs by a single character", async () => {
    const req = makeRequest({ Authorization: `Bearer ${SECRET}x` });
    expect(await validateBearerToken(req, SECRET)).toBe(false);
  });
});
