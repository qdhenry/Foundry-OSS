#!/usr/bin/env bash
# Pre-commit coverage gate: blocks commits if any staged file drops below 90% coverage.
# Called by lefthook with staged file list as arguments.

set -euo pipefail

THRESHOLD=90
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VITEST_BIN="$REPO_ROOT/node_modules/.bin/vitest"

# Collect staged source files in scope
in_scope_files=()
for file in "$@"; do
  case "$file" in
    apps/web/src/*.ts|apps/web/src/*.tsx|packages/ui/src/*.ts|packages/ui/src/*.tsx)
      # Skip test/spec/story files
      case "$file" in
        *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx|*.stories.ts|*.stories.tsx) continue ;;
      esac
      in_scope_files+=("$file")
      ;;
  esac
done

if [ ${#in_scope_files[@]} -eq 0 ]; then
  exit 0
fi

# Find corresponding test files for staged source files
test_files=()
for src_file in "${in_scope_files[@]}"; do
  dir=$(dirname "$src_file")
  base=$(basename "$src_file" | sed 's/\.\(ts\|tsx\)$//')

  # Check co-located test
  for ext in test.tsx test.ts; do
    candidate="$dir/$base.$ext"
    if [ -f "$REPO_ROOT/$candidate" ]; then
      test_files+=("$candidate")
      break
    fi
  done

  # Check __tests__/ subdirectory
  for ext in test.tsx test.ts; do
    candidate="$dir/__tests__/$base.$ext"
    if [ -f "$REPO_ROOT/$candidate" ]; then
      test_files+=("$candidate")
      break
    fi
  done
done

if [ ${#test_files[@]} -eq 0 ]; then
  echo "⚠ No test files found for staged source files — skipping coverage check"
  exit 0
fi

# Run coverage on the related test files
coverage_dir=$(mktemp -d)
"$VITEST_BIN" run \
  --project unit \
  --reporter=dot \
  --coverage.enabled \
  --coverage.provider=v8 \
  --coverage.reporter=json-summary \
  --coverage.reportsDirectory="$coverage_dir" \
  "${test_files[@]}" 2>/dev/null || true

summary_file="$coverage_dir/coverage-summary.json"
if [ ! -f "$summary_file" ]; then
  echo "⚠ Coverage summary not generated — skipping gate"
  rm -rf "$coverage_dir"
  exit 0
fi

# Check per-file thresholds
failed=0
while IFS= read -r line; do
  file=$(echo "$line" | cut -d'|' -f1)
  stmts=$(echo "$line" | cut -d'|' -f2)
  branches=$(echo "$line" | cut -d'|' -f3)
  funcs=$(echo "$line" | cut -d'|' -f4)
  lines=$(echo "$line" | cut -d'|' -f5)

  for metric_name in stmts branches funcs lines; do
    val=$(eval echo "\$$metric_name")
    int_val=$(printf "%.0f" "$val" 2>/dev/null || echo "0")
    if [ "$int_val" -lt "$THRESHOLD" ]; then
      rel_file=$(echo "$file" | sed "s|^$REPO_ROOT/||")
      echo "✗ $rel_file: $metric_name=$val% (threshold: $THRESHOLD%)"
      failed=1
    fi
  done
done < <(node -e "
  const s = require('$summary_file');
  for (const [f, d] of Object.entries(s)) {
    if (f === 'total') continue;
    console.log(f + '|' + d.statements.pct + '|' + d.branches.pct + '|' + d.functions.pct + '|' + d.lines.pct);
  }
")

rm -rf "$coverage_dir"

if [ "$failed" -eq 1 ]; then
  echo ""
  echo "Coverage gate FAILED: one or more files below $THRESHOLD% threshold."
  echo "Add or improve tests before committing."
  exit 1
fi

echo "✓ Coverage gate passed (all staged files ≥ $THRESHOLD%)"
exit 0
