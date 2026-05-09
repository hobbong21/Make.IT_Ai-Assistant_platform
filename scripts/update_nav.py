#!/usr/bin/env python3
"""One-shot updater: reorder header nav (서비스 체험 ↔ 플랫폼) and inject 설정 button after 로그인.
Run from project root: python3 scripts/update_nav.py
"""
import re
import sys
from pathlib import Path

FILES = [
    "frontend/intro.html",
    "frontend/index.html",
    "frontend/login.html",
    "frontend/settings.html",
    "frontend/admin.html",
    "frontend/all-services.html",
    "frontend/components.html",
    "frontend/marketing-playbook.html",
    "frontend/marketing-playbooks.html",
    "frontend/marketing-hub.html",
    "frontend/history.html",
    "frontend/404.html",
    "frontend/service-detail.html",
]

# Match: 서비스 체험 line followed by 플랫폼 line (with same indent), capture full lines incl. newline
SWAP_RE = re.compile(
    r'(^([ \t]*)<a href="all-services\.html"[^>]*>서비스 체험</a>\n)'
    r'(^[ \t]*<a href="index\.html"[^>]*>플랫폼</a>\n)',
    re.MULTILINE,
)

# Match the 로그인 CTA line; insert settings button right after it.
LOGIN_RE = re.compile(
    r'(^([ \t]*)<a href="login\.html"[^>]*class="[^"]*nav-link-cta[^"]*"[^>]*>로그인</a>\n)',
    re.MULTILINE,
)

SETTINGS_BTN = (
    '{indent}<button type="button" class="nav-settings-btn" id="navSettingsBtn" '
    'aria-label="설정" aria-haspopup="true" aria-expanded="false" title="설정">'
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<circle cx="12" cy="12" r="3"></circle>'
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06'
    'a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4'
    'a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82'
    ' 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82'
    'l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51'
    'V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0'
    ' 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4'
    'h-.09a1.65 1.65 0 0 0-1.51 1z"></path>'
    '</svg></button>\n'
)

# Add settings-menu.js script tag after app-shell-extras.js when present.
SHELL_EXTRAS_RE = re.compile(
    r'(^([ \t]*)<script src="js/widgets/app-shell-extras\.js"></script>\n)',
    re.MULTILINE,
)
# Add modal.js + auth-gate.js + settings-menu.js dependency where missing.
# Strategy: ensure settings-menu.js after auth.js (or after app-shell-extras.js if present).
AUTH_SCRIPT_RE = re.compile(
    r'(^([ \t]*)<script src="js/core/auth\.js"></script>\n)',
    re.MULTILINE,
)


def update(text: str) -> tuple[str, list[str]]:
    notes: list[str] = []
    new = text

    # 1) Swap order
    def swap(m: re.Match) -> str:
        return m.group(3) + m.group(1)

    swapped = SWAP_RE.subn(swap, new)
    new, n = swapped[0], swapped[1]
    if n:
        notes.append(f"swap×{n}")

    # 2) Insert settings button after login CTA
    def insert_btn(m: re.Match) -> str:
        indent = m.group(2)
        # If settings button already present (idempotent), skip
        # Caller checks for existence below
        return m.group(1) + SETTINGS_BTN.format(indent=indent)

    if 'navSettingsBtn' not in new:
        new, n2 = LOGIN_RE.subn(insert_btn, new)
        if n2:
            notes.append(f"settings-btn×{n2}")

    # 3) Inject <script src="js/widgets/settings-menu.js"> after app-shell-extras.js or auth.js
    if 'settings-menu.js' not in new:
        def add_after_extras(m: re.Match) -> str:
            return m.group(1) + f'{m.group(2)}<script src="js/widgets/settings-menu.js"></script>\n'

        new2, n3 = SHELL_EXTRAS_RE.subn(add_after_extras, new, count=1)
        if n3:
            new = new2
            notes.append("script(after extras)")
        else:
            def add_after_auth(m: re.Match) -> str:
                return m.group(1) + f'{m.group(2)}<script src="js/widgets/settings-menu.js"></script>\n'

            new3, n4 = AUTH_SCRIPT_RE.subn(add_after_auth, new, count=1)
            if n4:
                new = new3
                notes.append("script(after auth)")

    return new, notes


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    fail = 0
    for rel in FILES:
        p = root / rel
        if not p.exists():
            print(f"  SKIP  {rel} (missing)")
            continue
        original = p.read_text(encoding="utf-8")
        updated, notes = update(original)
        if updated == original:
            print(f"  ----  {rel} (no change)")
            continue
        p.write_text(updated, encoding="utf-8")
        print(f"  OK    {rel}  [{', '.join(notes) if notes else 'changed'}]")
    return fail


if __name__ == "__main__":
    sys.exit(main())
