#!/usr/bin/env python3
"""Assemble the single-file product: src/* + embedded fonts -> index.html.

The buyer never runs this; it only exists so the source stays readable.
Usage: python3 build.py
"""
import base64
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"

FONTS = [
    # (family, weight, style, file)
    ("Fraunces", 500, "normal", "fraunces-latin-500-normal.woff2"),
    ("Fraunces", 600, "normal", "fraunces-latin-600-normal.woff2"),
    ("Fraunces", 500, "italic", "fraunces-latin-500-italic.woff2"),
    ("DM Sans", 400, "normal", "dm-sans-latin-400-normal.woff2"),
    ("DM Sans", 500, "normal", "dm-sans-latin-500-normal.woff2"),
    ("DM Sans", 700, "normal", "dm-sans-latin-700-normal.woff2"),
    ("Caveat", 600, "normal", "caveat-latin-600-normal.woff2"),
]


def font_faces():
    out = ["/* Fonts: Fraunces, DM Sans, Caveat — SIL Open Font License 1.1 */"]
    for family, weight, style, name in FONTS:
        data = base64.b64encode((SRC / "fonts" / name).read_bytes()).decode()
        out.append(
            f'@font-face{{font-family:"{family}";font-style:{style};font-weight:{weight};'
            f"font-display:swap;src:url(data:font/woff2;base64,{data}) format(\"woff2\");}}"
        )
    return "\n".join(out)


def main():
    html = (SRC / "template.html").read_text()
    html = html.replace("/*__FONTS__*/", font_faces())
    html = html.replace("/*__STYLES__*/", (SRC / "styles.css").read_text())
    html = html.replace("/*__SCRIPT__*/", (SRC / "app.js").read_text())
    (ROOT / "index.html").write_text(html)
    print(f"index.html written ({len(html) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
