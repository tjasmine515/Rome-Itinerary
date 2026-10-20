#!/usr/bin/env python3
"""Assemble each city's single-file site: src/* + cities/<city>/* -> dist/<city>/.

The buyer never runs this; it only exists so the source stays readable.
Usage: python3 build.py            (every city)
       python3 build.py paris      (one city)

Each dist/<city>/ folder is ready to drag onto Netlify as-is.
"""
import base64
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
CITIES = ROOT / "cities"
DIST = ROOT / "dist"


def font_faces(fonts):
    families = ", ".join(dict.fromkeys(f[0] for f in fonts))
    out = [f"/* Fonts: {families} — SIL Open Font License 1.1 */"]
    for family, weight, style, name in fonts:
        data = base64.b64encode((SRC / "fonts" / name).read_bytes()).decode()
        out.append(
            f'@font-face{{font-family:"{family}";font-style:{style};font-weight:{weight};'
            f"font-display:swap;src:url(data:font/woff2;base64,{data}) format(\"woff2\");}}"
        )
    return "\n".join(out)


def build(city_id):
    cdir = CITIES / city_id
    city = json.loads((cdir / "city.json").read_text())
    hero = (cdir / "hero.svg").read_text().strip()
    prelude = (
        f"const CITY = {json.dumps(city, ensure_ascii=False, separators=(',', ':'))};\n"
        f"const CITY_HERO = {json.dumps(hero, ensure_ascii=False)};\n"
    )
    script = (SRC / "app.js").read_text()
    # keep 'use strict' as the first statement
    head, _, rest = script.partition("\n")
    html = (SRC / "template.html").read_text()
    html = html.replace("<!--__HEAD__-->\n", (cdir / "head.html").read_text())
    html = html.replace("/*__FONTS__*/", font_faces(city["fonts"]))
    html = html.replace("/*__STYLES__*/", (SRC / "styles.css").read_text() + "\n" + (cdir / "theme.css").read_text())
    html = html.replace("/*__SCRIPT__*/", head + "\n" + prelude + rest)

    out = DIST / city_id
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    (out / "index.html").write_text(html)
    # trip links look like /t/<id>; Netlify serves the app for them
    (out / "_redirects").write_text("/t/*  /index.html  200\n")
    for extra in ("icons", "images"):
        if (cdir / extra).is_dir():
            shutil.copytree(cdir / extra, out / extra)
    print(f"dist/{city_id}/index.html written ({len(html) / 1024:.0f} KB)")


def main():
    ids = sys.argv[1:] or sorted(p.name for p in CITIES.iterdir() if (p / "city.json").exists())
    for city_id in ids:
        build(city_id)


if __name__ == "__main__":
    main()
