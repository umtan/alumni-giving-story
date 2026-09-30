# 2,317 Donors & The Long Arc of Alumni Giving (2010–2015)

A scrollytelling rebuild of my Tableau dashboard, made with plain HTML, CSS, JavaScript, [D3](https://d3js.org) and [Scrollama](https://github.com/russellsamora/scrollama). No build tools, no frameworks.

**Chapter 1, The Anatomy of Growth:** 212 bubbles (one per year × college × allocation type, sized by total amount) fly in from across the screen and settle into a beeswarm by year as the text scrolls in.

**Chapter 2, Steady Growth of Consistent Mix:** the bubbles fly off, and about 990 particles (1 particle = $25K) fly in and stack into bars by year and allocation, then turn into solid bars with share labels.

**Chapter 3, The Weight of Every Gift:** 2,317 donor dots fly in and form a ring, largest giver first, where each donor's share of the circle equals their share of the dollars. A blue arc sweeps to 80%, and a callout marks the 1,168 donors (50%) who reach it.

**Chapter 4, Donors by College:** 3,128 particles (one per donor per allocation) fly in college by college and fill horizontal bars, then become solid bars with counts. The total at the end of each bar counts every donor once, because 698 donors gave to more than one allocation.

**Chapter 5, Allocation Subcategory by Gift Amount:** about 985 particles ($25K each) fly in allocation by allocation and pack into 25 circles, one per fund or program, grouped into Scholarship, Endowment and Campus Resource. Then they become solid circles with names and amounts.

**Credits:** the last chart dissolves, and about 2,400 dots trace the dashboard title from the font itself. The title then becomes a clickable link to the original Tableau Public dashboard, and the credit lines assemble one by one.

Every transition also plays in reverse when you scroll back up.

## Run it locally

The page loads the CSV files in `data/`, and browsers block that when you double-click `index.html`. Serve the folder instead:

```bash
cd alumni-giving
python -m http.server 8000
```

Then open <http://localhost:8000>. (Or, in VS Code, right-click `index.html` → **Open with Live Server**.)

## Files

```
alumni-giving/
├── index.html          page structure and all story text
├── css/style.css       colors, fonts, sizes, layout
├── js/main.js          data loading, scales, physics, scroll triggers
└── data/
    ├── advancement_donations_and_giving_demo.xls   raw Tableau sample data
    ├── prep_data.py    builds both CSVs from the raw file
    ├── bubbles.csv     chapters 1 and 2 (year x college x allocation)
    ├── donors.csv      chapter 3 (one row per donor, largest first)
    ├── colleges.csv    chapter 4 (donors per college x allocation)
    └── subcategories.csv  chapter 5 (dollars per fund or program)
```

## Where to change things

| I want to change… | Edit |
|---|---|
| Story text, chart title, subtitle | `index.html` |
| Credits text and links | `index.html`, the `<div class="credits">` block (the title is its `data-title`) |
| Background, text and highlight colors | `css/style.css`, section 1 (`--bg`, `--ink`, `--highlight`) |
| Text sizes | `css/style.css`, section 1 (`--size-hero`, `--size-step`) |
| Bubble colors | `CONFIG.colors` in `js/main.js` **and** `--scholarship` etc. in `style.css` |
| Bubble size | `CONFIG.maxRadiusShare` in `js/main.js` |
| How the motion feels | `CONFIG.velocityDecay`, `alphaDecay`, `pullX`, `pullY`, `yearStagger` |
| Particles in chart 2 | `CONFIG.particleValue` (dollars per particle), `particleCols`, `barWidthShare` |
| When the solid bars appear | `CONFIG.barRevealDelay` |
| Bar stacking order | `CONFIG.stackOrder` (bottom to top) |
| Ring size and dot size | `CONFIG.ringRadiusShare`, `donorMaxR`, `donorMinR` |
| Blue arc speed and stop point | `CONFIG.arcSweepMs`, `paretoShare` |
| How faded the last 20% gets | `CONFIG.tailOpacity` |
| Particle rows in the college bars | `CONFIG.collegeDotRows` |
| Which circles get a label in chapter 5 | `CONFIG.subcatLabelMinR` |
| How many dots spell the credits title | `CONFIG.creditParticles` |
| How far you scroll before the chart animates | `.steps { padding: 55vh ... }` in `style.css`, and `offset` in `setupScroll()` |

## Rebuilding the data

```bash
pip install pandas xlrd
python data/prep_data.py
```

It prints sanity checks (total $24,672,757, 3,913 gifts, 2,317 donors, 44.8% growth, 1,168 donors to reach 80%) so you can confirm the CSVs match the dashboard.

## Publish on GitHub Pages

Push the folder to a repository, then **Settings → Pages → Deploy from branch → main / root**. The site appears at `https://<username>.github.io/<repo>/`.

---
Data: Tableau Public sample dataset “University Advancement, Donations, and Giving” (fictitious).
Created by Urmimala Mandal, with coding assisted by Claude (Anthropic).
Original dashboard: [2,317 Donors & The Long Arc of Alumni Giving (2010–2015)](https://public.tableau.com/app/profile/urmimala.mandal/viz/2317DonorsTheLongArcofAlumniGiving20102015/Dashboard24)
