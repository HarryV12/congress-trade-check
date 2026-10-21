/* Congress Trade Check, website design (v2).
   Pages with their own links (#/member/<id>, #/stock/<ticker>, ...), global search, sortable tables and
   interactive charts, built from the same data files as the classic site (../data.js, ../prices.js). */
(() => {
  "use strict";
  const D = window.CTC_DATA;
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DAY = 86400000, today = Date.parse(D.prices_through + "T00:00:00Z"), YEAR = new Date(today).getUTCFullYear();
  const F = Object.fromEntries(D.fields.map((f, i) => [f, i]));
  const members = D.members.map((m, i) => ({ ...m, i }));
  const stocks = D.stocks;

  // ---------- amounts: the same best estimates as the classic site ----------
  // Where trades with a known exact amount sit inside their reported range (log scale): each range's estimate
  // is the average of those positions, its spread gives a total's likely range.
  const POS = [];
  for (const row of D.trades) {
    const ex = row[F.ex], lo = row[F.lo], hi = row[F.hi];
    if (ex && lo && hi > lo && row[F.src] !== "i") { const x = Math.min(Math.max(ex[0], lo), hi); POS.push((Math.log(x) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))); }
  }
  const bandCache = new Map();
  function band(lo, hi) {
    if (!lo) return { mean: 0, sd: 0 };
    if (!(hi > lo) || !POS.length) return { mean: lo, sd: 0 };
    const k = lo + "-" + hi;
    if (!bandCache.has(k)) {
      const v = POS.map((p) => Math.exp(Math.log(lo) + p * (Math.log(hi) - Math.log(lo)))), mean = v.reduce((a, x) => a + x, 0) / v.length;
      bandCache.set(k, { mean, sd: Math.sqrt(v.reduce((a, x) => a + (x - mean) ** 2, 0) / v.length) });
    }
    return bandCache.get(k);
  }
  const LOWS = [1001, 15001, 50001, 100001, 250001, 500001, 1000001, 5000001, 25000001];
  const trades = D.trades.map((r) => {
    let lo = r[F.lo] || 0; const hi = r[F.hi] || lo;
    if (hi && lo > hi) lo = LOWS.filter((x) => x < hi).pop() || lo;  // a misread range (top below bottom)
    const ex = r[F.ex] ? r[F.ex][0] : null, b = ex ? { mean: ex, sd: 0 } : band(lo, hi);
    const k = r[F.k];
    return { m: r[F.m], t: r[F.t] || "", a: r[F.a] || "", k, side: k === "B" ? "B" : (k === "S" || k === "SP") ? "S" : "O", d: r[F.d], fd: r[F.fd],
      time: Date.parse(r[F.d] + "T00:00:00Z"), ftime: r[F.fd] ? Date.parse(r[F.fd] + "T00:00:00Z") : 0, lo, hi, ex, amt: b.mean, sd: b.sd,
      cls: r[F.cls], opt: r[F.opt], own: r[F.own] || "", r: r[F.r], sr: r[F.sr], ep: r[F.ep] };
  });
  const est = (list) => {  // best estimate, its likely range (7 times in 10) and the filings' own bounds
    let best = 0, v = 0, min = 0, max = 0;
    for (const t of list) { best += t.amt; v += t.sd ** 2; min += t.ex || t.lo; max += t.ex || t.hi || t.lo; }
    const sd = Math.sqrt(v);
    return { best, lo: Math.max(min, best - 1.0364 * sd), hi: Math.min(max, best + 1.0364 * sd), min, max, exact: !v };
  };

  // ---------- formatting ----------
  const usd = (x) => { const a = Math.abs(x), s = x < 0 ? "−" : ""; return a >= 1e12 ? `${s}$${(a / 1e12).toFixed(1)}T` : a >= 1e9 ? `${s}$${(a / 1e9).toFixed(2)}B` : a >= 1e7 ? `${s}$${Math.round(a / 1e6)}M` : a >= 1e6 ? `${s}$${(a / 1e6).toFixed(1)}M` : a >= 1e4 ? `${s}$${Math.round(a / 1e3)}K` : a >= 1e3 ? `${s}$${(a / 1e3).toFixed(1)}K` : `${s}$${Math.round(a)}`; };
  const span = (e) => e.exact ? usd(e.best) : (usd(e.lo) === usd(e.hi) ? usd(e.best) : `${usd(e.lo)}–${usd(e.hi)}`);
  const rangeText = (t) => t.ex ? `${usd(t.ex)} exact` : !t.lo ? "amount unclear" : t.lo === t.hi ? `over ${usd(t.lo - 1)}` : `${usd(t.lo)}–${usd(t.hi)}`;
  const pct = (x, d = 1) => x == null || !isFinite(x) ? "–" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(d)}%`;
  const fmtDate = (iso, o = { day: "numeric", month: "short", year: "numeric" }) => iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { ...o, timeZone: "UTC" }) : "";
  const cleanName = (s) => {
    let out = String(s || ""), prev;
    do {
      prev = out;
      out = out.replace(/\s*\([^)]*\)\s*$/, "")
        .replace(/[\s,-]+(Common Stock|Common Shares|Ordinary Shares|Class [A-C](\s+(Common Stock|Common Shares|Ordinary Shares|Shares))?|American Depositary Shares?|Depositary Shares?|Sponsored ADR|Units?|Warrants?|ADS|ADR)$/i, "")
        .replace(/[\s,-]+(Inc\.?|Incorporated|Corporation|Corp\.?|Company|Co\.?|Ltd\.?|Limited|plc|N\.V\.|S\.A\.)$/i, "").trim();
    } while (out !== prev);
    return out || String(s || "");
  };
  const isExec = (m) => m.chamber === "E", isBiz = (m) => m.chamber === "C";
  const seat = (m) => isBiz(m) ? m.role || "Business leader" : isExec(m) ? [m.role, (m.agency || "").replace(/\/Office of The Secretary$/, "")].filter(Boolean).join(" · ")
    : `${m.chamber === "S" ? "Senator" : "Representative"} · ${m.state}${m.chamber === "H" && m.district ? "-" + String(m.district).padStart(2, "0") : ""}`;
  const partyTag = (m) => m.party ? `<span class="party ${esc(m.party)}">${esc(m.party)}</span>` : "";
  // faces: the large portrait file where there is one, otherwise the small photo from ../photos.js (loaded in the background)
  const photoSrc = (m) => m.hd ? `../portraits/${encodeURIComponent(m.id)}.jpg` : (window.CTC_PHOTOS && window.CTC_PHOTOS[m.id]) || "";
  const photo = (m) => { const src = photoSrc(m); return `<img ${src ? `src="${src}"` : ""} data-pid="${esc(m.id)}" alt="" loading="lazy" onerror="window.__ctcPhotoFail&&window.__ctcPhotoFail(this)">`; };
  window.__ctcPhotoFail = (img) => { const u = window.CTC_PHOTOS && window.CTC_PHOTOS[img.dataset.pid]; if (u && img.src !== u) img.src = u; else img.removeAttribute("src"); };
  const s0photos = document.createElement("script"); s0photos.src = "../photos.js"; s0photos.async = true;
  s0photos.onload = () => $$("img[data-pid]").forEach((img) => { if (!img.getAttribute("src") || img.naturalWidth === 0) { const u = window.CTC_PHOTOS[img.dataset.pid]; if (u) img.src = u; } });
  document.head.appendChild(s0photos);
  const who = (m, sub = true) => `<a class="who ${esc(m.party || "I")}" href="#/member/${encodeURIComponent(m.id)}">${photo(m)}<span style="min-width:0"><span class="nm">${esc(m.name)}</span>${sub ? `<br><span class="meta">${partyTag(m)} ${esc(seat(m))}</span>` : ""}</span></a>`;
  const tkLink = (tk) => tk && stocks[tk] ? `<a class="tk" href="#/stock/${encodeURIComponent(tk)}">${esc(tk)}</a>` : `<span class="tk">${esc(tk || "–")}</span>`;
  const stockName = (t) => t.t && stocks[t.t] ? cleanName(stocks[t.t][0]) : t.a;

  // ---------- period (shared by every page, remembered in this browser) ----------
  const PERIODS = [["90", "3 months"], ["182", "6 months"], ["ytd", "This year"], ["365", "1 year"], ["all", `Since ${fmtDate(D.start, { month: "short", year: "numeric" })}`]];
  let period = "365";
  try { period = localStorage.getItem("ctc-v2-period") || "365"; } catch (e) { /* storage blocked */ }
  if (!PERIODS.some(([v]) => v === period)) period = "365";
  const since = () => period === "all" ? -Infinity : period === "ytd" ? Date.UTC(YEAR, 0, 1) : today - +period * DAY;
  const periodWords = () => ({ 90: "in the last 3 months", 182: "in the last 6 months", 365: "in the last 12 months", ytd: `in ${YEAR} so far` }[period] || `since ${fmtDate(D.start, { month: "short", year: "numeric" })}`);
  const periodSeg = () => `<div class="seg" role="group" aria-label="Period">${PERIODS.map(([v, l]) => `<button type="button" data-period="${v}" aria-pressed="${v === period}">${l}</button>`).join("")}</div>`;
  function bindPeriod(el) {
    $$("[data-period]", el).forEach((b) => b.addEventListener("click", () => {
      period = b.dataset.period; try { localStorage.setItem("ctc-v2-period", period); } catch (e) { /* storage blocked */ }
      route();
    }));
  }
  const securities = (t) => t.cls === "stock" || t.cls === "fund";  // options and other assets are left out of most pages

  // ---------- a sortable table with "show more" ----------
  // cols: [{ key, label, html(row), sort(row) -> number|string, cls, hideSm }]
  function table(el, cols, rows, opts = {}) {
    let sortKey = opts.sort || null, dir = opts.dir || -1, shown = opts.page || 50;
    const draw = () => {
      const col = cols.find((c) => c.key === sortKey);
      const list = col && col.sort ? [...rows].sort((a, b) => { const x = col.sort(a), y = col.sort(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; }) : rows;
      el.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th class="${c.sort ? "sort " : ""}${c.cls || ""} ${c.hideSm ? "hide-sm" : ""}" data-k="${c.key}"${c.key === sortKey ? ` aria-sort="${dir > 0 ? "ascending" : "descending"}"` : ""}>${c.label}</th>`).join("")}</tr></thead>
        <tbody>${list.slice(0, shown).map((r) => `<tr${opts.href ? ` class="click" data-href="${esc(opts.href(r))}"` : ""}>${cols.map((c) => `<td class="${c.cls || ""} ${c.hideSm ? "hide-sm" : ""}">${c.html(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        ${list.length > shown ? `<div class="more"><button class="btn" type="button">Show more (${(list.length - shown).toLocaleString()} left)</button></div>` : ""}
        ${!list.length ? `<p class="muted">${opts.empty || "Nothing in this period."}</p>` : ""}`;
      $$("th.sort", el).forEach((th) => th.addEventListener("click", () => { if (sortKey === th.dataset.k) dir = -dir; else { sortKey = th.dataset.k; dir = -1; } draw(); }));
      const more = $(".more button", el); if (more) more.addEventListener("click", () => { shown += 100; draw(); });
      if (opts.href) $$("tr.click", el).forEach((tr) => tr.addEventListener("click", (e) => { if (!e.target.closest("a")) location.hash = tr.dataset.href; }));
    };
    draw();
  }

  // ---------- search ----------
  const traded = new Map();  // ticker -> number of trades
  for (const t of trades) if (t.t && stocks[t.t]) traded.set(t.t, (traded.get(t.t) || 0) + 1);
  const tradeCount = new Map(); for (const t of trades) tradeCount.set(t.m, (tradeCount.get(t.m) || 0) + 1);
  const INDEX = [
    ...members.filter((m) => tradeCount.get(m.i)).map((m) => ({ kind: "Politician", label: m.name, sub: seat(m), key: m.name.toLowerCase(), href: `#/member/${encodeURIComponent(m.id)}`, m, w: tradeCount.get(m.i) })),
    ...[...traded.keys()].map((tk) => ({ kind: "Stock", label: `${tk} · ${cleanName(stocks[tk][0])}`, key: (tk + " " + stocks[tk][0]).toLowerCase(), tk, href: `#/stock/${encodeURIComponent(tk)}`, w: traded.get(tk) })),
  ];
  function bindSearch() {
    const box = $("#q"), ul = $("#qList");
    let items = [], at = -1;
    const close = () => { ul.hidden = true; box.setAttribute("aria-expanded", "false"); at = -1; };
    const show = () => {
      const q = box.value.trim().toLowerCase();
      if (!q) { close(); return; }
      const score = (it) => it.tk && it.tk.toLowerCase() === q ? 5 : it.key.startsWith(q) ? 4 : it.key.split(/\s+/).some((w) => w.startsWith(q)) ? 3 : it.key.includes(q) ? 1 : 0;
      items = INDEX.map((it) => ({ it, s: score(it) })).filter((x) => x.s).sort((a, b) => b.s - a.s || b.it.w - a.it.w).slice(0, 12).map((x) => x.it);
      ul.innerHTML = items.length ? items.map((it, k) => `<li role="option" data-k="${k}" aria-selected="${k === at}">${it.m ? `<span class="who ${esc(it.m.party || "I")}">${photo(it.m)}</span>` : `<span class="tk">${esc(it.tk)}</span>`}<span>${esc(it.m ? it.label : cleanName(stocks[it.tk][0]))}<br><span class="muted" style="font-size:12px">${esc(it.m ? it.sub : (stocks[it.tk][3] || stocks[it.tk][1] || ""))}</span></span><span class="kind">${it.kind}</span></li>`).join("")
        : `<li class="muted">No politician or stock matches.</li>`;
      ul.hidden = false; box.setAttribute("aria-expanded", "true");
    };
    const go = (it) => { if (!it) return; close(); box.value = ""; box.blur(); location.hash = it.href; };
    box.addEventListener("input", () => { at = -1; show(); });
    box.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); at = Math.max(0, Math.min(items.length - 1, at + (e.key === "ArrowDown" ? 1 : -1))); $$("li", ul).forEach((li, k) => li.setAttribute("aria-selected", String(k === at))); }
      else if (e.key === "Enter") { e.preventDefault(); go(items[at >= 0 ? at : 0]); }
      else if (e.key === "Escape") { close(); box.blur(); }
    });
    ul.addEventListener("mousedown", (e) => { const li = e.target.closest("li[data-k]"); if (li) { e.preventDefault(); go(items[+li.dataset.k]); } });
    box.addEventListener("blur", () => setTimeout(close, 150));
    document.addEventListener("keydown", (e) => { if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); box.focus(); } });
  }

  // ---------- pages ----------
  const app = $("#app");
  function setNav(k) { $$(".nav a[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === k)); }

  function pageHome() {
    setNav("home");
    const s0 = since(), win = trades.filter((t) => t.time >= s0 && t.side !== "O" && !isBiz(members[t.m]));
    const buys = win.filter((t) => t.side === "B" && securities(t)), sells = win.filter((t) => t.side === "S" && securities(t));
    const people = new Set(win.map((t) => t.m));
    const lastFiled = trades.reduce((mx, t) => t.fd && t.fd > mx ? t.fd : mx, "");
    app.innerHTML = `
      <h1>What Congress is trading</h1>
      <p class="lede">Stock and bond trades by members of Congress and senior officials, from their public disclosure reports. Filings up to <b>${fmtDate(lastFiled)}</b>; prices to ${fmtDate(D.prices_through)}.</p>
      <div class="toolbar">${periodSeg()}</div>
      <div class="grid cols-4">
        <div class="card stat"><div class="lbl">Trades</div><div class="big">${win.length.toLocaleString()}</div><div class="sub">${periodWords()}</div></div>
        <div class="card stat"><div class="lbl">People trading</div><div class="big">${people.size}</div><div class="sub">members and officials</div></div>
        <div class="card stat"><div class="lbl">Stocks bought</div><div class="big up">${usd(est(buys).best)}</div><div class="sub">likely ${span(est(buys))}</div></div>
        <div class="card stat"><div class="lbl">Stocks sold</div><div class="big down">${usd(est(sells).best)}</div><div class="sub">likely ${span(est(sells))}</div></div>
      </div>
      <div class="grid cols-2 section">
        <div class="card"><h2>Most bought stocks <span class="muted">by number of buyers</span></h2><div id="topStocks" class="bars"></div></div>
        <div class="card"><h2>Most active <span class="muted">by dollars traded</span></h2><div id="topPeople"></div></div>
      </div>
      <div class="card section"><h2>Latest disclosures <span class="muted">newest filings first</span></h2><div id="latest"></div></div>`;
    bindPeriod(app);
    // most bought stocks
    const byT = new Map();
    for (const t of buys) { if (!t.t || !stocks[t.t]) continue; const g = byT.get(t.t) || { tk: t.t, ms: new Set(), list: [] }; g.ms.add(t.m); g.list.push(t); byT.set(t.t, g); }
    const topS = [...byT.values()].sort((a, b) => b.ms.size - a.ms.size || est(b.list).best - est(a.list).best).slice(0, 10), maxS = topS[0] ? topS[0].ms.size : 1;
    $("#topStocks").innerHTML = topS.map((g) => `<div class="bar-row"><span>${tkLink(g.tk)} ${esc(cleanName(stocks[g.tk][0]))}</span><span class="muted mono">${g.ms.size} buyers · ${usd(est(g.list).best)}</span><div class="track"><div class="fill" style="width:${(g.ms.size / maxS * 100).toFixed(1)}%"></div></div></div>`).join("") || `<p class="muted">No buys in this period.</p>`;
    // most active people
    const byM = new Map();
    for (const t of win) { const g = byM.get(t.m) || { m: members[t.m], b: [], s: [] }; (t.side === "B" ? g.b : g.s).push(t); byM.set(t.m, g); }
    const topP = [...byM.values()].map((g) => ({ ...g, vol: est(g.b).best + est(g.s).best })).sort((a, b) => b.vol - a.vol).slice(0, 8);
    table($("#topPeople"), [
      { key: "who", label: "Person", html: (g) => who(g.m) },
      { key: "b", label: "Bought", cls: "r", html: (g) => `<span class="up">${g.b.length ? usd(est(g.b).best) : "–"}</span>`, sort: (g) => est(g.b).best },
      { key: "s", label: "Sold", cls: "r", html: (g) => `<span class="down">${g.s.length ? usd(est(g.s).best) : "–"}</span>`, sort: (g) => est(g.s).best },
    ], topP, { page: 8 });
    // latest filings
    const latest = trades.filter((t) => t.fd && t.side !== "O" && !isBiz(members[t.m])).sort((a, b) => b.ftime - a.ftime || b.amt - a.amt).slice(0, 400);
    table($("#latest"), [
      { key: "fd", label: "Filed", cls: "num", html: (t) => fmtDate(t.fd, { day: "numeric", month: "short" }), sort: (t) => t.ftime },
      { key: "who", label: "Person", html: (t) => who(members[t.m]) },
      { key: "side", label: "", html: (t) => `<span class="pill ${t.side}">${t.side === "B" ? "Buy" : "Sell"}</span>` },
      { key: "t", label: "Stock", html: (t) => `${tkLink(t.t)} <span class="hide-sm">${esc(stockName(t))}</span>` },
      { key: "d", label: "Traded", cls: "num hide-sm", hideSm: true, html: (t) => fmtDate(t.d, { day: "numeric", month: "short" }), sort: (t) => t.time },
      { key: "amt", label: "Amount", cls: "r", html: (t) => rangeText(t), sort: (t) => t.amt },
    ], latest, { page: 25 });
  }

  function pagePoliticians() {
    setNav("politicians");
    const s0 = since(), g = new Map();
    for (const t of trades) {
      if (t.time < s0 || t.side === "O") continue;
      const e = g.get(t.m) || { m: members[t.m], b: [], s: [], last: 0 }; (t.side === "B" ? e.b : e.s).push(t); e.last = Math.max(e.last, t.time); g.set(t.m, e);
    }
    let rows = [...g.values()].map((e) => ({ ...e, eb: est(e.b).best, es: est(e.s).best, n: e.b.length + e.s.length }));
    app.innerHTML = `<h1>Politicians</h1><p class="lede">Everyone with disclosed trades ${periodWords()}. Click a column to sort, a row to open their page.</p>
      <div class="toolbar">${periodSeg()}<div class="seg" role="group" aria-label="Who"><button type="button" data-ch="all" aria-pressed="true">All</button><button type="button" data-ch="H">House</button><button type="button" data-ch="S">Senate</button><button type="button" data-ch="E">Officials</button><button type="button" data-ch="C">Business</button></div>
      <input type="search" id="filt" placeholder="Filter by name or state"><span class="count" id="cnt"></span></div><div class="card" id="tbl"></div>`;
    bindPeriod(app);
    let ch = "all", q = "";
    const draw = () => {
      const list = rows.filter((e) => (ch === "all" || e.m.chamber === ch) && (!q || (e.m.name + " " + (e.m.state || "") + " " + (e.m.role || "")).toLowerCase().includes(q)));
      $("#cnt").textContent = `${list.length} people`;
      table($("#tbl"), [
        { key: "who", label: "Person", html: (e) => who(e.m), sort: (e) => e.m.last || e.m.name },
        { key: "n", label: "Trades", cls: "r", html: (e) => e.n.toLocaleString(), sort: (e) => e.n },
        { key: "eb", label: "Bought", cls: "r", html: (e) => `<span class="up">${e.b.length ? usd(e.eb) : "–"}</span>`, sort: (e) => e.eb },
        { key: "es", label: "Sold", cls: "r", html: (e) => `<span class="down">${e.s.length ? usd(e.es) : "–"}</span>`, sort: (e) => e.es },
        { key: "last", label: "Last trade", cls: "num hide-sm", hideSm: true, html: (e) => fmtDate(new Date(e.last).toISOString().slice(0, 10)), sort: (e) => e.last },
      ], list, { sort: "eb", href: (e) => `#/member/${encodeURIComponent(e.m.id)}` });
    };
    $$("[data-ch]").forEach((b) => b.addEventListener("click", () => { ch = b.dataset.ch; $$("[data-ch]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw(); }));
    $("#filt").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
  }

  function pageStocks() {
    setNav("stocks");
    const s0 = since(), g = new Map();
    for (const t of trades) {
      if (t.time < s0 || t.side === "O" || !t.t || !stocks[t.t] || isBiz(members[t.m])) continue;
      const e = g.get(t.t) || { tk: t.t, b: [], s: [], buyers: new Set(), sellers: new Set(), last: 0 };
      if (t.side === "B") { e.b.push(t); e.buyers.add(t.m); } else { e.s.push(t); e.sellers.add(t.m); }
      e.last = Math.max(e.last, t.time); g.set(t.t, e);
    }
    const rows = [...g.values()].map((e) => ({ ...e, eb: est(e.b).best, es: est(e.s).best }));
    app.innerHTML = `<h1>Stocks</h1><p class="lede">Every stock members and officials traded ${periodWords()}. Business leaders are left out.</p>
      <div class="toolbar">${periodSeg()}<input type="search" id="filt" placeholder="Filter by ticker, company or sector"><span class="count" id="cnt"></span></div><div class="card" id="tbl"></div>`;
    bindPeriod(app);
    let q = "";
    const draw = () => {
      const list = rows.filter((e) => !q || (e.tk + " " + stocks[e.tk][0] + " " + stocks[e.tk][1] + " " + (stocks[e.tk][3] || "")).toLowerCase().includes(q));
      $("#cnt").textContent = `${list.length.toLocaleString()} stocks`;
      table($("#tbl"), [
        { key: "tk", label: "Stock", html: (e) => `${tkLink(e.tk)} ${esc(cleanName(stocks[e.tk][0]))}`, sort: (e) => e.tk },
        { key: "sec", label: "Sector", cls: "hide-sm", hideSm: true, html: (e) => `<span class="muted">${esc(stocks[e.tk][1] || "")}</span>`, sort: (e) => stocks[e.tk][1] || "" },
        { key: "buyers", label: "Buyers", cls: "r", html: (e) => e.buyers.size, sort: (e) => e.buyers.size },
        { key: "eb", label: "Bought", cls: "r", html: (e) => `<span class="up">${e.b.length ? usd(e.eb) : "–"}</span>`, sort: (e) => e.eb },
        { key: "es", label: "Sold", cls: "r", html: (e) => `<span class="down">${e.s.length ? usd(e.es) : "–"}</span>`, sort: (e) => e.es },
        { key: "last", label: "Last trade", cls: "num hide-sm", hideSm: true, html: (e) => fmtDate(new Date(e.last).toISOString().slice(0, 10)), sort: (e) => e.last },
      ], list, { sort: "buyers", href: (e) => `#/stock/${encodeURIComponent(e.tk)}` });
    };
    $("#filt").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
  }

  function pageMember(id) {
    setNav("politicians");
    const m = members.find((x) => x.id === id);
    if (!m) { app.innerHTML = `<h1>Not found</h1><p>No politician with that link. <a href="#/politicians">See everyone</a>.</p>`; return; }
    const s0 = since(), mine = trades.filter((t) => t.m === m.i && t.time >= s0 && t.side !== "O");
    const buys = mine.filter((t) => t.side === "B"), sells = mine.filter((t) => t.side === "S");
    const priced = buys.filter((t) => securities(t) && t.r != null && t.sr != null);
    const inv = priced.reduce((a, t) => a + t.amt, 0), ret = inv ? priced.reduce((a, t) => a + t.amt * t.r, 0) / inv : null, spy = inv ? priced.reduce((a, t) => a + t.amt * t.sr, 0) / inv : null;
    const wins = priced.filter((t) => t.r > t.sr).length;
    const comm = (m.committees || []).map((c) => D.committees[c] && D.committees[c].name).filter(Boolean);
    app.innerHTML = `<div class="crumbs"><a href="#/politicians">Politicians</a></div>
      <div class="profile ${esc(m.party || "I")}">${photo(m)}
        <div><h1>${esc(m.name)}</h1><div class="muted">${partyTag(m)} ${esc(seat(m))}${m.former ? " · former" : ""}</div>
        <div class="tags">${comm.slice(0, 6).map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div></div></div>
      <div class="toolbar">${periodSeg()}</div>
      <div class="grid cols-4">
        <div class="card stat"><div class="lbl">Trades</div><div class="big">${mine.length.toLocaleString()}</div><div class="sub">${buys.length.toLocaleString()} buys · ${sells.length.toLocaleString()} sales</div></div>
        <div class="card stat"><div class="lbl">Bought</div><div class="big up">${buys.length ? usd(est(buys).best) : "–"}</div><div class="sub">${buys.length ? `likely ${span(est(buys))}` : periodWords()}</div></div>
        <div class="card stat"><div class="lbl">Sold</div><div class="big down">${sells.length ? usd(est(sells).best) : "–"}</div><div class="sub">${sells.length ? `likely ${span(est(sells))}` : periodWords()}</div></div>
        <div class="card stat"><div class="lbl">Their buys vs S&amp;P 500</div><div class="big ${ret != null && ret - spy >= 0 ? "up" : "down"}">${ret == null ? "–" : pct(ret - spy).replace("%", " pts")}</div><div class="sub">${ret == null ? "no priced buys" : `${pct(ret)} vs ${pct(spy)} · beat it ${Math.round(wins / priced.length * 100)}% of the time`}</div></div>
      </div>
      <div class="grid cols-2 section">
        <div class="card"><h2>Biggest buys <span class="muted">${periodWords()}</span></h2><div id="bigBuys" class="bars"></div></div>
        <div class="card"><h2>Biggest sales <span class="muted">${periodWords()}</span></h2><div id="bigSells" class="bars"></div></div>
      </div>
      <div class="card section"><h2>All trades</h2>
        <div class="toolbar"><div class="seg" role="group" aria-label="Buys or sales"><button type="button" data-side="all" aria-pressed="true">All</button><button type="button" data-side="B">Buys</button><button type="button" data-side="S">Sales</button></div>
        <input type="search" id="filt" placeholder="Filter by ticker or company"><span class="count" id="cnt"></span></div><div id="tbl"></div></div>`;
    bindPeriod(app);
    const bars = (el, list, cls) => {
      const by = new Map();
      for (const t of list) { const k = t.t && stocks[t.t] ? t.t : t.a; const g = by.get(k) || { k, t, list: [] }; g.list.push(t); by.set(k, g); }
      const top = [...by.values()].map((g) => ({ ...g, v: est(g.list).best })).sort((a, b) => b.v - a.v).slice(0, 8), mx = top[0] ? top[0].v : 1;
      el.innerHTML = top.map((g) => `<div class="bar-row"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.t.t && stocks[g.t.t] ? `${tkLink(g.t.t)} ${esc(cleanName(stocks[g.t.t][0]))}` : esc(g.k)}</span><span class="mono ${cls}">${usd(g.v)}${g.list.length > 1 ? ` <span class="muted">· ${g.list.length}</span>` : ""}</span><div class="track"><div class="fill" style="width:${(g.v / mx * 100).toFixed(1)}%${cls === "down" ? ";background:var(--bad)" : ""}"></div></div></div>`).join("") || `<p class="muted">None ${periodWords()}.</p>`;
    };
    bars($("#bigBuys"), buys, "up"); bars($("#bigSells"), sells, "down");
    let side = "all", q = "";
    const draw = () => {
      const list = mine.filter((t) => (side === "all" || t.side === side) && (!q || (t.t + " " + stockName(t)).toLowerCase().includes(q))).sort((a, b) => b.time - a.time);
      $("#cnt").textContent = `${list.length.toLocaleString()} trades`;
      table($("#tbl"), [
        { key: "d", label: "Traded", cls: "num", html: (t) => fmtDate(t.d), sort: (t) => t.time },
        { key: "side", label: "", html: (t) => `<span class="pill ${t.side}">${t.side === "B" ? "Buy" : t.k === "SP" ? "Part sale" : "Sale"}</span>` },
        { key: "t", label: "Asset", html: (t) => `${t.t && stocks[t.t] ? tkLink(t.t) + " " : ""}${esc(stockName(t))}${t.cls === "option" ? ` <span class="muted">(${t.opt === "P" ? "put" : t.opt === "C" ? "call" : "option"})</span>` : ""}`, sort: (t) => t.t || t.a },
        { key: "amt", label: "Amount", cls: "r", html: (t) => rangeText(t), sort: (t) => t.amt },
        { key: "r", label: "Since trade", cls: "r hide-sm", hideSm: true, html: (t) => t.r == null ? "–" : `<span class="${t.r >= 0 ? "up" : "down"}">${pct(t.r)}</span>`, sort: (t) => t.r ?? -9 },
        { key: "fd", label: "Filed", cls: "num hide-sm", hideSm: true, html: (t) => fmtDate(t.fd), sort: (t) => t.ftime },
      ], list, { sort: "d", page: 50, empty: `No trades ${periodWords()}.` });
    };
    $$("[data-side]").forEach((b) => b.addEventListener("click", () => { side = b.dataset.side; $$("[data-side]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw(); }));
    $("#filt").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
  }

  // prices load only when a stock page needs them (a large file)
  let PRICES = null, pricesPromise = null;
  const loadPrices = () => PRICES ? Promise.resolve(PRICES) : (pricesPromise ||= new Promise((res) => {
    const s = document.createElement("script"); s.src = "../prices.js";
    s.onload = () => { PRICES = window.CTC_PRICES; res(PRICES); }; s.onerror = () => res(null); document.head.appendChild(s);
  }));

  async function pageStock(tk) {
    setNav("stocks");
    const st = stocks[tk];
    if (!st) { app.innerHTML = `<h1>Not found</h1><p>No stock with that ticker. <a href="#/stocks">See every stock</a>.</p>`; return; }
    const s0 = since(), list = trades.filter((t) => t.t === tk && t.time >= s0 && t.side !== "O" && !isBiz(members[t.m]));
    const buys = list.filter((t) => t.side === "B"), sells = list.filter((t) => t.side === "S");
    app.innerHTML = `<div class="crumbs"><a href="#/stocks">Stocks</a></div>
      <div class="price-head"><div><h1>${esc(cleanName(st[0]))}</h1><div class="muted"><span class="tk">${esc(tk)}</span> ${esc([st[3] || st[2], st[1]].filter(Boolean).join(" · "))}${st[4] ? ` · market value ${usd(st[4])}` : ""}</div></div>
        <div class="px" id="px"></div></div>
      <div class="toolbar">${periodSeg()}</div>
      <div class="card"><div class="chart" id="chart"><p class="loading">Loading prices…</p></div>
        <div class="legend"><span><i class="tri-up"></i>a buy</span><span><i class="tri-dn"></i>a sale</span><span>hover or tap the chart for the trades on each day</span></div></div>
      <div class="grid cols-3 section">
        <div class="card stat"><div class="lbl">Bought</div><div class="big up">${buys.length ? usd(est(buys).best) : "–"}</div><div class="sub">${buys.length} buys by ${new Set(buys.map((t) => t.m)).size} people</div></div>
        <div class="card stat"><div class="lbl">Sold</div><div class="big down">${sells.length ? usd(est(sells).best) : "–"}</div><div class="sub">${sells.length} sales by ${new Set(sells.map((t) => t.m)).size} people</div></div>
        <div class="card stat" id="parties"></div>
      </div>
      <div class="card section"><h2>Who traded it <span class="muted">${periodWords()}</span></h2><div id="tbl"></div></div>`;
    bindPeriod(app);
    // parties
    const pty = (p, side) => est(list.filter((t) => t.side === side && members[t.m].party === p)).best;
    $("#parties").innerHTML = `<div class="lbl">Democrats · Republicans</div><div class="big"><span class="party D">${usd(pty("D", "B"))}</span> · <span class="party R">${usd(pty("R", "B"))}</span></div><div class="sub">bought; sold <span class="party D">${usd(pty("D", "S"))}</span> · <span class="party R">${usd(pty("R", "S"))}</span></div>`;
    // people
    const by = new Map();
    for (const t of list) { const g = by.get(t.m) || { m: members[t.m], b: [], s: [] }; (t.side === "B" ? g.b : g.s).push(t); by.set(t.m, g); }
    const rows = [...by.values()].map((g) => {
      const pb = g.b.filter((t) => t.ep && t.amt), sh = pb.reduce((a, t) => a + t.amt / t.ep, 0);
      return { ...g, eb: est(g.b).best, es: est(g.s).best, avg: sh ? pb.reduce((a, t) => a + t.amt, 0) / sh : null };
    });
    const P = await loadPrices();
    if (location.hash !== `#/stock/${encodeURIComponent(tk)}` && location.hash !== `#/stock/${tk}`) return;  // moved on while prices loaded
    const s = P && P.px[tk], last = s ? s.filter((v) => v != null).pop() : null;
    if (last) $("#px").innerHTML = `$${last.toFixed(2)}<div class="muted" style="font-size:13px;font-weight:500">close ${fmtDate(D.prices_through)}</div>`;
    table($("#tbl"), [
      { key: "who", label: "Person", html: (g) => who(g.m) },
      { key: "eb", label: "Bought", cls: "r", html: (g) => `<span class="up">${g.b.length ? `${usd(g.eb)} · ${g.b.length}` : "–"}</span>`, sort: (g) => g.eb },
      { key: "es", label: "Sold", cls: "r", html: (g) => `<span class="down">${g.s.length ? `${usd(g.es)} · ${g.s.length}` : "–"}</span>`, sort: (g) => g.es },
      { key: "avg", label: "Avg buy", cls: "r hide-sm", hideSm: true, html: (g) => g.avg ? `$${g.avg.toFixed(2)}` : "–", sort: (g) => g.avg || 0 },
      { key: "chg", label: "Since", cls: "r", html: (g) => g.avg && last ? `<span class="${last >= g.avg ? "up" : "down"}">${pct(last / g.avg - 1)}</span>` : "–", sort: (g) => g.avg && last ? last / g.avg : -9 },
    ], rows, { sort: "eb", href: (g) => `#/member/${encodeURIComponent(g.m.id)}`, empty: `Nobody traded ${tk} ${periodWords()}.` });
    drawChart($("#chart"), P, tk, list);
  }

  // ---------- an interactive price chart (SVG): the price, every buy and sale, a tooltip for each day ----------
  function drawChart(el, P, tk, list) {
    const s = P && P.px[tk];
    if (!s) { el.innerHTML = `<p class="muted">No daily prices for ${esc(tk)}.</p>`; return; }
    const dates = P.dates, s0 = since();
    let i0 = 0; while (i0 < dates.length - 1 && Date.parse(dates[i0] + "T00:00:00Z") < s0) i0++;
    let i1 = dates.length - 1; while (i1 > i0 && s[i1] == null) i1--;
    const idx = []; for (let i = i0; i <= i1; i++) if (s[i] != null) idx.push(i);
    if (idx.length < 2) { el.innerHTML = `<p class="muted">Not enough prices in this period.</p>`; return; }
    // drawn at the screen's own width (phones get a narrower, taller chart, so labels stay readable)
    const narrow = el.clientWidth < 620, W = narrow ? 520 : 1000, H = narrow ? 340 : 340, L = 8, R = narrow ? 56 : 64, T = 16, B = 30, vals = idx.map((i) => s[i]);
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.08 || hi * 0.05; lo -= pad; hi += pad;
    const X = (i) => L + (i - i0) / Math.max(1, i1 - i0) * (W - L - R), Y = (v) => T + (hi - v) / (hi - lo) * (H - T - B);
    const line = idx.map((i, k) => `${k ? "L" : "M"}${X(i).toFixed(1)},${Y(s[i]).toFixed(1)}`).join("");
    const area = `${line}L${X(idx[idx.length - 1]).toFixed(1)},${H - B}L${X(idx[0]).toFixed(1)},${H - B}Z`;
    const step = (hi - lo) / 4, ticks = [0, 1, 2, 3, 4].map((k) => lo + step * k);
    // month labels
    const months = []; let lastM = "";
    for (let i = i0; i <= i1; i++) { const mo = dates[i].slice(0, 7); if (mo !== lastM) { if (lastM) months.push(i); lastM = mo; } }
    const every = Math.ceil(months.length / (narrow ? 4 : 8));
    const di = new Map(dates.map((d, i) => [d, i]));
    const at = (d) => { let i = di.get(d); if (i == null) { i = dates.findIndex((x) => x >= d); if (i < 0) i = dates.length - 1; } return i; };
    const marks = list.filter((t) => t.time >= Date.parse(dates[i0] + "T00:00:00Z")).map((t) => ({ t, i: at(t.d) })).filter((x) => x.i >= i0 && x.i <= i1);
    const tri = (x, y, up, col) => up ? `<path d="M${x},${y + 4}l-6,11h12z" fill="${col}"/>` : `<path d="M${x},${y - 4}l-6,-11h12z" fill="${col}"/>`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tk)} price with members' buys and sales">
      ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)"/><text x="${W - R + 8}" y="${(Y(v) + 4).toFixed(1)}" font-size="12" fill="var(--muted)" font-family="var(--font-mono)">$${v.toFixed(v < 10 ? 2 : 0)}</text>`).join("")}
      ${months.filter((_, k) => k % every === 0).map((i) => `<text x="${X(i).toFixed(1)}" y="${H - 8}" font-size="12" fill="var(--muted)" text-anchor="middle">${fmtDate(dates[i], { month: "short", ...(dates[i].slice(5, 7) === "01" ? { year: "2-digit" } : {}) })}</text>`).join("")}
      <path d="${area}" fill="var(--chart-area)"/><path d="${line}" fill="none" stroke="var(--chart)" stroke-width="2.2" stroke-linejoin="round"/>
      ${marks.map(({ t, i }) => tri(X(i).toFixed(1), Y(s[i] ?? t.ep), t.side === "B", t.side === "B" ? "var(--good)" : "var(--bad)")).join("")}
      <line id="cx" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="var(--ink-2)" stroke-dasharray="3 3" visibility="hidden"/>
      <circle id="cd" r="4.5" fill="var(--chart)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>
      <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" id="hit"/></svg><div class="tip" hidden></div>`;
    const svg = $("svg", el), tip = $(".tip", el), cx = $("#cx", el), cd = $("#cd", el);
    const byDay = new Map(); for (const mk of marks) (byDay.get(mk.i) || byDay.set(mk.i, []).get(mk.i)).push(mk.t);
    const move = (ev) => {
      const r = svg.getBoundingClientRect(), px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left, x = px / r.width * W;
      let i = Math.round(i0 + (x - L) / (W - L - R) * (i1 - i0)); i = Math.max(i0, Math.min(i1, i));
      while (i > i0 && s[i] == null) i--;
      // snap to a trade day within a few days, so trades are easy to hit
      for (let d = 0; d <= 3; d++) { if (byDay.has(i + d)) { i += d; break; } if (byDay.has(i - d)) { i -= d; break; } }
      const xx = X(i), yy = Y(s[i]);
      cx.setAttribute("x1", xx); cx.setAttribute("x2", xx); cx.setAttribute("visibility", "visible");
      cd.setAttribute("cx", xx); cd.setAttribute("cy", yy); cd.setAttribute("visibility", "visible");
      const ts = byDay.get(i) || [];
      tip.innerHTML = `<div class="muted">${fmtDate(dates[i])}</div><b>$${s[i].toFixed(2)}</b>${ts.slice(0, 6).map((t) => `<div style="margin-top:4px"><span class="pill ${t.side}">${t.side === "B" ? "Buy" : "Sale"}</span> ${esc(members[t.m].name)} <span class="muted">${rangeText(t)}</span></div>`).join("")}${ts.length > 6 ? `<div class="muted">+${ts.length - 6} more</div>` : ""}`;
      tip.hidden = false;
      const left = xx / W * r.width, tw = tip.offsetWidth;
      tip.style.left = `${Math.max(0, Math.min(r.width - tw, left + (left > r.width / 2 ? -tw - 14 : 14)))}px`; tip.style.top = `${Math.max(0, yy / H * r.height - 40)}px`;
    };
    const leave = () => { tip.hidden = true; cx.setAttribute("visibility", "hidden"); cd.setAttribute("visibility", "hidden"); };
    svg.addEventListener("mousemove", move); svg.addEventListener("touchstart", move, { passive: true }); svg.addEventListener("touchmove", move, { passive: true });
    svg.addEventListener("mouseleave", leave);
  }

  // ---------- routing: #/, #/politicians, #/stocks, #/member/<id>, #/stock/<ticker> ----------
  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, "")), [page, arg] = h.split("/");
    window.scrollTo(0, 0);
    if (page === "politicians") pagePoliticians();
    else if (page === "stocks") pageStocks();
    else if (page === "member" && arg) pageMember(arg);
    else if (page === "stock" && arg) pageStock(arg.toUpperCase());
    else pageHome();
    const title = $("h1", app); document.title = title && page ? `${title.textContent} · Congress Trade Check` : "Congress Trade Check";
  }
  window.addEventListener("hashchange", route);
  $("#theme").addEventListener("click", () => {
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t; try { localStorage.setItem("ctc-theme", t); } catch (e) { /* storage blocked */ }
  });
  bindSearch();
  route();
})();
