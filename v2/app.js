/* Congress Trade Check, website design (v2).
   Pages with their own links, global search, sortable tables and interactive charts, built from the same data files
   as the classic site (../data.js, ../series.js, ../prices.js ...). What the classic site's Data Visualization drew as
   images is part of the pages here: a politician's factsheet, portfolio, biggest buys, bonds and committee overlap on
   their page; Democrats vs Republicans and who still holds it on a stock's page; buying spikes on the home page. */
(() => {
  "use strict";
  const D = window.CTC_DATA, SERIES = window.CTC_SERIES || {}, HOLD0 = window.CTC_HOLDINGS || {};
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DAY = 86400000, today = Date.parse(D.prices_through + "T00:00:00Z"), YEAR = new Date(today).getUTCFullYear();
  const F = Object.fromEntries(D.fields.map((f, i) => [f, i]));
  const members = D.members.map((m, i) => ({ ...m, i }));
  const stocks = D.stocks, NW = D.weeks.length;
  const loadScript = (src) => new Promise((res) => { const s = document.createElement("script"); s.src = src; s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s); });

  // ---------- amounts: the same best estimates as the classic site ----------
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
  const trades = D.trades.filter((r) => !(stocks[r[F.t]] && stocks[r[F.t]][1] === "Crypto")).map((r) => {  // crypto is left off, as on the classic site
    let lo = r[F.lo] || 0; const hi = r[F.hi] || lo;
    if (hi && lo > hi) lo = LOWS.filter((x) => x < hi).pop() || lo;  // a misread range (top below bottom)
    const ex = r[F.ex] ? r[F.ex][0] : null, b = ex ? { mean: ex, sd: 0 } : band(lo, hi);
    const k = r[F.k];
    return { m: r[F.m], t: r[F.t] || "", a: r[F.a] || "", k, side: k === "B" ? "B" : (k === "S" || k === "SP") ? "S" : "O", d: r[F.d], fd: r[F.fd],
      time: Date.parse(r[F.d] + "T00:00:00Z"), ftime: r[F.fd] ? Date.parse(r[F.fd] + "T00:00:00Z") : 0, lo, hi, ex, amt: b.mean, sd: b.sd,
      cls: r[F.cls], opt: r[F.opt], own: r[F.own] || "", c: r[F.c] || [], src: r[F.src],
      T: { r: r[F.r], sr: r[F.sr], ep: r[F.ep], se: r[F.se], ew: r[F.ew], xw: r[F.xw] }, P: { r: r[F.rf], sr: r[F.srf], ep: r[F.epf], se: r[F.sef], ew: r[F.efw], xw: r[F.xfw] },
      ep: r[F.ep], delay: r[F.fd] ? Math.round((Date.parse(r[F.fd] + "T00:00:00Z") - Date.parse(r[F.d] + "T00:00:00Z")) / DAY) : null };
  });
  trades.forEach((t, i) => { t.id = i; });
  const eff = (t, r) => r == null ? null : (t.opt === "P" ? -r : r);  // a put gains when the stock falls
  const est = (list) => {  // best estimate, its likely range (7 times in 10) and the filings' own bounds
    let best = 0, v = 0, min = 0, max = 0;
    for (const t of list) { best += t.amt; v += t.sd ** 2; min += t.ex || t.lo; max += t.ex || t.hi || t.lo; }
    const sd = Math.sqrt(v);
    return { best, lo: Math.max(min, best - 1.0364 * sd), hi: Math.min(max, best + 1.0364 * sd), min, max, exact: !v };
  };
  // returns on buys, dollar-weighted, against the S&P 500 over the same days; base: "T" trade date, "P" disclosure date
  function stats(list, base) {
    let n = 0, inv = 0, gain = 0, spyGain = 0, wins = 0;
    for (const t of list) {
      if (t.side !== "B") continue;
      const r = eff(t, t[base].r), sr = t[base].sr;
      if (r == null || sr == null) continue;
      n++; inv += t.amt; gain += t.amt * r; spyGain += t.amt * sr; if (r > sr) wins++;
    }
    return { n, inv, ret: inv ? gain / inv : null, spyRet: inv ? spyGain / inv : null, diff: inv ? (gain - spyGain) / inv : null, win: n ? wins / n : null };
  }

  // ---------- formatting ----------
  const usd = (x) => { const a = Math.abs(x), s = x < 0 ? "−" : ""; return a >= 1e12 ? `${s}$${(a / 1e12).toFixed(1)}T` : a >= 1e9 ? `${s}$${(a / 1e9).toFixed(2)}B` : a >= 1e7 ? `${s}$${Math.round(a / 1e6)}M` : a >= 1e6 ? `${s}$${(a / 1e6).toFixed(1)}M` : a >= 1e4 ? `${s}$${Math.round(a / 1e3)}K` : a >= 1e3 ? `${s}$${(a / 1e3).toFixed(1)}K` : `${s}$${Math.round(a)}`; };
  const span = (e) => e.exact ? usd(e.best) : (usd(e.lo) === usd(e.hi) ? usd(e.best) : `${usd(e.lo)}–${usd(e.hi)}`);
  const rangeText = (t) => t.ex ? `${usd(t.ex)} exact` : !t.lo ? "amount unclear" : t.lo === t.hi ? `over ${usd(t.lo - 1)}` : `${usd(t.lo)}–${usd(t.hi)}`;
  // every return and every gap to the S&P 500 is shown as a plain percentage
  const pct = (x, d = 1) => x == null || !isFinite(x) ? "–" : `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x * 100).toFixed(d)}%`;
  const cls = (x) => x == null ? "" : x >= 0 ? "up" : "down";
  const price = (v) => v == null ? "–" : `$${v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(2)}`;
  const fmtDate = (iso, o = { day: "numeric", month: "short", year: "numeric" }) => iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { ...o, timeZone: "UTC" }) : "";
  const isoOf = (time) => new Date(time).toISOString().slice(0, 10);
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
  const cname = (c) => (D.committees[c] || {}).name || c;
  // faces: the large portrait file where there is one, otherwise the small photo from ../photos.js (loaded in the background)
  const photoSrc = (m) => m.hd ? `../portraits/${encodeURIComponent(m.id)}.jpg` : (window.CTC_PHOTOS && window.CTC_PHOTOS[m.id]) || "";
  const photo = (m) => { const src = photoSrc(m); return `<img ${src ? `src="${src}"` : ""} data-pid="${esc(m.id)}" alt="" loading="lazy" onerror="window.__ctcPhotoFail&&window.__ctcPhotoFail(this)">`; };
  window.__ctcPhotoFail = (img) => { const u = window.CTC_PHOTOS && window.CTC_PHOTOS[img.dataset.pid]; if (u && img.src !== u) img.src = u; else img.removeAttribute("src"); };
  loadScript("../photos.js").then(() => $$("img[data-pid]").forEach((img) => { if (!img.getAttribute("src") || img.naturalWidth === 0) { const u = (window.CTC_PHOTOS || {})[img.dataset.pid]; if (u) img.src = u; } }));
  const who = (m, sub = true) => `<a class="who ${esc(m.party || "I")}" href="#/member/${encodeURIComponent(m.id)}">${photo(m)}<span style="min-width:0"><span class="nm">${esc(m.name)}</span>${sub ? `<br><span class="meta">${partyTag(m)} ${esc(seat(m))}</span>` : ""}</span></a>`;
  const tkLink = (tk) => tk && stocks[tk] ? `<a class="tk" href="#/stock/${encodeURIComponent(tk)}">${esc(tk)}</a>` : `<span class="tk">${esc(tk || "–")}</span>`;
  const stockName = (t) => t.t && stocks[t.t] ? cleanName(stocks[t.t][0]) : t.a;
  const securities = (t) => t.cls === "stock" || t.cls === "fund";

  // ---------- brand colours and logos (the same as the classic site's Biggest buys) ----------
  const BRAND = {
    META: ["#0866FF", "meta"], MSFT: ["#7FBA00", "ms"], AMZN: ["#FF9900", "amazon", "#232F3E"], AAPL: ["#1D1D1F", "apple"], NVDA: ["#76B900", "nvidia", "#111111"],
    GOOGL: ["#4285F4", "google"], GOOG: ["#4285F4", "google"], AVGO: ["#CC092F", "broadcom"], TSLA: ["#CC0000", "tesla"], NFLX: ["#E50914", "netflix"],
    ADBE: ["#FA0F00", "adobe"], ORCL: ["#C74634", "oracle"], INTC: ["#0071C5", "intel"], AMD: ["#ED1C24", "amd"], CSCO: ["#1BA0D7", "cisco"], IBM: ["#1F70C1", "ibm"],
    CRM: ["#00A1E0", "salesforce"], PLTR: ["#101113", "palantir"], QCOM: ["#3253DC", "qualcomm"], UBER: ["#000000", "uber"], PYPL: ["#003087", "paypal"],
    V: ["#1A1F71", "visa"], MA: ["#EB001B", "mastercard"], SHOP: ["#7AB55C", "shopify"], SPOT: ["#1DB954", "spotify"], SBUX: ["#006241", "starbucks"],
    MCD: ["#DA291C", "mcdonalds"], KO: ["#F40009", "cocacola"], PEP: ["#2151A1", "pepsi"], NKE: ["#111111", "nike"], WMT: ["#0071CE", "walmart"], TGT: ["#CC0000", "target"],
    CMCSA: ["#6138F5", "nbc"], T: ["#00A8E0", "att"], VZ: ["#CD040B", "verizon"], BA: ["#0D2D6C", "boeing"], GS: ["#6B9BD1", "goldmansachs"],
    BAC: ["#E31837", "bankofamerica"], WFC: ["#D71E28", "wellsfargo"], PFE: ["#0093D0", "pfizer"], CVX: ["#0054A4", "chevron"],
    DIS: ["#113CCF", null, null, "D"], COST: ["#E31837", null, null, "C"], HD: ["#F96302", null, null, "HD"], LOW: ["#004990", null, null, "L"],
    JPM: ["#5C3D2E", null, null, "JPM"], UNH: ["#002677", null, null, "U"], LLY: ["#D52B1E", null, null, "L"], JNJ: ["#D51900", null, null, "J"],
    ABT: ["#0099D8", null, null, "A"], XOM: ["#ED1B2D", null, null, "X"], CPAY: ["#E8541E", null, null, "C"], GWW: ["#D50032", null, null, "G"], FIS: ["#3BAA35", null, null, "FIS"],
  };
  const logoBox = (tk, col, size = 34, own = false, brand = null) => {  // own: use col as the background; brand: in place of BRAND[tk]
    const b = brand || BRAND[tk], bg = own ? col : b ? (b[2] || b[0]) : col;
    if (b && !b[1] && b[3]) tk = b[3];
    if (b && b[1] === "ms") return `<span class="logo" style="width:${size}px;height:${size}px;background:#fff;border:1px solid var(--line)"><span class="ms"><i style="background:#F25022"></i><i style="background:#7FBA00"></i><i style="background:#00A4EF"></i><i style="background:#FFB900"></i></span></span>`;
    if (b && b[1]) return `<span class="logo" style="width:${size}px;height:${size}px;background:${bg}"><img src="https://cdn.jsdelivr.net/npm/simple-icons@11.14.0/icons/${b[1]}.svg" alt="" loading="lazy" onerror="this.outerHTML='<b style=&quot;font-size:${Math.round(size * (tk.length > 3 ? 0.3 : 0.38))}px&quot;>${esc(tk.slice(0, 4))}</b>'"></span>`;
    return `<span class="logo" style="width:${size}px;height:${size}px;background:${bg}"><b style="font-size:${size * ((tk || "").length > 3 ? 0.3 : 0.38)}px">${esc((tk || "•").slice(0, 4))}</b></span>`;
  };

  // ---------- the Filter: the same settings as the classic site, saved in the same place (so both sites share them) ----------
  const FDEF = { chamber: "all", committee: "all", owner: "all", timing: "trade", hideBig: true, sp500: true, capMax: "0", exclude: "NVDA, AAPL, GOOGL",
    committeeOnly: true, lateOnly: false, options: true, spikes: true };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("ctc-state") || "{}") || {}; } catch (e) { /* storage blocked */ }
  const S = { ...FDEF, ...Object.fromEntries(Object.keys(FDEF).filter((k) => k in saved).map((k) => [k, saved[k]])) };
  if (S.committee !== "all" && !D.committees[S.committee]) S.committee = "all";
  const saveFilter = () => { try { const cur = JSON.parse(localStorage.getItem("ctc-state") || "{}") || {}; localStorage.setItem("ctc-state", JSON.stringify({ ...cur, ...S, v: Math.max(cur.v || 0, 13) })); } catch (e) { /* storage blocked */ } };
  let excl = new Set();
  const applyFilterSettings = () => { excl = new Set(String(S.exclude || "").toUpperCase().split(/[\s,;]+/).filter(Boolean)); };
  applyFilterSettings();
  const B = () => S.timing === "public" ? "P" : "T";  // which timing returns use
  const oversees = new Set(members.filter((m) => (m.committees || []).some((c) => (D.committees[c] || {}).matches)).map((m) => m.i));
  const ownUnknown = (t) => t.src === "o" || t.src === "q" || t.src === "s" || t.src === "i";  // forms that don't say whose account
  const isBig = (t, f = S) => { const st = stocks[t.t]; return !!st && (t.cls === "fund" || (f.sp500 && st[5]) || (+f.capMax && st[4] > +f.capMax) || excl.has(t.t)); };

  // ---------- buying spikes: several members buying the same stock within about a month, far more than usual ----------
  // The classic site's rule: at least 3 different members within 15 days either side, when that many would turn up by
  // chance less than 1 time in 20 at the stock's usual monthly rate (a Poisson test).
  const SPIKE_HALF = 15 * DAY;
  const poissonTail = (k, lam) => { let term = Math.exp(-lam), cdf = 0; for (let i = 0; i < k; i++) { cdf += term; term *= lam / (i + 1); } return Math.max(0, 1 - cdf); };
  (function markSpikes() {
    const months = Math.max(1, (today - Date.parse(D.start + "T00:00:00Z")) / (30.44 * DAY)), by = new Map();
    for (const t of trades) if (t.side === "B" && stocks[t.t] && !isBiz(members[t.m])) { if (!by.has(t.t)) by.set(t.t, []); by.get(t.t).push(t); }
    for (const list of by.values()) {
      list.sort((a, b) => a.time - b.time);
      const buyerMonths = new Set(list.map((t) => t.m + "|" + t.d.slice(0, 7))).size;
      let lo = 0, hi = 0;
      for (const t of list) {
        while (list[lo].time < t.time - SPIKE_HALF) lo++;
        while (hi < list.length && list[hi].time <= t.time + SPIKE_HALF) hi++;
        const buyers = new Set(); for (let j = lo; j < hi; j++) buyers.add(list[j].m);
        if (buyers.size < 3) continue;
        const usual = Math.max(0.05, (buyerMonths - buyers.size) / Math.max(1, months - 1));
        if (poissonTail(buyers.size, usual) <= 0.05) t.spike = { k: buyers.size, usual };
      }
    }
  })();

  // does a trade pass the Filter? f: the settings (the page's own on a politician's page); person: false on a politician's
  // own page; big: false on a stock's own page (the stock you opened always shows)
  function pass(t, o = {}, f = S) {
    const m = members[t.m];
    if (o.person !== false) {
      if (f.chamber === "all" ? isBiz(m) : m.chamber !== f.chamber) return false;
      if (f.committee !== "all" && !(m.committees || []).includes(f.committee)) return false;
    }
    if (f.owner !== "all" && !ownUnknown(t) && (t.own || "self") !== f.owner) return false;
    if (t.cls === "option" && !f.options) return false;
    if (o.big !== false && f.hideBig && securities(t) && isBig(t, f) && !(f.spikes && t.spike && !excl.has(t.t))) return false;
    if (f.committeeOnly) {
      if (!oversees.has(t.m)) { if (o.person !== false) return false; }
      else if (!(t.c && t.c.length)) return false;
    }
    if (f.lateOnly && !(t.delay > 45)) return false;
    return true;
  }
  const filterLabels = (f = S) => [
    f.chamber !== "all" && { H: "House", S: "Senate", E: "Executive branch", C: "Business leaders" }[f.chamber],
    f.committee !== "all" && cname(f.committee),
    f.owner !== "all" && { self: "Own accounts", SP: "Spouse", DC: "Children", JT: "Joint" }[f.owner],
    f.hideBig && `Large caps and funds excluded${f.spikes ? " (kept during buying spikes)" : ""}`,
    f.committeeOnly && "Committee-linked trades only",
    f.lateOnly && "Late disclosures only",
    !f.options && "Options left out",
    f.timing === "public" && "Returns from disclosure date",
  ].filter(Boolean);
  function filterStrip() {
    const ls = filterLabels();
    return `<div class="fstrip"><span class="lbl">Filter</span>${ls.length ? ls.map((l) => `<span class="tag">${esc(l)}</span>`).join("") : `<span class="muted">none: every trade counts</span>`}
      <button type="button" class="linkbtn" data-open-filter>Edit</button>${ls.length ? `<button type="button" class="linkbtn" data-clear-filter>Clear all</button>` : ""}</div>`;
  }
  function bindStrip(el) {
    $$("[data-open-filter]", el).forEach((b) => b.addEventListener("click", openFilter));
    $$("[data-clear-filter]", el).forEach((b) => b.addEventListener("click", () => {
      Object.assign(S, { chamber: "all", committee: "all", owner: "all", timing: "trade", hideBig: false, committeeOnly: false, lateOnly: false, options: true });
      saveFilter(); applyFilterSettings(); updateFilterBadge(); route(true);
    }));
  }
  function openFilter() {
    const fp = $("#fpanel"), seg = (k, opts) => `<div class="seg" data-fk="${k}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(S[k]) === v}">${l}</button>`).join("")}</div>`;
    const chk = (k, title, sub) => `<label class="toggle"><input type="checkbox" data-fc="${k}"${S[k] ? " checked" : ""}><span><b>${title}</b><span class="muted">${sub}</span></span></label>`;
    const comms = Object.entries(D.committees).filter(([, c]) => c.name).sort((a, b) => a[1].name.localeCompare(b[1].name));
    fp.innerHTML = `<div class="wrap fp-inner">
      <div class="fp-head"><h2>Filter</h2><span class="muted">Applies to every page here and on the classic site. A politician's page also has its own.</span><button type="button" class="btn" id="fpClose">Done</button></div>
      <div class="fp-grid">
        <div><h3>Whose trades</h3>
          <div class="field"><span class="flbl">Chamber</span>${seg("chamber", [["all", "All"], ["H", "House"], ["S", "Senate"], ["E", "Executive"], ["C", "Business"]])}</div>
          <div class="field"><span class="flbl">Committee / department</span><select data-fs="committee"><option value="all">All committees</option>${comms.map(([k, c]) => `<option value="${esc(k)}"${S.committee === k ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
          <div class="field"><span class="flbl">Account</span>${seg("owner", [["all", "All"], ["self", "Own"], ["SP", "Spouse"], ["DC", "Children"], ["JT", "Joint"]])}</div>
          <div class="field"><span class="flbl">Returns measured from</span>${seg("timing", [["trade", "Trade date"], ["public", "Disclosure date"]])}</div>
        </div>
        <div><h3>Which trades count</h3>
          ${chk("hideBig", "Exclude large caps and funds", "Widely held stocks, funds and ETFs.")}
          <div class="subopts">
            <label class="check"><input type="checkbox" data-fc="sp500"${S.sp500 ? " checked" : ""}> S&amp;P 500 companies</label>
            <label class="check"><input type="checkbox" data-fc="spikes"${S.spikes ? " checked" : ""}> Except during buying spikes</label>
            <label class="check">Market cap above <select data-fs="capMax">${[["0", "No limit"], ["10000000000", "$10 billion"], ["50000000000", "$50 billion"], ["200000000000", "$200 billion"]].map(([v, l]) => `<option value="${v}"${String(S.capMax) === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="check">Always exclude <input type="text" data-ft="exclude" value="${esc(S.exclude)}" spellcheck="false"></label>
          </div>
          ${chk("committeeOnly", "Committee-linked trades only", "House and Senate trades in sectors their committees oversee.")}
          ${chk("lateOnly", "Late disclosures only", "Filed after the STOCK Act's 45-day deadline.")}
          ${chk("options", "Include options", "Valued at the underlying share price.")}
        </div>
      </div></div>`;
    fp.hidden = false; $("#filterBtn").setAttribute("aria-expanded", "true");
    const changed = () => { saveFilter(); applyFilterSettings(); updateFilterBadge(); route(true); };
    $$("[data-fk]", fp).forEach((g) => $$("button", g).forEach((b) => b.addEventListener("click", () => { S[g.dataset.fk] = b.dataset.v; $$("button", g).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); changed(); })));
    $$("[data-fc]", fp).forEach((c) => c.addEventListener("change", () => { S[c.dataset.fc] = c.checked; changed(); }));
    $$("[data-fs]", fp).forEach((c) => c.addEventListener("change", () => { S[c.dataset.fs] = c.value; changed(); }));
    let tm; $$("[data-ft]", fp).forEach((c) => c.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => { S[c.dataset.ft] = c.value; changed(); }, 400); }));
    $("#fpClose", fp).addEventListener("click", closeFilter);
  }
  function closeFilter() { $("#fpanel").hidden = true; $("#filterBtn").setAttribute("aria-expanded", "false"); }
  function updateFilterBadge() { const n = filterLabels().length; $("#filterBtn").innerHTML = `Filter${n ? ` <span class="badge">${n}</span>` : ""}`; }

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
      route(true);
    }));
  }

  // ---------- what someone still holds of a stock ----------
  // From all their filings since the data starts: each buy adds its best-estimate dollars ÷ that day's close, each sale
  // takes them away, per account; a House or Senate full sale empties that account. Where an annual report (OGE 278e)
  // lists their year-end holdings, the count starts there. Valued at the latest weekly close.
  const lastPrice = (tk) => { const s = SERIES[tk]; if (!s) return null; for (let i = s.length - 1; i >= 0; i--) if (s[i] != null) return s[i]; return null; };
  const weekOf = (iso) => { const i = D.weeks.findIndex((w) => w >= iso); return i < 0 ? NW - 1 : i; };
  const LEFT = new Map();  // "m|tk" -> { shares, annual }
  (function computeLeft() {
    const by = new Map();
    for (const t of trades) if (t.t && stocks[t.t] && t.side !== "O" && t.cls !== "option" && t.amt > 0 && t.ep) { const k = t.m + "|" + t.t; if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
    for (const [k, list] of by) {
      const [mi, tk] = k.split("|"), m = members[+mi], base = HOLD0[m.id] && HOLD0[m.id].stocks[tk] ? HOLD0[m.id] : null;
      const acct = new Map(); let from = -Infinity, bought = false, lastFull = false;
      if (base) {
        const s = SERIES[tk], w = weekOf(base.as_of), px0 = s && (s[w] ?? s[w - 1]);
        if (px0) { acct.set("self", base.stocks[tk].reduce((a, [lo, hi]) => a + (lo ? band(lo, hi).mean : 0), 0) / px0); from = Date.parse(base.as_of + "T23:59:59Z"); bought = true; }
      }
      list.sort((a, b) => a.time - b.time);
      for (const t of list) {
        if (t.time <= from) continue;
        const o = t.own || "self", h = acct.get(o) || 0;
        if (t.side === "B") { acct.set(o, h + t.amt / t.ep); bought = true; lastFull = false; }
        else { lastFull = t.k === "S" && !isExec(m); acct.set(o, lastFull ? 0 : Math.max(0, h - t.amt / t.ep)); }
      }
      // only sales on file: bought before the data starts, so unknown unless a full sale emptied it
      LEFT.set(k, { shares: bought ? [...acct.values()].reduce((a, v) => a + v, 0) : lastFull ? 0 : null, annual: !!base });
    }
  })();
  const leftOf = (mi, tk) => { const l = LEFT.get(mi + "|" + tk); if (!l || l.shares == null) return null; const p = lastPrice(tk); return p ? { value: l.shares * p, annual: l.annual } : null; };
  const leftText = (L) => L == null ? `<span class="muted" title="Only sales are on file: shares bought before ${fmtDate(D.start, { month: "short", year: "numeric" })} aren't known">unknown</span>` : L.value < 1000 ? `<span class="down">sold out</span>` : `≈${usd(L.value)}${L.annual ? ` <span class="muted" title="Counted from their annual report's year-end holdings">◆</span>` : ""}`;
  const leftPlain = (L) => L == null ? "unknown" : L.value < 1000 ? "sold out" : `≈${usd(L.value)}`;

  // ---------- hype check: how much does a buy mean? ----------
  // A politician's buy gets shared online as a tip, but many are tiny buys in a basket of twenty placed by an account
  // manager. Each buy starts at 50% and each public fact moves it up or down: its size and its size against the
  // person's usual trade, whether it was bought alone or in a basket (and alongside lots of sales: a rebalance),
  // whether they kept adding to it or sold it soon after, other members buying, their committee, the account, the
  // company's size, the price run before the buy, how late it was filed, their own track record, and (once the
  // Public signals data has loaded) the company's insiders buying and federal contracts.
  const usualSize = new Map();
  { const by = new Map(); for (const t of trades) if (t.lo) { if (!by.has(t.m)) by.set(t.m, []); by.get(t.m).push(t.amt); }
    for (const [m, v] of by) { v.sort((a, b) => a - b); usualSize.set(m, v[Math.floor(v.length / 2)]); } }
  const wk = (t) => t.m + "|" + Math.floor(t.time / (7 * DAY));
  const weekBuys = new Map(), weekSells = new Map(), byMT = new Map();  // stocks bought / sold that week; a person's trades in a stock
  for (const t of trades) {
    if (!t.t) continue;
    const w = t.side === "B" ? weekBuys : t.side === "S" ? weekSells : null;
    if (w) { const k = wk(t); if (!w.has(k)) w.set(k, new Set()); w.get(k).add(t.t); }
    const k2 = t.m + "|" + t.t; if (!byMT.has(k2)) byMT.set(k2, []); byMT.get(k2).push(t);
  }
  for (const l of byMT.values()) l.sort((a, b) => a.time - b.time);
  const record = new Map();  // each person's stock buys against the S&P 500, from the trade date
  { const by = new Map(); for (const t of trades) if (t.side === "B" && securities(t)) { if (!by.has(t.m)) by.set(t.m, []); by.get(t.m).push(t); }
    for (const [m, l] of by) record.set(m, stats(l, "T")); }
  const hypeCache = new Map();
  function hype(t) {
    if (!t || t.side !== "B" || !t.t || !stocks[t.t]) return null;
    if (hypeCache.has(t.id)) return hypeCache.get(t.id);
    const f = [], add = (v, txt) => f.push({ v, txt });
    const st = stocks[t.t], usual = usualSize.get(t.m) || t.amt, basket = (weekBuys.get(wk(t)) || new Set()).size, sold = (weekSells.get(wk(t)) || new Set()).size;
    // size
    if (t.amt < 16000) add(-12, `Small: ${rangeText(t)}, the lowest bracket on the form`);
    else if (t.amt < 50001) add(-3, `Modest: ${rangeText(t)}`);
    else if (t.amt < 250001) add(6, `Sizeable: ${rangeText(t)}`);
    else if (t.amt < 1000001) add(12, `Large: ${rangeText(t)}`);
    else add(18, `Very large: ${rangeText(t)}`);
    const x = t.amt / usual;
    if (x >= 5) add(12, `${x.toFixed(0)}× their usual trade (${usd(usual)})`);
    else if (x >= 2) add(6, `${x.toFixed(1)}× their usual trade (${usd(usual)})`);
    else if (x <= 0.5) add(-5, `Smaller than their usual trade (${usd(usual)})`);
    // basket or rebalance
    if (basket >= 15) add(-18, `One of ${basket} stocks they bought that week: looks like a managed account`);
    else if (basket >= 8) add(-10, `One of ${basket} stocks they bought that week`);
    else if (basket <= 2) add(6, "Bought on its own, not in a basket");
    if (sold >= 5) add(-8, `They also sold ${sold} other stocks that week: looks like rebalancing`);
    // the person's history in this stock
    const mine = byMT.get(t.m + "|" + t.t) || [], before = mine.filter((u) => u.time < t.time), after = mine.filter((u) => u.time > t.time);
    const buyDays = new Set(mine.filter((u) => u.side === "B").map((u) => u.d.slice(0, 7))).size;
    const soonSale = after.find((u) => u.side === "S" && u.time - t.time <= 90 * DAY);
    if (soonSale) add(-15, `Sold ${t.t} again ${Math.round((soonSale.time - t.time) / DAY)} days later`);
    else if (buyDays >= 3) add(6, `Kept adding: bought ${t.t} in ${buyDays} different months`);
    else if (!before.length) add(4, "A new position for them");
    const L = leftOf(t.m, t.t);
    if (L && L.value >= 1000 && !soonSale) add(3, `Still holds about ${usd(L.value)}`);
    // others and the committee
    if (t.spike) add(10, `${t.spike.k} members bought it within a month (usually ${t.spike.usual < 1 ? "under 1" : t.spike.usual.toFixed(1)} a month)`);
    if (t.c && t.c.length) add(8, `Their committee oversees this industry (${esc(cname(t.c[0]))})`);
    // the account
    if (t.own === "DC") add(-6, "In a child's account");
    else if (t.own === "SP") add(-1, "In their spouse's account");
    else if (!ownUnknown(t) && (t.own || "self") === "self") add(2, "In their own account");
    // the security and the company
    if (t.cls === "fund") add(-15, "A fund or ETF: a broad bet, not a pick");
    else if (st[4] >= 200e9) add(-8, `Mega-cap (${usd(st[4])}): one of the most widely held stocks`);
    else if (st[4] && st[4] < 2e9) add(6, `Small company (${usd(st[4])}): less followed by the market`);
    if (t.cls === "option" && t.opt === "C") add(8, "Call options: a leveraged bet the price will rise");
    // the price run before the buy
    const s = SERIES[t.t], w0 = t.T.ew;
    if (s && w0 != null && w0 >= 4 && s[w0] && s[w0 - 4]) {
      const run = s[w0] / s[w0 - 4] - 1;
      if (run >= 0.2) add(-5, `Bought after a ${pct(run, 0)} run in the month before: following the crowd`);
      else if (run <= -0.15) add(3, `Bought after a ${pct(run, 0)} fall in the month before`);
    }
    // timing of the filing
    if (t.delay > 45) add(-4, `Filed ${t.delay} days later, after the 45-day deadline: much of any move is already gone`);
    else if (t.delay != null && t.delay <= 10) add(3, `Filed quickly, ${t.delay} days after the trade`);
    // their record
    const r = record.get(t.m);
    if (r && r.n >= 20 && r.diff != null) {
      if (r.diff >= 0.05) add(6, `Their buys have beaten the S&P 500 by ${pct(r.diff)} (${r.n} buys)`);
      else if (r.diff <= -0.05) add(-6, `Their buys have trailed the S&P 500 by ${pct(r.diff)} (${r.n} buys)`);
    }
    // the company's own insiders and government contracts (Public signals data)
    const g = SIG_BY && SIG_BY.get(t.t);
    if (g && g.insiders) add(8, `The company's own insiders bought ${usd(g.insider_value)} in the last ${SIGNALS.insider_days} days`);
    if (g && g.contracts > 1e6) add(3, `${usd(g.contracts)} in federal contracts in the last ${SIGNALS.contract_days} days`);
    const score = Math.max(0, Math.min(100, Math.round(50 + f.reduce((a, b) => a + b.v, 0))));
    const level = score >= 65 ? 3 : score >= 40 ? 2 : 1;
    const h = { score, level, label: ["", "Weak", "Some", "Strong"][level], f: f.sort((a, b) => Math.abs(b.v) - Math.abs(a.v)) };
    if (SIG_BY) hypeCache.set(t.id, h);
    return h;
  }
  let SIG_BY = null;
  const hypeTag = (t) => { const h = hype(t); return h ? `<button type="button" class="sig s${h.level}" data-hype="${t.id}" aria-label="Signal ${h.score}%, show why">${h.label} · ${h.score}%</button>` : ""; };
  const hypeReasons = (h, n = 3) => h.f.slice(0, n).map((x) => `<span class="why ${x.v > 0 ? "pos" : "neg"}">${x.v > 0 ? "+" : "−"} ${x.txt}</span>`).join("");
  // the breakdown opens beside a signal tag on hover, and stays open on click or tap
  (function hypePopover() {
    const pop = document.createElement("div"); pop.className = "hpop"; pop.hidden = true; pop.setAttribute("role", "dialog"); document.body.appendChild(pop);
    let pinned = null;
    const show = (btn) => {
      const t = trades[+btn.dataset.hype], h = hype(t); if (!h) return;
      const m = members[t.m];
      pop.innerHTML = `<div class="hp-head"><b>${esc(m.name)} · ${esc(t.t)}</b><span class="muted small">${fmtDate(t.d)} · ${rangeText(t)}</span></div>
        <div class="hp-score"><span class="sig s${h.level}">${h.label} signal</span><b>${h.score}%</b></div><div class="hp-bar"><i style="width:${h.score}%"></i></div>
        <ul>${h.f.map((x) => `<li class="${x.v > 0 ? "pos" : "neg"}"><span class="mono">${x.v > 0 ? "+" : "−"}${Math.abs(x.v)}</span>${x.txt}</li>`).join("")}</ul>
        <p class="muted small">Starts at 50% and each fact moves it up or down. It says how much this buy is likely to mean, not whether the stock will rise.</p>`;
      pop.hidden = false;
      const r = btn.getBoundingClientRect(), w = pop.offsetWidth, hh = pop.offsetHeight;
      let x = Math.min(innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2)), y = r.bottom + 8;
      if (y + hh > innerHeight - 8) y = Math.max(8, r.top - hh - 8);
      pop.style.left = `${x}px`; pop.style.top = `${y}px`;
    };
    const hide = () => { pop.hidden = true; pinned = null; };
    document.addEventListener("mouseover", (e) => { const b = e.target.closest && e.target.closest("[data-hype]"); if (b && !pinned) show(b); });
    document.addEventListener("mouseout", (e) => { const b = e.target.closest && e.target.closest("[data-hype]"); if (b && !pinned && !(e.relatedTarget && b.contains(e.relatedTarget))) pop.hidden = true; });
    document.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("[data-hype]");
      if (b) { e.preventDefault(); e.stopPropagation(); if (pinned === b) hide(); else { pinned = b; show(b); } return; }
      if (pinned && !pop.contains(e.target)) hide();
    }, true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(); });
    window.addEventListener("scroll", () => { if (!pop.hidden) hide(); }, { passive: true });
    window.addEventListener("hashchange", hide);
  })();

  // ---------- a sortable table with "show more" ----------
  function table(el, cols, rows, opts = {}) {
    let sortKey = opts.sort || null, dir = opts.dir || -1, shown = opts.page || 50;
    const draw = () => {
      const col = cols.find((c) => c.key === sortKey);
      const list = col && col.sort ? [...rows].sort((a, b) => { const x = col.sort(a), y = col.sort(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; }) : rows;
      el.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th class="${c.sort ? "sort " : ""}${c.cls || ""} ${c.hideSm ? "hide-sm" : ""}" data-k="${c.key}"${c.key === sortKey ? ` aria-sort="${dir > 0 ? "ascending" : "descending"}"` : ""}${c.title ? ` title="${esc(c.title)}"` : ""}>${c.label}</th>`).join("")}</tr></thead>
        <tbody>${list.slice(0, shown).map((r) => `<tr${opts.href ? ` class="click" data-href="${esc(opts.href(r))}"` : ""}>${cols.map((c) => `<td class="${c.cls || ""} ${c.hideSm ? "hide-sm" : ""}">${c.html(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
        ${list.length > shown ? `<div class="more"><button class="btn" type="button">Show more (${(list.length - shown).toLocaleString()} left)</button></div>` : ""}
        ${!list.length ? `<p class="muted">${opts.empty || "Nothing in this period."}</p>` : ""}`;
      $$("th.sort", el).forEach((th) => th.addEventListener("click", () => { if (sortKey === th.dataset.k) dir = -dir; else { sortKey = th.dataset.k; dir = -1; } draw(); }));
      const more = $(".more button", el); if (more) more.addEventListener("click", () => { shown += opts.step || 100; draw(); });
      if (opts.href) $$("tr.click", el).forEach((tr) => tr.addEventListener("click", (e) => { if (!e.target.closest("a")) location.hash = tr.dataset.href; }));
    };
    draw();
  }

  // ---------- small SVG charts ----------
  const svgBox = (W, H, inner, label = "") => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${inner}</svg>`;
  function barsSvg(items, { W = 600, H = 220, fmt = (v) => String(v), color = "var(--chart)" } = {}) {
    const L = 8, R = 8, T = 22, Bm = 34, mx = Math.max(1e-9, ...items.map((i) => i.value)), bw = (W - L - R) / items.length;
    return svgBox(W, H, items.map((it, k) => {
      const h = (H - T - Bm) * it.value / mx, x = L + k * bw + bw * 0.15, y = H - Bm - h;
      return `<g><title>${esc(it.title || `${it.label}: ${fmt(it.value)}`)}</title><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="4" fill="${it.color || color}"/>
        <text x="${(x + bw * 0.35).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="13" fill="var(--ink-2)" font-family="var(--font-mono)">${esc(fmt(it.value))}</text>
        <text x="${(x + bw * 0.35).toFixed(1)}" y="${H - 12}" text-anchor="middle" font-size="13" fill="var(--muted)">${esc(it.label)}</text></g>`;
    }).join(""));
  }
  function donutSvg(items, { size = 260, hole = 0.6 } = {}) {
    const tot = items.reduce((a, i) => a + i.value, 0) || 1, R = size / 2, r = R * hole;
    let a = -Math.PI / 2;
    return svgBox(size, size, items.map((it) => {
      const sw = Math.PI * 2 * it.value / tot, gap = items.length > 1 ? 0.012 : 0, a2 = a + Math.max(0.0005, sw - gap);
      const p = (ang, rad) => `${(R + rad * Math.cos(ang)).toFixed(2)},${(R + rad * Math.sin(ang)).toFixed(2)}`, big = sw - gap > Math.PI ? 1 : 0;
      const d = items.length === 1 ? `M${R},0A${R},${R} 0 1 1 ${R - 0.01},0ZM${R},${R - r}A${r},${r} 0 1 0 ${R + 0.01},${R - r}Z`
        : `M${p(a, R)}A${R},${R} 0 ${big} 1 ${p(a2, R)}L${p(a2, r)}A${r},${r} 0 ${big} 0 ${p(a, r)}Z`;
      a += sw;
      return `<path d="${d}" fill="${it.color}" fill-rule="evenodd"><title>${esc(it.label)}: ${esc(it.text || usd(it.value))}</title></path>`;
    }).join(""), "Breakdown");
  }
  // a line chart over the weekly dates; hover shows every line's value
  function weeklyChart(el, series, { first = 0, fmt = pct, zero = true } = {}) {
    const shown = series.filter((s) => s && s.values);
    if (!shown.length || first < 0) { el.innerHTML = `<p class="muted">Not enough buys to chart for this selection.</p>`; return; }
    const narrow = el.clientWidth < 620, W = narrow ? 520 : 1000, H = 320, L = 8, R = narrow ? 58 : 72, T = 14, Bm = 30;
    let lo = Infinity, hi = -Infinity;
    for (const s of shown) for (let i = first; i < NW; i++) { const v = s.values[i]; if (v != null && isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
    if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const pad = (hi - lo) * 0.08 || 0.05; lo -= pad; hi += pad;
    const X = (i) => L + (i - first) / Math.max(1, NW - 1 - first) * (W - L - R), Y = (v) => T + (hi - v) / (hi - lo) * (H - T - Bm);
    const path = (s) => { let d = "", on = false; for (let i = first; i < NW; i++) { const v = s.values[i]; if (v == null || !isFinite(v)) { on = false; continue; } d += `${on ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; on = true; } return d; };
    const ticks = [0, 1, 2, 3, 4].map((k) => lo + (hi - lo) * k / 4);
    const months = []; let lastM = ""; for (let i = first; i < NW; i++) { const mo = D.weeks[i].slice(0, 7); if (mo !== lastM) { if (lastM) months.push(i); lastM = mo; } }
    const every = Math.max(1, Math.ceil(months.length / (narrow ? 4 : 8)));
    const base = Y(Math.max(lo, Math.min(hi, 0)));
    el.innerHTML = `<div class="chart">${svgBox(W, H, `
      ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)"/><text x="${W - R + 8}" y="${(Y(v) + 4).toFixed(1)}" font-size="12" fill="var(--muted)" font-family="var(--font-mono)">${esc(fmt(v, 0))}</text>`).join("")}
      ${zero && lo < 0 && hi > 0 ? `<line x1="${L}" x2="${W - R}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="var(--ink-2)" stroke-opacity=".5"/>` : ""}
      ${months.filter((_, k) => k % every === 0).map((i) => `<text x="${X(i).toFixed(1)}" y="${H - 8}" font-size="12" fill="var(--muted)" text-anchor="middle">${fmtDate(D.weeks[i], { month: "short", year: "2-digit" })}</text>`).join("")}
      ${shown.filter((s) => s.area).map((s) => `<path d="${path(s)}L${X(NW - 1).toFixed(1)},${base.toFixed(1)}L${X(first).toFixed(1)},${base.toFixed(1)}Z" fill="${s.color}" fill-opacity=".1"/>`).join("")}
      ${shown.map((s) => `<path d="${path(s)}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} stroke-linejoin="round"/>`).join("")}
      <line class="cx" x1="0" x2="0" y1="${T}" y2="${H - Bm}" stroke="var(--ink-2)" stroke-dasharray="3 3" visibility="hidden"/>`, "Chart")}<div class="tip" hidden></div></div>`;
    const svg = $("svg", el), tip = $(".tip", el), cx = $(".cx", el);
    const move = (ev) => {
      const r = svg.getBoundingClientRect(), x = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / r.width * W;
      const i = Math.max(first, Math.min(NW - 1, Math.round(first + (x - L) / (W - L - R) * (NW - 1 - first))));
      cx.setAttribute("x1", X(i)); cx.setAttribute("x2", X(i)); cx.setAttribute("visibility", "visible");
      tip.innerHTML = `<div class="muted">Week of ${fmtDate(D.weeks[i])}</div>${shown.map((s) => `<div><i class="sw" style="background:${s.color}"></i> ${esc(s.short || s.label)} <b>${s.values[i] == null ? "–" : esc(fmt(s.values[i]))}</b></div>`).join("")}`;
      tip.hidden = false; const left = X(i) / W * r.width, tw = tip.offsetWidth;
      tip.style.left = `${Math.max(0, Math.min(r.width - tw, left + (left > r.width / 2 ? -tw - 14 : 14)))}px`; tip.style.top = "10px";
    };
    svg.addEventListener("mousemove", move); svg.addEventListener("touchstart", move, { passive: true }); svg.addEventListener("touchmove", move, { passive: true });
    svg.addEventListener("mouseleave", () => { tip.hidden = true; cx.setAttribute("visibility", "hidden"); });
  }

  // ---------- a hypothetical portfolio of buys (the classic site's chart) ----------
  function seriesFor(list, base) {
    const val = new Float64Array(NW), spy = new Float64Array(NW), inv = new Float64Array(NW), started = new Int32Array(NW);
    let any = false;
    for (const t of list) {
      const b = t[base], px = SERIES[t.t];
      if (t.side !== "B" || !px || b.ew == null || !b.ep || !b.se || b.r == null) continue;
      any = true; started[b.ew]++;
      const end = b.xw == null ? NW : b.xw; let last = b.ep;
      for (let w = b.ew; w < NW; w++) {
        inv[w] += t.amt;
        if (w < end) {
          if (px[w] != null) last = px[w];
          const move = last / b.ep - 1;
          val[w] += t.amt * Math.max(0, 1 + (t.opt === "P" ? -move : move)); spy[w] += t.amt * (D.spy[w] ?? b.se) / b.se;
        } else { val[w] += t.amt * Math.max(0, 1 + eff(t, b.r)); spy[w] += t.amt * (1 + b.sr); }
      }
    }
    if (!any) return null;
    let peak = 0; for (const v of inv) peak = Math.max(peak, v);
    let n = 0, first = -1;
    for (let w = 0; w < NW && first < 0; w++) { n += started[w]; if (inv[w] > 0 && n >= 5 && inv[w] >= peak * 0.01) first = w; }
    return { ret: Array.from(val, (v, w) => inv[w] ? v / inv[w] - 1 : null), spyRet: Array.from(spy, (v, w) => inv[w] ? v / inv[w] - 1 : null), first };
  }

  // ---------- copy-trading score: who is worth copying (the classic site's ranking) ----------
  function followScores(from) {
    const by = new Map();
    for (const t of trades) {
      const m = members[t.m];
      if (t.side !== "B" || !stocks[t.t] || t.P.r == null || t.P.sr == null || (t.ftime || t.time) < from) continue;
      if (t.cls === "option" && !S.options) continue;
      if (S.chamber === "all" ? isBiz(m) : m.chamber !== S.chamber) continue;
      if (S.owner !== "all" && !ownUnknown(t) && (t.own || "self") !== S.owner) continue;
      if (!by.has(t.m)) by.set(t.m, []); by.get(t.m).push(t);
    }
    const out = [];
    for (const [mi, list] of by) {
      const s = stats(list, "P"); if (s.n < 5) continue;
      const delays = list.filter((t) => t.delay != null && t.delay >= 0).map((t) => t.delay).sort((a, b) => a - b);
      const median = delays.length ? delays[Math.floor(delays.length / 2)] : 60, shrunk = s.diff * s.n / (s.n + 10);
      const parts = { edge: 20 + 20 * Math.max(-1, Math.min(1, shrunk / 0.2)), hit: 25 * s.win, speed: 15 * Math.max(0, Math.min(1, (60 - median) / 60)), record: 20 * Math.min(1, Math.log10(s.n + 1) / 2) };
      out.push({ m: members[mi], s, median, parts, score: parts.edge + parts.hit + parts.speed + parts.record });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  // ---------- search ----------
  const traded = new Map(); for (const t of trades) if (t.t && stocks[t.t]) traded.set(t.t, (traded.get(t.t) || 0) + 1);
  const tradeCount = new Map(); for (const t of trades) tradeCount.set(t.m, (tradeCount.get(t.m) || 0) + 1);
  const INDEX = [
    ...members.filter((m) => tradeCount.get(m.i)).map((m) => ({ kind: "Politician", label: m.name, sub: seat(m), key: m.name.toLowerCase(), href: `#/member/${encodeURIComponent(m.id)}`, m, w: tradeCount.get(m.i) })),
    ...[...traded.keys()].map((tk) => ({ kind: "Stock", label: `${tk} · ${cleanName(stocks[tk][0])}`, key: (tk + " " + stocks[tk][0]).toLowerCase(), tk, href: `#/stock/${encodeURIComponent(tk)}`, w: traded.get(tk) })),
  ];
  function bindSearch() {
    const box = $("#q"), ul = $("#qList"); let items = [], at = -1;
    const close = () => { ul.hidden = true; box.setAttribute("aria-expanded", "false"); at = -1; };
    const show = () => {
      const q = box.value.trim().toLowerCase(); if (!q) { close(); return; }
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
    document.addEventListener("keydown", (e) => { if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); box.focus(); } });
  }

  const app = $("#app");
  const setNav = (k) => $$(".nav a[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === k));
  const card = (title, sub, body, extra = "") => `<div class="card ${extra}"><h2>${title}${sub ? ` <span class="muted">${sub}</span>` : ""}</h2>${body}</div>`;
  const statCard = (lbl, big, sub, c = "") => `<div class="card stat"><div class="lbl">${lbl}</div><div class="big ${c}">${big}</div><div class="sub">${sub}</div></div>`;

  // ---------- Democrats vs Republicans (home page and stock pages) ----------
  function topStocks(list, n) {
    const by = new Map(); for (const t of list) if (t.t && stocks[t.t]) { const g = by.get(t.t) || { tk: t.t, v: 0 }; g.v += t.amt; by.set(t.t, g); }
    return [...by.values()].sort((a, b) => b.v - a.v).slice(0, n).map((g) => `<div class="mini-row">${tkLink(g.tk)} <span class="ell">${esc(cleanName(stocks[g.tk][0]))}</span><span class="mono muted">${usd(g.v)}</span></div>`).join("") || `<p class="muted small">No buys.</p>`;
  }
  function partiesHtml(list, base, { showTop = false } = {}) {
    const side = (p) => {
      const L = list.filter((t) => members[t.m].party === p), b = L.filter((t) => t.side === "B"), s = L.filter((t) => t.side === "S");
      return { b, s, eb: est(b).best, es: est(s).best, st: stats(b, base), who: new Set(L.map((t) => t.m)).size };
    };
    const Dm = side("D"), Rp = side("R"), mx = Math.max(Dm.eb, Dm.es, Rp.eb, Rp.es, 1);
    const bar = (v, c) => `<div class="hbar"><i style="width:${(v / mx * 100).toFixed(1)}%;background:${c}"></i><span>${usd(v)}</span></div>`;
    const col = (g, name, p) => `<div class="pcol ${p}"><div class="pname">${name}</div><div class="muted small">${g.who} people · ${g.b.length} buys · ${g.s.length} sales</div>
      <div class="prow"><span>Bought</span>${bar(g.eb, "var(--good)")}</div><div class="prow"><span>Sold</span>${bar(g.es, "var(--bad)")}</div>
      <div class="pret"><div><span class="muted small">Their buys returned</span><b class="${cls(g.st.ret)}">${pct(g.st.ret)}</b></div><div><span class="muted small">S&amp;P 500, same days</span><b>${pct(g.st.spyRet)}</b></div><div><span class="muted small">Ahead of the S&amp;P 500</span><b class="${cls(g.st.diff)}">${pct(g.st.diff)}</b></div></div>
      ${showTop ? `<div class="ptop"><div class="muted small">Most bought</div>${topStocks(g.b, 5)}</div>` : ""}</div>`;
    let verdict = "";
    if (Dm.st.n && Rp.st.n) { const w = Dm.st.diff >= Rp.st.diff ? ["Democrats", Dm, Rp, "Republicans"] : ["Republicans", Rp, Dm, "Democrats"]; verdict = `${w[0]}' buys did better: ${pct(w[1].st.diff)} against the S&amp;P 500, versus ${pct(w[2].st.diff)} for ${w[3]}.`; }
    return `<div class="card"><h2>Democrats vs Republicans <span class="muted">${periodWords()}</span></h2>${verdict ? `<p class="verdict">${verdict}</p>` : ""}<div class="parties">${col(Dm, "Democrats", "D")}${col(Rp, "Republicans", "R")}</div></div>`;
  }

  // ---------- buying spikes (home page) ----------
  function spikesHtml(fromTime) {
    const by = new Map();
    for (const t of trades) {
      if (!t.spike || t.time < fromTime || isBiz(members[t.m])) continue;
      const g = by.get(t.t) || { tk: t.t, last: t, buys: [] }; g.buys.push(t); if (t.time > g.last.time) g.last = t; by.set(t.t, g);
    }
    const rows = [...by.values()].map((g) => ({ ...g, ms: [...new Set(g.buys.map((t) => t.m))], e: est(g.buys).best })).sort((a, b) => b.last.time - a.last.time).slice(0, 8);
    if (!rows.length) return `<p class="muted">No buying spikes ${periodWords()}.</p>`;
    return `<div class="spikes">${rows.map((g) => {
      const s = SERIES[g.tk], w = weekOf(g.last.d), i0 = Math.max(0, w - 20), i1 = Math.min(NW - 1, w + 20), pts = [];
      if (s) for (let i = i0; i <= i1; i++) if (s[i] != null) pts.push([i, s[i]]);
      let spark = "";
      if (pts.length > 2) {
        const lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1])), X = (i) => (i - i0) / Math.max(1, i1 - i0) * 300, Y = (v) => 70 - (v - lo) / Math.max(1e-9, hi - lo) * 64;
        spark = svgBox(300, 74, `<rect x="${X(w - 2).toFixed(1)}" y="0" width="${(X(w + 2) - X(w - 2)).toFixed(1)}" height="74" fill="var(--good)" fill-opacity=".14"/><path d="${pts.map((p, k) => `${k ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("")}" fill="none" stroke="var(--chart)" stroke-width="2"/>`, `${g.tk} price around the spike`);
      }
      const now = lastPrice(g.tk), pb = g.buys.filter((t) => t.ep), avg = pb.length ? pb.reduce((a, t) => a + t.amt, 0) / pb.reduce((a, t) => a + t.amt / t.ep, 0) : null;
      return `<a class="spike card" href="#/stock/${encodeURIComponent(g.tk)}"><div class="spike-head">${logoBox(g.tk, "var(--chart)", 28)} <b class="ell">${esc(g.tk)} · ${esc(cleanName(stocks[g.tk][0]))}</b></div>
        <div class="muted small">${g.ms.length} members within a month · ${fmtDate(g.last.d, { month: "short", year: "numeric" })} · usually ${g.last.spike.usual < 1 ? "under 1" : g.last.spike.usual.toFixed(1)} a month</div>${spark}
        <div class="spike-foot"><span class="faces">${g.ms.slice(0, 5).map((mi) => `<span class="who ${esc(members[mi].party || "I")}">${photo(members[mi])}</span>`).join("")}</span>
        <span class="mono small">${usd(g.e)}${avg && now ? ` · <span class="${cls(now / avg - 1)}">${pct(now / avg - 1)}</span>` : ""}</span></div></a>`;
    }).join("")}</div>`;
  }

  // =============================== pages ===============================
  function pageHome() {
    setNav("home");
    const s0 = since(), win = trades.filter((t) => t.time >= s0 && t.side !== "O" && pass(t));
    const buys = win.filter((t) => t.side === "B" && securities(t)), sells = win.filter((t) => t.side === "S" && securities(t));
    const lastFiled = trades.reduce((mx, t) => t.fd && t.fd > mx ? t.fd : mx, "");
    app.innerHTML = `
      <h1>What Congress is trading</h1>
      <p class="lede">Stock and bond trades by members of Congress and senior officials, from their public disclosure reports. Filings up to <b>${fmtDate(lastFiled)}</b>; prices to ${fmtDate(D.prices_through)}.</p>
      <div class="toolbar">${periodSeg()}</div>
      <div id="moveBanner"></div>
      <div class="grid cols-4">
        ${statCard("Trades", win.length.toLocaleString(), periodWords())}
        ${statCard("People trading", new Set(win.map((t) => t.m)).size, "members and officials")}
        ${statCard("Stocks bought", usd(est(buys).best), `likely ${span(est(buys))}`, "up")}
        ${statCard("Stocks sold", usd(est(sells).best), `likely ${span(est(sells))}`, "down")}
      </div>
      <div class="section">${card("Buying spikes", "several members buying the same stock within a month, far more than usual", spikesHtml(s0))}</div>
      <div class="section">${partiesHtml(win.filter(securities), B(), { showTop: true })}</div>
      <div class="grid cols-2 section">
        ${card("Most bought stocks", "by number of buyers", `<div id="topStocks" class="bars"></div>`)}
        ${card("Most active", "by dollars traded", `<div id="topPeople"></div>`)}
      </div>
      <div class="section">${card("Hype check", "how much recent buys really mean", `<p class="small muted">A politician buying a stock gets shared online as a tip, but many are tiny buys in a basket of twenty, placed by an account manager, or sold again weeks later. Every buy gets a signal strength out of 100%, built from about fifteen public facts: its size against their usual trade, whether it was bought alone or in a basket, whether they kept adding or sold soon after, other members buying, their committee, the company's size and its insiders, the price run before the buy, how late it was filed and their track record. Hover or tap a signal to see every reason.</p>
        <div class="toolbar"><div class="seg" role="group" aria-label="Which buys"><button type="button" data-hy="weak" aria-pressed="true">Weakest (most overhyped)</button><button type="button" data-hy="strong" aria-pressed="false">Strongest</button></div><span class="count">buys disclosed in the last 45 days</span></div><div id="hype"></div>`)}</div>
      <div class="card section"><h2>Latest disclosures <span class="muted">newest filings first</span></h2><div id="latest"></div></div>`;
    bindPeriod(app);
    loadMoves().then((M) => {
      const e = M && M.episodes[0]; if (!e || today - Date.parse(e.end + "T00:00:00Z") > 21 * DAY || !$("#moveBanner")) return;
      $("#moveBanner").innerHTML = `<a class="banner" href="#/drops"><b>Market drop ${fmtDate(e.start, { day: "numeric", month: "short" })}${e.end !== e.start ? `–${fmtDate(e.end, { day: "numeric", month: "short" })}` : ""}:</b> S&amp;P 500 ${pct(e.spy)}, Nasdaq 100 ${pct(e.qqq)}. ${e.what[0] ? esc(e.what[0].title) : ""} <span>Why it happened →</span></a>`;
    });
    const byT = new Map();
    for (const t of buys) { if (!t.t || !stocks[t.t]) continue; const g = byT.get(t.t) || { tk: t.t, ms: new Set(), list: [] }; g.ms.add(t.m); g.list.push(t); byT.set(t.t, g); }
    const topS = [...byT.values()].sort((a, b) => b.ms.size - a.ms.size || est(b.list).best - est(a.list).best).slice(0, 10), maxS = topS[0] ? topS[0].ms.size : 1;
    $("#topStocks").innerHTML = topS.map((g) => `<div class="bar-row"><span class="ell">${tkLink(g.tk)} ${esc(cleanName(stocks[g.tk][0]))}</span><span class="muted mono">${g.ms.size} buyers · ${usd(est(g.list).best)}</span><div class="track"><div class="fill" style="width:${(g.ms.size / maxS * 100).toFixed(1)}%"></div></div></div>`).join("") || `<p class="muted">No buys in this period.</p>`;
    const byM = new Map();
    for (const t of win) { const g = byM.get(t.m) || { m: members[t.m], b: [], s: [] }; (t.side === "B" ? g.b : g.s).push(t); byM.set(t.m, g); }
    table($("#topPeople"), [
      { key: "who", label: "Person", html: (g) => who(g.m) },
      { key: "b", label: "Bought", cls: "r", html: (g) => `<span class="up">${g.b.length ? usd(est(g.b).best) : "–"}</span>`, sort: (g) => est(g.b).best },
      { key: "s", label: "Sold", cls: "r", html: (g) => `<span class="down">${g.s.length ? usd(est(g.s).best) : "–"}</span>`, sort: (g) => est(g.s).best },
    ], [...byM.values()].map((g) => ({ ...g, vol: est(g.b).best + est(g.s).best })).sort((a, b) => b.vol - a.vol).slice(0, 8), { page: 8 });
    const recent = trades.filter((t) => t.side === "B" && t.fd && t.t && stocks[t.t] && !isBiz(members[t.m]) && today - t.ftime < 45 * DAY).map((t) => ({ t, h: hype(t) })).filter((x) => x.h);
    const drawHype = (mode) => table($("#hype"), [
      { key: "who", label: "Person", html: (x) => who(members[x.t.m]) },
      { key: "t", label: "Stock", html: (x) => `${tkLink(x.t.t)} <span class="hide-sm">${esc(stockName(x.t))}</span>` },
      { key: "amt", label: "Amount", cls: "r", html: (x) => rangeText(x.t), sort: (x) => x.t.amt },
      { key: "h", label: "Signal", html: (x) => hypeTag(x.t), sort: (x) => x.h.score },
      { key: "why", label: "Main reasons", cls: "hide-sm", hideSm: true, html: (x) => `<div class="whys">${hypeReasons(x.h)}</div>` },
    ], recent.filter((x) => mode === "weak" ? x.h.level === 1 : x.h.level === 3).sort((a, b) => mode === "weak" ? a.h.score - b.h.score : b.h.score - a.h.score),
    { page: 8, step: 8, empty: `No ${mode === "weak" ? "weak" : "strong"}-signal buys disclosed in the last 45 days.` });
    drawHype("weak");
    $$("[data-hy]").forEach((b) => b.addEventListener("click", () => { $$("[data-hy]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); drawHype(b.dataset.hy); }));
    const latest = trades.filter((t) => t.fd && t.side !== "O" && pass(t)).sort((a, b) => b.ftime - a.ftime || b.amt - a.amt).slice(0, 400);
    table($("#latest"), [
      { key: "fd", label: "Filed", cls: "num", html: (t) => fmtDate(t.fd, { day: "numeric", month: "short" }), sort: (t) => t.ftime },
      { key: "who", label: "Person", html: (t) => who(members[t.m]) },
      { key: "side", label: "", html: (t) => `<span class="pill ${t.side}">${t.side === "B" ? "Buy" : "Sell"}</span>` },
      { key: "t", label: "Stock", html: (t) => `${tkLink(t.t)} <span class="hide-sm">${esc(stockName(t))}</span>${t.spike ? ` <span class="sig s3" title="${t.spike.k} members bought it within a month">Spike</span>` : ""}` },
      { key: "amt", label: "Amount", cls: "r", html: (t) => rangeText(t), sort: (t) => t.amt },
      { key: "h", label: "Signal", cls: "hide-sm", hideSm: true, html: (t) => hypeTag(t) },
      { key: "left", label: "Still holds", cls: "r hide-sm", hideSm: true, html: (t) => t.t && stocks[t.t] ? leftText(leftOf(t.m, t.t)) : "–" },
    ], latest, { page: 10, step: 10 });
  }

  function pagePoliticians() {
    setNav("politicians");
    const s0 = since(), g = new Map();
    for (const t of trades) {
      if (t.time < s0 || t.side === "O" || !pass(t, { person: false })) continue;
      const e = g.get(t.m) || { m: members[t.m], b: [], s: [], last: 0 }; (t.side === "B" ? e.b : e.s).push(t); e.last = Math.max(e.last, t.time); g.set(t.m, e);
    }
    const rows = [...g.values()].map((e) => ({ ...e, eb: est(e.b).best, es: est(e.s).best, n: e.b.length + e.s.length, st: stats(e.b, B()) }));
    app.innerHTML = `<h1>Politicians</h1><p class="lede">Everyone with disclosed trades ${periodWords()}. Click a column to sort, a row to open their page.</p>
      <div class="toolbar">${periodSeg()}<div class="seg" role="group" aria-label="Who"><button type="button" data-ch="all">All</button><button type="button" data-ch="H">House</button><button type="button" data-ch="S">Senate</button><button type="button" data-ch="E">Officials</button><button type="button" data-ch="C">Business</button></div>
      <input type="search" id="filt" placeholder="Filter by name or state"><span class="count" id="cnt"></span></div><div class="card" id="tbl"></div>`;
    bindPeriod(app);
    let ch = S.chamber, q = "";
    $$("[data-ch]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.ch === ch)));
    const draw = () => {
      const list = rows.filter((e) => (ch === "all" ? !isBiz(e.m) : e.m.chamber === ch) && (S.committee === "all" || (e.m.committees || []).includes(S.committee)) && (!q || (e.m.name + " " + (e.m.state || "") + " " + (e.m.role || "")).toLowerCase().includes(q)));
      $("#cnt").textContent = `${list.length} people`;
      table($("#tbl"), [
        { key: "who", label: "Person", html: (e) => who(e.m), sort: (e) => e.m.last || e.m.name },
        { key: "n", label: "Trades", cls: "r", html: (e) => e.n.toLocaleString(), sort: (e) => e.n },
        { key: "eb", label: "Bought", cls: "r", html: (e) => `<span class="up">${e.b.length ? usd(e.eb) : "–"}</span>`, sort: (e) => e.eb },
        { key: "es", label: "Sold", cls: "r", html: (e) => `<span class="down">${e.s.length ? usd(e.es) : "–"}</span>`, sort: (e) => e.es },
        { key: "diff", label: "vs S&amp;P 500", cls: "r hide-sm", hideSm: true, title: "Their buys' return minus the S&P 500's over the same days", html: (e) => e.st.n ? `<span class="${cls(e.st.diff)}">${pct(e.st.diff)}</span>` : "–", sort: (e) => e.st.diff ?? -9 },
        { key: "last", label: "Last trade", cls: "num hide-sm", hideSm: true, html: (e) => fmtDate(isoOf(e.last)), sort: (e) => e.last },
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
      if (t.time < s0 || t.side === "O" || !t.t || !stocks[t.t] || !pass(t)) continue;
      const e = g.get(t.t) || { tk: t.t, b: [], s: [], buyers: new Set(), last: 0 };
      if (t.side === "B") { e.b.push(t); e.buyers.add(t.m); } else e.s.push(t);
      e.last = Math.max(e.last, t.time); g.set(t.t, e);
    }
    const holders = new Map(); for (const t of trades) if (t.t) { if (!holders.has(t.t)) holders.set(t.t, new Set()); holders.get(t.t).add(t.m); }
    const held = new Map(), H = (tk) => { if (!held.has(tk)) { let v = 0, n = 0; for (const mi of holders.get(tk) || []) { const L = leftOf(mi, tk); if (L && L.value >= 1000) { v += L.value; n++; } } held.set(tk, { v, n }); } return held.get(tk); };
    const rows = [...g.values()].map((e) => ({ ...e, eb: est(e.b).best, es: est(e.s).best }));
    app.innerHTML = `<h1>Stocks</h1><p class="lede">Every stock members and officials traded ${periodWords()}. "Still held" adds up what each of them still holds, from all their filings.</p>
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
        { key: "held", label: "Still held", cls: "r hide-sm", hideSm: true, title: "Estimated value members and officials still hold, from all their filings", html: (e) => { const h = H(e.tk); return h.v ? `≈${usd(h.v)} <span class="muted small">· ${h.n}</span>` : "–"; }, sort: (e) => H(e.tk).v },
      ], list, { sort: "buyers", href: (e) => `#/stock/${encodeURIComponent(e.tk)}` });
    };
    $("#filt").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
  }

  // ---------- a politician's page ----------
  let memberLocal = null;  // the page's own filter (starts from the site's Filter, changes nothing else)
  function pageMember(id) {
    setNav("politicians");
    const m = members.find((x) => x.id === id);
    if (!m) { app.innerHTML = `<h1>Not found</h1><p>No politician with that link. <a href="#/politicians">See everyone</a>.</p>`; return; }
    if (!memberLocal || memberLocal.id !== id) memberLocal = { id, f: { ...S } };
    const f = memberLocal.f, base = f.timing === "public" ? "P" : "T";
    const s0 = since(), allMine = trades.filter((t) => t.m === m.i && t.side !== "O");
    const mine = allMine.filter((t) => t.time >= s0 && pass(t, { person: false }, f));
    const buys = mine.filter((t) => t.side === "B"), sells = mine.filter((t) => t.side === "S");
    const sb = buys.filter(securities), st = stats(sb, base);
    const comm = (m.committees || []).map((c) => D.committees[c] && D.committees[c].name).filter(Boolean);
    const loc = (k, label, title) => `<label class="lchk" title="${esc(title)}"><input type="checkbox" data-lf="${k}"${f[k] ? " checked" : ""}> ${label}</label>`;
    app.innerHTML = `<div class="crumbs"><a href="#/politicians">Politicians</a></div>
      <div class="profile ${esc(m.party || "I")}">${photo(m)}
        <div><h1>${esc(m.name)}</h1><div class="muted">${partyTag(m)} ${esc(seat(m))}${m.former ? " · former" : ""}</div>
        <div class="tags">${comm.slice(0, 6).map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div></div></div>
      <div class="toolbar">${periodSeg()}</div>
      <div class="localf"><span class="lbl">This page's filter</span>
        ${loc("hideBig", "Exclude large caps and funds", "S&P 500 companies, funds and ETFs")}${loc("committeeOnly", "Committee-linked only", "Trades in sectors their committees oversee")}${loc("lateOnly", "Late disclosures only", "Filed after 45 days")}${loc("options", "Include options", "Valued at the underlying share price")}
        <div class="seg" data-lt><button type="button" data-v="trade" aria-pressed="${f.timing !== "public"}">Trade date</button><button type="button" data-v="public" aria-pressed="${f.timing === "public"}">Disclosure date</button></div>
        <button type="button" class="linkbtn" data-lreset>Use the site's Filter</button></div>
      <div class="grid cols-4">
        ${statCard("Trades", mine.length.toLocaleString(), `${buys.length.toLocaleString()} buys · ${sells.length.toLocaleString()} sales`)}
        ${statCard("Bought", buys.length ? usd(est(buys).best) : "–", buys.length ? `likely ${span(est(buys))}` : periodWords(), "up")}
        ${statCard("Sold", sells.length ? usd(est(sells).best) : "–", sells.length ? `likely ${span(est(sells))}` : periodWords(), "down")}
        ${statCard("Their buys vs S&amp;P 500", st.n ? pct(st.diff) : "–", st.n ? `${pct(st.ret)} vs ${pct(st.spyRet)} · beat it on ${Math.round(st.win * 100)}% of buys` : "no priced buys", cls(st.diff))}
      </div>
      <div class="section card"><h2>Hypothetical portfolio of their buys <span class="muted">return on the money put in, from the ${f.timing === "public" ? "disclosure" : "trade"} date</span></h2>
        <div class="lines" id="lines"></div><div id="portfolio"></div>
        <p class="small muted">Each buy enters at its best-estimate amount and leaves when they report a full sale of the stock; otherwise it is valued at the latest close. "S&amp;P 500" puts the same dollars in an S&amp;P 500 fund on the same days.</p></div>
      <div class="grid cols-2 section">
        ${card("Scorecard", "their buys against the S&amp;P 500", `<div id="score"></div>`)}
        ${card("Factsheet", "", `<div id="facts"></div>`)}
      </div>
      <div class="section">${card(`${esc(m.name)}'s biggest buys`, `the 15 largest ${periodWords()}, what they sold and what they still hold`, `<div id="ring" class="ring2"></div>`)}</div>
      <div class="grid cols-3 section">
        ${card("How fast they report", "days from trade to disclosure", `<div id="delays"></div>`)}
        ${card("Committee overlap", periodWords(), `<div id="overlap"></div>`)}
        ${card("Sectors bought", periodWords(), `<div id="sectors" class="bars"></div>`)}
      </div>
      <div class="section">${card("Bonds and debt", periodWords(), `<div id="bonds"><p class="loading">Loading…</p></div>`)}</div>
      <div class="card section"><h2>All trades</h2>
        <div class="toolbar"><div class="seg" role="group" aria-label="Buys or sales"><button type="button" data-side="all" aria-pressed="true">All</button><button type="button" data-side="B">Buys</button><button type="button" data-side="S">Sales</button></div>
        <input type="search" id="filt" placeholder="Filter by ticker or company"><span class="count" id="cnt"></span></div><div id="tbl"></div></div>`;
    bindPeriod(app);
    $$("[data-lf]").forEach((c) => c.addEventListener("change", () => { f[c.dataset.lf] = c.checked; route(true); }));
    $$("[data-lt] button").forEach((b) => b.addEventListener("click", () => { f.timing = b.dataset.v; route(true); }));
    $("[data-lreset]").addEventListener("click", () => { memberLocal = null; route(true); });

    // portfolio: filtered buys, S&P 500, every buy, large caps only
    const everyB = allMine.filter((t) => t.time >= s0 && securities(t) && pass(t, { person: false }, { ...f, hideBig: false, committeeOnly: false, lateOnly: false }));
    const kept = seriesFor(sb, base);
    const lines = [
      { k: "kept", label: "Filtered buys", color: "var(--chart)", width: 2.6, area: true, s: kept, v: "ret" },
      { k: "spy", label: "Same amounts in S&P 500", short: "S&P 500", color: "#eb6834", dash: "6 5", s: kept, v: "spyRet" },
      { k: "every", label: "All stock buys, no filters", short: "All buys", color: "#1baf7a", s: seriesFor(everyB, base), v: "ret" },
      { k: "big", label: "Large caps and funds only", short: "Large caps", color: "#e87ba4", s: seriesFor(everyB.filter((t) => isBig(t, f)), base), v: "ret" },
    ];
    const hidden = new Set();
    const drawP = () => {
      const on = lines.filter((l) => l.s && !hidden.has(l.k)), firsts = on.map((l) => l.s.first).filter((x) => x >= 0), first = firsts.length ? Math.min(...firsts) : -1;
      weeklyChart($("#portfolio"), on.map((l) => ({ ...l, values: l.s[l.v].map((v, w) => w < l.s.first && w >= first ? 0 : v) })), { first });
    };
    $("#lines").innerHTML = lines.map((l) => `<label class="lchk"><input type="checkbox" data-line="${l.k}" ${l.s ? "checked" : "disabled"}> <i class="sw" style="background:${l.color}"></i>${l.label}</label>`).join("");
    $$("[data-line]").forEach((c) => c.addEventListener("change", () => { if (c.checked) hidden.delete(c.dataset.line); else hidden.add(c.dataset.line); drawP(); }));
    drawP();

    // scorecard
    const per = [["3 months", 91], ["6 months", 182], ["1 year", 365], [`Since ${D.start.slice(0, 4)}`, null]].map(([l, d]) => {
      const b = allMine.filter((t) => t.side === "B" && securities(t) && pass(t, { person: false }, f) && (d == null || t.time >= today - d * DAY));
      return { l, n: b.length, T: stats(b, "T"), P: stats(b, "P") };
    });
    const row = (label, fn, c) => `<tr><td>${label}</td>${per.map((p) => `<td class="r ${c ? c(p) : ""}">${fn(p)}</td>`).join("")}</tr>`;
    $("#score").innerHTML = `<div class="tbl-wrap"><table class="tbl score"><thead><tr><th></th>${per.map((p) => `<th class="r">${p.l}</th>`).join("")}</tr></thead><tbody>
      <tr class="grp"><td colspan="5">From the trade date</td></tr>
      ${row("Their buys", (p) => p.T.n ? pct(p.T.ret) : "–", (p) => cls(p.T.ret))}${row("S&amp;P 500, same days", (p) => p.T.n ? pct(p.T.spyRet) : "–")}${row("<b>Difference</b>", (p) => p.T.n ? `<b>${pct(p.T.diff)}</b>` : "–", (p) => cls(p.T.diff))}
      <tr class="grp"><td colspan="5">From the disclosure date (copying the filing)</td></tr>
      ${row("Their buys", (p) => p.P.n ? pct(p.P.ret) : "–", (p) => cls(p.P.ret))}${row("S&amp;P 500, same days", (p) => p.P.n ? pct(p.P.spyRet) : "–")}${row("<b>Difference</b>", (p) => p.P.n ? `<b>${pct(p.P.diff)}</b>` : "–", (p) => cls(p.P.diff))}
      ${row("Buys counted", (p) => p.n.toLocaleString())}${row("Beat the S&amp;P 500", (p) => p.T.n ? `${Math.round(p.T.win * 100)}%` : "–")}</tbody></table></div>`;

    // factsheet
    const delaysAll = allMine.filter((t) => t.delay != null && t.delay >= 0).map((t) => t.delay).sort((a, b) => a - b);
    const own = new Map(); for (const t of mine) if (!ownUnknown(t)) own.set(t.own || "self", (own.get(t.own || "self") || 0) + t.amt);
    const ownTop = [...own.entries()].sort((a, b) => b[1] - a[1])[0], vol = mine.reduce((a, t) => a + t.amt, 0) || 1;
    const fact = (l, v) => `<div class="fact"><span class="muted">${l}</span><b>${v}</b></div>`;
    $("#facts").innerHTML = [
      fact(isExec(m) ? "Department" : "Committees", comm.length ? esc(comm.join(", ")) : isExec(m) ? esc(m.agency || "–") : "None listed"),
      fact(`Trades since ${fmtDate(D.start, { month: "short", year: "numeric" })}`, allMine.length.toLocaleString()),
      fact("Dollars traded in the period", mine.length ? span(est(mine)) : "–"),
      fact("Median days to report", delaysAll.length ? delaysAll[Math.floor(delaysAll.length / 2)] : "–"),
      fact("Reported after 45 days", `${delaysAll.filter((d) => d > 45).length.toLocaleString()} of ${delaysAll.length.toLocaleString()}`),
      fact("Main account", ownTop ? `${{ self: "Own", SP: "Spouse", DC: "Child", JT: "Joint" }[ownTop[0]] || ownTop[0]} · ${Math.round(ownTop[1] / vol * 100)}%` : "–"),
      fact("Usual trade size", usualSize.get(m.i) ? usd(usualSize.get(m.i)) : "–"),
    ].join("");

    // biggest buys: a ring with the person's photo, each slice labelled with a card (logo, amount, sold, still held)
    const byH = new Map(), withSt = (t) => ({ ...t, st: stocks[t.t] });
    for (const t of buys) { const k = holdingKey(t); if (!k) continue; const g = byH.get(k) || { k, t, b: [], s: 0 }; g.b.push(t); byH.set(k, g); }
    for (const t of sells) { const k = holdingKey(t); if (byH.has(k)) { byH.get(k).s += t.amt; (byH.get(k).sl ||= []).push(t); } }
    const allH = [...byH.values()].map((g) => ({ ...g, v: est(g.b).best, info: holdingInfo(withSt(g.t)) })).sort((a, b) => b.v - a.v), top = allH.slice(0, 15);
    let pi = 0;
    for (const g of top) { g.brand = brandOf(g.t); g.col = g.brand ? g.brand[0] : HOLD_PALETTE[pi++ % HOLD_PALETTE.length]; g.soft = mixHex(g.col, "#6b7584", 0.3); }
    const ringEl = $("#ring");
    if (!top.length) ringEl.innerHTML = `<p class="muted">No buys ${periodWords()}.</p>`;
    else {
      const items = top.map((g) => {
        const tk = g.t.t && stocks[g.t.t] ? g.t.t : "", L = tk ? leftOf(m.i, tk) : null;
        const pb = g.b.filter((t) => t.ep && t.amt), avg = pb.length ? pb.reduce((a, t) => a + t.amt, 0) / pb.reduce((a, t) => a + t.amt / t.ep, 0) : null, now = tk ? lastPrice(tk) : null;
        return { tk, col: g.col, soft: g.soft, brand: g.brand, badge: g.info.badge, v: g.v, sold: g.s, nb: g.b.length, ns: (g.sl || []).length, avg, chg: avg && now ? now / avg - 1 : null,
          name: g.info.name, href: tk ? `#/stock/${encodeURIComponent(tk)}` : "",
          held: !tk ? "" : L == null ? "unknown" : L.value < 1000 ? "sold out" : `≈${usd(L.value)}` };
      });
      drawRing(ringEl, items, m);
      const eb = est(buys), es = est(sells), net = eb.best - es.best, kinds = { stock: 0, fund: 0, bond: 0 };
      for (const g of allH) kinds[g.info.kind] += g.v;
      const share = (v) => Math.round(v / (eb.best || 1) * 100) + "%", likely = (e) => e.exact ? usd(e.best) : `${usd(e.lo)}–${usd(e.hi)}`, shown = top.reduce((a, g) => a + g.v, 0);
      const third = kinds.bond / (eb.best || 1) >= 0.1 ? ["bond", usd(kinds.bond), "Went into bonds and notes", `Bonds and bank notes took ${share(kinds.bond)} of the buying; stocks ${share(kinds.stock)}, funds ${share(kinds.fund)}.`]
        : kinds.fund / (eb.best || 1) >= 0.1 ? ["up", usd(kinds.fund), "Went into funds and ETFs", `Funds and ETFs took ${share(kinds.fund)} of the buying; single stocks ${share(kinds.stock)}.`]
        : ["up", share(shown), `In these ${top.length}`, `Of all the buying ${periodWords()}, ${share(shown)} went into the ${top.length === 1 ? "holding" : `${top.length} holdings`} shown.`];
      const facts = [
        ["bought", usd(eb.best), "Bought", `Best estimate from ${buys.length.toLocaleString()} buy${buys.length === 1 ? "" : "s"}${eb.exact ? "" : `, likely ${likely(eb)}`}. The filings' ranges alone allow ${usd(eb.min)}–${usd(eb.max)}.`],
        ["sold", usd(es.best), "Sold in the same period", sells.length ? `${sells.length.toLocaleString()} sale${sells.length === 1 ? "" : "s"}${es.exact ? "" : `, likely ${likely(es)}`}. Net, about ${usd(Math.abs(net))} more ${net >= 0 ? "went in than came out" : "came out than went in"}.` : "No sales in this period."],
        third,
      ];
      ringEl.insertAdjacentHTML("afterend", `<div class="rfacts">${facts.map(([c, big, head, body]) => `<div class="rfact"><div class="rf-big ${c}">${big}</div><b>${head}</b><p>${body}</p></div>`).join("")}</div>`);
      let rt; const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { if (ringEl.isConnected) drawRing(ringEl, items, m); else window.removeEventListener("resize", onResize); }, 150); };
      window.addEventListener("resize", onResize, { passive: true });
    }

    // disclosure delays
    const bins = [["0–15", 0, 15], ["16–30", 16, 30], ["31–45", 31, 45], ["46–60", 46, 60], ["61–90", 61, 90], ["90+", 91, 1e9]];
    const myD = mine.filter((t) => t.delay != null && t.delay >= 0).map((t) => t.delay).sort((a, b) => a - b);
    $("#delays").innerHTML = myD.length ? `${barsSvg(bins.map(([l, a, b]) => ({ label: l, value: myD.filter((d) => d >= a && d <= b).length, color: a > 45 ? "var(--bad)" : "var(--chart)" })), { fmt: (v) => v.toLocaleString() })}
      <p class="small muted">Median ${myD[Math.floor(myD.length / 2)]} days. The STOCK Act allows 45 days; red bars were filed late.</p>` : `<p class="muted">No dated filings ${periodWords()}.</p>`;

    // committee overlap
    const stk = mine.filter(securities);
    if (isExec(m) || isBiz(m) || !(m.committees || []).length) $("#overlap").innerHTML = `<p class="muted">${isBiz(m) ? "Business leaders don't sit on committees." : isExec(m) ? "Officials don't sit on congressional committees." : "No committee seats listed."}</p>`;
    else if (!stk.length) $("#overlap").innerHTML = `<p class="muted">No stock trades ${periodWords()} with this page's filter.</p>`;
    else {
      const inA = stk.filter((t) => t.c && t.c.length), share = est(inA).best / (est(stk).best || 1), byI = new Map();
      for (const t of stk) { const k = (stocks[t.t] || [])[1] || "Other"; const g = byI.get(k) || { k, inA: 0, out: 0 }; if (t.c && t.c.length) g.inA += t.amt; else g.out += t.amt; byI.set(k, g); }
      const rows = [...byI.values()].sort((a, b) => (b.inA + b.out) - (a.inA + a.out)).slice(0, 7), mx = Math.max(...rows.map((r) => r.inA + r.out));
      $("#overlap").innerHTML = `<div class="overlap-big"><b>${Math.round(share * 100)}%</b><span>of ${esc(m.name)}'s stock trading was in industries their own committees oversee.</span></div>
        <div class="legend"><span><i class="sw" style="background:var(--hot)"></i>In their committee areas</span><span><i class="sw" style="background:var(--line-strong)"></i>Outside them</span></div>
        <div class="bars">${rows.map((r) => `<div class="bar-row"><span>${esc(r.k)}</span><span class="mono muted">${usd(r.inA + r.out)}</span><div class="track dual"><div class="fill" style="width:${(r.inA / mx * 100).toFixed(1)}%;background:var(--hot)"></div><div class="fill" style="width:${(r.out / mx * 100).toFixed(1)}%;background:var(--line-strong)"></div></div></div>`).join("")}</div>`;
    }
    const sec = new Map(); for (const t of sb) { const k = (stocks[t.t] || [])[1] || "Other"; sec.set(k, (sec.get(k) || 0) + t.amt); }
    const secs = [...sec.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8), stot = secs.reduce((a, s) => a + s[1], 0) || 1;
    $("#sectors").innerHTML = secs.map(([k, v]) => `<div class="bar-row"><span>${esc(k)}</span><span class="mono muted">${Math.round(v / stot * 100)}%</span><div class="track"><div class="fill" style="width:${(v / secs[0][1] * 100).toFixed(1)}%"></div></div></div>`).join("") || `<p class="muted">No stock buys ${periodWords()}.</p>`;

    loadMaturity().then(() => { const el = $("#bonds"); if (el) bondsInto(el, allMine.filter((t) => t.time >= s0 && t.lo && isDebt(t))); });

    let side = "all", q = "";
    const draw = () => {
      const list = mine.filter((t) => (side === "all" || t.side === side) && (!q || (t.t + " " + stockName(t)).toLowerCase().includes(q))).sort((a, b) => b.time - a.time);
      $("#cnt").textContent = `${list.length.toLocaleString()} trades`;
      table($("#tbl"), [
        { key: "d", label: "Traded", cls: "num", html: (t) => fmtDate(t.d), sort: (t) => t.time },
        { key: "side", label: "", html: (t) => `<span class="pill ${t.side}">${t.side === "B" ? "Buy" : t.k === "SP" ? "Part sale" : "Sale"}</span>` },
        { key: "t", label: "Asset", html: (t) => `${t.t && stocks[t.t] ? tkLink(t.t) + " " : ""}${esc(stockName(t))}${t.cls === "option" ? ` <span class="muted">(${t.opt === "P" ? "put" : t.opt === "C" ? "call" : "option"})</span>` : ""}`, sort: (t) => t.t || t.a },
        { key: "amt", label: "Amount", cls: "r", html: (t) => rangeText(t), sort: (t) => t.amt },
        { key: "r", label: "Since trade", cls: "r hide-sm", hideSm: true, html: (t) => { const r = eff(t, t[base].r); return r == null ? "–" : `<span class="${cls(r)}">${pct(r)}</span>`; }, sort: (t) => t[base].r ?? -9 },
        { key: "h", label: "Signal", cls: "hide-sm", hideSm: true, html: (t) => hypeTag(t), sort: (t) => (hype(t) || { score: -1 }).score },
        { key: "left", label: "Still holds", cls: "r hide-sm", hideSm: true, html: (t) => t.t && stocks[t.t] ? leftText(leftOf(t.m, t.t)) : "–" },
        { key: "fd", label: "Filed", cls: "num hide-sm", hideSm: true, html: (t) => fmtDate(t.fd), sort: (t) => t.ftime },
      ], list, { sort: "d", page: 50, empty: `No trades ${periodWords()} with this page's filter.` });
    };
    $$("[data-side]").forEach((b) => b.addEventListener("click", () => { side = b.dataset.side; $$("[data-side]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); draw(); }));
    $("#filt").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
  }

  // ---------- the biggest-buys ring: the classic site's colours, names and badges ----------
  const mixHex = (a, b, f) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - f) + parseInt(b.slice(i, i + 2), 16) * f).toString(16).padStart(2, "0")).join("");
  const HOLD_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#e87ba4", "#6f4cc3", "#d4a017", "#2bb3c0", "#c0392b", "#5b8c2a", "#8e96a3"];
  // one key per holding: the ticker, or the description without account numbers and share-class words
  // descriptions without a ticker: drop owner codes in front ("DC Visa Inc"), account numbers, share-class words
  const plainDesc = (t) => (t.a || "").toUpperCase().replace(/^[^A-Z0-9$]+/, "").replace(/^(SP|DC|JT)\s+/, "").replace(/\s+E\d{6,}.*$/, "")
    .replace(/\bET\b/, "ETF").replace(/[,\s]+(UNSOLICITED|CL [A-Z]|COM|CMN|SHS|COMMON STOCK)\b.*$/, "").trim();
  const holdingKey = (t) => (/^GOOG/.test(t.t || "") ? "GOOGL" : t.t) || plainDesc(t).slice(0, 48);  // Alphabet's share classes count as one
  // brand by ticker (Alphabet's other share lines count as Alphabet), or by fund family for funds without one
  const brandOf = (t) => BRAND[t.t] || (/^GOOG/.test(t.t || "") ? BRAND.GOOGL : null)
    || (/VANGUARD/i.test(t.a || "") ? ["#96151D", null, null, "V"] : /ISHARES/i.test(t.a || "") ? ["#3A3F47", null, null, "iS"]
    : /SPDR/i.test(t.a || "") ? ["#1F3A93", null, null, "S"] : null);
  const titleCase = (x) => x.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bEtf\b/g, "ETF").replace(/\bS&p\b/g, "S&P");
  function holdingInfo(t) {
    const up = (t.a || "").toUpperCase();
    const bond = !t.st && !/\bETF\b/.test(up) && /\bDUE\b|\d%|\bREV\b|\bBDS?\b|\bNOTES?\b|\bBONDS?\b|\bMUNI|\bLINKED\b|\bSTRUCTURED\b/.test(up);
    const fund = !bond && (t.cls === "fund" || /\b(ETF|FUND|INDEX|TRUST|ISHARES|VANGUARD|SPDR)\b/.test(up));
    let name;
    if (t.st) name = cleanName(t.st[0]).replace(/\s*-?\s*(American )?Depositary Shares?.*$/i, "").replace(/[,.]?\s+(Inc|Corp|Corporation|Ltd|Plc|Co)\.?$/i, "");
    else if (/DIVIDEND APPRECIATION/.test(up)) name = "Vanguard Dividend ETF";
    else if (/VANGUARD S&P 500/.test(up)) name = "Vanguard S&P 500 ETF";
    else if (/COMMODITY/.test(up)) name = "Commodities ETF";
    else if (/INTERNATIONAL TREASURY/.test(up)) name = "Intl. Treasury ETF";
    else if (/U\.?S\.? TREASURY/.test(up)) name = "U.S. Treasury ETF";
    else if (/\bLINKED\b|\bSTRUCTURED\b/.test(up)) name = titleCase(plainDesc(t).replace(/\b(FINANCE|BANK|LLC|PLC|INC|CORP|LINKED|NOTES?)\b.*$/, "").trim().split(" ").slice(0, 3).join(" ") || "Bank") + " linked note";
    else if (bond) name = readableIssuer(plainDesc(t).split(/\s\d/)[0].replace(/\s+(B\/E|BE\/R|SER(IES)?\b|RFDG|DUE\b).*$/i, "").split(" ").slice(0, 4).join(" ")) + " bond";
    else name = titleCase(plainDesc(t).split(" ").slice(0, 4).join(" "));
    const badge = bond ? "$" : t.t ? t.t.slice(0, 4) : name.split(" ").filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("") || "•";
    return { kind: bond ? "bond" : fund ? "fund" : "stock", name, badge };
  }
  // bond issuers as filings abbreviate them ("MICHIGAN ST HOSP FI") written out ("Michigan State Hospital Finance").
  // Word by word; "St" is "State" after a state name and "St." (Saint) elsewhere; state abbreviations other than
  // the first word become the state's name. Words cut off by the filing's length limit can't be recovered.
  const US_STATES = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
    "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
    "Wisconsin", "Wyoming"];
  const STATE_ABBR = { ALA: "Alabama", AL: "Alabama", ALASKA: "Alaska", ARIZ: "Arizona", AZ: "Arizona", ARK: "Arkansas", CALIF: "California", CA: "California",
    COLO: "Colorado", CONN: "Connecticut", CT: "Connecticut", FLA: "Florida", FL: "Florida", GA: "Georgia", ILL: "Illinois", IL: "Illinois", IND: "Indiana",
    KAN: "Kansas", KANS: "Kansas", KS: "Kansas", KY: "Kentucky", MASS: "Massachusetts", MD: "Maryland", MICH: "Michigan", MI: "Michigan", MINN: "Minnesota",
    MN: "Minnesota", MISS: "Mississippi", MO: "Missouri", MONT: "Montana", NEB: "Nebraska", NEV: "Nevada", NJ: "New Jersey", NC: "North Carolina",
    NY: "New York", OKLA: "Oklahoma", OK: "Oklahoma", ORE: "Oregon", PA: "Pennsylvania", SC: "South Carolina", TENN: "Tennessee", TN: "Tennessee",
    TEX: "Texas", TX: "Texas", VA: "Virginia", VT: "Vermont", WASH: "Washington", WA: "Washington", WIS: "Wisconsin", WISC: "Wisconsin", WI: "Wisconsin",
    WYO: "Wyoming", NH: "New Hampshire", RI: "Rhode Island", WV: "West Virginia", NM: "New Mexico", DC: "D.C." };
  const WORD_ABBR = { HOSP: "Hospital", HOSPS: "Hospitals", FI: "Finance", FIN: "Finance", FING: "Financing", FINL: "Financial", AUTH: "Authority",
    CNTY: "County", CNTYS: "Counties", SCH: "School", SCHS: "Schools", DIST: "District", DISTS: "Districts", REV: "Revenue", RV: "Revenue", REVS: "Revenue",
    GO: "General Obligation", HSG: "Housing", WTR: "Water", WTRWKS: "Waterworks", SPLY: "Supply", PUB: "Public", IMPT: "Improvement", IMPTS: "Improvements",
    BLDG: "Building", UNIV: "University", UNI: "University", EDL: "Educational", EDUC: "Education", HLTH: "Health", HLTHCARE: "Healthcare", HEALTHCARE: "Healthcare",
    FAC: "Facility", FACS: "Facilities", DEV: "Development", REDEV: "Redevelopment", AGY: "Agency", CMNTY: "Community", CMNTYS: "Communities", MTG: "Mortgage",
    MUN: "Municipal", MUNI: "Municipal", TWP: "Township", BORO: "Borough", TRANSN: "Transportation", TRANS: "Transportation", TRNSMSN: "Transmission",
    CNTRCT: "Contract", RFDG: "Refunding", REF: "Refunding", SER: "Series", SR: "Senior", PWR: "Power", ELEC: "Electric", UTIL: "Utility", UTILS: "Utilities",
    TPK: "Turnpike", TPKE: "Turnpike", TWY: "Tollway", BRDG: "Bridge", BRDGS: "Bridges", TUNL: "Tunnel", ARPT: "Airport", INTL: "International",
    GOVT: "Government", GEN: "General", OBLIG: "Obligation", MLTIFAM: "Multifamily", MLTI: "Multi", APTS: "Apartments", SETTLMT: "Settlement",
    PMT: "Payment", MSTR: "Master", TOB: "Tobacco", RCPTS: "Receipts", CTF: "Certificates", CTFS: "Certificates", PARTN: "Participation", WKS: "Works",
    DEPT: "Department", SVCS: "Services", SVC: "Service", MED: "Medical", CTR: "Center", CTRS: "Centers", CMWLTH: "Commonwealth", ASSN: "Association",
    PKG: "Parking", SWR: "Sewer", SYS: "System", METRO: "Metropolitan", METROP: "Metropolitan", NATL: "National", NAT: "Natural", RES: "Resources",
    RESH: "Research", ENVIR: "Environmental", ENV: "Environmental", COLL: "College", CMNTYCOLL: "Community College", LN: "Loan", LNS: "Loans",
    STUD: "Student", HWY: "Highway", HWYS: "Highways", PORT: "Port", RR: "Railroad", TRAN: "Transit", INDL: "Industrial", INDT: "Independent",
    CONS: "Consolidated", CONSOL: "Consolidated", PROJ: "Project", PJ: "Project", PREPAY: "Prepayment", DB: "Bond", BDS: "Bonds", BD: "Bond",
    ST: "State", STS: "Streets", JR: "Junior", LTD: "Limited", TX: "Tax", INCR: "Increment", ASSMT: "Assessment", SPL: "Special", EXCH: "Exchange",
    COOP: "Cooperative", ENERGY: "Energy", AVIATION: "Aviation", COMWLTH: "Commonwealth", COMMWLTH: "Commonwealth", COMMN: "Commission",
    WASTEWTR: "Wastewater", PURP: "Purpose", INDPT: "Independent", STR: "Street", ED: "Education", EDUCL: "Educational", MGMT: "Management",
    CORR: "Correctional", RECR: "Recreation", HOUS: "Housing", GTD: "Guaranteed", INS: "Insured", LEASE: "Lease", SANTN: "Sanitation" };
  function readableIssuer(name) {
    const words = name.replace(/\bN Y\b/gi, "NY").replace(/\bN Mex\b/gi, "NM").replace(/\bW Va\b/gi, "WV").replace(/&/g, " & ").split(/\s+/).filter(Boolean);
    const out = [];
    words.forEach((w, i) => {
      const up = w.toUpperCase().replace(/[.,]$/, "");
      const prev = out.length ? out[out.length - 1] : "";
      if (up === "ST") out.push(US_STATES.includes(prev) || US_STATES.some((x) => x.endsWith(" " + prev)) ? "State" : i === 0 || /^[A-Z]/.test(words[i + 1] || "") && !US_STATES.includes(prev) && i < 2 ? "St." : "State");
      else if (i > 0 && STATE_ABBR[up] && !(up === "MO" && /^[A-Z][a-z]/.test(words[i + 1] || "") && false)) out.push(STATE_ABBR[up]);
      else if (up === "UNI" && /^SCH/i.test(words[i + 1] || "")) out.push("Unified");  // "UNI SCH DIST": Unified School District
      else if (WORD_ABBR[up] && !(up === "TX" && i > 0 && out.includes("Texas"))) out.push(WORD_ABBR[up]);
      else out.push(w.length <= 3 && w === w.toUpperCase() && !/\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    });
    // a state written twice in a row ("Texas Texas") or "State State" collapses to one
    // a word or two-word place written twice in a row ("New York New York City") is kept once
    return out.filter((w, i) => w !== out[i - 1]).join(" ").replace(/\b([A-Z][a-z]+(?: [A-Z][a-z]+)?) \1\b/g, "$1").replace(/\s+&\s+/g, " & ");
  }

  function drawRing(el, items, m) {
    const W = el.clientWidth || 900, wide = W >= 760, tot = items.reduce((a, g) => a + g.v, 0) || 1;
    const cardHtml = (g, i) => `<div class="rcard" data-i="${i}" style="--c:${g.soft}">${logoBox(g.tk || g.badge, g.col, 40, !g.brand, g.brand || (g.tk ? null : ["", null, null, g.badge]))}<div class="rc-txt">
        ${g.href ? `<a class="rc-name" href="${g.href}">${esc(g.name)}</a>` : `<span class="rc-name">${esc(g.name)}</span>`}
        <span class="rc-amt">${usd(g.v)}${g.chg == null ? "" : `<span class="rc-chg ${cls(g.chg)}" title="Today's price against their average buy">${g.chg >= 0 ? "▲" : "▼"} ${Math.abs(g.chg * 100).toFixed(1)}%</span>`}</span>
        <span class="rc-tags">${g.sold >= 500 ? `<span class="rc-tag sold">${usd(g.sold)} sold${g.sold > g.v ? " · more than bought" : ""}</span>` : ""}${g.held === "sold out" ? `<span class="rc-tag sold">Sold out</span>` : g.held && g.held !== "unknown" ? `<span class="rc-tag held">${g.held} still held</span>` : ""}</span></div></div>`;
    const D = wide ? Math.min(400, W - 2 * Math.min(320, W * 0.3) - 60) : Math.min(300, W - 20);
    const face = `<div class="ring-face ${esc(m.party || "I")}" style="width:${D * 0.56}px;height:${D * 0.56}px">${photo(m)}</div>`;
    const donut = donutSvg(items.map((g) => ({ label: g.tk || g.name, value: g.v, color: g.soft, text: usd(g.v) })), { size: 400, hole: 0.7 });
    if (!wide) {  // phones: the ring on top, the cards in a list underneath
      el.innerHTML = `<div class="ring2-top" style="width:${D}px;height:${D}px">${donut}${face}</div><div class="rcards">${items.map(cardHtml).join("")}</div>`;
      return;
    }
    // slices start at the top and go clockwise; a card sits on the side of its slice, near its height
    let a0 = 0; const mids = items.map((g) => { const a = a0 + Math.PI * g.v / tot; a0 += 2 * Math.PI * g.v / tot; return a; });
    el.innerHTML = `<div class="ring2-wide"><svg class="ring2-lines"></svg><div class="ring2-donut" style="width:${D}px;height:${D}px">${donut}${face}</div>${items.map(cardHtml).join("")}</div>`;
    const box = $(".ring2-wide", el), cards = $$(".rcard", el), cw = Math.min(320, (W - D - 60) / 2);
    cards.forEach((c) => { c.style.width = `${cw}px`; });
    const R = D / 2, gap = 8, sides = { L: [], R: [] };
    items.forEach((g, i) => sides[Math.sin(mids[i]) >= 0 ? "R" : "L"].push(i));
    // keep the two columns close in length: move the slices nearest the top or bottom across
    const hs = cards.map((c) => c.offsetHeight), colH = (l) => l.reduce((a, i) => a + hs[i] + gap, 0);
    for (let k = 0; k < items.length && Math.abs(colH(sides.L) - colH(sides.R)) > 160; k++) {
      const [from, to] = colH(sides.L) > colH(sides.R) ? ["L", "R"] : ["R", "L"];
      const pick = sides[from].slice().sort((x, y) => Math.abs(Math.sin(mids[x])) - Math.abs(Math.sin(mids[y])))[0];
      sides[from].splice(sides[from].indexOf(pick), 1); sides[to].push(pick);
    }
    const H = Math.max(D + 40, colH(sides.L) + 10, colH(sides.R) + 10), cx = W / 2, cy = H / 2;
    box.style.height = `${H}px`;
    const donutEl = $(".ring2-donut", el); donutEl.style.left = `${cx - R}px`; donutEl.style.top = `${cy - R}px`;
    let lines = "";
    for (const side of ["L", "R"]) {
      const list = sides[side].map((i) => ({ i, want: cy - (R + 6) * Math.cos(mids[i]) - hs[i] / 2 })).sort((a, b) => a.want - b.want);
      let y = 0; for (const it of list) { it.y = Math.max(it.want, y); y = it.y + hs[it.i] + gap; }
      let over = y - gap - H; for (let k = list.length - 1; k >= 0 && over > 0; k--) { const it = list[k]; const nxt = k < list.length - 1 ? list[k + 1].y - hs[it.i] - gap : H - hs[it.i]; it.y = Math.min(it.y, nxt); }
      for (const it of list) {
        const c = cards[it.i], x = side === "L" ? 0 : W - cw;
        c.style.left = `${x}px`; c.style.top = `${it.y}px`;
        const ex = side === "L" ? cw : W - cw, ey = it.y + hs[it.i] / 2, a = mids[it.i];
        const sx = cx + (R - 1) * Math.sin(a), sy = cy - (R - 1) * Math.cos(a), bx = side === "L" ? ex + 18 : ex - 18;
        lines += `<polyline points="${sx.toFixed(1)},${sy.toFixed(1)} ${bx.toFixed(1)},${ey.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="${items[it.i].soft}" stroke-width="1.6"/><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="3.5" fill="${items[it.i].soft}" stroke="var(--surface)" stroke-width="1.5"/>`;
      }
    }
    const svg = $(".ring2-lines", el); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H); svg.innerHTML = lines;
  }

  // ---------- bonds and debt ----------
  let MATURITY = null;
  const loadMaturity = () => MATURITY ? Promise.resolve(MATURITY) : loadScript("../bond_maturity.js").then(() => (MATURITY = window.CTC_MATURITY || {}));
  const DEBT_RE = /\bDUE\b|\d%|\bREV\b|\bBDS?\b|\bNOTES?\b|\bNTS\b|\bBONDS?\b|\bMUNI|TREAS|T-BILL|\bBILLS?\b|\bCDS?\b|CERTIFICATE OF DEPOSIT|\bGO\b|DEBENTURE|\bLINKED\b|\bPERP\b/i;
  const isDebt = (t) => t.cls !== "option" && t.side !== "O" && (stocks[t.t] ? /\b(BOND|TREASURY|MUNI)/i.test(stocks[t.t][0]) : DEBT_RE.test(t.a || ""));
  const DEBT_KINDS = { treasury: ["U.S. Treasury", "#2a78d6"], muni: ["Municipal", "#1baf7a"], corp: ["Corporate", "#eb6834"], bank: ["Bank notes & CDs", "#6f4cc3"], fund: ["Bond funds", "#8e96a3"] };
  function debtKind(t) {
    const up = (stocks[t.t] ? stocks[t.t][0] : t.a || "").toUpperCase();
    return !stocks[t.t] && /\bLINKED\b|STRUCTURED|\bCDS?\b|CERTIFICATE OF DEPOSIT|\bBANK\b.*\bNOTE/.test(up) ? "bank"
      : /\b(ETF|FUND|FD|INDEX|SWEEP|MONEY MARKET|TRUST)\b/.test(up) || stocks[t.t] ? "fund"
      : /TREAS|T-BILL|UNITED STATES/.test(up) ? "treasury"
      : /\b(ST|STATE|CNTY|COUNTY|CITY|AUTH|DIST|SCH|SCHOOL|REV|GO|HOSP|HSG|WTR|TRANSIT|TURNPIKE|PORT|UNIV|PUB|MUNI|TWP|BORO|COMMONWEALTH|AIRPORT|AVIATION|TOLL|UTIL)\b/.test(up) ? "muni" : "corp";
  }
  // a bond's readable name: the issuer, without the coupon, series and "due" (maturity) date; as on the classic site
  function bondName(a, kind) {
    const up = String(a || "").toUpperCase();
    if (kind === "treasury") return /BILL/.test(up) ? "U.S. Treasury bills" : /BOND/.test(up) && !/NOTE/.test(up) ? "U.S. Treasury bonds" : "U.S. Treasury notes";
    let name = String(a || "").replace(/\s+/g, " ").trim().replace(/\s+(B\/E|BE\/R|SER(IES)?\b|RFDG|DUE\b|DTD\b|FC\b|PTC\b).*$/i, "").replace(/\s*\d{1,2}(\.\d+)?\s?%.*$/, "").replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}.*$/, "").trim();
    name = name.length > 4 && name === name.toUpperCase() ? titleCase(name) : name;
    return ((kind === "fund" ? name : readableIssuer(name)) || a).replace(/Ishares/gi, "iShares").replace(/Spdr/g, "SPDR");
  }
  // "DUE 11/15/40": the date the bond is repaid (15 Nov 2040)
  const dueDate = (a) => { const m = String(a || "").match(/\bDUE\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i); if (!m) return null; const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return [`${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`, "filed"]; };
  function bondsInto(el, list) {
    const buys = list.filter((t) => t.side === "B"), sells = list.filter((t) => t.side === "S");
    if (!buys.length) { el.innerHTML = `<p class="muted">No bond or debt purchases ${periodWords()}.</p>`; return; }
    const k = new Map(); for (const t of buys) { const kk = debtKind(t); k.set(kk, (k.get(kk) || 0) + t.amt); }
    const tot = [...k.values()].reduce((a, v) => a + v, 0) || 1, used = Object.entries(DEBT_KINDS).filter(([kk]) => k.get(kk));
    const by = new Map();
    for (const t of buys) { const g = by.get(t.a) || { a: t.a, kind: debtKind(t), list: [] }; g.list.push(t); by.set(t.a, g); }
    const rows = [...by.values()].map((g) => ({ ...g, e: est(g.list).best, cp: (g.a.toUpperCase().match(/(\d{1,2}(?:\.\d{1,5})?)\s?%/) || [])[1], mt: (MATURITY || {})[g.a] || dueDate(g.a), name: bondName(g.a, g.kind) }));
    el.innerHTML = `<div class="grid cols-3">${statCard("Bought", usd(est(buys).best), `${buys.length} purchases, likely ${span(est(buys))}`, "up")}${statCard("Sold or redeemed", sells.length ? usd(est(sells).best) : "$0", `${sells.length} sales`, "down")}
      <div class="card stat"><div class="lbl">What kind</div><div class="stackbar">${used.map(([kk, [l, c]]) => `<i style="width:${(k.get(kk) / tot * 100).toFixed(1)}%;background:${c}" title="${l} ${usd(k.get(kk))}"></i>`).join("")}</div>
      <div class="legend small">${used.map(([kk, [l, c]]) => `<span><i class="sw" style="background:${c}"></i>${l} ${Math.round(k.get(kk) / tot * 100)}%</span>`).join("")}</div></div></div><div class="section" id="bondTbl"></div>`;
    table($("#bondTbl", el), [
      { key: "a", label: "Issuer", html: (g) => `<span title="As filed: ${esc(g.a)}"><i class="sw" style="background:${DEBT_KINDS[g.kind][1]}"></i> ${esc(g.name)}</span>`, sort: (g) => g.name },
      { key: "kind", label: "Type", cls: "hide-sm", hideSm: true, html: (g) => DEBT_KINDS[g.kind][0], sort: (g) => g.kind },
      { key: "cp", label: "Coupon", cls: "r", html: (g) => g.cp ? `${+g.cp}%` : "–", sort: (g) => +(g.cp || 0) },
      { key: "mt", label: "Matures", cls: "r", html: (g) => g.mt ? `<span class="${g.mt[1] === "likely" ? "muted" : ""}">${fmtDate(g.mt[0], { month: "short", year: "numeric" })}</span>` : "–", sort: (g) => g.mt ? g.mt[0] : "" },
      { key: "e", label: "Bought", cls: "r", html: (g) => g.list.length === 1 ? rangeText(g.list[0]) : `${usd(g.e)} · ${g.list.length} buys`, sort: (g) => g.e },
    ], rows, { sort: "e", page: 15 });
  }

  // ---------- a stock's page ----------
  let PRICES = null, pricesPromise = null;
  const loadPrices = () => PRICES ? Promise.resolve(PRICES) : (pricesPromise ||= loadScript("../prices.js").then(() => (PRICES = window.CTC_PRICES || null)));
  async function pageStock(tk) {
    setNav("stocks");
    const st = stocks[tk];
    if (!st) { app.innerHTML = `<h1>Not found</h1><p>No stock with that ticker. <a href="#/stocks">See every stock</a>.</p>`; return; }
    const s0 = since(), list = trades.filter((t) => t.t === tk && t.time >= s0 && t.side !== "O" && pass(t, { big: false }));
    const buys = list.filter((t) => t.side === "B"), sells = list.filter((t) => t.side === "S");
    app.innerHTML = `<div class="crumbs"><a href="#/stocks">Stocks</a></div>
      <div class="price-head"><div class="ph-left">${logoBox(tk, "var(--chart)", 52)}<div><h1>${esc(cleanName(st[0]))}</h1><div class="muted"><span class="tk">${esc(tk)}</span> ${esc([st[3] || st[2], st[1]].filter(Boolean).join(" · "))}${st[4] ? ` · market value ${usd(st[4])}` : ""}</div></div></div>
        <div class="px" id="px"></div></div>
      <div class="toolbar">${periodSeg()}</div>
      <div class="card"><div class="pchart" id="chart"><p class="loading">Loading prices…</p></div>
        <div class="legend"><span><i class="tri-up"></i>a buy</span><span><i class="tri-dn"></i>a sale</span><span>hover for who traded that day · click a marker to pin its card; click more to compare · × closes</span></div></div>
      <div class="grid cols-3 section">
        ${statCard("Bought", buys.length ? usd(est(buys).best) : "–", `${buys.length} buys by ${new Set(buys.map((t) => t.m)).size} people`, "up")}
        ${statCard("Sold", sells.length ? usd(est(sells).best) : "–", `${sells.length} sales by ${new Set(sells.map((t) => t.m)).size} people`, "down")}
        <div class="card stat" id="heldStat"></div>
      </div>
      <div class="section">${partiesHtml(list, B())}</div>
      <div class="card section"><h2>Who traded it <span class="muted">${periodWords()}</span></h2><div id="tbl"></div>
        <p class="small muted">Still holds: estimated from all their filings since ${fmtDate(D.start, { month: "short", year: "numeric" })} (buys minus sales), at the latest close; ◆ counted from an annual report's year-end holdings. Signal: how much their buying is likely to mean (size, against their usual trade, bought alone or in a basket of many stocks, other members buying too); hover it for the reasons.</p></div>`;
    bindPeriod(app);
    const by = new Map();
    for (const t of list) { const g = by.get(t.m) || { m: members[t.m], b: [], s: [] }; (t.side === "B" ? g.b : g.s).push(t); by.set(t.m, g); }
    const rows = [...by.values()].map((g) => {
      const pb = g.b.filter((t) => t.ep && t.amt), sh = pb.reduce((a, t) => a + t.amt / t.ep, 0);
      const best = g.b.filter(hype).sort((a, b) => hype(b).score - hype(a).score)[0] || null;  // their strongest buy
      return { ...g, eb: est(g.b).best, es: est(g.s).best, avg: sh ? pb.reduce((a, t) => a + t.amt, 0) / sh : null, L: leftOf(g.m.i, tk), h: best };
    });
    let hv = 0, hn = 0; for (const mi of new Set(trades.filter((t) => t.t === tk).map((t) => t.m))) { const L = leftOf(mi, tk); if (L && L.value >= 1000) { hv += L.value; hn++; } }
    $("#heldStat").innerHTML = `<div class="lbl">Still held</div><div class="big">${hv ? "≈" + usd(hv) : "–"}</div><div class="sub">by ${hn} members and officials, from all their filings</div>`;
    const P = await loadPrices();
    if (!location.hash.toUpperCase().startsWith(`#/STOCK/${tk}`)) return;  // moved on while prices loaded
    const s = P && P.px[tk], last = s ? s.filter((v) => v != null).pop() : null;
    if (last) $("#px").innerHTML = `${price(last)}<div class="muted" style="font-size:13px;font-weight:500">close ${fmtDate(D.prices_through)}</div>`;
    table($("#tbl"), [
      { key: "who", label: "Person", html: (g) => who(g.m) },
      { key: "eb", label: "Bought", cls: "r", html: (g) => `<span class="up">${g.b.length ? `${usd(g.eb)} · ${g.b.length}` : "–"}</span>`, sort: (g) => g.eb },
      { key: "es", label: "Sold", cls: "r", html: (g) => `<span class="down">${g.s.length ? `${usd(g.es)} · ${g.s.length}` : "–"}</span>`, sort: (g) => g.es },
      { key: "avg", label: "Avg buy", cls: "r hide-sm", hideSm: true, html: (g) => g.avg ? price(g.avg) : "–", sort: (g) => g.avg || 0 },
      { key: "chg", label: "Since", cls: "r", html: (g) => g.avg && last ? `<span class="${cls(last / g.avg - 1)}">${pct(last / g.avg - 1)}</span>` : "–", sort: (g) => g.avg && last ? last / g.avg : -9 },
      { key: "left", label: "Still holds", cls: "r", html: (g) => leftText(g.L), sort: (g) => g.L ? g.L.value : -1 },
      { key: "h", label: "Best signal", cls: "hide-sm", hideSm: true, html: (g) => g.h ? hypeTag(g.h) : "", sort: (g) => g.h ? hype(g.h).score : -1 },
    ], rows, { sort: "eb", href: (g) => `#/member/${encodeURIComponent(g.m.id)}`, empty: `Nobody traded ${tk} ${periodWords()}.` });
    priceChart($("#chart"), P, tk, list);
  }

  // ---------- the stock price chart: buys and sales with photo cards that can be pinned ----------
  function priceChart(el, P, tk, list) {
    const s = P && P.px[tk];
    if (!s) { el.innerHTML = `<p class="muted">No daily prices for ${esc(tk)}.</p>`; return; }
    const dates = P.dates, s0 = since();
    let i0 = 0; while (i0 < dates.length - 1 && Date.parse(dates[i0] + "T00:00:00Z") < s0) i0++;
    let i1 = dates.length - 1; while (i1 > i0 && s[i1] == null) i1--;
    const idx = []; for (let i = i0; i <= i1; i++) if (s[i] != null) idx.push(i);
    if (idx.length < 2) { el.innerHTML = `<p class="muted">Not enough prices in this period.</p>`; return; }
    const narrow = el.clientWidth < 620, W = narrow ? 520 : 1000, H = narrow ? 360 : 400, L = 8, R = narrow ? 56 : 64, T = 16, Bm = 30, vals = idx.map((i) => s[i]);
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.1 || hi * 0.05; lo -= pad; hi += pad;
    const X = (i) => L + (i - i0) / Math.max(1, i1 - i0) * (W - L - R), Y = (v) => T + (hi - v) / (hi - lo) * (H - T - Bm);
    const at = new Map(dates.map((d, i) => [d, i])), idxOf = (d) => { let i = at.get(d); if (i == null) { i = dates.findIndex((x) => x >= d); if (i < 0) i = dates.length - 1; } return i; };
    const pv = (i) => { for (let j = i; j >= i0; j--) if (s[j] != null) return s[j]; return s[idx[0]]; };
    const line = idx.map((i, k) => `${k ? "L" : "M"}${X(i).toFixed(1)},${Y(s[i]).toFixed(1)}`).join("");
    const area = `${line}L${X(idx[idx.length - 1]).toFixed(1)},${H - Bm}L${X(idx[0]).toFixed(1)},${H - Bm}Z`;
    const ticks = [0, 1, 2, 3, 4].map((k) => lo + (hi - lo) * k / 4);
    const months = []; let lastM = ""; for (let i = i0; i <= i1; i++) { const mo = dates[i].slice(0, 7); if (mo !== lastM) { if (lastM) months.push(i); lastM = mo; } }
    const every = Math.ceil(months.length / (narrow ? 4 : 8));
    const groups = new Map();  // one marker per day and side
    for (const t of list) { const i = idxOf(t.d); if (i < i0 || i > i1) continue; const k = i + t.side; const g = groups.get(k) || { k, i, side: t.side, list: [] }; g.list.push(t); groups.set(k, g); }
    const G = [...groups.values()];
    const tri = (g) => { const x = X(g.i), y = Y(pv(g.i)), n = Math.min(4, g.list.length - 1), w = 6 + n, h = 11 + n; return g.side === "B" ? `M${x.toFixed(1)},${(y + 4).toFixed(1)}l-${w},${h}h${2 * w}z` : `M${x.toFixed(1)},${(y - 4).toFixed(1)}l-${w},-${h}h${2 * w}z`; };
    el.innerHTML = `<div class="chart">${svgBox(W, H, `
      ${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)"/><text x="${W - R + 8}" y="${(Y(v) + 4).toFixed(1)}" font-size="12" fill="var(--muted)" font-family="var(--font-mono)">$${v.toFixed(v < 10 ? 2 : 0)}</text>`).join("")}
      ${months.filter((_, k) => k % every === 0).map((i) => `<text x="${X(i).toFixed(1)}" y="${H - 8}" font-size="12" fill="var(--muted)" text-anchor="middle">${fmtDate(dates[i], { month: "short", ...(dates[i].slice(5, 7) === "01" ? { year: "2-digit" } : {}) })}</text>`).join("")}
      <path d="${area}" fill="var(--chart-area)"/><path d="${line}" fill="none" stroke="var(--chart)" stroke-width="2.2" stroke-linejoin="round"/>
      <line class="cx" x1="0" x2="0" y1="${T}" y2="${H - Bm}" stroke="var(--ink-2)" stroke-dasharray="3 3" visibility="hidden"/>
      <g class="links"></g>
      ${G.map((g) => `<path class="mk" data-k="${g.k}" d="${tri(g)}" fill="${g.side === "B" ? "var(--good)" : "var(--bad)"}" stroke="var(--surface)" stroke-width="1"/>`).join("")}`, `${tk} price with buys and sales`)}
      <div class="tip tcard-tip" hidden></div><div class="pins"></div></div>`;
    const svg = $("svg", el), tip = $(".tip", el), cx = $(".cx", el), pinsEl = $(".pins", el), linksEl = $(".links", el);
    const byK = new Map(G.map((g) => [g.k, g]));
    // a trade pill, like the classic site's chart: the trader's round photo, "Bought $549.47" in green or "Sold" in red,
    // then the date, who and how much. Several people on one day share a pill with their faces overlapping.
    const surname = (m) => { const w = String(m.name).replace(/,? (Jr\.?|Sr\.?|III|II|IV)$/i, "").trim().split(/\s+/); return w[w.length - 1]; };
    const tcard = (g, pinned) => {
      const ms = [...new Map(g.list.map((t) => [t.m, members[t.m]])).values()], one = g.list.length === 1, t0 = g.list[0];
      const sub = `${fmtDate(dates[g.i], { day: "numeric", month: "short" })} · ${one ? `${esc(surname(ms[0]))} · ${rangeText(t0)}` : `${ms.length > 1 ? `${ms.length} people` : esc(surname(ms[0]))} · ${g.list.length} trades · ≈${usd(est(g.list).best)}`}`;
      const names = !one && ms.length > 1 ? `<span class="tp-names">${ms.slice(0, 4).map((m) => `<a href="#/member/${encodeURIComponent(m.id)}">${esc(surname(m))}</a>`).join(", ")}${ms.length > 4 ? ` +${ms.length - 4}` : ""}</span>` : "";
      const tag = ms.length === 1 ? "a" : "div", href = ms.length === 1 ? ` href="#/member/${encodeURIComponent(ms[0].id)}"` : "";
      return `<${tag} class="tpill ${g.side}"${href} title="${esc(ms.map((m) => m.name).join(", "))}"><span class="tp-faces">${ms.slice(0, 3).map((m) => `<span class="tp-ph ${esc(m.party || "I")}">${photo(m)}</span>`).join("")}</span>
        <span class="tp-txt"><b>${g.side === "B" ? "Bought" : "Sold"} ${price(pv(g.i))}</b><span>${sub}</span>${pinned ? names : ""}</span>
        ${pinned ? `<button type="button" class="x" data-unpin="${g.k}" aria-label="Close">×</button>` : ""}</${tag}>`;
    };
    // pinned cards sit beside their marker, nudged up or down so none overlap, with a line back to the marker
    const pinned = [];
    const layout = () => {
      const r = svg.getBoundingClientRect(), sx = r.width / W, sy = r.height / H;
      pinsEl.innerHTML = pinned.map((k) => `<div class="pin" data-k="${k}">${tcard(byK.get(k), true)}</div>`).join("");
      const placed = []; let links = "";
      [...pinsEl.children].forEach((div) => {
        const g = byK.get(div.dataset.k), mx = X(g.i) * sx, my = Y(pv(g.i)) * sy, w = div.offsetWidth, h = div.offsetHeight;
        const xs = [mx + 18, mx - 18 - w].map((x) => Math.max(0, Math.min(r.width - w, x)));
        let best = null;
        for (const x of xs) {
          for (let d = 0; d < r.height && !best; d += 10) for (const c of [my - h / 2 - d, my - h / 2 + d]) {
            const y = Math.max(0, Math.min(r.height - h, c));
            if (!placed.some((p) => x < p.x + p.w + 6 && x + w + 6 > p.x && y < p.y + p.h + 6 && y + h + 6 > p.y)) { best = { x, y }; break; }
          }
          if (best) break;
        }
        best = best || { x: xs[0], y: Math.max(0, Math.min(r.height - h, my - h / 2)) };
        placed.push({ ...best, w, h }); div.style.left = `${best.x}px`; div.style.top = `${best.y}px`;
        const ax = (best.x > mx ? best.x : best.x + w) / sx, ay = (best.y + Math.min(h / 2, 30)) / sy;
        links += `<line x1="${X(g.i).toFixed(1)}" y1="${Y(pv(g.i)).toFixed(1)}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="${g.side === "B" ? "var(--good)" : "var(--bad)"}" stroke-width="1.4" stroke-opacity=".75"/>`;
      });
      linksEl.innerHTML = links;
      $$("[data-unpin]", pinsEl).forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); pinned.splice(pinned.indexOf(b.dataset.unpin), 1); layout(); }));
    };
    const nearest = (ev) => {
      const r = svg.getBoundingClientRect(), x = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / r.width * W, y = ((ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top) / r.height * H;
      let best = null, bd = 1e9; for (const g of G) { const d = Math.hypot(X(g.i) - x, (Y(pv(g.i)) - y) * 0.5); if (d < bd) { bd = d; best = g; } }
      return { g: bd < 36 ? best : null, i: Math.max(i0, Math.min(i1, Math.round(i0 + (x - L) / (W - L - R) * (i1 - i0)))) };
    };
    svg.addEventListener("mousemove", (ev) => {
      const { g, i } = nearest(ev), ii = g ? g.i : i, r = svg.getBoundingClientRect();
      cx.setAttribute("x1", X(ii)); cx.setAttribute("x2", X(ii)); cx.setAttribute("visibility", "visible");
      tip.innerHTML = g ? tcard(g, false) : `<div class="tpill"><span class="tp-txt"><b>${price(pv(ii))}</b><span>${fmtDate(dates[ii])}</span></span></div>`;
      tip.hidden = false; const left = X(ii) / W * r.width, tw = tip.offsetWidth;
      tip.style.left = `${Math.max(0, Math.min(r.width - tw, left + (left > r.width / 2 ? -tw - 16 : 16)))}px`;
      tip.style.top = `${Math.max(0, Math.min(r.height - tip.offsetHeight, Y(pv(ii)) / H * r.height - 30))}px`;
      svg.style.cursor = g ? "pointer" : "";
    });
    svg.addEventListener("mouseleave", () => { tip.hidden = true; cx.setAttribute("visibility", "hidden"); });
    svg.addEventListener("click", (ev) => {
      const { g } = nearest(ev); if (!g) return;
      const k = pinned.indexOf(g.k); if (k >= 0) pinned.splice(k, 1); else pinned.push(g.k);
      tip.hidden = true; layout();
    });
    let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => pinned.length && el.isConnected && layout(), 150); }, { passive: true });
  }

  // ---------- copy-trading leaderboard ----------
  function pageLeaders() {
    setNav("leaders");
    const from = Math.max(since(), Date.parse(D.start + "T00:00:00Z")), rows = followScores(from);
    app.innerHTML = `<h1>Copy-trading leaderboard</h1>
      <p class="lede">Who would have been worth copying: each politician's stock buys, bought on the day they were disclosed, ${periodWords()}. Scored out of 100%: edge over the S&amp;P 500 (40%), hit rate (25%), reporting speed (15%) and track record (20%). At least 5 buys to be ranked.</p>
      <div class="toolbar">${periodSeg()}</div><div id="podium" class="podium"></div><div class="card section" id="tbl"></div>
      <p class="small muted">Edge: how much copying beat the S&amp;P 500 over the same days, dollar-weighted, pulled toward zero for short records so a few lucky buys can't top the list. Hit rate: share of buys that beat it. Speed: median days to report (same day full marks, 60 days or more none). Track record: 100 buys or more full marks. Past results don't predict future ones. Not investment advice.</p>`;
    bindPeriod(app);
    const MEDAL = ["#c9a227", "#9aa4ae", "#b0763c"];
    $("#podium").innerHTML = rows.length >= 3 ? [1, 0, 2].map((k) => { const r = rows[k]; return `<a class="pod p${k}" href="#/member/${encodeURIComponent(r.m.id)}"><span class="medal" style="background:${MEDAL[k]}">${k + 1}</span><span class="who ${esc(r.m.party || "I")} big">${photo(r.m)}</span><b>${esc(r.m.name)}</b><span class="muted small">${partyTag(r.m)} ${esc(seat(r.m))}</span><span class="pscore">${Math.round(r.score)}%</span><span class="small">copying ${pct(r.s.ret, 0)} vs S&amp;P ${pct(r.s.spyRet, 0)} · ${r.s.n} buys</span></a>`; }).join("") : `<p class="muted">Not enough buys to rank anyone ${periodWords()}. Pick a longer period.</p>`;
    const partBar = (v, max, c) => `<span class="pbar" title="${Math.round(v / max * 100)}% of this part"><i style="width:${Math.max(0, Math.min(100, v / max * 100)).toFixed(0)}%;background:${c}"></i></span>`;
    table($("#tbl"), [
      { key: "rk", label: "#", cls: "num", html: (r) => rows.indexOf(r) + 1, sort: (r) => -rows.indexOf(r) },
      { key: "who", label: "Person", html: (r) => who(r.m) },
      { key: "score", label: "Score", cls: "r", html: (r) => `<b>${Math.round(r.score)}%</b>`, sort: (r) => r.score },
      { key: "edge", label: "Edge", cls: "hide-sm", hideSm: true, html: (r) => `${partBar(r.parts.edge, 40, "#1f5fd6")} <span class="small ${cls(r.s.diff)}">${pct(r.s.diff)}</span>`, sort: (r) => r.parts.edge },
      { key: "hit", label: "Hit rate", cls: "hide-sm", hideSm: true, html: (r) => `${partBar(r.parts.hit, 25, "#0f8f84")} <span class="small">${Math.round(r.s.win * 100)}%</span>`, sort: (r) => r.parts.hit },
      { key: "speed", label: "Speed", cls: "hide-sm", hideSm: true, html: (r) => `${partBar(r.parts.speed, 15, "#a87400")} <span class="small">${r.median} days</span>`, sort: (r) => r.parts.speed },
      { key: "n", label: "Buys", cls: "r", html: (r) => r.s.n, sort: (r) => r.s.n },
      { key: "ret", label: "Copying returned", cls: "r", html: (r) => `<span class="${cls(r.s.ret)}">${pct(r.s.ret)}</span>`, sort: (r) => r.s.ret },
    ], rows, { sort: "score", href: (r) => `#/member/${encodeURIComponent(r.m.id)}`, empty: "Nobody has 5 or more buys in this period." });
  }

  // ---------- Public signals ----------
  let SIGNALS = null;
  const loadSignals = () => SIGNALS ? Promise.resolve(SIGNALS) : loadScript("../signals.js").then(() => (SIGNALS = window.CTC_SIGNALS || { stocks: [] }));
  async function pageSignals() {
    setNav("signals");
    app.innerHTML = `<h1>Public signals</h1><p class="loading">Loading…</p>`;
    const G = await loadSignals(); if (location.hash !== "#/signals") return;
    const rows = G.stocks || [], top = rows.slice(0, 15);
    const PARTS = [["congress", "Net buyers", "#1f5fd6"], ["cluster", "Bought close together", "#7aa7ef"], ["committee", "Committee", "#7c3aed"], ["contracts", "Contracts", "#0e8a9c"], ["lobbying", "Lobbying", "#d9480f"], ["hearings", "Hearings", "#a07500"], ["leaders", "Leaders' posts", "#c0268f"], ["insiders", "Insiders", "#1baf7a"]];
    const byId = new Map(members.map((m) => [m.id, m]));
    app.innerHTML = `<h1>Public signals</h1>
      <p class="lede">Stocks members and officials bought in the last ${G.buy_days} days, scored out of 100% on where public signals line up: net buying (buys against sales), committee links, federal contracts in the last ${G.contract_days} days, lobbying, House hearings in the next ${G.hearing_days} days, posts by well-known political figures, and the company's own insiders buying. Data from ${fmtDate(G.generated)}.</p>
      <div class="grid cols-4">${statCard("Stocks scored", rows.length, `bought in the last ${G.buy_days} days`)}${statCard("Top score", top[0] ? `${Math.round(top[0].score)}%` : "–", top[0] ? `${esc(top[0].t)} · ${esc(cleanName(top[0].name))}` : "")}${statCard("With federal contracts", rows.filter((r) => r.contracts > 0).length, `last ${G.contract_days} days`)}${statCard("Insiders buying too", rows.filter((r) => r.insiders).length, `last ${G.insider_days} days`)}</div>
      <div class="section card"><h2>What makes up each score <span class="muted">the 15 highest; click one for its page</span></h2><div class="legend">${PARTS.map(([, l, c]) => `<span><i class="sw" style="background:${c}"></i>${l}</span>`).join("")}</div>
        <div class="stack-rows">${top.map((r) => `<a class="stack-row" href="#/stock/${encodeURIComponent(r.t)}">${logoBox(r.t, "var(--chart)", 26)}<span class="ell small"><b>${esc(r.t)}</b> ${esc(cleanName(r.name))}</span><span class="stackbar">${PARTS.map(([k, l, c]) => (r.points[k] || 0) > 0 ? `<i style="width:${r.points[k]}%;background:${c}" title="${l}: ${Math.round(r.points[k])}%"></i>` : "").join("")}</span><b class="mono">${Math.round(r.score)}%</b></a>`).join("")}</div></div>
      <div class="grid cols-2 section">
        ${card("Government contracts", `stocks members are buying that the federal government is also paying, last ${G.contract_days} days`, `<p class="small muted">Contract money awarded to each company (from USAspending.gov), and how many members bought more of it than they sold. A company winning big contracts while members on the committees that oversee it are buying is worth a closer look.</p><div id="contracts" class="bars"></div>`)}
        ${card("Lobbying spend", "the scored stocks that lobby most", `<div id="lobby" class="bars"></div>`)}
      </div>
      <div class="grid cols-2 section">
        ${card("Company insiders buying too", `last ${G.insider_days} days`, `<div id="ins"></div>`)}
        ${card("Upcoming House hearings", `next ${G.hearing_days} days`, `<div id="hear"></div>`)}
      </div>
      <div class="grid cols-2 section">
        ${card("Sectors", "how many scored stocks, and their average score", `<div id="secs" class="bars"></div>`)}
        ${card("Named in leaders' posts", `last ${G.leader_days} days`, `<div id="posts"></div>`)}
      </div>
      <div class="card section"><h2>Every scored stock</h2><div id="tbl"></div></div>`;
    const con = rows.filter((r) => r.contracts > 0).sort((a, b) => b.contracts - a.contracts).slice(0, 10), cmx = con[0] ? con[0].contracts : 1;
    $("#contracts").innerHTML = con.length ? con.map((r) => `<div class="bar-row"><span class="ell">${tkLink(r.t)} ${esc(cleanName(r.name))}</span><span class="mono muted">${usd(r.contracts)} · ${r.members} net buyer${r.members === 1 ? "" : "s"}</span><div class="track"><div class="fill" style="width:${Math.max(1, r.contracts / cmx * 100).toFixed(1)}%;background:#0e8a9c"></div></div></div>`).join("") : `<p class="muted">None of the scored stocks won federal contracts in the last ${G.contract_days} days.</p>`;
    const lob = rows.filter((r) => r.lobbying > 0).sort((a, b) => b.lobbying - a.lobbying).slice(0, 10), lmx = lob[0] ? lob[0].lobbying : 1;
    $("#lobby").innerHTML = lob.map((r) => `<div class="bar-row"><span class="ell">${tkLink(r.t)} <span class="muted small">${esc((r.issues || []).slice(0, 2).join(", "))}</span></span><span class="mono muted">${usd(r.lobbying)}</span><div class="track"><div class="fill" style="width:${(r.lobbying / lmx * 100).toFixed(1)}%;background:#d9480f"></div></div></div>`).join("") || `<p class="muted">None.</p>`;
    const ins = rows.filter((r) => r.insiders).sort((a, b) => b.insider_value - a.insider_value);
    $("#ins").innerHTML = ins.length ? ins.slice(0, 8).map((r) => `<div class="mini-row">${tkLink(r.t)} <span class="ell small">${esc((r.insider_names || []).join(", "))}</span><span class="mono">${usd(r.insider_value)}</span></div>`).join("") : `<p class="muted">None of the scored stocks.</p>`;
    const hs = Object.values(G.hearings || {}).sort((a, b) => a.date.localeCompare(b.date));
    $("#hear").innerHTML = hs.length ? hs.slice(0, 8).map((h) => `<div class="mini-row"><span class="mono small">${fmtDate(h.date, { day: "numeric", month: "short" })}</span><span class="ell small">${esc(h.title)} · ${esc(h.committee)}</span></div>`).join("") : `<p class="muted">${G.hearing_count ? "None touch the scored stocks." : "None scheduled (the House may be in recess)."}</p>`;
    const sec = new Map(); for (const r of rows) { const g = sec.get(r.sector || "Other") || { n: 0, s: 0 }; g.n++; g.s += r.score; sec.set(r.sector || "Other", g); }
    const secs = [...sec.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8), smx = secs[0] ? secs[0][1].n : 1;
    $("#secs").innerHTML = secs.map(([k, g]) => `<div class="bar-row"><span>${esc(k)}</span><span class="mono muted">${g.n} · avg ${Math.round(g.s / g.n)}%</span><div class="track"><div class="fill" style="width:${(g.n / smx * 100).toFixed(1)}%"></div></div></div>`).join("");
    const posts = rows.filter((r) => (r.leaders || []).length);
    $("#posts").innerHTML = posts.length ? posts.slice(0, 8).map((r) => `<div class="mini-row">${tkLink(r.t)} <span class="ell small">${esc([...new Set(r.leaders.map((p) => p.who))].join(", "))}: “${esc((r.leaders[0].text || "").slice(0, 90))}…”</span></div>`).join("") : `<p class="muted">None of the scored stocks were named.</p>`;
    table($("#tbl"), [
      { key: "t", label: "Stock", html: (r) => `${tkLink(r.t)} <span class="hide-sm">${esc(cleanName(r.name))}</span>`, sort: (r) => r.t },
      { key: "score", label: "Score", cls: "r", html: (r) => `<b>${Math.round(r.score)}%</b>`, sort: (r) => r.score },
      { key: "members", label: "Net buyers", cls: "r", html: (r) => `${r.members} <span class="muted small">${pct(r.npr_trades, 0)} · ${pct(r.npr_dollars, 0)}</span>`, title: "Net buyers; then net buying by number of trades and by dollars", sort: (r) => r.members },
      { key: "committee", label: "Committee", cls: "r", html: (r) => r.committee || "–", sort: (r) => r.committee },
      { key: "contracts", label: "Contracts", cls: "r", html: (r) => r.contracts ? usd(r.contracts) : "–", sort: (r) => r.contracts },
      { key: "lobbying", label: "Lobbying", cls: "r hide-sm", hideSm: true, html: (r) => r.lobbying ? usd(r.lobbying) : "–", sort: (r) => r.lobbying },
      { key: "ins", label: "Insiders", cls: "r hide-sm", hideSm: true, html: (r) => r.insiders ? `${r.insiders} · ${usd(r.insider_value)}` : "–", sort: (r) => r.insider_value },
      { key: "who", label: "Bought by", cls: "hide-sm", hideSm: true, html: (r) => `<span class="faces">${(r.who || []).slice(0, 4).map((id) => byId.get(id)).filter(Boolean).map((m) => `<span class="who ${esc(m.party || "I")}" title="${esc(m.name)}">${photo(m)}</span>`).join("")}</span>` },
    ], rows, { sort: "score", href: (r) => `#/stock/${encodeURIComponent(r.t)}` });
  }

  // ---------- Market drops: why did the market fall? ----------
  let MOVES = null;
  const loadMoves = () => MOVES ? Promise.resolve(MOVES) : loadScript("../market_moves.js").then(() => (MOVES = window.CTC_MOVES || null));
  async function pageDrops() {
    setNav("drops");
    app.innerHTML = `<h1>Why did the market drop?</h1><p class="loading">Loading…</p>`;
    const M = await loadMoves(); if (location.hash !== "#/drops") return;
    const eps = (M && M.episodes) || [];
    const hl = (it) => `<li><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a> <span class="muted small">${esc(it.source)} · ${fmtDate(it.date, { day: "numeric", month: "short" })}</span></li>`;
    const before = (e) => {  // members' sales of the hardest-hit stocks in the 30 days before the drop
      const tks = new Set(e.big.map((b) => b[0])), a = Date.parse(e.start + "T00:00:00Z");
      const L = trades.filter((t) => t.side === "S" && tks.has(t.t) && t.time < a && t.time >= a - 30 * DAY && !isBiz(members[t.m]));
      const u = [...new Map(L.map((t) => [t.m + t.t, t])).values()];
      return u.length ? `<div class="small"><b>Sold by members in the 30 days before:</b> ${u.slice(0, 6).map((t) => `${esc(members[t.m].name)} (${tkLink(t.t)} ${rangeText(t)})`).join(", ")}${u.length > 6 ? ` and ${u.length - 6} more` : ""}</div>` : "";
    };
    const W = 1000, H = 170, spyv = D.spy.filter((v) => v != null), lo = Math.min(...spyv), hi = Math.max(...spyv), X = (i) => 8 + i / (NW - 1) * (W - 16), Y = (v) => 8 + (hi - v) / (hi - lo) * (H - 30);
    const spyLine = D.spy.map((v, i) => v == null ? "" : `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
    app.innerHTML = `<h1>Why did the market drop?</h1>
      <p class="lede">Every sharp fall since ${fmtDate(D.start, { month: "short", year: "numeric" })}: days the S&amp;P 500 fell 1.5% or more (or the Nasdaq 100 2%), weeks it fell 3% or more (Nasdaq 4%), and slower slides over two weeks. For each: how far it fell, what fell most, the headlines that day, and the explanations that came out in the week after.</p>
      <div class="card">${svgBox(W, H, `${eps.map((e) => { const a = weekOf(e.start), b = weekOf(e.end); return `<rect x="${X(a - 0.5).toFixed(1)}" y="0" width="${Math.max(3, X(b + 0.5) - X(a - 0.5)).toFixed(1)}" height="${H - 22}" fill="var(--bad)" fill-opacity=".2"><title>${fmtDate(e.start)}: S&P 500 ${pct(e.spy)}, Nasdaq ${pct(e.qqq)}</title></rect>`; }).join("")}<path d="${spyLine}" fill="none" stroke="var(--chart)" stroke-width="2"/><text x="8" y="${H - 5}" font-size="12" fill="var(--muted)">S&amp;P 500, weekly · red: the drops below</text>`, "S&P 500 with the drops shaded")}</div>
      <div class="grid cols-2 section">
        ${card("What professional investors watch", "", `<ul class="plain small">
          <li><b>The Federal Reserve</b>: rate decisions, meeting minutes and the chair's speeches. Higher-for-longer rates hit expensive tech and growth stocks hardest.</li>
          <li><b>Economic data</b>: inflation (CPI, PCE), the monthly jobs report, GDP and retail sales, on a fixed calendar.</li>
          <li><b>Bond yields</b>: the 10-year Treasury yield. A fast rise usually means stocks fall.</li>
          <li><b>Big-company earnings</b>: Nvidia, Microsoft, Apple and the other megacaps move the whole index; one chipmaker's warning can sink the rest.</li>
          <li><b>Fear gauges</b>: the VIX volatility index, credit spreads, oil and the dollar.</li>
          <li><b>Policy and geopolitics</b>: tariffs, chip export rules, wars, elections.</li>
          <li><b>News</b>: Reuters, Bloomberg, The Wall Street Journal, the Financial Times and CNBC, where the headlines below come from.</li></ul>`)}
        ${card("How to read a drop", "", `<p class="small">The day's headlines say <i>what</i> fell. The <i>why</i> usually takes a few days: analysts' notes, earnings calls and data releases explain it in the week after, so each drop below has both. A drop that is mostly one industry (semiconductors, say) is usually news about that industry; one that hits everything is usually rates, data, policy or a shock like a war.</p>`)}
      </div>
      <div class="drops">${eps.map((e, k) => `<div class="card drop${k === 0 ? " latest" : ""}"><div class="drop-head"><span class="muted small">${k === 0 ? "Latest · " : ""}${fmtDate(e.start)}${e.end !== e.start ? ` – ${fmtDate(e.end)}` : ""}</span><h2>S&amp;P 500 <span class="${cls(e.spy)}">${pct(e.spy)}</span> · Nasdaq 100 <span class="${cls(e.qqq)}">${pct(e.qqq)}</span>${e.dia != null ? ` · Dow <span class="${cls(e.dia)}">${pct(e.dia)}</span>` : ""}</h2>
          <span class="small muted">Worst day ${fmtDate(e.worst_day.date, { day: "numeric", month: "short" })}: S&amp;P ${pct(e.worst_day.spy)}, Nasdaq ${pct(e.worst_day.qqq)}</span></div>
        <div class="drop-body"><div class="drop-side"><div class="small"><b>Fell most:</b> ${e.sectors.map(([s, r]) => `${esc(s)} <span class="down">${pct(r, 0)}</span>`).join(" · ")}</div>
          <div class="chips">${e.big.map(([tk, r]) => `<span>${tkLink(tk)} <span class="down small">${pct(r, 0)}</span></span>`).join("")}</div>${before(e)}</div>
          <div class="news"><h3>What happened</h3><ul>${e.what.map(hl).join("") || `<li class="muted">No headlines found.</li>`}</ul>
          ${e.why.length ? `<h3>Why: the week after</h3><ul>${e.why.map(hl).join("")}</ul>` : ""}</div></div></div>`).join("") || `<p class="muted">No market drop data yet.</p>`}</div>
      <p class="small muted">Headlines from Google News, kept to well-known financial outlets; links open the publisher. Moves are closing prices, from the close before the drop to its lowest close.</p>`;
  }

  // ---------- routing ----------
  function route(keepScroll) {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, "")), [page, arg] = h.split("/");
    if (keepScroll !== true) window.scrollTo(0, 0);
    if (page !== "member") memberLocal = null;
    if (page === "politicians") pagePoliticians();
    else if (page === "stocks") pageStocks();
    else if (page === "member" && arg) pageMember(arg);
    else if (page === "stock" && arg) pageStock(arg.toUpperCase());
    else if (page === "leaders") pageLeaders();
    else if (page === "signals") pageSignals();
    else if (page === "drops") pageDrops();
    else pageHome();
    const h1 = $("h1", app);
    if (h1 && !["signals", "drops"].includes(page)) {
      const strip = document.createElement("div"); strip.innerHTML = filterStrip();
      const anchorEl = h1.closest(".profile, .price-head") || h1;
      (anchorEl.nextElementSibling && anchorEl.nextElementSibling.classList.contains("lede") ? anchorEl.nextElementSibling : anchorEl).after(strip.firstElementChild);
      bindStrip(app);
    }
    setTimeout(() => { const t = $("h1", app); document.title = t && page ? `${t.textContent} · Congress Trade Check` : "Congress Trade Check"; }, 0);
  }
  window.addEventListener("hashchange", () => route());
  $("#theme").addEventListener("click", () => {
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t; try { localStorage.setItem("ctc-theme", t); } catch (e) { /* storage blocked */ }
  });
  $("#filterBtn").addEventListener("click", () => $("#fpanel").hidden ? openFilter() : closeFilter());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#fpanel").hidden) closeFilter(); });
  updateFilterBadge();
  bindSearch();
  route();
  // the hype check also uses Public signals (company insiders, federal contracts): redraw once it has loaded
  loadSignals().then((G) => { SIG_BY = new Map(((G && G.stocks) || []).map((r) => [r.t, r])); hypeCache.clear(); if ($("[data-hype]", app)) route(true); });
})();
