#!/usr/bin/env python3
"""Build the static Africa Insights site from docs/data/*.json.

Writes: docs/index.html, docs/markets/**, docs/news/, docs/feed.xml,
docs/sitemap.xml, docs/robots.txt, docs/terms/, docs/privacy/, docs/404.html.
Run after every data refresh. Needs only the Python standard library.
"""
import html, json, math, os, re, hashlib, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_DIR = ROOT / "docs"
DATA = SITE_DIR / "data"
TPL = ROOT / "templates" / "index.html"
SITE = os.environ.get("SITE_URL", "https://africa-insights.pages.dev").rstrip("/")
BRAND = "Africa Insights"
e = lambda s: html.escape(str(s if s is not None else ""), quote=True)


def load():
    d = {k: json.loads((DATA / f"{k}.json").read_text()) for k in ["exchanges", "macro", "stories", "people"]}
    mp = DATA / "meta.json"
    d["meta"] = json.loads(mp.read_text()) if mp.exists() else {"asof": datetime.date.today().isoformat(), "updated": None}
    return d


def fmt(v, dp=1):
    return "—" if v is None else f"{v:,.{dp}f}"


def sp(v, dp=1):
    if v is None:
        return "—"
    return ("+" if v > 0 else "−" if v < 0 else "") + f"{abs(v):,.{dp}f}%"


def slug(code):
    return re.sub(r"[^a-z0-9]+", "-", code.lower()).strip("-")


def model(d):
    fx = {r[0]: {"ccy": r[0], "country": r[1], "rate": r[2], "ytd": r[3], "y1": r[4], "regime": r[5]} for r in d["macro"]["fx"]}
    fx["USD"] = {"ccy": "USD", "country": "US dollar", "rate": 1, "ytd": 0, "y1": 0, "regime": "USD"}
    mac = {r[0]: {"pr": r[1], "cpi": r[2], "gdp": r[3], "y10": r[4], "rating": r[5]} for r in d["macro"]["macro"]}
    ex = []
    for x in d["exchanges"]:
        f = fx.get(x["ccy"])
        usd = ((1 + x["ytd"] / 100) * (1 + f["ytd"] / 100) - 1) * 100 if x.get("ytd") is not None and f else None
        ex.append({**x, "fxo": f, "mac": mac.get(x["country"]), "usd": usd})
    elig = [x for x in ex if x["usd"] is not None and x.get("mcap")]
    tot = sum(x["mcap"] for x in elig)
    w = [x["mcap"] / tot for x in elig]
    for _ in range(50):
        over = [v > 0.2 + 1e-9 for v in w]
        if not any(over):
            break
        exc = sum(v - 0.2 for v, o in zip(w, over) if o)
        free = sum(v for v, o in zip(w, over) if not o)
        w = [0.2 if o else v + exc * v / free for v, o in zip(w, over)]
    comp = sum(wi * x["usd"] for wi, x in zip(w, elig))
    for wi, x in zip(w, elig):
        x["w"] = wi
    return {"fx": fx, "mac": mac, "ex": ex, "comp": comp, "n": len(elig)}


def page(title, desc, path, body, jsonld=None, ver=""):
    ld = f'<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>' if jsonld else ""
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{e(title)}</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{SITE}{path}">
<meta property="og:type" content="article"><meta property="og:site_name" content="{BRAND}"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{SITE}{path}"><meta property="og:image" content="{SITE}/assets/og.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="alternate" type="application/rss+xml" title="{BRAND} newswire" href="/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/assets/styles.css?v={ver}">{ld}</head>
<body><div class="wrap page">
<header class="top"><a class="brand" href="/" style="text-decoration:none;color:inherit"><b>AFRICA <i>INSIGHTS</i></b><span>Markets terminal</span></a><div class="spacer"></div>
<nav class="navlinks"><a href="/">Terminal</a><a href="/markets/">Markets</a><a href="/news/">Newswire</a><a href="/#meth">Method</a></nav></header>
{body}
<p class="foot">{BRAND} · research and education only, not investment advice. Prices can be delayed. · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a> · <a href="/feed.xml">RSS</a></p>
</div></body></html>"""


def main():
    d = load()
    m = model(d)
    meta = d["meta"]
    updated = meta.get("updated") or meta.get("asof")
    ver = hashlib.sha1((str(updated) + (SITE_DIR / "assets" / "app.js").read_text() + (SITE_DIR / "assets" / "styles.css").read_text()).encode()).hexdigest()[:8]
    stories = sorted(d["stories"], key=lambda s: s["d"], reverse=True)
    level = 1000 * (1 + m["comp"] / 100)
    board = sorted([x for x in m["ex"] if x["usd"] is not None], key=lambda x: -x["usd"])
    top3 = ", ".join(f'{x["code"]} {sp(x["usd"], 0)}' for x in board[:3])
    urls = []

    # ---------- home ----------
    title = f"{BRAND}: Africa stock markets, FX and rates terminal"
    desc = (f"Live pan-African markets terminal covering {len(m['ex'])} exchanges. Africa Insights Composite {fmt(level, 0)} "
            f"({sp(m['comp'])} YTD in USD). Leaders: {top3}. FX, carry, scenario lab, PESTLE risk, newswire and Africa's richest.")
    rows = "".join(f'<tr><td><a href="/markets/{slug(x["code"])}/">{e(x["code"])}</a></td><td>{e(x["country"])}</td><td>{e(x.get("index") or "—")}</td><td class="r num">{fmt(x.get("level"), 2)}</td><td class="r num">{sp(x.get("ytd"))}</td><td class="r num">{sp(x["usd"])}</td></tr>' for x in board)
    seo = f"""<h2>Africa's stock markets today</h2>
<p>The {BRAND} Composite (AIC), a USD-converted, cap-weighted index of {m['n']} African exchanges with a 20% single-market cap, stands at <b>{fmt(level, 2)}</b>, {sp(m['comp'], 2)} since 31 December 2025. Data last updated {e(updated)}.</p>
<div class="tw"><table><thead><tr><th class="nosort">Exchange</th><th class="nosort">Country</th><th class="nosort">Index</th><th class="r nosort">Level</th><th class="r nosort">YTD local</th><th class="r nosort">YTD USD</th></tr></thead><tbody>{rows}</tbody></table></div>
<h2>Latest African market news</h2><ul>{''.join(f'<li><time datetime="{e(s["d"])}">{e(s["d"])}</time> · {e(s["h"])} <a href="{e(s["url"])}" rel="noopener nofollow" target="_blank">{e(s["src"])}</a></li>' for s in stories[:12])}</ul>
<p><a href="/markets/">All {len(m['ex'])} African exchanges</a> · <a href="/news/">Full newswire</a></p>"""
    jsonld = [
        {"@context": "https://schema.org", "@type": "WebSite", "name": BRAND, "url": SITE + "/", "description": desc},
        {"@context": "https://schema.org", "@type": "Dataset", "name": "Africa Insights Composite and African exchange data",
         "description": "Index levels, year-to-date returns in local currency and USD, market capitalisation, FX rates, policy rates and inflation for African markets.",
         "url": SITE + "/", "dateModified": updated, "creator": {"@type": "Organization", "name": BRAND},
         "spatialCoverage": "Africa", "isAccessibleForFree": True,
         "distribution": [{"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": f"{SITE}/data/{k}.json"} for k in ["exchanges", "macro"]]}
    ]
    snap = dict(d)
    t = TPL.read_text()
    out = (t.replace("{{TITLE}}", e(title)).replace("{{DESC}}", e(desc)).replace("{{SITE}}", SITE).replace("{{VER}}", ver)
           .replace("{{JSONLD}}", json.dumps(jsonld, ensure_ascii=False).replace("</", "<\\/"))
           .replace("<!--SEO-->", seo)
           .replace("{{SNAP}}", json.dumps(snap, ensure_ascii=False).replace("</", "<\\/")))
    (SITE_DIR / "index.html").write_text(out)
    urls.append(("/", updated, "hourly", "1.0"))

    # ---------- market pages ----------
    mk = SITE_DIR / "markets"
    mk.mkdir(exist_ok=True)
    movers = d["people"]["movers"]
    cal = d["people"]["cal"]
    rich = d["people"]["rich"]
    cards = []
    for x in m["ex"]:
        s = slug(x["code"])
        mac = x["mac"] or {}
        f = x["fxo"] or {}
        st = [y for y in stories if x["country"] in y["c"]][:10]
        mv = [y for y in movers if y[0] == x["code"]]
        cl = [y for y in cal if y[1] == x["country"]]
        rc = [y for y in rich if y[8] == x["code"]]
        lede = (f'{x["name"]} ({x["code"]}) is {x["country"]}\'s securities exchange. '
                + (f'Its {x.get("index")} closed at {fmt(x.get("level"), 2)} on {x.get("date")}, {sp(x.get("ytd"))} year to date in {x["ccy"]} and {sp(x["usd"])} in US dollars. ' if x.get("ytd") is not None else
                   (f'Its {x.get("index")} was last reported at {fmt(x.get("level"), 2)} ({x.get("date")}). ' if x.get("level") else "No 2026 index data has been published or sourced yet. "))
                + (f'Market capitalisation is about ${fmt(x.get("mcap"), 2)}bn. ' if x.get("mcap") else "")
                + e(x.get("note") or ""))
        dl = [("Index level", fmt(x.get("level"), 2)), ("YTD local", sp(x.get("ytd"))), (f'{x["ccy"]} vs USD YTD', sp(f.get("ytd")) if x["ccy"] != "USD" else "USD"),
              ("YTD in USD", sp(x["usd"])), ("1 year local", sp(x.get("y1"))), ("Market cap", f'${fmt(x.get("mcap"), 2)}bn' if x.get("mcap") else "—"),
              ("Listed companies", x.get("listed") or "—"), ("P/E", fmt(x.get("pe"))), ("Foreign participation", f'{fmt(x.get("foreign"))}%' if x.get("foreign") else "—"),
              ("Policy rate", f'{fmt(mac.get("pr"), 2)}%' if mac else "—"), ("Inflation", f'{fmt(mac.get("cpi"))}%' if mac else "—"),
              ("GDP growth 2026f", f'{fmt(mac.get("gdp"))}%' if mac else "—"), ("Sovereign rating", mac.get("rating") or "—")]
        body = f"""<nav class="crumbs"><a href="/">{BRAND}</a> › <a href="/markets/">Markets</a> › {e(x['code'])}</nav>
<h1>{e(x['name'])} ({e(x['code'])}): index, returns and outlook</h1>
<p class="muted">Updated {e(updated)} · <a href="/#{e(x['code'])}">Open {e(x['code'])} in the live terminal</a></p>
<section class="panel"><div class="pb" style="display:flex;flex-direction:column;gap:12px"><p class="prose">{lede}</p>
<dl class="metrics">{''.join(f'<div><dt>{e(k)}</dt><dd>{e(v)}</dd></div>' for k, v in dl)}</dl>
<p class="note">Main sectors: {e(', '.join(x.get('sectors') or []))}. Source: <a href="{e(x.get('src'))}" rel="noopener nofollow" target="_blank">{e(re.sub(r'^https?://', '', x.get('src') or '')[:60])}</a></p></div></section>
{f'''<section class="panel"><div class="ph"><h2>Movers</h2></div><div class="tw"><table><thead><tr><th class="nosort">Ticker</th><th class="nosort">Company</th><th class="nosort">Sector</th><th class="r nosort">YTD</th><th class="nosort">As of</th></tr></thead><tbody>{''.join(f'<tr><td class="code">{e(y[1])}</td><td>{e(y[2])}</td><td>{e(y[3])}</td><td class="r num">{sp(y[6], 0)}</td><td class="muted">{e(y[5])}</td></tr>' for y in mv)}</tbody></table></div></section>''' if mv else ''}
{f'''<section class="panel"><div class="ph"><h2>Upcoming catalysts</h2></div><div class="pb"><ul>{''.join(f'<li><b>{e(y[0])}</b> · {e(y[2])} ({e(y[3])}). {e(y[4])}</li>' for y in cl)}</ul></div></section>''' if cl else ''}
{f'''<section class="panel"><div class="ph"><h2>Billionaire exposure</h2></div><div class="pb"><ul>{''.join(f'<li>{e(y[1])}: ${fmt(y[3])}bn ({e(y[4])}). {e(y[7])}</li>' for y in rc)}</ul></div></section>''' if rc else ''}
<section class="panel"><div class="ph"><h2>Latest {e(x['country'])} market news</h2></div><div class="pb"><ul>{''.join(f'<li><time datetime="{e(y["d"])}">{e(y["d"])}</time> · <b>{e(y["h"])}</b>. {e(y["s"])} <a href="{e(y["url"])}" rel="noopener nofollow" target="_blank">{e(y["src"])}</a></li>' for y in st) or '<li>No recent stories.</li>'}</ul></div></section>"""
        ld = {"@context": "https://schema.org", "@type": "Dataset", "name": f'{x["name"]} market data', "description": re.sub("<[^>]+>", "", lede)[:300],
              "url": f"{SITE}/markets/{s}/", "dateModified": updated, "spatialCoverage": x["country"], "isAccessibleForFree": True,
              "creator": {"@type": "Organization", "name": BRAND}}
        tdesc = re.sub("<[^>]+>", "", lede)[:155]
        (mk / s).mkdir(exist_ok=True)
        (mk / s / "index.html").write_text(page(f'{x["code"]} {x["country"]} stock market today · {BRAND}', tdesc, f"/markets/{s}/", body, ld, ver))
        urls.append((f"/markets/{s}/", updated, "daily", "0.8"))
        cards.append(f'<tr><td><a href="/markets/{s}/">{e(x["code"])}</a></td><td>{e(x["name"])}</td><td>{e(x["country"])}</td><td class="r num">{sp(x.get("ytd"))}</td><td class="r num">{sp(x["usd"])}</td><td class="r num">{fmt(x.get("mcap"), 2)}</td></tr>')
    body = f"""<nav class="crumbs"><a href="/">{BRAND}</a> › Markets</nav><h1>All African stock exchanges</h1>
<p class="muted">{len(m['ex'])} venues. Updated {e(updated)}.</p>
<section class="panel"><div class="tw"><table><thead><tr><th class="nosort">Code</th><th class="nosort">Exchange</th><th class="nosort">Country</th><th class="r nosort">YTD local</th><th class="r nosort">YTD USD</th><th class="r nosort">Cap $bn</th></tr></thead><tbody>{''.join(cards)}</tbody></table></div></section>"""
    (mk / "index.html").write_text(page(f"All African stock exchanges: returns in local currency and USD · {BRAND}", f"Every African stock exchange in one table: index levels, YTD returns in local currency and USD, and market capitalisation. Updated {updated}.", "/markets/", body, None, ver))
    urls.append(("/markets/", updated, "daily", "0.9"))

    # ---------- news ----------
    nw = SITE_DIR / "news"
    nw.mkdir(exist_ok=True)
    items = "".join(f'<article class="stripe {"bull" if y["sig"] == "bullish" else "bear" if y["sig"] == "bearish" else "neu"}" style="margin-bottom:12px"><div class="meta"><time datetime="{e(y["d"])}">{e(y["d"])}</time><span class="chip">{e(y["sec"])}</span><span>{e(", ".join(y["c"]))}</span></div><h2 style="font-size:16px;margin:4px 0">{e(y["h"])}</h2><p>{e(y["s"])}</p><p class="note"><b>Angle:</b> {e(y["opp"])} · <a href="{e(y["url"])}" rel="noopener nofollow" target="_blank">{e(y["src"])}</a></p></article>' for y in stories)
    (nw / "index.html").write_text(page(f"African markets newswire · {BRAND}", "The developing stories moving African equities, currencies, debt, commodities, PE and policy, each with an investor angle.", "/news/",
        f'<nav class="crumbs"><a href="/">{BRAND}</a> › Newswire</nav><h1>African markets newswire</h1><section class="panel"><div class="pb">{items}</div></section>', None, ver))
    urls.append(("/news/", updated, "hourly", "0.9"))

    # ---------- RSS ----------
    def rfc(dstr):
        try:
            return datetime.datetime.strptime(dstr, "%Y-%m-%d").strftime("%a, %d %b %Y 06:00:00 +0000")
        except Exception:
            return ""
    rss = "".join(f"<item><title>{e(y['h'])}</title><link>{e(y['url'])}</link><guid isPermaLink=\"false\">{e(hashlib.sha1(y['url'].encode()).hexdigest())}</guid><pubDate>{rfc(y['d'])}</pubDate><category>{e(y['sec'])}</category><description>{e(y['s'] + ' Angle: ' + y['opp'])}</description></item>" for y in stories[:50])
    (SITE_DIR / "feed.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>{BRAND} newswire</title><link>{SITE}/news/</link><description>Developing stories across African markets.</description><language>en</language>{rss}</channel></rss>')

    # ---------- legal ----------
    terms = f"""<h1>Terms of use</h1><div class="prose"><p>{BRAND} provides market data, analytics and AI-generated commentary for research and education. It is not investment, legal or tax advice, and it is not an offer or solicitation to buy or sell any security. Scores, scenarios, trade ideas and AI answers are model outputs based on assumptions that may be wrong.</p>
<p>Data comes from third-party public sources, can be delayed, incomplete or inaccurate, and is provided "as is" without warranty. Check figures against primary sources before acting. Third-party content remains the property of its owners; headlines are paraphrased and link to the original publisher.</p>
<p>Do not scrape the site at a rate that degrades service, and do not resell the data. We may limit or suspend access to protect the service.</p><p>Questions: use the Feedback button on the terminal.</p><p class="note">Template text. Have it reviewed by counsel in your jurisdiction before launch.</p></div>"""
    privacy = f"""<h1>Privacy</h1><div class="prose"><p>{BRAND} does not require an account. The terminal stores your tab choice and scenario weights in your own browser. We do not sell personal data.</p>
<p><b>Feedback form:</b> we store your message, rating, the tab you were on, and your email only if you enter it, to respond and improve the service. <b>AI analyst:</b> your questions are sent to our AI provider to generate an answer. A hashed form of your IP address is used for daily rate limits and expires after 48 hours. <b>Analytics:</b> if enabled, we use privacy-friendly, cookie-free page analytics.</p>
<p>To ask for deletion of feedback you sent, use the Feedback form and include the email you used.</p><p class="note">Template text. Have it reviewed against the Kenya Data Protection Act 2019, GDPR and other laws that apply to your visitors before launch.</p></div>"""
    for p, t2, body in [("terms", "Terms of use", terms), ("privacy", "Privacy", privacy)]:
        (SITE_DIR / p).mkdir(exist_ok=True)
        (SITE_DIR / p / "index.html").write_text(page(f"{t2} · {BRAND}", f"{BRAND} {t2.lower()}.", f"/{p}/", body, None, ver))
        urls.append((f"/{p}/", updated, "yearly", "0.2"))
    (SITE_DIR / "404.html").write_text(page(f"Page not found · {BRAND}", "Page not found.", "/404", '<h1>Page not found</h1><p><a href="/">Back to the terminal</a> or browse <a href="/markets/">all markets</a>.</p>', None, ver))

    # ---------- sitemap / robots / IndexNow ----------
    lm = (updated or "")[:10] or datetime.date.today().isoformat()
    sm = "".join(f"<url><loc>{SITE}{u}</loc><lastmod>{lm}</lastmod><changefreq>{c}</changefreq><priority>{p}</priority></url>" for u, _, c, p in urls)
    (SITE_DIR / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sm}</urlset>')
    (SITE_DIR / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {SITE}/sitemap.xml\n")
    key = os.environ.get("INDEXNOW_KEY", "").strip()
    if key:
        (SITE_DIR / f"{key}.txt").write_text(key)
    (ROOT / "scripts" / ".urls.json").write_text(json.dumps([SITE + u for u, *_ in urls]))
    print(f"built {len(urls)} pages · AIC {level:.2f} ({m['comp']:+.2f}%) · site {SITE}")


if __name__ == "__main__":
    main()
