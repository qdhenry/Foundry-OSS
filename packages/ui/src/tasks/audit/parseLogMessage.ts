export interface ParsedField {
  key: string;
  value: string;
  type: "text" | "code" | "file" | "badge";
}

export interface ParsedLogMessage {
  summary: string;
  fields: ParsedField[];
  rawFallback?: string;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}…`;
}

function extractToolResult(item: any): ParsedField[] {
  const fields: ParsedField[] = [];

  if (item.tool_use_result) {
    const result = item.tool_use_result;
    if (result.type) {
      fields.push({ key: "Result type", value: result.type, type: "badge" });
    }
    if (result.file) {
      fields.push({ key: "File", value: result.file.filePath, type: "file" });
      if (result.file.numLines) {
        fields.push({ key: "Lines", value: String(result.file.numLines), type: "text" });
      }
      if (result.file.content) {
        fields.push({ key: "Content", value: result.file.content, type: "code" });
      }
    }
    if (typeof result.content === "string" && !result.file) {
      fields.push({ key: "Content", value: result.content, type: "code" });
    }
  }

  return fields;
}

function extractContentBlocks(content: any[]): { fields: ParsedField[]; summary: string } {
  const fields: ParsedField[] = [];
  let summary = "";

  for (const block of content) {
    if (block.type === "tool_result") {
      if (block.tool_use_id) {
        fields.push({ key: "Tool ID", value: truncate(block.tool_use_id, 24), type: "text" });
      }
      if (typeof block.content === "string") {
        fields.push({ key: "Result", value: block.content, type: "code" });
        if (!summary) summary = truncate(block.content, 100);
      }
    } else if (block.type === "tool_use") {
      fields.push({ key: "Tool", value: block.name, type: "badge" });
      if (block.input && typeof block.input === "object") {
        for (const [k, v] of Object.entries(block.input)) {
          const val = typeof v === "string" ? v : JSON.stringify(v);
          fields.push({
            key: k,
            value: truncate(val, 300),
            type: typeof v === "string" && v.includes("\n") ? "code" : "text",
          });
        }
      }
      if (!summary) summary = `Tool: ${block.name}`;
    } else if (block.type === "text") {
      fields.push({ key: "Text", value: block.text, type: "text" });
      if (!summary) summary = truncate(block.text, 100);
    }
  }

  return { fields, summary };
}

function parseArrayMessage(arr: any[]): ParsedLogMessage | null {
  const allFields: ParsedField[] = [];
  let summary = "";

  for (const item of arr) {
    if (!item || typeof item !== "object") continue;

    if (item.type) {
      allFields.push({ key: "Type", value: item.type, type: "badge" });
    }

    // Extract from message.content blocks
    if (item.message?.content && Array.isArray(item.message.content)) {
      const { fields, summary: blockSummary } = extractContentBlocks(item.message.content);
      allFields.push(...fields);
      if (!summary && blockSummary) summary = blockSummary;
    } else if (item.message?.content && typeof item.message.content === "string") {
      allFields.push({ key: "Content", value: item.message.content, type: "text" });
      if (!summary) summary = truncate(item.message.content, 100);
    }

    // Extract tool_use_result at top level
    allFields.push(...extractToolResult(item));

    // Build summary from file path if we have one
    if (item.tool_use_result?.file?.filePath && !summary) {
      const path = item.tool_use_result.file.filePath;
      const toolFields = allFields.filter((f) => f.key === "Tool");
      const toolName = toolFields.length > 0 ? toolFields[0].value : item.type;
      summary = `${toolName}: ${path}`;
    }
  }

  if (allFields.length === 0) return null;

  if (!summary) {
    const typeField = allFields.find((f) => f.key === "Type");
    summary = typeField ? `Message (${typeField.value})` : "Structured message";
  }

  return { summary, fields: allFields };
}

function parseObjectMessage(obj: any): ParsedLogMessage | null {
  const fields: ParsedField[] = [];
  let summary = "";

  // Session init metadata
  if (obj.type === "system" && obj.subtype === "init") {
    fields.push({ key: "Type", value: "Session Init", type: "badge" });
    if (obj.session_id) {
      fields.push({ key: "Session", value: truncate(obj.session_id, 16), type: "text" });
    }
    if (obj.claude_code_version) {
      fields.push({ key: "Version", value: obj.claude_code_version, type: "text" });
    }
    if (Array.isArray(obj.tools)) {
      fields.push({ key: "Tools", value: obj.tools.join(", "), type: "text" });
    }
    summary = `Session init${obj.claude_code_version ? ` (v${obj.claude_code_version})` : ""}`;
    return { summary, fields };
  }

  // Execution result
  if (obj.type === "result") {
    fields.push({ key: "Type", value: "Result", type: "badge" });
    if (obj.result) {
      fields.push({
        key: "Result",
        value: typeof obj.result === "string" ? obj.result : JSON.stringify(obj.result),
        type: "code",
      });
    }
    if (obj.duration_ms) {
      fields.push({
        key: "Duration",
        value: `${(obj.duration_ms / 1000).toFixed(1)}s`,
        type: "text",
      });
    }
    if (obj.cost_usd !== undefined) {
      fields.push({ key: "Cost", value: `$${obj.cost_usd.toFixed(4)}`, type: "text" });
    }
    summary = "Execution result";
    return { summary, fields };
  }

  // Generic object with type
  if (obj.type) {
    fields.push({ key: "Type", value: obj.type, type: "badge" });
    if (obj.subtype) {
      fields.push({ key: "Subtype", value: obj.subtype, type: "badge" });
    }

    // Extract any message content
    if (obj.message?.content) {
      if (Array.isArray(obj.message.content)) {
        const { fields: contentFields, summary: contentSummary } = extractContentBlocks(
          obj.message.content,
        );
        fields.push(...contentFields);
        if (contentSummary) summary = contentSummary;
      } else if (typeof obj.message.content === "string") {
        fields.push({ key: "Content", value: obj.message.content, type: "text" });
        summary = truncate(obj.message.content, 100);
      }
    }

    if (!summary) summary = `Message (${obj.type}${obj.subtype ? `/${obj.subtype}` : ""})`;
    return { summary, fields };
  }

  return null;
}

export function parseLogMessage(message: string): ParsedLogMessage | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;

  try {
    const parsed = JSON.parse(trimmed);

    if (Array.isArray(parsed)) {
      return parseArrayMessage(parsed);
    }

    if (typeof parsed === "object" && parsed !== null) {
      return parseObjectMessage(parsed);
    }

    return null;
  } catch {
    return null;
  }
}
