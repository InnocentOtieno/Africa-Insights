const SNAP = JSON.parse(document.getElementById('snap').textContent);
let D = JSON.parse(JSON.stringify(SNAP));
let M = null;
let LIVE = {on:false, updated:null};
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isN = v => v !== null && v !== undefined && !isNaN(v);
const f = (v, d = 1) => isN(v) ? (+v).toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d}) : '—';
const sp = (v, d = 1) => isN(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v), d) + '%' : '—';
const pp = (v, d = 1) => isN(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v), d) : '—';
const cls = v => !isN(v) ? '' : v > 0 ? 'up' : v < 0 ? 'down' : '';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const store = {get(k, d){try{const v = localStorage.getItem('afins.' + k); return v == null ? d : JSON.parse(v);}catch(e){return d;}}, set(k, v){try{localStorage.setItem('afins.' + k, JSON.stringify(v));}catch(e){}}};

/* ---------- Model constants (judgment-calibrated v0) ---------- */
const REGION = {NSE:'East',DSE:'East',USE:'East',RSE:'East',NGX:'West',GSE:'West',BRVM:'West',JSE:'South',BSE:'South',NSX:'South',LuSE:'South',ZSE:'South',VFEX:'South',MSE:'South',SEM:'South',EGX:'North',BVC:'North',BVMT:'North'};
const VOL = {JSE:22,NGX:30,EGX:32,BVC:16,NSE:22,GSE:28,BRVM:16,DSE:20,USE:22,RSE:16,LuSE:28,ZSE:60,VFEX:30,MSE:38,BSE:12,NSX:20,SEM:12,BVMT:15};
const FACTORS = [
  {k:'oil',   name:'Brent oil',        unit:10,  u:'%',  min:-50,max:50, step:5,  desc:'per +10%'},
  {k:'gold',  name:'Gold',             unit:10,  u:'%',  min:-30,max:30, step:5,  desc:'per +10%'},
  {k:'copper',name:'Copper',           unit:10,  u:'%',  min:-30,max:30, step:5,  desc:'per +10%'},
  {k:'softs', name:'Cocoa/coffee/tea', unit:10,  u:'%',  min:-40,max:40, step:5,  desc:'per +10%'},
  {k:'usd',   name:'US dollar (DXY)',  unit:5,   u:'%',  min:-10,max:10, step:1,  desc:'per +5%'},
  {k:'ust',   name:'US 10y yield',     unit:100, u:'bp', min:-200,max:200,step:25,desc:'per +100bp'},
  {k:'china', name:'China growth',     unit:1,   u:'pp', min:-3, max:2,  step:0.5,desc:'per +1pp'},
  {k:'glob',  name:'Global equities',  unit:1,   u:'%',  min:-40,max:20, step:5,  desc:'per +1%'}
];
// USD return impact (%) for one unit of each factor
const BETA = {
  JSE: {oil:-1,  gold:2,   copper:1,  softs:0,   usd:-4,  ust:-6, china:3,   glob:.85},
  NGX: {oil:3,   gold:0,   copper:0,  softs:0,   usd:-3,  ust:-3, china:.5,  glob:.25},
  EGX: {oil:-1.5,gold:.5,  copper:0,  softs:0,   usd:-3,  ust:-5, china:.5,  glob:.5},
  BVC: {oil:-1.5,gold:1,   copper:0,  softs:0,   usd:-3,  ust:-3, china:.5,  glob:.35},
  NSE: {oil:-2,  gold:0,   copper:0,  softs:.8,  usd:-1.5,ust:-5, china:.5,  glob:.45},
  GSE: {oil:.5,  gold:3,   copper:0,  softs:1,   usd:-4,  ust:-5, china:1,   glob:.2},
  BRVM:{oil:-.5, gold:.5,  copper:0,  softs:1.5, usd:-4,  ust:-3, china:.5,  glob:.2},
  DSE: {oil:-1.5,gold:1.5, copper:0,  softs:.5,  usd:-2,  ust:-2, china:.5,  glob:.15},
  USE: {oil:-1.5,gold:0,   copper:0,  softs:1,   usd:-2.5,ust:-3, china:.5,  glob:.2},
  RSE: {oil:-1.5,gold:0,   copper:0,  softs:.5,  usd:-1.5,ust:-2, china:.5,  glob:.1},
  LuSE:{oil:-1,  gold:0,   copper:4,  softs:0,   usd:-4,  ust:-5, china:4,   glob:.3},
  ZSE: {oil:-1,  gold:2.5, copper:.5, softs:0,   usd:-3,  ust:-2, china:1.5, glob:.2},
  VFEX:{oil:-.5, gold:2,   copper:0,  softs:0,   usd:-1,  ust:-2, china:1,   glob:.3},
  MSE: {oil:-1.5,gold:0,   copper:0,  softs:1,   usd:-2,  ust:-2, china:.5,  glob:.1},
  BSE: {oil:-.5, gold:0,   copper:.5, softs:0,   usd:-3,  ust:-2, china:1.5, glob:.15},
  NSX: {oil:-1,  gold:0,   copper:.5, softs:0,   usd:-4,  ust:-5, china:1.5, glob:.6},
  SEM: {oil:-1.5,gold:0,   copper:0,  softs:0,   usd:-2.5,ust:-2, china:.5,  glob:.35},
  BVMT:{oil:-1.5,gold:0,   copper:0,  softs:0,   usd:-3,  ust:-2, china:.5,  glob:.15}
};
const RATING = {'BBB-':7,'BB+':6,'BB':5,'BB-':4.5,'B+':4,'B':3,'B-':2.5,'CCC+':1.5,'SD':0,"Baa1 (Moody's)":8,"Baa3 (Moody's)":7,"B1 (Moody's)":4,"Caa1 (Moody's)":1.5};
const TABS = [
  ['mkt','MKT','Markets'],['fx','FX','FX & rates'],['mov','MOV','Movers'],['ide','IDEA','Ideas'],['scn','SCN','Scenario lab'],
  ['rsk','RISK','PESTLE & risk'],['nws','NEWS','Newswire'],['ric','RICH','Rich list'],['dsk','DESK','Ask the desk'],['met','METH','Method']
];

/* ---------- Compute ---------- */
function rankPct(arr){ // returns map value->percentile (0..1), ties averaged
  const s = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(arr.length);
  s.forEach(([v, i], r) => out[i] = s.length > 1 ? r / (s.length - 1) : .5);
  return out;
}
function compute(){
  const fx = {};
  D.macro.fx.forEach(r => fx[r[0]] = {ccy:r[0], country:r[1], rate:r[2], ytd:r[3], y1:r[4], regime:r[5]});
  fx.USD = {ccy:'USD', country:'US dollar', rate:1, ytd:0, y1:0, regime:'USD'};
  const usdRate = D.macro.usd_rate;
  const mac = {};
  D.macro.macro.forEach(r => mac[r[0]] = {country:r[0], pr:r[1], cpi:r[2], gdp:r[3], y10:r[4], rating:r[5], real:r[1] - r[2], carry:r[1] - usdRate, ratingScore: RATING[r[5]] ?? 2});
  const ex = D.exchanges.map(e => {
    const x = fx[e.ccy], m = mac[e.country];
    const usd = isN(e.ytd) && x ? ((1 + e.ytd / 100) * (1 + x.ytd / 100) - 1) * 100 : null;
    const status = isN(e.ytd) ? 'full' : (isN(e.level) || isN(e.mcap)) ? 'partial' : 'dark';
    return {...e, fx:x, mac:m, usd, status, beta:BETA[e.code] || null, vol:VOL[e.code] || null, region:REGION[e.code] || null};
  });
  const byCode = Object.fromEntries(ex.map(e => [e.code, e]));
  // composite: cap-weighted with a 20% single-market cap
  const elig = ex.filter(e => isN(e.usd) && isN(e.mcap));
  let w = elig.map(e => e.mcap); const tot = w.reduce((a, b) => a + b, 0); w = w.map(v => v / tot);
  const CAP = .20;
  for (let it = 0; it < 50; it++){
    const over = w.map(v => v > CAP + 1e-9);
    if (!over.some(Boolean)) break;
    const excess = w.reduce((a, v, i) => a + (over[i] ? v - CAP : 0), 0);
    const freeSum = w.reduce((a, v, i) => a + (over[i] ? 0 : v), 0);
    w = w.map((v, i) => over[i] ? CAP : v + excess * v / freeSum);
  }
  elig.forEach((e, i) => { e.w = w[i]; e.contrib = w[i] * e.usd; });
  const kacUsd = elig.reduce((a, e) => a + e.contrib, 0);
  const kacLocal = elig.reduce((a, e) => a + e.w * e.ytd, 0);
  const ewSet = ex.filter(e => isN(e.usd));
  const kacEw = ewSet.reduce((a, e) => a + e.usd, 0) / ewSet.length;
  const rawCapUsd = elig.reduce((a, e) => a + e.mcap * e.usd, 0) / tot;
  const breadth = ewSet.filter(e => e.usd > 0).length;
  // scores
  const sc = ex.filter(e => isN(e.usd) && e.mac && isN(e.mcap));
  const peMed = (() => {const p = sc.map(e => e.pe).filter(isN).sort((a, b) => a - b); return p.length ? p[Math.floor(p.length / 2)] : 12;})();
  const comp = {
    growth: rankPct(sc.map(e => e.mac.gdp ?? 3)),
    real:   rankPct(sc.map(e => clamp(e.mac.real, -10, 15))),
    value:  rankPct(sc.map(e => -(isN(e.pe) ? e.pe : peMed))),
    mom:    rankPct(sc.map(e => e.usd)),
    fxs:    rankPct(sc.map(e => -Math.abs(e.fx.ytd))),
    size:   rankPct(sc.map(e => Math.log10(e.mcap))),
    rating: rankPct(sc.map(e => e.mac.ratingScore)),
    regime: rankPct(sc.map(e => /peg/i.test(e.fx.regime) ? 1 : /managed|crawl/i.test(e.fx.regime) ? .6 : .5))
  };
  sc.forEach((e, i) => {
    e.parts = {Growth:comp.growth[i], 'Real rate':comp.real[i], Value:comp.value[i], Momentum:comp.mom[i], 'FX stability':comp.fxs[i]};
    e.opp = Math.round(100 * (.30 * comp.growth[i] + .25 * comp.real[i] + .20 * comp.value[i] + .15 * comp.mom[i] + .10 * comp.fxs[i]));
    e.inv = Math.round(100 * (.5 * comp.size[i] + .3 * comp.rating[i] + .2 * comp.regime[i]));
    e.gap = e.opp - e.inv;
  });
  const stories = [...D.stories].sort((a, b) => b.d.localeCompare(a.d));
  const cal = [...D.people.cal].map(r => ({d:r[0], c:r[1], ev:r[2], p:r[3], imp:r[4], risk:r[5], url:r[6]})).sort((a, b) => a.d.localeCompare(b.d));
  const rich = D.people.rich.map(r => ({rank:r[0], name:r[1], c:r[2], nw:r[3], asof:r[4], src:r[5], hold:r[6], note:r[7], venue:r[8]}));
  const movers = D.people.movers.map(r => {
    const e = byCode[r[0]]; const x = e ? e.fx : null;
    const usd = isN(r[6]) && x ? ((1 + r[6] / 100) * (1 + x.ytd / 100) - 1) * 100 : null;
    return {ex:r[0], t:r[1], name:r[2], sec:r[3], px:r[4], d:r[5], ytd:r[6], cap:r[7], pe:r[8], dy:r[9], cat:r[10], usd, ccy:e ? e.ccy : ''};
  });
  M = {fx, mac, ex, byCode, elig, kacUsd, kacLocal, kacEw, rawCapUsd, breadth, ewN:ewSet.length, sc, stories, cal, rich, movers, usdRate};
}

/* ---------- Colour scale for returns ---------- */
function hex2rgb(h){h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));}
function mix(a, b, t){const A = hex2rgb(a), B = hex2rgb(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';}
function retColor(v){ if (!isN(v)) return '#56606C'; if (v >= 0) return mix('#4E5966', '#0E7A48', clamp(v / 60, 0, 1)); return mix('#4E5966', '#B3372A', clamp(-v / 25, 0, 1)); }

/* ---------- Generic sortable table ---------- */
const TSTATE = {};
function table(el, id, cols, rows, opts = {}){
  const st = TSTATE[id] || (TSTATE[id] = {k:opts.sortKey || null, dir:opts.sortDir || -1});
  let r = rows.slice();
  if (st.k){ const c = cols.find(c => c.k === st.k); if (c){ r.sort((a, b) => { const va = c.v ? c.v(a) : a[c.k], vb = c.v ? c.v(b) : b[c.k]; const na = va == null || (typeof va === 'number' && isNaN(va)), nb = vb == null || (typeof vb === 'number' && isNaN(vb)); if (na && nb) return 0; if (na) return 1; if (nb) return -1; return (va > vb ? 1 : va < vb ? -1 : 0) * st.dir; }); } }
  el.innerHTML = '<thead><tr>' + cols.map(c => `<th data-k="${c.k}" class="${c.r ? 'r' : ''} ${c.nosort ? 'nosort' : ''}" ${st.k === c.k ? `aria-sort="${st.dir > 0 ? 'ascending' : 'descending'}"` : ''} scope="col">${c.label}</th>`).join('') + '</tr></thead><tbody>' +
    r.map(row => `<tr ${opts.rowAttr ? opts.rowAttr(row) : ''}>` + cols.map(c => `<td class="${c.r ? 'r num' : ''}">${c.fmt ? c.fmt(row) : esc(row[c.k])}</td>`).join('') + '</tr>').join('') + '</tbody>';
  el.querySelectorAll('th').forEach(th => { if (th.classList.contains('nosort')) return; th.onclick = () => { const k = th.dataset.k; if (st.k === k) st.dir *= -1; else {st.k = k; st.dir = -1;} table(el, id, cols, rows, opts); }; });
  if (opts.onRow) el.querySelectorAll('tbody tr').forEach((tr, i) => tr.onclick = () => opts.onRow(r[i]));
}

/* ---------- SVG helpers ---------- */
function divBars(items, o = {}){ // items: {label, v, sub, color}
  const W = o.w || 640, rowH = o.rowH || 22, padL = o.padL || 120, padR = 60, H = items.length * rowH + 26;
  const vals = items.map(i => i.v).filter(isN);
  const mx = Math.max(o.minMax || 1, ...vals.map(Math.abs));
  const hasNeg = vals.some(v => v < 0), hasPos = vals.some(v => v > 0);
  const x0 = hasNeg && hasPos ? padL + (W - padL - padR) / 2 : hasNeg ? W - padR : padL;
  const span = hasNeg && hasPos ? (W - padL - padR) / 2 : (W - padL - padR);
  const X = v => x0 + (v / mx) * span;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Bar chart')}">`;
  const ticks = [-mx, -mx / 2, 0, mx / 2, mx].filter(t => (t < 0 && hasNeg) || (t > 0 && hasPos) || t === 0);
  s += '<g class="grid">' + ticks.map(t => `<line x1="${X(t)}" x2="${X(t)}" y1="4" y2="${H - 18}"/>`).join('') + '</g>';
  s += ticks.map(t => `<text x="${X(t)}" y="${H - 5}" text-anchor="middle">${(t > 0 ? '+' : '') + f(t, Math.abs(mx) < 5 ? 1 : 0)}</text>`).join('');
  items.forEach((it, i) => {
    const y = 6 + i * rowH, v = it.v;
    s += `<text class="lbl" x="${padL - 8}" y="${y + rowH / 2 + 3}" text-anchor="end">${esc(it.label)}</text>`;
    if (isN(v)){
      const a = X(Math.min(0, v)), b = X(Math.max(0, v));
      const col = it.color || (v >= 0 ? 'var(--up)' : 'var(--down)');
      s += `<rect x="${a}" y="${y + 3}" width="${Math.max(1, b - a)}" height="${rowH - 8}" rx="2" fill="${col}"><title>${esc(it.label)}: ${esc(it.tip || f(v, 2))}</title></rect>`;
      const txt = String(it.sub ?? f(v, 1)), tw = txt.length * 6.2;
      let tx, anc, fill = 'var(--text)';
      if (v >= 0){ tx = b + 4; anc = 'start'; if (tx + tw > W - 2){ tx = b - 4; anc = 'end'; fill = '#fff'; } }
      else { tx = a - 4; anc = 'end'; if (tx - tw < padL){ tx = hasPos ? x0 + 4 : a + 4; anc = 'start'; fill = hasPos ? 'var(--text)' : '#fff'; } }
      s += `<text x="${tx}" y="${y + rowH / 2 + 3}" text-anchor="${anc}" style="fill:${fill}">${esc(txt)}</text>`;
    } else s += `<text x="${x0 + 4}" y="${y + rowH / 2 + 3}">n/a</text>`;
  });
  s += `<line class="axis" x1="${x0}" x2="${x0}" y1="2" y2="${H - 18}"/></svg>`;
  return s;
}
function scatter(pts, o){ // pts {x,y,r,label,color,code}
  const W = o.w || 640, H = o.h || 380, pl = 48, pr = 16, pt = 16, pb = 38;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = o.xmin ?? Math.min(...xs), x1 = o.xmax ?? Math.max(...xs), y0 = o.ymin ?? Math.min(...ys), y1 = o.ymax ?? Math.max(...ys);
  const padx = (x1 - x0) * .08 || 1, pady = (y1 - y0) * .1 || 1;
  const X0 = o.xmin ?? x0 - padx, X1 = o.xmax ?? x1 + padx, Y0 = o.ymin ?? y0 - pady, Y1 = o.ymax ?? y1 + pady;
  const X = v => pl + (v - X0) / (X1 - X0) * (W - pl - pr), Y = v => H - pb - (v - Y0) / (Y1 - Y0) * (H - pt - pb);
  const nice = (a, b, n) => {const st = Math.pow(10, Math.floor(Math.log10((b - a) / n))); const m = [1, 2, 5, 10].find(m => (b - a) / (st * m) <= n) * st; const out = []; for (let v = Math.ceil(a / m) * m; v <= b + 1e-9; v += m) out.push(+v.toFixed(6)); return out;};
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Scatter')}">`;
  if (o.bg) s += o.bg(X, Y, X0, X1, Y0, Y1);
  s += '<g class="grid">' + nice(X0, X1, 6).map(v => `<line x1="${X(v)}" x2="${X(v)}" y1="${pt}" y2="${H - pb}"/>`).join('') + nice(Y0, Y1, 5).map(v => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('') + '</g>';
  s += nice(X0, X1, 6).map(v => `<text x="${X(v)}" y="${H - pb + 14}" text-anchor="middle">${v}</text>`).join('');
  s += nice(Y0, Y1, 5).map(v => `<text x="${pl - 6}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`).join('');
  if (X0 < 0 && X1 > 0) s += `<line class="axis" x1="${X(0)}" x2="${X(0)}" y1="${pt}" y2="${H - pb}"/>`;
  if (Y0 < 0 && Y1 > 0) s += `<line class="axis" x1="${pl}" x2="${W - pr}" y1="${Y(0)}" y2="${Y(0)}"/>`;
  s += `<text x="${(pl + W - pr) / 2}" y="${H - 6}" text-anchor="middle" class="lbl">${esc(o.xl)}</text>`;
  s += `<text x="12" y="${(pt + H - pb) / 2}" text-anchor="middle" class="lbl" transform="rotate(-90 12 ${(pt + H - pb) / 2})">${esc(o.yl)}</text>`;
  pts.forEach(p => {
    s += `<g class="pt" data-code="${esc(p.code || '')}" style="cursor:pointer"><circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.r || 6}" fill="${p.color || 'var(--accent)'}" fill-opacity=".75" stroke="var(--panel)" stroke-width="1.5"><title>${esc(p.tip || p.label)}</title></circle>`;
    s += `<text x="${X(p.x) + (p.r || 6) + 3}" y="${Y(p.y) + 3}" style="fill:var(--text);font-weight:600">${esc(p.label)}</text></g>`;
  });
  return s + '</svg>';
}

/* ---------- Treemap (squarified) ---------- */
function squarify(items, x, y, w, h){
  const out = []; let rest = items.slice(); const total = rest.reduce((a, b) => a + b.v, 0); const scale = (w * h) / total;
  rest.forEach(i => i.a = i.v * scale);
  function worst(row, side){ const s = row.reduce((a, b) => a + b.a, 0); const mx = Math.max(...row.map(r => r.a)), mn = Math.min(...row.map(r => r.a)); return Math.max(side * side * mx / (s * s), (s * s) / (side * side * mn)); }
  let row = [];
  while (rest.length){
    const side = Math.min(w, h); const c = rest[0];
    if (!row.length || worst(row.concat([c]), side) <= worst(row, side)){ row.push(c); rest.shift(); continue; }
    lay();
  }
  if (row.length) lay();
  function lay(){
    const s = row.reduce((a, b) => a + b.a, 0);
    if (w >= h){ const cw = s / h; let yy = y; row.forEach(r => { const rh = r.a / cw; out.push({...r, x, y:yy, w:cw, h:rh}); yy += rh; }); x += cw; w -= cw; }
    else { const ch = s / w; let xx = x; row.forEach(r => { const rw = r.a / ch; out.push({...r, x:xx, y, w:rw, h:ch}); xx += rw; }); y += ch; h -= ch; }
    row = [];
  }
  return out;
}

/* ---------- Render: markets ---------- */
function renderMkt(){
  const lvl = 1000 * (1 + M.kacUsd / 100);
  $('#kacLevel').textContent = f(lvl, 2);
  $('#kacChg').innerHTML = `<span class="${cls(M.kacUsd)}">${sp(M.kacUsd, 2)} YTD in USD</span>`;
  $('#kacKv').innerHTML = [
    ['Local-currency view', sp(M.kacLocal), cls(M.kacLocal)],
    ['Equal-weight USD', sp(M.kacEw), cls(M.kacEw)],
    ['Uncapped (JSE-heavy)', sp(M.rawCapUsd), cls(M.rawCapUsd)],
    ['Markets in index', M.elig.length, ''],
    ['Breadth (USD up)', `${M.breadth}/${M.ewN}`, ''],
    ['FX drag on locals', pp(M.kacUsd - M.kacLocal) + 'pp', cls(M.kacUsd - M.kacLocal)]
  ].map(([k, v, c]) => `<div><dt>${k}</dt><dd class="${c}">${v}</dd></div>`).join('');
  $('#kacNote').textContent = 'Each market is converted to USD through its currency move, then cap-weighted with a 20% single-market cap so the JSE cannot swamp the frontier. The gap between the local and USD views is the currency tax a foreign investor paid.';
  const items = M.elig.slice().sort((a, b) => b.contrib - a.contrib).map(e => ({label:`${e.code} · ${e.country}`, v:e.contrib, sub:`${pp(e.contrib, 2)}pp  (w ${f(e.w * 100, 1)}%, ${sp(e.usd, 0)})`}));
  $('#contrib').innerHTML = divBars(items, {w:680, padL:150, rowH:20, aria:'Contribution to composite'});
  // treemap
  const tmItems = M.ex.filter(e => isN(e.mcap) && e.mcap > .2).map(e => ({code:e.code, v:Math.sqrt(e.mcap), e})).sort((a, b) => b.v - a.v);
  const el = $('#treemap'); const W = 1000, H = el.clientWidth < 560 ? 1000 : 500;
  const rects = squarify(tmItems, 0, 0, W, H);
  el.innerHTML = rects.map(r => `<div data-code="${r.code}" style="left:${r.x / W * 100}%;top:${r.y / H * 100}%;width:${r.w / W * 100}%;height:${r.h / H * 100}%;background:${retColor(r.e.usd)}" title="${esc(r.e.name)}: ${sp(r.e.usd)} USD YTD, $${f(r.e.mcap, 1)}bn"><span><b>${r.code}</b>${r.w > 110 ? '<br>' + esc(r.e.country) : ''}</span><span>${isN(r.e.usd) ? sp(r.e.usd, 0) : 'no index'}${r.h > 70 ? '<br>$' + f(r.e.mcap, r.e.mcap < 10 ? 1 : 0) + 'bn' : ''}</span></div>`).join('');
  el.querySelectorAll('div').forEach(d => d.onclick = () => openMarket(d.dataset.code));
  $('#tmLegend').innerHTML = [-25, -10, 0, 20, 40, 60].map(v => `<span><i style="background:${retColor(v)}"></i>${sp(v, 0)}</span>`).join('') + '<span>grey = no 2026 index data</span>';
  // commodities
  $('#comDate').textContent = 'as of ' + D.macro.commodities_date;
  const ct = $('#comTbl');
  ct.innerHTML = '<thead><tr><th class="nosort">Commodity</th><th class="r nosort">Price</th><th class="r nosort">YTD</th><th class="nosort">Exposed</th></tr></thead><tbody>' +
    D.macro.commodities.map(c => `<tr style="cursor:default"><td><b>${esc(c[0])}</b></td><td class="r num">${f(c[1], c[1] > 1000 ? 0 : 2)} <span class="faint">${esc(c[2])}</span></td><td class="r num ${cls(c[3])}">${sp(c[3])}</td><td style="white-space:normal;min-width:180px" class="muted">${esc(c[4])}</td></tr>`).join('') + '</tbody>';
  renderBoard();
}
let boardF = 'all';
function renderBoard(){
  let rows = M.ex;
  if (boardF === 'data') rows = rows.filter(e => e.status === 'full');
  if (boardF === 'dark') rows = rows.filter(e => e.status !== 'full');
  const stat = e => e.status === 'full' ? '<span class="chip up">Index</span>' : e.status === 'partial' ? '<span class="chip acc">Partial</span>' : '<span class="chip">Dark</span>';
  table($('#board'), 'board', [
    {k:'code', label:'Venue', fmt:e => `<span class="code">${e.code}</span>`},
    {k:'country', label:'Country', fmt:e => esc(e.country)},
    {k:'index', label:'Index', fmt:e => `<span class="muted">${esc(e.index || '—')}</span>`},
    {k:'level', label:'Level', r:1, fmt:e => f(e.level, e.level > 1000 ? 0 : 2)},
    {k:'ytd', label:'YTD local', r:1, fmt:e => `<span class="${cls(e.ytd)}">${sp(e.ytd)}</span>`},
    {k:'fxy', label:'FX YTD', r:1, v:e => e.fx ? e.fx.ytd : null, fmt:e => e.fx ? `<span class="${cls(e.fx.ytd)}">${e.ccy === 'USD' ? 'USD' : sp(e.fx.ytd)}</span>` : '—'},
    {k:'usd', label:'YTD USD', r:1, fmt:e => `<b class="${cls(e.usd)}">${sp(e.usd)}</b>`},
    {k:'mcap', label:'Cap $bn', r:1, fmt:e => f(e.mcap, e.mcap < 10 ? 2 : 1)},
    {k:'pe', label:'P/E', r:1, fmt:e => f(e.pe, 1)},
    {k:'foreign', label:'Foreign %', r:1, fmt:e => f(e.foreign, 1)},
    {k:'opp', label:'Opp.', r:1, fmt:e => isN(e.opp) ? `<span class="score"><i><b style="width:${e.opp}%"></b></i>${e.opp}</span>` : '—'},
    {k:'status', label:'Data', v:e => ({full:2, partial:1, dark:0})[e.status], fmt:stat},
    {k:'date', label:'As of', fmt:e => `<span class="muted">${esc(e.date || '—')}</span>`}
  ], rows, {sortKey:'usd', rowAttr:e => e.status === 'dark' ? 'class="dim"' : '', onRow:e => openMarket(e.code)});
}

/* ---------- Render: FX ---------- */
function renderFx(){
  $('#fxDate').textContent = 'Rates per USD as of ' + D.macro.fx_date + ' · ' + D.macro.macro_src;
  $('#usdNote').textContent = 'USD cash ' + f(M.usdRate, 3) + '% · ' + D.macro.usd_rate_note;
  const rows = D.macro.fx.map(r => { const m = Object.values(M.mac).find(m => m.country === r[1]) || M.mac[({XOF:"Côte d'Ivoire"})[r[0]]] || null; return {ccy:r[0], country:r[1], rate:r[2], ytd:r[3], y1:r[4], regime:r[5], m}; });
  table($('#fxTbl'), 'fx', [
    {k:'ccy', label:'CCY', fmt:r => `<span class="code">${r.ccy}</span>`},
    {k:'country', label:'Country'},
    {k:'rate', label:'Per USD', r:1, fmt:r => f(r.rate, r.rate < 100 ? 4 : 2)},
    {k:'ytd', label:'2026 vs USD', r:1, fmt:r => `<span class="${cls(r.ytd)}">${sp(r.ytd, 2)}</span>`},
    {k:'y1', label:'1 year', r:1, fmt:r => `<span class="${cls(r.y1)}">${sp(r.y1, 2)}</span>`},
    {k:'regime', label:'Regime', fmt:r => `<span class="muted">${esc(r.regime)}</span>`},
    {k:'pr', label:'Policy', r:1, v:r => r.m?.pr, fmt:r => r.m ? f(r.m.pr, 2) + '%' : '—'},
    {k:'cpi', label:'CPI y/y', r:1, v:r => r.m?.cpi, fmt:r => r.m ? f(r.m.cpi, 1) + '%' : '—'},
    {k:'real', label:'Real rate', r:1, v:r => r.m?.real, fmt:r => r.m ? `<b class="${cls(r.m.real)}">${pp(r.m.real, 1)}</b>` : '—'},
    {k:'carry', label:'Carry vs USD', r:1, v:r => r.m?.carry, fmt:r => r.m ? pp(r.m.carry, 1) : '—'},
    {k:'y10', label:'10y', r:1, v:r => r.m?.y10, fmt:r => r.m && isN(r.m.y10) ? f(r.m.y10, 2) + '%' : '—'},
    {k:'gdp', label:'GDP 26f', r:1, v:r => r.m?.gdp, fmt:r => r.m ? f(r.m.gdp, 1) + '%' : '—'},
    {k:'rating', label:'Rating', v:r => r.m?.ratingScore, fmt:r => esc(r.m?.rating || '—')}
  ], rows, {sortKey:'ytd'});
  const pts = rows.filter(r => r.m).map(r => ({x:clamp(r.m.real, -8, 12), y:r.ytd, r:4 + Math.max(0, r.m.gdp) * 1.4, label:r.ccy, code:r.ccy, color:r.m.real > 0 && r.ytd > -3 ? 'var(--up)' : r.m.real < 0 ? 'var(--down)' : 'var(--accent)', tip:`${r.country}: real rate ${pp(r.m.real)}pp, FX ${sp(r.ytd)}, GDP ${f(r.m.gdp)}%`}));
  $('#carryChart').innerHTML = scatter(pts, {xl:'Real policy rate (policy − CPI), pp', yl:'Currency vs USD, 2026 %', aria:'Carry map', h:360}) + '<p class="note">Top-right: positive real rates and a currency that held up — the classic carry sweet spot. Bottom-right: high real rates that still did not protect the currency, which usually means a positioning or reserves problem.</p>';
  // carry arithmetic: annual carry vs FX YTD (~0.73 of year elapsed)
  const yf = (new Date('2026-09-24') - new Date('2026-01-01')) / 31536e6;
  const ar = rows.filter(r => r.m && !/peg-?EUR|EUR peg/i.test(r.regime)).map(r => ({r, accrued:r.m.carry * yf, net:r.m.carry * yf + r.ytd})).sort((a, b) => b.net - a.net);
  $('#carryRank').innerHTML = divBars(ar.slice(0, 14).map(a => ({label:`${a.r.ccy} ${a.r.country}`.slice(0, 20), v:a.net, sub:`${pp(a.net)}  (carry ${pp(a.accrued)}, FX ${pp(a.r.ytd)})`})), {w:520, padL:130, rowH:21, aria:'Carry P&L YTD'}) +
    `<p class="note">Year-to-date P&amp;L of holding local cash at the policy rate funded in USD: accrued carry (${f(yf * 100, 0)}% of the year) plus the currency move. Policy rate is a proxy; T-bill yields and access costs differ.</p>`;
}

/* ---------- Render: movers ---------- */
let movEx = 'all', movCat = 'all';
function renderMov(){
  const sel = $('#movEx');
  if (!sel.options.length){ sel.innerHTML = '<option value="all">All exchanges</option>' + [...new Set(M.movers.map(m => m.ex))].map(x => `<option>${x}</option>`).join(''); sel.onchange = () => {movEx = sel.value; renderMov();}; }
  let rows = M.movers.filter(m => (movEx === 'all' || m.ex === movEx) && (movCat === 'all' || m.cat === movCat));
  const seen = new Set(); rows = rows.filter(m => {const k = m.ex + m.t + m.cat; if (seen.has(k)) return false; seen.add(k); return true;});
  const chartRows = rows.filter(m => isN(m.usd)).sort((a, b) => b.usd - a.usd).slice(0, 18);
  $('#movChart').innerHTML = divBars(chartRows.map(m => ({label:`${m.t} (${m.ex})`, v:m.usd, sub:sp(m.usd, 0) + (isN(m.cap) && m.cap < .05 ? '  ⚠ micro' : ''), color:isN(m.cap) && m.cap < .05 ? 'var(--faint)' : null})), {w:760, padL:170, rowH:19, aria:'Movers USD YTD'});
  table($('#movTbl'), 'mov', [
    {k:'ex', label:'Exch', fmt:m => `<span class="code">${m.ex}</span>`},
    {k:'t', label:'Ticker', fmt:m => `<span class="code">${esc(m.t)}</span>`},
    {k:'name', label:'Company'},
    {k:'sec', label:'Sector', fmt:m => `<span class="muted">${esc(m.sec)}</span>`},
    {k:'cat', label:'List', fmt:m => `<span class="chip ${m.cat === 'gainer' ? 'up' : m.cat === 'loser' ? 'down' : 'acc'}">${m.cat === 'largecap' ? 'Large cap' : m.cat}</span>`},
    {k:'px', label:'Price', r:1, fmt:m => isN(m.px) ? f(m.px, m.px < 100 ? 2 : 0) + ' <span class="faint">' + m.ccy + '</span>' : '—'},
    {k:'ytd', label:'YTD local', r:1, fmt:m => `<span class="${cls(m.ytd)}">${sp(m.ytd)}</span>`},
    {k:'usd', label:'YTD USD', r:1, fmt:m => `<b class="${cls(m.usd)}">${sp(m.usd)}</b>`},
    {k:'cap', label:'Cap $bn', r:1, fmt:m => isN(m.cap) ? f(m.cap, m.cap < 1 ? 3 : 1) + (m.cap < .05 ? ' <span class="chip down">illiquid</span>' : '') : '—'},
    {k:'pe', label:'P/E', r:1, fmt:m => f(m.pe, 1)},
    {k:'dy', label:'Yield', r:1, fmt:m => isN(m.dy) ? f(m.dy, 2) + '%' : '—'},
    {k:'d', label:'As of', fmt:m => `<span class="muted">${esc(m.d)}</span>`}
  ], rows, {sortKey:'usd', onRow:m => openMarket(m.ex)});
}

/* ---------- Ideas ---------- */
const yfrac = () => (new Date('2026-09-24') - new Date('2026-01-01')) / 31536e6;
const E = c => M.byCode[c] || {};
const MC = c => M.mac[c] || {};
const FXc = c => M.fx[c] || {};
function IDEAS(){
  const ng = MC('Nigeria'), eg = MC('Egypt'), gh = MC('Ghana'), zm = MC('Zambia'), za = MC('South Africa'), ma = MC('Morocco');
  const cu = D.macro.commodities.find(c => c[0] === 'Copper') || [], au = D.macro.commodities.find(c => c[0] === 'Gold') || [], pt = D.macro.commodities.find(c => c[0] === 'Platinum') || [];
  const mv = t => M.movers.find(m => m.t === t) || {};
  const peMed = (() => {const p = M.ex.map(e => e.pe).filter(isN).sort((a, b) => a - b); return p[Math.floor(p.length / 2)];})();
  // risk-adjusted momentum basket
  const pool = M.ex.filter(e => isN(e.usd) && isN(e.vol) && isN(e.mcap) && e.mcap >= 5).map(e => ({e, s:e.usd / e.vol})).sort((a, b) => b.s - a.s).slice(0, 5);
  const iv = pool.map(p => 1 / p.e.vol), ivs = iv.reduce((a, b) => a + b, 0); pool.forEach((p, i) => p.w = iv[i] / ivs);
  const bVol = Math.sqrt(pool.reduce((a, p, i) => a + pool.reduce((b, q, j) => b + p.w * q.w * p.e.vol * q.e.vol * (i === j ? 1 : .3), 0), 0));
  const eaCodes = ['DSE', 'USE', 'RSE'];
  const eaOpp = eaCodes.map(c => E(c).opp).filter(isN), eaInv = eaCodes.map(c => E(c).inv).filter(isN);
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  return [
    {id:'ngn', type:'Carry', aud:['Hedge fund', 'Quant'], mkt:'NGX', conv:4, hz:'3–6 months', preset:'ng',
     title:'Nigeria: lock in real yield after the 350bp cut',
     thesis:`The CBN cut to ${f(ng.pr, 1)}% with CPI at ${f(ng.cpi, 2)}%, leaving a ${pp(ng.real)}pp real rate while the naira has gained ${sp(FXc('NGN').ytd)} this year. An easing cycle pulls long FGN yields down, so duration adds to the carry.`,
     metrics:[['Real rate', pp(ng.real) + 'pp', 'up'], ['Carry vs USD', pp(ng.carry) + 'pp'], ['NGN 2026', sp(FXc('NGN').ytd), cls(FXc('NGN').ytd)], ['FGN 10y', f(ng.y10, 2) + '%'], ['1y FX breakeven', '−' + f(ng.carry, 1) + '%'], ['Stop (NGN)', f(FXc('NGN').rate * 1.05, 0)]],
     layers:[[40, 'Now: 2–5 year FGN bonds after the cut'], [30, '13 Oct: once the Dangote IPO closes and naira liquidity normalises'], [30, '24 Nov MPC: add on a further cut or reserve-ratio relief']],
     risk:'Cut or hedge ahead of the 16 Jan 2027 elections. The 45% cash reserve ratio is a sign policy could tighten again.'},
    {id:'dng', type:'Event', aud:['Hedge fund'], mkt:'NGX', conv:3, hz:'Now to December',
     title:'NGX: fade the IPO liquidity drain, then trade the index re-weight',
     thesis:`The $1.6bn Dangote refinery offer closes 13 Oct. Retail and local funds are selling winners to subscribe. At ~$49bn the refinery would be ~${f(49 / (E('NGX').mcap + 49) * 100, 0)}% of an enlarged NGX, forcing index funds to rebuy weight after listing.`,
     metrics:[['NGX YTD USD', sp(E('NGX').usd), cls(E('NGX').usd)], ['NGX P/E', f(E('NGX').pe, 1) + '×'], ['Foreign share', f(E('NGX').foreign, 1) + '%'], ['IPO / NGX cap', f(1.6 / E('NGX').mcap * 100, 1) + '%'], ['Post-listing weight', '~' + f(49 / (E('NGX').mcap + 49) * 100, 0) + '%'], ['FIRSTHOLDCO YTD', sp(mv('FIRSTHOLDCO').ytd, 0), 'up']],
     layers:[[50, 'Now–13 Oct: trim crowded mid-cap winners that are funding subscriptions'], [30, 'Listing (Nov): buy the refinery into index-inclusion demand'], [20, 'After inclusion: rotate back into oversold large caps']],
     risk:'Retail euphoria can keep lifting everything. A listing delay would push back the index flows.'},
    {id:'zmw', type:'Long', aud:['Hedge fund', 'PE / VC'], mkt:'LuSE', conv:4, hz:'6–12 months', preset:'china',
     title:'Zambia: kwacha and copper tailwinds, with local stocks still flat',
     thesis:`The kwacha is ${sp(FXc('ZMW').ytd)} against the dollar and copper ${sp(cu[3])} YTD, yet LuSE is flat in local terms, so its ${sp(E('LuSE').usd)} USD return came entirely from FX. Local 10-year bonds at ${f(zm.y10, 1)}% with CPI at ${f(zm.cpi, 1)}% give a ~${f(zm.y10 - zm.cpi, 1)}pp real yield.`,
     metrics:[['ZMW 2026', sp(FXc('ZMW').ytd), 'up'], ['Copper YTD', sp(cu[3]), 'up'], ['10y real yield', pp(zm.y10 - zm.cpi) + 'pp', 'up'], ['LuSE local', sp(E('LuSE').ytd), cls(E('LuSE').ytd)], ['Rating', zm.rating || '—'], ['Opp. score', E('LuSE').opp ?? '—']],
     layers:[[33, 'Now: local bonds 5–10y'], [33, 'After 30 Sep: once the copper duty-waiver decision is known'], [34, 'On a 5% copper pullback: LuSE miners and consumer names']],
     risk:'The copper duty coming back, a slowdown in China, CCC+ sovereign risk. Stress it with the China hard-landing preset.'},
    {id:'zap', type:'Pair', aud:['Hedge fund', 'Quant'], mkt:'JSE', conv:3, hz:'1–3 months', preset:'fed',
     title:'South Africa: long gold and PGM miners, short rate-sensitive SA Inc.',
     thesis:`SARB hiked to ${f(za.pr, 2)}% into an oil shock, and the 10y yields ${f(za.y10, 2)}%. Retailers and REITs carry the rate hit. Miners earn in dollars and hedge the rand. The pair is close to market-neutral into the 4 Nov municipal elections and the November MPC.`,
     metrics:[['Repo', f(za.pr, 2) + '%'], ['SAGB 10y', f(za.y10, 2) + '%'], ['JSE YTD USD', sp(E('JSE').usd), cls(E('JSE').usd)], ['Gold YTD', sp(au[3]), cls(au[3])], ['Platinum YTD', sp(pt[3]), cls(pt[3])], ['JSE P/E', f(E('JSE').pe, 1) + '×']],
     layers:[[50, 'Now: right after the hike'], [25, 'Into 4 Nov elections: add if polls point to GNU friction'], [25, 'November MPC: add on a hawkish signal']],
     risk:'Gold is already down slightly YTD, so a further drop breaks the long leg. A rand rally on a clean election hurts the pair.'},
    {id:'ghs', type:'Hedge', aud:['Hedge fund', 'PE / VC'], mkt:'GSE', conv:4, hz:'1–3 months',
     title:'Ghana: keep the equity gains, hedge the cedi',
     thesis:`The GSE is ${sp(E('GSE').ytd)} in cedis but the cedi is ${sp(FXc('GHS').ytd)}, so USD holders keep ${sp(E('GSE').usd)}. GoldBod purchases have been frozen since mid-August and inflation has turned up, so the FX leg is at risk before the equity leg.`,
     metrics:[['GSE local', sp(E('GSE').ytd), 'up'], ['GHS 2026', sp(FXc('GHS').ytd), 'down'], ['GSE in USD', sp(E('GSE').usd), cls(E('GSE').usd)], ['Policy / CPI', f(gh.pr, 1) + '% / ' + f(gh.cpi, 1) + '%'], ['Hedge cost ~', f(gh.carry, 1) + 'pp/yr'], ['Rating', gh.rating || '—']],
     layers:[[50, 'Now: hedge half the GSE exposure with cedi forwards or NDFs'], [25, 'Mid-Oct: add if GoldBod has not restarted buying'], [25, 'If BoG cuts: the rate differential shrinks, so hedging gets cheaper']],
     risk:'Forward points cost roughly the rate gap. A GoldBod restart would make the hedge a drag.'},
    {id:'egp', type:'Carry', aud:['Hedge fund', 'Quant'], mkt:'EGX', conv:3, hz:'3 months',
     title:'Egypt: T-bill carry with the FTSE decision as the swing event',
     thesis:`Deposit rate is ${f(eg.pr, 1)}% against ${f(eg.cpi, 1)}% CPI (real ${pp(eg.real)}pp). So far this year the pound's ${sp(FXc('EGP').ytd)} move has eaten about ${f(Math.abs(FXc('EGP').ytd) / (eg.carry * yfrac()) * 100, 0)}% of accrued carry. The FTSE classification in October decides whether foreign flows return or leave.`,
     metrics:[['Real rate', pp(eg.real) + 'pp', 'up'], ['Accrued carry YTD', pp(eg.carry * yfrac()) + 'pp'], ['EGP 2026', sp(FXc('EGP').ytd), 'down'], ['Net carry P&L', pp(eg.carry * yfrac() + FXc('EGP').ytd) + 'pp', cls(eg.carry * yfrac() + FXc('EGP').ytd)], ['EGX30 YTD USD', sp(E('EGX').usd), cls(E('EGX').usd)], ['EGX P/E', f(E('EGX').pe, 1) + '×']],
     layers:[[30, 'Now: 3-month T-bills'], [40, 'After the FTSE decision (Oct): add if Egypt is not demoted'], [30, 'If EGP overshoots to 53 or weaker: FX entry is cheaper']],
     risk:'Slippage in IMF reviews or a demotion. Core inflation is rising (14.9%).'},
    {id:'ncba', type:'Arb', aud:['Hedge fund', 'Quant'], mkt:'NSE', conv:3, hz:'Into October completion',
     title:'Kenya: Nedbank–NCBA merger spread',
     thesis:'CBK has approved Nedbank buying 66% of NCBA for $842m, paid 80% in Nedbank shares and 20% cash. The CMA waived a mandatory offer. Completion is expected in October, so the spread between NCBA and the offer value is the trade.',
     metrics:[['Deal value', '$842m'], ['Consideration', '80% stock'], ['KES 2026', sp(FXc('KES').ytd), cls(FXc('KES').ytd)], ['NSE YTD USD', sp(E('NSE').usd), cls(E('NSE').usd)], ['Foreign turnover', f(E('NSE').foreign, 1) + '%'], ['CBK rate', f(MC('Kenya').pr, 2) + '%']],
     layers:[[50, 'Now: long NCBA, short NED.JO in the exchange ratio'], [50, 'Once the final conditions are cleared'], [0, 'Exit at completion']],
     risk:'The stock leg moves with Nedbank and the rand, so hedge it. There is completion-delay risk.'},
    {id:'aaf', type:'Event', aud:['Hedge fund', 'PE / VC'], mkt:'NGX', conv:3, hz:'October',
     title:'Airtel Africa: sum-of-the-parts into the Airtel Money IPO',
     thesis:`Airtel Money (about 53m monthly users) will list at least 10% in London with IFC as cornerstone (up to $90m). The IPO sets a public price for the fintech unit. The NGX line is already ${sp(mv('AIRTELAFRI').ytd, 0)} in naira (${sp(mv('AIRTELAFRI').usd, 0)} in USD), so trade the gap between the London and Lagos lines rather than chasing.`,
     metrics:[['AIRTELAFRI YTD', sp(mv('AIRTELAFRI').ytd, 0), 'up'], ['USD-adjusted', sp(mv('AIRTELAFRI').usd, 0), 'up'], ['NGX cap', '$' + f(mv('AIRTELAFRI').cap, 1) + 'bn'], ['Float', '≥10%'], ['Cornerstone', 'IFC $90m'], ['Pricing', 'mid-Oct']],
     layers:[[50, 'Prospectus (early Oct): buy AAF.L if the Lagos premium is wide'], [50, 'At pricing: sell into the headline'], [0, 'Revisit after first trading week']],
     risk:'Much of the upside may already be in the Lagos price. The valuation could come in below M-Pesa and MoMo multiples.'},
    {id:'eapc', type:'Long', aud:['PE / VC'], mkt:'DSE', conv:4, hz:'3–5 years',
     title:'East Africa: fastest growth, least institutional money',
     thesis:`Uganda (${f(MC('Uganda').gdp, 1)}%), Rwanda (${f(MC('Rwanda').gdp, 1)}%) and Tanzania (${f(MC('Tanzania').gdp, 1)}%) are among the fastest-growing economies covered here. Their exchanges score ${f(avg(eaOpp), 0)} on opportunity but ${f(avg(eaInv), 0)} on investability, which is the underutilised quadrant. Listed prices (DSE ${sp(E('DSE').usd, 0)} in USD) show local money moving before foreign money does.`,
     metrics:[['Avg opp. score', f(avg(eaOpp), 0), 'up'], ['Avg investability', f(avg(eaInv), 0)], ['DSE YTD USD', sp(E('DSE').usd, 0), 'up'], ['USE YTD USD', sp(E('USE').usd, 0), 'up'], ['TZS 2026', sp(FXc('TZS').ytd), 'down'], ['CRDB YTD', sp(mv('CRDB').ytd, 0), 'up']],
     layers:[[25, 'Now: listed banks (CRDB, NMB) as a liquid proxy'], [50, 'Over 12 months: private growth equity and credit in consumer, logistics and payments'], [25, 'IPO exits, such as the Quickmart NSE listing, and upcoming pipeline']],
     risk:'Kenya\'s August 2027 election, thin exit liquidity, and a shilling that has weakened about 7% this year.'},
    {id:'sen', type:'Hedge', aud:['Hedge fund'], mkt:'BRVM', conv:3, hz:'Q4 2026',
     title:'Senegal: wait for workout terms, hedge BRVM beta now',
     thesis:`Senegal wants to reprofile about $5bn of commercial debt under a $2.2bn IMF programme. The BRVM is ${sp(E('BRVM').usd, 0)} in USD this year and fell 3.66% on 23 Sep, so sentiment is fragile. Sonatel and the banks carry the index.`,
     metrics:[['BRVM YTD USD', sp(E('BRVM').usd, 0), 'up'], ['XOF 2026', sp(FXc('XOF').ytd), cls(FXc('XOF').ytd)], ['Debt to treat', '$5bn'], ['IMF programme', '$2.2bn'], ['Sonatel YTD', sp(mv('SNTS').ytd, 0), 'up'], ['WAEMU rate', f(MC("Côte d'Ivoire").pr, 1) + '%']],
     layers:[[30, 'Now: trim or hedge Senegal-heavy BRVM names (Sonatel)'], [40, 'When terms are published: buy Eurobonds if recovery value is above price'], [30, 'After the IMF board: rebuild BRVM exposure']],
     risk:'Terms could be harsher than expected. There is contagion risk to Côte d\'Ivoire paper.'},
    {id:'mar', type:'Short', aud:['Hedge fund', 'Quant'], mkt:'BVC', conv:2, hz:'1–3 months',
     title:'Morocco: most expensive market with a negative USD return',
     thesis:`The MASI trades at about ${f(E('BVC').pe, 1)}× forward earnings against a board median of ${f(peMed, 1)}×, and is ${sp(E('BVC').usd)} in USD this year. The 23 Sep election adds coalition uncertainty. Mining names such as Managem are the exception.`,
     metrics:[['Fwd P/E', f(E('BVC').pe, 1) + '×', 'down'], ['Board median', f(peMed, 1) + '×'], ['MASI YTD USD', sp(E('BVC').usd), cls(E('BVC').usd)], ['MAD 2026', sp(FXc('MAD').ytd), 'down'], ['Real rate', pp(ma.real) + 'pp'], ['Rating', ma.rating || '—']],
     layers:[[50, 'Now: underweight versus a frontier benchmark'], [50, 'Add once a coalition forms if policy direction is unclear'], [0, 'Cover if the MASI breaks back above its August high (18,653)']],
     risk:'A phosphate or infrastructure spending surge. Gold strength lifts the mining names.'},
    {id:'mom', type:'Quant', aud:['Quant'], mkt:pool[0]?.e.code || 'NGX', conv:3, hz:'Monthly rebalance',
     title:'Frontier risk-adjusted momentum basket',
     thesis:`Rank markets with at least $5bn cap by 2026 USD return divided by assumed volatility, take the top five, and weight by inverse volatility. Current basket: ${pool.map(p => `${p.e.code} ${f(p.w * 100, 0)}%`).join(', ')}. This updates automatically when the feed refreshes.`,
     metrics:[['Basket USD YTD', sp(pool.reduce((a, p) => a + p.w * p.e.usd, 0), 1), 'up'], ['Est. vol (ρ=0.3)', f(bVol, 1) + '%'], ['Top signal', pool[0] ? pool[0].e.code : '—'], ['Names', pool.length], ['Rebalance', 'Monthly'], ['Min cap', '$5bn']],
     layers:[[33, 'Week 1: first third, since thin books punish size'], [33, 'Week 2: second third'], [34, 'Week 3: final third, then monthly rebalance']],
     risk:'Frontier momentum can collapse on a devaluation. Liquidity limits capacity, and the volatility figures are assumptions until price history is loaded.'}
  ];
}
let ideaType = 'All', ideaAud = 'all';
function renderIdeas(){
  // quadrant
  const pts = M.sc.map(e => ({x:e.inv, y:e.opp, r:5 + Math.sqrt(e.mcap) / 4, label:e.code, code:e.code, color:e.gap > 15 ? 'var(--up)' : e.gap < -15 ? 'var(--down)' : 'var(--accent)', tip:`${e.country}: opportunity ${e.opp}, investability ${e.inv}`}));
  $('#quad').innerHTML = scatter(pts, {xmin:0, xmax:100, ymin:0, ymax:100, xl:'Investability (size, rating, FX regime)', yl:'Opportunity (growth, real rate, value, momentum, FX)', aria:'Opportunity quadrant', h:400,
    bg:(X, Y) => `<rect x="${X(0)}" y="${Y(100)}" width="${X(50) - X(0)}" height="${Y(50) - Y(100)}" fill="var(--up-soft)"/><text x="${X(2)}" y="${Y(96)}" style="fill:var(--up);font-weight:600">UNDERUTILISED</text><text x="${X(98)}" y="${Y(96)}" text-anchor="end" style="font-weight:600">CORE ALLOCATION</text><text x="${X(98)}" y="${Y(4)}" text-anchor="end" style="font-weight:600">CROWDED / PRICED</text><text x="${X(2)}" y="${Y(4)}" style="font-weight:600">AVOID</text>`}) +
    '<p class="note">Green dots sit well above their investability, so fundamentals are ahead of the capital that can reach them. That gap is where private equity, direct lending and early foreign entry have the most room.</p>';
  $$('#quad .pt').forEach(g => g.onclick = () => openMarket(g.dataset.code));
  table($('#scoreTbl'), 'score', [
    {k:'code', label:'Mkt', fmt:e => `<span class="code">${e.code}</span>`},
    {k:'opp', label:'Opp.', r:1, fmt:e => `<b>${e.opp}</b>`},
    {k:'inv', label:'Invest.', r:1},
    {k:'gap', label:'Gap', r:1, fmt:e => `<span class="${cls(e.gap)}">${pp(e.gap, 0)}</span>`},
    {k:'usd', label:'USD YTD', r:1, fmt:e => `<span class="${cls(e.usd)}">${sp(e.usd, 0)}</span>`}
  ], M.sc, {sortKey:'gap', onRow:e => openMarket(e.code)});
  const all = IDEAS();
  const types = ['All', ...new Set(all.map(i => i.type))];
  const seg = $('#ideaType');
  seg.innerHTML = types.map(t => `<button data-v="${t}" aria-pressed="${t === ideaType}">${t}</button>`).join('');
  seg.querySelectorAll('button').forEach(b => b.onclick = () => {ideaType = b.dataset.v; renderIdeas();});
  const list = all.filter(i => (ideaType === 'All' || i.type === ideaType) && (ideaAud === 'all' || i.aud.includes(ideaAud)));
  $('#ideas').innerHTML = list.map(i => `<article class="card">
    <div class="meta"><span class="chip ${i.type === 'Short' || i.type === 'Hedge' ? 'down' : i.type === 'Long' || i.type === 'Carry' ? 'up' : 'acc'}">${i.type}</span><span class="code">${i.mkt}</span><span>${esc(i.hz)}</span><span title="Conviction ${i.conv}/5" class="imp">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= i.conv ? 'on' : ''}"></i>`).join('')}</span><span>${i.aud.join(' · ')}</span></div>
    <h3>${esc(i.title)}</h3>
    <p>${esc(i.thesis)}</p>
    <dl class="metrics">${i.metrics.map(m => `<div><dt>${esc(m[0])}</dt><dd class="${m[2] || ''}">${esc(m[1])}</dd></div>`).join('')}</dl>
    <div><div class="eyebrow" style="margin-bottom:4px">Layering plan</div><div class="ladder">${i.layers.map(l => `<div class="rung"><b>${l[0] ? l[0] + '%' : '—'}</b><span>${esc(l[1])}</span></div>`).join('')}</div></div>
    <p class="note"><b>Invalidation:</b> ${esc(i.risk)}</p>
    <div class="meta"><button class="btn" data-mkt="${i.mkt}">Open ${i.mkt}</button>${i.preset ? `<button class="btn" data-preset="${i.preset}">Stress test</button>` : ''}<button class="btn" data-memo="${i.id}">Draft memo with Claude</button></div>
  </article>`).join('') || '<p class="muted">No ideas match this filter.</p>';
  $$('#ideas [data-mkt]').forEach(b => b.onclick = () => openMarket(b.dataset.mkt));
  $$('#ideas [data-preset]').forEach(b => b.onclick = () => {applyPreset(b.dataset.preset); go('scn');});
  $$('#ideas [data-memo]').forEach(b => b.onclick = () => {const i = all.find(x => x.id === b.dataset.memo); go('dsk'); ask(`Draft a one-page investment memo for this idea: "${i.title}". Include thesis, the quantified case from the data, catalysts with dates, the layering plan, hedges, position sizing guidance for a $50m book, and what would invalidate it. Idea detail: ${i.thesis} Layers: ${i.layers.map(l => l[0] + '% ' + l[1]).join('; ')}. Risk: ${i.risk}`);});
}

/* ---------- Scenario lab ---------- */
const S0 = {oil:0, gold:0, copper:0, softs:0, usd:0, ust:0, china:0, glob:0, polC:'NGX', polS:0};
let S = {...S0};
const PRESETS = {
  oil:  {n:'Gulf escalation', s:{oil:30, usd:3, glob:-8, gold:8}},
  deesc:{n:'Gulf de-escalation', s:{oil:-30, usd:-2, glob:5}},
  fed:  {n:'Fed +100bp shock', s:{ust:100, usd:5, glob:-10}},
  china:{n:'China hard landing', s:{china:-2.5, copper:-20, oil:-15, gold:5, glob:-15, usd:3}},
  gold: {n:'Gold super-cycle', s:{gold:20, usd:-3}},
  riskon:{n:'EM risk-on rally', s:{usd:-5, ust:-75, glob:10, copper:10}},
  ng:   {n:'Nigeria pre-election stress', s:{polC:'NGX', polS:3, usd:1}},
  sahel:{n:'Sahel contagion', s:{polC:'BRVM', polS:3, gold:10, softs:10}},
  cocoa:{n:'El Niño soft-commodity spike', s:{softs:30}}
};
function applyPreset(k){ S = {...S0, ...PRESETS[k].s}; renderScn(true); }
function impacts(){
  return Object.keys(BETA).map(c => {
    const b = BETA[c]; const parts = {};
    FACTORS.forEach(F => parts[F.k] = b[F.k] * (S[F.k] / F.unit));
    const e = M.byCode[c];
    parts.pol = c === S.polC ? -5 * S.polS : (REGION[c] && REGION[c] === REGION[S.polC] ? -1 * S.polS : 0);
    const tot = Object.values(parts).reduce((a, v) => a + v, 0);
    return {code:c, e, parts, tot};
  }).filter(r => r.e && r.e.code);
}
function renderScn(syncInputs){
  const pr = $('#presets');
  if (!pr.children.length){
    pr.innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button class="btn" data-p="${k}">${esc(p.n)}</button>`).join('');
    pr.querySelectorAll('button').forEach(b => b.onclick = () => applyPreset(b.dataset.p));
    const sl = $('#sliders');
    sl.innerHTML = FACTORS.map(F => `<div class="sl"><label for="s-${F.k}">${F.name} <b id="v-${F.k}"></b></label><input type="range" id="s-${F.k}" min="${F.min}" max="${F.max}" step="${F.step}" value="0"></div>`).join('') +
      `<div class="sl"><label for="s-polC">Political shock market</label><select id="s-polC" style="width:100%">${Object.keys(BETA).map(c => `<option value="${c}">${c} · ${esc(M.byCode[c]?.country || '')}</option>`).join('')}</select></div>` +
      `<div class="sl"><label for="s-polS">Political shock severity <b id="v-polS"></b></label><input type="range" id="s-polS" min="0" max="5" step="1" value="0"></div>`;
    FACTORS.forEach(F => $('#s-' + F.k).oninput = ev => {S[F.k] = +ev.target.value; renderScn();});
    $('#s-polC').onchange = ev => {S.polC = ev.target.value; renderScn();};
    $('#s-polS').oninput = ev => {S.polS = +ev.target.value; renderScn();};
    $('#scnReset').onclick = () => {S = {...S0}; renderScn(true);};
    const fm = $('#fanMkt'); fm.innerHTML = Object.keys(BETA).map(c => `<option>${c}</option>`).join(''); fm.value = 'NGX'; fm.onchange = renderFan;
  }
  if (syncInputs){ FACTORS.forEach(F => $('#s-' + F.k).value = S[F.k]); $('#s-polC').value = S.polC; $('#s-polS').value = S.polS; }
  FACTORS.forEach(F => $('#v-' + F.k).textContent = (S[F.k] > 0 ? '+' : '') + S[F.k] + F.u);
  $('#v-polS').textContent = S.polS ? S.polS + '/5' : 'off';
  const R = impacts().sort((a, b) => b.tot - a.tot);
  const wmap = Object.fromEntries(M.elig.map(e => [e.code, e.w]));
  const kac = R.reduce((a, r) => a + (wmap[r.code] || 0) * r.tot, 0) / (R.reduce((a, r) => a + (wmap[r.code] || 0), 0) || 1);
  $('#scnSum').innerHTML = `Composite impact <b class="${cls(kac)}">${sp(kac, 1)}</b>`;
  $('#scnBars').innerHTML = divBars(R.map(r => ({label:`${r.code} · ${r.e.country}`, v:r.tot, sub:sp(r.tot, 1), tip:Object.entries(r.parts).filter(([, v]) => Math.abs(v) > .05).map(([k, v]) => `${k} ${pp(v, 1)}`).join(', ')})), {w:640, padL:150, rowH:20, minMax:2, aria:'Scenario impact'});
  // read-out
  const HEDGE = {oil:'Brent calls, or long NGX oil names (SEPLAT, ARADEL) against importer exposure', gold:'Gold puts, or trim GSE/ZSE gold-linked names', copper:'LME copper puts; trim LuSE and ZMW bonds', softs:'ICE cocoa/coffee options', usd:'Buy USD through NDFs on the weakest currencies, or USD/ZAR calls as the liquid proxy for SSA FX', ust:'Pay US rates or shorten duration in local bonds', china:'Short copper or JSE miners; long USD/ZAR', glob:'EEM or S&P puts; JSE Top 40 futures are the liquid hedge', pol:'Country CDS or Eurobond shorts; cut size before the event date'};
  const nonzero = R.some(r => Math.abs(r.tot) > .05);
  if (!nonzero){ $('#scnRead').innerHTML = '<p class="muted">Pick a preset or move a slider. The read-out names winners, losers, the driver behind the worst hit and a liquid hedge.</p>'; }
  else {
    const worst = R.slice(-3).reverse(), best = R.slice(0, 3);
    const w0 = worst[0]; const drv = Object.entries(w0.parts).sort((a, b) => a[1] - b[1])[0];
    const b0 = best[0]; const drvB = Object.entries(b0.parts).sort((a, b) => b[1] - a[1])[0];
    $('#scnRead').innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">
      <div class="stripe bull"><div class="eyebrow">Relative overweight</div>${best.map(r => `<div><span class="code">${r.code}</span> <b class="${cls(r.tot)}">${sp(r.tot)}</b> <span class="muted">${esc(r.e.country)}</span></div>`).join('')}<div class="note">Main driver for ${b0.code}: ${drvB[0]} (${pp(drvB[1])}pp)</div></div>
      <div class="stripe bear"><div class="eyebrow">Relative underweight / short</div>${worst.map(r => `<div><span class="code">${r.code}</span> <b class="${cls(r.tot)}">${sp(r.tot)}</b> <span class="muted">${esc(r.e.country)}</span></div>`).join('')}<div class="note">Main driver for ${w0.code}: ${drv[0]} (${pp(drv[1])}pp)</div></div>
      <div class="stripe neu"><div class="eyebrow">Hedge</div><div>${esc(HEDGE[drv[0]] || '')}</div></div>
      <div class="note">Spread between best and worst: <b>${f(b0.tot - w0.tot, 1)}pp</b>. That is the room for a relative-value pair under this scenario.</div></div>`;
  }
  renderFan(); renderBook(R);
}
function rng(seed){ return () => {seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296;}; }
function renderFan(){
  const c = $('#fanMkt').value || 'NGX'; const vol = (VOL[c] || 25) / 100;
  const imp = (impacts().find(r => r.code === c) || {tot:0}).tot / 100;
  const r = rng(42), N = 2000, T = 12, paths = [];
  const gauss = () => {let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);};
  const mu = Math.log(1 + imp);
  for (let n = 0; n < N; n++){ let x = 100; const p = [x]; for (let t = 1; t <= T; t++){ x *= Math.exp((mu - .5 * vol * vol) / 12 + vol / Math.sqrt(12) * gauss()); p.push(x);} paths.push(p); }
  const q = [5, 25, 50, 75, 95]; const Q = q.map(() => []);
  for (let t = 0; t <= T; t++){ const col = paths.map(p => p[t]).sort((a, b) => a - b); q.forEach((qq, i) => Q[i].push(col[Math.floor(qq / 100 * (N - 1))])); }
  const W = 640, H = 300, pl = 44, prr = 70, pt = 12, pb = 28;
  const ymin = Math.min(...Q[0]) * .97, ymax = Math.max(...Q[4]) * 1.03;
  const X = t => pl + t / T * (W - pl - prr), Y = v => H - pb - (v - ymin) / (ymax - ymin) * (H - pt - pb);
  const band = (lo, hi) => 'M' + lo.map((v, t) => `${X(t)},${Y(v)}`).join('L') + 'L' + hi.map((v, t) => `${X(T - t)},${Y(hi[T - t])}`).join('L') + 'Z';
  const ticks = []; const st = (ymax - ymin) > 80 ? 25 : (ymax - ymin) > 40 ? 10 : 5; for (let v = Math.ceil(ymin / st) * st; v <= ymax; v += st) ticks.push(v);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Simulated path distribution">`;
  s += '<g class="grid">' + ticks.map(v => `<line x1="${pl}" x2="${W - prr}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('') + '</g>';
  s += ticks.map(v => `<text x="${pl - 6}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`).join('');
  [0, 3, 6, 9, 12].forEach(t => s += `<text x="${X(t)}" y="${H - 8}" text-anchor="middle">${t === 0 ? 'now' : '+' + t + 'm'}</text>`);
  s += `<path d="${band(Q[0], Q[4])}" fill="var(--accent)" fill-opacity=".14"/><path d="${band(Q[1], Q[3])}" fill="var(--accent)" fill-opacity=".28"/>`;
  s += `<path d="M${Q[2].map((v, t) => `${X(t)},${Y(v)}`).join('L')}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  s += `<line class="axis" x1="${pl}" x2="${W - prr}" y1="${Y(100)}" y2="${Y(100)}" stroke-dasharray="3 3"/>`;
  q.forEach((qq, i) => s += `<text x="${W - prr + 6}" y="${Y(Q[i][T]) + 3}" style="fill:var(--text)">P${qq} ${f(Q[i][T] - 100, 0)}%</text>`);
  s += '</svg>';
  const pLoss = paths.filter(p => p[T] < 100).length / N * 100;
  $('#fan').innerHTML = s + `<p class="note">${c}: 12-month USD value of 100, drift set by the scenario (${sp(imp * 100, 1)}), assumed volatility ${f(vol * 100, 0)}%. Chance of a loss: <b>${f(pLoss, 0)}%</b>. Bands show the 5–95th and 25–75th percentiles. The median sits below the scenario drift because volatility drags on compounded returns.</p>`;
}
function renderBook(R){
  const codes = Object.keys(BETA);
  let W = store.get('book', {JSE:20, NGX:20, EGX:15, NSE:15, GSE:10, BRVM:10, LuSE:10});
  const el = $('#book');
  if (!el.dataset.built){
    el.dataset.built = 1;
    el.innerHTML = `<div class="tw"><table><thead><tr><th class="nosort">Market</th><th class="r nosort">Weight %</th><th class="r nosort">Scenario</th><th class="r nosort">P&amp;L pp</th></tr></thead><tbody id="bookRows">${codes.map(c => `<tr style="cursor:default"><td><span class="code">${c}</span> <span class="muted">${esc(M.byCode[c]?.country || '')}</span></td><td class="r"><input class="inp num" style="width:64px;text-align:right" id="w-${c}" type="number" step="5" value="${W[c] || 0}" aria-label="${c} weight"></td><td class="r num" id="bi-${c}"></td><td class="r num" id="bp-${c}"></td></tr>`).join('')}</tbody></table></div><div id="bookSum" style="margin-top:10px"></div>`;
    codes.forEach(c => $('#w-' + c).oninput = () => {W = store.get('book', W); W[c] = +$('#w-' + c).value || 0; store.set('book', W); renderBook(impacts());});
  }
  W = store.get('book', W);
  const imp = Object.fromEntries(R.map(r => [r.code, r.tot]));
  let pnl = 0, gross = 0, net = 0;
  codes.forEach(c => {const w = (W[c] || 0) / 100; const p = w * (imp[c] || 0); pnl += p; gross += Math.abs(w); net += w; $('#bi-' + c).innerHTML = `<span class="${cls(imp[c])}">${sp(imp[c], 1)}</span>`; $('#bp-' + c).innerHTML = w ? `<b class="${cls(p)}">${pp(p, 2)}</b>` : '<span class="faint">·</span>';});
  const ws = codes.map(c => (W[c] || 0) / 100), vs = codes.map(c => (VOL[c] || 25) / 100);
  let v2 = 0; ws.forEach((wi, i) => ws.forEach((wj, j) => v2 += wi * wj * vs[i] * vs[j] * (i === j ? 1 : .3)));
  const sig = Math.sqrt(Math.max(0, v2)) * 100;
  $('#bookSum').innerHTML = `<dl class="metrics"><div><dt>Scenario P&amp;L</dt><dd class="${cls(pnl)}">${pp(pnl, 2)}%</dd></div><div><dt>Gross / net</dt><dd>${f(gross * 100, 0)}% / ${f(net * 100, 0)}%</dd></div><div><dt>Est. vol (ρ=0.3)</dt><dd>${f(sig, 1)}%</dd></div><div><dt>1y 95% VaR</dt><dd class="down">${f(1.645 * sig, 1)}%</dd></div></dl><p class="note">Weights are saved in this browser. Volatility and correlation are assumptions until tick history is connected.</p>`;
}

/* ---------- Risk / PESTLE ---------- */
function heatColor(v, mx){ const t = clamp(Math.abs(v) / mx, 0, 1); return v >= 0 ? `color-mix(in srgb, var(--up) ${Math.round(t * 70)}%, var(--panel))` : `color-mix(in srgb, var(--down) ${Math.round(t * 70)}%, var(--panel))`; }
const SEC2P = {Policy:'Legal', Agriculture:'Environmental', Fintech:'Technological', Telecoms:'Technological', Energy:'Economic', Mining:'Economic', FX:'Economic', 'Rates & Debt':'Economic', Commodities:'Economic', Equities:'Economic', Banking:'Economic', 'M&A':'Economic', 'PE/VC':'Economic', Infrastructure:'Economic'};
let calF = 'all';
function renderRisk(){
  const codes = Object.keys(BETA);
  const unitShock = {oil:10, gold:10, copper:10, softs:10, usd:5, ust:100, china:1, glob:-10};
  const cols = FACTORS.map(F => ({...F, shock:unitShock[F.k]}));
  const vals = codes.map(c => cols.map(F => BETA[c][F.k] * F.shock / F.unit));
  const mx = Math.max(...vals.flat().map(Math.abs));
  $('#heat').innerHTML = `<table class="heat"><thead><tr><th class="nosort">Market</th>${cols.map(F => `<th class="nosort" style="text-align:center">${F.name}<br><span class="faint" style="text-transform:none">${F.k === 'glob' ? '−10%' : (F.shock > 0 ? '+' : '') + F.shock + F.u}</span></th>`).join('')}</tr></thead><tbody>${codes.map((c, i) => `<tr style="cursor:pointer" data-c="${c}"><td style="text-align:left"><span class="code">${c}</span> <span class="muted">${esc(M.byCode[c]?.country || '')}</span></td>${vals[i].map(v => `<td style="background:${heatColor(v, mx)}">${pp(v, 1)}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="note">Read across a row to see a market's shock fingerprint. Read down a column to see who wins and loses from one global driver. Figures are USD return in percentage points. Coefficients are a judgment-calibrated v0 based on commodity export mix, currency regime, external funding needs and foreign ownership. They are the part of the model to replace with regression betas once daily history is connected.</p>`;
  $$('#heat tbody tr').forEach(tr => tr.onclick = () => openMarket(tr.dataset.c));
  // PESTLE board
  const P = ['Political', 'Economic', 'Social', 'Technological', 'Legal', 'Environmental'];
  const board = {};
  const add = (country, p, lvl, why) => { if (!country || country === 'Pan-Africa') return; const b = board[country] || (board[country] = {}); const cur = b[p] || {lvl:0, why:[]}; cur.lvl = Math.max(cur.lvl, lvl); cur.why.push(why); b[p] = cur; };
  M.cal.forEach(e => add(e.c, e.p, e.risk, `${e.d}: ${e.ev}`));
  M.stories.forEach(s => { if (s.sig !== 'bearish') return; s.c.forEach(c => add(c, SEC2P[s.sec] || 'Economic', Math.min(5, s.imp), `${s.d}: ${s.h}`)); });
  Object.values(M.mac).forEach(m => { if (m.cpi >= 10) add(m.country, 'Social', m.cpi >= 15 ? 4 : 3, `CPI at ${f(m.cpi, 1)}% squeezes household incomes`); if (/CCC|SD|Caa/.test(m.rating || '')) add(m.country, 'Economic', 5, `Sovereign rating ${m.rating}`); });
  const rows = Object.entries(board).map(([c, b]) => ({c, b, max:Math.max(...P.map(p => b[p]?.lvl || 0)), sum:P.reduce((a, p) => a + (b[p]?.lvl || 0), 0)})).sort((a, b) => b.sum - a.sum);
  const lc = l => l >= 5 ? 'var(--down)' : l >= 4 ? `color-mix(in srgb, var(--down) 70%, var(--panel))` : l >= 3 ? `color-mix(in srgb, var(--warn) 60%, var(--panel))` : l >= 1 ? `color-mix(in srgb, var(--warn) 25%, var(--panel))` : 'transparent';
  $('#pestle').innerHTML = `<table class="heat"><thead><tr><th class="nosort">Country</th>${P.map(p => `<th class="nosort" title="${p}" style="text-align:center">${p[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr style="cursor:default"><td style="text-align:left">${esc(r.c)}</td>${P.map(p => { const x = r.b[p]; return `<td style="background:${lc(x?.lvl || 0)};${x?.lvl >= 4 ? 'color:#fff' : ''}" title="${esc(x ? x.why.join('\n') : 'No flagged item')}">${x ? x.lvl : '·'}</td>`; }).join('')}</tr>`).join('')}</tbody></table><p class="note">Scores come from the calendar, bearish newswire items and macro rules (CPI ≥10% flags Social; CCC or default ratings flag Economic). Hover a cell to see the reasons. A dot means nothing is flagged yet, not that there is no risk.</p>`;
  const sel = $('#calF'); sel.onchange = () => {calF = sel.value; renderRisk();};
  const cl = M.cal.filter(e => calF === 'all' || e.p === calF);
  $('#cal').innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">${cl.map(e => `<div class="stripe ${e.risk >= 4 ? 'bear' : e.risk >= 3 ? '' : 'neu'}" style="${e.risk === 3 ? 'border-color:var(--warn)' : ''}"><div class="meta"><span class="code">${esc(e.d)}</span><b style="color:var(--text)">${esc(e.c)}</b><span class="chip">${e.p}</span><span class="imp" title="Risk ${e.risk}/5">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= e.risk ? 'on' : ''}"></i>`).join('')}</span></div><div>${esc(e.ev)}</div><div class="note">${esc(e.imp)} <a href="${esc(e.url)}" target="_blank" rel="noopener">Source</a></div></div>`).join('')}</div>`;
}

/* ---------- News ---------- */
let nwsQ = '', nwsSec = 'all', nwsSig = 'all';
function renderNews(){
  const secs = [...new Set(M.stories.map(s => s.sec))].sort();
  const ss = $('#nwsSec'); if (!ss.options.length){ ss.innerHTML = '<option value="all">All sectors</option>' + secs.map(s => `<option>${esc(s)}</option>`).join(''); ss.onchange = () => {nwsSec = ss.value; renderNews();}; $('#nwsSig').onchange = e => {nwsSig = e.target.value; renderNews();}; $('#nwsQ').oninput = e => {nwsQ = e.target.value.toLowerCase(); renderNews();}; }
  const list = M.stories.filter(s => (nwsSec === 'all' || s.sec === nwsSec) && (nwsSig === 'all' || s.sig === nwsSig) && (!nwsQ || (s.h + ' ' + s.s + ' ' + s.c.join(' ') + ' ' + s.t.join(' ') + ' ' + s.sec).toLowerCase().includes(nwsQ)));
  $('#nwsCount').textContent = `${list.length} of ${M.stories.length} stories · newest ${M.stories[0]?.d || ''}`;
  $('#news').innerHTML = list.map(s => `<article class="stripe ${s.sig === 'bullish' ? 'bull' : s.sig === 'bearish' ? 'bear' : 'neu'}">
    <div class="meta"><span class="code">${s.d}</span><span class="chip ${s.sig === 'bullish' ? 'up' : s.sig === 'bearish' ? 'down' : ''}">${s.sig}</span><span class="chip">${esc(s.sec)}</span><span>${esc(s.c.join(', '))}</span><span class="imp" title="Impact ${s.imp}/5">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= s.imp ? 'on' : ''}"></i>`).join('')}</span></div>
    <h3 style="margin:4px 0;font-family:var(--f-disp);font-size:15px;font-stretch:105%;text-wrap:balance">${esc(s.h)}</h3>
    <p style="margin:0 0 4px">${esc(s.s)}</p>
    <p class="note" style="margin:0"><b style="color:var(--accent-ink)">Angle:</b> ${esc(s.opp)} ${s.t.length ? '· ' + s.t.map(t => `<span class="code">${esc(t)}</span>`).join(' ') : ''} · <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.src)}</a></p>
  </article>`).join('') || '<p class="muted">No stories match.</p>';
  const agg = {}; M.stories.forEach(s => {const a = agg[s.sec] || (agg[s.sec] = {b:0, r:0}); if (s.sig === 'bullish') a.b += s.imp; else if (s.sig === 'bearish') a.r += s.imp;});
  const items = Object.entries(agg).map(([k, a]) => ({label:k, v:a.b - a.r, sub:`+${a.b} / −${a.r}`})).sort((a, b) => b.v - a.v);
  $('#tally').innerHTML = divBars(items, {w:420, padL:110, rowH:22, aria:'Signal tally'}) + '<p class="note">Net = bullish impact points minus bearish. Click a sector in the filter to read the stories behind it.</p>';
}

/* ---------- Rich list ---------- */
function renderRich(){
  const tot = M.rich.reduce((a, r) => a + r.nw, 0);
  $('#richSum').textContent = `Top ${M.rich.length} combined $${f(tot, 1)}bn · Forbes real-time and Forbes Africa 2026`;
  $('#richBars').innerHTML = divBars(M.rich.map(r => ({label:r.name.replace(' & family', ''), v:r.nw, sub:`$${f(r.nw, 1)}bn · ${r.c}`, color:r.venue ? 'var(--accent)' : 'var(--faint)'})), {w:640, padL:170, rowH:19, aria:'Net worth'}) + '<div class="legend"><span><i style="background:var(--accent)"></i>Wealth tied to an African listing</span><span><i style="background:var(--faint)"></i>Mostly private or offshore</span></div>';
  const v = {}; M.rich.forEach(r => { if (r.venue){ v[r.venue] = (v[r.venue] || 0) + r.nw; } });
  $('#richVenue').innerHTML = divBars(Object.entries(v).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({label:k, v:n, sub:`$${f(n, 1)}bn · venue ${sp(M.byCode[k]?.usd, 0)}`})), {w:460, padL:60, rowH:26, aria:'Wealth by venue'}) + '<p class="note">NGX dominates African listed billionaire wealth. When the Dangote refinery lists, Dangote\'s refinery stake is marked to a public price for the first time, the largest single wealth re-mark on the continent.</p>';
  table($('#richTbl'), 'rich', [
    {k:'rank', label:'#', r:1},
    {k:'name', label:'Name', fmt:r => `<b>${esc(r.name)}</b>`},
    {k:'c', label:'Country'},
    {k:'nw', label:'Net worth $bn', r:1, fmt:r => f(r.nw, 1)},
    {k:'src', label:'Source', fmt:r => `<span class="muted">${esc(r.src)}</span>`},
    {k:'hold', label:'Listed drivers', nosort:1, fmt:r => r.hold.length ? r.hold.map(h => `<span class="chip">${esc(h)}</span>`).join(' ') : '<span class="faint">private</span>'},
    {k:'vusd', label:'Venue USD YTD', r:1, v:r => M.byCode[r.venue]?.usd, fmt:r => r.venue ? `<span class="${cls(M.byCode[r.venue]?.usd)}">${esc(r.venue)} ${sp(M.byCode[r.venue]?.usd, 0)}</span>` : '—'},
    {k:'note', label:'What moves it', nosort:1, fmt:r => `<span style="white-space:normal;display:inline-block;min-width:240px">${esc(r.note)}</span>`},
    {k:'asof', label:'As of', fmt:r => `<span class="muted">${esc(r.asof)}</span>`}
  ], M.rich, {sortKey:'nw', onRow:r => r.venue && openMarket(r.venue)});
}

/* ---------- Ask the desk (Claude via sample) ---------- */
let sampleFn = null, deskBusy = false; const chat = [];
function context(){
  const board = M.ex.filter(e => e.status !== 'dark').map(e => ({c:e.code, ctry:e.country, ytdLocal:e.ytd, fxYtd:e.fx?.ytd, ytdUsd:e.usd && +e.usd.toFixed(1), capBn:e.mcap, pe:e.pe, opp:e.opp, inv:e.inv, asOf:e.date}));
  return JSON.stringify({asOf:D.meta?.asof, composite:{usdYtd:+M.kacUsd.toFixed(2), localYtd:+M.kacLocal.toFixed(2), ewUsd:+M.kacEw.toFixed(2)}, usdCash:M.usdRate, board, macro:Object.values(M.mac).map(m => ({ctry:m.country, policy:m.pr, cpi:m.cpi, real:+m.real.toFixed(2), gdp26:m.gdp, y10:m.y10, rating:m.rating})), fx:D.macro.fx.map(r => ({ccy:r[0], rate:r[2], ytd:r[3]})), commodities:D.macro.commodities.map(c => ({n:c[0], px:c[1], u:c[2], ytd:c[3]})), stories:M.stories.slice(0, 30).map(s => ({d:s.d, h:s.h, sec:s.sec, sig:s.sig, c:s.c, imp:s.imp})), calendar:M.cal.map(e => ({d:e.d, c:e.c, ev:e.ev, p:e.p, risk:e.risk})), movers:M.movers.filter(m => m.cap == null || m.cap >= .05).map(m => ({ex:m.ex, t:m.t, n:m.name, ytd:m.ytd, usd:m.usd && +m.usd.toFixed(0), cap:m.cap, cat:m.cat})), ideas:IDEAS().map(i => ({t:i.title, type:i.type, mkt:i.mkt})), scenario:S});
}
function renderChat(){
  $('#chat').innerHTML = chat.length ? chat.map(m => `<div class="msg ${m.r === 'user' ? 'u' : 'a'}">${esc(m.t)}</div>`).join('') : '<p class="muted">Ask anything about the markets on this terminal. The analyst sees the board, rates, FX, commodities, newswire and calendar. Daily question limits apply.</p>';
  const c = $('#chat'); c.scrollTop = c.scrollHeight;
}
async function ask(q){
  if (!q || deskBusy) return;
  q = q.slice(0, 1500);
  deskBusy = true; $('#askBtn').disabled = true;
  chat.push({r:'user', t:q}); const a = {r:'assistant', t:'Thinking…'}; chat.push(a); renderChat();
  const turns = chat.slice(0, -1).slice(-7).map(m => ({role:m.r, content:m.t}));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  try {
    const res = await fetch('/api/ask', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({messages:turns, scenario:S})});
    const j = await res.json().catch(() => ({}));
    if (!res.ok) a.t = j.error || ('The analyst is unavailable right now (' + res.status + ').');
    else { a.t = j.text || 'No answer returned.'; if (isN(j.remaining)) $('#deskNote').textContent = j.remaining + ' questions left today from your connection.'; }
  } catch(e){ a.t = 'Could not reach the analyst. Check your connection and try again.'; }
  deskBusy = false; $('#askBtn').disabled = false; renderChat();
}
function renderDesk(){
  const P = ['Where is the best risk-adjusted carry in Africa right now, after FX?', 'Which markets are most exposed if Brent falls 30%? Give a pair trade.', 'Build a 5-market long/short book for a Fed hike plus oil spike, with layering.', 'Where are the underutilised opportunities for a $200m PE fund?', 'What does the Dangote refinery listing do to NGX index weights and liquidity?', 'Summarise this week in African markets for an investment committee.'];
  $('#deskPresets').innerHTML = P.map(p => `<button class="btn">${esc(p)}</button>`).join('');
  $$('#deskPresets button').forEach(b => b.onclick = () => ask(b.textContent));
  renderChat();
}

/* ---------- Method ---------- */
function renderMethod(){
  const srcs = [...new Set([...D.exchanges.map(e => e.src), D.macro.fx_src, D.macro.commodities_src, D.macro.usd_rate_src, ...D.people.rich_src])];
  $('#method').innerHTML = `
  <h3>What Africa Insights is</h3><p>A single view of Africa's listed markets, currencies, rates, commodities, political calendar, newswire and billionaire wealth. On top of that it adds the analytics a desk needs: a pan-African USD index, opportunity and investability scores, a shock-transmission model, scenario and path simulation, and rules-based trade ideas with layering plans.</p>
  <h3>Africa Insights Composite (AIC)</h3><p>Base 1,000 on 31 Dec 2025. Each exchange's flagship index return is converted to USD: (1 + local YTD) × (1 + currency YTD vs USD) − 1. Markets are weighted by USD market cap with a 20% cap per market, and excess weight is redistributed pro rata. An equal-weight version and an uncapped version are shown for comparison. Eligible markets must have a 2026 index return and a market-cap figure. Currently ${M.elig.length} markets qualify and the rest are shown on the board with their data status.</p>
  <h3>Opportunity and investability scores</h3><p>Scores are percentile ranks across eligible markets. <b>Opportunity</b> = 30% GDP growth forecast + 25% real policy rate + 20% value (inverse P/E, with the median used where P/E is missing) + 15% USD momentum + 10% FX stability. <b>Investability</b> = 50% log market cap + 30% sovereign rating + 20% FX regime. Opportunity minus investability is the <i>gap</i>. A large positive gap marks an underutilised market.</p>
  <h3>Scenario model</h3><p>Each market has a coefficient for eight global drivers (oil, gold, copper, soft commodities, the dollar, US 10-year yields, China growth, global equities) plus a political shock: −5pp per severity point on the target market and −1pp on its regional peers. Impacts add linearly. Coefficients are a judgment-calibrated v0 based on export mix, currency regime, external funding needs and foreign ownership. The path simulation is a geometric Brownian motion with the scenario impact as drift and assumed annual volatility (JSE 22%, NGX 30%, EGX 32%, ZSE 60%, and so on). The book risk uses a flat 0.3 cross-market correlation. Replacing these assumptions with regression betas and realised volatility is step one once daily price history is connected.</p>
  <h3>Data and freshness</h3><p>Data as of ${esc(D.meta?.asof || '')}, from exchange sites, african-markets.com, TradingEconomics, central banks, IMF WEO, Forbes and the press outlets linked on each story. An automated pipeline refreshes FX every six hours and index levels, commodities and news twice each weekday, with sanity checks that hold back suspicious values. The terminal checks for new data every 60 seconds and recomputes every number, score, idea and chart when it arrives. The header shows when data last changed. Fields that could not be sourced are left blank rather than estimated. USD caps for Malawi, Zimbabwe and Sudan use official rates that overstate value. JSE, BSE and NSX caps include dual listings.</p>
  <h3>Path to tick-level realtime</h3><ul><li>Exchange data licences: JSE, NGX, EGX and NSE market-data feeds, and BRVM through its data vendor. Most Africa venues sell end-of-day or delayed feeds at modest cost.</li><li>FX: interbank and NDF quotes from a bank partner or an aggregator, plus parallel-market rates for NGN, EGP, ETB and ZWG.</li><li>News: licensed wires plus local-language sources (French, Portuguese, Arabic, Swahili), classified into sector, signal and PESTLE factor.</li><li>History: five or more years of daily closes to replace the v0 coefficients and volatility assumptions with estimated ones.</li></ul>
  <h3>Sources</h3><ul>${srcs.map(s => `<li><a href="${esc(s)}" target="_blank" rel="noopener">${esc(s.replace(/^https?:\/\//, '').slice(0, 90))}</a></li>`).join('')}</ul>
  <p class="note">Research and analytics only. Nothing here is investment advice or an offer to buy or sell any security. Check figures against primary sources before trading.</p>`;
}

/* ---------- Market drawer ---------- */
function openMarket(code){
  const e = M.byCode[code]; if (!e) return;
  const m = e.mac || {}; const b = BETA[code];
  const mv = M.movers.filter(x => x.ex === code);
  const st = M.stories.filter(s => s.c.includes(e.country)).slice(0, 6);
  const cl = M.cal.filter(c => c.c === e.country);
  const rich = M.rich.filter(r => r.venue === code);
  $('#dp').innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:start"><div><div class="eyebrow">${esc(e.country)} · ${esc(e.ccy)}</div><h2>${esc(e.name)}</h2><div class="muted">${esc(e.index || 'No flagship index published')}</div></div><button class="btn" id="dClose" aria-label="Close">Close ✕</button></div>
    <dl class="metrics">
      <div><dt>Level</dt><dd>${f(e.level, 2)}</dd></div><div><dt>YTD local</dt><dd class="${cls(e.ytd)}">${sp(e.ytd)}</dd></div><div><dt>FX YTD</dt><dd class="${cls(e.fx?.ytd)}">${e.ccy === 'USD' ? 'USD' : sp(e.fx?.ytd)}</dd></div>
      <div><dt>YTD USD</dt><dd class="${cls(e.usd)}">${sp(e.usd)}</dd></div><div><dt>1 year local</dt><dd class="${cls(e.y1)}">${sp(e.y1)}</dd></div><div><dt>Cap</dt><dd>$${f(e.mcap, 2)}bn</dd></div>
      <div><dt>Listed</dt><dd>${e.listed ?? '—'}</dd></div><div><dt>P/E</dt><dd>${f(e.pe, 1)}</dd></div><div><dt>Foreign %</dt><dd>${f(e.foreign, 1)}</dd></div>
      <div><dt>Policy rate</dt><dd>${isN(m.pr) ? f(m.pr, 2) + '%' : '—'}</dd></div><div><dt>CPI</dt><dd>${isN(m.cpi) ? f(m.cpi, 1) + '%' : '—'}</dd></div><div><dt>Real rate</dt><dd class="${cls(m.real)}">${isN(m.real) ? pp(m.real) + 'pp' : '—'}</dd></div>
      <div><dt>GDP 2026f</dt><dd>${isN(m.gdp) ? f(m.gdp, 1) + '%' : '—'}</dd></div><div><dt>Rating</dt><dd>${esc(m.rating || '—')}</dd></div><div><dt>Opp / Inv</dt><dd>${e.opp ?? '—'} / ${e.inv ?? '—'}</dd></div>
    </dl>
    <p>${esc(e.note)} <span class="muted">Sectors: ${esc(e.sectors.join(', '))}.</span> <a href="${esc(e.src)}" target="_blank" rel="noopener">Source</a> <span class="faint">· as of ${esc(e.date || 'n/a')}</span></p>
    ${e.parts ? `<div><div class="eyebrow">Opportunity score build (percentile)</div>${divBars(Object.entries(e.parts).map(([k, v]) => ({label:k, v:v * 100, sub:f(v * 100, 0)})), {w:500, padL:100, rowH:20, aria:'Score parts'})}</div>` : ''}
    ${b ? `<div><div class="eyebrow">Shock fingerprint (USD pp per unit shock)</div>${divBars(FACTORS.map(F => ({label:F.name, v:b[F.k] * (F.k === 'glob' ? -10 : 1), sub:pp(b[F.k] * (F.k === 'glob' ? -10 : 1), 1) + ' ' + (F.k === 'glob' ? 'per −10%' : F.desc)})), {w:500, padL:120, rowH:20, aria:'Exposures'})}</div>` : ''}
    ${mv.length ? `<div><div class="eyebrow">Movers</div><div class="tw"><table><tbody>${mv.map(x => `<tr style="cursor:default"><td class="code">${esc(x.t)}</td><td>${esc(x.name)}</td><td class="r num ${cls(x.ytd)}">${sp(x.ytd, 0)}</td><td class="r num ${cls(x.usd)}">${sp(x.usd, 0)} USD</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    ${rich.length ? `<div><div class="eyebrow">Billionaire exposure</div>${rich.map(r => `<div>${esc(r.name)} · $${f(r.nw, 1)}bn · <span class="muted">${esc(r.hold.join(', '))}</span></div>`).join('')}</div>` : ''}
    ${cl.length ? `<div><div class="eyebrow">Calendar</div>${cl.map(c => `<div class="stripe ${c.risk >= 4 ? 'bear' : 'neu'}" style="margin-bottom:6px"><span class="code">${esc(c.d)}</span> ${esc(c.ev)} <span class="chip">${c.p}</span></div>`).join('')}</div>` : ''}
    ${st.length ? `<div><div class="eyebrow">Latest stories</div>${st.map(s => `<div class="stripe ${s.sig === 'bullish' ? 'bull' : s.sig === 'bearish' ? 'bear' : 'neu'}" style="margin-bottom:8px"><span class="code">${s.d}</span> <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.h)}</a></div>`).join('')}</div>` : ''}
    <div class="meta"><button class="btn pri" id="dAsk">Ask the desk about ${esc(code)}</button></div>`;
  const dr = $('#drawer'); dr.hidden = false; $('#dClose').focus();
  $('#dClose').onclick = closeDrawer;
  $('#dAsk').onclick = () => {closeDrawer(); go('dsk'); ask(`Give me the full investment case for ${e.name} (${e.country}) right now: USD-adjusted performance, valuation, rates and FX, catalysts on the calendar, the best long and short expressions, hedges, and how I'd layer in.`);};
}
function closeDrawer(){ $('#drawer').hidden = true; }
$('#drawer').addEventListener('click', ev => { if (ev.target.id === 'drawer') closeDrawer(); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') closeDrawer(); });

/* ---------- Shell: nav, tape, clock, command ---------- */
let cur = 'mkt';
function go(t){
  cur = t; store.set('tab', t); if (history.replaceState) history.replaceState(null, '', '#' + (TABS.find(x => x[0] === t) || [, t])[1].toLowerCase());
  TABS.forEach(([k]) => { $('#t-' + k).hidden = k !== t; });
  $$('#fn button').forEach(b => b.setAttribute('aria-selected', b.dataset.t === t));
  if (t === 'mkt') renderMkt();
  if (t === 'scn') renderScn(true);
}
function buildNav(){
  $('#fn').innerHTML = TABS.map(([k, c, n], i) => `<button role="tab" data-t="${k}" aria-selected="false" aria-controls="t-${k}"><kbd>${c}</kbd>${n}</button>`).join('');
  $$('#fn button').forEach(b => b.onclick = () => go(b.dataset.t));
  $$('#boardFilter button').forEach(b => b.onclick = () => {boardF = b.dataset.v; $$('#boardFilter button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderBoard();});
  $$('#movCat button').forEach(b => b.onclick = () => {movCat = b.dataset.v; $$('#movCat button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderMov();});
  $('#ideaAud').onchange = ev => {ideaAud = ev.target.value; renderIdeas();};
  $('#askForm').onsubmit = ev => {ev.preventDefault(); const q = $('#askQ').value.trim(); $('#askQ').value = ''; ask(q);};
  $('#askQ').addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) $('#askForm').requestSubmit(); });
  $('#cmdForm').onsubmit = ev => {
    ev.preventDefault(); const v = $('#cmd').value.trim(); if (!v) return; const u = v.toUpperCase();
    const tab = TABS.find(([k, c, n]) => c === u || n.toUpperCase() === u || k.toUpperCase() === u);
    if (tab){ go(tab[0]); }
    else if (M.byCode[u] || M.ex.find(e => e.code.toUpperCase() === u)){ openMarket((M.ex.find(e => e.code.toUpperCase() === u) || {}).code); }
    else if (M.fx[u]){ go('fx'); }
    else { const e = M.ex.find(e => e.country.toUpperCase() === u); if (e) openMarket(e.code); else { go('dsk'); ask(v); } }
    $('#cmd').value = '';
  };
}
function renderTape(){
  const items = [`<span><b>AIC</b><span class="${cls(M.kacUsd)}">${f(1000 * (1 + M.kacUsd / 100), 2)} ${sp(M.kacUsd, 2)}</span></span>`]
    .concat(M.ex.filter(e => isN(e.level) && isN(e.ytd)).map(e => `<span><b>${e.code}</b>${f(e.level, e.level > 1000 ? 0 : 2)} <span class="${cls(e.usd)}">${sp(e.usd)} $</span></span>`))
    .concat(D.macro.fx.slice(0, 16).map(r => `<span><b>USD/${r[0]}</b>${f(r[2], r[2] < 100 ? 4 : 2)} <span class="${cls(r[3])}">${sp(r[3])}</span></span>`))
    .concat(D.macro.commodities.map(c => `<span><b>${esc(c[0].toUpperCase())}</b>${f(c[1], c[1] > 1000 ? 0 : 2)} <span class="${cls(c[3])}">${sp(c[3])}</span></span>`));
  $('#tape').innerHTML = items.join('') + items.join('');
  $('#cmdList').innerHTML = TABS.map(t => `<option value="${t[1]}">${t[2]}</option>`).join('') + M.ex.map(e => `<option value="${e.code}">${esc(e.country)} · ${esc(e.name)}</option>`).join('') + D.macro.fx.map(r => `<option value="${r[0]}">${esc(r[1])} currency</option>`).join('');
}
function tick(){
  const now = new Date();
  const t = now.toLocaleString('en-GB', {timeZone:'Africa/Nairobi', weekday:'short', day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', second:'2-digit'});
  const j = now.toLocaleTimeString('en-GB', {timeZone:'Africa/Johannesburg', hour:'2-digit', minute:'2-digit'});
  const l = now.toLocaleTimeString('en-GB', {timeZone:'Africa/Lagos', hour:'2-digit', minute:'2-digit'});
  const c = now.toLocaleTimeString('en-GB', {timeZone:'Africa/Cairo', hour:'2-digit', minute:'2-digit'});
  $('#clock').textContent = `NBO ${t} · JNB ${j} · LOS ${l} · CAI ${c}`;
}
function renderPill(){
  const dot = $('#feedPill .dot');
  const up = LIVE.updated || (D.meta && D.meta.updated);
  if (LIVE.on){ dot.className = 'dot live'; $('#feedTxt').textContent = 'Live · updated ' + ago(up); }
  else { dot.className = 'dot snap'; $('#feedTxt').textContent = 'Snapshot · ' + (D.meta?.asof || ''); }
  $('#foot').innerHTML = `Africa Insights · data last updated ${esc(up ? new Date(up).toUTCString() : D.meta?.asof || '')}. Prices can be delayed; sources are listed under Method. Research and education only, not investment advice. · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a> · <a href="/markets/">All markets</a> · <a href="/feed.xml">RSS</a> · <a href="#" id="fbFoot">Report a data error</a>`;
  const ff = $('#fbFoot'); if (ff) ff.onclick = ev => { ev.preventDefault(); openFeedback('Data error'); };
}
function renderAll(){
  compute();
  renderTape(); renderPill();
  renderMkt(); renderFx(); renderMov(); renderIdeas(); renderScn(true); renderRisk(); renderNews(); renderRich(); renderDesk(); renderMethod();
}
let rT = null; const scheduleRender = () => { clearTimeout(rT); rT = setTimeout(renderAll, 150); };

/* ---------- Live data polling ---------- */
const FEEDS = ['exchanges', 'macro', 'stories', 'people'];
async function getJSON(p){ const r = await fetch(p + '?t=' + Date.now(), {cache:'no-store'}); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }
async function poll(){
  try {
    const meta = await getJSON('/data/meta.json');
    LIVE.on = true;
    if (meta.updated !== (D.meta && D.meta.updated)){
      const parts = await Promise.all(FEEDS.map(k => getJSON('/data/' + k + '.json')));
      FEEDS.forEach((k, i) => D[k] = parts[i]);
      D.meta = meta; LIVE.updated = meta.updated; renderAll();
    } else { LIVE.updated = meta.updated; renderPill(); }
  } catch(e){ LIVE.on = false; renderPill(); }
}
function ago(iso){ if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; }

/* ---------- Feedback ---------- */
let fbRating = 0;
function openFeedback(kind){
  const m = $('#fbModal'); m.hidden = false; if (kind) $('#fbType').value = kind; $('#fbMsg').focus();
}
function initFeedback(){
  $('#fbBtn').onclick = () => openFeedback();
  $('#fbCancel').onclick = () => $('#fbModal').hidden = true;
  $('#fbModal').addEventListener('click', ev => { if (ev.target.id === 'fbModal') $('#fbModal').hidden = true; });
  $('#fbStars').innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" aria-pressed="false" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('');
  $$('#fbStars button').forEach(b => b.onclick = () => { fbRating = +b.dataset.n; $$('#fbStars button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.n <= fbRating)); });
  $('#fbForm').onsubmit = async ev => {
    ev.preventDefault();
    const body = {type:$('#fbType').value, rating:fbRating || null, message:$('#fbMsg').value.trim(), email:$('#fbEmail').value.trim(), tab:cur, hp:$('#fbHp').value};
    if (!body.message && !body.rating){ $('#fbStatus').textContent = 'Add a rating or a message before sending.'; return; }
    $('#fbSend').disabled = true; $('#fbStatus').textContent = 'Sending…';
    try {
      const r = await fetch('/api/feedback', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});
      const j = await r.json().catch(() => ({}));
      if (r.ok){ $('#fbStatus').textContent = 'Thanks. Your feedback was received.'; $('#fbMsg').value = ''; setTimeout(() => $('#fbModal').hidden = true, 1400); }
      else $('#fbStatus').textContent = j.error || 'Could not send. Try again in a minute.';
    } catch(e){ $('#fbStatus').textContent = 'Could not send. Check your connection.'; }
    $('#fbSend').disabled = false;
  };
}
function fromHash(){
  const h = decodeURIComponent(location.hash.slice(1)).toUpperCase(); if (!h) return;
  const tab = TABS.find(t => t[1] === h || t[0].toUpperCase() === h); if (tab) return go(tab[0]);
  const e = M.ex.find(e => e.code.toUpperCase() === h); if (e){ go('mkt'); openMarket(e.code); }
}

buildNav();
renderAll();
const _h0 = location.hash; go(store.get('tab', 'mkt')); if (_h0 && history.replaceState) history.replaceState(null, '', _h0);
tick(); setInterval(tick, 1000);
initFeedback(); fromHash(); window.addEventListener('hashchange', fromHash);
poll(); setInterval(poll, 60000);
setInterval(renderPill, 30000);
window.addEventListener('resize', (() => {let t; return () => {clearTimeout(t); t = setTimeout(() => cur === 'mkt' && renderMkt(), 200);};})());
