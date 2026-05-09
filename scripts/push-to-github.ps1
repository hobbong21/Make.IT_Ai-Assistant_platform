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
#   2) GitHub 계정 인증 — 다음 중 하나 (자동 감지 우선순위 순):
#      a) 환경변수 GITHUB_TOKEN (PAT) — 권장. 설정되어 있으면
#         `https://x-access-token:$env:GITHUB_TOKEN@github.com/...` 형태의 임시
#         URL로 push 시점에만 사용 (remote URL/credential store에 저장되지 않음).
#      b) GitHub CLI 로그인 (gh auth status 통과 시 `gh auth setup-git` 자동 실행)
#      c) Git Credential Manager가 PAT 캐싱
#      d) SSH key 등록 (이 경우 RemoteUrl을 git@github.com:... 으로 변경)
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

# 7) push — 자격 증명 자동 선택
Write-Host "[6/7] push..." -ForegroundColor Yellow
$pushMode = "default"
if ($env:GITHUB_TOKEN) {
    $pushMode = "token"
    Write-Host "  GITHUB_TOKEN 감지 — 임시 인증 URL로 push (토큰은 저장되지 않음)" -ForegroundColor Cyan
} else {
    $ghAvailable = $false
    try { gh auth status *> $null; if ($LASTEXITCODE -eq 0) { $ghAvailable = $true } } catch {}
    if ($ghAvailable) {
        $pushMode = "gh"
        Write-Host "  gh CLI 인증 감지 — 'gh auth setup-git' 으로 자격 증명 헬퍼 설정" -ForegroundColor Cyan
        try { gh auth setup-git *> $null } catch {}
    } else {
        Write-Host "  GITHUB_TOKEN/gh CLI 없음 — 시스템 기본 자격 증명(Credential Manager/SSH) 사용" -ForegroundColor Cyan
        Write-Host "  GitHub 인증 창이 뜨면 PAT 또는 GitHub 계정으로 로그인하세요."
    }
}

try {
    if ($pushMode -eq "token") {
        # remote URL을 변경하지 않고 push 시점에만 토큰을 주입
        $authedUrl = $RemoteUrl -replace "^https://", "https://x-access-token:$($env:GITHUB_TOKEN)@"
        git push -u $authedUrl "$($BranchName):$($BranchName)"
        if ($LASTEXITCODE -ne 0) { throw "git push failed (exit $LASTEXITCODE)" }
        # upstream 정보는 origin 기준으로 다시 설정
        git branch --set-upstream-to=origin/$BranchName $BranchName 2>$null | Out-Null
    } else {
        git push -u origin $BranchName
        if ($LASTEXITCODE -ne 0) { throw "git push failed (exit $LASTEXITCODE)" }
    }
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
    Write-Host "  2) 인증 실패 → 환경변수 GITHUB_TOKEN 설정(권장) 또는 'gh auth login'"
    Write-Host "     예: `$env:GITHUB_TOKEN='ghp_xxx'; .\scripts\push-to-github.ps1"
    Write-Host "  3) repo가 존재하지 않음 → https://github.com/new 에서 hobbong21/Make.IT_Ai-Assistant_platform 생성"
    exit 1
}
