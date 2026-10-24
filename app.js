/* Congress Trade Check, website design (v2).
   Pages with their own links, global search, sortable tables and interactive charts, built from the same data files
   as the classic site (data.js, series.js, prices.js ...). What the classic site's Data Visualization drew as
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
  // faces: the large portrait file where there is one, otherwise the small photo from photos.js (loaded in the background)
  const photoSrc = (m) => m.hd ? `portraits/${encodeURIComponent(m.id)}.jpg` : (window.CTC_PHOTOS && window.CTC_PHOTOS[m.id]) || "";
  const photo = (m) => { const src = photoSrc(m); return `<img ${src ? `src="${src}"` : ""} data-pid="${esc(m.id)}" alt="" loading="lazy" onerror="window.__ctcPhotoFail&&window.__ctcPhotoFail(this)">`; };
  window.__ctcPhotoFail = (img) => { const u = window.CTC_PHOTOS && window.CTC_PHOTOS[img.dataset.pid]; if (u && img.src !== u) img.src = u; else img.removeAttribute("src"); };
  loadScript("photos.js").then(() => $$("img[data-pid]").forEach((img) => { if (!img.getAttribute("src") || img.naturalWidth === 0) { const u = (window.CTC_PHOTOS || {})[img.dataset.pid]; if (u) img.src = u; } }));
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

  // ---------- filters: each Congress page keeps its own, shown in its pinned bar with only the choices it uses ----------
  const FDEF = { chamber: "all", committee: "all", owner: "all", timing: "trade", hideBig: true, sp500: true, capMax: "0", exclude: "",
    committeeOnly: true, lateOnly: false, options: true, spikes: true };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("ctc-state") || "{}") || {}; } catch (e) { /* storage blocked */ }
  // what the old site-wide Filter was set to is where every page starts
  const START = { ...FDEF, ...Object.fromEntries(Object.keys(FDEF).filter((k) => k in saved).map((k) => [k, saved[k]])) };
  if (!(saved.v >= 14) && /^\s*NVDA,\s*AAPL,\s*GOOGL\s*$/i.test(START.exclude || "")) START.exclude = "";  // the old default list is cleared
  let PF = {};
  try { PF = JSON.parse(localStorage.getItem("ctc-v2-pagefilters") || "{}") || {}; } catch (e) { /* storage blocked */ }
  const S = { ...START };  // the settings in force: the open page's
  let fPage = null;
  const usePageFilter = (key) => {
    fPage = key; Object.assign(S, START, PF[key] || {});
    if (S.committee !== "all" && !D.committees[S.committee]) S.committee = "all";
    applyFilterSettings();
  };
  const saveFilter = () => { if (!fPage) return; PF[fPage] = Object.fromEntries(Object.keys(FDEF).map((k) => [k, S[k]])); try { localStorage.setItem("ctc-v2-pagefilters", JSON.stringify(PF)); } catch (e) { /* storage blocked */ } };
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
  // which choices each page uses: [in the bar, under "More filters"]
  const PAGE_FILTERS = {
    congress: [["chamber", "committee", "hideBig", "committeeOnly"], ["lateOnly", "owner", "options", "timing", "bigOpts"]],
    politicians: [["chamber", "committee", "hideBig", "committeeOnly"], ["lateOnly", "owner", "options", "timing", "bigOpts"]],
    stocks: [["chamber", "committee", "hideBig", "committeeOnly"], ["lateOnly", "owner", "options", "bigOpts"]],
    stock: [["chamber", "committee", "committeeOnly"], ["lateOnly", "owner", "options", "timing"]],
    member: [["hideBig", "committeeOnly"], ["lateOnly", "owner", "options", "timing", "bigOpts"]],
    leaders: [["chamber"], ["owner", "options"]],
  };
  const FILTER_PAGE = { congress: "congress", politicians: "politicians", stocks: "stocks", stock: "stock", member: "member", leaders: "leaders" };
  let fMoreOpen = false;
  // the page's filter controls: `bar` goes in its pinned toolbar, `panel` (the extra choices) right after the toolbar
  function pageFilters() {
    const set = PAGE_FILTERS[fPage]; if (!set) return { bar: "", panel: "" };
    const [main, more] = set;
    const chip = (k, label, title) => `<button type="button" class="fchip" data-fc="${k}" aria-pressed="${!!S[k]}" title="${esc(title)}">${label}</button>`;
    const seg = (k, opts) => `<div class="seg" data-fk="${k}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(S[k]) === v}">${l}</button>`).join("")}</div>`;
    const chk = (k, label) => `<label class="check"><input type="checkbox" data-fc="${k}"${S[k] ? " checked" : ""}> ${label}</label>`;
    const comms = Object.entries(D.committees).filter(([, c]) => c.name).sort((a, b) => a[1].name.localeCompare(b[1].name));
    const C = {
      chamber: () => `<select data-fs="chamber" aria-label="Whose trades">${[["all", "Congress and officials"], ["H", "House"], ["S", "Senate"], ["E", "Executive branch"], ["C", "Business leaders"]].map(([v, l]) => `<option value="${v}"${S.chamber === v ? " selected" : ""}>${l}</option>`).join("")}</select>`,
      committee: () => `<select data-fs="committee" aria-label="Committee or department"><option value="all">All committees</option>${comms.map(([k, c]) => `<option value="${esc(k)}"${S.committee === k ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>`,
      hideBig: () => chip("hideBig", "No large caps", "Leave out widely held stocks, funds and ETFs"),
      committeeOnly: () => chip("committeeOnly", "Committee-linked only", "House and Senate trades in sectors their committees oversee"),
      lateOnly: () => `<div class="field">${chk("lateOnly", "Late disclosures only <span class=\"muted\">(filed after the 45-day deadline)</span>")}</div>`,
      options: () => `<div class="field">${chk("options", "Include options <span class=\"muted\">(valued at the share price)</span>")}</div>`,
      owner: () => `<div class="field"><span class="flbl">Account</span>${seg("owner", [["all", "All"], ["self", "Own"], ["SP", "Spouse"], ["DC", "Children"], ["JT", "Joint"]])}</div>`,
      timing: () => `<div class="field"><span class="flbl">Returns measured from</span>${seg("timing", [["trade", "Trade date"], ["public", "Disclosure date"]])}</div>`,
      bigOpts: () => S.hideBig ? `<div class="field"><span class="flbl">"No large caps" leaves out</span>${chk("sp500", "S&amp;P 500 companies")}${chk("spikes", "except during buying spikes")}
        <label class="check">Market cap above <select data-fs="capMax">${[["0", "No limit"], ["10000000000", "$10 billion"], ["50000000000", "$50 billion"], ["200000000000", "$200 billion"]].map(([v, l]) => `<option value="${v}"${String(S.capMax) === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="check">Always leave out <input type="text" data-ft="exclude" value="${esc(S.exclude)}" placeholder="e.g. NVDA, AAPL" spellcheck="false"></label></div>` : "",
    };
    const keysOf = { bigOpts: ["sp500", "spikes", "capMax", "exclude"] };
    const changedMore = more.flatMap((k) => keysOf[k] || [k]).filter((k) => String(S[k]) !== String(FDEF[k])).length;
    const changedAny = Object.keys(FDEF).some((k) => String(S[k]) !== String(FDEF[k]));
    return {
      bar: `<span class="fsep" aria-hidden="true"></span>${main.map((k) => C[k]()).join("")}
        <button type="button" class="fchip fmore-btn" data-fmore aria-expanded="${fMoreOpen}">More filters${changedMore ? ` · ${changedMore}` : ""}</button>${changedAny ? `<button type="button" class="linkbtn" data-freset>Reset</button>` : ""}`,
      panel: `<div class="wrap fmore-panel"${fMoreOpen ? "" : " hidden"}>${more.map((k) => C[k]()).join("")}</div>`,
    };
  }
  function bindFilters() {
    const changed = () => { saveFilter(); applyFilterSettings(); route(true); };
    $$("[data-fk]").forEach((g) => $$("button", g).forEach((b) => b.addEventListener("click", () => { S[g.dataset.fk] = b.dataset.v; changed(); })));
    $$("button[data-fc]").forEach((b) => b.addEventListener("click", () => { S[b.dataset.fc] = !S[b.dataset.fc]; changed(); }));
    $$("input[data-fc]").forEach((c) => c.addEventListener("change", () => { S[c.dataset.fc] = c.checked; changed(); }));
    $$("[data-fs]").forEach((c) => c.addEventListener("change", () => { S[c.dataset.fs] = c.value; changed(); }));
    let tm; $$("[data-ft]").forEach((c) => c.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => { S[c.dataset.ft] = c.value; changed(); }, 500); }));
    $$("[data-fmore]").forEach((b) => b.addEventListener("click", () => { fMoreOpen = !fMoreOpen; b.setAttribute("aria-expanded", String(fMoreOpen)); const pn = $("#subbar .fmore-panel") || $(".fmore-panel", app); if (pn) pn.hidden = !fMoreOpen; }));
    $$("[data-freset]").forEach((b) => b.addEventListener("click", () => { Object.assign(S, FDEF); changed(); }));
  }

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
  const setNav = (k) => $$(".nav a[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === k || (a.dataset.group || "").split(",").includes(k)));
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
  function pageHome() {  // the Congress page (it was the home page before the finance pages)
    setNav("congress");
    const PF_ = pageFilters();
    const s0 = since(), win = trades.filter((t) => t.time >= s0 && t.side !== "O" && pass(t));
    const buys = win.filter((t) => t.side === "B" && securities(t)), sells = win.filter((t) => t.side === "S" && securities(t));
    const lastFiled = trades.reduce((mx, t) => t.fd && t.fd > mx ? t.fd : mx, "");
    app.innerHTML = `
      <h1>What Congress is trading</h1>
      <p class="lede">Stock and bond trades by members of Congress and senior officials, from their public disclosure reports. Filings up to <b>${fmtDate(lastFiled)}</b>; prices to ${fmtDate(D.prices_through)}.</p>
      <div class="toolbar pin-top">${periodSeg()}${PF_.bar}</div>${PF_.panel}
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
      $("#moveBanner").innerHTML = `<a class="banner" href="#/drops"><b>Market drop ${fmtDate(e.start, { day: "numeric", month: "short" })}${e.end !== e.start ? `–${fmtDate(e.end, { day: "numeric", month: "short" })}` : ""}:</b> S&amp;P 500 ${pct(e.spy)}, Nasdaq 100 ${pct(e.qqq)}. ${esc(e.summary || (e.what[0] ? e.what[0].title : ""))} <span>More →</span></a>`;
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
    const PF_ = pageFilters();
    const s0 = since(), g = new Map();
    for (const t of trades) {
      if (t.time < s0 || t.side === "O" || !pass(t, { person: false })) continue;
      const e = g.get(t.m) || { m: members[t.m], b: [], s: [], last: 0 }; (t.side === "B" ? e.b : e.s).push(t); e.last = Math.max(e.last, t.time); g.set(t.m, e);
    }
    const rows = [...g.values()].map((e) => ({ ...e, eb: est(e.b).best, es: est(e.s).best, n: e.b.length + e.s.length, st: stats(e.b, B()) }));
    app.innerHTML = `<h1>Politicians</h1><p class="lede">Everyone with disclosed trades ${periodWords()}. Click a column to sort, a row to open their page.</p>
      <div class="toolbar pin-top">${periodSeg()}${PF_.bar}<input type="search" id="filt" placeholder="Name or state"><span class="count" id="cnt"></span></div>${PF_.panel}<div class="card" id="tbl"></div>`;
    bindPeriod(app);
    const ch = S.chamber; let q = "";
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
    $("#filt").addEventListener("input", (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    draw();
  }

  function pageStocks() {
    setNav("stocks");
    const PF_ = pageFilters();
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
      <div class="toolbar pin-top">${periodSeg()}${PF_.bar}<input type="search" id="filt" placeholder="Ticker, company or sector"><span class="count" id="cnt"></span></div>${PF_.panel}<div class="card" id="tbl"></div>`;
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
  function pageMember(id) {
    setNav("politicians");
    const m = members.find((x) => x.id === id);
    if (!m) { app.innerHTML = `<h1>Not found</h1><p>No politician with that link. <a href="#/politicians">See everyone</a>.</p>`; return; }
    const f = S, base = B(), PF_ = pageFilters();
    const s0 = since(), allMine = trades.filter((t) => t.m === m.i && t.side !== "O");
    const mine = allMine.filter((t) => t.time >= s0 && pass(t, { person: false }, f));
    const buys = mine.filter((t) => t.side === "B"), sells = mine.filter((t) => t.side === "S");
    const sb = buys.filter(securities), st = stats(sb, base);
    const comm = (m.committees || []).map((c) => D.committees[c] && D.committees[c].name).filter(Boolean);
    app.innerHTML = `<div class="crumbs"><a href="#/politicians">Politicians</a></div>
      <div class="profile ${esc(m.party || "I")}">${photo(m)}
        <div><h1>${esc(m.name)}</h1><div class="muted">${partyTag(m)} ${esc(seat(m))}${m.former ? " · former" : ""}</div>
        <div class="tags">${comm.slice(0, 6).map((c) => `<span class="tag">${esc(c)}</span>`).join("")}</div></div></div>
      <div class="toolbar pin-top">${periodSeg()}${PF_.bar}</div>${PF_.panel}
      <div class="grid cols-4">
        ${statCard("Trades", mine.length.toLocaleString(), `${buys.length.toLocaleString()} buys · ${sells.length.toLocaleString()} sales`)}
        ${statCard("Bought", buys.length ? usd(est(buys).best) : "–", buys.length ? `likely ${span(est(buys))}` : periodWords(), "up")}
        ${statCard("Sold", sells.length ? usd(est(sells).best) : "–", sells.length ? `likely ${span(est(sells))}` : periodWords(), "down")}
        ${statCard("Their buys vs S&amp;P 500", st.n ? pct(st.diff) : "–", st.n ? `${pct(st.ret)} vs ${pct(st.spyRet)} · beat it on ${Math.round(st.win * 100)}% of buys` : "no priced buys", cls(st.diff))}
      </div>
      <div class="section card"><h2>Hypothetical portfolio of their buys <span class="muted">return on the money put in, from the ${f.timing === "public" ? "disclosure" : "trade"} date</span></h2>
        <div class="lines" id="lines"></div><div id="portfolio"></div>
        <p class="small muted">Each buy enters at its best-estimate amount and leaves when they report a full sale of the stock; otherwise it is valued at the latest close. "S&amp;P 500" puts the same dollars in an S&amp;P 500 fund on the same days.</p></div>
      <div class="section">${card(`${esc(m.name)}'s biggest buys`, `the 15 largest ${periodWords()}, what they sold and what they still hold`, `<div id="ring" class="ring2"></div>`)}</div>
      <div class="grid cols-2 section">
        ${card("Scorecard", "their buys against the S&amp;P 500", `<div id="score"></div>`)}
        ${card("Factsheet", "", `<div id="facts"></div>`)}
      </div>
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
    if (t.st && t.st[1] !== "Funds") name = cleanName(t.st[0]).replace(/\s*-?\s*(American )?Depositary Shares?.*$/i, "").replace(/[,.]?\s+(Inc|Corp|Corporation|Ltd|Plc|Co)\.?$/i, "");
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
  const loadMaturity = () => MATURITY ? Promise.resolve(MATURITY) : loadScript("bond_maturity.js").then(() => (MATURITY = window.CTC_MATURITY || {}));
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
    return ((kind === "fund" ? name : readableIssuer(name)) || a).replace(/\bIshares\b/gi, "iShares").replace(/\bSpdr\b/g, "SPDR");
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
  const loadPrices = () => PRICES ? Promise.resolve(PRICES) : (pricesPromise ||= loadScript("prices.js").then(() => (PRICES = window.CTC_PRICES || null)));
  async function pageStock(tk) {
    setNav("stocks");
    const st = stocks[tk];
    if (!st) { app.innerHTML = `<h1>Not found</h1><p>No stock with that ticker. <a href="#/stocks">See every stock</a>.</p>`; return; }
    const PF_ = pageFilters(), s0 = since(), list = trades.filter((t) => t.t === tk && t.time >= s0 && t.side !== "O" && pass(t, { big: false }));
    const buys = list.filter((t) => t.side === "B"), sells = list.filter((t) => t.side === "S");
    app.innerHTML = `<div class="crumbs"><a href="#/stocks">Stocks</a></div>
      <div class="price-head"><div class="ph-left">${logoBox(tk, "var(--chart)", 52)}<div><h1>${esc(cleanName(st[0]))}</h1><div class="muted"><span class="tk">${esc(tk)}</span> ${esc([st[3] || st[2], st[1]].filter(Boolean).join(" · "))}${st[4] ? ` · market value ${usd(st[4])}` : ""}</div></div></div>
        <div class="px" id="px"></div></div>
      <div class="toolbar pin-top">${periodSeg()}${PF_.bar}</div>${PF_.panel}
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
    const PF_ = pageFilters(), from = Math.max(since(), Date.parse(D.start + "T00:00:00Z")), rows = followScores(from);
    app.innerHTML = `<h1>Copy-trading leaderboard</h1>
      <p class="lede">Who would have been worth copying: each politician's stock buys, bought on the day they were disclosed, ${periodWords()}. Scored out of 100%: edge over the S&amp;P 500 (40%), hit rate (25%), reporting speed (15%) and track record (20%). At least 5 buys to be ranked.</p>
      <div class="toolbar pin-top">${periodSeg()}${PF_.bar}</div>${PF_.panel}<div id="podium" class="podium"></div><div class="card section" id="tbl"></div>
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
  const loadSignals = () => SIGNALS ? Promise.resolve(SIGNALS) : loadScript("signals.js").then(() => (SIGNALS = window.CTC_SIGNALS || { stocks: [] }));
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
  const loadMoves = () => MOVES ? Promise.resolve(MOVES) : loadScript(`market_moves.js?v=6&h=${Math.floor(Date.now() / 3.6e6)}`).then(() => (MOVES = window.CTC_MOVES || null));
  let dropInd = "all", dropRange = "all", thRange = "1y";
  // the US stock market's clock (New York time): regular trading 9:30am to 4:00pm ET, Monday to Friday
  // (exchange holidays aren't known here, so a holiday shows as a normal weekday)
  function usMarket() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
    const date = `${parts.year}-${parts.month}-${parts.day}`, mins = (+parts.hour % 24) * 60 + +parts.minute, weekend = parts.weekday === "Sat" || parts.weekday === "Sun";
    const time = `${(+parts.hour % 12) || 12}:${parts.minute}${+parts.hour >= 12 ? "pm" : "am"} ET`;
    if (weekend) return { date, open: false, text: `Market closed for the weekend · opens Monday 9:30am ET (now ${time})` };
    if (mins < 570) return { date, open: false, text: `Pre-market · opens 9:30am ET (now ${time}); today's moves appear after the 4:00pm close` };
    if (mins < 960) return { date, open: true, text: `Market open now (${time}) · today's moves appear after the 4:00pm ET close` };
    return { date, open: false, text: `Market closed at 4:00pm ET (now ${time})` };
  }
  // "what happened", in words, from the numbers: how far, over how long, what moved most
  const XNAMES = { GFS: "GlobalFoundries", LAC: "Lithium Americas", TMQ: "Trilogy Metals", TSM: "TSMC", ASML: "ASML", LLY: "Eli Lilly", "BRK.B": "Berkshire Hathaway", SPCX: "SpaceX", AMZN: "Amazon" };  // listed names missing from the stock list
  const coName = (tk) => XNAMES[tk] && stocks[tk] ? XNAMES[tk] : stocks[tk] ? cleanName(stocks[tk][0]).replace(/\s+(Sponsored|Corporation|Oyj|AG|SE)\b.*$/i, "") : XNAMES[tk] || tk;
  const spanTxt = (a, b) => a === b ? `on ${fmtDate(a, { day: "numeric", month: "short" })}` : `from ${fmtDate(a, { day: "numeric", month: "short" })} to ${fmtDate(b, { day: "numeric", month: "short" })}`;
  const pctAbs = (r, d = 1) => `${Math.abs(r * 100).toFixed(d)}%`;
  const dropWhat = (e) => {
    const up = e.themes && MOVES && MOVES.themes ? Object.entries(e.themes).filter(([, r]) => r >= 0.01).map(([k, r]) => `${MOVES.themes[k].name.toLowerCase()} (+${pctAbs(r)})`) : [];
    return `The S&amp;P 500 fell ${pctAbs(e.spy)} and the Nasdaq 100 ${pctAbs(e.qqq)} ${spanTxt(e.start, e.end)}. ${e.sectors[0] ? `${esc(e.sectors[0][0])} was hit hardest (${pct(e.sectors[0][1])}).` : ""} ${e.big.length ? `Among big companies, ${e.big.slice(0, 3).map(([tk, r]) => `${esc(coName(tk))} (${pct(r, 0)})`).join(", ")} fell most.` : ""}${up.length ? ` Not everything fell: ${up.join(", ")} rose.` : ""}`;
  };
  const moveWhat = (t, e) => `${esc(t.name)} ${e.dir === "up" ? (Math.abs(e.move) >= 0.05 ? "jumped" : "rose") : "fell"} ${pctAbs(e.move)} ${spanTxt(e.start, e.end)}, while the S&amp;P 500 ${e.spy >= 0 ? "rose" : "fell"} ${pctAbs(e.spy)}. ${e.most.length ? `${e.most.slice(0, 3).map(([tk, r]) => `${esc(coName(tk))} (${pct(r, 0)})`).join(", ")} moved most.` : ""}`;  // the market or industry, and the chart's time span, chosen on Market drops
  async function pageDrops() {
    setNav("drops");
    app.innerHTML = `<h1>Why did the market drop?</h1><p class="loading">Loading…</p>`;
    const [M, P] = await Promise.all([loadMoves(), loadPrices()]); if (location.hash !== "#/drops") return;
    const eps = (M && M.episodes) || [], TH = M && M.themes;
    const hl = (it) => `<li><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a> <span class="muted small">${esc(it.source)} · ${fmtDate(it.date, { day: "numeric", month: "short" })}</span></li>`;
    // the S&P 500 day by day, and how long each drop took to win back
    const dates = P ? P.dates : [], spy = P ? P.px.SPY : [], di = new Map(dates.map((d, i) => [d, i]));
    for (const e of eps) {
      const a = di.get(e.start), b = di.get(e.end);
      if (a == null || b == null || !spy[a - 1]) continue;
      e.ia = a; e.ib = b; e.level = spy[a - 1];
      let r = null; for (let i = b + 1; i < dates.length; i++) if (spy[i] >= e.level) { r = i; break; }
      e.recover = r == null ? null : Math.round((Date.parse(dates[r]) - Date.parse(e.start)) / DAY);
    }
    // members who sold the hardest-hit stocks in the 30 days before: faces and what they sold
    const before = (e) => {
      const tks = new Set(e.big.map((b) => b[0])), a = Date.parse(e.start + "T00:00:00Z");
      const L = trades.filter((t) => t.side === "S" && tks.has(t.t) && t.time < a && t.time >= a - 30 * DAY && !isBiz(members[t.m]));
      const u = [...new Map(L.map((t) => [t.m + t.t, t])).values()];
      return u.length ? `<div class="dblock"><h4>Sold by members in the 30 days before</h4><div class="sellers">${u.slice(0, 8).map((t) => `<a class="seller" href="#/member/${encodeURIComponent(members[t.m].id)}" title="${esc(members[t.m].name)} sold ${esc(t.t)} ${esc(rangeText(t))} on ${fmtDate(t.d)}"><span class="who ${esc(members[t.m].party || "I")}">${photo(members[t.m])}</span><span class="tk">${esc(t.t)}</span></a>`).join("")}${u.length > 8 ? `<span class="muted small">+${u.length - 8}</span>` : ""}</div></div>` : "";
    };
    // a row of bars: label, bar, value (falls in red; with mid set, falls go left and rises right)
    const bars = (rows, max, diverging = false) => rows.map(([label, r]) => {
      const w = Math.min(100, Math.abs(r) / (max || 1) * 100);
      return `<div class="dbar${diverging ? " div" : ""}"><span class="dl">${label}</span><span class="dt">${diverging ? `<i class="${r < 0 ? "neg" : "pos"}" style="width:${(w / 2).toFixed(1)}%"></i>` : `<i class="${r < 0 ? "neg" : "pos"}" style="width:${w.toFixed(1)}%"></i>`}</span><b class="${cls(r)}">${pct(r, 1)}</b></div>`;
    }).join("");

    // headline numbers
    const open = eps.filter((e) => e.level && e.recover == null);
    // sharp jumps, found the same way as the drops (in the browser, from the daily prices): a day up 1.5% or more
    // (Nasdaq 100 2%), five days up 3% (4%), ten days up 5% (6%); overlapping windows make one jump
    const qq = P ? P.px.QQQ : [], up = (x, i, k) => x[i] && x[i - k] ? x[i] / x[i - k] - 1 : null, wins = [];
    for (let i = 10; i < dates.length; i++) {
      if (up(spy, i, 10) >= 0.05 || up(qq, i, 10) >= 0.06) wins.push([i - 9, i]);
      else if (up(spy, i, 5) >= 0.03 || up(qq, i, 5) >= 0.04) wins.push([i - 4, i]);
      else if (up(spy, i, 1) >= 0.015 || up(qq, i, 1) >= 0.02) wins.push([i, i]);
    }
    const jumps = [];
    for (const [a1, b1] of wins) { const j = jumps[jumps.length - 1]; if (j && a1 <= j[1] + 2) j[1] = Math.max(j[1], b1); else jumps.push([a1, b1]); }
    const jumpList = jumps.map(([a1, b1]) => {
      let top = a1; for (let i = a1; i <= b1; i++) if (qq[i] / qq[a1 - 1] > qq[top] / qq[a1 - 1]) top = i;
      return { ia: a1, ib: top, spy: spy[top] / spy[a1 - 1] - 1, qqq: qq[top] / qq[a1 - 1] - 1 };
    }).filter((j) => j.spy > 0);
    app.innerHTML = `<h1>Why did the market drop?</h1>
      <p class="lede">Every sharp fall in the S&amp;P 500 and Nasdaq 100 since ${fmtDate(D.start, { month: "short", year: "numeric" })}: how far it fell, what fell most, how long it took to win back, and the headlines that day and the week after.</p>
      <div class="toolbar pin-top"><div class="seg" role="group" aria-label="Market or industry"><button type="button" data-ind="all">Whole market</button>${TH ? Object.entries(TH).map(([k, t]) => `<button type="button" data-ind="${k}">${esc(t.name)}</button>`).join("") : ""}</div></div>
      ${TH ? `<div class="card th-top"><h2 id="thTitle">By industry</h2><div id="thBody"></div></div>` : ""}
      <div class="grid cols-4" id="nowCards"></div>
      <div id="recentCards"></div>
      <div class="card section"><h2>The S&amp;P 500, every drop and jump <span class="muted">red above: drops · green below: jumps · darker, bigger move · hover for what happened, click a drop to read it</span></h2>
        <div class="toolbar"><div class="seg" role="group" aria-label="Chart period">${[["1w", "1 week"], ["1m", "1 month"], ["3m", "3 months"], ["6m", "6 months"], ["1y", "1 year"], ["all", `Since ${D.start.slice(0, 4)}`]].map(([v, l]) => `<button type="button" data-cr="${v}" aria-pressed="${v === dropRange}">${l}</button>`).join("")}</div></div>
        <div class="chart" id="dropChart"></div>
        ${open.length ? `<p class="small"><b class="down">Not yet won back:</b> ${open.map((e) => `${fmtDate(e.start, { day: "numeric", month: "short", year: "numeric" })} (${pct(e.spy)})`).join(" · ")}</p>` : ""}</div>
      <h2 class="section">Every market drop</h2>
      <div class="drops">${eps.map((e, k) => {
        const idx = [["S&amp;P 500", e.spy], ["Nasdaq 100", e.qqq], ...(e.dia != null ? [["Dow", e.dia]] : [])], mx = Math.max(...idx.map((x) => Math.abs(x[1] || 0)), ...e.sectors.map((x) => Math.abs(x[1])), 0.01);
        const thr = e.themes && TH ? Object.entries(e.themes).map(([kk, r]) => [esc(TH[kk].name), r]) : [], tmx = Math.max(0.01, ...thr.map((x) => Math.abs(x[1])));
        return `<div class="card drop${k === 0 ? " latest" : ""}" id="drop-${k}"${k >= 3 ? " hidden" : ""}>
          <div class="drop-top"><div><span class="muted small">${k === 0 ? "Latest · " : ""}${fmtDate(e.start)}${e.end !== e.start ? ` – ${fmtDate(e.end)}` : ""} · ${e.days} trading day${e.days === 1 ? "" : "s"}</span>
            <h2>S&amp;P 500 <span class="down">${pct(e.spy)}</span> <span class="muted small">Nasdaq ${pct(e.qqq)}</span></h2></div>
            <span class="rec ${e.recover == null ? "open" : ""}">${e.level ? e.recover == null ? "Not yet recovered" : `Recovered in ${e.recover} days` : ""}</span></div>
          <div class="why-sum"><p><b>What happened:</b> ${dropWhat(e)}</p>${e.summary ? `<p><b>Why:</b> ${esc(e.summary)}</p>` : ""}<div class="ana" data-ana="all|${k}"></div></div>
          <div class="drop-grid">
            <div class="dblock"><h4>How far it fell</h4>${bars(idx, mx)}<p class="small muted">Worst day ${fmtDate(e.worst_day.date, { day: "numeric", month: "short" })}: S&amp;P ${pct(e.worst_day.spy)}, Nasdaq ${pct(e.worst_day.qqq)}</p></div>
            <div class="dblock"><h4>Hardest-hit sectors</h4>${bars(e.sectors.map(([s2, r]) => [esc(s2), r]), mx)}</div>
            ${thr.length ? `<div class="dblock"><h4>By industry</h4>${bars(thr, tmx, true)}</div>` : ""}
            <div class="dblock"><h4>Big companies that fell most</h4><div class="bigfalls">${e.big.map(([tk, r]) => `<a class="bf" href="#/stock/${encodeURIComponent(tk)}">${BRAND[tk] && BRAND[tk][1] ? logoBox(tk, "var(--chart)", 28) : ""}<span class="tk">${esc(tk)}</span><b class="down">${pct(r, 0)}</b></a>`).join("")}</div></div>
          </div>
          ${e.what.length || e.why.length ? `<details class="srcs"><summary>Sources: ${e.what.length + e.why.length} news articles</summary><div class="news2"><div><h3>That week</h3><ul>${e.what.map(hl).join("")}</ul></div>
            ${e.why.length ? `<div><h3>The week after</h3><ul>${e.why.map(hl).join("")}</ul></div>` : ""}</div></details>` : ""}</div>`;
      }).join("") || `<p class="muted">No market drop data yet.</p>`}</div>
      ${eps.length > 3 ? `<div class="more"><button type="button" class="btn" id="moreDrops">Show ${eps.length - 3} more drops</button></div>` : ""}
      <div class="grid cols-2 section">
        ${card("How to read a drop", "", `<p class="small">The day's headlines say <i>what</i> fell. The <i>why</i> usually takes a few days: analysts' notes, earnings calls and data releases explain it in the week after, so each drop has both. A drop that is mostly one industry (semiconductors, say) is usually news about that industry; one that hits everything is usually rates, data, policy or a shock like a war.</p>`)}
        ${card("What professional investors watch", "", `<ul class="plain small">
          <li><b>The Federal Reserve</b>: rate decisions, meeting minutes and the chair's speeches. Higher-for-longer rates hit expensive tech and growth stocks hardest.</li>
          <li><b>Economic data</b>: inflation (CPI, PCE), the monthly jobs report, GDP and retail sales, on a fixed calendar.</li>
          <li><b>Bond yields</b>: the 10-year Treasury yield. A fast rise usually means stocks fall.</li>
          <li><b>Big-company earnings</b>: Nvidia, Microsoft, Apple and the other megacaps move the whole index; one chipmaker's warning can sink the rest.</li>
          <li><b>Fear gauges</b>: the VIX volatility index, credit spreads, oil and the dollar.</li>
          <li><b>Policy and geopolitics</b>: tariffs, chip export rules, wars, elections.</li>
          <li><b>News</b>: Reuters, Bloomberg, The Wall Street Journal, the Financial Times and CNBC, where the headlines come from.</li></ul>`)}
      </div>
      <p class="small muted">Headlines from Google News, kept to well-known financial outlets; links open the publisher. Moves are closing prices, from the close before the drop to its lowest close. Recovered: the first close back at the level before the drop.</p>`;
    // the chart: the S&P 500 day by day over the chosen span; drops shaded red in the top half, jumps green in the
    // bottom half, the biggest labelled; dates along the bottom. Hover a band for what happened, click a drop to read it
    const drawMain = () => {
      const L2 = dates.length - 1, n = { "1w": 5, "1m": 21, "3m": 63, "6m": 126, "1y": 252 }[dropRange], i0 = n ? Math.max(1, L2 - n) : 0, i1 = L2, span = i1 - i0;
      const Wc = 1000, Hc = 340, T0 = 18, B0 = Hc - 44, MID = (T0 + B0) / 2;
      const vals = spy.slice(i0, i1 + 1).filter((v) => v != null), lo = Math.min(...vals) * (span < 70 ? 0.995 : 0.97), hi = Math.max(...vals) * (span < 70 ? 1.003 : 1.01);
      const Xc = (i) => 10 + (Math.max(i0, Math.min(i1, i)) - i0) / Math.max(1, i1 - i0) * (Wc - 70), Yc = (v) => T0 + 4 + (hi - v) / (hi - lo) * (B0 - T0 - 8);
      let line = ""; for (let i = i0; i <= i1; i++) if (spy[i] != null) line += `${line ? "L" : "M"}${Xc(i).toFixed(1)},${Yc(spy[i]).toFixed(1)}`;
      const ticks = [0, 1, 2, 3].map((k) => lo + (hi - lo) * k / 3);
      const sev = (r) => Math.abs(r) >= 0.05 ? 0.5 : Math.abs(r) >= 0.03 ? 0.34 : 0.2;
      const bands = (list, isUp) => {
        let lastLbl = -1e9;
        return list.filter((e) => e.ia != null && e.ib >= i0 && e.ia - 1 <= i1).sort((a, b) => a.ia - b.ia).map((e) => {
          const x = Xc(e.ia - 1), w = Math.max(span < 70 ? 6 : 3, Xc(e.ib) - x), big = (span < 300 || Math.abs(e.spy) >= 0.04 || Math.abs(e.qqq) >= 0.07) && x + w / 2 - lastLbl > 36;
          if (big) lastLbl = x + w / 2;
          const y = isUp ? MID : T0, h = (B0 - T0) / 2;
          return `<g class="dz${isUp ? " up" : ""}" ${isUp ? `data-jp="${jumpList.indexOf(e)}"` : `data-ep="${eps.indexOf(e)}"`}><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${isUp ? "var(--good)" : "var(--bad)"}" fill-opacity="${sev(e.spy)}"/>
            ${big ? `<text x="${(x + w / 2).toFixed(1)}" y="${isUp ? B0 - 6 : T0 + 12}" font-size="11" text-anchor="middle" fill="${isUp ? "var(--good)" : "var(--bad)"}" font-family="var(--font-mono)" font-weight="700">${pct(e.spy, span < 70 ? 1 : 0)}</text>` : ""}</g>`;
        }).join("");
      };
      // dates: every day for a week or a month (a label every few), months for longer spans, years under January
      let axis = "";
      if (span <= 30) {
        const every = span <= 6 ? 1 : 3;
        for (let i = i0, k = 0; i <= i1; i++, k++) { const x = Xc(i).toFixed(1); axis += `<line x1="${x}" x2="${x}" y1="${B0}" y2="${B0 + 4}" stroke="var(--line-strong)"/>${k % every === 0 || i === i1 ? `<text x="${x}" y="${B0 + 18}" font-size="11" fill="var(--muted)" text-anchor="middle">${fmtDate(dates[i], span <= 6 ? { weekday: "short", day: "numeric" } : { day: "numeric", month: "short" })}</text>` : ""}`; }
      } else {
        for (let i = i0 + 1; i <= i1; i++) {
          if (dates[i].slice(0, 7) === dates[i - 1].slice(0, 7)) continue;
          const jan = dates[i].slice(5, 7) === "01", x = Xc(i).toFixed(1), label = span <= 260 || +dates[i].slice(5, 7) % 2 === 1;
          axis += `<line x1="${x}" x2="${x}" y1="${B0}" y2="${B0 + (jan ? 8 : 4)}" stroke="var(--line-strong)"/>${label ? `<text x="${x}" y="${B0 + 18}" font-size="11" fill="var(--muted)" text-anchor="middle">${fmtDate(dates[i], { month: "short" })}</text>` : ""}${jan ? `<text x="${x}" y="${B0 + 34}" font-size="12" font-weight="700" fill="var(--ink-2)" text-anchor="middle">${dates[i].slice(0, 4)}</text>` : ""}`;
        }
      }
      const move = spy[i1] / spy[i0] - 1;
      const ch = $("#dropChart");
      ch.innerHTML = `${svgBox(Wc, Hc, `
          ${ticks.map((v) => `<line x1="10" x2="${Wc - 60}" y1="${Yc(v).toFixed(1)}" y2="${Yc(v).toFixed(1)}" stroke="var(--line)"/><text x="${Wc - 54}" y="${(Yc(v) + 4).toFixed(1)}" font-size="12" fill="var(--muted)" font-family="var(--font-mono)">$${Math.round(v)}</text>`).join("")}
          ${axis}<line x1="10" x2="${Wc - 60}" y1="${MID}" y2="${MID}" stroke="var(--line-strong)" stroke-dasharray="2 4"/>${bands(eps, false)}${bands(jumpList, true)}
          <path d="${line}" fill="none" stroke="var(--chart)" stroke-width="${span < 70 ? 2.4 : 1.8}" stroke-linejoin="round"/>
          <text x="14" y="${T0 - 4}" font-size="12" font-weight="700" fill="${move >= 0 ? "var(--good)" : "var(--bad)"}" font-family="var(--font-mono)">${pct(move)} over this span</text>`, "S&P 500 with every drop and jump marked")}<div class="tip" hidden></div>`;
        const svg = $("svg", ch), tip = $(".tip", ch);
      $$(".dz.up", ch).forEach((g) => {  // a jump: how far it rose
        const j = jumpList[+g.dataset.jp];
        g.addEventListener("mouseenter", () => {
          tip.innerHTML = `<div class="muted">${fmtDate(dates[j.ia])}${j.ib !== j.ia ? ` – ${fmtDate(dates[j.ib])}` : ""}</div><div>S&amp;P 500 <b class="up">${pct(j.spy)}</b> · Nasdaq <b class="up">${pct(j.qqq)}</b></div><div class="small muted">a sharp jump</div>`;
          tip.hidden = false;
          const r = svg.getBoundingClientRect(), gx = g.getBoundingClientRect(), left = gx.left - r.left, tw = tip.offsetWidth;
          tip.style.left = `${Math.max(0, Math.min(r.width - tw, left + (left > r.width / 2 ? -tw - 12 : 12)))}px`; tip.style.top = `${r.height / 2}px`;
        });
        g.addEventListener("mouseleave", () => { tip.hidden = true; });
      });
      $$(".dz:not(.up)", ch).forEach((g) => {
        const e = eps[+g.dataset.ep], k = +g.dataset.ep;
        g.addEventListener("mouseenter", () => {
          tip.innerHTML = `<div class="muted">${fmtDate(e.start)}${e.end !== e.start ? ` – ${fmtDate(e.end)}` : ""}</div><div>S&amp;P 500 <b class="down">${pct(e.spy)}</b> · Nasdaq <b class="down">${pct(e.qqq)}</b></div>
            <div class="small">${e.sectors.slice(0, 2).map(([s2, r]) => `${esc(s2)} ${pct(r, 0)}`).join(" · ")}</div>${e.summary || e.what[0] ? `<div class="small" style="max-width:320px;white-space:normal">${esc(e.summary || e.what[0].title)}</div>` : ""}
            <div class="small muted">${e.recover == null ? "not yet recovered" : `recovered in ${e.recover} days`}</div>`;
          tip.hidden = false;
          const r = svg.getBoundingClientRect(), gx = g.getBoundingClientRect(), left = gx.left - r.left, tw = tip.offsetWidth;
          tip.style.left = `${Math.max(0, Math.min(r.width - tw, left + (left > r.width / 2 ? -tw - 12 : 12)))}px`; tip.style.top = "20px";
        });
        g.addEventListener("mouseleave", () => { tip.hidden = true; });
        g.addEventListener("click", () => { const el = $(`#drop-${k}`); if (el) { if (el.hidden) showAllDrops(); el.scrollIntoView({ behavior: "smooth", block: "start" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); } });
      });
    };
    drawMain();
    $$("[data-cr]").forEach((b) => b.addEventListener("click", () => { dropRange = b.dataset.cr; $$("[data-cr]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); drawMain(); }));
    // today and this week, written out: what happened, why, and the independent analysis
    const recentCard = (key, w) => {
      const src = key === "all" ? (MOVES && MOVES.market) : TH && TH[key]; if (!src || !src[w]) return "";
      const e = src[w]; e.dir = e.move >= 0 ? "up" : "down";
      const t = { name: key === "all" ? "The S&P 500" : TH[key].name };
      const what = key === "all" ? `The S&amp;P 500 ${e.dir === "up" ? "rose" : "fell"} ${pctAbs(e.move)} ${spanTxt(e.start, e.end)}. Among companies worth $50 billion or more, ${e.most.slice(0, 3).map(([tk, r]) => `${esc(coName(tk))} (${pct(r, 1)})`).join(", ")} moved most.` : moveWhat(t, e);
      const mk = usMarket(), lastSess = fmtDate(e.end, { weekday: "long", day: "numeric", month: "short" });
      const lbl = w === "today" ? (e.end === mk.date ? `Today · ${lastSess}` : `Last session · ${lastSess}`) : `This week · ${fmtDate(e.start, { day: "numeric", month: "short" })} – ${fmtDate(e.end, { day: "numeric", month: "short", year: "numeric" })}`;
      return `<div class="card recent ${e.dir}"><div class="tm-head"><span class="tm-big ${cls(e.move)}">${e.dir === "up" ? "▲" : "▼"} ${pctAbs(e.move)}</span>
          <span><b class="rc-lbl">${lbl}</b>${w === "today" ? ` <span class="mkt ${mk.open ? "open" : ""}">${esc(mk.text)}</span>` : ""}<br><span class="muted small">${key === "all" ? "S&amp;P 500" : `${esc(t.name)} · S&amp;P 500 ${pct(e.spy)}`} · past month ${pct(e.month)}</span></span>
          <div class="bigfalls">${e.most.map(([tk, r]) => `<a class="bf" href="#/stock/${encodeURIComponent(tk)}">${BRAND[tk] && BRAND[tk][1] ? logoBox(tk, "var(--chart)", 24) : ""}<span class="tk">${esc(tk)}</span><b class="${cls(r)}">${pct(r, 1)}</b></a>`).join("")}</div></div>
        <div class="recent-body"><div><p><b>What happened:</b> ${what}</p>${e.summary ? `<p><b>Why:</b> ${esc(e.summary)}</p>` : `<p class="muted"><b>Why:</b> not written yet for this ${w === "today" ? "day" : "week"}.</p>`}</div>
          <div class="ana" data-ana="${key}|${w}"></div></div>
        ${e.what.length ? `<details class="srcs"><summary>Sources: ${e.what.length} news articles</summary><ul>${e.what.map(hl).join("")}</ul></details>` : ""}</div>`;
    };
    const drawRecent = (key) => {
      const top = $("#recentCards"), inside = key !== "all" && $("#thRecent"), el = inside || top; if (!el) return;
      if (top) { top.hidden = !!inside; if (inside) top.innerHTML = ""; }
      el.innerHTML = recentCard(key, "today") + recentCard(key, "now"); fillAnalysis(el);
    };
    const showAllDrops = () => { $$(".drops > .drop[hidden]").forEach((d) => { d.hidden = false; }); const b = $("#moreDrops"); if (b) b.parentElement.remove(); };
    if ($("#moreDrops")) $("#moreDrops").addEventListener("click", showAllDrops);
    // where things stand now, for the whole market or one industry: today's move, how far below the year's high, the
    // latest drop so far, and when past drops this deep were won back (an estimate from history, not a forecast)
    const L = dates.length - 1, qqq = P ? P.px.QQQ : [], chg = (x, i, k = 1) => x[i] && x[i - k] ? x[i] / x[i - k] - 1 : null;
    const daily = new Map([["all", spy]]);
    const seriesOf = (key) => {  // an industry's basket day by day: the equal-weight average of its stocks' daily moves
      if (!daily.has(key)) { const tks = TH[key].tickers.filter((t) => P.px[t]), x = [1]; for (let i = 1; i <= L; i++) { const rs = tks.map((t) => P.px[t][i] && P.px[t][i - 1] ? P.px[t][i] / P.px[t][i - 1] - 1 : null).filter((r) => r != null); x.push(x[i - 1] * (1 + (rs.length ? rs.reduce((a, r) => a + r, 0) / rs.length : 0))); } daily.set(key, x); }
      return daily.get(key);
    };
    const dropsOf = (key, x) => {  // its falls, each with the level before it, its low and when it was won back
      const src = key === "all" ? eps : TH[key].events.filter((e) => e.dir === "down");
      return src.map((e) => {
        const ia = di.get(e.start), ib = di.get(e.end); if (ia == null || ib == null || !x[ia - 1]) return null;
        const level = x[ia - 1]; let low = Infinity, lowAt = ia; for (let i = ia; i <= L; i++) { if (i > ib && x[i] >= level) break; if (x[i] < low) { low = x[i]; lowAt = i; } }
        let rec = null; for (let i = ib + 1; i <= L; i++) if (x[i] >= level) { rec = i; break; }
        return { start: e.start, ia, level, low, lowAt, depth: low / level - 1, rec, fromLow: rec == null ? null : Math.max(1, Math.round((Date.parse(dates[rec]) - Date.parse(dates[lowAt])) / DAY)) };
      }).filter(Boolean).sort((a, b) => b.ia - a.ia);
    };
    const dayTxt = (n) => `${n} day${n === 1 ? "" : "s"}`, short = (d) => fmtDate(d, { day: "numeric", month: "short" });
    const drawNow = (key) => {
      const x = seriesOf(key), name = key === "all" ? "S&amp;P 500" : esc(TH[key].name);
      let hi = 0, hiAt = L; for (let i = Math.max(0, L - 252); i <= L; i++) if (x[i] > hi) { hi = x[i]; hiAt = i; }
      let qhi = 0; for (let i = Math.max(0, L - 252); i <= L; i++) if (qqq[i] > qhi) qhi = qqq[i];
      const ds = dropsOf(key, x), cur = ds[0], open = cur && cur.rec == null;
      const alike = cur ? ds.filter((d) => d !== cur && d.fromLow != null && d.depth <= cur.depth * 0.5 && d.depth >= cur.depth * 2).map((d) => d.fromLow).sort((a, b) => a - b) : [];
      const med = alike.length ? alike[Math.floor(alike.length / 2)] : null, eta = open && med != null ? new Date(Date.parse(dates[cur.lowAt] + "T00:00:00Z") + med * DAY).toISOString().slice(0, 10) : null;
      $("#nowCards").innerHTML = [
        statCard(`Today · ${short(dates[L])}`, pct(chg(x, L)), key === "all" ? `S&amp;P 500 · Nasdaq 100 ${pct(chg(qqq, L))} · this week ${pct(chg(x, L, 5))}` : `${name} basket · this week ${pct(chg(x, L, 5))} · S&amp;P 500 ${pct(chg(spy, L))}`, cls(chg(x, L))),
        statCard("Below the high", pct(x[L] / hi - 1), `${name} from its high of ${short(dates[hiAt])}${key === "all" ? ` · Nasdaq 100 ${pct(qqq[L] / qhi - 1)}` : ""}`, cls(x[L] / hi - 1)),
        cur ? statCard(open ? "Latest drop so far" : "Latest drop", pct(cur.depth), open ? `at its lowest ${short(dates[cur.lowAt])}, since ${short(cur.start)} · now ${pct(x[L] / cur.level - 1)} vs before it, ${pct(x[L] / cur.low - 1)} off the low` : `${short(cur.start)}, at its lowest ${short(dates[cur.lowAt])} · won back ${short(dates[cur.rec])}`, "down") : statCard("Latest drop", "–", "no sharp fall since the data starts"),
        cur ? statCard(open ? "Likely recovery" : "Recovered", open ? (eta ? `≈ ${short(eta)}` : "–") : short(dates[cur.rec]), open ? (alike.length ? `from their low, past ${key === "all" ? "" : `${name} `}drops this deep took ${alike[0]}–${dayTxt(alike[alike.length - 1])} to win back; half within ${dayTxt(med)} (${alike.length} drops). An estimate, not a forecast.` : "no past drop this deep to compare") : `${dayTxt(cur.fromLow)} after its low`) : "",
      ].join("");
    };
    // the whole market: every industry side by side; click one to open it
    const overview = () => {
      $("#thTitle").innerHTML = `By industry <span class="muted">how each one is doing now; pick one above for its sharp moves and headlines</span>`;
      $("#thBody").innerHTML = `<div class="inds">${Object.entries(TH).map(([k, t]) => {
        const x = seriesOf(k); let hi = 0; for (let i = Math.max(0, L - 252); i <= L; i++) if (x[i] > hi) hi = x[i];
        const last = t.events[0];
        return `<button type="button" class="ind" data-go="${k}"><b>${esc(t.name)}</b><span class="ind-row"><span>Today</span><b class="${cls(chg(x, L))}">${pct(chg(x, L))}</b></span>
          <span class="ind-row"><span>This week</span><b class="${cls(chg(x, L, 5))}">${pct(chg(x, L, 5))}</b></span><span class="ind-row"><span>Below the high</span><b class="${cls(x[L] / hi - 1)}">${pct(x[L] / hi - 1)}</b></span>
          ${last ? `<span class="ind-last ${last.dir}">${last.dir === "up" ? "▲" : "▼"} ${pct(last.move, 0).replace(/^[+−]/, "")} ${short(last.start)}</span>` : ""}</button>`;
      }).join("")}</div>`;
      $$("[data-go]").forEach((b) => b.addEventListener("click", () => choose(b.dataset.go)));
    };
    // independent analysis: our own reading of each move from the price data, not from the news. How unusual the
    // move was, whether it was the whole market or the industry itself, what came before it, what bonds, credit,
    // gold and energy did over the same days, what happened next, and what members of Congress traded beforehand
    const sigma5 = new Map(), betaOf = new Map();
    const sd5 = (key, x) => { if (!sigma5.has(key)) { const r = []; for (let i = 5; i <= L; i++) if (x[i] && x[i - 5]) r.push(x[i] / x[i - 5] - 1); const m = r.reduce((a, v) => a + v, 0) / r.length; sigma5.set(key, Math.sqrt(r.reduce((a, v) => a + (v - m) ** 2, 0) / r.length)); } return sigma5.get(key); };
    const beta = (key, x, at) => {  // the basket's sensitivity to the S&P 500 over the year before the move
      const k2 = key + "|" + at; if (betaOf.has(k2)) return betaOf.get(k2);
      let sxy = 0, sxx = 0, mx = 0, my = 0, n2 = 0; const pts = [];
      for (let i = Math.max(1, at - 250); i < at; i++) if (x[i] && x[i - 1] && spy[i] && spy[i - 1]) pts.push([spy[i] / spy[i - 1] - 1, x[i] / x[i - 1] - 1]);
      for (const [a, b] of pts) { mx += a; my += b; n2++; } mx /= n2 || 1; my /= n2 || 1;
      for (const [a, b] of pts) { sxy += (a - mx) * (b - my); sxx += (a - mx) ** 2; }
      const bt = sxx ? sxy / sxx : 1; betaOf.set(k2, bt); return bt;
    };
    const mv = (tk, a, b) => { const x = P.px[tk]; return x && x[a] && x[b] ? x[b] / x[a] - 1 : null; };
    const sp500 = Object.keys(P.px).filter((tk) => stocks[tk] && stocks[tk][5]);
    const anaHtml = (key, e) => {
      const isAll = key === "all", x = isAll ? spy : seriesOf(key), ia = di.get(e.start), ib = di.get(e.end);
      if (ia == null || ib == null || ia < 2) return "";
      const a0 = ia - 1, days = ib - a0, move = x[ib] / x[a0] - 1, spyMove = spy[ib] / spy[a0] - 1, name = isAll ? "the S&amp;P 500" : esc(TH[key].name);
      const out = (e.detail || []).map((d) => esc(d).replace(/ → /g, ' <span class="arrow">→</span> '));
      // 2. the whole market, or this industry?
      if (isAll) {
        const each = sp500.map((tk) => mv(tk, a0, ib)).filter((r) => r != null), down = each.filter((r) => r < 0).length, avg = each.reduce((a, r) => a + r, 0) / (each.length || 1);
        out.push(`<b>How broad:</b> ${down} of ${each.length} S&amp;P 500 companies fell (${Math.round(down / (each.length || 1) * 100)}%); the average company moved ${pct(avg)}, against ${pct(move)} for the index. ${down / (each.length || 1) >= 0.75 ? "Nearly everything fell: a market-wide sell-off (rates, the economy, policy or a shock), not one industry." : avg >= 0 ? "The average company actually rose: the fall came from a handful of the biggest stocks." : avg > move + 0.01 ? "The typical company fell less than the index: the drop was concentrated in the biggest stocks." : "A mixed drop: some industries fell hard while others held up."}`);
      } else {
        const bt = beta(key, x, ia), expected = bt * spyMove, own = move - expected;
        const each = TH[key].tickers.map((tk) => [tk, mv(tk, a0, ib)]).filter((r) => r[1] != null), same = each.filter((r) => (r[1] < 0) === (move < 0)).length;
        out.push(`<b>Market or industry:</b> ${name} usually moves ${bt.toFixed(1)}× as much as the S&amp;P 500 (its beta over the year before). The S&amp;P's ${pct(spyMove)} therefore explains about ${pct(expected)}; the other <b>${pct(own)}</b> was specific to ${name}${Math.abs(own) > Math.abs(expected) ? ", so it was mostly industry news, not the wider market" : ", so it was mostly the wider market"}. ${same} of ${each.length} stocks in the basket moved the same way.`);
      }
      // 3. what came before
      const pre = a0 >= 63 && x[a0 - 63] ? x[a0] / x[a0 - 63] - 1 : null;
      let hi = 0; for (let i = Math.max(0, a0 - 252); i <= a0; i++) if (x[i] > hi) hi = x[i];
      if (pre != null) out.push(`<b>What came before:</b> ${name} had ${pre >= 0 ? "gained" : "lost"} ${pctAbs(pre)} in the three months before and was ${pctAbs(x[a0] / hi - 1)} below its 1-year high. ${e.dir !== "up" && pre > 0.15 ? "A fall after a big run-up often includes profit-taking, not only bad news." : e.dir === "up" && pre < -0.1 ? "A jump after a slump is often a rebound as sellers run out." : ""}`);
      // 4. other markets over the same days
      const cross = [["TLT", "long-term Treasury bonds", (r) => r < -0.01 ? " (yields rose)" : r > 0.01 ? " (yields fell)" : ""], ["HYG", "high-yield corporate bonds", (r) => r < -0.015 ? " (credit worries)" : ""], ["GLD", "gold", () => ""], ["XLE", "energy stocks", () => ""], ...(isAll ? [["IWM", "small companies", () => ""]] : [])]
        .map(([tk, nm, note]) => { const r = mv(tk, a0, ib); return r == null ? null : `${nm} ${pct(r)}${note(r)}`; }).filter(Boolean);
      if (cross.length && !(e.detail || []).length) {  // the written points already cover other markets
        const tlt = mv("TLT", a0, ib);
        out.push(`<b>Other markets, same days:</b> ${cross.join(", ")}. ${tlt != null && tlt < -0.015 && move < 0 ? "Falling bond prices mean rising interest rates, which weigh most on expensive growth stocks." : tlt != null && tlt > 0.015 && move < 0 ? "Investors moved into safe government bonds: a flight to safety." : ""}`);
      }
      return `<div class="ana-box"><h5>Independent analysis <span class="muted small">what caused it, step by step, with the numbers from the price data</span></h5><ul>${out.map((o) => `<li>${o}</li>`).join("")}</ul></div>`;
    };
    const fillAnalysis = (root) => $$("[data-ana]", root).forEach((el) => {
      const [key, k] = el.dataset.ana.split("|"), e = k === "now" || k === "today" ? (key === "all" ? MOVES.market : TH[key])[k] : key === "all" ? eps[+k] : TH[key].events[+k];
      if (e) el.innerHTML = anaHtml(key, e);
    });
    fillAnalysis(app);
    if (!TH) { drawNow("all"); drawRecent("all"); return; }
    // one industry over its own period: its basket against the S&P 500 day by day, its sharp moves marked, how many
    // there were and when, then each move as a card (newest six first)
    const TH_SPANS = [["1m", "1 month", 21], ["3m", "3 months", 63], ["6m", "6 months", 126], ["1y", "1 year", 252], ["all", `Since ${D.start.slice(0, 4)}`, 0]];
    const showTheme = (key, every = false) => {  // every: every move in the period, not just the newest six
      const t = TH[key], x = seriesOf(key), Ld = dates.length - 1, span = (TH_SPANS.find((r) => r[0] === thRange) || TH_SPANS[4])[2];
      const i0 = span ? Math.max(1, Ld - span) : 0, Wt = 1000, Ht = 250, n = Ld - i0;
      const vb = x.slice(i0).map((v) => v / x[i0] - 1), vs = spy.slice(i0).map((v) => v && spy[i0] ? v / spy[i0] - 1 : null);
      const allv = [...vb, ...vs.filter((v) => v != null)], lo2 = Math.min(0, ...allv), hi2 = Math.max(0, ...allv), pad = (hi2 - lo2) * 0.08 || 0.02;
      const Xt = (i) => 10 + i / Math.max(1, n) * (Wt - 70), Yt = (v) => 14 + (hi2 + pad - v) / (hi2 - lo2 + 2 * pad) * (Ht - 50);
      const path = (v) => { let d = "", on = false; v.forEach((y, i) => { if (y == null) { on = false; return; } d += `${on ? "L" : "M"}${Xt(i).toFixed(1)},${Yt(y).toFixed(1)}`; on = true; }); return d; };
      const at = (d) => { const i = di.get(d); return i == null ? null : i - i0; };
      let axis = "";
      for (let i = i0 + 1; i <= Ld; i++) {
        if (dates[i].slice(0, 7) === dates[i - 1].slice(0, 7)) continue;
        const jan = dates[i].slice(5, 7) === "01", xx = Xt(i - i0).toFixed(1), label = n <= 260 || +dates[i].slice(5, 7) % 2 === 1;
        axis += `<line x1="${xx}" x2="${xx}" y1="${Ht - 36}" y2="${Ht - 32}" stroke="var(--line-strong)"/>${label ? `<text x="${xx}" y="${Ht - 20}" font-size="11" fill="var(--muted)" text-anchor="middle">${fmtDate(dates[i], { month: "short" })}</text>` : ""}${jan ? `<text x="${xx}" y="${Ht - 4}" font-size="12" font-weight="700" fill="var(--ink-2)" text-anchor="middle">${dates[i].slice(0, 4)}</text>` : ""}`;
      }
      const ev = t.events.filter((e) => e.end >= dates[i0]);
      $("#thBody").innerHTML = `<div class="toolbar"><div class="seg" role="group" aria-label="Industry period">${TH_SPANS.map(([v, l]) => `<button type="button" data-tr="${v}" aria-pressed="${v === thRange}">${l}</button>`).join("")}</div>
          <span class="count">${esc(t.name)} ${pct(vb[n])} · S&amp;P 500 ${pct(vs[n])} over this period</span></div>
        <div class="grid cols-2">
          ${["up", "down"].map((d) => { const list = ev.filter((e) => e.dir === d);
            return `<div class="mini"><span class="lbl">Sharp ${d === "up" ? "jumps" : "falls"}</span><b class="${d}">${list.length}</b><span class="muted small">5 days ${d} ${Math.round(t.cut * 100)}% or more${list[0] ? ` · latest ${fmtDate(list[0].start)}` : " in this period"}</span>
              <span class="mdates">${list.map((e) => `<span class="mdate ${d}" title="${fmtDate(e.start)}${e.end !== e.start ? ` – ${fmtDate(e.end)}` : ""}: ${esc(t.name)} ${pct(e.move)}, S&amp;P 500 ${pct(e.spy)}">${fmtDate(e.start, { day: "numeric", month: "short", year: "2-digit" })} <b>${pct(e.move, 0)}</b></span>`).join("")}</span></div>`; }).join("")}</div>
        <div class="chart" id="thChart">${svgBox(Wt, Ht, `
          ${[lo2, 0, hi2].map((v) => `<line x1="10" x2="${Wt - 60}" y1="${Yt(v).toFixed(1)}" y2="${Yt(v).toFixed(1)}" stroke="var(--line)"/><text x="${Wt - 54}" y="${(Yt(v) + 4).toFixed(1)}" font-size="12" fill="var(--muted)" font-family="var(--font-mono)">${pct(v, 0)}</text>`).join("")}
          ${axis}
          ${ev.map((e) => { const a1 = Math.max(0, (at(e.start) ?? 0) - 1), b1 = at(e.end) ?? n; return `<rect x="${Xt(a1).toFixed(1)}" y="14" width="${Math.max(4, Xt(b1) - Xt(a1)).toFixed(1)}" height="${Ht - 50}" fill="${e.dir === "up" ? "var(--good)" : "var(--bad)"}" fill-opacity=".22"><title>${fmtDate(e.start)}: ${esc(t.name)} ${pct(e.move)} (S&P ${pct(e.spy)})</title></rect>`; }).join("")}
          <path d="${path(vs)}" fill="none" stroke="#eb6834" stroke-width="1.6" stroke-dasharray="5 4"/>
          <path d="${path(vb)}" fill="none" stroke="var(--chart)" stroke-width="2.2"/>
          <line class="cx" x1="0" x2="0" y1="14" y2="${Ht - 36}" stroke="var(--ink-2)" stroke-dasharray="3 3" visibility="hidden"/><circle class="cdot" r="4" fill="var(--chart)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>`, `${t.name} against the S&P 500`)}<div class="tip" hidden></div></div>
        <div class="legend small"><span><i class="sw" style="background:var(--chart)"></i>${esc(t.name)} basket</span><span><i class="sw" style="background:#eb6834"></i>S&amp;P 500</span><span><i class="sw" style="background:var(--good)"></i>sharp jump</span><span><i class="sw" style="background:var(--bad)"></i>sharp fall</span><span class="tks">${t.tickers.map((x2) => tkLink(x2)).join(" ")}</span></div>
        <div id="thRecent"></div>
        <h4 class="th-sub">Sharp moves in this period</h4>
        <div class="thmoves">${ev.map((e, k) => !every && k >= 6 ? "" : `<div class="thmove ${e.dir}" id="thm-${k}"><div class="tm-head"><span class="tm-big ${cls(e.move)}">${e.dir === "up" ? "▲" : "▼"} ${pct(e.move, 0).replace(/^[+−]/, "")}</span>
            <span><b>${fmtDate(e.start, { day: "numeric", month: "short", year: "numeric" })}${e.end !== e.start ? ` – ${fmtDate(e.end, { day: "numeric", month: "short" })}` : ""}</b><br><span class="muted small">S&amp;P 500 ${pct(e.spy)} over the same days</span></span></div>
          <div class="bigfalls">${e.most.map(([tk, r]) => `<a class="bf" href="#/stock/${encodeURIComponent(tk)}">${BRAND[tk] && BRAND[tk][1] ? logoBox(tk, "var(--chart)", 24) : ""}<span class="tk">${esc(tk)}</span><b class="${cls(r)}">${pct(r, 0)}</b></a>`).join("")}</div>
          <div class="why-sum small"><p><b>What happened:</b> ${moveWhat(t, e)}</p>${e.summary ? `<p><b>Why:</b> ${esc(e.summary)}</p>` : ""}<div class="ana" data-ana="${key}|${k}"></div></div>
          ${e.what.length || e.why.length ? `<details class="srcs"><summary>Sources: ${e.what.length + e.why.length} news articles</summary><ul>${[...e.what, ...e.why].map(hl).join("")}</ul></details>` : ""}</div>`).join("") || `<p class="muted">No sharp moves in this period.</p>`}</div>${!every && ev.length > 6 ? `<div class="more"><button type="button" class="btn" id="thOlder">Show ${ev.length - 6} older moves</button></div>` : ""}`;
      fillAnalysis($("#thBody"));
      drawRecent(key);  // the day and week cards, under the chart
      const older = $("#thOlder"); if (older) older.addEventListener("click", () => showTheme(key, true));
      // hover anywhere on the chart: that day's move, the week's, the S&P 500, the stocks that moved most that day,
      // and, inside a shaded band, that jump or fall with its first headline; click a band to read it below
      const chEl = $("#thChart"), svg = $("svg", chEl), tip = $(".tip", chEl), cx = $(".cx", chEl), dot = $(".cdot", chEl);
      const dchg = (arr, i, k = 1) => arr[i] && arr[i - k] ? arr[i] / arr[i - k] - 1 : null;
      const evAt = (i) => ev.find((e) => { const a1 = (at(e.start) ?? 0) - 1, b1 = at(e.end) ?? n; return i >= a1 && i <= b1; });
      const pos = (ev2) => { const r = svg.getBoundingClientRect(), xx = ((ev2.touches ? ev2.touches[0].clientX : ev2.clientX) - r.left) / r.width * Wt; return Math.max(0, Math.min(n, Math.round((xx - 10) / (Wt - 70) * n))); };
      const move = (ev2) => {
        const k = pos(ev2), i = i0 + k, r = svg.getBoundingClientRect(), e = evAt(k);
        cx.setAttribute("x1", Xt(k)); cx.setAttribute("x2", Xt(k)); cx.setAttribute("visibility", "visible");
        dot.setAttribute("cx", Xt(k)); dot.setAttribute("cy", Yt(vb[k])); dot.setAttribute("visibility", "visible");
        const movers = t.tickers.map((tk) => [tk, dchg(P.px[tk] || [], i)]).filter((m) => m[1] != null).sort((a2, b2) => Math.abs(b2[1]) - Math.abs(a2[1])).slice(0, 3);
        tip.innerHTML = `<div class="muted">${fmtDate(dates[i], { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
          <div>${esc(t.name)} <b class="${cls(dchg(x, i))}">${pct(dchg(x, i))}</b> that day · <b class="${cls(dchg(x, i, 5))}">${pct(dchg(x, i, 5))}</b> that week</div>
          <div class="small">S&amp;P 500 ${pct(dchg(spy, i))} that day · ${pct(vb[k])} for the basket since the start of this period</div>
          ${movers.length ? `<div class="small">Moved most: ${movers.map(([tk, m]) => `<b>${esc(tk)}</b> <span class="${cls(m)}">${pct(m)}</span>`).join(" · ")}</div>` : ""}
          ${e ? `<div class="tip-ev ${e.dir}"><b>${e.dir === "up" ? "▲ Sharp jump" : "▼ Sharp fall"} ${pct(e.move)}</b> · ${fmtDate(e.start, { day: "numeric", month: "short" })}${e.end !== e.start ? `–${fmtDate(e.end, { day: "numeric", month: "short" })}` : ""} · S&amp;P ${pct(e.spy)}
            ${e.summary ? `<div class="small" style="white-space:normal">${esc(e.summary)}</div>` : e.what[0] ? `<div class="small" style="white-space:normal">${esc(e.what[0].title)}</div>` : ""}<div class="small muted">click to read more below</div></div>` : ""}`;
        tip.hidden = false;
        const left = Xt(k) / Wt * r.width, tw = tip.offsetWidth;
        tip.style.left = `${Math.max(0, Math.min(r.width - tw, left + (left > r.width / 2 ? -tw - 14 : 14)))}px`; tip.style.top = "6px";
        svg.style.cursor = e ? "pointer" : "";
      };
      svg.addEventListener("mousemove", move); svg.addEventListener("touchstart", move, { passive: true }); svg.addEventListener("touchmove", move, { passive: true });
      svg.addEventListener("mouseleave", () => { tip.hidden = true; cx.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); });
      svg.addEventListener("click", (ev2) => {
        const e = evAt(pos(ev2)); if (!e) return;
        const k = ev.indexOf(e); if (!every && k >= 6) { showTheme(key, true); }
        const el = $(`#thm-${k}`); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1600); }
      });
      $$("[data-tr]").forEach((b) => b.addEventListener("click", () => { thRange = b.dataset.tr; showTheme(key); }));
    };
    const choose = (key) => {
      dropInd = key; $$("[data-ind]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.ind === key)));
      drawNow(key);
      if (key === "all") overview(); else { $("#thTitle").innerHTML = `${esc(TH[key].name)} <span class="muted">sharp falls and jumps, whether or not the whole market moved</span>`; showTheme(key); }
      drawRecent(key);
    };
    $$("[data-ind]").forEach((b) => b.addEventListener("click", () => choose(b.dataset.ind)));
    choose(TH[dropInd] ? dropInd : "all");
    pinBar();
  }

  // =============================== finance pages ===============================
  // Home (the markets today), Market movers, Aftermath, Investments and Production. They read the daily closes
  // (prices.js plus extra_prices.js for stocks members haven't traded) and their own data files.
  const DOW30 = "AAPL AMGN AMZN AXP BA CAT CRM CSCO CVX DIS GS HD HON IBM JNJ JPM KO MCD MMM MRK MSFT NKE NVDA PG SHW TRV UNH V VZ WMT".split(" ");
  const NDX100 = ("AAPL ABNB ADBE ADI ADP ADSK AEP AMAT AMD AMGN AMZN APP ARM ASML AVGO AXON AZN BIIB BKNG BKR CCEP CDNS CDW CEG CHTR CMCSA COST "
    + "CPRT CRWD CSCO CSGP CSX CTAS CTSH DASH DDOG DXCM EXC FANG FAST FTNT GEHC GFS GILD GOOG GOOGL HON IDXX INTC INTU ISRG KDP KHC "
    + "KLAC LIN LRCX LULU MAR MCHP MDLZ MELI META MNST MRVL MSFT MSTR MU NFLX NVDA NXPI ODFL ON ORLY PANW PAYX PCAR PDD PEP PLTR PYPL "
    + "QCOM REGN ROP ROST SBUX SHOP SNPS TEAM TMUS TRI TSLA TTD TTWO TXN VRSK VRTX WDAY XEL ZS").split(" ");
  const AI_STOCKS = "NVDA AVGO AMD TSM MU ARM SMCI PLTR MRVL LRCX AMAT KLAC ORCL MSFT GOOGL META AMZN CRWV ANET VRT DELL HPE SNOW NOW CRM IBM INTC QCOM ASML VST CEG".split(" ");
  const INDEXES = [["SPY", "S&P 500"], ["QQQ", "Nasdaq 100"], ["DIA", "Dow"], ["IWM", "Small companies"], ["TLT", "Long-term bonds"], ["GLD", "Gold"], ["XLE", "Energy stocks"]];
  let XPX = false;
  const loadAllPrices = () => loadPrices().then((P) => XPX ? P : loadScript("extra_prices.js").then(() => { if (P && window.CTC_XPX) for (const [t, v] of Object.entries(window.CTC_XPX.px)) if (!P.px[t]) P.px[t] = v; XPX = true; return P; }));
  let AFTER = null, INVEST = null, PROD = null;
  const loadAfter = () => AFTER ? Promise.resolve(AFTER) : loadScript(`aftermath.js?v=3&h=${Math.floor(Date.now() / 3.6e6)}`).then(() => (AFTER = window.CTC_AFTERMATH || null));
  const loadInvest = () => INVEST ? Promise.resolve(INVEST) : loadScript(`investments.js?v=2&h=${Math.floor(Date.now() / 3.6e6)}`).then(() => (INVEST = window.CTC_INVEST || null));
  const loadProd = () => PROD ? Promise.resolve(PROD) : loadScript("production.js?v=4").then(() => (PROD = window.CTC_PROD || null));
  const SPANS = { day: [1, "Today"], week: [5, "This week"], month: [21, "This month"] };
  let moverList = "sp", moverSpan = "day";
  const lastIdx = (x) => { if (!x) return -1; for (let i = x.length - 1; i >= 0; i--) if (x[i] != null) return i; return -1; };
  const moveOf = (P, tk, k) => { const x = P.px[tk]; if (!x) return null; const L = P.dates.length - 1; return x[L] && x[L - k] ? x[L] / x[L - k] - 1 : null; };
  const mcapOf = (tk) => (stocks[tk] && stocks[tk][4]) || 0;
  const sectorOf = (tk) => (stocks[tk] && stocks[tk][1]) || "Other";
  const spark = (x, from, w = 120, h = 34, col = null) => {
    const pts = []; for (let i = from; i < x.length; i++) if (x[i] != null) pts.push([i, x[i]]);
    if (pts.length < 2) return "";
    const lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1])), X = (i) => (i - from) / Math.max(1, x.length - 1 - from) * w, Y = (v) => h - 3 - (v - lo) / Math.max(1e-9, hi - lo) * (h - 6);
    const c = col || (pts[pts.length - 1][1] >= pts[0][1] ? "var(--good)" : "var(--bad)");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${pts.map((p, k) => `${k ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("")}" fill="none" stroke="${c}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
  };
  // colour for a move: red to grey to green, stronger the bigger the move (cap: the move that counts as large)
  const heat = (r, cap) => {
    if (r == null) return "var(--chip)";
    const t = Math.max(-1, Math.min(1, r / cap)), a = Math.abs(t);
    const [R, G, B] = t >= 0 ? [22, 163, 74] : [220, 38, 38];
    return `rgb(${Math.round(84 + (R - 84) * a)},${Math.round(90 + (G - 90) * a)},${Math.round(100 + (B - 100) * a)})`;
  };
  // squarified treemap: lays out items (value > 0) in a rectangle, as square as possible
  function squarify(items, x, y, w, h) {
    const out = [], total = items.reduce((a, it) => a + it.v, 0); if (!total || w <= 0 || h <= 0) return out;
    let rest = items.slice().sort((a, b) => b.v - a.v).map((it) => ({ ...it, a: it.v / total * w * h }));
    while (rest.length) {
      const side = Math.min(w, h), row = [rest[0]]; let i = 1;
      const worst = (r) => { const s = r.reduce((a, it) => a + it.a, 0), mx = Math.max(...r.map((it) => it.a)), mn = Math.min(...r.map((it) => it.a)); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); };
      while (i < rest.length && worst([...row, rest[i]]) <= worst(row)) row.push(rest[i++]);
      const s = row.reduce((a, it) => a + it.a, 0), thick = s / side; let off = 0;
      for (const it of row) { const len = it.a / thick; out.push(w >= h ? { ...it, x, y: y + off, w: thick, h: len } : { ...it, x: x + off, y, w: len, h: thick }); off += len; }
      if (w >= h) { x += thick; w -= thick; } else { y += thick; h -= thick; }
      rest = rest.slice(i);
    }
    return out;
  }
  // a heatmap of stocks: sectors as blocks, each stock sized by company value and coloured by its move
  function heatmapHtml(P, tks, k, { W = 1000, H = 520, cap = 0.03, link = true } = {}) {
    const rows = tks.map((tk) => ({ tk, r: moveOf(P, tk, k), v: Math.max(mcapOf(tk), 5e9), s: sectorOf(tk) })).filter((x) => x.r != null);
    const bySec = new Map(); for (const r of rows) { if (!bySec.has(r.s)) bySec.set(r.s, []); bySec.get(r.s).push(r); }
    const secs = squarify([...bySec].map(([s, l]) => ({ s, l, v: l.reduce((a, x) => a + x.v, 0) })), 0, 0, W, H);
    let html = "";
    for (const sb of secs) {
      html += `<div class="hm-sec" style="left:${sb.x / W * 100}%;top:${sb.y / H * 100}%;width:${sb.w / W * 100}%;height:${sb.h / H * 100}%"><span class="hm-sname">${esc(sb.s)}</span></div>`;
      for (const t of squarify(sb.l, sb.x + 1, sb.y + 16, sb.w - 2, sb.h - 17)) {
        const big = t.w > 54 && t.h > 30, mid = t.w > 32 && t.h > 18;
        html += `<${link ? `a href="#/stock/${encodeURIComponent(t.tk)}"` : "div"} class="hm-tile" style="left:${t.x / W * 100}%;top:${t.y / H * 100}%;width:${t.w / W * 100}%;height:${t.h / H * 100}%;background:${heat(t.r, cap)}" title="${esc(coName(t.tk))} (${esc(t.tk)}): ${pct(t.r)}">
          ${mid ? `<b style="font-size:${Math.max(10, Math.min(20, t.w / 5))}px">${esc(t.tk)}</b>` : ""}${big ? `<span>${pct(t.r)}</span>` : ""}</${link ? "a" : "div"}>`;
      }
    }
    return `<div class="heatmap" style="aspect-ratio:${W}/${H}">${html}</div>`;
  }
  const moverRow = (P, tk, r, mx) => {
    const L = P.dates.length - 1, x = P.px[tk];
    return `<a class="mv-row" href="#/stock/${encodeURIComponent(tk)}">${BRAND[tk] && BRAND[tk][1] ? logoBox(tk, "var(--chart)", 26) : `<span class="tk">${esc(tk)}</span>`}
      <span class="mv-name"><b>${esc(tk)}</b> <span class="muted">${esc(coName(tk))}</span></span><span class="mv-px mono">${x && x[L] ? price(x[L]) : ""}</span>
      <span class="mv-bar"><i class="${r >= 0 ? "pos" : "neg"}" style="width:${Math.min(100, Math.abs(r) / mx * 100).toFixed(1)}%"></i></span><b class="mono ${cls(r)}">${pct(r, 2)}</b></a>`;
  };
  // a company's second share class (GOOG beside GOOGL) would count it twice
  const listTks = (P, which) => (which === "sp" ? Object.keys(P.px).filter((t) => stocks[t] && stocks[t][5] && !["GOOG", "FOX", "NWS"].includes(t)) : which === "ndx" ? NDX100 : which === "dow" ? DOW30 : AI_STOCKS).filter((t) => P.px[t]);
  const LIST_NAMES = { sp: "S&P 500", ndx: "Nasdaq-100", dow: "Dow 30", ai: "AI stocks" };
  const marketPill = () => { const mk = usMarket(); return `<span class="mkt ${mk.open ? "open" : ""}">${esc(mk.text)}</span>`; };

  // ---------- Home: the markets today, with a focus on AI ----------
  async function pageMarkets() {
    setNav("home");
    app.innerHTML = `<h1>Markets today</h1><p class="loading">Loading prices…</p>`;
    const [P, M, A, I] = await Promise.all([loadAllPrices(), loadMoves(), loadAfter(), loadInvest()]);
    if (!(location.hash === "" || location.hash === "#/" || location.hash === "#")) return;
    const L = P.dates.length - 1, from = Math.max(0, L - 21), mt = M && M.market && M.market.today;
    const sp = listTks(P, "sp").map((t) => [t, moveOf(P, t, 1)]).filter((x) => x[1] != null).sort((a, b) => b[1] - a[1]);
    const up = sp.filter((x) => x[1] > 0).length, mx = Math.max(...sp.slice(0, 5).concat(sp.slice(-5)).map((x) => Math.abs(x[1])));
    const ai = AI_STOCKS.filter((t) => P.px[t]);
    const aiAvg = ai.map((t) => moveOf(P, t, 1)).filter((r) => r != null), aiDay = aiAvg.reduce((a, r) => a + r, 0) / (aiAvg.length || 1);
    app.innerHTML = `<div class="mk-head"><h1>Markets today</h1><div class="muted">Closing prices for ${fmtDate(P.dates[L], { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ${marketPill()}</div></div>
      <div class="idx-row">${INDEXES.map(([tk, nm]) => { const x = P.px[tk], d = moveOf(P, tk, 1), w = moveOf(P, tk, 5);
        return x ? `<div class="idx"><span class="idx-n">${esc(nm)}</span><b class="mono ${cls(d)}">${pct(d, 2)}</b><span class="muted small">week ${pct(w)}</span>${spark(x, from)}</div>` : ""; }).join("")}</div>
      ${mt && mt.summary ? `<a class="today-why card" href="#/drops"><span class="tw-l">Why markets moved</span><span>${esc(mt.summary)}</span><span class="tw-more">Full story →</span></a>` : ""}
      <div class="grid home-grid section">
        <div class="card"><h2>AI stocks today <span class="muted">average ${pct(aiDay)} · tap one for its page</span></h2>
          <div class="ai-grid">${ai.slice(0, 20).map((t) => { const d = moveOf(P, t, 1); return `<a class="ai-tile" href="#/stock/${encodeURIComponent(t)}" style="--h:${heat(d, 0.04)}">
            <span class="ai-top">${BRAND[t] && BRAND[t][1] ? logoBox(t, "var(--chart)", 22) : ""}<b>${esc(t)}</b><span class="mono ${cls(d)}">${pct(d)}</span></span>${spark(P.px[t], from, 120, 26)}</a>`; }).join("")}</div></div>
        <div class="card"><h2>S&amp;P 500 today <span class="muted">${up} up · ${sp.length - up} down</span></h2>
          <div class="breadth"><i style="width:${(up / (sp.length || 1) * 100).toFixed(1)}%"></i></div>
          <h4 class="th-sub">Biggest gainers</h4>${sp.slice(0, 5).map(([t, r]) => moverRow(P, t, r, mx)).join("")}
          <h4 class="th-sub">Biggest decliners</h4>${sp.slice(-5).reverse().map(([t, r]) => moverRow(P, t, r, mx)).join("")}
          <a class="more-link" href="#/movers">All market movers →</a></div>
      </div>
      <div class="card section"><h2>The S&amp;P 500 at a glance <span class="muted">each square a company, sized by value, coloured by today's move</span></h2>${heatmapHtml(P, sp.map((x) => x[0]), 1, { H: 440 })}<a class="more-link" href="#/movers">Open the full heatmap →</a></div>
      ${M && M.themes ? `<div class="card section"><h2>Industries this week</h2><div class="inds">${Object.entries(M.themes).map(([k, t]) => `<a class="ind" href="#/drops"><b>${esc(t.name)}</b>
        <span class="ind-row"><span>Today</span><b class="${cls(t.today && t.today.move)}">${pct(t.today && t.today.move)}</b></span><span class="ind-row"><span>This week</span><b class="${cls(t.now && t.now.move)}">${pct(t.now && t.now.move)}</b></span>
        <span class="ind-row"><span>Past month</span><b class="${cls(t.now && t.now.month)}">${pct(t.now && t.now.month)}</b></span></a>`).join("")}</div></div>` : ""}
      <div class="grid cols-2 section">
        ${I && I.deals[0] ? `<a class="card teaser" href="#/investments"><h2>Latest big investment</h2><b class="t-title">${esc(I.deals[0].title)}</b><p class="small muted">${esc(I.deals[0].summary.slice(0, 220))}…</p><span class="more-link">See who put money in →</span></a>` : ""}
        ${A && A.stocks.length ? `<a class="card teaser" href="#/aftermath"><h2>Aftermath <span class="muted">steady stocks that kept falling</span></h2>${A.stocks.slice(0, 4).map((s) => `<div class="mini-row"><b>${esc(s.name.split(" ")[0])}</b><span class="ell small muted">${esc(s.cause || "")}</span><b class="mono down">${pct(s.drop, 0)}</b></div>`).join("")}<span class="more-link">Why they fell →</span></a>` : ""}
      </div>
      <a class="card section congress-link" href="#/congress"><h2>Congress trades</h2><p class="small muted">What members of Congress and senior officials are buying and selling, from their disclosure reports.</p><span class="more-link">Open Congress →</span></a>`;
  }

  // ---------- Market movers: the day's (or week's, month's) biggest moves, as pictures ----------
  async function pageMovers() {
    setNav("movers");
    app.innerHTML = `<h1>Market movers</h1><p class="loading">Loading prices…</p>`;
    const P = await loadAllPrices(); if (location.hash !== "#/movers") return;
    const L = P.dates.length - 1, [k, spanName] = SPANS[moverSpan], cap = { day: 0.03, week: 0.07, month: 0.15 }[moverSpan];
    const tks = listTks(P, moverList), rows = tks.map((t) => [t, moveOf(P, t, k)]).filter((x) => x[1] != null).sort((a, b) => b[1] - a[1]);
    const up = rows.filter((x) => x[1] > 0).length, top = rows.slice(0, 12), bot = rows.slice(-12).reverse(), mx = Math.max(...top.concat(bot).map((x) => Math.abs(x[1])), 0.001);
    const idxTk = { sp: "SPY", ndx: "QQQ", dow: "DIA", ai: null }[moverList], idxMove = idxTk ? moveOf(P, idxTk, k) : rows.reduce((a, x) => a + x[1], 0) / (rows.length || 1);
    const dollar = rows.map(([t, r]) => [t, r, mcapOf(t) * r / (1 + r)]).filter((x) => x[2]).sort((a, b) => Math.abs(b[2]) - Math.abs(a[2])).slice(0, 8), dmx = Math.max(...dollar.map((x) => Math.abs(x[2])), 1);
    const secs = new Map(); for (const [t, r] of rows) { const s = sectorOf(t); if (!secs.has(s)) secs.set(s, []); secs.get(s).push(r); }
    const secRows = [...secs].map(([s, l]) => [s, l.reduce((a, r) => a + r, 0) / l.length, l.length]).sort((a, b) => b[1] - a[1]), smx = Math.max(...secRows.map((x) => Math.abs(x[1])), 0.001);
    app.innerHTML = `<h1>Market movers</h1>
      <p class="lede">${esc(LIST_NAMES[moverList])} · ${spanName.toLowerCase()} to the close on ${fmtDate(P.dates[L], { weekday: "short", day: "numeric", month: "short" })}. ${marketPill()}</p>
      <div class="toolbar pin-top"><div class="seg" role="group" aria-label="Which stocks">${Object.entries(LIST_NAMES).map(([v, l]) => `<button type="button" data-ml="${v}" aria-pressed="${v === moverList}">${l}</button>`).join("")}</div>
        <div class="seg" role="group" aria-label="Period">${Object.entries(SPANS).map(([v, [, l]]) => `<button type="button" data-ms="${v}" aria-pressed="${v === moverSpan}">${l}</button>`).join("")}</div></div>
      <div class="grid cols-3">
        ${statCard(idxTk ? `${esc(LIST_NAMES[moverList])}` : "AI stocks (average)", pct(idxMove, 2), spanName.toLowerCase(), cls(idxMove))}
        <div class="card stat"><div class="lbl">Up vs down</div><div class="big"><span class="up">${up}</span> <span class="muted small">/</span> <span class="down">${rows.length - up}</span></div><div class="breadth"><i style="width:${(up / (rows.length || 1) * 100).toFixed(1)}%"></i></div></div>
        ${dollar[0] ? statCard("Biggest $ move", `${dollar[0][2] >= 0 ? "+" : "−"}${usd(Math.abs(dollar[0][2]))}`, `${esc(coName(dollar[0][0]))} ${pct(dollar[0][1])}`, cls(dollar[0][2])) : ""}
      </div>
      <div class="card section"><h2>Heatmap <span class="muted">each square a company, sized by value, coloured by its move (deepest colour at ±${Math.round(cap * 100)}%)</span></h2>${heatmapHtml(P, rows.map((x) => x[0]), k, { cap, H: moverList === "dow" ? 420 : 560 })}
        <div class="hm-legend"><span>−${Math.round(cap * 100)}%</span><i style="background:linear-gradient(90deg, ${heat(-cap, cap)}, ${heat(0, cap)}, ${heat(cap, cap)})"></i><span>+${Math.round(cap * 100)}%</span></div></div>
      <div class="grid cols-2 section">
        <div class="card"><h2 class="up">▲ Top gainers</h2>${top.map(([t, r]) => moverRow(P, t, r, mx)).join("")}</div>
        <div class="card"><h2 class="down">▼ Top decliners</h2>${bot.map(([t, r]) => moverRow(P, t, r, mx)).join("")}</div>
      </div>
      <div class="grid cols-2 section">
        <div class="card"><h2>Sectors <span class="muted">average move</span></h2>${secRows.map(([s, r, n]) => `<div class="dbar div"><span class="dl">${esc(s)} <span class="muted small">${n}</span></span><span class="dt"><i class="${r < 0 ? "neg" : "pos"}" style="width:${(Math.abs(r) / smx * 50).toFixed(1)}%"></i></span><b class="${cls(r)}">${pct(r, 1)}</b></div>`).join("")}</div>
        <div class="card"><h2>Biggest moves in dollars <span class="muted">change in company value</span></h2>${dollar.map(([t, r, d]) => `<a class="mv-row" href="#/stock/${encodeURIComponent(t)}">${BRAND[t] && BRAND[t][1] ? logoBox(t, "var(--chart)", 26) : `<span class="tk">${esc(t)}</span>`}<span class="mv-name"><b>${esc(t)}</b> <span class="muted">${esc(coName(t))}</span></span><span class="mv-px mono ${cls(r)}">${pct(r)}</span><span class="mv-bar"><i class="${d >= 0 ? "pos" : "neg"}" style="width:${(Math.abs(d) / dmx * 100).toFixed(1)}%"></i></span><b class="mono ${cls(d)}">${d >= 0 ? "+" : "−"}${usd(Math.abs(d))}</b></a>`).join("")}</div>
      </div>
      <p class="small muted">Closing prices from Yahoo Finance. Company values are from the latest stock list, so the dollar moves are estimates. Index lists: S&amp;P 500 members as flagged in our stock list; Nasdaq-100 and Dow members as of 2025.</p>`;
    pinBar();  // the page drew after the router ran: pin its choices now
    $$("[data-ml]").forEach((b) => b.addEventListener("click", () => { moverList = b.dataset.ml; route(true); }));
    $$("[data-ms]").forEach((b) => b.addEventListener("click", () => { moverSpan = b.dataset.ms; route(true); }));
  }

  // ---------- Aftermath: steady stocks that kept falling, and what led to it ----------
  async function pageAftermath() {
    setNav("aftermath");
    app.innerHTML = `<h1>Aftermath</h1><p class="loading">Loading…</p>`;
    const [A, P] = await Promise.all([loadAfter(), loadAllPrices()]); if (location.hash !== "#/aftermath") return;
    const S = (A && A.stocks) || [], mx = Math.max(...S.map((s) => Math.abs(s.drop)), 0.01);
    const KIND = { peak: ["◆", "var(--accent)"], bad: ["▼", "var(--bad)"], good: ["▲", "var(--good)"] };
    const chart = (s) => {
      const ser = s.series, n = ser.length, W = 1000, H = 260, vals = ser.map((x) => x[1]), lo = Math.min(...vals) * 0.97, hi = Math.max(...vals) * 1.03;
      const X = (i) => 10 + i / (n - 1) * (W - 70), Y = (v) => 14 + (hi - v) / (hi - lo) * (H - 44), at = (d) => { const i = ser.findIndex((x) => x[0] >= d); return i < 0 ? n - 1 : i; };
      const pk = at(s.peak), line = ser.map((x, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(x[1]).toFixed(1)}`).join("");
      const months = []; for (let i = 1; i < n; i++) if (ser[i][0].slice(0, 7) !== ser[i - 1][0].slice(0, 7)) months.push(i);
      const ev = (s.events || []).map((e, j) => ({ ...e, j: j + 1, i: at(e.date) }));
      return svgBox(W, H, `<rect x="${X(pk).toFixed(1)}" y="10" width="${(X(n - 1) - X(pk)).toFixed(1)}" height="${H - 36}" fill="var(--bad)" fill-opacity=".08"/>
        ${[lo, (lo + hi) / 2, hi].map((v) => `<line x1="10" x2="${W - 60}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)"/><text x="${W - 54}" y="${(Y(v) + 4).toFixed(1)}" font-size="12" fill="var(--muted)" font-family="var(--font-mono)">${v.toFixed(v < 100 ? 2 : 0)}</text>`).join("")}
        ${months.map((i) => `<text x="${X(i).toFixed(1)}" y="${H - 8}" font-size="11" fill="var(--muted)" text-anchor="middle">${fmtDate(ser[i][0], { month: "short" })}</text>`).join("")}
        <path d="${line}" fill="none" stroke="var(--chart)" stroke-width="2.2"/>
        ${ev.map((e) => { const [g, c] = KIND[e.kind] || KIND.bad, x = X(e.i), y = Y(ser[e.i][1]); return `<g><line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${(y - 26).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${c}" stroke-dasharray="2 2"/><circle cx="${x.toFixed(1)}" cy="${(y - 34).toFixed(1)}" r="11" fill="${c}"/><text x="${x.toFixed(1)}" y="${(y - 30).toFixed(1)}" font-size="12" font-weight="700" fill="#fff" text-anchor="middle">${e.j}</text><title>${esc(fmtDate(e.date))}: ${esc(e.text)}</title></g>`; }).join("")}`, `${s.name} price`);
    };
    app.innerHTML = `<h1>Aftermath</h1>
      <p class="lede">Normally steady, large companies whose shares have fallen 15% or more and stayed down for two months or longer, and what led to each fall.</p>
      <div class="crit">${S.some((s) => s.hand) ? `<span>Plus ${S.filter((s) => s.hand).map((s) => esc(s.name)).join(" and ")} as well-known picks</span>` : ""}<span>Steady before: yearly swings under ${Math.round(((A && A.steady_cut) || 0.28) * 100)}%</span><span>Fell 15%+ from a high at least 2 months ago</span><span>Still near the low</span><span>Worth $20B+</span></div>
      <div class="toolbar pin-top"><div class="seg" role="group" aria-label="Jump to a stock">${S.map((s, k) => `<button type="button" data-goto="af-${k}">${esc(s.tk === "PCG" ? "PG&E" : s.name.replace(/ Common Stock$| Corporation.*$| Inc\..*$| Co\.$|,? plc$| A\/S.*$| Holdings?.*$/i, ""))}</button>`).join("")}</div></div>
      <div class="card section"><h2>How far each one fell <span class="muted">from its peak · click one</span></h2>
        ${S.map((s, k) => `<a class="af-bar" data-goto="af-${k}" href="#/aftermath"><span class="af-n"><b>${esc(s.name.replace(/ Common Stock$| Corporation.*$| Inc\..*$/, ""))}</b> <span class="muted small">${esc(s.cause || s.industry || "")}</span></span>
          <span class="af-track"><i style="width:${(Math.abs(s.drop) / mx * 100).toFixed(1)}%"></i></span><b class="mono down">${pct(s.drop, 1)}</b><span class="muted small">${s.days}d</span></a>`).join("")}</div>
      <div class="af-mult section">${S.map((s, k) => { const ser = s.series.map((x) => x[1]), pk = s.series.findIndex((x) => x[0] >= s.peak);
        return `<a class="af-sm card" data-goto="af-${k}" href="#/aftermath"><b class="ell">${esc(s.name.split(" ").slice(0, 2).join(" "))}</b><span class="mono down">${pct(s.drop, 0)}</span>${spark(ser, Math.max(0, pk - 40), 160, 44, "var(--bad)")}</a>`; }).join("")}</div>
      ${S.map((s, k) => `<div class="card af-card section" id="af-${k}">
        <div class="af-head">${BRAND[s.tk] && BRAND[s.tk][1] ? logoBox(s.tk, "var(--chart)", 44) : `<span class="logo" style="width:44px;height:44px;background:var(--chart)"><b style="font-size:13px">${esc(s.tk.split(".")[0].slice(0, 4))}</b></span>`}
          <div><h2>${esc(s.name.replace(/ Common Stock$/, ""))} <span class="muted small">${esc(s.tk)} · ${esc(s.industry || s.sector)}</span></h2><div class="af-cause">${esc(s.cause || "")}${s.clear === false ? ` <span class="pill-soft">no single cause</span>` : ""}${s.hand ? ` <span class="pill-soft" title="Its daily swings were above the 'steady' line; included because it is a widely followed name">well-known pick · not 'steady' by our test</span>` : ""}</div></div></div>
        <div class="af-stats">
          <div><span class="lbl">Fell</span><b class="down">${pct(s.drop, 1)}</b><span class="muted small">since ${fmtDate(s.peak, { day: "numeric", month: "short" })}</span></div>
          <div><span class="lbl">How long</span><b>${s.days} days</b><span class="muted small">trading days from the peak</span></div>
          <div><span class="lbl">Price</span><b class="mono">${(+s.peak_px).toLocaleString(undefined, { maximumFractionDigits: 2 })} → ${(+s.now_px).toLocaleString(undefined, { maximumFractionDigits: 2 })}</b><span class="muted small">${s.tk.includes(".") ? "home-market currency" : "US dollars"}</span></div>
          <div><span class="lbl">Same days</span><span class="cmp"><span>Stock</span><i class="neg" style="width:${Math.min(100, Math.abs(s.drop) / 0.35 * 100)}%"></i><b class="down">${pct(s.drop, 0)}</b></span>
            ${s.sector_move != null ? `<span class="cmp"><span>Sector</span><i class="${s.sector_move < 0 ? "neg" : "pos"}" style="width:${Math.min(100, Math.abs(s.sector_move) / 0.35 * 100)}%"></i><b class="${cls(s.sector_move)}">${pct(s.sector_move, 0)}</b></span>` : ""}
            <span class="cmp"><span>S&amp;P 500</span><i class="${s.spy < 0 ? "neg" : "pos"}" style="width:${Math.min(100, Math.abs(s.spy) / 0.35 * 100)}%"></i><b class="${cls(s.spy)}">${pct(s.spy, 0)}</b></span></div>
          <div><span class="lbl">Steadiness</span><b>${Math.round(s.vol_before * 100)}% → ${s.vol_during != null ? Math.round(s.vol_during * 100) : "–"}%</b><span class="muted small">yearly swings before → during</span></div>
        </div>
        <div class="chart">${chart(s)}</div>
        <div class="af-tl">${(s.events || []).map((e, j) => { const [g, c] = KIND[e.kind] || KIND.bad; return `<div class="af-ev"><span class="af-num" style="background:${c}">${j + 1}</span><span class="muted small">${fmtDate(e.date, { day: "numeric", month: "short" })}</span><span>${esc(e.text)}</span></div>`; }).join("")}</div>
        ${s.summary || s.why ? `<div class="why-sum af-why">${s.summary ? `<p><b>What led to it:</b> ${esc(s.summary)}</p>` : ""}${s.why ? `<p><b>Why:</b> ${esc(s.why)}</p>` : ""}</div>` : ""}
        ${s.news && s.news.length ? `<details class="srcs"><summary>Sources: ${s.news.length} news articles</summary><ul>${s.news.map((it) => `<li><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a> <span class="muted small">${esc(it.source)} · ${fmtDate(it.date, { day: "numeric", month: "short" })}</span></li>`).join("")}</ul></details>` : ""}
      </div>`).join("")}
      <p class="small muted">Prices are daily closes (Rolls-Royce in pence, Novo Nordisk in Danish kroner). "Steady" compares each stock's daily swings in the year before its peak with the rest of the S&amp;P 500. The timelines are written from news reports; where no single report explains a fall, the card says so.</p>`;
    pinBar();
  }

  // ---------- Investments: who put money in, and the listed companies linked to it ----------
  async function pageInvest() {
    setNav("investments");
    app.innerHTML = `<h1>Investments</h1><p class="loading">Loading…</p>`;
    const [I, P] = await Promise.all([loadInvest(), loadAllPrices()]); if (location.hash !== "#/investments") return;
    const L = P.dates.length - 1, last = (tk) => { const x = P.px[tk]; const i = lastIdx(x); return i >= 0 ? x[i] : null; };
    const at = (tk, d) => { const x = P.px[tk]; if (!x) return null; let i = P.dates.findIndex((z) => z >= d); if (i < 0) return null; for (; i < P.dates.length; i++) if (x[i] != null) return x[i]; return null; };
    const trumpM = members.find((m) => m.id === "EX_TRUMP_DONALD_J");
    const held = (tk) => trumpM ? leftOf(trumpM.i, tk) : null;
    const KC = { gov: "gov", person: "person", company: "company" };
    const diagram = (d, k) => {
      const tiles = [];
      for (const f of d.inflows) if (f.stake && last(f.stake.tk)) { const now = last(f.stake.tk), r = now / f.stake.price - 1; tiles.push([`${f.name} stake`, usd(f.stake.shares * now), `${pct(r)} since ${fmtDate(f.stake.date, { day: "numeric", month: "short", year: "numeric" })} (bought at $${f.stake.price})`, cls(r)]); }
      const tv = d.trump.map((tk) => held(tk)).filter((h) => h && h.value >= 1000).reduce((a, h) => a + h.value, 0);
      if (tv) tiles.push(["Trump holds in linked stocks", `≈${usd(tv)}`, `${d.trump.filter((tk) => { const h = held(tk); return h && h.value >= 1000; }).join(", ")} · from his disclosure reports`, ""]);
      for (const x of d.tiles || []) if (x.stake && last(x.stake.tk)) { const now = last(x.stake.tk), r = now / x.stake.price - 1; tiles.push([x.label, usd(x.stake.shares * now), `${pct(r)} since ${fmtDate(x.stake.date, { day: "numeric", month: "short" })} buy`, cls(r)]); }
      if (d.center.value) tiles.push([`${d.center.name} value`, d.center.value.split(" (")[0], d.center.value.includes("(") ? d.center.value.split("(")[1].replace(")", "") : "", ""]);
      return `<div class="card inv section" id="inv-${k}">
        <div class="inv-top"><span class="muted small">${fmtDate(d.date)} · <span class="pill-soft">${esc(d.status)}</span></span><h2>${esc(d.title)}</h2></div>
        ${tiles.length ? `<div class="inv-tiles">${tiles.map(([l, b, s2, c]) => `<div><span class="lbl">${esc(l)}</span><b class="${c}">${b}</b><span class="muted small">${esc(s2)}</span></div>`).join("")}</div>` : ""}
        <div class="flow" data-flow="${k}">
          <div class="fcol fin"><h4>Money in</h4>${d.inflows.map((f, j) => `<div class="fbox ${KC[f.kind] || "company"}" data-in="${j}"><b>${esc(f.name)}</b><span>${esc(f.amount)}</span><small>${esc(f.note)}</small></div>`).join("")}</div>
          <div class="fcol fmid"><div class="fhub" data-hub><b>${esc(d.center.name)}</b><span>${esc(d.center.sub)}</span></div></div>
          <div class="fcol fout"><h4>Listed companies linked</h4>${d.links.map((l, j) => { const now = last(l.tk), then = at(l.tk, d.date), r = now && then ? now / then - 1 : null, h = d.trump.includes(l.tk) ? held(l.tk) : null;
            return `<a class="fbox link ${r == null ? "" : r >= 0 ? "pos" : "neg"}" data-out="${j}" href="#/stock/${encodeURIComponent(l.tk)}"><span class="fl-top">${BRAND[l.tk] && BRAND[l.tk][1] ? logoBox(l.tk, "var(--chart)", 22) : ""}<b>${esc(coName(l.tk))} (${esc(l.tk)})</b></span>
              ${r != null ? `<span class="fl-r ${cls(r)}">${pct(r)} since ${fmtDate(d.date, { day: "numeric", month: "short" })}</span>` : `<span class="muted small">no price</span>`}
              ${h && h.value >= 1000 ? `<span class="small">Trump holds ≈${usd(h.value)}</span>` : ""}<small>${esc(l.note)}</small><span class="frole">${esc(l.role)}</span></a>`; }).join("")}</div>
          <svg class="flines"></svg>
        </div>
        <p class="inv-sum">${esc(d.summary)}</p>
        <details class="srcs"><summary>Sources: ${d.sources.length}</summary><ul>${d.sources.map((s2) => `<li><a href="${esc(s2.url)}" target="_blank" rel="noopener">${esc(s2.name)}</a></li>`).join("")}</ul></details></div>`;
    };
    const deals = (I && I.deals) || [];
    const stakes = deals.flatMap((d) => d.inflows.filter((f) => f.stake && f.kind === "gov" && last(f.stake.tk)).map((f) => ({ d, f, cost: f.stake.shares * f.stake.price, now: f.stake.shares * last(f.stake.tk) })));
    const smx = Math.max(...stakes.flatMap((s) => [s.cost, s.now]), 1);
    app.innerHTML = `<h1>Investments</h1>
      <p class="lede">Big deals where governments, companies and well-known investors put money in, who else is involved, and how the linked listed stocks have moved since.</p>
      ${stakes.length ? `<div class="card"><h2>The government's stakes <span class="muted">what it paid vs what it's worth now</span></h2>${stakes.map((s) => `<div class="stk"><span class="stk-n"><b>${esc(s.d.center.name)}</b> <span class="muted small">${esc(s.f.name)}</span></span>
        <span class="stk-bars"><span class="stk-b cost" style="width:${(s.cost / smx * 100).toFixed(1)}%">${usd(s.cost)} paid</span><span class="stk-b now ${s.now >= s.cost ? "pos" : "neg"}" style="width:${(s.now / smx * 100).toFixed(1)}%">${usd(s.now)} now</span></span><b class="mono ${cls(s.now / s.cost - 1)}">${pct(s.now / s.cost - 1, 0)}</b></div>`).join("")}</div>` : ""}
      <div class="toolbar pin-top section"><div class="seg" role="group" aria-label="Jump to a deal">${deals.map((d, k) => `<button type="button" data-goto="inv-${k}">${esc(d.center.name)}</button>`).join("")}</div></div>
      ${deals.map(diagram).join("")}
      <div class="card section"><h2>Where does this information come from?</h2><div class="srcgrid">
        <div><b>Government notices</b><span>Commerce/NIST and Energy Department announcements of CHIPS Act and loan deals, including letters of intent like Helion's.</span></div>
        <div><b>Company filings (SEC)</b><span>8-K and 10-Q filings and share-issue agreements show exact share counts and prices, like the 9.9M GlobalFoundries shares at $37.85.</span></div>
        <div><b>Officials' disclosures</b><span>The President's and officials' trade reports (OGE Form 278-T), which this site already reads, show who owns the linked stocks.</span></div>
        <div><b>Company announcements</b><span>Press releases and funding rounds (Helion's Series G, Nvidia's and SoftBank's Intel stakes).</span></div>
        <div><b>News and aggregators</b><span>Reporters and accounts like r/TrumpsTrades combine these sources; we check each claim against an official source where one exists.</span></div>
      </div></div>`;
    // connector lines from each box to the hub, labelled by the link's role
    const drawLines = () => $$(".flow").forEach((fl) => {
      const svg = $(".flines", fl), hub = $("[data-hub]", fl), r0 = fl.getBoundingClientRect(); if (!hub || getComputedStyle(fl).display === "block") { svg.innerHTML = ""; return; }
      const hb = hub.getBoundingClientRect(), hx = hb.left - r0.left + hb.width / 2, hy = hb.top - r0.top + hb.height / 2;
      svg.setAttribute("viewBox", `0 0 ${r0.width} ${r0.height}`); svg.setAttribute("width", r0.width); svg.setAttribute("height", r0.height);
      let s2 = "";
      $$("[data-in]", fl).forEach((b) => { const r = b.getBoundingClientRect(), x = r.right - r0.left, y = r.top - r0.top + r.height / 2; s2 += `<path d="M${x},${y} C${(x + hx) / 2},${y} ${(x + hx) / 2},${hy} ${hx - hb.width / 2},${hy}" fill="none" stroke="var(--line-strong)" stroke-width="1.6"/>`; });
      $$("[data-out]", fl).forEach((b) => { const r = b.getBoundingClientRect(), x = r.left - r0.left, y = r.top - r0.top + r.height / 2; s2 += `<path d="M${hx + hb.width / 2},${hy} C${(x + hx) / 2},${hy} ${(x + hx) / 2},${y} ${x},${y}" fill="none" stroke="var(--line-strong)" stroke-width="1.6"/>`; });
      svg.innerHTML = s2;
    });
    pinBar();
    drawLines(); window.addEventListener("resize", () => { if (location.hash === "#/investments") drawLines(); }, { passive: true });
  }

  // ---------- Production: where the world's key goods are made ----------
  let prodItem = "chips", prodJump = false, WORLD = null;
  const loadWorld = () => WORLD ? Promise.resolve(WORLD) : Promise.all([loadScript("https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"), loadScript("https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js")])
    .then(() => fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json")).then((r) => r.json()).then((topo) => (WORLD = window.topojson.feature(topo, topo.objects.countries))).catch(() => null);
  async function pageProduction() {
    setNav("production");
    app.innerHTML = `<h1>Production</h1><p class="loading">Loading…</p>`;
    const [D2, W] = await Promise.all([loadProd(), loadWorld()]); if (location.hash !== "#/production") return;
    if (!D2) { app.innerHTML = `<h1>Production</h1><p class="muted">No data.</p>`; return; }
    const it = D2.items[prodItem] || D2.items.chips;
    const total = it.rows.reduce((a, r) => a + r[2], 0), isPct = /^%/.test(it.unit);
    const share = (v) => isPct ? v / 100 : null;
    app.innerHTML = `<h1>Production</h1>
      <p class="lede">Where the things markets care about are made, and how much depends on a single country.</p>
      <div class="toolbar pin-top pr-tools">${D2.groups.map((g) => `<div class="seg" role="group" aria-label="${esc(g.name)}">${g.items.map((k) => `<button type="button" data-pi="${k}" aria-pressed="${k === prodItem}">${esc(D2.items[k].name)}</button>`).join("")}</div>`).join("")}</div>
      <div class="card"><h2>${prodItem === "chips" ? "The AI chip chain" : `${esc(it.name)}: the supply chain`} <span class="muted">each step, and where it depends on</span></h2><div class="chain">${(it.chain || []).map((c, k) => `<div class="ch-step"><span class="ch-n">${k + 1}</span><b>${esc(c.step)}</b><span class="ch-where">${esc(c.where)}</span><span class="small muted">${esc(c.who)}</span><span class="ch-share">${esc(c.share)}</span></div>`).join('<span class="ch-arrow">→</span>')}</div></div>
      <div class="card section"><div class="pr-head"><h2>${esc(it.name)}</h2><span class="muted small">${esc(it.unit)} · ${esc(it.year)} · world: ${esc(it.world)}</span></div><p class="small">${esc(it.why)}</p>
        <div class="pr-grid"><div class="pr-map" id="prMap">${W ? "" : `<p class="muted small">The world map couldn't load; the list shows the same figures.</p>`}</div>
          <div class="pr-list">${it.rows.map(([n, , v], k) => `<div class="pr-row"><span class="pr-rank">${k + 1}</span><b>${esc(n)}</b><span class="pr-bar"><i style="width:${(v / it.rows[0][2] * 100).toFixed(1)}%;opacity:${(1 - k * 0.07).toFixed(2)}"></i></span><span class="mono">${isPct ? `${v}%` : v.toLocaleString()}</span></div>`).join("")}
            ${!isPct ? `<p class="small muted">Top ${it.rows.length} shown; world total ${esc(it.world)}.</p>` : ""}</div></div>
        <p class="small muted">Source: ${esc(it.source)} (${esc(it.year)}). Figures rounded.</p></div>
      <div class="card section"><h2>Who leads each one</h2><div class="pr-cards">${Object.entries(D2.items).map(([k, x]) => { const top = x.rows[0], tot = x.rows.reduce((a, r) => a + r[2], 0), sh = /^%/.test(x.unit) ? top[2] : null;
        return `<button type="button" class="pr-card${k === prodItem ? " on" : ""}" data-pi="${k}"><span class="muted small">${esc(x.name)}</span><b>${esc(top[0])}</b><span class="mono">${sh != null ? `${sh}%` : `${top[2].toLocaleString()}`}</span><span class="pr-mini"><i style="width:${sh != null ? sh : Math.round(top[2] / tot * 100)}%"></i></span></button>`; }).join("")}</div></div>`;
    $$("[data-pi]").forEach((b) => b.addEventListener("click", () => { prodItem = b.dataset.pi; prodJump = true; route(true); }));
    pinBar();  // the page drew after the router ran: pin its choices now
    // picked from the pinned bar further down: bring the new item's chain into view
    const ch = $(".chain", app); if (prodJump && ch && ch.getBoundingClientRect().top < 0) ch.closest(".card").scrollIntoView({ block: "start" }); prodJump = false;
    if (W && window.d3) {
      const el = $("#prMap"), w = 760, h = 400, d3 = window.d3, proj = d3.geoNaturalEarth1().fitSize([w, h], { type: "Sphere" }), path = d3.geoPath(proj);
      const val = new Map(); for (const [, n, v] of it.rows) val.set(String(n).padStart(3, "0"), (val.get(String(n).padStart(3, "0")) || 0) + v);
      const mx = Math.max(...val.values());
      const col = (v) => `color-mix(in srgb, var(--chart) ${Math.round(25 + 75 * v / mx)}%, var(--surface))`;
      const feats = W.features.filter((f) => f.id !== "010");
      el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" class="worldmap"><path d="${path({ type: "Sphere" })}" fill="var(--bg)"/>${feats.map((f) => { const v = val.get(f.id); return `<path d="${path(f)}" fill="${v ? col(v) : "var(--chip)"}" stroke="var(--surface)" stroke-width=".5">${v ? `<title>${esc(f.properties.name)}: ${isPct ? `${v}%` : v.toLocaleString()}</title>` : ""}</path>`; }).join("")}
        ${it.rows.slice(0, 5).map(([n, id, v]) => { const f = feats.find((g) => g.id === String(id).padStart(3, "0")); if (!f) return ""; const [cx, cy] = path.centroid(f); const r = 6 + 16 * Math.sqrt(v / mx);
          return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="var(--hot)" fill-opacity=".85" stroke="#fff" stroke-width="1.5"/><text x="${cx.toFixed(1)}" y="${(cy - r - 4).toFixed(1)}" font-size="12" font-weight="700" text-anchor="middle" fill="var(--ink)" paint-order="stroke" stroke="var(--surface)" stroke-width="3">${esc(n.split(" (")[0])} ${isPct ? `${v}%` : ""}</text>`; }).join("")}</svg>`;
    }
  }
  // in-page jumps (the address keeps the page; #af-3 would be read as a page of its own)
  document.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest("[data-goto]"); if (!a) return; e.preventDefault(); const el = document.getElementById(a.dataset.goto); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); });

  // ---------- AI bubble watch: are AI stocks or the private AI labs the risk? ----------
  // Hand-kept facts (each dated and sourced) come from ai_bubble.js, which is updated as news happens; one-year
  // share moves and company values are worked out live from the site's prices.
  let AIB = null;
  const loadAIB = () => AIB ? Promise.resolve(AIB) : loadScript(`ai_bubble.js?v=1&h=${new Date().toISOString().slice(0, 13)}`).then(() => (AIB = window.CTC_AIB || null));
  async function pageAIBubble() {
    setNav("aibubble");
    app.innerHTML = `<h1>Where is the AI bubble?</h1><p class="loading">Loading…</p>`;
    const [P, D] = await Promise.all([loadAllPrices(), loadAIB()]); if (location.hash !== "#/aibubble") return;
    if (!D) { app.innerHTML = `<h1>Where is the AI bubble?</h1><p class="muted">Couldn't load this page's data.</p>`; return; }
    const L = P.dates.length - 1, yr = (tk) => { const x = P.px[tk]; return x && x[L] && x[L - 252] ? x[L] / x[L - 252] - 1 : null; };
    // numbered source links, in the order they first appear
    const used = [], src = (...keys) => keys.filter((k) => k && D.sources[k]).map((k) => { if (!used.includes(k)) used.push(k); return `<a class="ab-src" href="${esc(D.sources[k].url)}" target="_blank" rel="noopener" title="${esc(D.sources[k].name)}">${used.indexOf(k) + 1}</a>`; }).join("");
    const bar = (label, v, mx, c, txt) => `<div class="bb-row"><span class="bb-l">${label}</span><span class="bb-t"><i style="width:${Math.max(1, Math.abs(v) / mx * 100).toFixed(1)}%;background:${c}"></i></span><b class="mono">${txt}</b></div>`;
    const moveBars = (list) => { const rows = list.map(([n, tk]) => [n, tk, yr(tk)]).filter((r) => r[2] != null), mx = Math.max(1, ...rows.map((r) => Math.abs(r[2])));
      return rows.map(([n, tk, y]) => bar(`${esc(n)} <span class="muted">${tk}</span>`, y, mx, y >= 0 ? "var(--good)" : "var(--bad)", pct(y, 0))).join(""); };
    // the biggest US-listed companies today, with the private labs placed at their reported values
    const big = Object.entries(stocks).filter(([t, s]) => s[4] > 5e11 && !["GOOG"].includes(t)).map(([t, s]) => ({ name: coName(t), v: s[4] }));
    const ranked = [...big, ...D.labs.map((l) => ({ name: `${l.name} (private)`, v: l.value, lab: true }))].sort((a, b) => b.v - a.v).slice(0, 14);
    const rk = (n) => ranked.findIndex((r) => r.name.startsWith(n)) + 1, vmx = ranked[0].v;
    const cw = D.coreweave, odds = cw.defaultOdds;
    const labTxt = D.labs.map((l) => `${l.name} ${l.label.replace("~", "")}`).join(" · ");
    const nextHtml = (() => { const main = D.next.filter((s) => !s.fork), fork = D.next.filter((s) => s.fork);
      const step = (s, k) => `<div class="nx-step${s.kind ? " " + s.kind : ""}">${k != null ? `<span class="nx-n">${k + 1}</span>` : ""}<b>${esc(s.title)}</b><span class="small muted">${esc(s.text)}</span></div>`;
      return main.map((s, k) => step(s, k)).join(`<div class="nx-arrow">→</div>`) + (fork.length ? `<div class="nx-arrow">→</div><div class="nx-fork">${fork.map((s) => step(s)).join("")}</div>` : ""); })();
    app.innerHTML = `<div class="ab-hero"><div><span class="ab-kick">AI bubble watch · updated ${fmtDate(D.updated)}</span><h1>Where is the AI bubble?</h1>
        <p class="lede">AI shares have had a scary few weeks and talk of a crash is everywhere. The numbers point somewhere more specific: listed AI companies are priced on fast-growing profits, while the private AI labs about to sell shares to the public are priced on hope, and that is where the risk sits.</p>
        <p class="small muted">Share moves and company values update with every market close. Facts from the news are dated, with numbered links to their sources.</p></div>
        <div class="card ab-news"><h2>What's new</h2><ul>${D.updates.map((u) => `<li><span class="ab-date">${fmtDate(u.date)}</span><span>${esc(u.text)} ${src(u.src, u.src2)}</span></li>`).join("")}</ul></div></div>

      <div class="card section ab-two"><h2>A tale of two bubbles</h2>
        <svg viewBox="0 0 900 300" class="ab-bubbles" role="img" aria-label="Listed AI stocks: priced on profits. Private AI labs: priced on hope, the bigger risk">
          <circle cx="230" cy="160" r="95" fill="var(--good-soft)" stroke="var(--good)" stroke-width="2" stroke-dasharray="6 5"/>
          <text x="230" y="140" text-anchor="middle" font-size="20" font-weight="800" fill="var(--ink)">AI stocks</text>
          <text x="230" y="164" text-anchor="middle" font-size="14" fill="var(--ink-2)">Nvidia, Broadcom, Micron,</text><text x="230" y="182" text-anchor="middle" font-size="14" fill="var(--ink-2)">Big Tech</text>
          <text x="230" y="212" text-anchor="middle" font-size="13" font-weight="700" fill="var(--good)">risk largely priced in</text>
          <text x="230" y="285" text-anchor="middle" font-size="13" fill="var(--muted)">Public market · priced on profits</text>
          <circle cx="620" cy="150" r="140" fill="var(--bad-soft)" stroke="var(--bad)" stroke-width="2.5"/>
          <text x="620" y="118" text-anchor="middle" font-size="22" font-weight="800" fill="var(--ink)">Private AI labs</text>
          <text x="620" y="146" text-anchor="middle" font-size="15" fill="var(--ink-2)">${esc(labTxt)}</text>
          <text x="620" y="168" text-anchor="middle" font-size="15" fill="var(--ink-2)">losing money, valued on vision</text>
          <text x="620" y="200" text-anchor="middle" font-size="14" font-weight="700" fill="var(--bad)">the bigger risk</text>
          <text x="620" y="298" text-anchor="middle" font-size="13" fill="var(--muted)">Private market · priced on hope</text>
          <path d="M335 150 C 400 120, 430 120, 470 140" fill="none" stroke="var(--muted)" stroke-width="2" marker-end="url(#abArrow)"/><text x="400" y="112" text-anchor="middle" font-size="12" fill="var(--muted)">going public soon</text>
          <defs><marker id="abArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)"/></marker></defs>
        </svg></div>

      <h2 class="section ab-h">1 · What's worrying markets</h2>
      <div class="grid cols-3">${D.voices.map((v, k) => `<div class="card ab-quote${k === D.voices.length - 1 ? " hot" : ""}"><span class="ab-who">${esc(v.who)} · ${fmtDate(v.date)}</span><blockquote>${v.paraphrase ? esc(v.said) : `“${esc(v.said)}”`}</blockquote><span class="small muted">${v.paraphrase ? "in summary" : "quoted"} ${src(v.src)}</span></div>`).join("")}</div>
      <div class="card section"><h2>CoreWeave: the AI company bond markets are most worried about</h2>
        <div class="ab-cw">
          ${cw.stats.map((s) => `<div class="ab-stat"><span class="lbl">${esc(s.label)}</span><b>${esc(s.value)}</b><span class="muted small">${esc(s.note)} ${src(s.src)}</span></div>`).join("")}
          <div class="ab-donut"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" fill="none" stroke="var(--chip)" stroke-width="16"/><circle cx="60" cy="60" r="46" fill="none" stroke="var(--bad)" stroke-width="16" stroke-dasharray="${(odds.value * 289).toFixed(1)} 289" transform="rotate(-90 60 60)"/><text x="60" y="66" text-anchor="middle" font-size="20" font-weight="800" fill="var(--ink)">${Math.round(odds.value * 100)}%+</text></svg>
            <span class="small">${esc(odds.note)} ${src(odds.src)}</span></div>
        </div><p class="small muted">As of ${fmtDate(cw.asOf)}. A credit default swap is insurance against a company not paying its debts; the more it costs, the likelier markets think a default is.</p></div>

      <div class="card section"><h2>The squeeze: costs up, prices down</h2>
        <div class="ab-squeeze">
          <div class="sq sq-up"><span class="sq-arrow">▲</span><b>The cost of building AI is rising</b><ul>${D.squeeze.up.map((s) => `<li>${s.text} ${src(s.src)}</li>`).join("")}</ul></div>
          <div class="sq-mid">→</div>
          <div class="sq sq-down"><span class="sq-arrow">▼</span><b>The price of selling AI is falling</b><ul>${D.squeeze.down.map((s) => `<li>${s.text} ${src(s.src)}</li>`).join("")}</ul></div>
        </div><p class="small muted">Spending more to build something that sells for less only works while lenders keep lending.</p></div>

      <h2 class="section ab-h">2 · Why listed AI stocks look less like a bubble</h2>
      <div class="grid cols-2">
        <div class="card"><h2>Share prices rose, but what investors pay for profits fell</h2>
          <p class="small">Profits at the chipmakers grew faster than their share prices, so the price paid per dollar of expected profit came down. That is the opposite of 2000, when prices ran far ahead of profits.</p>
          ${D.pe.map((p) => `<div class="pe-g"><b>${esc(p.name)}: ${esc(p.note)}</b>${bar(esc(p.thenLabel), p.then, 45, "var(--muted)", p.then.toFixed(0) + "×")}${bar(esc(p.nowLabel), p.now, 45, "var(--chart)", p.now.toFixed(1) + "×")}<span class="small muted">${src(p.src)}</span></div>`).join("")}
          <p class="small muted">${esc(D.peNote)} ${src(D.peSrc)}</p>
          <div class="pe-g"><b>Share price, past year</b>${moveBars(D.chipmakers)}<span class="small muted">From this site's prices, to ${fmtDate(P.dates[L])}.</span></div></div>
        <div class="card"><h2>Most of the riskiest listed names already fell hard</h2>
          <p class="small muted">"Neoclouds" rent out AI data centres, mostly with borrowed money. Share price over the past year:</p>
          ${moveBars(D.neoclouds)}
          <p class="small muted">From this site's prices, to ${fmtDate(P.dates[L])}. Most of the fragile names have already fallen a long way, so much of the fear is already in their prices.</p></div>
      </div>

      <h2 class="section ab-h">3 · Where the risk is</h2>
      <div class="card"><h2>Where the private AI labs would rank among America's biggest companies</h2>
        <p class="small muted">Biggest US-listed companies by value, live from this site's data, with the two labs placed at their latest reported values: Anthropic would be ${rk("Anthropic")}th and OpenAI ${rk("OpenAI")}th.</p>
        <div class="ab-rank">${ranked.map((r, k) => `<div class="rk-row${r.lab ? " lab" : ""}"><span class="rk-n">${k + 1}</span><span class="rk-name">${esc(r.name)}</span><span class="rk-t"><i style="width:${(r.v / vmx * 100).toFixed(1)}%"></i></span><b class="mono">${usd(r.v)}</b></div>`).join("")}</div>
        <div class="grid cols-2 ab-ex">${D.labs.map((l) => `<div><b>${esc(l.name)}: ${esc(l.label)}</b><p class="small">${esc(l.status)}. As of ${fmtDate(l.asOf)}. ${src(l.src, l.src2)}</p></div>`).join("")}</div></div>
      <div class="card section"><h2>Two kinds of investor, two kinds of price</h2>
        <div class="ab-mkts"><div class="mk private"><b>Private market</b><span class="muted">Venture capital and big-tech partners</span><ul><li>Pay for the founders, the talent and the vision</li><li>Set the values of OpenAI and Anthropic</li><li>Few outside checks on the numbers</li></ul></div>
          <div class="mk-vs">vs</div>
          <div class="mk public"><b>Public market</b><span class="muted">Investors on the stock exchange</span><ul><li>Pay for profits and margins</li><li>Set the prices of Nvidia and Big Tech</li><li>Full accounts, every quarter</li></ul></div></div>
        <p class="ab-verdict">The test comes when the labs list: the stock market will price them like the rest of the market.</p></div>

      <h2 class="section ab-h">4 · What happens next</h2>
      <div class="card"><div class="ab-next">${nextHtml}</div></div>

      <div class="card section ab-take"><h2>The takeaway</h2><div class="grid cols-3">
        <div><b>Listed AI stocks</b><p class="small">Prices rose because profits rose, and investors now pay less per dollar of profit. Risky, but not a bubble in the 2000 sense.</p></div>
        <div><b>Private AI labs</b><p class="small">Valued in the trillions while losing money, and about to face public investors. That is where a fall would come from.</p></div>
        <div><b>What to watch</b><ul class="small">${D.watch.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>
      </div></div>
      <div class="card section ab-sources"><h2>Sources</h2><ol class="small">${used.map((k) => `<li><a href="${esc(D.sources[k].url)}" target="_blank" rel="noopener">${esc(D.sources[k].name)}</a></li>`).join("")}</ol>
        <p class="small muted">Facts last checked ${fmtDate(D.updated)}; prices to ${fmtDate(P.dates[L])}. Reported values of private companies are not official. Not investment advice.</p></div>`;
  }

  // ---------- How the numbers are made (the classic site's method notes, for the Congress pages) ----------
  async function pageMethod() {
    setNav("method");
    app.innerHTML = `<h1>How the numbers are made</h1><p class="loading">Loading…</p>`;
    await Promise.all([window.CTC_ESTTEST ? 1 : loadScript("estimate_test.js"), window.CTC_PHOTO_CREDITS ? 1 : loadScript("photo_credits.js")]);
    if (location.hash !== "#/method") return;
    const startShort = fmtDate(D.start, { month: "short", year: "numeric" });
    const docs = Object.values(D.docs || {}), house = docs.filter((d) => !/oge\.gov/.test(d[0])), oge = docs.filter((d) => /oge\.gov/.test(d[0]));
    const nE = house.filter((d) => d[2]).length, nP = house.length - nE;
    const execs = members.filter((m) => m.chamber === "E"), pres = execs.find((m) => m.role === "President");
    const presTrades = pres ? trades.filter((t) => t.m === pres.i).length : 0;
    const paper = D.paper || [], readRows = paper.reduce((a, p) => a + (p.rows || 0), 0);
    const flagged = D.trades.filter((r) => r[F.fl] && r[F.fl].length && !(stocks[r[F.t]] && stocks[r[F.t]][1] === "Crypto")).length;  // crypto is left off, as everywhere
    const traded = new Set(trades.map((t) => t.m));
    const small = D.trades.filter((r) => r[F.ex] && r[F.lo] === 1001 && r[F.hi] === 15000).map((r) => r[F.ex][0]).sort((a, b) => a - b);
    const typical = small.length ? small[Math.floor(small.length / 2)] : null;
    const sec = (title, body, open = false) => `<details class="card mth"${open ? " open" : ""}><summary>${title}</summary><div class="mth-body">${body}</div></details>`;

    const sources = `<p>Every Periodic Transaction Report filed with the House Clerk for ${D.start.slice(0, 4)}–${D.generated.slice(0, 4)}: ${nE.toLocaleString()} filed electronically and ${nP} filed on paper. Trades dated before ${fmtDate(D.start)} are left out.</p>
      <p>Senate trades (${trades.filter((t) => t.src === "s").length.toLocaleString()} since ${startShort}) come, for now, from Quiver Quantitative's public politician pages, which transcribe the Senate's official reports: the Senate's own site refuses requests from where this site is built. They will be swapped for the official reports later. Senators who were in the House earlier also show the trades they reported as House members.</p>
      <p>The President and ${execs.length - (pres ? 1 : 0)} Cabinet-level officials (department heads and their deputies, the Federal Reserve's governors and others paid at Levels 1 and 2 of the Executive Schedule) report their trades to the Office of Government Ethics on Form 278-T. All ${oge.length} such reports OGE has published since ${startShort} are included. Most are filed electronically; the President's are printed, signed and scanned, so they are read automatically like the House's paper forms (${presTrades.toLocaleString()} trades).</p>
      <p>Business leaders (${members.filter((m) => isBiz(m) && traded.has(m.i)).length}, such as Elon Musk, Mark Zuckerberg, Jensen Huang and Warren Buffett's Berkshire Hathaway) are shown separately. Their open-market buys and sells come from the SEC's Form 4, which company officers, directors and owners of more than 10% must file within two business days, read from OpenInsider's public pages (${trades.filter((t) => t.src === "i").length.toLocaleString()} trades). Form 4 gives share counts and prices, so these amounts are exact. Stock awards, option grants and gifts are left out.</p>
      <p>Officials' yearly financial disclosures (OGE Form 278e) list what they own, with value ranges, on one day a year. They are used for "still holds" figures, kept apart from the trades, so they never change any total, return or chart.</p>
      <p>Each trade links to the original filing on the House Clerk's or OGE's site, Quiver or OpenInsider, so any number here can be checked against the source.</p>`;

    const estimate = `<p>Members report each trade as a dollar range (for example $15,001–$50,000), not an exact amount. The STOCK Act only asks for these value bands, so most filings never give the exact dollars. Most trackers count each trade at the middle of its range. Actual amounts are rarely centred in their ranges, so this site uses a calibrated best estimate instead.</p>
      <p><b>Best estimate.</b> In the ${POS.length} trades where a filing also gave the share count, so the exact amount is known, most amounts sit near the bottom of their range${typical ? ` (a $1,001–$15,000 trade was typically $${(typical / 1000).toFixed(1)}K, not the $8,000 middle)` : ""}. So each trade is counted at the average amount of known trades placed the same way in that range. A total also gets a <b>likely range</b>, where the real total should fall 7 times in 10, because small misses on single trades partly cancel out. The full range the filings allow, with every trade at the bottom or every trade at the top, is far wider and almost never the real total. "How accurate the best estimates are" shows the test.</p>
      <p><b>Exact amounts.</b> A few members also write the number of shares in the trade's description ("Purchased 10,000 shares", "sold 75 shares at $72.22"). For those trades the amount is calculated exactly: the total the filing states, or the shares times the price it states, or else the shares times the stock's closing price on the trade date. The result is used only if it falls inside the reported range. Exercised options count at the strike price paid. Scanned paper forms have no description field, so their trades always use ranges.</p>
      <p>Returns are measured two ways. "Trade date" measures the member's own timing. "Disclosure date" measures what an investor could have achieved by acting on the filing: buy at the closing price on the day the report was filed, and sell on the day their sale was filed. Members can wait up to 45 days to report, so the disclosure-date figure is the realistic measure for anyone following their trades. Each Congress page lets you pick one under "More filters".</p>
      <p>A buy is held until the same member reports a full sale of that stock; partial sales don't close it. If no full sale is reported, it is valued at the latest closing price. Its result is compared with SPY, an S&amp;P 500 fund, bought and sold on the same days. The buy price is the stock's closing price on the trade date, since filings don't give the exact price.</p>
      <p>For a sale, "since trade" shows how the stock moved after they sold. A decline after a sale indicates a well-timed sale.</p>
      <p>Options (calls and puts) are valued by how the underlying stock moved: a call gains when the stock rises, a put when it falls. Real options are leveraged, so their actual gains and losses were larger than shown. Turn off "Include options" under "More filters" to leave them out.</p>
      <p>Company size is today's market value, not the value on the trade date. Funds, ETFs and foreign shares are priced from their market prices and count like stocks; funds and ETFs are left out with large caps when "No large caps" is on. Bonds, private holdings, and companies bought out or delisted since the trade have no public price here, so they are left out of return calculations.</p>`;

    const AT = window.CTC_ESTTEST;
    let accuracy = "<p>The accuracy test has not yet been run on this data.</p>";
    if (AT) {
      const T = AT.tests, p0 = (x) => Math.round(x * 100) + "%", sg = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.round(Math.abs(x) * 100) + "%";
      const cut = (s) => Math.round((1 - s.est_median_err / s.mid_median_err) * 100);
      const g40 = T.groups["40"], g10 = T.groups["10"], one = T.single_loo, ms = T.members_score;
      const nm = T.members.filter((x) => x.n >= 2), closerM = nm.filter((x) => Math.abs(x.est - x.real) < Math.abs(x.mid - x.real)).length;
      const heldM = nm.filter((x) => x.real >= x.lo && x.real <= x.hi).length;
      const worse = Object.entries(T.single_by_range).filter(([, s]) => s.est_median_err > s.mid_median_err)
        .map(([k, s]) => { const [lo, hi] = k.split("-").map(Number); return `${usd(lo)}–${usd(hi)} trades (${s.n}: ${p0(s.mid_median_err)} for the middle, ${p0(s.est_median_err)} for the best estimate)`; });
      const tests = [
        ["Single trades, each estimated from the other known trades", one],
        ["Single trades of $1,001–$15,000, the most common range", T.single_by_range["1001-15000"]],
        ["Single trades, using only other members' trades", T.single_lmo],
        ["Random groups of 10 trades (5,000 draws)", g10],
        ["Random groups of 40 trades (5,000 draws)", g40],
        ["Each member's total, using only other members' trades", ms],
        [`Learned from trades before ${fmtDate(T.time_split.cut)}, tested on later ones`, T.time_split.early_to_late],
        ["Learned from later trades, tested on earlier ones", T.time_split.late_to_early],
        T.insiders_single && [`Outside check: ${T.insiders_n.toLocaleString()} business leaders' Form 4 trades, put into the same ranges`, T.insiders_single],
        T.insiders_groups10 && ["Outside check: groups of 10 Form 4 trades", T.insiders_groups10]].filter((x) => x && x[1]);
      accuracy = `<p>The best estimate was tested against the ${AT.known} congressional trades whose real amount is known (the filing gave the share count), from ${AT.members} members. A trade's own real amount is never used to estimate it: each test learns from the other known trades only, then compares both methods with the real amounts.</p>
        <div class="mth-kpis"><div><span class="lbl">Single trades: typical miss</span><b>${p0(one.est_median_err)}</b><span class="muted small">vs ${p0(one.mid_median_err)} for the middle of the range</span></div>
          <div><span class="lbl">Groups of 40: typical miss</span><b>${p0(g40.est_median_err)}</b><span class="muted small">vs ${p0(g40.mid_median_err)} for the middle</span></div>
          <div><span class="lbl">Members' totals: closer</span><b>${closerM} of ${nm.length}</b><span class="muted small">members, best estimate vs middle</span></div></div>
        <p><b>Single trades.</b> The middle of the range missed the real amount by a typical ${p0(one.mid_median_err)}; the best estimate by ${p0(one.est_median_err)}, and it was the closer of the two for ${p0(one.est_closer)} of trades. The middle is too high on average (${sg(one.mid_bias)}), because ${p0(T.bottom_third_dollars)} of real trades sit in the bottom third of their range; the best estimate runs high too, but much less (${sg(one.est_bias)}).</p>
        <p><b>Totals.</b> This is where the gap grows. The middle of the range is too high almost every time, so its misses add up instead of cancelling out. For random groups of 40 trades it missed by a typical ${p0(g40.mid_median_err)}, the best estimate by ${p0(g40.est_median_err)}, and the best estimate was closer in ${p0(g40.est_closer)} of 5,000 draws. For each member's own total, the best estimate was closer for ${closerM} of ${nm.length} members.</p>
        <p><b>How much more accurate.</b> Typical misses are ${cut(one)}% smaller for single trades, ${cut(g10)}% smaller for groups of 10, ${cut(g40)}% smaller for groups of 40 and ${cut(ms)}% smaller for members' totals. The <b>likely range</b> held the real amount for ${p0(one.coverage)} of single trades, ${p0(g10.coverage)} of groups of 10 and ${heldM} of ${nm.length} members' totals. It aims for 7 in 10, so it is about right for single trades and members' totals and a little narrow for big groups of trades.</p>
        <div class="tscroll"><table class="mth-table"><thead><tr><th>Test</th><th class="r">Cases</th><th class="r">Middle of range misses by</th><th class="r">Best estimate misses by</th><th class="r">Best estimate closer</th><th class="r">Likely range held</th></tr></thead><tbody>
        ${tests.map(([name, s]) => `<tr><td>${esc(name)}</td><td class="r mono">${s.n.toLocaleString()}</td><td class="r mono">${p0(s.mid_median_err)}</td><td class="r mono"><b>${p0(s.est_median_err)}</b></td><td class="r mono">${p0(s.est_closer)}</td><td class="r mono">${p0(s.coverage)}</td></tr>`).join("")}
        </tbody></table></div>
        <p>Each member's known trades added up, estimated only from other members' trades:</p>
        <div class="tscroll"><table class="mth-table"><thead><tr><th>Member</th><th class="r">Trades</th><th class="r">Full range</th><th class="r">Real total</th><th class="r">Middle of ranges</th><th class="r">Best estimate</th><th class="r">Likely range</th></tr></thead><tbody>
        ${nm.map((x) => `<tr><td>${esc(x.name)}</td><td class="r mono">${x.n}</td><td class="r mono">${usd(x.min)}–${usd(x.max)}</td><td class="r mono"><b>${usd(x.real)}</b></td><td class="r mono">${usd(x.mid)} (${sg(x.mid / x.real - 1)})</td><td class="r mono">${usd(x.est)} (${sg(x.est / x.real - 1)})</td><td class="r mono">${usd(x.lo)}–${usd(x.hi)} ${x.real >= x.lo && x.real <= x.hi ? "✓" : "✗"}</td></tr>`).join("")}
        </tbody></table></div>
        <p><b>Limits.</b> The known trades come from a handful of members, mostly ${nm.slice(0, 2).map((x) => esc(x.name)).join(", ")} and ${nm[2] ? esc(nm[2].name) : "others"}. Someone who always trades the same size could differ.${worse.length ? ` In one range the middle did slightly better: ${worse.join("; ")}.` : ""} The likely range comes out a little narrow for large groups (${p0(g40.coverage)} held for groups of 40). On single business-leader trades the two methods miss by about the same (${T.insiders_single ? p0(T.insiders_single.mid_median_err) + " and " + p0(T.insiders_single.est_median_err) : "–"}), though the best estimate is much less biased; on groups of their trades it is clearly better. All amounts here stay estimates: only filings that give share counts are exact.</p>
        <p class="small muted">Test run on ${fmtDate(AT.generated)} data.</p>`;
    }

    const signals = `<p>Public signals (Congress ▸ Signals) ranks stocks that members of Congress and officials bought in the last 120 days. Each stock gets a score out of 100% that combines their buying with other public information about the company. Business leaders are left out, since they aren't public officials.</p>
      <p><b>Net buyers (up to 40%).</b> Buying and selling are weighed together, so a stock that is mostly being sold doesn't score well just because a few people bought some. Each person gets one vote: what they bought minus what they sold, using the middle of each reported range (a trade with no stated amount counts at that person's usual size). Three steps keep the vote fair:</p>
      <ul><li><b>Log scale.</b> Every 10 times more money adds the same amount to a vote, so one very large trader can't outweigh everyone else. An $8,000 net buy is worth about 1, $375,000 about 2.6 and $5 million about 3.7.</li>
        <li><b>Their usual trade size.</b> Each person's usual size is the middle of all the trades they have reported since 2023. A trade far larger than usual counts up to twice as much; one far smaller counts as little as half.</li>
        <li><b>Adding up.</b> Buyers' votes count as positive and sellers' as negative. A positive total earns up to 30%; a negative total takes up to 30% off. Three or more different people buying within a month adds 10%, because several people buying close together is a stronger sign than one large trade.</li></ul>
      <p>Net buying is also shown <b>by number of trades</b> and <b>by dollars</b>: (buys − sells) ÷ (buys + sells), from −100% (all selling) to +100% (all buying). This measure, the net purchase ratio, is widely used in research on company insiders' trading. The two can disagree: many small sales against a few large buys gives a negative trades figure and a positive dollars figure.</p>
      <p><b>Committee (up to 20%).</b> 10% for each net buyer whose committee covers the company's industry (see "Which industries each committee oversees").</p>
      <p><b>Contracts (up to 15%).</b> Federal contract money awarded to the company in the last 90 days, from USAspending.gov.</p>
      <p><b>Lobbying (up to 15%).</b> What the company reported spending on lobbying in the latest House lobbying disclosures, with its most frequent lobbying topic.</p>
      <p><b>Hearings (up to 10%).</b> House committee hearings and markups in the next 28 days that name the company (10%) or cover its industry (2%), from the House committee calendar.</p>
      <p><b>Leaders (up to 10%).</b> Posts in the last 30 days by well-known political figures that name the company or its ticker: 4% for each person, plus 1 for each further post. A mention counts whether it praises or criticises the company, since either can move a stock. Company names that are also everyday words, such as Apple or Target, count only when the ticker is used. Only personal accounts are read, and a post doesn't count when the person runs, owns or works for the company.</p>
      <p><b>Insiders (up to 10%).</b> The company's own executives, directors and large shareholders buying its stock on the open market in the last 90 days (SEC Form 4 filings). Only people whose purchases add up to at least $25,000 count.</p>
      <p>The parts are added and the total is capped at 100%. The score shows where several public signals point the same way. It is not a prediction or investment advice.</p>`;

    const words = `<p><b>Filters</b>: each Congress page's own choices, in the bar under the top of the page (whose trades, committee, large caps, committee-linked, and more under "More filters"). Totals, rankings and tables on that page use the trades that pass them.</p>
      <p><b>Large caps</b>: S&amp;P 500 companies, companies above the selected market cap, and any tickers on the "always leave out" list. Most funds and pension plans hold them, so buying them reveals little about inside knowledge. The same option leaves out <b>funds and ETFs</b>, which hold many companies at once.</p>
      <p><b>Buying spike</b>: at least 3 different members buying the same stock within about a month, when that many would happen by chance less than 1 time in 20 at the stock's usual rate (a Poisson test). Large caps bought during a spike still count while "except during buying spikes" is on.</p>
      <p><b>Likely range</b>: the narrower span inside a filing's dollar range where the real amount sits 7 times in 10, learned from trades whose exact amount is known. Totals get their own likely range, narrower again because small misses partly cancel out. Charts and rankings use the best estimate in the middle of it.</p>
      <p><b>Return</b>: gain or loss as a percentage of the money put in. <b>Vs S&amp;P 500</b>: the gap between two returns. A buy up 30% while the S&amp;P 500 rose 10% over the same days is +20% ahead.</p>
      <p><b>Trade date / disclosure date</b>: whether gains are measured from the trade date (their own timing) or from the filing date (what someone copying the filing could have made).</p>`;

    const whose = `<p>The STOCK Act makes members report trades in their own accounts, their spouse's, their dependent children's, and accounts they hold jointly. Each trade shows which of these it came from, and the "Account" filter separates them.</p>
      <p>Trades by anyone else (other relatives, staff, donors or business partners) are not linked to a member here. Doing so fairly would require verified evidence of coordination, which public filings do not contain.</p>`;

    const committees = `<p>A trade counts as being in a member's committee area when the company's industry, or the company itself, is on that committee's list. These lists are an editorial judgement based on each committee's official jurisdiction. Committees that touch every industry, such as Appropriations or Budget, never match. Committee seats are today's assignments, so an older trade is checked against the committees the member sits on now. Members who have left Congress have no seats listed, so their trades never count as committee matches.</p>
      <div class="mth-comm">${Object.values(D.committees).filter((c) => c.name).sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<div><b>${esc(c.name)}</b><span>${esc(c.oversees || "")}${c.matches ? "" : " · never matches"}</span></div>`).join("")}</div>`;

    const paperTxt = `<p>Some members, including several of the most active traders, file on paper. The Clerk publishes those reports as images of the signed forms, so they are read automatically here: ${readRows.toLocaleString()} trades from ${paper.length} paper filings. Company names written on the forms are matched to stock tickers by name.</p>
      <p>${flagged.toLocaleString()} of those trades are marked "check scan" where a date, amount or trade type should be confirmed against the original form, which every trade links to. Amounts that need checking count as $0 in the totals rather than a guess.</p>
      <p>Where the amount mark on a scan can't be read, the amount comes from Quiver Quantitative's hand transcription of the same filing, when it lists exactly one matching trade (same member, stock, buy or sell, and date). Readable amounts are never changed.</p>`;

    const pc = window.CTC_PHOTO_CREDITS || [];
    const photos = `<p>Portraits of members of Congress are their official, public-domain photos. Officials and business leaders without one use the main photo from their Wikipedia article, under a free licence. Those that ask for credit:</p>`
      + (pc.length ? `<ul class="mth-credits">${pc.map((c) => `<li><b>${esc(c.name)}</b>: ${esc(c.author || "unknown author")}, ${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.license)}</a>` : esc(c.license)}</li>`).join("")}</ul>` : "<p>None.</p>");

    app.innerHTML = `<h1>How the numbers are made</h1>
      <p class="lede">Where the Congress trades come from, how amounts and returns are estimated, how accurate those estimates are, and what the words on the Congress pages mean.</p>
      ${sec("Where the trades come from", sources, true)}
      ${sec("How gains and losses are estimated", estimate)}
      ${sec("How accurate the best estimates are", accuracy)}
      ${sec("How Public signals are scored", signals)}
      ${sec("Words used on these pages", words)}
      ${sec("Whose trades are included", whose)}
      ${sec("Which industries each committee oversees", committees)}
      ${sec("Scanned paper filings", paperTxt)}
      ${sec("Photo credits", photos)}
      <p class="small muted">Sources: U.S. House Clerk financial disclosures (Periodic Transaction Reports) and the Office of Government Ethics (Form 278-T). Senate trades: Quiver Quantitative's transcriptions of Senate reports. Prices: Yahoo Finance. Company size and industry: Nasdaq. Committees and official portraits: the congress-legislators and unitedstates/images projects. This is a research tool, not financial advice.</p>`;
  }

  // ---------- Data Visualization: the classic site's image maker on its own page (linked from the footer only) ----------
  // The classic page at ?view=dataviz shows just that panel; it is sized to its content here so the page scrolls as one.
  function pageDataViz() {
    setNav("dataviz");
    app.innerHTML = `<h1>Data Visualization</h1>
      <p class="lede">Charts and fact sheets built from the Congress filings: a stock's price with each trade marked, a politician's record, the latest disclosures and more. Pick a view, then download or copy it as an image.</p>
      <iframe id="dvFrame" class="dv-frame" src="classic.html?view=dataviz&v=20261026a" title="Data Visualization" allow="clipboard-write"></iframe>`;
    const fr = $("#dvFrame");
    const fit = () => { try { const pm = fr.contentDocument && fr.contentDocument.getElementById("postMaker"); if (pm) fr.style.height = `${Math.ceil(pm.getBoundingClientRect().height) + 24}px`; } catch (e) { /* not loaded yet */ } };
    fr.addEventListener("load", () => {
      fr.classList.add("ready"); fit();
      try { new ResizeObserver(fit).observe(fr.contentDocument.getElementById("postMaker")); } catch (e) { /* older browser: sized once */ }
    });
  }
  // the image maker asks for its full-size view here, so it covers the whole page rather than just the frame
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== "ctc-dv-image") return;
    const v = $("#dvView"); $("img", v).src = e.data.src; v.hidden = false; document.body.style.overflow = "hidden"; $("button", v).focus();
  });
  const closeDv = () => { const v = $("#dvView"); if (v.hidden) return; v.hidden = true; document.body.style.overflow = ""; };
  $("#dvView").addEventListener("click", closeDv);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDv(); });

  // ---------- routing ----------
  let lastPage = null;
  function route(keepScroll) {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, "")), [page, arg] = h.split("/");
    if (keepScroll !== true) window.scrollTo(0, 0);
    if (FILTER_PAGE[page]) usePageFilter(FILTER_PAGE[page]); else fPage = null;
    if (page !== lastPage) { fMoreOpen = false; lastPage = page; }
    if (page === "politicians") pagePoliticians();
    else if (page === "stocks") pageStocks();
    else if (page === "member" && arg) pageMember(arg);
    else if (page === "stock" && arg) pageStock(arg.toUpperCase());
    else if (page === "leaders") pageLeaders();
    else if (page === "signals") pageSignals();
    else if (page === "drops") pageDrops();
    else if (page === "congress") pageHome();
    else if (page === "movers") pageMovers();
    else if (page === "aftermath") pageAftermath();
    else if (page === "investments") pageInvest();
    else if (page === "production") pageProduction();
    else if (page === "aibubble") pageAIBubble();
    else if (page === "method") pageMethod();
    else if (page === "dataviz") pageDataViz();
    else pageMarkets();
    // the page's period and its other main choices stay in a bar under the top bar while scrolling
    pinBar();
    bindFilters();
    setTimeout(() => { const t = $("h1", app); document.title = t && page ? `${t.textContent} · HarryV12 Finance` : "HarryV12 Finance"; }, 0);
  }
  function pinBar() {
    const sb = $("#subbar"), row = $(".sub-row", sb), tb = $(".toolbar.pin-top", app), h1t = $("h1", app);
    row.innerHTML = ""; $$(".fmore-panel", sb).forEach((x) => x.remove());
    if (tb) { row.insertAdjacentHTML("beforeend", `<span class="sb-title">${esc(h1t ? h1t.textContent : "")}</span>`); row.appendChild(tb); const pn = $(".fmore-panel", app); if (pn) sb.appendChild(pn); }
    sb.hidden = !tb; fitSubbar();
  }
  // the bar sits right under the top bar where that stays put (wide screens); on phones it sticks to the top itself
  function fitSubbar() { const top = $("header.top"); document.documentElement.style.setProperty("--toph", getComputedStyle(top).position === "sticky" ? `${top.offsetHeight}px` : "0px"); }
  window.addEventListener("resize", fitSubbar, { passive: true });
  window.addEventListener("hashchange", () => route());
  $("#theme").addEventListener("click", () => {
    const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t; try { localStorage.setItem("ctc-theme", t); } catch (e) { /* storage blocked */ }
    const fr = $("#dvFrame"); try { if (fr && fr.contentDocument) fr.contentDocument.documentElement.dataset.theme = t; } catch (e) { /* not loaded */ }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && fMoreOpen) { fMoreOpen = false; const pn = $("#subbar .fmore-panel"); if (pn) pn.hidden = true; $$("[data-fmore]").forEach((b) => b.setAttribute("aria-expanded", "false")); } });
  bindSearch();
  route();
  // the hype check also uses Public signals (company insiders, federal contracts): redraw once it has loaded
  loadSignals().then((G) => { SIG_BY = new Map(((G && G.stocks) || []).map((r) => [r.t, r])); hypeCache.clear(); if ($("[data-hype]", app)) route(true); });
})();
