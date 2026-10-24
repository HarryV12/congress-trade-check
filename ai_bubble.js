/* AI bubble watch: the hand-kept facts behind the AI bubble page. The page adds live figures from the site's
   prices (one-year share moves, company values). To update: add a dated line to the top of `updates`, change the
   facts below (each has its own date and source), and set `updated`. See UPDATING.md. */
window.CTC_AIB = {
  updated: "2026-10-24",
  // newest first; shown as "What's new"
  updates: [
    { date: "2026-10-23", text: "Anthropic's IPO is expected on Nasdaq as soon as November; talk of its value has slipped to about $1.5T after third-quarter results, below the $2T it had sought. OpenAI is raising money at a reported $1.25T, down from $1.4T, and has ruled out listing in 2026.", src: "beincrypto", src2: "futuresearch" },
    { date: "2026-10-19", text: "CoreWeave's bonds still yield about 14.9% even as AI shares bounced; its credit default swaps sit near 1,082 basis points, a level treated as distress.", src: "cnbc_cw19" },
    { date: "2026-10-15", text: "CoreWeave's five-year credit default swaps hit a record of about 1,194 basis points, which markets read as a more than 60% chance of default within five years.", src: "benzinga_cds" },
    { date: "2026-10-12", text: "Broadcom's CEO Hock Tan said many AI investors \"have no clue what they are investing in\" and that capital, not chips or power, may become AI's biggest constraint.", src: "fortune_tan", src2: "cnbc_tan" },
    { date: "2026-10-09", text: "Jefferies' Chris Wood repeated his warning that debt-funded AI spending is likely to end in \"massive capital destruction\" in the US.", src: "cryptobriefing_wood" }
  ],
  // what people who matter are saying; keep 3, newest first
  voices: [
    { who: "Hock Tan, Broadcom CEO", date: "2026-10-12", said: "A lot of investors have no clue what they are investing in.", src: "fortune_tan" },
    { who: "Chris Wood, Jefferies' global head of equity strategy", date: "2026-09-17", said: "Big Tech's AI spending won't earn enough to justify itself; expect significant capital destruction.", paraphrase: true, src: "business_standard_wood" },
    { who: "Bond markets, on CoreWeave", date: "2026-10-15", said: "Its default swaps priced a better-than-even chance of default within five years.", paraphrase: true, src: "benzinga_cds" }
  ],
  // CoreWeave: the AI company whose debt markets are most worried about
  coreweave: {
    asOf: "2026-10-19",
    stats: [
      { label: "Debt", value: "$35.6B", note: "principal, 30 Jun 2026; about $52B with leases", src: "register_cw" },
      { label: "2026 revenue (company forecast)", value: "$12.4–13.2B", note: "revenue doubled in the second quarter", src: "cnbc_cw_q2" },
      { label: "Bond yield", value: "14.9%", note: "9.625% bond due 2032, 19 Oct; record 15.76% on its 2031 bond", src: "cnbc_cw19" }
    ],
    // implied five-year default probability from credit default swaps
    defaultOdds: { value: 0.6, label: "more than 60%", note: "chance of default within 5 years implied by its credit default swaps at the 15 Oct record", src: "benzinga_cds" }
  },
  // costs going up, prices going down
  squeeze: {
    up: [
      { text: "Big Tech's AI building budgets: about <b>$695B</b> in 2026, heading for <b>$870B</b> in 2027, more of it borrowed", src: "business_standard_wood" },
      { text: "Broadcom's CEO: <b>capital</b> may become AI's biggest constraint, more than chips or power", src: "cnbc_tan" }
    ],
    down: [
      { text: "OpenAI cut its cheapest model's price by <b>80%</b> (30 Jul 2026) as Chinese open-weight models undercut it", src: "forbes_cut" },
      { text: "It cut its top model by <b>20–33%</b> in August, on a promotional price", src: "technology_org_cut" }
    ]
  },
  // share price up, price-to-earnings down: investors already discount the risk
  pe: [
    { name: "Nvidia", tk: "NVDA", then: 40, thenLabel: "Jul 2025", now: 23.2, nowLabel: "Jul 2026", note: "forward price-to-earnings", src: "fool_nvda" }
  ],
  peNote: "By late October some data providers put Nvidia's forward multiple as low as 16–18, about half of Apple's.",
  peSrc: "wallst_apple",
  // AI data-centre renters ("neoclouds"): one-year moves come from the site's prices
  neoclouds: [["CoreWeave", "CRWV"], ["IREN", "IREN"], ["Cipher Mining", "CIFR"], ["Nebius", "NBIS"]],
  chipmakers: [["Nvidia", "NVDA"], ["Broadcom", "AVGO"], ["Micron", "MU"], ["AMD", "AMD"]],
  // the private AI labs, placed among the biggest US-listed companies (whose values are live)
  labs: [
    { name: "Anthropic", value: 1.5e12, label: "~$1.5T", status: "IPO expected as soon as November; value discussed after Q3 (it sought $2T; last private round $965B)", asOf: "2026-10-23", src: "beincrypto", src2: "futuresearch" },
    { name: "OpenAI", value: 1.25e12, label: "~$1.25T", status: "private fundraise target (down from $1.4T); no IPO in 2026", asOf: "2026-10-23", src: "newscord", src2: "futuresearch" }
  ],
  // what decides it next; edit as events happen
  next: [
    { kind: "", title: "Anthropic files publicly", text: "The full S-1 shows its losses, training costs and the $600B of computing it has committed to." },
    { kind: "", title: "IPO priced", text: "Wall Street sets a price on profits and growth, not on private-round hopes." },
    { kind: "bad", title: "Priced lower", text: "A value well under $1.5T would mark the private-market bubble down.", fork: true },
    { kind: "warn", title: "Delayed", text: "Pulling or postponing the listing would say the same thing, more quietly.", fork: true }
  ],
  watch: ["Anthropic's IPO price and first-day trading", "CoreWeave's bond yields and default swaps", "OpenAI's fundraise value", "AI model price cuts", "Big Tech's 2027 spending plans at January results"],
  sources: {
    beincrypto: { name: "BeInCrypto: Anthropic IPO filing and OpenAI's fundraise", url: "https://beincrypto.com/openai-fundraise-anthropic-ipo-valuation/" },
    futuresearch: { name: "FutureSearch: Anthropic and OpenAI IPO dates and valuations", url: "https://futuresearch.ai/anthropic-openai-ipo-dates-valuations/" },
    newscord: { name: "Newscord: Anthropic prepares 2026 IPO (6 outlets compared)", url: "https://newscord.org/article/anthropic-prepares-2026-ipo-as-investors-await-filing-on-600-billion-infrastruct--Story_20261023_WhatsomeofAnthropicseba9c3b5" },
    cnbc_cw19: { name: "CNBC, 19 Oct 2026: CoreWeave bond yields stay near 15%", url: "https://www.cnbc.com/2026/10/19/coreweave-oracle-ai-credit-stress.html" },
    benzinga_cds: { name: "Benzinga: CoreWeave's \"Darwin moment\", markets price 60% default odds", url: "https://www.benzinga.com/markets/tech/26/10/62412918/coreweave-bonds-distress-ai-darwin-moment-hartnett" },
    register_cw: { name: "The Register, 12 Aug 2026: CoreWeave's debt pile reaches $35.6B", url: "https://www.theregister.com/off-prem/2026/08/12/coreweave-revenue-doubles-as-debt-pile-reaches-356b/5286832" },
    cnbc_cw_q2: { name: "CNBC, 11 Aug 2026: CoreWeave revenue doubles", url: "https://www.cnbc.com/2026/08/11/coreweave-crwv-q2-earnings-report-2026.html" },
    fortune_tan: { name: "Fortune, 15 Oct 2026: Hock Tan says AI investors are \"in a casino\"", url: "https://fortune.com/2026/10/15/broadcom-hock-tan-ai-investing-casino/" },
    cnbc_tan: { name: "CNBC, 12 Oct 2026: Intel and Broadcom CEOs warn of a capital crunch", url: "https://www.cnbc.com/2026/10/12/intel-broadcom-ceos-warn-capital-crunch-could-become-ai-bottleneck.html" },
    cryptobriefing_wood: { name: "Crypto Briefing: Jefferies' Chris Wood warns of capital destruction", url: "https://cryptobriefing.com/jefferies-warns-us-ai-capital-destruction/" },
    business_standard_wood: { name: "Business Standard: Chinese AI models can trigger capital destruction in US, Chris Wood", url: "https://www.business-standard.com/markets/news/chinese-ai-models-can-trigger-massive-capital-destruction-in-us-chris-wood-126072800660_1.html" },
    forbes_cut: { name: "Forbes, 31 Jul 2026: OpenAI's 80% price cut", url: "https://www.forbes.com/sites/geruiwang/2026/07/31/why-openais-80-price-cut-could-trigger-a-race-to-the-bottom-in-ai/" },
    technology_org_cut: { name: "Technology.org, 24 Aug 2026: OpenAI cuts GPT-5.6 Sol prices", url: "https://www.technology.org/2026/08/24/openai-gpt-5-6-sol-price-cut-developers/" },
    fool_nvda: { name: "Motley Fool: Nvidia's forward P/E has fallen as its stock rose", url: "https://www.fool.com/investing/2026/07/11/nvidias-forward-pe-has-actually-fallen-as-its-stoc/" },
    wallst_apple: { name: "24/7 Wall St., 20 Oct 2026: Apple trades at twice Nvidia's forward P/E", url: "https://247wallst.com/investing/2026/10/20/apple-now-trades-at-twice-nvidias-forward-p-e/" }
  }
};
