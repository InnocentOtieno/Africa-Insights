"""Shared helpers for the Africa Insights data pipeline (standard library only)."""
import datetime, json, os, re, time, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "site" / "data"


def load(name):
    return json.loads((DATA / f"{name}.json").read_text())


def save(name, obj):
    tmp = DATA / f".{name}.json.tmp"
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=None, separators=(",", ":")))
    tmp.replace(DATA / f"{name}.json")


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today():
    return datetime.datetime.now(datetime.timezone.utc).date()


def touch_meta(**fields):
    meta = load("meta")
    meta.update(fields)
    meta["updated"] = now_iso()
    meta["asof"] = today().isoformat()
    save("meta", meta)


def flag(msg):
    """Record a held-back value so a human can review it (kept to the last 30)."""
    meta = load("meta")
    flags = meta.get("flags", [])
    flags.append(f"{now_iso()} {msg}")
    meta["flags"] = flags[-30:]
    save("meta", meta)
    print("FLAG:", msg)


def http_json(url, data=None, headers=None, timeout=60):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers={"user-agent": "africa-insights-bot/1.0", **(headers or {})}, method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def parse_date(s):
    try:
        return datetime.date.fromisoformat(str(s)[:10])
    except Exception:
        return None


# ---------------- Claude with web search ----------------
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
SEARCH_TOOL = os.environ.get("ANTHROPIC_SEARCH_TOOL", "web_search_20250305")


def claude(prompt, max_uses=12, max_tokens=8000):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    msgs = [{"role": "user", "content": prompt}]
    text = ""
    for _ in range(5):  # continue through pause_turn
        body = {"model": MODEL, "max_tokens": max_tokens, "messages": msgs,
                "tools": [{"type": SEARCH_TOOL, "name": "web_search", "max_uses": max_uses}]}
        for attempt in range(3):
            try:
                res = http_json("https://api.anthropic.com/v1/messages", body,
                                {"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"}, timeout=600)
                break
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 529) and attempt < 2:
                    time.sleep(20 * (attempt + 1))
                    continue
                raise RuntimeError(f"Anthropic API {e.code}: {e.read().decode()[:400]}")
        text = "".join(b.get("text", "") for b in res.get("content", []) if b.get("type") == "text")
        if res.get("stop_reason") == "pause_turn":
            msgs.append({"role": "assistant", "content": res["content"]})
            continue
        break
    return text


def extract_json(text):
    m = re.search(r"```(?:json)?\s*([\[{].*?[\]}])\s*```", text, re.S)
    raw = m.group(1) if m else None
    if raw is None:
        starts = [i for i in (text.find("["), text.find("{")) if i >= 0]
        if not starts:
            raise ValueError("no JSON in model output")
        s = min(starts)
        e = max(text.rfind("]"), text.rfind("}"))
        raw = text[s:e + 1]
    return json.loads(raw)
