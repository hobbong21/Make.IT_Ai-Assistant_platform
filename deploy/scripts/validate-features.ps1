<#
.SYNOPSIS
Validates feature catalog manifest.json files against schema and references.

.DESCRIPTION
Checks each feature's manifest.json for:
1. Valid JSON syntax
2. Conformance to manifest.schema.json
3. All referenced files exist (unless they contain template placeholders)

.EXAMPLE
.\validate-features.ps1
#>

param(
    [switch]$Verbose
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$SchemaFile = Join-Path $Root "features/_TEMPLATE/manifest.schema.json"
$FeatureDir = Join-Path $Root "features"

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "Feature Catalog Manifest Validation" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

# Check schema exists
if (-not (Test-Path $SchemaFile)) {
    Write-Host "FAIL: Schema file not found at $SchemaFile" -ForegroundColor Red
    exit 1
}

# Validate schema itself
try {
    $schemaContent = Get-Content $SchemaFile -Raw
    $schema = $schemaContent | ConvertFrom-Json
    Write-Host "✓ Schema is valid`n" -ForegroundColor Green
}
catch {
    Write-Host "FAIL: Schema is invalid JSON" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

$failCount = 0
$totalCount = 0

# Check for jsonschema module
$haveJsonSchema = $false
try {
    python3 -c "import jsonschema" 2>$null
    $haveJsonSchema = $true
    if ($Verbose) { Write-Host "jsonschema module available" -ForegroundColor Gray }
}
catch {
    if ($Verbose) { Write-Host "jsonschema module not available (will use basic validation)" -ForegroundColor Gray }
}

# Iterate through feature directories
Get-ChildItem -Path $FeatureDir -Directory | Where-Object { $_.Name -ne "_TEMPLATE" } | ForEach-Object {
    $featureName = $_.Name
    $manifestPath = Join-Path $_.FullName "manifest.json"
    
    if (-not (Test-Path $manifestPath)) {
        return
    }
    
    $totalCount++
    Write-Host -NoNewline "Checking $featureName ... "
    
    # 1. JSON validity
    try {
        $manifestContent = Get-Content $manifestPath -Raw
        $manifest = $manifestContent | ConvertFrom-Json
    }
    catch {
        Write-Host "FAIL (invalid JSON)" -ForegroundColor Red
        $failCount++
        return
    }
    
    # 2. Schema validation
    $schemaValidation = python3 << PYEOF
import json
import sys

manifest_path = r"$($manifestPath -replace '\\', '\\\\')"
schema_path = r"$($SchemaFile -replace '\\', '\\\\')"

try:
    manifest = json.load(open(manifest_path))
    schema = json.load(open(schema_path))
except Exception as e:
    print(f"JSON_ERROR: {e}")
    sys.exit(1)

try:
    import jsonschema
    HAVE_JSONSCHEMA = True
except ImportError:
    HAVE_JSONSCHEMA = False

if HAVE_JSONSCHEMA:
    try:
        jsonschema.validate(manifest, schema)
    except jsonschema.ValidationError as e:
        print(f"SCHEMA_VALIDATION_FAILED: {e.message}")
        sys.exit(1)
else:
    # Fallback: manual validation
    required_fields = ["name", "displayName", "category", "owners", "status", "files"]
    missing = [k for k in required_fields if k not in manifest]
    if missing:
        print(f"MISSING_REQUIRED: {', '.join(missing)}")
        sys.exit(1)
    
    if manifest.get("status") not in ["experimental", "beta", "stable", "deprecated"]:
        print(f"INVALID_STATUS: {manifest.get('status')}")
        sys.exit(1)
    
    if manifest.get("category") not in ["ax-data", "ax-marketing", "ax-commerce", "platform"]:
        print(f"INVALID_CATEGORY: {manifest.get('category')}")
        sys.exit(1)
    
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

    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL (schema validation)" -ForegroundColor Red
        $failCount++
        return
    }
    
    # 3. Referenced files exist
    $fileCheckFail = $false
    $files = $manifest.files
    foreach ($layer in @("backend", "frontend", "tests", "docs", "migrations")) {
        if (-not $files.$layer) {
            continue
        }
        
        foreach ($filePath in $files.$layer) {
            if ([string]::IsNullOrWhiteSpace($filePath)) {
                continue
            }
            
            # Skip template placeholders
            if ($filePath -match '\{.*\}') {
                continue
            }
            
            $fullPath = Join-Path $Root $filePath
            if (-not (Test-Path $fullPath)) {
                if (-not $fileCheckFail) {
                    Write-Host "FAIL (missing files)" -ForegroundColor Red
                    $fileCheckFail = $true
                }
                Write-Host "  ├─ $filePath" -ForegroundColor Gray
                $failCount++
            }
        }
    }
    
    if (-not $fileCheckFail) {
        Write-Host "PASS" -ForegroundColor Green
    }
}

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "Summary: $($totalCount - $failCount)/$totalCount features valid" -ForegroundColor Cyan
Write-Host "=========================================`n" -ForegroundColor Cyan

if ($failCount -gt 0) {
    Write-Host "VALIDATION FAILED: $failCount issue(s)" -ForegroundColor Red
    exit 1
}

Write-Host "All manifests valid ✓" -ForegroundColor Green
exit 0
