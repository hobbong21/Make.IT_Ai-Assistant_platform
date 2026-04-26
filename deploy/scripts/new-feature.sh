#!/bin/bash
set -e

# Create a new feature scaffold from _TEMPLATE
# Usage: ./deploy/scripts/new-feature.sh my-feature-name

if [ $# -ne 1 ]; then
  echo "Usage: $0 <feature-name>"
  exit 1
fi

NAME=$1

# Validate name (lowercase, digits, hyphens only)
if ! [[ "$NAME" =~ ^[a-z0-9\-]+$ ]]; then
  echo "Error: Feature name must contain only lowercase letters, digits, and hyphens"
  exit 1
fi

# Paths
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SRC="$ROOT/features/_TEMPLATE"
DST="$ROOT/features/$NAME"

# Check if already exists
if [ -d "$DST" ]; then
  echo "Error: Feature '$NAME' already exists at $DST"
  exit 1
fi

# Check if template exists
if [ ! -d "$SRC" ]; then
  echo "Error: Template not found at $SRC"
  exit 1
fi

# Copy template
cp -r "$SRC" "$DST"
echo "Created features/$NAME/"

# Replace placeholders in copied files
find "$DST" -type f -name "*.md" -o -name "*.json" | while read -r file; do
  sed -i \
    -e "s/{feature-key}/$NAME/g" \
    -e "s/{한국어 이름}/(수정 필요)/g" \
    -e "s/{요약}/(수정 필요)/g" \
    "$file"
done

cat <<EOF
Next steps:
1. Edit features/$NAME/README.md
2. Edit features/$NAME/manifest.json
3. Edit features/$NAME/api.md
4. Edit features/$NAME/changelog.md
EOF
