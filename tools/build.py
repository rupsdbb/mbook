#!/usr/bin/env python3
"""Build a single self-contained HTML file for sharing (e.g. on OneDrive).

Usage: python3 tools/build.py

Joins index.html, css/app.css, js/*.js and the data files into
dist/MBook.html, which works offline with a double-click. Your own
data/sor.js is built in when present; otherwise the sample SOR is.

Also writes dist/MBook-<version>.zip: the HTML file plus the drawings/ folder,
for people who want the drawing links to work too. The version comes from
js/app.js.

dist/ is kept out of git: with data/sor.js built in it holds your rates.
"""
import datetime
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
NAME = "MBook"


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def inline_js(code):
    # "</script" inside the code would end the inline <script> early
    return re.sub(r"</(script)", r"<\\/\1", code, flags=re.I)


def app_version():
    m = re.search(r"version:\s*'([^']+)'", read("js/app.js"))
    if not m:
        sys.exit("build: no version found in js/app.js")
    return m.group(1)


def main():
    version = app_version()
    html = read("index.html")
    has_sor = os.path.exists(os.path.join(ROOT, "data", "sor.js"))
    built = datetime.date.today()

    html = html.replace('<link rel="stylesheet" href="css/app.css">',
                        "<style>\n" + read("css/app.css") + "</style>")

    def script(m):
        src = m.group(1)
        if src == "data/sor.sample.js" and has_sor:
            return ""  # the real SOR is built in; the sample is not needed
        if src == "data/sor.js" and not has_sor:
            return ""
        return "<script>\n" + inline_js(read(src)) + "\n</script>"

    html, n = re.subn(r'<script src="([^"]+)"></script>', script, html)
    if '<script src="' in html or 'href="css/' in html:
        sys.exit("build: a file reference was left unresolved")

    stamp = (f"<script>window.BUILD = {{ date: '{built.isoformat()}', "
             f"sor: '{'own SOR' if has_sor else 'sample SOR'}' }};</script>\n")
    html = html.replace("<script>", stamp + "<script>", 1)
    html = html.replace("<!-- data/sor.js is your own SOR (kept out of the repository); "
                        "the sample is used when it is absent -->\n", "")

    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, NAME + ".html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)

    zpath = os.path.join(DIST, f"{NAME}-{version}.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(out, f"{NAME}/{NAME}.html")
        z.writestr(f"{NAME}/How to use.txt",
                   HOW_TO.format(name=NAME, version=version, date=built.strftime("%d-%m-%Y")))
        ddir = os.path.join(ROOT, "drawings")
        for fn in sorted(os.listdir(ddir)):
            z.write(os.path.join(ddir, fn), f"{NAME}/drawings/{fn}")

    kb = lambda p: os.path.getsize(p) // 1024
    print(f"{out}  (v{version}, {kb(out)} KB, {'own' if has_sor else 'sample'} SOR, {n} files inlined)")
    print(f"{zpath}  ({kb(zpath)} KB, with drawings/)")


HOW_TO = """{name} {version} - BOQ Measurement (built {date})

1. Keep {name}.html and the drawings folder together in one folder on your PC.
2. Double-click {name}.html. It opens in your browser (Chrome or Edge) and
   works offline - nothing to install.
3. Your work autosaves in that browser. Use Save to keep a .boq file you can
   back up or send to someone, and Open to load one.

Drawing numbers in the SOR text open the matching PDF from the drawings folder.
To use a newer version, replace {name}.html; your autosaved work stays.
"""

if __name__ == "__main__":
    main()
