"""Downloads the archival photos from Wikimedia Commons into public/photos/ (1600px wide).

Run: python scripts/photos.py
"""

import json
import pathlib
import sys
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")
UA = {"User-Agent": "VideoProjectBot/0.1 (personal use)"}
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "photos"

PHOTOS = {
    "1954": "File:1954 Geneva Conference.jpg",
    "1968": "File:Cholon after Tet Offensive operations 1968.jpg",
    "1972": "File:B-52 Debris, Shot Down Over Hanoi, Dec. 26, 1972 (9754102576).jpg",
    "1973": "File:Vietnam peace agreement signing.jpg",
    "1975": "File:843 T-54B tank - one of two that breached the Independence Palace 30th April 1975.jpg",
}

OUT.mkdir(parents=True, exist_ok=True)
for key, title in PHOTOS.items():
    q = urllib.parse.urlencode({"action": "query", "format": "json", "titles": title, "prop": "imageinfo",
                                "iiprop": "url|extmetadata", "iiurlwidth": 1600,
                                "iiextmetadatafilter": "LicenseShortName|Artist"})
    d = json.load(urllib.request.urlopen(urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + q, headers=UA)))
    page = next(iter(d["query"]["pages"].values()))
    if "imageinfo" not in page:
        print("MISSING", key, title)
        continue
    ii = page["imageinfo"][0]
    data = urllib.request.urlopen(urllib.request.Request(ii.get("thumburl") or ii["url"], headers=UA)).read()
    (OUT / f"{key}.jpg").write_bytes(data)
    m = ii["extmetadata"]
    print(key, len(data) // 1024, "KB |", m["LicenseShortName"]["value"], "|", ii["descriptionurl"])
