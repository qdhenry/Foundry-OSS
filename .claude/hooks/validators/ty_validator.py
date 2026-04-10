#!/usr/bin/env python3
"""
Ty type-checking validator for PostToolUse hook.

Runs ty (Astral's type checker) on any Python file that was just written or edited.
Skips non-Python files silently (this is primarily a TypeScript project).

Usage: uv run .claude/hooks/validators/ty_validator.py
Input: JSON from stdin (Claude hook event)
Exit codes:
  0 - OK (pass-through, or not a Python file)
  2 - ty found type errors (blocking)
"""

import json
import os
import subprocess
import sys


def main() -> int:
    try:
        raw = sys.stdin.read()
        event = json.loads(raw) if raw.strip() else {}
    except (json.JSONDecodeError, ValueError):
        event = {}

    # Extract file path from hook event
    tool_input = event.get("tool_input", {})
    file_path = tool_input.get("file_path", "")

    # Only type-check Python files
    if not file_path.endswith(".py"):
        return 0

    if not os.path.isfile(file_path):
        return 0

    # Check if ty is available
    try:
        result = subprocess.run(
            ["ty", "check", file_path],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError:
        # ty not installed — skip silently
        return 0
    except subprocess.TimeoutExpired:
        print("ty_validator: timed out", file=sys.stderr)
        return 0

    if result.returncode != 0:
        print(f"ty type errors in {file_path}:", file=sys.stderr)
        print(result.stdout, file=sys.stderr)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
