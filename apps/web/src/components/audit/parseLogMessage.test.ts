import { describe, expect, it } from "vitest";
import { parseLogMessage } from "./parseLogMessage";

describe("parseLogMessage", () => {
  describe("returns null for non-JSON input", () => {
    it("returns null for plain text", () => {
      expect(parseLogMessage("Hello world")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseLogMessage("")).toBeNull();
    });

    it("returns null for malformed JSON", () => {
      expect(parseLogMessage("{not valid json")).toBeNull();
    });

    it("returns null for a plain number", () => {
      expect(parseLogMessage("42")).toBeNull();
    });

    it("returns null for a plain string in JSON", () => {
      expect(parseLogMessage('"just a string"')).toBeNull();
    });
  });

  describe("parses tool result messages", () => {
    const toolResultMessage = JSON.stringify([
      {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              tool_use_id: "toolu_abc123",
              type: "tool_result",
              content: "file content here",
            },
          ],
        },
        tool_use_result: {
          type: "text",
          file: {
            filePath: "/workspace/AUDIT_TESTING.md",
            content: "# Audit Testing\nLine 2",
            numLines: 16,
          },
        },
      },
    ]);

    it("returns a ParsedLogMessage", () => {
      const result = parseLogMessage(toolResultMessage);
      expect(result).not.toBeNull();
    });

    it("generates a summary", () => {
      const result = parseLogMessage(toolResultMessage)!;
      expect(result.summary).toBeTruthy();
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it("extracts the message type", () => {
      const result = parseLogMessage(toolResultMessage)!;
      const typeField = result.fields.find((f) => f.key === "Type");
      expect(typeField).toBeDefined();
      expect(typeField?.value).toBe("user");
      expect(typeField?.type).toBe("badge");
    });

    it("extracts the file path", () => {
      const result = parseLogMessage(toolResultMessage)!;
      const fileField = result.fields.find((f) => f.key === "File");
      expect(fileField).toBeDefined();
      expect(fileField?.value).toBe("/workspace/AUDIT_TESTING.md");
      expect(fileField?.type).toBe("file");
    });

    it("extracts the line count", () => {
      const result = parseLogMessage(toolResultMessage)!;
      const linesField = result.fields.find((f) => f.key === "Lines");
      expect(linesField).toBeDefined();
      expect(linesField?.value).toBe("16");
    });

    it("extracts the file content", () => {
      const result = parseLogMessage(toolResultMessage)!;
      const contentField = result.fields.find((f) => f.key === "Content" && f.type === "code");
      expect(contentField).toBeDefined();
      expect(contentField?.value).toContain("# Audit Testing");
    });

    it("generates summary from first content block", () => {
      const result = parseLogMessage(toolResultMessage)!;
      // Summary comes from the tool_result content text before the file path
      expect(result.summary).toBe("file content here");
    });
  });

  describe("parses tool invocation messages", () => {
    const toolUseMessage = JSON.stringify([
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "tool_use",
              name: "Read",
              input: {
                file_path: "/workspace/src/index.ts",
              },
            },
          ],
        },
      },
    ]);

    it("extracts the tool name as a badge", () => {
      const result = parseLogMessage(toolUseMessage)!;
      const toolField = result.fields.find((f) => f.key === "Tool");
      expect(toolField).toBeDefined();
      expect(toolField?.value).toBe("Read");
      expect(toolField?.type).toBe("badge");
    });

    it("extracts tool input parameters", () => {
      const result = parseLogMessage(toolUseMessage)!;
      const pathField = result.fields.find((f) => f.key === "file_path");
      expect(pathField).toBeDefined();
      expect(pathField?.value).toBe("/workspace/src/index.ts");
    });

    it("generates a summary with the tool name", () => {
      const result = parseLogMessage(toolUseMessage)!;
      expect(result.summary).toContain("Read");
    });
  });

  describe("parses assistant text messages", () => {
    const textMessage = JSON.stringify([
      {
        type: "assistant",
        message: {
          content: [
            {
              type: "text",
              text: "I'll help you implement the feature.",
            },
          ],
        },
      },
    ]);

    it("extracts the text content", () => {
      const result = parseLogMessage(textMessage)!;
      const textField = result.fields.find((f) => f.key === "Text");
      expect(textField).toBeDefined();
      expect(textField?.value).toBe("I'll help you implement the feature.");
    });

    it("uses text as summary", () => {
      const result = parseLogMessage(textMessage)!;
      expect(result.summary).toContain("help you implement");
    });
  });

  describe("parses session init metadata", () => {
    const initMessage = JSON.stringify({
      type: "system",
      subtype: "init",
      session_id: "sess_abc123def456",
      claude_code_version: "1.2.3",
      tools: ["Read", "Write", "Bash"],
    });

    it("identifies as Session Init badge", () => {
      const result = parseLogMessage(initMessage)!;
      const typeField = result.fields.find((f) => f.key === "Type");
      expect(typeField).toBeDefined();
      expect(typeField?.value).toBe("Session Init");
    });

    it("extracts session id (truncated)", () => {
      const result = parseLogMessage(initMessage)!;
      const sessionField = result.fields.find((f) => f.key === "Session");
      expect(sessionField).toBeDefined();
      expect(sessionField?.value).toBeTruthy();
    });

    it("extracts version", () => {
      const result = parseLogMessage(initMessage)!;
      const versionField = result.fields.find((f) => f.key === "Version");
      expect(versionField).toBeDefined();
      expect(versionField?.value).toBe("1.2.3");
    });

    it("extracts tools as comma-separated list", () => {
      const result = parseLogMessage(initMessage)!;
      const toolsField = result.fields.find((f) => f.key === "Tools");
      expect(toolsField).toBeDefined();
      expect(toolsField?.value).toBe("Read, Write, Bash");
    });

    it("includes version in summary", () => {
      const result = parseLogMessage(initMessage)!;
      expect(result.summary).toContain("1.2.3");
      expect(result.summary).toContain("Session init");
    });
  });

  describe("parses execution result messages", () => {
    const resultMessage = JSON.stringify({
      type: "result",
      result: "Task completed successfully",
      duration_ms: 12500,
      cost_usd: 0.0342,
    });

    it("extracts result content", () => {
      const result = parseLogMessage(resultMessage)!;
      const resultField = result.fields.find((f) => f.key === "Result");
      expect(resultField).toBeDefined();
      expect(resultField?.value).toContain("Task completed successfully");
    });

    it("formats duration in seconds", () => {
      const result = parseLogMessage(resultMessage)!;
      const durationField = result.fields.find((f) => f.key === "Duration");
      expect(durationField).toBeDefined();
      expect(durationField?.value).toBe("12.5s");
    });

    it("formats cost in USD", () => {
      const result = parseLogMessage(resultMessage)!;
      const costField = result.fields.find((f) => f.key === "Cost");
      expect(costField).toBeDefined();
      expect(costField?.value).toBe("$0.0342");
    });

    it("summary is 'Execution result'", () => {
      const result = parseLogMessage(resultMessage)!;
      expect(result.summary).toBe("Execution result");
    });
  });

  describe("handles edge cases", () => {
    it("handles an empty array", () => {
      expect(parseLogMessage("[]")).toBeNull();
    });

    it("handles an array of primitives", () => {
      expect(parseLogMessage("[1, 2, 3]")).toBeNull();
    });

    it("handles an object with no recognizable type", () => {
      expect(parseLogMessage('{"foo": "bar"}')).toBeNull();
    });

    it("handles whitespace around JSON", () => {
      const msg = `  ${JSON.stringify({ type: "result", result: "ok" })}  `;
      const result = parseLogMessage(msg);
      expect(result).not.toBeNull();
    });

    it("handles tool result without file (text only)", () => {
      const msg = JSON.stringify([
        {
          type: "user",
          tool_use_result: {
            type: "text",
            content: "Some plain text result",
          },
        },
      ]);
      const result = parseLogMessage(msg)!;
      const contentField = result.fields.find((f) => f.key === "Content" && f.type === "code");
      expect(contentField).toBeDefined();
      expect(contentField?.value).toBe("Some plain text result");
    });

    it("handles message with string content instead of array", () => {
      const msg = JSON.stringify([
        {
          type: "system",
          message: {
            content: "Plain string content",
          },
        },
      ]);
      const result = parseLogMessage(msg)!;
      const contentField = result.fields.find((f) => f.key === "Content");
      expect(contentField).toBeDefined();
      expect(contentField?.value).toBe("Plain string content");
    });

    it("truncates long text in summary to ~100 chars", () => {
      const longText = "A".repeat(200);
      const msg = JSON.stringify([
        {
          type: "assistant",
          message: {
            content: [{ type: "text", text: longText }],
          },
        },
      ]);
      const result = parseLogMessage(msg)!;
      expect(result.summary.length).toBeLessThanOrEqual(101); // 100 + ellipsis
    });
  });
});
