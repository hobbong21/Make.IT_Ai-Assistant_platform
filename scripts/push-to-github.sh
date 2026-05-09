#!/usr/bin/env bash
# MaKIT — GitHub 첫 push 스크립트 (bash, macOS / Linux / WSL)
#
# 사용법:
#   chmod +x scripts/push-to-github.sh
#   ./scripts/push-to-github.sh
#
# 전제조건:
#   1) git 설치
#   2) GitHub 인증 — 다음 중 하나 (자동 감지 우선순위 순):
#      a) 환경변수 GITHUB_TOKEN (Personal Access Token) — 권장. 설정되어 있으면
#         `https://x-access-token:$GITHUB_TOKEN@github.com/...` 형태의 임시 URL로
#         push 시점에만 사용 (git config / remote URL에 저장하지 않음).
#      b) gh CLI 로그인 (gh auth status 통과 시 `gh auth setup-git` 자동 실행)
#      c) Git Credential Manager / SSH key 등 시스템 기본 자격 증명
#   3) GitHub repo 'hobbong21/Make.IT_Ai-Assistant_platform' 가 생성되어 있을 것

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_URL="https://github.com/hobbong21/Make.IT_Ai-Assistant_platform.git"
BRANCH_NAME="main"
COMMIT_MSG="Initial commit: MaKIT AX 마케팅 플랫폼 v1 (D1 design tokens + 10 SVG illustrations)"

cd "$REPO_ROOT"
echo ""
echo "=== MaKIT GitHub Push ==="
echo "Repo root  : $REPO_ROOT"
echo "Remote URL : $REMOTE_URL"
echo "Branch     : $BRANCH_NAME"
echo ""

command -v git >/dev/null 2>&1 || { echo "Git이 설치되어 있지 않습니다."; exit 1; }

# 시크릿 검사
echo "[1/7] 시크릿 노출 검사..."
DANGER=()
[[ -f .env ]] && DANGER+=(".env")
mapfile -t TFSTATES < <(find . -name "*.tfstate*" -not -path "./.git/*" 2>/dev/null)
DANGER+=("${TFSTATES[@]:-}")
if [[ ${#DANGER[@]} -gt 0 && -n "${DANGER[0]:-}" ]]; then
    echo "발견된 위험 파일 (.gitignore에 의해 제외됨):"
    printf '  - %s\n' "${DANGER[@]}"
    read -rp "계속하려면 Enter (Ctrl+C 중단): "
fi

# git init
if [[ ! -d .git ]]; then
    echo "[2/7] git init..."
    git init -b "$BRANCH_NAME"
else
    echo "[2/7] .git 이미 존재 — init 스킵"
    git checkout -B "$BRANCH_NAME" >/dev/null 2>&1 || true
fi

# user 확인
echo "[3/7] git user 확인..."
if ! git config user.name >/dev/null 2>&1; then
    read -rp "git user.name 을 입력하세요: " USER_NAME
    git config user.name "$USER_NAME"
fi
if ! git config user.email >/dev/null 2>&1; then
    read -rp "git user.email 을 입력하세요: " USER_EMAIL
    git config user.email "$USER_EMAIL"
fi
echo "  user.name : $(git config user.name)"
echo "  user.email: $(git config user.email)"

# remote
echo "[4/7] remote 설정..."
if EXISTING=$(git remote get-url origin 2>/dev/null); then
    if [[ "$EXISTING" != "$REMOTE_URL" ]]; then
        echo "  origin 변경: $EXISTING -> $REMOTE_URL"
        git remote set-url origin "$REMOTE_URL"
    else
        echo "  origin 이미 설정됨"
    fi
else
    git remote add origin "$REMOTE_URL"
    echo "  origin 추가됨"
fi

# add + commit
echo "[5/7] git add + commit..."
git add .
if git diff --cached --quiet; then
    echo "  변경사항 없음 — commit 스킵"
else
    STAGED_COUNT=$(git diff --cached --name-only | wc -l | tr -d ' ')
    echo "  $STAGED_COUNT 개 파일 staged"
    git commit -m "$COMMIT_MSG"
fi

# push — 자격 증명 자동 선택
echo "[6/7] push..."
PUSH_MODE="default"
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    PUSH_MODE="token"
    echo "  GITHUB_TOKEN 감지 — 임시 인증 URL로 push (토큰은 저장되지 않음)"
elif command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    PUSH_MODE="gh"
    echo "  gh CLI 인증 감지 — 'gh auth setup-git' 으로 자격 증명 헬퍼 설정"
    gh auth setup-git >/dev/null 2>&1 || true
else
    echo "  GITHUB_TOKEN/gh CLI 없음 — 시스템 기본 자격 증명(Credential Manager/SSH) 사용"
    echo "  GitHub 인증 창이 뜨면 PAT 또는 계정으로 로그인하세요."
fi

push_with_auth() {
    if [[ "$PUSH_MODE" == "token" ]]; then
        # remote URL을 변경하지 않고 push 시점에만 토큰을 주입
        local AUTHED_URL="${REMOTE_URL/https:\/\//https://x-access-token:${GITHUB_TOKEN}@}"
        git push -u "$AUTHED_URL" "$BRANCH_NAME:$BRANCH_NAME"
        # upstream 정보는 push 후 origin 기준으로 다시 설정
        git branch --set-upstream-to=origin/"$BRANCH_NAME" "$BRANCH_NAME" >/dev/null 2>&1 || true
    else
        git push -u origin "$BRANCH_NAME"
    fi
}

if push_with_auth; then
    echo ""
    echo "[7/7] === 완료 ==="
    echo "$REMOTE_URL"
else
    echo ""
    echo "push 실패. 원인 가능성:"
    echo "  1) origin repo가 비어있지 않음"
    echo "     해결: git pull --rebase origin $BRANCH_NAME  후 다시 push"
    echo "     또는 (위험): git push -f -u origin $BRANCH_NAME"
    echo "  2) 인증 실패 → 환경변수 GITHUB_TOKEN 설정(권장) 또는 'gh auth login'"
    echo "     예: export GITHUB_TOKEN=ghp_xxx && ./scripts/push-to-github.sh"
    echo "  3) repo 미생성 → https://github.com/new"
    exit 1
fi
