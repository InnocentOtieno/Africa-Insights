#!/usr/bin/env python3
"""Refresh index levels, commodities, news and macro using Claude with web search.

Usage: python scripts/refresh_ai.py markets news [macro]

Every value is validated before it is written:
  * index levels: number > 0, dated within the last 7 days and not older than the stored
    date, and within ±12% of the stored level (else held back and flagged).
    YTD is recomputed from bases.json, never taken from the model.
  * commodities: dated within 7 days, within ±15% of the stored price.
  * news: schema, enums, https URL, dated within 7 days, de-duplicated by URL/headline.
  * macro: policy-rate moves over 5pp or CPI moves over 10pp are held back.
"""
import sys, re, datetime
from common import load, save, touch_meta, flag, claude, extract_json, parse_date, today, now_iso

SECTORS = ["Equities", "FX", "Rates & Debt", "PE/VC", "M&A", "Commodities", "Energy", "Fintech", "Telecoms", "Banking", "Mining", "Agriculture", "Policy", "Infrastructure"]
T = today()


def fresh(d, days=7):
    dd = parse_date(d)
    return dd is not None and T - datetime.timedelta(days=days) <= dd <= T


def markets():
    ex, macro, bases = load("exchanges"), load("macro"), load("bases")
    targets = [e for e in ex if e.get("index") and e.get("level")]
    lst = "\n".join(f'- {e["code"]}: {e["name"]} ({e["country"]}), index "{e["index"]}", last stored {e["level"]} on {e["date"]}' for e in targets)
    coms = "\n".join(f"- {c[0]} ({c[2]}), last stored {c[1]}" for c in macro["commodities"])
    prompt = f"""Today is {T.isoformat()}. Use web search to find the most recent official closing level of each African stock index below, and the latest price of each commodity.
Prefer the exchange's own website, african-markets.com, Reuters, Bloomberg, Investing.com or reputable local financial press. Only report a figure you actually found on a page; never estimate. If you cannot find a value dated within the last 7 days, omit that entry.

INDICES:
{lst}

COMMODITIES (use the same units):
{coms}

Return ONLY JSON in this shape, no prose:
{{"indices":[{{"code":"NGX","level":251191.02,"date":"YYYY-MM-DD","source_url":"https://..."}}],
  "commodities":[{{"name":"Gold","price":4276.9,"date":"YYYY-MM-DD","source_url":"https://..."}}]}}"""
    out = extract_json(claude(prompt, max_uses=20, max_tokens=6000))
    by = {e["code"]: e for e in ex}
    n = 0
    for r in out.get("indices", []):
        e = by.get(r.get("code"))
        lvl = r.get("level")
        if not e or not isinstance(lvl, (int, float)) or lvl <= 0:
            continue
        if not fresh(r.get("date")) or (parse_date(e.get("date")) and parse_date(r["date"]) < parse_date(e["date"])):
            continue
        if abs(lvl / e["level"] - 1) > 0.12:
            flag(f'index {e["code"]} held: {e["level"]} -> {lvl} ({r.get("source_url")})')
            continue
        e["level"], e["date"] = round(lvl, 2), r["date"]
        if e["code"] in bases["index"]:
            e["ytd"] = round((lvl / bases["index"][e["code"]] - 1) * 100, 2)
        if str(r.get("source_url", "")).startswith("https://"):
            e["src"] = r["source_url"]
        n += 1
    cm = 0
    cby = {c[0]: c for c in macro["commodities"]}
    for r in out.get("commodities", []):
        c = cby.get(r.get("name"))
        p = r.get("price")
        if not c or not isinstance(p, (int, float)) or p <= 0 or not fresh(r.get("date")):
            continue
        if abs(p / c[1] - 1) > 0.15:
            flag(f'commodity {c[0]} held: {c[1]} -> {p}')
            continue
        c[1] = p
        b = bases["commodities"].get(c[0])
        if b:
            c[3] = round((p / b - 1) * 100, 2)
        cm += 1
    if cm:
        macro["commodities_date"] = T.isoformat()
    save("exchanges", ex)
    save("macro", macro)
    touch_meta(markets_updated=now_iso())
    print(f"markets: {n} indices, {cm} commodities updated")


def news():
    st = load("stories")
    known = "\n".join(f'- {s["d"]} {s["h"]}' for s in sorted(st, key=lambda s: s["d"], reverse=True)[:40])
    prompt = f"""Today is {T.isoformat()}. Use web search to find the most important NEW developments for institutional investors in African capital markets and economies from the last 3 days: equities (IPOs, listings, big movers), FX and central-bank decisions, sovereign debt, PE/VC deals, M&A, commodities, energy, fintech, telecoms, banking, mining, agriculture, infrastructure and policy/regulation.
Skip anything already covered here:
{known}

Return ONLY a JSON array of up to 12 items, newest first, no prose. Write headlines and summaries in your own words (never copy article text):
[{{"d":"YYYY-MM-DD","h":"headline <=110 chars","s":"1-2 sentence summary","c":["Country"],"sec":"one of {SECTORS}","t":["TICKER.XX"],"sig":"bullish|bearish|neutral","imp":1-5,"opp":"one sentence: what a hedge fund, quant or PE investor might do or watch","src":"Publisher name","url":"https://..."}}]
Only include stories you actually found with a working URL."""
    items = extract_json(claude(prompt, max_uses=15, max_tokens=7000))
    if isinstance(items, dict):
        items = items.get("stories", [])
    urls = {s["url"] for s in st}
    heads = {re.sub(r"\W+", " ", s["h"].lower()).strip() for s in st}
    added = 0
    for s in items:
        try:
            ok = (fresh(s["d"]) and 10 <= len(s["h"]) <= 140 and s["sec"] in SECTORS and s["sig"] in ("bullish", "bearish", "neutral")
                  and int(s["imp"]) in range(1, 6) and str(s["url"]).startswith("https://") and isinstance(s["c"], list))
        except Exception:
            ok = False
        hk = re.sub(r"\W+", " ", str(s.get("h", "")).lower()).strip()
        if not ok or s["url"] in urls or hk in heads:
            continue
        st.append({"d": s["d"], "h": s["h"][:140], "s": str(s.get("s", ""))[:400], "c": s["c"][:8], "sec": s["sec"], "t": [str(x)[:20] for x in s.get("t", [])][:6],
                   "sig": s["sig"], "imp": int(s["imp"]), "opp": str(s.get("opp", ""))[:240], "src": str(s.get("src", ""))[:60], "url": s["url"]})
        urls.add(s["url"]); heads.add(hk); added += 1
    cutoff = (T - datetime.timedelta(days=90)).isoformat()
    st = sorted([s for s in st if s["d"] >= cutoff], key=lambda s: s["d"], reverse=True)[:150]
    save("stories", st)
    touch_meta(news_updated=now_iso())
    print(f"news: {added} stories added, {len(st)} kept")


def macro():
    mc = load("macro")
    lst = "\n".join(f"- {r[0]}: policy {r[1]}%, CPI {r[2]}%, 10y {r[4]}" for r in mc["macro"])
    prompt = f"""Today is {T.isoformat()}. Use web search (central-bank and statistics-office sites, TradingEconomics, Reuters) to update these African macro figures. Also give the current US Federal Reserve target range midpoint.
{lst}
Return ONLY JSON: {{"usd_rate":3.875,"countries":[{{"country":"Kenya","policy_rate":8.75,"cpi":6.6,"y10":12.26}}]}}. Omit any figure you could not confirm; never estimate."""
    out = extract_json(claude(prompt, max_uses=20, max_tokens=5000))
    by = {r[0]: r for r in mc["macro"]}
    n = 0
    for c in out.get("countries", []):
        r = by.get(c.get("country"))
        if not r:
            continue
        for key, idx, lim in (("policy_rate", 1, 5), ("cpi", 2, 10), ("y10", 4, 5)):
            v = c.get(key)
            if isinstance(v, (int, float)):
                if r[idx] is not None and abs(v - r[idx]) > lim:
                    flag(f"macro {r[0]} {key} held: {r[idx]} -> {v}")
                    continue
                r[idx] = v; n += 1
    u = out.get("usd_rate")
    if isinstance(u, (int, float)) and abs(u - mc["usd_rate"]) <= 1.5:
        mc["usd_rate"] = u
    save("macro", mc)
    touch_meta(macro_updated=now_iso())
    print(f"macro: {n} figures updated")


if __name__ == "__main__":
    jobs = {"markets": markets, "news": news, "macro": macro}
    failed = False
    for a in sys.argv[1:] or ["markets", "news"]:
        try:
            jobs[a]()
        except Exception as ex:
            failed = True
            print(f"{a} refresh failed: {ex}")
    sys.exit(1 if failed else 0)
