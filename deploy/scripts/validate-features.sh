#!/bin/bash
set -e

# Manifest validation CI script for MaKIT feature catalog
# Usage: bash deploy/scripts/validate-features.sh

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"

FAIL=0
TOTAL=0
SCHEMA_FILE="features/_TEMPLATE/manifest.schema.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Feature Catalog Manifest Validation"
echo "========================================="
echo ""

# Check schema exists
if [ ! -f "$SCHEMA_FILE" ]; then
  echo -e "${RED}FAIL${NC}: Schema file not found at $SCHEMA_FILE"
  exit 1
fi

# Validate schema itself
python3 -c "import json; json.load(open('$SCHEMA_FILE'))" 2>/dev/null || {
  echo -e "${RED}FAIL${NC}: Schema is invalid JSON"
  exit 1
}
echo -e "${GREEN}✓${NC} Schema is valid"
echo ""

# Iterate through all feature directories
for manifest in features/*/manifest.json; do
  dir=$(dirname "$manifest")
  name=$(basename "$dir")
  
  # Skip template
  if [ "$name" = "_TEMPLATE" ]; then
    continue
  fi
  
  TOTAL=$((TOTAL + 1))
  echo -n "Checking $name ... "
  
  # 1. JSON validity
  python3 -c "import json; json.load(open('$manifest'))" 2>/dev/null || {
    echo -e "${RED}FAIL${NC} (invalid JSON)"
    FAIL=$((FAIL + 1))
    continue
  }
  
  # 2. Schema validation
  python3 << PYEOF
import json
import sys
import os

manifest_path = "$manifest"
schema_path = "$SCHEMA_FILE"

try:
  import jsonschema
  HAVE_JSONSCHEMA = True
except ImportError:
  HAVE_JSONSCHEMA = False

manifest = json.load(open(manifest_path))
schema = json.load(open(schema_path))

if HAVE_JSONSCHEMA:
  try:
    jsonschema.validate(manifest, schema)
  except jsonschema.ValidationError as e:
    print(f"SCHEMA_VALIDATION_FAILED: {e.message}")
    sys.exit(1)
else:
  # Fallback: manual required field check
  required_fields = ["name", "displayName", "category", "owners", "status", "files"]
  missing = [k for k in required_fields if k not in manifest]
  if missing:
    print(f"MISSING_REQUIRED: {', '.join(missing)}")
    sys.exit(1)
  
  # Check status enum
  valid_status = ["experimental", "beta", "stable", "deprecated"]
  if manifest.get("status") not in valid_status:
    print(f"INVALID_STATUS: {manifest.get('status')}")
    sys.exit(1)
  
  # Check category enum
  valid_categories = ["ax-data", "ax-marketing", "ax-commerce", "platform"]
  if manifest.get("category") not in valid_categories:
    print(f"INVALID_CATEGORY: {manifest.get('category')}")
    sys.exit(1)
  
  # Check owners format
  owners = manifest.get("owners", [])
  if not isinstance(owners, list) or len(owners) == 0:
    print(f"INVALID_OWNERS: must be non-empty array")
    sys.exit(1)
  
  for owner in owners:
    if not owner.startswith("@"):
      print(f"INVALID_OWNER_FORMAT: {owner} must start with @")
      sys.exit(1)

sys.exit(0)
PYEOF
  
  SCHEMA_RESULT=$?
  if [ $SCHEMA_RESULT -ne 0 ]; then
    echo -e "${RED}FAIL${NC} (schema validation)"
    FAIL=$((FAIL + 1))
    continue
  fi
  
  # 3. Referenced files exist
  FILE_CHECK_FAIL=0
  for layer in backend frontend tests docs migrations; do
    # Extract paths using python (safer for nested JSON)
    paths=$(python3 << PYEOF
import json
m = json.load(open('$manifest'))
files = m.get('files', {}).get('$layer', [])
for p in files:
  if p:
    print(p)
PYEOF
)
    
    while IFS= read -r p; do
      if [ -z "$p" ]; then
        continue
      fi
      if [ ! -e "$p" ]; then
        if [ $FILE_CHECK_FAIL -eq 0 ]; then
          echo -e "${RED}FAIL${NC} (missing files)"
          FILE_CHECK_FAIL=1
        fi
        echo "  ├─ $p"
        FAIL=$((FAIL + 1))
      fi
    done <<< "$paths"
  done
  
  if [ $FILE_CHECK_FAIL -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}"
  fi
done

echo ""
echo "========================================="
echo "Summary: $((TOTAL - FAIL))/$TOTAL features valid"
echo "========================================="

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}VALIDATION FAILED: $FAIL issue(s)${NC}"
  exit 1
fi

echo -e "${GREEN}All manifests valid${NC}"
exit 0
