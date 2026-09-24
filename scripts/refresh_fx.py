#!/usr/bin/env python3
"""Refresh African FX rates vs USD from the free ExchangeRate-API open endpoint.

YTD is recomputed from the 31 Dec 2025 base in bases.json, so a bad source value
cannot silently rewrite history. Moves over 25% versus the last stored rate are
held back and flagged for review (set FORCE=1 to accept, e.g. after a devaluation).
Attribution required by the provider: "Rates by Exchange Rate API" (shown under Method).
"""
import datetime, os
from common import load, save, touch_meta, flag, http_json, now_iso

FORCE = os.environ.get("FORCE") == "1"


def main():
    res = http_json("https://open.er-api.com/v6/latest/USD")
    if res.get("result") != "success":
        raise SystemExit(f"FX source error: {res}")
    rates = res["rates"]
    macro, bases = load("macro"), load("bases")
    changed = 0
    for row in macro["fx"]:
        ccy, prev = row[0], row[2]
        r = rates.get(ccy)
        if r is None and ccy == "SLE" and rates.get("SLL"):
            r = rates["SLL"] / 1000
        if r is None:
            print("no quote for", ccy)
            continue
        if prev and abs(r / prev - 1) > 0.25 and not FORCE:
            flag(f"FX {ccy} held: {prev} -> {r} (>25% move)")
            continue
        base = bases["fx"].get(ccy)
        row[2] = round(r, 6 if r < 10 else 4)
        if base:
            row[3] = round((base / r - 1) * 100, 2)
        changed += 1
    date = res.get("time_last_update_utc", "")
    if res.get("time_last_update_unix"):
        macro["fx_date"] = datetime.datetime.fromtimestamp(res["time_last_update_unix"], datetime.timezone.utc).date().isoformat()
    macro["fx_src"] = "https://www.exchangerate-api.com"
    save("macro", macro)
    touch_meta(fx_updated=now_iso())
    print(f"FX updated {changed} currencies · source time {date}")


if __name__ == "__main__":
    main()
