/* Where the world's key goods are produced: the biggest producing countries and their share of world output.
   Figures are rounded, from the latest full year each source publishes (named on each item). "n" is the
   country's ISO number, used to colour the world map. Last updated 24 Oct 2026 (see UPDATING.md). */
window.CTC_PROD = {
  groups: [
    { name: "AI and chips", items: ["chips", "hbm", "euv", "gallium", "dc_power"] },
    { name: "Energy", items: ["oil", "refining", "gas", "lng", "uranium"] },
    { name: "Metals and minerals", items: ["rare_earths", "lithium", "cobalt", "nickel", "copper", "steel", "gold"] }
  ],
  items: {
    chips: { name: "Leading-edge chips", unit: "% of world capacity below 10nm", year: "2019 (latest published split)", source: "SIA / BCG, Strengthening the Global Semiconductor Supply Chain (2021)",
      why: "The most advanced chips (Nvidia's AI chips, iPhone chips) are almost all made in Taiwan, mostly by TSMC.",
      chain: [
        { step: "Design", where: "United States", who: "Nvidia, AMD, Broadcom, Apple, Google", share: "Most AI chip designs" },
        { step: "Chipmaking machines", where: "Netherlands", who: "ASML", share: "100% of EUV machines" },
        { step: "Chip factories", where: "Taiwan", who: "TSMC", share: "~92% of leading-edge capacity (2019)" },
        { step: "AI memory", where: "South Korea", who: "SK Hynix, Samsung", share: "~80% of HBM (2025 est.)" },
        { step: "Raw materials", where: "China", who: "Gallium, rare earths", share: "~99% of gallium, ~90% of rare-earth processing" },
        { step: "Power", where: "United States", who: "Data centres", share: "~45% of data-centre electricity (2024)" }
      ],
      rows: [["Taiwan", 158, 92], ["South Korea", 410, 8]], world: "100%" },
    hbm: { name: "AI memory (HBM)", unit: "% of world supply", year: "2025 (TrendForce estimate)", source: "TrendForce",
      why: "High-bandwidth memory sits next to every AI chip. SK Hynix makes about half of it; Micron has been catching up with Samsung.",
      chain: [
        { step: "Specified by", where: "United States", who: "Nvidia, AMD, Google", share: "AI chips need several HBM stacks each" },
        { step: "Memory chips", where: "South Korea", who: "SK Hynix, Samsung", share: "~81% of HBM (2025 est.)" },
        { step: "Memory chips", where: "United States", who: "Micron", share: "~19% (2025 est.)" },
        { step: "Packaged with the AI chip", where: "Taiwan", who: "TSMC (CoWoS)", share: "Most advanced AI chip packaging" },
        { step: "AI servers", where: "Taiwan", who: "Foxconn, Quanta, Wistron", share: "Build most AI servers" }
      ],
      rows: [["South Korea (SK Hynix)", 410, 52], ["South Korea (Samsung)", 410, 29], ["United States (Micron)", 840, 19]], world: "100%", byCompany: true },
    euv: { name: "Chipmaking machines (EUV)", unit: "% of world supply", year: "2025", source: "ASML 2025 annual report",
      why: "Every leading-edge chip needs extreme-ultraviolet machines. Only one company in the world makes them: ASML in the Netherlands.",
      chain: [
        { step: "Light source", where: "United States", who: "Cymer (San Diego, owned by ASML)", share: "The laser-driven light source" },
        { step: "Mirrors and optics", where: "Germany", who: "Carl Zeiss", share: "Sole supplier of EUV optics" },
        { step: "Machine assembly", where: "Netherlands", who: "ASML", share: "100% of EUV machines" },
        { step: "Buyers", where: "Taiwan, South Korea, US", who: "TSMC, Samsung, SK Hynix, Intel", share: "48 machines sold in 2025" },
        { step: "Export rules", where: "China", who: "No EUV sales allowed", share: "Blocked by Dutch and US controls" }
      ],
      rows: [["Netherlands (ASML)", 528, 100]], world: "48 machines sold in 2025 (44 in 2024)" },
    gallium: { name: "Gallium", unit: "% of world output", year: "2025", source: "USGS Mineral Commodity Summaries 2026",
      why: "Used in power chips, radar and LEDs. China makes nearly all of it and has restricted exports.",
      chain: [
        { step: "Bauxite mined", where: "Australia, Guinea, China", who: "Aluminium ore", share: "Gallium is a by-product of it" },
        { step: "Alumina refining", where: "China", who: "Aluminium refiners", share: "Over half of world alumina" },
        { step: "Gallium recovered", where: "China", who: "Refinery by-product plants", share: "~99% of world gallium (2025)" },
        { step: "Wafers and chips", where: "Japan, US, Europe", who: "GaN and GaAs chipmakers", share: "Power chips, radio chips, LEDs" },
        { step: "Export rules", where: "China", who: "Licences since 2023", share: "Controls on exports, tightened since" }
      ],
      rows: [["China", 156, 99], ["Russia", 643, 0.7], ["Japan", 392, 0.3]], world: "about 900 tonnes" },
    dc_power: { name: "Data-centre electricity", unit: "% of world use", year: "2024 (latest country split)", source: "IEA, Energy and AI; Key Questions on Energy and AI (2025 total)",
      why: "AI runs in data centres; the US uses the most power for them, then China. World use grew about 17% in 2025.",
      chain: [
        { step: "Power generation", where: "United States", who: "Gas, nuclear, renewables", share: "Gas supplies the biggest share" },
        { step: "Grid and transformers", where: "United States", who: "Utilities", share: "Long waits to connect new sites" },
        { step: "Data centres", where: "United States", who: "Microsoft, Amazon, Google, Meta", share: "~45% of world data-centre power (2024)" },
        { step: "Data centres", where: "China", who: "Alibaba, Tencent, ByteDance", share: "~25% (2024)" },
        { step: "Nuclear deals", where: "United States", who: "Constellation, Talen, Kairos", share: "Tech firms buying nuclear power" }
      ],
      rows: [["United States", 840, 45], ["China", 156, 25], ["Germany (Europe)", 276, 15]], world: "about 415 TWh in 2024, about 485 TWh in 2025" },
    oil: { name: "Oil", unit: "million barrels a day (crude, shale, oil sands and NGLs)", year: "2025", source: "Energy Institute, Statistical Review of World Energy 2026",
      why: "The US is the biggest oil producer, with a fifth of world output; Saudi Arabia and Russia lead OPEC+.",
      chain: [
        { step: "Wells", where: "United States", who: "Exxon, Chevron, shale drillers", share: "~21% of world oil (2025)" },
        { step: "OPEC+ output", where: "Saudi Arabia, Russia", who: "Saudi Aramco, Rosneft", share: "Set much of the world's spare supply" },
        { step: "Shipping chokepoint", where: "Strait of Hormuz", who: "Gulf tankers", share: "About a fifth of world oil passes through" },
        { step: "Refining", where: "China, United States", who: "Sinopec, Marathon, Valero", share: "~36% of world refining (2025)" },
        { step: "Biggest buyer", where: "China", who: "Imports more crude than anyone", share: "Its demand moves prices" }
      ],
      rows: [["United States", 840, 21.1], ["Saudi Arabia", 682, 11.4], ["Russia", 643, 10.7], ["Canada", 124, 6.2], ["Iran", 364, 5.2], ["Iraq", 368, 4.4], ["China", 156, 4.3], ["UAE", 784, 4.2], ["Brazil", 76, 3.9], ["Kuwait", 414, 2.8]], world: "about 100.6 million barrels a day" },
    refining: { name: "Diesel and petrol (refining)", unit: "million barrels a day of refinery capacity", year: "2025", source: "Energy Institute, Statistical Review of World Energy 2026",
      why: "Diesel and petrol are made in refineries. China overtook the US as the biggest refiner in 2023; together they have over a third of world capacity.",
      chain: [
        { step: "Crude oil in", where: "United States, Saudi Arabia, Russia", who: "Oil producers", share: "~43% of world crude (2025)" },
        { step: "Refineries", where: "China", who: "Sinopec, PetroChina", share: "~18% of world capacity (2025)" },
        { step: "Refineries", where: "United States", who: "Marathon, Valero, Exxon", share: "~18% (2025)" },
        { step: "Biggest single refinery", where: "India", who: "Reliance, Jamnagar", share: "A major diesel exporter" },
        { step: "Diesel, petrol, jet fuel", where: "Worldwide", who: "Trucks, ships, planes", share: "Diesel prices feed into shipping costs" }
      ],
      rows: [["China", 156, 18.8], ["United States", 840, 18.2], ["Russia", 643, 6.7], ["India", 356, 4.9], ["South Korea", 410, 3.6], ["Saudi Arabia", 682, 3.3], ["Japan", 392, 3.1], ["Brazil", 76, 2.3]], world: "about 103.8 million barrels a day" },
    gas: { name: "Natural gas", unit: "billion cubic metres a year", year: "2025", source: "Energy Institute, Statistical Review of World Energy 2026",
      why: "Gas makes much of the world's electricity, including for data centres. The US produces a quarter of it.",
      chain: [
        { step: "Wells", where: "United States", who: "Shale gas producers", share: "~26% of world gas (2025)" },
        { step: "Pipelines", where: "Russia, Norway", who: "Gazprom, Equinor", share: "Russia now pipes more to China, less to Europe" },
        { step: "Liquefied for export", where: "United States, Qatar, Australia", who: "Cheniere, QatarEnergy", share: "~63% of LNG exports (2025)" },
        { step: "Power stations", where: "Worldwide", who: "Utilities", share: "Gas makes about a fifth of world electricity" },
        { step: "Data centres", where: "United States", who: "AI data centres", share: "New gas plants being built for them" }
      ],
      rows: [["United States", 840, 1074], ["Russia", 643, 609], ["Iran", 364, 265], ["China", 156, 264], ["Canada", 124, 206], ["Qatar", 634, 184], ["Australia", 36, 149], ["Saudi Arabia", 682, 134], ["Norway", 578, 121]], world: "about 4,200 bcm" },
    lng: { name: "LNG exports", unit: "billion cubic metres a year", year: "2025", source: "Energy Institute, Statistical Review of World Energy 2026",
      why: "Liquefied gas shipped by sea. The US became the biggest exporter in 2023; its exports rose 27% in 2025, to a quarter of world trade.",
      chain: [
        { step: "Gas fields", where: "United States, Qatar", who: "Shale basins, North Field", share: "Cheap gas to liquefy" },
        { step: "Liquefaction", where: "United States", who: "Cheniere, Venture Global", share: "~25% of world LNG exports (2025)" },
        { step: "Liquefaction", where: "Qatar", who: "QatarEnergy", share: "~19% (2025)" },
        { step: "Tankers", where: "Worldwide", who: "LNG carriers, mostly Korean-built", share: "Shipped at \u2212162\u00b0C" },
        { step: "Buyers", where: "China, Japan, Europe", who: "Utilities", share: "Europe took ~30% of LNG imports in 2025" }
      ],
      rows: [["United States", 840, 147], ["Qatar", 634, 111], ["Australia", 36, 105], ["Russia", 643, 43], ["Malaysia", 458, 37], ["Nigeria", 566, 20]], world: "about 579 bcm" },
    uranium: { name: "Uranium", unit: "tonnes a year", year: "2024 (latest published)", source: "World Nuclear Association",
      why: "Fuel for nuclear power, which tech companies are buying to run AI data centres. Kazakhstan mines almost 40% of it.",
      chain: [
        { step: "Mining", where: "Kazakhstan", who: "Kazatomprom", share: "~39% of world uranium (2024)" },
        { step: "Mining", where: "Canada", who: "Cameco", share: "~24% (2024)" },
        { step: "Enrichment", where: "Russia", who: "Rosatom", share: "About 40% of world enrichment capacity" },
        { step: "Enrichment", where: "Europe, US", who: "Urenco, Orano", share: "The main non-Russian suppliers" },
        { step: "Reactors", where: "United States", who: "Constellation, Vistra", share: "The world's biggest nuclear fleet" }
      ],
      rows: [["Kazakhstan", 398, 23270], ["Canada", 124, 14309], ["Namibia", 516, 7333], ["Australia", 36, 4598], ["Uzbekistan", 860, 4000], ["Russia", 643, 2738], ["China", 156, 1600], ["Niger", 562, 962]], world: "about 60,200 tonnes" },
    rare_earths: { name: "Rare earths", unit: "tonnes a year (mined)", year: "2025", source: "USGS Mineral Commodity Summaries 2026",
      why: "Needed for magnets in motors, drones and missiles. China mines about 70% and processes about 90%.",
      chain: [
        { step: "Mining", where: "China", who: "Northern Rare Earth, others", share: "~69% of mined rare earths (2025)" },
        { step: "Mining", where: "United States", who: "MP Materials (Mountain Pass)", share: "~13% (2025)" },
        { step: "Separation and processing", where: "China", who: "State-owned refiners", share: "~90% of processing" },
        { step: "Magnets", where: "China", who: "Magnet makers", share: "The large majority of world magnets" },
        { step: "Uses", where: "Worldwide", who: "EV motors, wind turbines, missiles, drones", share: "China has put export licences on key ones" }
      ],
      rows: [["China", 156, 270000], ["United States", 840, 51000], ["Australia", 36, 29000], ["Myanmar", 104, 22000], ["Thailand", 764, 4800], ["India", 356, 2900], ["Madagascar", 450, 2700], ["Russia", 643, 2600]], world: "about 390,000 tonnes" },
    lithium: { name: "Lithium", unit: "tonnes a year", year: "2025", source: "USGS Mineral Commodity Summaries 2026 (US output withheld)",
      why: "For batteries in electric cars and grid storage. World output rose about 30% in 2025.",
      chain: [
        { step: "Mining (rock)", where: "Australia", who: "Pilbara, Mineral Resources", share: "~32% of world lithium (2025)" },
        { step: "Brine", where: "Chile, Argentina", who: "SQM, Albemarle, Arcadium", share: "~27% (2025)" },
        { step: "Refining to chemicals", where: "China", who: "Ganfeng, Tianqi", share: "About two-thirds of refining" },
        { step: "Battery cells", where: "China", who: "CATL, BYD", share: "Most of the world's battery cells" },
        { step: "Uses", where: "Worldwide", who: "Electric cars, grid storage", share: "Prices swing with EV demand" }
      ],
      rows: [["Australia", 36, 92000], ["China", 156, 62000], ["Chile", 152, 56000], ["Zimbabwe", 716, 28000], ["Argentina", 32, 23000], ["Brazil", 76, 12000], ["Mali", 466, 9400], ["Canada", 124, 5600]], world: "about 290,000 tonnes" },
    cobalt: { name: "Cobalt", unit: "tonnes a year", year: "2025", source: "USGS Mineral Commodity Summaries 2026",
      why: "For batteries; three-quarters comes from the Democratic Republic of the Congo.",
      chain: [
        { step: "Mining", where: "DR Congo", who: "CMOC, Glencore", share: "~74% of world cobalt (2025)" },
        { step: "Export curbs", where: "DR Congo", who: "Government", share: "Export ban in 2025, then quotas" },
        { step: "Refining", where: "China", who: "Huayou, GEM", share: "About three-quarters of refining" },
        { step: "Battery materials", where: "China, South Korea", who: "Cathode makers", share: "Most battery cathodes" },
        { step: "Uses", where: "Worldwide", who: "Batteries, jet-engine alloys", share: "Phones, laptops, EVs" }
      ],
      rows: [["DR Congo", 180, 230000], ["Indonesia", 360, 44000], ["Russia", 643, 7700], ["Madagascar", 450, 3900], ["Australia", 36, 3700], ["Philippines", 608, 3700], ["Canada", 124, 3500]], world: "about 310,000 tonnes" },
    nickel: { name: "Nickel", unit: "tonnes a year", year: "2025", source: "USGS Mineral Commodity Summaries 2026",
      why: "For stainless steel and batteries; Indonesia now makes about two-thirds.",
      chain: [
        { step: "Mining", where: "Indonesia", who: "Mostly Chinese-owned smelters", share: "~67% of world nickel (2025)" },
        { step: "Processed at home", where: "Indonesia", who: "Raw ore exports banned since 2020", share: "Smelted before export" },
        { step: "Mining", where: "Philippines, Russia", who: "Nornickel", share: "~12% (2025)" },
        { step: "Stainless steel", where: "China, Indonesia", who: "Tsingshan", share: "Most nickel ends up here" },
        { step: "Battery chemicals", where: "China, Indonesia", who: "Cathode makers", share: "For long-range EV batteries" }
      ],
      rows: [["Indonesia", 360, 2600000], ["Philippines", 608, 270000], ["Russia", 643, 200000], ["Canada", 124, 140000], ["New Caledonia", 540, 140000], ["China", 156, 120000], ["Brazil", 76, 70000], ["Australia", 36, 45000]], world: "about 3.9 million tonnes" },
    copper: { name: "Copper", unit: "thousand tonnes a year (mined)", year: "2025", source: "USGS Mineral Commodity Summaries 2026",
      why: "For power grids, data centres and electric cars.",
      chain: [
        { step: "Mining", where: "Chile", who: "Codelco, BHP (Escondida)", share: "~23% of mined copper (2025)" },
        { step: "Mining", where: "DR Congo, Peru", who: "CMOC, Southern Copper", share: "~26% (2025)" },
        { step: "Smelting and refining", where: "China", who: "Jiangxi Copper, Tongling", share: "~48% of refined copper (2025)" },
        { step: "Wire and cable", where: "Worldwide", who: "Cable makers", share: "Grids, buildings, data centres" },
        { step: "Uses", where: "Worldwide", who: "Grids, EVs, data centres", share: "Demand rising with AI and electrification" }
      ],
      rows: [["Chile", 152, 5300], ["DR Congo", 180, 3200], ["Peru", 604, 2700], ["China", 156, 1800], ["Russia", 643, 1300], ["United States", 840, 1000], ["Zambia", 894, 940], ["Australia", 36, 730]], world: "about 23 million tonnes" },
    steel: { name: "Steel", unit: "million tonnes a year", year: "2025", source: "worldsteel (Russia an estimate)",
      why: "China makes more steel than the rest of the world combined, though its output fell in 2025.",
      chain: [
        { step: "Iron ore", where: "Australia, Brazil", who: "BHP, Rio Tinto, Vale", share: "Most seaborne iron ore" },
        { step: "Coking coal", where: "Australia", who: "Coal miners", share: "Fuel for blast furnaces" },
        { step: "Steel mills", where: "China", who: "Baowu, Ansteel", share: "~52% of world steel (2025)" },
        { step: "Steel mills", where: "India", who: "JSW, Tata, SAIL", share: "~9% and growing (2025)" },
        { step: "Trade", where: "United States", who: "Nucor, Cleveland-Cliffs", share: "Protected by 50% tariffs" }
      ],
      rows: [["China", 156, 961], ["India", 356, 165], ["United States", 840, 82], ["Japan", 392, 81], ["Russia", 643, 68], ["South Korea", 410, 62], ["Turkey", 792, 38], ["Germany", 276, 34], ["Brazil", 76, 33]], world: "about 1,849 million tonnes" },
    gold: { name: "Gold", unit: "tonnes a year (mined)", year: "2025", source: "USGS Mineral Commodity Summaries 2026",
      why: "A safe haven investors buy when markets are nervous.",
      chain: [
        { step: "Mines", where: "China, Russia, Australia", who: "Zijin, Polyus, Newmont", share: "~29% of mined gold (2025)" },
        { step: "Refiners", where: "Switzerland", who: "Valcambi, PAMP, Argor-Heraeus", share: "Refines much of the world's gold" },
        { step: "Trading and vaults", where: "UK, United States", who: "London and New York markets", share: "Where gold is priced" },
        { step: "Buyers", where: "Central banks", who: "China, Poland, Turkey, India", share: "Bought over 1,000 t a year in 2022\u201324" },
        { step: "Buyers", where: "China, India", who: "Jewellery, bars, coins", share: "The biggest consumer markets" }
      ],
      rows: [["China", 156, 380], ["Russia", 643, 310], ["Australia", 36, 280], ["Canada", 124, 200], ["United States", 840, 160], ["Ghana", 288, 150], ["Mexico", 484, 140], ["Kazakhstan", 398, 130], ["Uzbekistan", 860, 130]], world: "about 3,300 tonnes" }
  },
};
