// =============================================================
// 2,317 Donors & The Long Arc of Alumni Giving: scrollytelling
//
// Chapter 1 (data-mode="swarm")    212 bubbles settle into a beeswarm by year.
// Chapter 2 (data-mode="bars")     ~990 particles ($25K each) stack into
//                                  bars by year, then become solid bars.
// Chapter 3 (data-mode="ring")     2,317 donor dots form a ring; a blue arc
//                                  sweeps to 80%.
// Chapter 4 (data-mode="colleges") 3,128 particles (one per donor per
//                                  allocation) fill horizontal bars by college.
// Chapter 5 (data-mode="subcats")  ~985 particles ($25K each) pack into 25
//                                  circles (one per fund or program), grouped
//                                  by allocation, then become solid circles.
// Credits   (data-mode="credits")  particles form the dashboard title, which
//                                  becomes a real link; credit lines follow.
//
// Whatever is on screen flies off when the next chapter arrives,
// and every transition plays in reverse when you scroll back up.
//
// Sections:
//   1. CONFIG        numbers you may want to tweak
//   2. SETUP         page elements and SVG layers
//   3. DATA          load the CSVs and build every mark
//   4. SIZING        measure the screen, build scales, compute targets
//   5. DRAWING       axes, bars, labels, ring decorations, dots
//   6. PHYSICS       the d3-force simulations and helpers
//   7. CHARTS        what each chart does when it arrives or leaves
//   8. MODES         which chart is on screen for each step
//   9. INTERACTION   tooltips and legend highlight
//  10. SCROLL        Scrollama triggers
//  11. START
// =============================================================


// ---------- 1. CONFIG ----------
const CONFIG = {
  files: {
    bubbles:  "data/bubbles.csv",
    donors:   "data/donors.csv",
    colleges: "data/colleges.csv",
    subcats:  "data/subcategories.csv",
  },

  // Allocation colors (keep in sync with the CSS variables in css/style.css)
  colors: {
    "Scholarship":     "#F4E23A",
    "Endowment":       "#2CD9EC",
    "Campus Resource": "#F2913D",
  },
  highlight: "#4C8DFF",   // the blue used for the 80% arc (same as --highlight)
  stackOrder: ["Scholarship", "Endowment", "Campus Resource"], // bottom-to-top / left-to-right

  // Space around the plot area, in pixels
  margin:       { top: 16, right: 16, bottom: 56, left: 64 },
  marginMobile: { top: 12, right: 8,  bottom: 52, left: 44 },

  // Where on the screen a step "arrives": 0.6 = 60% of the way down
  triggerAt: 0.6,

  // --- Chart 1: beeswarm ---
  maxRadiusShare: 0.19, // biggest bubble radius as a share of one year column's width
  minRadius: 2,
  gap: 1,               // pixels between touching bubbles
  pullX: 0.10,
  pullY: 0.35,
  scatterOpacity: 0.35,
  swarmOpacity: 0.95,

  // --- Chart 2: stacked bars by year ---
  particleValue: 25000, // dollars per particle
  particleCols: 8,      // particles across each bar
  barWidthShare: 0.62,  // bar width as a share of one year column

  // --- Chart 3: donor ring ---
  ringRadiusShare: 0.38,
  donorMaxR: 0.018,
  donorMinR: 0.0045,
  donorPull: 0.2,
  donorOpacity: 0.9,
  paretoShare: 0.8,
  ringRevealDelay: 1100,
  arcSweepMs: 1600,
  tailOpacity: 0.3,

  // --- Chart 4: donors by college ---
  collegeDotRows: 4,        // rows of particles inside each horizontal bar
  collegeBarPadding: 0.3,   // gap between bars (share of each row)
  collegeStagger: 90,       // ms between each college's particles taking off

  // --- Chart 5: allocation subcategories ---
  subcatValue: 25000,       // dollars per particle
  subcatStagger: 280,       // ms between each allocation's particles taking off
  subcatLabelMinR: 26,      // circles smaller than this (px radius) get no label

  // --- Credits ---
  creditParticles: 2400,    // how many dots build the title
  creditStagger: 260,       // ms between each title line taking off

  // --- Particles that become solid shapes (charts 2, 4 and 5) ---
  particlePull: 0.14,
  particleOpacity: 0.9,
  barRevealDelay: 1300,     // ms after the last group lands before the solid bars appear

  // --- Motion shared by all charts ---
  velocityDecay: 0.30,  // lower = more overshoot and wobble, higher = calmer
  alphaDecay: 0.014,    // lower = the motion runs longer before settling
  yearStagger: 160,     // ms between each group taking off (charts 1-3)
  flyAway: 1.9,         // how far leaving dots fly (1 = to their scatter spot)
  fadeOutMs: 900,
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ms = t => (reduceMotion ? 0 : t);   // every animation duration goes through this
const TAU = Math.PI * 2;


// ---------- 2. SETUP ----------
const figureEl  = document.getElementById("chart");
const svgEl     = document.getElementById("chart-svg");
const tooltipEl = document.getElementById("tooltip");

const svg  = d3.select(svgEl);
const plot = svg.append("g");   // everything inside the margins

// Layers, drawn bottom to top
const layer = {
  swarmGrid:     plot.append("g").attr("class", "grid").attr("opacity", 0),
  barGrid:       plot.append("g").attr("class", "grid").attr("opacity", 0),
  swarmYAxis:    plot.append("g").attr("class", "axis").attr("opacity", 0),
  swarmXAxis:    plot.append("g").attr("class", "axis").attr("opacity", 0),
  barYAxis:      plot.append("g").attr("class", "axis").attr("opacity", 0),
  barXAxis:      plot.append("g").attr("class", "axis").attr("opacity", 0),
  bars:          plot.append("g"),
  barLabels:     plot.append("g").attr("text-anchor", "middle"),
  collegeBars:   plot.append("g"),
  collegeCounts: plot.append("g").attr("text-anchor", "middle"),
  collegeTotals: plot.append("g"),
  collegeNames:  plot.append("g").attr("text-anchor", "end"),
  subcatGroups:  plot.append("g"),                 // allocation outlines and labels
  subcatCircles: plot.append("g"),
  subcatLabels:  plot.append("g").attr("text-anchor", "middle"),
  ringBack:      plot.append("g"),
  bubbles:       plot.append("g"),
  particles:     plot.append("g"),
  donors:        plot.append("g"),
  collegeDots:   plot.append("g"),
  subcatDots:    plot.append("g"),
  creditTitle:   plot.append("g"),
  creditDots:    plot.append("g"),
  ringFront:     plot.append("g"),
};
const swarmAxes = [layer.swarmGrid, layer.swarmYAxis, layer.swarmXAxis];
const barAxes   = [layer.barGrid, layer.barYAxis, layer.barXAxis];

// Everything that changes while the page runs lives in this one object
const state = {
  mode: null,              // "scatter", "swarm", "bars", "ring", "colleges", "subcats" or "credits"
  bubbles: [],             // chart 1
  segments: [],            // chart 2: one per year x allocation
  particles: [],           // chart 2: one per $25K
  donors: [],              // chart 3: one per donor, largest first
  colleges: [],            // chart 4: one per college, most donors first
  collegeSegs: [],         // chart 4: one per college x allocation
  collegeDots: [],         // chart 4: one per donor per allocation
  subcats: [],             // chart 5: one per fund or program
  subcatGroups: [],        // chart 5: one per allocation
  subcatDots: [],          // chart 5: one per $25K
  creditDots: [],          // credits: the dots that spell the title
  credit: {},              // credits: title lines, font size, position
  bubblesOut: false,
  donorsOut: false,
  donorsPlaced: false,
  arcEnd: 0,
  cutoffRank: 0,
  totalRaised: 0,
  years: [],
  yearTotals: null,
  maxAmount: 0,
  timers: [],
  W: 0, H: 0, PW: 0, PH: 0, margin: CONFIG.margin,
  x: null, y: null, r: null, yBar: null,
  ring: {},
  small: false,            // phone-sized chart?
};

// D3 selections, simulations and chart controllers, filled in later
let bubbleSel, particleSel, barSel, barLabelSel, donorSel, ringEls;
let collegeDotSel, collegeBarSel, collegeCountSel, collegeTotalSel, collegeNameSel;
let subcatDotSel, subcatCircleSel, subcatLabelSel, subcatGroupSel;
let creditDotSel, creditTitleSel;
let bubbleSim, particleSim, donorSim, collegeSim, subcatSim, creditSim;
let yearBars, collegeBars, subcatPack, credits;   // the "particles become solid shapes" charts
const creditsEl = document.getElementById("credits");        // the HTML credit lines


// ---------- 3. DATA ----------
// Reads the CSVs made by data/prep_data.py.
// d3.autoType turns "2010" and "72583.0" into real numbers.
async function loadData() {
  if (window.INLINE_DATA) return window.INLINE_DATA; // used only by the single-file preview
  const names = Object.keys(CONFIG.files);
  const tables = await Promise.all(names.map(n => d3.csv(CONFIG.files[n], d3.autoType)));
  return Object.fromEntries(names.map((n, i) => [n, tables[i]]));
}

const random = () => ({ hx: Math.random(), hy: Math.random() }); // a random scatter spot

function prepare({ bubbles, donors, colleges, subcats }) {
  state.years      = [...new Set(bubbles.map(d => d.Year))].sort();
  state.maxAmount  = d3.max(bubbles, d => d.Amount);
  state.yearTotals = d3.rollup(bubbles, v => d3.sum(v, d => d.Amount), d => d.Year);

  // Chart 1: one bubble per row
  state.bubbles = bubbles.map(d => ({ ...d, ...random() }));

  // Chart 2: one segment per year x allocation, stacked in CONFIG.stackOrder
  const byYearAlloc = d3.rollup(bubbles, v => d3.sum(v, d => d.Amount), d => d.Year, d => d.Allocation);
  state.segments = [];
  for (const year of state.years) {
    let below = 0;
    const total = state.yearTotals.get(year);
    for (const alloc of CONFIG.stackOrder) {
      const amount = byYearAlloc.get(year)?.get(alloc) ?? 0;
      state.segments.push({
        Year: year, Allocation: alloc, Amount: amount, share: amount / total,
        y0: below, y1: below + amount,
        n: Math.max(1, Math.round(amount / CONFIG.particleValue)),
      });
      below += amount;
    }
  }
  state.particles = state.segments.flatMap(seg =>
    d3.range(seg.n).map(i => ({ seg, i, Year: seg.Year, Allocation: seg.Allocation, ...random() })));

  // Chart 3: donors are sorted largest first. Each donor's slice of the
  // circle equals their share of all dollars.
  state.totalRaised = d3.sum(donors, d => d.Amount);
  let before = 0;
  state.donors = donors.map(d => {
    const node = {
      ...d, ...random(),
      angle: TAU * (before + d.Amount / 2) / state.totalRaised,
      group: Math.min(5, Math.floor((d.Rank - 1) / donors.length * 6)),
    };
    before += d.Amount;
    return node;
  });
  state.cutoffRank = state.donors.find(d => d.CumShare >= CONFIG.paretoShare).Rank;

  // Chart 4: colleges sorted by distinct donors (most first)
  const byCollege = d3.group(colleges, d => d.College);
  state.colleges = [...byCollege.keys()]
    .map(name => {
      const rows = byCollege.get(name);
      return {
        name,
        short: name.replace(/^College of /, ""),
        donors: rows[0].CollegeDonors,             // each person counted once
        pairs: d3.sum(rows, d => d.Donors),        // each person counted once per allocation
      };
    }).sort((a, b) => b.pairs - a.pairs);
  state.collegeSegs = [];
  for (const c of state.colleges) {
    let before = 0;
    for (const alloc of CONFIG.stackOrder) {
      const n = byCollege.get(c.name).find(d => d.Allocation === alloc)?.Donors ?? 0;
      if (!n) continue;
      state.collegeSegs.push({ college: c, College: c.name, Allocation: alloc, n, x0: before, x1: before + n });
      before += n;
    }
  }
  state.collegeDots = state.collegeSegs.flatMap(seg =>
    d3.range(seg.n).map(i => ({ seg, i, College: seg.College, Allocation: seg.Allocation, ...random() })));

  // Chapter 5: one circle per subcategory, grouped by allocation
  const total = d3.sum(subcats, d => d.Amount);
  state.subcats = subcats.map(d => ({
    ...d,
    share: d.Amount / total,
    label: d.Subcategory.replace(/^College of /, ""),  // college scholarships sit inside "Scholarship"
    n: Math.max(1, Math.round(d.Amount / CONFIG.subcatValue)),
  }));
  state.subcatGroups = CONFIG.stackOrder.map(alloc => {
    const kids = state.subcats.filter(d => d.Allocation === alloc);
    return { Allocation: alloc, Amount: d3.sum(kids, d => d.Amount), count: kids.length,
             share: d3.sum(kids, d => d.Amount) / total };
  });
  state.subcatDots = state.subcats.flatMap(s =>
    d3.range(s.n).map(i => ({ sub: s, i, Allocation: s.Allocation, ...random() })));

  // Credits: dots in all three allocation colors
  state.creditDots = d3.range(CONFIG.creditParticles).map(i => ({
    i, line: 0, Allocation: CONFIG.stackOrder[i % 3], ...random(),
  }));
}


// ---------- 4. SIZING ----------
function measure() {
  const box = svgEl.getBoundingClientRect();
  state.small = box.width < 560;
  state.margin = state.small ? CONFIG.marginMobile : CONFIG.margin;
  const m = state.margin;
  state.W  = box.width;
  state.H  = box.height;
  state.PW = Math.max(100, state.W - m.left - m.right);
  state.PH = Math.max(100, state.H - m.top - m.bottom);
  svg.attr("viewBox", `0 0 ${state.W} ${state.H}`);
  plot.attr("transform", `translate(${m.left},${m.top})`);
}

function buildScales() {
  state.x = d3.scaleBand().domain(state.years).range([0, state.PW])
    .paddingInner(0.15).paddingOuter(0.1);
  state.y = d3.scaleLinear().domain([0, state.maxAmount]).nice().range([state.PH, 0]);
  const rMax = Math.min(state.x.bandwidth() * CONFIG.maxRadiusShare, state.PH * 0.07);
  state.r = d3.scaleSqrt().domain([0, state.maxAmount]).range([0, rMax]);
  state.yBar = d3.scaleLinear().domain([0, d3.max(state.yearTotals.values())]).nice()
    .range([state.PH, 0]);
}

// A random spot on screen, pushed outward from the center by `spread`
function spot(d, spread = 1) {
  const cx = state.PW / 2, cy = state.PH / 2;
  const sx = d.hx * state.W - state.margin.left;
  const sy = d.hy * state.H - state.margin.top;
  return [cx + (sx - cx) * spread, cy + (sy - cy) * spread];
}
function setSpots(d) {
  [d.homeX, d.homeY] = spot(d);                  // scatter spot
  [d.awayX, d.awayY] = spot(d, CONFIG.flyAway);  // where it flies when leaving
}

function layoutBubbles() {
  const { x, y, r } = state;
  for (const d of state.bubbles) {
    d.radius  = Math.max(CONFIG.minRadius, r(d.Amount));
    d.targetX = x(d.Year) + x.bandwidth() / 2;
    d.targetY = y(d.Amount);
    setSpots(d);
  }
}

function layoutBars() {
  const { x, yBar } = state;
  const barW = x.bandwidth() * CONFIG.barWidthShare;
  const colW = barW / CONFIG.particleCols;
  for (const s of state.segments) {
    s.x = x(s.Year) + (x.bandwidth() - barW) / 2;
    s.w = barW;
    s.top = yBar(s.y1);
    s.bottom = yBar(s.y0);
    s.rowH = (s.bottom - s.top) / Math.ceil(s.n / CONFIG.particleCols);
  }
  const minRowH = d3.min(state.segments, s => s.rowH);
  state.particleR = Math.max(1.2, Math.min(colW, minRowH) * 0.4);
  for (const p of state.particles) {
    const col = p.i % CONFIG.particleCols;
    const row = Math.floor(p.i / CONFIG.particleCols);
    p.targetX = p.seg.x + (col + 0.5) * colW;
    p.targetY = p.seg.bottom - (row + 0.5) * p.seg.rowH;
    setSpots(p);
  }
}

function layoutRing() {
  const cx = state.PW / 2, cy = state.PH / 2;
  const R = Math.min(state.PW, state.PH) * CONFIG.ringRadiusShare;
  state.ring = { cx, cy, R, arcR: R * 1.25 };
  // Dot size: square root of dollars, capped at the 99th percentile
  const cap = d3.quantile(state.donors.map(d => d.Amount).sort(d3.ascending), 0.99);
  const rDonor = d3.scaleSqrt().domain([0, cap])
    .range([Math.max(0.9, R * CONFIG.donorMinR), Math.max(2.5, R * CONFIG.donorMaxR)])
    .clamp(true);
  for (const d of state.donors) {
    d.radius  = rDonor(d.Amount);
    d.targetX = cx + R * Math.sin(d.angle);   // angle 0 = 12 o'clock, clockwise
    d.targetY = cy - R * Math.cos(d.angle);
    setSpots(d);
  }
}

function layoutColleges() {
  // Room on the left for college names, on the right for the donor totals
  const nameW  = state.small ? 92 : 210;
  const totalW = state.small ? 44 : 84;
  state.collegeY = d3.scaleBand().domain(state.colleges.map(c => c.name))
    .range([0, state.PH]).paddingInner(CONFIG.collegeBarPadding).paddingOuter(0.1);
  state.collegeX = d3.scaleLinear().domain([0, d3.max(state.colleges, c => c.pairs)])
    .range([nameW + 10, state.PW - totalW]);
  state.collegeNameX = nameW;

  const rows = CONFIG.collegeDotRows;
  const bandH = state.collegeY.bandwidth();
  const rowH = bandH / rows;
  const unit = state.collegeX(1) - state.collegeX(0);        // pixels per donor
  state.collegeDotR = Math.max(0.8, Math.min(unit * rows, rowH) * 0.42);

  for (const s of state.collegeSegs) {
    s.x = state.collegeX(s.x0);
    s.w = state.collegeX(s.x1) - s.x;
    s.y = state.collegeY(s.College);
    s.h = bandH;
    s.colW = s.w / Math.ceil(s.n / rows);
  }
  // Fill each segment column by column, left to right
  for (const d of state.collegeDots) {
    const col = Math.floor(d.i / rows), row = d.i % rows;
    d.targetX = d.seg.x + (col + 0.5) * d.seg.colW;
    d.targetY = d.seg.y + (row + 0.5) * rowH;
    setSpots(d);
  }
}

function layoutSubcats() {
  const { PW, PH, small } = state;
  const vertical = PW < PH * 0.9;                   // phones: stack the groups top to bottom
  const labelRoom = small ? 18 : 26;                // space above each group for its label
  const gap = small ? 12 : 30;                      // space between groups

  // 1. Pack each allocation on its own. Leaf radius = square root of dollars,
  //    so circle AREA matches dollars, on the same scale for all three groups.
  const packs = state.subcatGroups.map(g => {
    const root = d3.hierarchy({ children: state.subcats.filter(d => d.Allocation === g.Allocation) })
      .sum(d => d.Amount || 0).sort((a, b) => b.value - a.value);
    d3.pack().radius(d => Math.sqrt(d.value)).padding(30)(root);
    return { g, root };
  });

  // 2. One scale factor that makes the three groups fit the plot
  const diam = packs.map(p => 2 * p.root.r);
  const n = packs.length;
  const k = vertical
    ? Math.min(PW / d3.max(diam), (PH - n * labelRoom - gap * (n - 1)) / d3.sum(diam))
    : Math.min((PW - gap * (n - 1)) / d3.sum(diam), (PH - labelRoom) / d3.max(diam));

  // 3. Place the groups in a row (or column), centered
  let cursor = vertical
    ? (PH - (d3.sum(diam) * k + n * labelRoom + gap * (n - 1))) / 2
    : (PW - (d3.sum(diam) * k + gap * (n - 1))) / 2;
  for (const { g, root } of packs) {
    const R = root.r * k;
    if (vertical) { cursor += labelRoom; g.cx = PW / 2; g.cy = cursor + R; cursor += 2 * R + gap; }
    else          { g.cx = cursor + R; g.cy = labelRoom + (PH - labelRoom) / 2; cursor += 2 * R + gap; }
    g.r = R;
    for (const leaf of root.leaves()) {
      Object.assign(leaf.data, {
        cx: g.cx + (leaf.x - root.x) * k,
        cy: g.cy + (leaf.y - root.y) * k,
        r: leaf.r * k,
      });
    }
  }

  // Particles fill each circle in a sunflower spiral, so the number of
  // particles (dollars) matches the circle's area
  const golden = Math.PI * (3 - Math.sqrt(5));
  const packed = state.subcats.filter(s => s.n >= 8);
  state.subcatDotR = Math.max(0.9, d3.min(packed, s => (s.r * 0.92) / Math.sqrt(s.n)) * 0.78);
  for (const d of state.subcatDots) {
    const s = d.sub;
    const rho = s.r * 0.92 * Math.sqrt((d.i + 0.5) / s.n);
    const theta = d.i * golden;
    d.targetX = s.cx + rho * Math.cos(theta);
    d.targetY = s.cy + rho * Math.sin(theta);
    setSpots(d);
  }
}

// Credits: draw the title on an invisible canvas, then read back which
// pixels are "ink". Each dot gets one of those pixels as its target, so
// together the dots spell out the title.
const TITLE_FONT = (size) => `800 ${size}px Fraunces, Georgia, "Times New Roman", serif`;

function layoutCredits() {
  const { PW, PH, small } = state;
  const title = creditsEl.dataset.title;
  const fs = Math.round(Math.max(22, Math.min(50, PW * 0.058)));
  const lineH = fs * 1.12;
  const top = Math.round(PH * (small ? 0.03 : 0.06));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  canvas.width = Math.ceil(PW);
  ctx.font = TITLE_FONT(fs);

  // Wrap the title into lines that fit 92% of the width
  const lines = [];
  for (const word of title.split(" ")) {
    const last = lines[lines.length - 1];
    if (last && ctx.measureText(`${last} ${word}`).width <= PW * 0.92) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  canvas.height = Math.ceil(top + lines.length * lineH + fs);
  ctx.font = TITLE_FONT(fs);            // resizing a canvas resets its settings
  ctx.textAlign = "center";
  ctx.fillStyle = "#000";
  const baseline = i => top + i * lineH + fs * 0.85;
  lines.forEach((line, i) => ctx.fillText(line, PW / 2, baseline(i)));

  // Every 2nd pixel that is ink becomes a possible target
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const points = [];
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] > 128) points.push([x, y]);
    }
  }
  d3.shuffle(points);
  state.creditDots.forEach((d, i) => {
    const [x, y] = points.length ? points[i % points.length] : [PW / 2, top];
    d.targetX = x;
    d.targetY = y;
    d.line = Math.max(0, Math.min(lines.length - 1, Math.floor((y - top) / lineH)));
    setSpots(d);
  });

  state.creditDotR = Math.max(0.9, fs * 0.034);
  state.credit = { lines, fs, top, lineH, baseline, bottom: top + lines.length * lineH };
}

function layoutAll() {
  buildScales();
  layoutBubbles();
  layoutBars();
  layoutRing();
  layoutColleges();
  layoutSubcats();
  layoutCredits();
}


// ---------- 5. DRAWING ----------
const fmtK = v => (v === 0 ? "$0" : `$${d3.format(",")(v / 1000)}K`);
const fmtM = v => (v === 0 ? "$0M" : `$${d3.format(",")(v / 1e6)}M`);
const fmtUSD = d3.format("$,.0f");
const fmtN = d3.format(",");

function drawGridAndY(gridG, axisG, scale, format) {
  const ticks = scale.ticks(state.PH < 300 ? 4 : 6);
  gridG.selectAll("line").data(ticks).join("line")
    .attr("x1", 0).attr("x2", state.PW)
    .attr("y1", d => scale(d)).attr("y2", d => scale(d));
  axisG.call(d3.axisLeft(scale).tickValues(ticks).tickFormat(format).tickSizeOuter(0));
}

function drawYearAxis(axisG, withTotals) {
  const { x, PW, PH } = state;
  axisG.attr("transform", `translate(0,${PH})`);
  axisG.selectAll("line.baseline").data([0]).join("line")
    .attr("class", "baseline").attr("x1", 0).attr("x2", PW)
    .style("stroke", "var(--rule)");
  const g = axisG.selectAll("g.year").data(state.years).join(enter => {
    const e = enter.append("g").attr("class", "year");
    e.append("text").attr("class", "year-label").attr("text-anchor", "middle").attr("y", 22);
    e.append("text").attr("class", "year-total").attr("text-anchor", "middle").attr("y", 39);
    return e;
  });
  g.attr("transform", d => `translate(${x(d) + x.bandwidth() / 2},0)`);
  g.select(".year-label").text(d => d);
  g.select(".year-total").text(d => withTotals ? `$${(state.yearTotals.get(d) / 1e6).toFixed(2)}M` : "");
}

function drawAxes() {
  drawGridAndY(layer.swarmGrid, layer.swarmYAxis, state.y, fmtK);
  drawYearAxis(layer.swarmXAxis, true);
  drawGridAndY(layer.barGrid, layer.barYAxis, state.yBar, fmtM);
  drawYearAxis(layer.barXAxis, false);
}

// The pieces around the donor ring: created once, positioned on every resize
function drawRingParts() {
  const back = layer.ringBack, front = layer.ringFront;
  const cutoff = state.donors[state.cutoffRank - 1];
  ringEls = {
    track:   back.append("circle").attr("class", "ring-track").attr("opacity", 0),
    center:  back.append("g").attr("class", "ring-center").attr("text-anchor", "middle").attr("opacity", 0),
    arc:     front.append("path").attr("class", "ring-arc").attr("fill", CONFIG.highlight),
    marker:  front.append("circle").attr("class", "ring-marker").attr("r", 5)
               .attr("fill", CONFIG.highlight).attr("opacity", 0),
    pct:     front.append("text").attr("class", "ring-pct").attr("opacity", 0)
               .text(`${Math.round(CONFIG.paretoShare * 100)}%`),
    leader:  front.append("line").attr("class", "ring-leader").attr("opacity", 0),
    callout: front.append("g").attr("class", "ring-callout").attr("opacity", 0),
  };
  ringEls.center.append("text").attr("class", "ring-total")
    .text(`$${(state.totalRaised / 1e6).toFixed(1)}M`);
  ringEls.center.append("text").attr("class", "ring-total-sub")
    .text(`raised from ${fmtN(state.donors.length)} donors`);
  ringEls.callout.append("rect").attr("rx", 6);
  ringEls.callout.append("text").attr("class", "callout-line1").attr("text-anchor", "middle")
    .text(`${fmtN(cutoff.Rank)} donors (${Math.round(cutoff.Rank / state.donors.length * 100)}%)`);
  ringEls.callout.append("text").attr("class", "callout-line2").attr("text-anchor", "middle")
    .text(`reach ${Math.round(CONFIG.paretoShare * 100)}% of all giving`);
}

function positionRingParts() {
  const { cx, cy, R, arcR } = state.ring;
  const small = R < 170;
  const A = TAU * CONFIG.paretoShare;
  const mx = cx + arcR * Math.sin(A), my = cy - arcR * Math.cos(A);

  ringEls.track.attr("cx", cx).attr("cy", cy).attr("r", arcR);
  drawArc(state.arcEnd);
  ringEls.marker.attr("cx", mx).attr("cy", my);
  if (small) {
    ringEls.pct.attr("x", mx).attr("y", my - 12).attr("text-anchor", "middle");
  } else {
    ringEls.pct.attr("x", mx + 12 * Math.sin(A) - 6).attr("y", my - 10)
      .attr("text-anchor", Math.sin(A) < 0 ? "end" : "start");
  }
  ringEls.center.select(".ring-total").attr("x", cx).attr("y", cy - R * 0.08)
    .style("font-size", `${Math.max(26, R * 0.24)}px`);
  ringEls.center.select(".ring-total-sub").attr("x", cx).attr("y", cy + R * 0.06)
    .style("font-size", small ? "11px" : "13px");

  const lines = ringEls.callout.selectAll("text").style("font-size", small ? "11px" : "13px");
  const w = d3.max(lines.nodes(), n => n.getComputedTextLength()) + 24;
  const h = small ? 38 : 46;
  const bx = cx - w / 2, by = cy + R * 0.2;
  ringEls.callout.select("rect").attr("x", bx).attr("y", by).attr("width", w).attr("height", h);
  ringEls.callout.select(".callout-line1").attr("x", cx).attr("y", by + h * 0.42);
  ringEls.callout.select(".callout-line2").attr("x", cx).attr("y", by + h * 0.78);
  ringEls.leader.attr("x1", mx).attr("y1", my).attr("x2", bx + 10).attr("y2", by);
}

function drawArc(end) {
  const { cx, cy, arcR } = state.ring;
  state.arcEnd = end;
  ringEls.arc.attr("transform", `translate(${cx},${cy})`)
    .attr("d", d3.arc().innerRadius(arcR - 2.5).outerRadius(arcR + 2.5).cornerRadius(2.5)
      ({ startAngle: 0, endAngle: end }));
}

// Split a long college name onto two lines
function wrapName(textSel, name, maxChars) {
  textSel.selectAll("tspan").remove();
  let lines = [name];
  if (name.length > maxChars) {
    const words = name.split(" ");
    let best = 1, bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const diff = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
  }
  lines.forEach((line, i) => textSel.append("tspan")
    .attr("x", textSel.attr("x"))
    .attr("dy", i === 0 ? `${0.35 - (lines.length - 1) * 0.55}em` : "1.1em")
    .text(line));
}

// Split any label into lines of at most maxChars (used inside circles)
function splitLines(text, maxChars) {
  const lines = [];
  for (const word of text.split(" ")) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + word).length <= maxChars) lines[lines.length - 1] = last + " " + word;
    else lines.push(word);
  }
  return lines;
}
const fmtShort = v => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : `$${Math.round(v / 1e3)}K`);

function drawMarks() {
  const color = d => CONFIG.colors[d.Allocation] || "#999";
  const dots = (g, data, cls) => g.selectAll("circle").data(data).join("circle")
    .attr("class", cls).attr("fill", color).attr("opacity", 0);

  bubbleSel     = dots(layer.bubbles, state.bubbles, "bubble");
  particleSel   = dots(layer.particles, state.particles, "particle");
  donorSel      = dots(layer.donors, state.donors, "donor");
  collegeDotSel = dots(layer.collegeDots, state.collegeDots, "particle");
  subcatDotSel  = dots(layer.subcatDots, state.subcatDots, "particle");
  creditDotSel  = dots(layer.creditDots, state.creditDots, "particle");

  // Credits title: real SVG text inside a link, so it can be clicked
  const link = layer.creditTitle.append("a")
    .attr("href", creditsEl.querySelector(".credit-button").href)
    .attr("target", "_blank").attr("rel", "noopener")
    .attr("aria-label", `${creditsEl.dataset.title} (original dashboard on Tableau Public)`);
  creditTitleSel = link.append("text").attr("class", "credit-title")
    .attr("text-anchor", "middle").attr("opacity", 0);

  subcatCircleSel = layer.subcatCircles.selectAll("circle").data(state.subcats).join("circle")
    .attr("class", "subcat").attr("fill", color).attr("opacity", 0);
  subcatLabelSel = layer.subcatLabels.selectAll("text").data(state.subcats).join("text")
    .attr("class", "subcat-label").attr("opacity", 0);
  subcatGroupSel = layer.subcatGroups.selectAll("g").data(state.subcatGroups).join(enter => {
    const g = enter.append("g").attr("class", "subcat-group").attr("opacity", 0);
    g.append("circle").attr("class", "subcat-outline").attr("stroke", color);
    g.append("text").attr("class", "subcat-group-label").attr("text-anchor", "middle").attr("fill", color);
    return g;
  });

  barSel = layer.bars.selectAll("rect").data(state.segments).join("rect")
    .attr("class", "bar").attr("fill", color).attr("opacity", 0);
  barLabelSel = layer.barLabels.selectAll("text").data(state.segments).join("text")
    .attr("class", "bar-label").attr("opacity", 0)
    .text(d => `${Math.round(d.share * 100)}%`);

  collegeBarSel = layer.collegeBars.selectAll("rect").data(state.collegeSegs).join("rect")
    .attr("class", "bar college-bar").attr("fill", color).attr("opacity", 0);
  collegeCountSel = layer.collegeCounts.selectAll("text").data(state.collegeSegs).join("text")
    .attr("class", "bar-label").attr("opacity", 0).text(d => d.n);
  collegeTotalSel = layer.collegeTotals.selectAll("text").data(state.colleges).join("text")
    .attr("class", "college-total").attr("opacity", 0);
  collegeNameSel = layer.collegeNames.selectAll("text").data(state.colleges).join("text")
    .attr("class", "college-name").attr("opacity", 0);

  drawRingParts();
  resizeMarks();
}

// Sizes and positions that depend on the screen size
function resizeMarks() {
  bubbleSel.attr("r", d => d.radius);
  particleSel.attr("r", state.particleR);
  donorSel.attr("r", d => d.radius);
  collegeDotSel.attr("r", state.collegeDotR);
  subcatDotSel.attr("r", state.subcatDotR);
  creditDotSel.attr("r", state.creditDotR);

  // Credits: title lines in the same spots as the canvas used,
  // and the HTML credit lines placed just below the title
  const c = state.credit;
  creditTitleSel.style("font-size", `${c.fs}px`).selectAll("tspan").data(c.lines).join("tspan")
    .attr("x", state.PW / 2).attr("y", (d, i) => c.baseline(i)).text(d => d);
  const svgTop = svgEl.getBoundingClientRect().top - figureEl.getBoundingClientRect().top;
  creditsEl.style.top = `${svgTop + state.margin.top + c.bottom + (state.small ? 10 : 22)}px`;

  // Chapter 5 circles, their labels, and the allocation outlines
  subcatCircleSel.attr("cx", d => d.cx).attr("cy", d => d.cy).attr("r", d => d.r);
  subcatLabelSel.each(function (d) {
    const text = d3.select(this);
    text.selectAll("tspan").remove();
    if (d.r < CONFIG.subcatLabelMinR) return;               // too small for a label
    const fs = Math.max(9, Math.min(13, d.r / 5));
    const lines = splitLines(d.label, Math.max(6, Math.floor((d.r * 1.55) / (fs * 0.55))));
    const all = [...lines, fmtShort(d.Amount)];
    all.forEach((line, i) => text.append("tspan")
      .attr("x", d.cx)
      .attr("y", d.cy + (i - (all.length - 1) / 2) * fs * 1.15 + fs * 0.35)
      .attr("class", i === all.length - 1 ? "subcat-amount" : null)
      .style("font-size", `${i === all.length - 1 ? fs + 1 : fs}px`)
      .text(line));
  });
  subcatGroupSel.select("circle").attr("cx", g => g.cx).attr("cy", g => g.cy).attr("r", g => g.r + 3);
  subcatGroupSel.select("text").attr("x", g => g.cx).attr("y", g => g.cy - g.r - 9)
    .text(g => `${g.Allocation}: ${fmtShort(g.Amount)} (${Math.round(g.share * 100)}%)`);

  barSel.attr("x", d => d.x).attr("width", d => d.w)
    .attr("y", d => d.top).attr("height", d => Math.max(0, d.bottom - d.top));
  barLabelSel.attr("x", d => d.x + d.w / 2).attr("y", d => (d.top + d.bottom) / 2 + 4)
    .style("display", d => (d.bottom - d.top < 16 ? "none" : null));

  const bandH = state.collegeY.bandwidth();
  collegeBarSel.attr("x", d => d.x).attr("width", d => d.w).attr("y", d => d.y).attr("height", bandH);
  collegeCountSel.attr("x", d => d.x + d.w / 2).attr("y", d => d.y + bandH / 2 + 4)
    .style("display", d => (d.w < 16 || bandH < 13 ? "none" : null));
  collegeTotalSel
    .attr("x", c => state.collegeX(c.pairs) + 8)
    .attr("y", c => state.collegeY(c.name) + bandH / 2 + 4)
    .text(c => (state.small ? fmtN(c.donors) : `${fmtN(c.donors)} donors`));
  collegeNameSel.attr("x", state.collegeNameX).attr("y", c => state.collegeY(c.name) + bandH / 2)
    .each(function (c) {
      d3.select(this).call(wrapName, state.small ? c.short : c.name, state.small ? 16 : 30);
    });

  positionRingParts();
}

// Called on every simulation tick: copy positions onto the circles
function renderBubbles() {
  if (state.mode === "swarm") {
    for (const d of state.bubbles) d.y = Math.min(d.y, state.PH - d.radius);
  }
  bubbleSel.attr("cx", d => d.x).attr("cy", d => d.y);
}
const renderer = sel => () => sel.attr("cx", d => d.x).attr("cy", d => d.y);


// ---------- 6. PHYSICS ----------
// A custom force: pulls each node toward (goalX, goalY), but only once it has
// "launched". That on/off switch is what lets groups take off one by one.
function forcePull() {
  let nodes;
  function force(alpha) {
    for (const d of nodes) {
      if (!d.launched) continue;
      d.vx += (d.goalX - d.x) * d.pull * alpha;
      d.vy += (d.goalY - d.y) * d.pull * alpha * d.pullYBoost;
    }
  }
  force.initialize = n => (nodes = n);
  return force;
}

function makeSim(nodes, render, collideGap = null) {
  const sim = d3.forceSimulation(nodes)
    .velocityDecay(CONFIG.velocityDecay).alphaDecay(CONFIG.alphaDecay)
    .force("pull", forcePull())
    .on("tick", render)
    .stop();
  if (collideGap !== null) {
    sim.force("collide", d3.forceCollide(d => d.radius + collideGap).iterations(2));
  }
  sim.render = render;
  return sim;
}

function createSimulations() {
  bubbleSim   = makeSim(state.bubbles, renderBubbles, CONFIG.gap);
  particleSim = makeSim(state.particles, renderer(particleSel));   // no collide: each has its own spot
  donorSim    = makeSim(state.donors, renderer(donorSel), 0.4);
  collegeSim  = makeSim(state.collegeDots, renderer(collegeDotSel));
  subcatSim   = makeSim(state.subcatDots, renderer(subcatDotSel));
  creditSim   = makeSim(state.creditDots, renderer(creditDotSel));
}

function run(sim, alpha = 1) {
  const collide = sim.force("collide");
  if (collide) collide.radius(collide.radius()); // re-read radii (they change on resize)
  if (reduceMotion) {
    sim.nodes().forEach(d => (d.launched = true));
    sim.stop().alpha(1);
    for (let i = 0; i < 300; i++) sim.tick();
    sim.render();
  } else {
    sim.alpha(alpha).restart();
  }
}

// Set every node's goal; `launch` = true means start moving now
function aim(nodes, goal, pull, pullYBoost = 1, launch = true) {
  for (const d of nodes) {
    [d.goalX, d.goalY] = goal(d);
    d.pull = pull;
    d.pullYBoost = pullYBoost;
    d.launched = launch;
  }
}

// Launch the nodes in groups (years, colleges, ring slices), one after another
function launchInGroups(nodes, sim, groups, groupOf, stagger, instant) {
  groups.forEach((g, i) => {
    const go = () => {
      nodes.forEach(d => { if (groupOf(d) === g) d.launched = true; });
      sim.alpha(Math.max(sim.alpha(), 0.9)).restart();
    };
    if (instant || reduceMotion) go();
    else later(go, i * stagger);
  });
}

function later(fn, delay) { state.timers.push(setTimeout(fn, delay)); }
function clearTimers() { state.timers.forEach(clearTimeout); state.timers = []; }

// Send a set of dots flying off the screen while they fade out
function flyAway(sim, sel) {
  aim(sim.nodes(), d => [d.awayX, d.awayY], 0.035);
  sel.transition("fade").delay(ms(150)).duration(ms(CONFIG.fadeOutMs)).attr("opacity", 0);
  run(sim, 0.8);
}

// A chart where particles fly in, settle into place, then turn into solid
// shapes (bars in charts 2 and 4, circles in chart 5).
// Returns { arrive(instant), leave() }.
function particleChart({ sim, dotSel, groups, groupOf, stagger, solids, labels = [],
                         onShow = () => {}, onHide = () => {} }) {
  const nodes = sim.nodes();
  const my = { out: false, placed: false, solidShown: false };

  function showSolids(instant) {
    my.solidShown = true;
    const t = instant ? 0 : ms(600);
    solids.forEach((sel, i) =>
      sel.transition("fade").delay(instant ? 0 : ms(i * 200)).duration(t).attr("opacity", 1));
    dotSel.transition("fade").duration(t).attr("opacity", 0);
    onShow(instant);
  }

  my.arrive = instant => {
    my.out = true;
    labels.forEach(sel => sel.transition("fade").duration(ms(500)).attr("opacity", 1));
    if (instant || reduceMotion) {               // resize or reduced motion: jump to the end
      sim.stop();
      aim(nodes, d => [d.targetX, d.targetY], CONFIG.particlePull);
      nodes.forEach(d => { d.x = d.targetX; d.y = d.targetY; d.vx = d.vy = 0; });
      sim.render();
      dotSel.interrupt("fade").attr("opacity", 0);
      showSolids(true);
      return;
    }
    if (!my.placed) {                            // very first time: start from random spots
      nodes.forEach(d => { d.x = d.homeX; d.y = d.homeY; });
      my.placed = true;
    }
    aim(nodes, d => [d.targetX, d.targetY], CONFIG.particlePull, 1, false);
    launchInGroups(nodes, sim, groups, groupOf, stagger, false);
    dotSel.transition("fade")
      .delay(d => groups.indexOf(groupOf(d)) * stagger)
      .duration(500).attr("opacity", CONFIG.particleOpacity);
    run(sim, 1);
    later(() => showSolids(false), groups.length * stagger + CONFIG.barRevealDelay);
  };

  my.leave = () => {
    if (!my.out) return;                         // already gone
    my.out = false;
    // If the solid bars were showing, bring the particles back first so the
    // bars look like they break apart
    if (my.solidShown) dotSel.interrupt("fade").attr("opacity", CONFIG.particleOpacity);
    my.solidShown = false;
    onHide();
    [...solids, ...labels].forEach(sel =>
      sel.transition("fade").duration(ms(250)).attr("opacity", 0));
    flyAway(sim, dotSel);
  };
  return my;
}


// ---------- 7. CHARTS ----------
// --- Chart 1: bubbles ---
function bubblesScatter(firstTime) {
  state.bubblesOut = true;
  aim(state.bubbles, d => [d.homeX, d.homeY], 0.04);
  if (firstTime) {
    state.bubbles.forEach(d => { d.x = d.homeX; d.y = d.homeY; });
    renderBubbles();
  }
  bubbleSel.transition("fade").duration(ms(600)).attr("opacity", CONFIG.scatterOpacity);
  if (!firstTime) run(bubbleSim, 0.6);
}

function bubblesSwarm(instant) {
  state.bubblesOut = true;
  aim(state.bubbles, d => [d.targetX, d.targetY], CONFIG.pullX, CONFIG.pullY / CONFIG.pullX, false);
  launchInGroups(state.bubbles, bubbleSim, state.years, d => d.Year, CONFIG.yearStagger, instant);
  bubbleSel.transition("fade").duration(ms(700)).attr("opacity", CONFIG.swarmOpacity);
  run(bubbleSim, 1);
}

function bubblesLeave() {
  if (!state.bubblesOut) return;
  state.bubblesOut = false;
  flyAway(bubbleSim, bubbleSel);
}

// --- Chart 3: donor ring ---
function ringArrive(instant) {
  state.donorsOut = true;
  if (!state.donorsPlaced) {
    state.donors.forEach(d => { d.x = d.homeX; d.y = d.homeY; });
    state.donorsPlaced = true;
  }
  // Dots fly in slice by slice, clockwise from 12 o'clock
  aim(state.donors, d => [d.targetX, d.targetY], CONFIG.donorPull, 1, false);
  launchInGroups(state.donors, donorSim, d3.range(6), d => d.group, CONFIG.yearStagger, instant);
  donorSel.transition("fade")
    .delay(d => (instant ? 0 : ms(d.group * CONFIG.yearStagger)))
    .duration(ms(500)).attr("opacity", CONFIG.donorOpacity);
  ringEls.center.transition("fade").delay(instant ? 0 : ms(700)).duration(ms(700)).attr("opacity", 1);
  run(donorSim, 1);

  if (instant || reduceMotion) showPareto(true);
  else later(() => showPareto(false), 6 * CONFIG.yearStagger + CONFIG.ringRevealDelay);
}

// The blue arc sweeps to 80%, then the marker, callout and dimming appear
function showPareto(instant) {
  const end = TAU * CONFIG.paretoShare;
  const sweep = instant ? 0 : ms(CONFIG.arcSweepMs);
  ringEls.track.transition("fade").duration(instant ? 0 : ms(400)).attr("opacity", 1);
  ringEls.arc.interrupt("sweep").transition("sweep").duration(sweep).ease(d3.easeCubicInOut)
    .tween("arc", () => {
      const from = state.arcEnd;
      return t => drawArc(from + (end - from) * t);
    });
  [ringEls.marker, ringEls.pct, ringEls.leader].forEach(el =>
    el.transition("fade").delay(sweep).duration(instant ? 0 : ms(400)).attr("opacity", 1));
  ringEls.callout.transition("fade").delay(sweep + (instant ? 0 : ms(200)))
    .duration(instant ? 0 : ms(500)).attr("opacity", 1);
  donorSel.filter(d => d.Rank > state.cutoffRank)
    .transition("fade").delay(sweep).duration(instant ? 0 : ms(700))
    .attr("opacity", CONFIG.tailOpacity);
}

function ringLeave() {
  if (!state.donorsOut) return;
  state.donorsOut = false;
  const quick = ms(250);
  ringEls.arc.interrupt("sweep").transition("sweep").duration(quick)
    .tween("arc", () => {
      const from = state.arcEnd;
      return t => drawArc(from * (1 - t));
    });
  [ringEls.track, ringEls.center, ringEls.marker, ringEls.pct, ringEls.leader, ringEls.callout]
    .forEach(el => el.transition("fade").duration(quick).attr("opacity", 0));
  donorSel.interrupt("fade").attr("opacity", CONFIG.donorOpacity); // undo the dimming, then fly off
  flyAway(donorSim, donorSel);
}

function showAxes(groups, on) {
  groups.forEach(g => g.transition().delay(on ? ms(300) : 0).duration(ms(on ? 800 : 400))
    .attr("opacity", on ? 1 : 0));
}


// ---------- 8. MODES ----------
// Each step in index.html has a data-mode. For each mode, one chart arrives
// and every other chart leaves. "scatter" = before the first step.
let CHARTS;
function setupCharts() {
  yearBars = particleChart({
    sim: particleSim, dotSel: particleSel,
    groups: state.years, groupOf: d => d.Year, stagger: CONFIG.yearStagger,
    solids: [barSel, barLabelSel],
  });
  collegeBars = particleChart({
    sim: collegeSim, dotSel: collegeDotSel,
    groups: state.colleges.map(c => c.name), groupOf: d => d.College, stagger: CONFIG.collegeStagger,
    solids: [collegeBarSel, collegeCountSel ],
    labels: [collegeNameSel],       // college names appear right away
  });
  subcatPack = particleChart({
    sim: subcatSim, dotSel: subcatDotSel,
    groups: CONFIG.stackOrder, groupOf: d => d.Allocation, stagger: CONFIG.subcatStagger,
    solids: [subcatCircleSel, subcatLabelSel],
    labels: [subcatGroupSel],       // allocation outlines appear right away
  });
  credits = particleChart({
    sim: creditSim, dotSel: creditDotSel,
    groups: d3.range(6), groupOf: d => d.line, stagger: CONFIG.creditStagger,
    solids: [creditTitleSel],
    // After the title turns solid, the credit lines assemble one by one
    onShow: instant => {
      creditsEl.querySelectorAll(".credit-line").forEach((el, i) => {
        el.style.transitionDelay = instant || reduceMotion ? "0ms" : `${300 + i * 180}ms`;
      });
      creditsEl.classList.add("show");
    },
    // Leaving: the lines blur and dissolve right away
    onHide: () => {
      creditsEl.querySelectorAll(".credit-line").forEach(el => (el.style.transitionDelay = "0ms"));
      creditsEl.classList.remove("show");
    },
  });
  CHARTS = {
    swarm:    { arrive: bubblesSwarm,       leave: bubblesLeave },
    bars:     { arrive: yearBars.arrive,    leave: yearBars.leave },
    ring:     { arrive: ringArrive,         leave: ringLeave },
    colleges: { arrive: collegeBars.arrive, leave: collegeBars.leave },
    subcats:  { arrive: subcatPack.arrive,  leave: subcatPack.leave },
    credits:  { arrive: credits.arrive,     leave: credits.leave },
  };
}

function setMode(mode, { force = false, instant = false } = {}) {
  if (mode === state.mode && !force) return;
  const firstTime = state.mode === null;
  state.mode = mode;
  clearTimers();
  hideTooltip();
  figureEl.dataset.mode = mode;

  const titleFor = mode === "scatter" ? "swarm" : mode;
  document.querySelectorAll(".chart-title-block").forEach(el =>
    el.classList.toggle("is-current", el.dataset.for === titleFor));

  // Everything that isn't this mode's chart leaves...
  for (const [name, chart] of Object.entries(CHARTS)) {
    if (name !== mode && !(mode === "scatter" && name === "swarm")) chart.leave();
  }
  // ...and this mode's chart arrives
  if (mode === "scatter") bubblesScatter(firstTime);
  else CHARTS[mode].arrive(instant);

  showAxes(swarmAxes, mode === "swarm");
  showAxes(barAxes, mode === "bars");
}


// ---------- 9. INTERACTION ----------
function placeTooltip(event, html) {
  tooltipEl.innerHTML = html;
  tooltipEl.hidden = false;
  const box = figureEl.getBoundingClientRect();
  const px = event.clientX - box.left, py = event.clientY - box.top;
  const tw = tooltipEl.offsetWidth, th = tooltipEl.offsetHeight;
  const left = px + 14 + tw > box.width ? px - tw - 14 : px + 14;
  tooltipEl.style.left = `${Math.max(0, left)}px`;
  tooltipEl.style.top  = `${Math.max(0, Math.min(py - th / 2, box.height - th))}px`;
}
function hideTooltip() { tooltipEl.hidden = true; }

function tip(sel, html) {
  sel.on("mousemove", (event, d) => placeTooltip(event, html(d))).on("mouseleave", hideTooltip);
}

function setupInteraction() {
  tip(bubbleSel, d => `
    <div class="tt-college">${d.College}</div>
    <div class="tt-meta">${d.Allocation}, ${d.Year}</div>
    <div class="tt-amount">${fmtUSD(d.Amount)}</div>
    <div class="tt-meta">${d.Gifts} gifts from ${d.Donors} donors</div>`);

  tip(barSel, d => `
    <div class="tt-college">${d.Year}</div>
    <div class="tt-meta">${d.Allocation}</div>
    <div class="tt-amount">${fmtUSD(d.Amount)}</div>
    <div class="tt-meta">${(d.share * 100).toFixed(1)}% of that year’s giving</div>`);

  tip(donorSel, d => `
    <div class="tt-college">Donor ranked #${fmtN(d.Rank)} of ${fmtN(state.donors.length)}</div>
    <div class="tt-amount">${fmtUSD(d.Amount)}</div>
    <div class="tt-meta">${d.Gifts} gift${d.Gifts > 1 ? "s" : ""}${d.Allocations > 1 ? ", split:" : ", all to " + d.Allocation}</div>
    ${d.Allocations > 1 ? CONFIG.stackOrder.filter(a => d[a] > 0)
        .map(a => `<div class="tt-meta">&nbsp;&nbsp;${a}: ${fmtUSD(d[a])}</div>`).join("") : ""}
    <div class="tt-meta">Running total: ${(d.CumShare * 100).toFixed(1)}% of all giving</div>`);

  tip(collegeBarSel, d => `
    <div class="tt-college">${d.College}</div>
    <div class="tt-meta">${d.Allocation}</div>
    <div class="tt-amount">${fmtN(d.n)} donors</div>`);

  tip(subcatCircleSel, d => `
    <div class="tt-college">${d.Subcategory}</div>
    <div class="tt-meta">${d.Allocation}</div>
    <div class="tt-amount">${fmtUSD(d.Amount)}</div>
    <div class="tt-meta">${(d.share * 100).toFixed(1)}% of all giving</div>
    <div class="tt-meta">${fmtN(d.Gifts)} gifts from ${fmtN(d.Donors)} donors</div>`);

  // Legend: fade the other allocations while one is hovered or focused
  const highlight = key => {
    const dim = d => key && d.Allocation !== key;
    [bubbleSel, barSel, barLabelSel, donorSel, collegeBarSel, collegeCountSel,
     subcatCircleSel, subcatLabelSel, subcatGroupSel].forEach(sel => sel.classed("dim", dim));
  };
  d3.selectAll(".legend button")
    .on("mouseenter focus", function () { highlight(this.dataset.key); })
    .on("mouseleave blur",  () => highlight(null));
}


// ---------- 10. SCROLL ----------
function setupScroll() {
  const steps = [...document.querySelectorAll(".step")];

  // Activate one step (or none, which means "scatter")
  const activate = step => {
    steps.forEach(s => s.classList.toggle("is-active", s === step));
    setMode(step ? step.dataset.mode : "scatter");
  };

  // Scrollama fires when a step crosses the trigger line, in either direction
  const scroller = scrollama();
  scroller
    .setup({ step: ".step", offset: CONFIG.triggerAt })
    .onStepEnter(({ element }) => activate(element))
    .onStepExit(({ element, direction }) => {
      if (direction === "up" && element === steps[0]) activate(null);
    });

  // Safety net: a very fast scroll can jump over a trigger line without
  // firing it. After each scroll, find the step that should be active.
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const line = window.innerHeight * CONFIG.triggerAt;
      const passed = steps.filter(s => s.getBoundingClientRect().top < line);
      const step = passed[passed.length - 1] || null;
      if ((step ? step.dataset.mode : "scatter") !== state.mode) activate(step);
    });
  }, { passive: true });

  // Re-measure everything when the window size changes
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      measure();
      layoutAll();
      drawAxes();
      resizeMarks();
      setMode(state.mode, { force: true, instant: true });
      scroller.resize();
    }, 200);
  });
}


// ---------- 11. START ----------
async function init() {
  prepare(await loadData());
  // The credits title is traced from the font, so wait (up to 2s) for fonts to load
  await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2000))]);
  measure();
  layoutAll();
  drawAxes();
  drawMarks();
  createSimulations();
  setupCharts();
  setupInteraction();
  setMode("scatter");
  setupScroll();
}

init().catch(err => {
  console.error(err);
  document.querySelector(".chart-sub").textContent =
    "Could not load the data files. Run the page through a local server (see README).";
});
