"""Downloads the archival photos for episode 3 from Wikimedia Commons into public/photos/tap3/
(1600 px wide) and writes public/photos/tap3/credits.json with each file's licence and source.

Only public-domain files are kept; anything else is reported and skipped.
Run: python scripts/photos_tap3.py
"""

import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")
UA = {"User-Agent": "VideoProjectBot/0.1 (personal history video project)"}
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "photos" / "tap3"

# key: (search terms, start of the Commons file title)
PHOTOS = {
    "nixon": ("Richard Nixon presidential portrait", "File:Richard Nixon presidential portrait (1)"),
    "midway": ("Nixon Thieu Midway 1969", "File:President Richard Nixon and South Vietnam's President Nguyen Van Thieu"),
    "hcm": ("Ho Chi Minh 1946 and signature", "File:Ho Chi Minh 1946 and signature (cropped)"),
    "pentagon": ("Pentagon Papers Part IV A 5 Page 99", "File:Pentagon-Papers-Part IV. A. 5 - Page 99"),
    "nixon-mao": ("President Richard Nixon and Mao Zedong", "File:President Richard Nixon and Mao Zedong"),
    "nixon-brezhnev": ("Nixon Brezhnev signing 1972", "File:President Richard Nixon and General Secretary Leonid Brezhnev Signing"),
    "b52": ("B-52Gs at Andersen AFB during Linebacker II", "File:B-52Gs at Andersen AFB during Linebacker II"),
    "paris-signing": ("Vietnam peace agreement signing cropped", "File:Vietnam peace agreement signing (cropped)"),
    "tho-kissinger": ("Le duc Tho and Henry Kissinger White House photo", "File:Le duc Tho and Henry Kissinger"),
}


def api(**q):
    q.update(format="json", action="query")
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q)
    for attempt in range(5):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30))
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(10 * (attempt + 1))  # rate limited: back off
    raise RuntimeError("Commons keeps rate-limiting, try again later")


OUT.mkdir(parents=True, exist_ok=True)
credits_file = OUT / "credits.json"
credits = json.loads(credits_file.read_text(encoding="utf-8")) if credits_file.exists() else {}
for key, (terms, prefix) in PHOTOS.items():
    if key in credits and (OUT / f"{key}.jpg").exists():
        continue
    d = api(generator="search", gsrsearch=f"filetype:bitmap {terms}", gsrnamespace=6, gsrlimit=10, prop="imageinfo",
            iiprop="url|size|extmetadata", iiurlwidth=1600,
            iiextmetadatafilter="LicenseShortName|Artist|Credit|DateTimeOriginal|ImageDescription")
    pages = d.get("query", {}).get("pages", {}).values()
    page = next((p for p in pages if p["title"].startswith(prefix)), None)
    if not page:
        print("NOT FOUND", key, prefix)
        continue
    ii = page["imageinfo"][0]
    m = {k: v.get("value", "") for k, v in ii.get("extmetadata", {}).items()}
    lic = m.get("LicenseShortName", "")
    if "public domain" not in lic.lower() and lic.upper() not in ("CC0", "PD"):
        print("SKIPPED (licence)", key, lic, ii["descriptionurl"])
        continue
    data = urllib.request.urlopen(urllib.request.Request(ii.get("thumburl") or ii["url"], headers=UA), timeout=60).read()
    (OUT / f"{key}.jpg").write_bytes(data)
    strip = lambda s: urllib.parse.unquote(__import__("re").sub(r"<[^>]+>", "", s)).strip()
    credits[key] = {"title": page["title"], "license": lic, "date": strip(m.get("DateTimeOriginal", ""))[:40],
                    "author": strip(m.get("Artist", ""))[:80], "credit": strip(m.get("Credit", ""))[:120],
                    "source": ii["descriptionurl"], "width": ii.get("thumbwidth") or ii["width"],
                    "height": ii.get("thumbheight") or ii["height"]}
    credits_file.write_text(json.dumps(credits, ensure_ascii=False, indent=1), encoding="utf-8")
    print(key, len(data) // 1024, "KB |", lic, "|", credits[key]["date"], "|", ii["descriptionurl"])
    time.sleep(3)
