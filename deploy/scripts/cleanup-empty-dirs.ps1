# 파일 구조 정리 후 빈 폴더 삭제 (사용자 머신에서 실행)
# 샌드박스 권한 제약으로 자동 정리 불가 → 사용자가 직접 실행

$ErrorActionPreference = "Stop"

$root = Split-Path $PSScriptRoot -Parent | Split-Path -Parent
Write-Host "프로젝트 루트: $root"

$empties = @("_workspace", "infra")

foreach ($dir in $empties) {
    $path = Join-Path $root $dir
    if (Test-Path $path) {
        $count = (Get-ChildItem -Path $path -Recurse -File | Measure-Object).Count
        if ($count -eq 0) {
            Write-Host "삭제: $dir/ (빈 폴더)" -ForegroundColor Yellow
            Remove-Item -Path $path -Recurse -Force
        } else {
            Write-Host "건너뜀: $dir/ ($count 파일 존재 — 수동 검토 필요)" -ForegroundColor Red
        }
    } else {
        Write-Host "건너뜀: $dir/ (이미 없음)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "정리 완료. 다음 명령으로 git 커밋:" -ForegroundColor Green
Write-Host "  git add -A"
Write-Host '  git commit -m "chore: 파일 구조 정리 - deploy/ + docs/ 통합 + _archive/ 분리"'
