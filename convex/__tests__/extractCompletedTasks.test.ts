import { describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Pure-function copy of extractCompletedTasks from taskDecompositionActions.ts
// Duplicated here so we can test the algorithm without modifying source code.
// ---------------------------------------------------------------------------

interface ParsedTask {
  title?: string;
  description?: string;
  story_points?: number;
  task_type?: string;
}

function extractCompletedTasks(
  text: string,
  alreadyExtracted: number,
): { newTasks: ParsedTask[]; remaining: string } {
  const newTasks: ParsedTask[] = [];

  const arrayMatch = text.match(/"tasks"\s*:\s*\[/);
  if (!arrayMatch || arrayMatch.index === undefined) {
    return { newTasks, remaining: text };
  }

  let pos = arrayMatch.index + arrayMatch[0].length;
  let objectsFound = 0;
  let lastObjectEnd = pos;

  while (pos < text.length) {
    while (pos < text.length && /[\s,]/.test(text[pos])) pos++;
    if (pos >= text.length || text[pos] === "]") break;

    if (text[pos] !== "{") {
      pos++;
      continue;
    }

    let depth = 0;
    const objectStart = pos;
    let inString = false;
    let escaped = false;

    while (pos < text.length) {
      const ch = text[pos];
      if (escaped) {
        escaped = false;
        pos++;
        continue;
      }
      if (ch === "\\" && inString) {
        escaped = true;
        pos++;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
      } else if (!inString) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            pos++;
            const objectStr = text.slice(objectStart, pos);
            objectsFound++;
            if (objectsFound > alreadyExtracted) {
              try {
                newTasks.push(JSON.parse(objectStr));
              } catch {
                // skip unparseable objects
              }
            }
            lastObjectEnd = pos;
            break;
          }
        }
      }
      pos++;
    }
    if (depth > 0) break;
  }

  return { newTasks, remaining: text.slice(lastObjectEnd) };
}

// ── Basic extraction ────────────────────────────────────────────────

describe("extractCompletedTasks - basic extraction", () => {
  test("extracts single complete task from JSON stream", () => {
    const input = '{"tasks": [{"title": "Task 1", "description": "Do thing"}]}';
    const result = extractCompletedTasks(input, 0);

    expect(result.newTasks).toHaveLength(1);
    expect(result.newTasks[0].title).toBe("Task 1");
    expect(result.newTasks[0].description).toBe("Do thing");
  });

  test("extracts multiple complete tasks", () => {
    const input = JSON.stringify({
      tasks: [
        { title: "Task 1", description: "First" },
        { title: "Task 2", description: "Second" },
        { title: "Task 3", description: "Third" },
      ],
    });
    const result = extractCompletedTasks(input, 0);

    expect(result.newTasks).toHaveLength(3);
    expect(result.newTasks[0].title).toBe("Task 1");
    expect(result.newTasks[1].title).toBe("Task 2");
    expect(result.newTasks[2].title).toBe("Task 3");
  });

  test("skips already extracted tasks", () => {
    const input = JSON.stringify({
      tasks: [
        { title: "Task 1", description: "First" },
        { title: "Task 2", description: "Second" },
        { title: "Task 3", description: "Third" },
      ],
    });
    const result = extractCompletedTasks(input, 2);

    expect(result.newTasks).toHaveLength(1);
    expect(result.newTasks[0].title).toBe("Task 3");
  });
});

// ── Streaming simulation ────────────────────────────────────────────

describe("extractCompletedTasks - streaming simulation", () => {
  test("handles incomplete JSON (object not closed)", () => {
    const input = '{"tasks": [{"title": "Task 1"';
    const result = extractCompletedTasks(input, 0);

    expect(result.newTasks).toHaveLength(0);
  });

  test("handles partial stream before tasks array", () => {
    const input = '{"decomposition_rationale": "blah"';
    const result = extractCompletedTasks(input, 0);

    expect(result.newTasks).toHaveLength(0);
  });

  test("extracts tasks from larger JSON with surrounding fields", () => {
    const input = JSON.stringify({
      decomposition_rationale: "We need to break this into smaller pieces",
      tasks: [
        { title: "Task 1", description: "Do the first thing" },
        { title: "Task 2", description: "Do the second thing" },
      ],
      implementation_considerations: "Watch out for edge cases",
    });
    const result = extractCompletedTasks(input, 0);

    expect(result.newTasks).toHaveLength(2);
    expect(result.newTasks[0].title).toBe("Task 1");
    expect(result.newTasks[1].title).toBe("Task 2");
  });
});

// ── Edge cases ──────────────────────────────────────────────────────

describe("extractCompletedTasks - edge cases", () => {
  test("handles nested braces in string values", () => {
    const input = JSON.stringify({
      tasks: [
        {
          title: "Handle JSON parsing",
          description: "Parse objects like {key: value} and arrays like [1, 2, 3]",
        },
      ],
    });
    const result = extractCompletedTasks(input, 0);

    expect(result.newTasks).toHaveLength(1);
    expect(result.newTasks[0].title).toBe("Handle JSON parsing");
    expect(result.newTasks[0].description).toContain("{key: value}");
  });

  test("handles escaped quotes in strings", () => {
    const input = JSON.stringify({
      tasks: [
        {
          title: 'Use "quoted" values',
          description: 'Handle \\"escaped\\" content properly',
        },
      ],
    });
    const result = extractCompletedTasks(input, 0);

    expect(result.newTasks).toHaveLength(1);
    expect(result.newTasks[0].title).toBe('Use "quoted" values');
  });

  test("handles empty tasks array", () => {
    const input = '{"tasks": []}';
    const result = extractCompletedTasks(input, 0);

    expect(result.newTasks).toHaveLength(0);
  });

  test("returns empty when no tasks key found", () => {
    const input = "This is just some random text without any tasks key";
    const result = extractCompletedTasks(input, 0);

    expect(result.newTasks).toHaveLength(0);
    expect(result.remaining).toBe(input);
  });
});
