import { describe, expect, it } from "vitest";
import { parseLogMessage } from "./parseLogMessage";

describe("parseLogMessage", () => {
  it("returns null for plain text", () => {
    expect(parseLogMessage("Hello world")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseLogMessage("")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseLogMessage("{broken json")).toBeNull();
  });

  it("parses session init message", () => {
    const msg = JSON.stringify({
      type: "system",
      subtype: "init",
      session_id: "sess-123",
      claude_code_version: "1.2.3",
      tools: ["Read", "Write"],
    });
    const result = parseLogMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.summary).toContain("Session init");
    expect(result!.summary).toContain("v1.2.3");
    expect(result!.fields.some((f) => f.key === "Session")).toBe(true);
    expect(result!.fields.some((f) => f.key === "Version" && f.value === "1.2.3")).toBe(true);
    expect(result!.fields.some((f) => f.key === "Tools")).toBe(true);
  });

  it("parses execution result message", () => {
    const msg = JSON.stringify({
      type: "result",
      result: "Success",
      duration_ms: 5000,
      cost_usd: 0.0123,
    });
    const result = parseLogMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe("Execution result");
    expect(result!.fields.some((f) => f.key === "Duration" && f.value === "5.0s")).toBe(true);
    expect(result!.fields.some((f) => f.key === "Cost" && f.value === "$0.0123")).toBe(true);
  });

  it("parses generic object with type", () => {
    const msg = JSON.stringify({ type: "assistant", subtype: "chat" });
    const result = parseLogMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe("Message (assistant/chat)");
  });

  it("parses array message with tool_use content blocks", () => {
    const msg = JSON.stringify([
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Read",
              input: { file_path: "/src/index.ts" },
            },
          ],
        },
      },
    ]);
    const result = parseLogMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.summary).toContain("Tool: Read");
    expect(result!.fields.some((f) => f.key === "Tool" && f.value === "Read")).toBe(true);
  });

  it("parses array message with text content blocks", () => {
    const msg = JSON.stringify([
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: "Here is the analysis" }],
        },
      },
    ]);
    const result = parseLogMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.summary).toContain("Here is the analysis");
  });

  it("parses array message with tool_result content blocks", () => {
    const msg = JSON.stringify([
      {
        type: "tool_result",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-abc",
              content: "File contents here",
            },
          ],
        },
      },
    ]);
    const result = parseLogMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.fields.some((f) => f.key === "Tool ID")).toBe(true);
  });

  it("parses message with tool_use_result file info", () => {
    const msg = JSON.stringify([
      {
        type: "tool_result",
        tool_use_result: {
          type: "file",
          file: {
            filePath: "/src/schema.ts",
            numLines: 42,
            content: "export const schema = {}",
          },
        },
      },
    ]);
    const result = parseLogMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.fields.some((f) => f.key === "File" && f.value === "/src/schema.ts")).toBe(true);
    expect(result!.fields.some((f) => f.key === "Lines" && f.value === "42")).toBe(true);
  });

  it("parses object with string message content", () => {
    const msg = JSON.stringify({
      type: "user",
      message: { content: "Hello Claude" },
    });
    const result = parseLogMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.summary).toContain("Hello Claude");
  });

  it("returns null for non-object/non-array JSON", () => {
    expect(parseLogMessage('"just a string"')).toBeNull();
    expect(parseLogMessage("42")).toBeNull();
    expect(parseLogMessage("true")).toBeNull();
  });

  it("handles whitespace around JSON", () => {
    const msg = `  { "type": "result", "result": "ok" }  `;
    const result = parseLogMessage(msg);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe("Execution result");
  });
});
