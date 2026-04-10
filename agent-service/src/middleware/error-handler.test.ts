import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "./error-handler.js";

function createTestApp(err: Error & { statusCode?: number; code?: string }) {
  const app = express();
  app.get("/test", () => {
    throw err;
  });
  app.use(errorHandler);
  return app;
}

describe("errorHandler middleware", () => {
  it("returns 500 with INTERNAL_ERROR for generic errors", async () => {
    const app = createTestApp(new Error("Something went wrong"));

    const response = await request(app).get("/test");

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(response.body.error.message).toBe("Something went wrong");
  });

  it("uses custom statusCode when provided", async () => {
    const err = Object.assign(new Error("Not found"), { statusCode: 404, code: "NOT_FOUND" });
    const app = createTestApp(err);

    const response = await request(app).get("/test");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.error.message).toBe("Not found");
  });

  it("uses custom code when provided", async () => {
    const err = Object.assign(new Error("Bad request"), { code: "VALIDATION_ERROR" });
    const app = createTestApp(err);

    const response = await request(app).get("/test");

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("includes stack trace in development mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const app = createTestApp(new Error("Dev error"));
    const response = await request(app).get("/test");

    expect(response.body.error.stack).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });

  it("excludes stack trace in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const app = createTestApp(new Error("Prod error"));
    const response = await request(app).get("/test");

    expect(response.body.error.stack).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });
});
