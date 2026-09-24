// Cloudflare Pages Function: /api/feedback
// POST: store visitor feedback in KV (binding KV), optionally notify FEEDBACK_WEBHOOK (Slack/Discord/Teams-style JSON).
// GET:  /api/feedback?token=ADMIN_TOKEN[&format=csv] lists stored feedback for you.

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const TYPES = ["General feedback", "Data error", "Request a market or feature", "Bug"];

async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].slice(0, 12).map(x => x.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost({ request, env }) {
  if (!env.KV) return json({ error: "Feedback storage is not configured yet." }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  if (b.hp) return json({ ok: true }); // honeypot filled: silently drop bots
  const msg = String(b.message || "").trim().slice(0, 2000);
  const rating = Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 5 ? b.rating : null;
  if (!msg && !rating) return json({ error: "Add a rating or a message." }, 400);
  const email = String(b.email || "").trim().slice(0, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "That email address doesn't look right." }, 400);

  const day = new Date().toISOString().slice(0, 10);
  const who = await sha((request.headers.get("CF-Connecting-IP") || "0") + (env.IP_SALT || "") + day);
  const n = +(await env.KV.get(`fbrl:${day}:${who}`)) || 0;
  if (n >= 5) return json({ error: "Thanks, we've received several messages from you today. Please try again tomorrow." }, 429);

  const rec = {
    at: new Date().toISOString(), type: TYPES.includes(b.type) ? b.type : "General feedback", rating, message: msg, email: email || null,
    tab: String(b.tab || "").slice(0, 10), country: request.cf?.country || null, ua: (request.headers.get("user-agent") || "").slice(0, 160)
  };
  const key = `fb:${rec.at}:${crypto.randomUUID().slice(0, 8)}`;
  await Promise.all([env.KV.put(key, JSON.stringify(rec)), env.KV.put(`fbrl:${day}:${who}`, String(n + 1), { expirationTtl: 172800 })]);
  if (env.FEEDBACK_WEBHOOK) {
    const text = `Africa Insights feedback · ${rec.type}${rating ? " · " + "★".repeat(rating) : ""} · ${rec.country || ""}\n${msg}${email ? "\nReply to: " + email : ""}`;
    try { await fetch(env.FEEDBACK_WEBHOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, content: text }) }); } catch {}
  }
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const token = u.searchParams.get("token") || (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) return json({ error: "Not found." }, 404);
  if (!env.KV) return json({ error: "KV not bound." }, 503);
  const rows = [];
  let cursor;
  do {
    const page = await env.KV.list({ prefix: "fb:", cursor, limit: 1000 });
    const vals = await Promise.all(page.keys.map(k => env.KV.get(k.name)));
    vals.forEach(v => { try { rows.push(JSON.parse(v)); } catch {} });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor && rows.length < 5000);
  rows.sort((a, b) => b.at.localeCompare(a.at));
  if (u.searchParams.get("format") === "csv") {
    const cols = ["at", "type", "rating", "message", "email", "tab", "country"];
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return new Response([cols.join(","), ...rows.map(r => cols.map(c => q(r[c])).join(","))].join("\n"), { headers: { "content-type": "text/csv", "cache-control": "no-store" } });
  }
  const ratings = rows.map(r => r.rating).filter(Boolean);
  return json({ count: rows.length, avgRating: ratings.length ? +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : null, rows });
}
