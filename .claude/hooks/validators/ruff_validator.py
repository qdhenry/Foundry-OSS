#!/usr/bin/env python3
"""
Ruff linting validator for PostToolUse hook.

Runs ruff on any Python file that was just written or edited.
Skips non-Python files silently (this is primarily a TypeScript project).

Usage: uv run .claude/hooks/validators/ruff_validator.py
Input: JSON from stdin (Claude hook event)
Exit codes:
  0 - OK (pass-through, or not a Python file)
  2 - Ruff found errors (blocking)
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

    # Only lint Python files
    if not file_path.endswith(".py"):
        return 0

    if not os.path.isfile(file_path):
        return 0

    # Check if ruff is available
    try:
        result = subprocess.run(
            ["ruff", "check", "--output-format=concise", file_path],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError:
        # ruff not installed — skip silently
        return 0
    except subprocess.TimeoutExpired:
        print("ruff_validator: timed out", file=sys.stderr)
        return 0

    if result.returncode != 0:
        print(f"ruff lint errors in {file_path}:", file=sys.stderr)
        print(result.stdout, file=sys.stderr)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
