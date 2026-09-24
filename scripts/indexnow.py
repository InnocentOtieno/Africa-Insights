#!/usr/bin/env python3
"""Tell Bing, Yandex and other IndexNow engines that pages changed (Google reads the sitemap)."""
import json, os
from urllib.parse import urlparse
from pathlib import Path
from common import http_json

key = os.environ.get("INDEXNOW_KEY", "").strip()
urls = json.loads((Path(__file__).parent / ".urls.json").read_text())
if not key or not urls:
    raise SystemExit("INDEXNOW_KEY not set; skipping")
host = urlparse(urls[0]).netloc
try:
    http_json("https://api.indexnow.org/indexnow", {"host": host, "key": key, "keyLocation": f"https://{host}/{key}.txt", "urlList": urls[:10000]}, {"content-type": "application/json"})
except Exception as e:  # IndexNow returns 200/202 with an empty body
    if "Expecting value" not in str(e):
        print("IndexNow:", e)
print(f"IndexNow pinged {len(urls)} URLs for {host}")
