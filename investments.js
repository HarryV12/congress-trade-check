/* Major investments: who put money in, the company it went to, and the listed companies linked to it.
   Written from official announcements and news reports (sources on each). Share counts and prices are as announced;
   today's values and moves are worked out on the page from the daily closes. "status" says whether a deal is final. */
window.CTC_INVEST = {
  updated: "2026-10-24",
  deals: [
    {
      id: "helion", date: "2026-10-22", status: "Letter of intent (not final)",
      title: "Government to take a stake in fusion company Helion",
      center: { name: "Helion", sub: "Fusion power · private", value: "$15.5B (June 2026 valuation)" },
      tiles: [{ label: "US gov't stake in GFS", stake: { tk: "GFS", shares: 9907399, price: 37.85, date: "2026-09-03" } }],
      summary: "The Commerce Department signed a letter of intent to put up to $175M of CHIPS research money into Helion over three years, in return for a non-voting equity stake, for power-electronics chips used in fusion machines. Helion adds $50M of its own. The stake only starts once a final agreement is signed.",
      inflows: [
        { name: "Dept. of Commerce", amount: "up to $175M", note: "CHIPS R&D funding, paid as equity", kind: "gov" },
        { name: "Sam Altman", amount: "~⅓ owner", note: "OpenAI CEO; long-time chairman", kind: "person" },
        { name: "Peter Thiel", amount: "investor", note: "via Mithril Capital", kind: "person" },
        { name: "SoftBank and others", amount: "$425M + $465M", note: "2025 Series F and June 2026 Series G rounds", kind: "company" }
      ],
      links: [
        { tk: "MSFT", role: "Buys 50 MW", note: "Agreed in 2023 to buy power from Helion's first plant (target 2028)" },
        { tk: "CEG", role: "Sells the power", note: "Constellation agreed to market and deliver Helion's power to Microsoft" },
        { tk: "GFS", role: "Chip R&D", note: "Reported partner on the fusion chip work; the government also owns GFS shares" }
      ],
      trump: ["MSFT", "CEG", "GFS"],
      sources: [
        { name: "GeekWire: Helion lines up potential $175M CHIPS award", url: "https://www.geekwire.com/2026/fusion-startup-helion-lines-up-potential-175m-chips-award-to-develop-advanced-semiconductors/" },
        { name: "Pulse 2.0: Helion signs LOI for up to $175M", url: "https://pulse2.com/helion-signs-loi-for-up-to-175-million-in-chips-act-funding-supporting-225-million-semiconductor-investment/" },
        { name: "r/TrumpsTrades post", url: "https://www.reddit.com/r/TrumpsTrades/comments/1xdnm39/trump_administration_plans_175m_investment_in/" }
      ]
    },
    {
      id: "gfs", date: "2026-09-03", status: "Done (September); second stake agreed in October",
      title: "Government becomes a GlobalFoundries shareholder",
      center: { name: "GlobalFoundries", sub: "US chipmaker · GFS", tk: "GFS" },
      summary: "As the equity part of a CHIPS research award of up to $375M for a secure US quantum-chip foundry, Commerce received 9.9M GlobalFoundries shares at $37.85 (about 1%). In October it agreed to take about 4% more, alongside Japan's plan to put up to $21B into two New York chip plants run by GlobalFoundries.",
      inflows: [
        { name: "Dept. of Commerce", amount: "9.9M shares at $37.85", note: "≈$375M, about 1% (3 Sep 2026)", kind: "gov", stake: { tk: "GFS", shares: 9907399, price: 37.85, date: "2026-09-03" } },
        { name: "Dept. of Commerce", amount: "+≈4% stake", note: "Agreed 14 Oct 2026; terms not disclosed", kind: "gov" },
        { name: "Japan", amount: "up to $21B", note: "Two New York fabs, co-owned with the US government", kind: "gov" }
      ],
      links: [
        { tk: "GFS", role: "The company", note: "Runs the new fabs and the quantum foundry" }
      ],
      trump: ["GFS"],
      sources: [
        { name: "Cleary Gottlieb: GlobalFoundries share issuance to Commerce", url: "https://www.clearygottlieb.com/news-and-insights/news-listing/globalfoundries-in-issuance-of-ordinary-shares-to-us-department-of-commerce" },
        { name: "Korea Times: Japan to invest up to $21B in GlobalFoundries-run fabs", url: "https://www.koreatimes.co.kr/world/20261014/japan-to-invest-up-to-21-billion-in-two-us-chip-factories-to-be-run-by-globalfoundries" },
        { name: "TradeZero: administration doubles its GlobalFoundries stake", url: "https://tradezero.com/blog/trump-administration-doubles-its-equity-stake-in-globalfoundries" }
      ]
    },
    {
      id: "openai", date: "2025-09-22", status: "Agreed in stages (2025)",
      title: "The AI money circle around OpenAI",
      center: { name: "OpenAI", sub: "ChatGPT maker · private" },
      summary: "Money goes round in a circle: Nvidia invests in OpenAI, which buys Nvidia chips; AMD gives OpenAI the right to buy up to about 10% of AMD as OpenAI buys AMD chips; Oracle and CoreWeave rent OpenAI computing power that runs on Nvidia chips, and Nvidia owns part of CoreWeave. Critics compare it to the vendor financing before the dot-com crash.",
      inflows: [
        { name: "Nvidia", amount: "up to $100B", note: "Invested as OpenAI builds 10 GW of data centres", kind: "company" },
        { name: "Microsoft", amount: "~27% owner", note: "After OpenAI's 2025 restructuring", kind: "company" },
        { name: "SoftBank", amount: "$40B+", note: "Led OpenAI's 2025 funding round; Stargate partner", kind: "company" }
      ],
      links: [
        { tk: "NVDA", role: "Sells chips", note: "OpenAI's data centres are built on Nvidia chips" },
        { tk: "AMD", role: "6 GW of chips", note: "OpenAI can earn warrants for up to 160M AMD shares" },
        { tk: "ORCL", role: "Rents computing", note: "Reported ~$300B, 5-year contract (Stargate)" },
        { tk: "CRWV", role: "Rents computing", note: "Contracts worth over $22B; Nvidia owns part of CoreWeave" },
        { tk: "MSFT", role: "Owner + cloud", note: "Biggest outside owner and cloud partner" }
      ],
      trump: ["NVDA", "AMD", "ORCL", "CRWV", "MSFT"],
      sources: [
        { name: "The Register: AI's trillion-dollar deal wheel", url: "https://www.theregister.com/2025/11/04/the_circular_economy_of_ai/" },
        { name: "Morningstar: what are circular AI chip deals?", url: "https://global.morningstar.com/en-gb/stocks/what-are-circular-ai-chip-deals-should-investors-be-worried" },
        { name: "BNN Bloomberg: CoreWeave expands OpenAI pact", url: "https://www.bnnbloomberg.ca/business/2025/09/25/coreweave-expands-openai-pact-with-new-us65-billion-contract-sees-the-quarter-of-diversification/" }
      ]
    },
    {
      id: "intel", date: "2025-08-22", status: "Done (August–September 2025)",
      title: "The government buys 10% of Intel",
      center: { name: "Intel", sub: "US chipmaker · INTC", tk: "INTC" },
      summary: "The US government turned $8.9B of CHIPS Act grants into about 433M Intel shares at $20.47, a 9.9% stake. SoftBank bought $2B of shares days earlier, and Nvidia bought $5B of shares in September and agreed to design chips with Intel.",
      inflows: [
        { name: "US government", amount: "$8.9B for 9.9%", note: "433M shares at $20.47 (22 Aug 2025)", kind: "gov", stake: { tk: "INTC", shares: 433300000, price: 20.47, date: "2025-08-22" } },
        { name: "Nvidia", amount: "$5B", note: "Shares at $23.28; joint chip design (Sep 2025)", kind: "company", stake: { tk: "INTC", shares: 214776632, price: 23.28, date: "2025-09-18" } },
        { name: "SoftBank", amount: "$2B", note: "Shares at $23 (Aug 2025)", kind: "company", stake: { tk: "INTC", shares: 86956521, price: 23.0, date: "2025-08-18" } }
      ],
      links: [
        { tk: "INTC", role: "The company", note: "Uses the money for US chip factories" },
        { tk: "NVDA", role: "Partner", note: "Nvidia chips paired with Intel processors" }
      ],
      trump: ["INTC", "NVDA"],
      sources: [
        { name: "Quartz: the companies the government owns stakes in", url: "https://qz.com/trump-government-stake-intel-us-steel-investment-companies" },
        { name: "XTB: the government takes stakes in Intel, MP Materials and more", url: "https://www.xtb.com/sca-en/market-analysis/news-and-research/is-the-united-states-copying-china-the-government-takes-stakes-in-intel-mp-materials-and-more" }
      ]
    },
    {
      id: "mp", date: "2025-07-10", status: "Done (July 2025)",
      title: "The Pentagon becomes the biggest owner of America's rare-earth miner",
      center: { name: "MP Materials", sub: "Rare-earth magnets · MP", tk: "MP" },
      summary: "The Defense Department bought $400M of MP Materials stock (about 15%, the largest stake), guaranteed a minimum price for its rare earths for 10 years and agreed to buy all the magnets from a new factory, to cut reliance on China. Apple then signed a $500M deal for US-made magnets.",
      inflows: [
        { name: "Dept. of Defense", amount: "$400M ≈15%", note: "Preferred stock convertible at $30.03; 10-year price floor", kind: "gov", stake: { tk: "MP", shares: 13320013, price: 30.03, date: "2025-07-10" } },
        { name: "JPMorgan + Goldman", amount: "$1B", note: "Loans for the new magnet factory", kind: "company" },
        { name: "Apple", amount: "$500M", note: "Long-term order for US-made magnets (Jul 2025)", kind: "company" }
      ],
      links: [
        { tk: "MP", role: "The company", note: "Only US rare-earth mine (Mountain Pass, California)" },
        { tk: "AAPL", role: "Customer", note: "Buys magnets for its devices" }
      ],
      trump: ["MP", "AAPL"],
      sources: [
        { name: "Quartz: the companies the government owns stakes in", url: "https://qz.com/trump-government-stake-intel-us-steel-investment-companies" },
        { name: "CNN (via WRAL): Uncle Sam is outperforming the S&P 500", url: "https://www.wral.com/uncle-sam-is-outperforming-the-s-p-500/22250231/" }
      ]
    },
    {
      id: "lac", date: "2025-10-01", status: "Done (October 2025)",
      title: "A stake in America's biggest lithium mine",
      center: { name: "Lithium Americas", sub: "Thacker Pass lithium · LAC", tk: "LAC" },
      summary: "In return for reworking a $2.26B Energy Department loan, the government took warrants for 5% of Lithium Americas and 5% of its Thacker Pass mine venture in Nevada, where General Motors is a partner.",
      inflows: [
        { name: "Dept. of Energy", amount: "5% + 5%", note: "Of the company and of the Thacker Pass venture", kind: "gov" },
        { name: "General Motors", amount: "partner", note: "Owns part of Thacker Pass; buys the lithium", kind: "company" }
      ],
      links: [
        { tk: "LAC", role: "The company", note: "Building the Thacker Pass mine" },
        { tk: "GM", role: "Customer + partner", note: "Lithium for its electric-car batteries" }
      ],
      trump: ["GM"],
      sources: [
        { name: "Quartz: the companies the government owns stakes in", url: "https://qz.com/trump-government-stake-intel-us-steel-investment-companies" }
      ]
    },
    {
      id: "tmq", date: "2025-10-06", status: "Done (October 2025)",
      title: "10% of a copper miner, and a road to reach it",
      center: { name: "Trilogy Metals", sub: "Alaska copper · TMQ", tk: "TMQ" },
      summary: "The government took about 10% of Trilogy Metals (plus warrants) for about $35.6M, alongside approving the Ambler Road that opens Alaska's copper and cobalt district.",
      inflows: [
        { name: "US government", amount: "$35.6M ≈10%", note: "Plus warrants for 7.5% more", kind: "gov" }
      ],
      links: [
        { tk: "TMQ", role: "The company", note: "Copper and zinc projects in Alaska's Ambler district" }
      ],
      trump: [],
      sources: [
        { name: "Quartz: the companies the government owns stakes in", url: "https://qz.com/trump-government-stake-intel-us-steel-investment-companies" },
        { name: "CNN (via WRAL): Uncle Sam is outperforming the S&P 500", url: "https://www.wral.com/uncle-sam-is-outperforming-the-s-p-500/22250231/" }
      ]
    }
  ]
};
