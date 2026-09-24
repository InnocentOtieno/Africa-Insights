# Africa Insights

A public African markets terminal covering 32 exchanges, FX and rates, the Africa Insights Composite (AIC), movers, trade ideas, a scenario lab, PESTLE risk, a newswire, Africa's richest people and a public AI analyst. It also has 37 search-engine-friendly pages, an RSS feed and a visitor feedback system.

It is a static site on Cloudflare Pages, plus two small serverless functions. A GitHub Action refreshes the data on a schedule and redeploys the site. There are no servers to maintain.

```
site/                  what the public sees (Cloudflare Pages output folder)
  index.html           the terminal (generated; do not edit by hand)
  assets/              app.js, styles.css, favicon, og.png
  data/*.json          the live data the terminal polls every 60 seconds
  markets/<code>/      one indexable page per exchange (generated)
  news/  feed.xml  sitemap.xml  robots.txt  terms/  privacy/  404.html
functions/api/ask.js       public AI analyst (Claude API, rate-limited, spend-capped)
functions/api/feedback.js  visitor feedback → Cloudflare KV (+ optional Slack/Discord alert)
scripts/               refresh_fx.py, refresh_ai.py, build.py, indexnow.py (standard-library Python)
templates/index.html   the terminal page template
.github/workflows/refresh.yml   the schedule
```

## Launch in about 30 minutes

### 1. Put the code on GitHub
1. Create a free account at github.com and a new **private or public** repository called `africa-insights`.
2. On the repo page, click **Add file → Upload files**, drag in everything from this folder (including the hidden `.github` folder), and commit.
   With git instead: `git init && git add -A && git commit -m "Launch" && git branch -M main && git remote add origin <repo-url> && git push -u origin main`.

### 2. Create the Cloudflare Pages site
1. Create a free account at dash.cloudflare.com, then go to **Workers & Pages → Create → Pages → Connect to Git** and pick the repo.
2. Build settings: **Framework preset** None · **Build command** leave empty · **Build output directory** `site`. Click **Save and Deploy**.
3. You get a URL like `https://africa-insights.pages.dev`. The terminal works from this point on, with the AI analyst and feedback switched off until step 3.

### 3. Switch on feedback and the AI analyst
1. **Workers & Pages → KV → Create namespace** called `africa-insights`.
2. Open your Pages project → **Settings → Bindings → Add → KV namespace**. Variable name `KV`, namespace `africa-insights`.
3. **Settings → Variables and secrets**. Add these for Production:

| Name | Type | Value |
|---|---|---|
| `ANTHROPIC_API_KEY` | Secret | from console.anthropic.com → API keys |
| `ANTHROPIC_MODEL` | Text | a current model id from docs.claude.com/en/docs/about-claude/models |
| `ADMIN_TOKEN` | Secret | a long random string you keep private |
| `IP_SALT` | Secret | another long random string |
| `PER_IP_DAILY` | Text | `8` (questions per visitor per day) |
| `GLOBAL_DAILY` | Text | `150` (hard cap on questions per day, which caps spend) |
| `FEEDBACK_WEBHOOK` | Secret, optional | a Slack or Discord incoming-webhook URL, so each piece of feedback pings you instantly |

4. Redeploy: go to **Deployments → ⋯ → Retry deployment**.
5. To read feedback, open `https://<your-site>/api/feedback?token=<ADMIN_TOKEN>`. Add `&format=csv` for a spreadsheet.

### 4. Switch on the automatic data refresh
In GitHub, go to **repo → Settings → Secrets and variables → Actions**:
- **Secrets**: `ANTHROPIC_API_KEY`, the same key as above (it runs the web-search refresh).
- **Variables**: `SITE_URL` = your final URL with no trailing slash, `ANTHROPIC_MODEL` = the same model id as above, and `INDEXNOW_KEY` = any 32-character hex string (for example, run `python -c "import secrets;print(secrets.token_hex(16))"`).

Then go to **Actions → Refresh data and rebuild → Run workflow** to test it. The schedule runs on its own after that:

| Job | When (EAT) | Source |
|---|---|---|
| FX for 29 currencies | every 6 hours | ExchangeRate-API open endpoint (free, updates daily) |
| Index levels and commodities | 08:30 and 18:30, Mon–Fri | Claude with web search, validated |
| Newswire | same, plus 12:00 Sat–Sun | Claude with web search, validated |
| Policy rates, CPI, yields, Fed | Mondays 07:00 | Claude with web search, validated |

Each run commits changed data, rebuilds all pages, and Cloudflare redeploys in about a minute. Open terminals pick up the new data within 60 seconds and show **Live · updated N min ago**.

**Safety checks.** An index move over 12%, a commodity move over 15%, an FX move over 25%, a policy-rate change over 5pp, stale dates and malformed stories are all **held back** rather than published. They are listed in `site/data/meta.json → flags` for you to review. Year-to-date returns are always recomputed from the 31 Dec 2025 bases in `bases.json`, never copied from a source. To accept a genuine big move (such as a devaluation), edit the JSON by hand or run the FX job with `FORCE=1`.

### 5. Custom domain
In Pages, go to **Custom domains → Set up a domain** and enter, for example, `africainsights.com` or `markets.yourdomain.com`. If the domain's DNS is on Cloudflare this takes one click; otherwise add the CNAME it shows you. Then update the `SITE_URL` variable in GitHub and run the workflow once so the canonical URLs, sitemap and social cards use the new domain.

### 6. Get it into search engines
1. **Google Search Console** (search.google.com/search-console): add the domain, verify it through DNS, then under **Sitemaps** submit `https://<domain>/sitemap.xml`.
2. **Bing Webmaster Tools** (bing.com/webmasters): import from Search Console. Bing, Yandex, Seznam and Naver are also notified automatically after each refresh through IndexNow.
3. Already built in: a unique title and description per page; canonical tags; Open Graph and Twitter cards with a 1200×630 image; schema.org `WebSite` and `Dataset` JSON-LD; prerendered HTML for every exchange (crawlers don't need JavaScript); `/news/`; an RSS feed at `/feed.xml`; `robots.txt`; and a sitemap that is refreshed with each data update.
4. Optional: in Cloudflare, go to **Web Analytics → Add site** and paste the beacon snippet where marked in `templates/index.html`. It's free and cookie-free.

## Running costs (estimates)
- Cloudflare Pages, KV, and GitHub Actions: $0 on free tiers at launch scale. The KV free tier allows 1,000 writes a day; each AI question uses 2 writes and each feedback message uses 2.
- Data refresh through Claude with web search: roughly $15–40 a month at the schedule above (web search is billed per search, plus tokens).
- AI analyst: about 7k input tokens per question. At a mid-tier model that is about $0.03–0.05 per question, so the default cap of 150 a day costs at most about $5–8 a day. Raise it as usage grows.

## What "real time" means here, and how to go further
Data is **near-real-time**: FX refreshes daily from its source, and indices, commodities and news twice a day. For intraday or tick data, replace the Claude-based steps in `refresh_ai.py` with licensed feeds. The main options are exchange data products (JSE IDP, NGX, EGX, NSE and BRVM market data), an aggregator (for example LSEG, Bloomberg B-PIPE, ICE or African Markets data services), and a bank or NDF source for FX. After that, add WebSockets (Cloudflare Durable Objects) and shorten the polling interval in `app.js`.

## Before you publicise it: checklist
This is not legal advice, so have counsel confirm each point for your markets.
- **Data rights.** Exchange index levels, some FX rates and third-party data carry redistribution terms. Several sources used in the seed data (for example TradingEconomics, african-markets.com and Forbes) restrict republishing. Before promoting the site, confirm licences or switch to sources that permit public display, and keep the ExchangeRate-API attribution under Method.
- **Investment-advice rules.** Publishing trade ideas and AI answers to the public can count as regulated investment advice or research in some jurisdictions. Examples are Kenya's Capital Markets Authority (investment adviser licensing), the FCA in the UK and the SEC in the US. The site frames everything as research and education and carries disclaimers, but get this confirmed, especially if the site is Niobi-branded.
- **Privacy.** Feedback stores optional emails, and the AI desk stores hashed IPs for 48 hours. The `privacy/` and `terms/` pages are templates to be reviewed under Kenya's Data Protection Act 2019 and GDPR (for EU visitors).
- **Billionaire content.** It comes from public Forbes rankings. Keep it factual and sourced.

## Editing
- Data: edit `site/data/*.json`, then run `python scripts/build.py` (or let the Action do it).
- Terminal UI: `site/assets/app.js`, `site/assets/styles.css` and `templates/index.html`, then run `python scripts/build.py`.
- Scenario model coefficients (`BETA`) and volatility assumptions (`VOL`) are at the top of `app.js`.
- Local preview: `npx wrangler pages dev site --kv KV` opens the site with working functions at http://localhost:8788.
