#!/usr/bin/env python3
"""Auto-generate sitemap.xml from every real .html page under web/.

Run on every deploy so new pages get indexed automatically.

Rules:
- one <url> per .html file (index.html -> the directory URL, no filename)
- priority by section, changefreq by how often it moves
- lastmod = file mtime
- skips non-indexable pages (404, noindex) and asset dirs
"""
import os, re, datetime

WEB = os.path.dirname(os.path.abspath(__file__))
DOMAIN = "https://seviyorsevmiyor.noseydewdrop.com"

# section -> (priority, changefreq)
RULES = {
    "": (1.0, "daily"),   # root index
}
SKIP_FILES = {"404.html"}
SKIP_DIRS = {"assets", "css", "js", "styles", "vendor", "data", "pdf",
             ".git", ".vercel", ".wrangler", "node_modules"}

def is_indexable(path):
    try:
        head = open(path, encoding="utf-8", errors="ignore").read(4000)
    except Exception:
        return True
    if re.search(r'name=["\']robots["\'][^>]*noindex', head, re.I):
        return False
    return True

def url_for(rel):
    if rel == "index.html":
        return DOMAIN + "/"
    if rel.endswith("/index.html"):
        return f"{DOMAIN}/{rel[:-len('index.html')]}"
    return f"{DOMAIN}/{rel}"

def section_of(rel):
    return rel.split("/")[0] if "/" in rel else ""

entries = []
for root, dirs, files in os.walk(WEB):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for f in files:
        if not f.endswith(".html") or f in SKIP_FILES:
            continue
        full = os.path.join(root, f)
        rel = os.path.relpath(full, WEB).replace(os.sep, "/")
        if not is_indexable(full):
            continue
        sec = section_of(rel)
        prio, freq = RULES.get(sec, (0.6, "monthly"))
        mtime = datetime.date.fromtimestamp(os.path.getmtime(full)).isoformat()
        entries.append((url_for(rel), mtime, freq, prio))

entries.sort(key=lambda e: (-e[3], e[0]))

out = ['<?xml version="1.0" encoding="UTF-8"?>',
       '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for url, mod, freq, prio in entries:
    out.append(f'  <url><loc>{url}</loc><lastmod>{mod}</lastmod>'
               f'<changefreq>{freq}</changefreq><priority>{prio}</priority></url>')
out.append('</urlset>')

open(os.path.join(WEB, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print(f"sitemap.xml regenerated: {len(entries)} urls")
