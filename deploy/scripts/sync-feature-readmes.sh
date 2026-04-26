#!/bin/bash
# sync-feature-readmes.sh — Auto-generate feature README headers from manifest.json
#
# Usage:
#   ./deploy/scripts/sync-feature-readmes.sh          # Update all feature READMEs
#   DRY_RUN=1 ./deploy/scripts/sync-feature-readmes.sh # Show what would change
#
# The script generates a standard header section in each features/<name>/README.md
# from the corresponding manifest.json. Content below the marker is preserved.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DRY_RUN="${DRY_RUN:-0}"

if [ "$DRY_RUN" = "1" ]; then
  echo "DRY_RUN mode: showing what would change (no files modified)"
  echo ""
fi

MARKER="<!-- AUTO-GENERATED ABOVE | MANUAL BELOW -->"
UPDATED_COUNT=0

# Python script for parsing and generating headers
PARSE_MANIFEST=$(cat << 'PYTHON_EOF'
import json
import sys
import os

manifest_path = sys.argv[1]
feature_name = sys.argv[2]

try:
    with open(manifest_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
except Exception as e:
    print(f"ERROR parsing {manifest_path}: {e}", file=sys.stderr)
    sys.exit(1)

display_name = data.get('displayName', feature_name)
status = data.get('status', 'experimental')
category = data.get('category', 'unknown')
owners = ', '.join(data.get('owners', []))

files = data.get('files', {})
backend_count = len(files.get('backend', []))
frontend_count = len(files.get('frontend', []))
tests_count = len(files.get('tests', []))
docs_count = len(files.get('docs', []))

endpoints_count = len(data.get('endpoints', []))

round_history = data.get('roundHistory', [])
last_round = round_history[-1].get('round', 'N/A') if round_history else 'N/A'

header = f"""# {display_name}

> **상태**: {status} | **카테고리**: {category} | **소유자**: {owners}

- **엔드포인트**: {endpoints_count}개
- **파일**: backend {backend_count} / frontend {frontend_count} / tests {tests_count} / docs {docs_count}
- **마지막 변경**: {last_round}
"""

print(header)
PYTHON_EOF
)

# Find all feature manifests
for manifest in features/*/manifest.json; do
  if [ ! -f "$manifest" ]; then
    continue
  fi

  feature_dir="$(dirname "$manifest")"
  feature_name="$(basename "$feature_dir")"
  readme_path="$feature_dir/README.md"

  # Skip template
  if [ "$feature_name" = "_TEMPLATE" ]; then
    continue
  fi

  # Parse manifest.json
  header=$(python3 -c "$PARSE_MANIFEST" "$manifest" "$feature_name" 2>/dev/null || echo "")

  if [ -z "$header" ]; then
    echo "❌ Failed to parse $manifest, skipping"
    continue
  fi

  # Handle README creation/update
  if [ -f "$readme_path" ]; then
    # README exists: preserve content below marker
    if grep -q "$MARKER" "$readme_path" 2>/dev/null; then
      manual_part=$(sed -n "/$MARKER/,\$p" "$readme_path" | sed '1d')
      new_content="$header
$MARKER
$manual_part"
    else
      # Marker not found: prepend header
      existing_content=$(cat "$readme_path")
      new_content="$header
$MARKER
$existing_content"
    fi
  else
    # README doesn't exist: create with header + empty manual section
    new_content="$header
$MARKER
"
  fi

  # Write or show changes
  if [ "$DRY_RUN" = "1" ]; then
    echo "Would update: $readme_path"
    if [ -f "$readme_path" ]; then
      echo "--- Current content (first 3 lines):"
      head -n 3 "$readme_path" | sed 's/^/    /'
      echo "--- New content (first 3 lines):"
      echo "$new_content" | head -n 3 | sed 's/^/    /'
    else
      echo "    (would create new file)"
    fi
    echo ""
    UPDATED_COUNT=$((UPDATED_COUNT + 1))
  else
    echo "$new_content" > "$readme_path"
    echo "✅ Updated: $readme_path"
    UPDATED_COUNT=$((UPDATED_COUNT + 1))
  fi
done

echo ""
if [ "$DRY_RUN" = "1" ]; then
  echo "DRY_RUN: $UPDATED_COUNT feature README(s) would be updated"
  exit 0
else
  echo "✅ Successfully synced $UPDATED_COUNT feature README(s)"
fi
