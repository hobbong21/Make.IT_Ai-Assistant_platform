# Create a new feature scaffold from _TEMPLATE
# Usage: .\deploy\scripts\new-feature.ps1 my-feature-name

param(
  [Parameter(Mandatory=$true)]
  [string]$Name
)

$ErrorActionPreference = "Stop"

# Validate name
if ($Name -match '[^a-z0-9\-]') {
  Write-Host "Error: Feature name must contain only lowercase letters, digits, and hyphens" -ForegroundColor Red
  exit 1
}

# Paths
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Src = Join-Path $Root "features" "_TEMPLATE"
$Dst = Join-Path $Root "features" $Name

# Check if already exists
if (Test-Path $Dst) {
  Write-Host "Error: Feature '$Name' already exists at $Dst" -ForegroundColor Red
  exit 1
}

# Check if template exists
if (-not (Test-Path $Src)) {
  Write-Host "Error: Template not found at $Src" -ForegroundColor Red
  exit 1
}

try {
  # Copy template
  Copy-Item -Recurse $Src $Dst
  Write-Host "Created features/$Name/" -ForegroundColor Green

  # Replace placeholders in copied files
  $Files = Get-ChildItem $Dst -Recurse -File
  foreach ($File in $Files) {
    $Content = Get-Content $File.FullName -Raw
    $Content = $Content -replace '\{feature-key\}', $Name
    $Content = $Content -replace '\{한국어 이름\}', "(수정 필요)"
    $Content = $Content -replace '\{요약\}', "(수정 필요)"
    Set-Content $File.FullName $Content -Encoding UTF8
  }

  Write-Host "Next steps:" -ForegroundColor Cyan
  Write-Host "1. Edit features/$Name/README.md"
  Write-Host "2. Edit features/$Name/manifest.json"
  Write-Host "3. Edit features/$Name/api.md"
  Write-Host "4. Edit features/$Name/changelog.md"

} catch {
  Write-Host "Error: $_" -ForegroundColor Red
  # Clean up on error
  if (Test-Path $Dst) {
    Remove-Item -Recurse -Force $Dst
  }
  exit 1
}
