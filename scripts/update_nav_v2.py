#!/usr/bin/env python3
"""
intro 통일 nav 일괄 변경 (멱등):
- 라벨: "마케팅" -> "MaKIT", "백오피스" -> "서비스 체험" (top-nav anchor만)
- 버튼: ⚙️ navSettingsBtn -> ☰(hamburger) + aria-label "메뉴"
- 알람 버튼(navAlertBtn) 추가: navSettingsBtn 직전에 삽입
- intro.html처럼 navSettingsBtn이 없는 페이지: 로그인 anchor 직후에 두 버튼 모두 삽입
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_DIR = ROOT / "frontend"

ALERT_BTN = (
    '<button type="button" class="nav-alert-btn" id="navAlertBtn" '
    'aria-label="알림" title="알림">'
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" '
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
    'stroke-linejoin="round" aria-hidden="true">'
    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>'
    '<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>'
    '</svg>'
    '</button>'
)

MENU_BTN = (
    '<button type="button" class="nav-settings-btn" id="navSettingsBtn" '
    'aria-label="메뉴" aria-haspopup="true" aria-expanded="false" title="메뉴">'
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" '
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" '
    'stroke-linejoin="round" aria-hidden="true">'
    '<line x1="3" y1="6" x2="21" y2="6"></line>'
    '<line x1="3" y1="12" x2="21" y2="12"></line>'
    '<line x1="3" y1="18" x2="21" y2="18"></line>'
    '</svg>'
    '</button>'
)


def update_file(path: Path) -> bool:
    src = path.read_text(encoding="utf-8")
    orig = src

    # 1) top-nav anchor 라벨 변경 (top-nav/navbar 안에서만 있는 텍스트)
    src = src.replace('>마케팅</a>', '>MaKIT</a>')
    src = src.replace('>백오피스</a>', '>서비스 체험</a>')

    # 2) 기존 navSettingsBtn 블록 전체를 새 (ALERT + MENU)로 교체
    # 멱등성: 이미 navAlertBtn 있으면 navSettingsBtn만 ☰로 치환
    has_alert = 'id="navAlertBtn"' in src
    settings_btn_re = re.compile(
        r'<button[^>]*id="navSettingsBtn"[^>]*>.*?</button>',
        re.DOTALL,
    )

    if settings_btn_re.search(src):
        replacement = MENU_BTN if has_alert else (ALERT_BTN + MENU_BTN)
        src = settings_btn_re.sub(replacement, src, count=1)
    else:
        # 로그인 CTA anchor 직후에 두 버튼 삽입 (nav-links div 내부)
        login_anchor_re = re.compile(
            r'(<a\s+href="login\.html"[^>]*class="nav-link nav-link-cta"[^>]*>로그인</a>)'
        )
        if login_anchor_re.search(src):
            src = login_anchor_re.sub(
                r'\1\n                ' + ALERT_BTN + '\n                ' + MENU_BTN,
                src,
                count=1,
            )

    if src != orig:
        path.write_text(src, encoding="utf-8")
        return True
    return False


def main():
    targets = sorted(HTML_DIR.glob("*.html"))
    changed = []
    for p in targets:
        if update_file(p):
            changed.append(p.name)
    print("changed:", changed)
    print(f"total: {len(changed)}/{len(targets)}")


if __name__ == "__main__":
    main()
