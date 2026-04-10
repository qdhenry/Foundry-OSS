/**
 * Streaming JSON parser — extracts complete objects from a partially-streamed
 * JSON array as they arrive.  Uses brace-depth tracking with string-awareness
 * so it works on incomplete text from `client.messages.stream()`.
 *
 * Shared by: taskDecomposition, sprintPlanning, branchStrategy.
 */

export function extractCompletedObjects(
  text: string,
  arrayKeyName: string,
  alreadyExtracted: number,
): { newObjects: Record<string, unknown>[]; remaining: string } {
  const newObjects: Record<string, unknown>[] = [];

  const pattern = new RegExp(`"${arrayKeyName}"\\s*:\\s*\\[`);
  const arrayMatch = text.match(pattern);
  if (!arrayMatch || arrayMatch.index === undefined) {
    return { newObjects, remaining: text };
  }

  let pos = arrayMatch.index + arrayMatch[0].length;
  let objectsFound = 0;
  let lastObjectEnd = pos;

  while (pos < text.length) {
    // Skip whitespace and commas between objects
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
                newObjects.push(JSON.parse(objectStr) as Record<string, unknown>);
              } catch {
                // Incomplete or malformed JSON, skip
              }
            }
            lastObjectEnd = pos;
            break;
          }
        }
      }
      pos++;
    }

    if (depth > 0) break; // Incomplete object, wait for more text
  }

  return {
    newObjects,
    remaining: text.slice(lastObjectEnd),
  };
}
