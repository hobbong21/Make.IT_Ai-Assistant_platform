# MaKIT — GitHub 첫 push 스크립트 (PowerShell)
#
# 사용법: PowerShell을 워크스페이스 루트에서 열고 아래 명령 실행
#   pwsh -ExecutionPolicy Bypass -File .\scripts\push-to-github.ps1
#
# 또는 한 줄로:
#   .\scripts\push-to-github.ps1
#
# 전제조건:
#   1) Git for Windows 설치됨 (git --version 확인)
#   2) GitHub 계정 인증 — 다음 중 하나:
#      a) GitHub CLI 로그인 (gh auth login) — 권장
#      b) Git Credential Manager가 PAT 캐싱
#      c) SSH key 등록 (이 경우 RemoteUrl을 git@github.com:... 으로 변경)
#   3) GitHub repo 'hobbong21/Make.IT_Ai-Assistant_platform' 가 생성되어 있을 것
#
# 안전 장치: .gitignore가 적용되며, .env / target/ / node_modules/ / .idea/ 등이 자동 제외됩니다.

$ErrorActionPreference = "Stop"

# === 설정 ===
$RepoRoot   = $PSScriptRoot | Split-Path -Parent
$RemoteUrl  = "https://github.com/hobbong21/Make.IT_Ai-Assistant_platform.git"
$BranchName = "main"
$CommitMsg  = "Initial commit: MaKIT AX 마케팅 플랫폼 v1 (D1 design tokens + 10 SVG illustrations)"
$UserName   = $null   # 비워두면 git config global 값 사용
$UserEmail  = $null   # 비워두면 git config global 값 사용

Set-Location $RepoRoot
Write-Host ""
Write-Host "=== MaKIT GitHub Push ===" -ForegroundColor Cyan
Write-Host "Repo root  : $RepoRoot"
Write-Host "Remote URL : $RemoteUrl"
Write-Host "Branch     : $BranchName"
Write-Host ""

# 1) Git 설치 확인
try { git --version | Out-Null } catch {
    Write-Error "Git이 설치되어 있지 않습니다. https://git-scm.com/download/win 에서 설치 후 다시 시도하세요."
    exit 1
}

# 2) 위험 파일 마지막 검사
Write-Host "[1/7] 시크릿 노출 검사..." -ForegroundColor Yellow
$danger = @()
if (Test-Path .env) { $danger += ".env" }
if (Test-Path *.pem) { $danger += "*.pem" }
$tfstate = Get-ChildItem -Recurse -Filter "*.tfstate*" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
if ($tfstate) { $danger += $tfstate }
if ($danger.Count -gt 0) {
    Write-Warning "다음 파일이 발견되었습니다. .gitignore에 의해 제외되지만 확인하세요:"
    $danger | ForEach-Object { Write-Host "  - $_" }
    Write-Host "계속하려면 Enter, 중단하려면 Ctrl+C" -ForegroundColor Yellow
    Read-Host
}

# 3) git init (없으면) + lock 파일 정리
# 주의: .git 폴더가 sandbox에서 부분 생성되어 corrupted 상태일 수 있음
if (Test-Path .git) {
    # 잔존 lock 파일 정리 (sandbox에서 unlink 불가능했던 케이스)
    if (Test-Path .git\config.lock)   { Remove-Item -Force .git\config.lock }
    if (Test-Path .git\index.lock)    { Remove-Item -Force .git\index.lock }
    if (Test-Path .git\HEAD.lock)     { Remove-Item -Force .git\HEAD.lock }

    # config 파일이 비었거나 깨졌는지 확인
    $configContent = Get-Content .git\config -Raw -ErrorAction SilentlyContinue
    if (-not $configContent -or $configContent.Length -lt 30) {
        Write-Host "[2/7] .git 손상 감지 — 삭제 후 재 init" -ForegroundColor Yellow
        Remove-Item -Recurse -Force .git
        git init -b $BranchName
    } else {
        Write-Host "[2/7] .git 이미 정상 존재 — init 스킵" -ForegroundColor Green
        git checkout -B $BranchName 2>$null
    }
} else {
    Write-Host "[2/7] git init..." -ForegroundColor Yellow
    git init -b $BranchName
}

# 4) user.name / user.email
Write-Host "[3/7] git user 확인..." -ForegroundColor Yellow
$currentName  = git config user.name 2>$null
$currentEmail = git config user.email 2>$null
if (-not $currentName) {
    if ($UserName) { git config user.name $UserName } else {
        $UserName = Read-Host "git user.name 을 입력하세요"
        git config user.name $UserName
    }
}
if (-not $currentEmail) {
    if ($UserEmail) { git config user.email $UserEmail } else {
        $UserEmail = Read-Host "git user.email 을 입력하세요"
        git config user.email $UserEmail
    }
}
Write-Host "  user.name : $(git config user.name)"
Write-Host "  user.email: $(git config user.email)"

# 5) remote 설정
Write-Host "[4/7] remote 설정..." -ForegroundColor Yellow
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    if ($existingRemote -ne $RemoteUrl) {
        Write-Host "  origin 변경: $existingRemote -> $RemoteUrl"
        git remote set-url origin $RemoteUrl
    } else {
        Write-Host "  origin 이미 설정됨 — 변경 없음"
    }
} else {
    git remote add origin $RemoteUrl
    Write-Host "  origin 추가됨"
}

# 6) staging + commit
Write-Host "[5/7] git add + commit..." -ForegroundColor Yellow
git add .
$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "  변경사항 없음 — commit 스킵" -ForegroundColor Green
} else {
    Write-Host "  $($staged.Count) 개 파일 staged"
    git commit -m $CommitMsg
}

# 7) push
Write-Host "[6/7] push..." -ForegroundColor Yellow
Write-Host "  GitHub 인증 창이 뜨면 PAT 또는 GitHub 계정으로 로그인하세요." -ForegroundColor Cyan
try {
    git push -u origin $BranchName
    Write-Host ""
    Write-Host "[7/7] === 완료 ===" -ForegroundColor Green
    Write-Host "$RemoteUrl" -ForegroundColor Cyan
    Write-Host "브라우저에서 위 URL을 열어 확인하세요."
} catch {
    Write-Host ""
    Write-Warning "push 실패."
    Write-Host "원인 가능성:"
    Write-Host "  1) origin repo가 비어있지 않음 (이미 README/LICENSE 등이 있음)"
    Write-Host "     → 해결: git pull --rebase origin $BranchName  후 다시 push"
    Write-Host "     → 또는 (원격 덮어쓰기, 위험): git push -f -u origin $BranchName"
    Write-Host "  2) 인증 실패 → gh auth login 또는 GitHub PAT 재설정"
    Write-Host "  3) repo가 존재하지 않음 → https://github.com/new 에서 hobbong21/Make.IT_Ai-Assistant_platform 생성"
    exit 1
}
