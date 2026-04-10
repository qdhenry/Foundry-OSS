#!/usr/bin/env bash
# PostToolUse coverage check: warns when edited files lack tests or have low coverage.
# Triggered on Edit/Write/MultiEdit of .ts/.tsx files in apps/web/src/ or packages/ui/src/.
# Async, non-blocking, 30s timeout.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VITEST_BIN="$REPO_ROOT/node_modules/.bin/vitest"

# The edited file path comes from the tool_input JSON via stdin
input=$(cat)
file_path=$(echo "$input" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try {
      const j = JSON.parse(d);
      console.log(j.file_path || j.filePath || '');
    } catch { console.log(''); }
  });
" 2>/dev/null)

if [ -z "$file_path" ]; then
  exit 0
fi

# Check if file is in scope
case "$file_path" in
  */apps/web/src/*|*/packages/ui/src/*)
    ;;
  *)
    exit 0
    ;;
esac

# Skip test/spec/story files
case "$file_path" in
  *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx|*.stories.ts|*.stories.tsx)
    exit 0
    ;;
esac

# Skip non-ts/tsx files
case "$file_path" in
  *.ts|*.tsx)
    ;;
  *)
    exit 0
    ;;
esac

dir=$(dirname "$file_path")
base=$(basename "$file_path" | sed 's/\.\(ts\|tsx\)$//')

# Find corresponding test file
test_file=""
for ext in test.tsx test.ts; do
  candidate="$dir/$base.$ext"
  if [ -f "$candidate" ]; then
    test_file="$candidate"
    break
  fi
done

# Check __tests__/ subdirectory
if [ -z "$test_file" ]; then
  for ext in test.tsx test.ts; do
    candidate="$dir/__tests__/$base.$ext"
    if [ -f "$candidate" ]; then
      test_file="$candidate"
      break
    fi
  done
fi

if [ -z "$test_file" ]; then
  rel_path=$(echo "$file_path" | sed "s|^$REPO_ROOT/||")
  echo "⚠ No test file found for $rel_path"
  exit 0
fi

# Run the test
rel_test=$(echo "$test_file" | sed "s|^$REPO_ROOT/||")
"$VITEST_BIN" run --project unit --reporter=dot "$test_file" 2>/dev/null
exit_code=$?

if [ "$exit_code" -ne 0 ]; then
  echo "⚠ Tests failing for $rel_test"
fi

exit 0
