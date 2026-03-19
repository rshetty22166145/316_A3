// --- DOM references ---
const svg = d3.select("#temp-chart");
const tooltip = d3.select("#tooltip");
const slider = document.getElementById("year-slider");
const sliderLabel = document.getElementById("year-label");
const playButton = document.getElementById("play-button");
const spinButton = document.getElementById("spin-button");
const speedSlider = document.getElementById("speed-slider");
const speedLabel = document.getElementById("speed-label");
const countryPanelBody = document.getElementById("country-panel-body");
const jumpButton = document.getElementById("jump-button");
const trendSvg = d3.select("#trend-chart");
const leaderboardBody = document.getElementById("leaderboard-body");
const eventsStrip = document.getElementById("events-strip");
const eventDetail = document.getElementById("event-detail");

// --- Globe layout ---
const width = 640;
const height = 380;
const centerX = width / 2;
const centerY = height / 2;
const radius = Math.min(width, height) * 0.34;

svg.attr("viewBox", `0 0 ${width} ${height}`);

const g = svg.append("g").attr("transform", `translate(${centerX},${centerY})`);

const projection = d3
  .geoOrthographic()
  .scale(radius)
  .translate([0, 0])
  .center([0, 0])
  .clipAngle(90);

const path = d3.geoPath(projection);
const graticule = d3.geoGraticule();

g.append("path")
  .datum({ type: "Sphere" })
  .attr("class", "globe-water")
  .attr("d", path);

g.append("path")
  .datum(graticule())
  .attr("class", "globe-graticule")
  .attr("d", path);

g.append("circle")
  .attr("class", "globe-outline")
  .attr("r", radius);

const landGroup = g.append("g");

// --- Data structures ---
let countries; // GeoJSON features
let animationTimer = null;
let spinTimer = null;
let currentYear = 1960;
let currentSpeed = 1; // years per second
const spinSpeedDegPerSec = 10;

// population lookup: key "ISO-1960" -> pop
const popByIsoYear = new Map();
const nameByIso = new Map();
const globalPopByYear = new Map();
const isoByNormalizedName = new Map();
const baseline1950ByIso = new Map();
const restCountryMetaByIso = new Map();
const restCountryPendingByIso = new Map();
let availableYears = [];

const historicalEvents = [
  {
    year: 1961,
    title: "Global vaccination momentum",
    description:
      "Large-scale immunization campaigns accelerate, improving child survival in many regions.",
    populationEffect:
      "Lower child mortality increases population momentum in many low- and middle-income countries.",
    worldEffect:
      "Global population growth remains high as life expectancy improves.",
    countries: ["IND", "NGA", "IDN"],
  },
  {
    year: 1969,
    title: "Green Revolution expansion",
    description:
      "High-yield crops spread across Asia and Latin America, supporting food supply for growing populations.",
    populationEffect:
      "Food security improvements support sustained growth in densely populated agrarian countries.",
    worldEffect:
      "Global famine risk declines in several regions, supporting long-run growth.",
    countries: ["IND", "PAK", "MEX"],
  },
  {
    year: 1973,
    title: "Oil crisis",
    description:
      "Energy shocks affect economic growth and migration patterns across multiple countries.",
    populationEffect:
      "Economic stress changes migration and fertility behavior, especially in import-dependent economies.",
    worldEffect:
      "Growth slows unevenly across regions as inflation and energy costs surge.",
    countries: ["USA", "DEU", "JPN"],
  },
  {
    year: 1979,
    title: "China reforms begin",
    description:
      "Economic reforms reshape urbanization and long-run demographic trends in China.",
    populationEffect:
      "Rapid industrialization and urbanization alter household size and fertility decisions over time.",
    worldEffect:
      "Large-scale structural change in China influences global labor and migration dynamics.",
    countries: ["CHN", "VNM", "KOR"],
  },
  {
    year: 1989,
    title: "End of Cold War era",
    description:
      "Political transitions in Europe and Eurasia influence migration and population distribution.",
    populationEffect:
      "Transition economies see shifts in fertility and emigration patterns.",
    worldEffect:
      "Cross-border movement increases in Europe, changing regional population balances.",
    countries: ["RUS", "POL", "DEU"],
  },
  {
    year: 1994,
    title: "Cairo population conference",
    description:
      "Global policy emphasis shifts toward reproductive health and rights in population planning.",
    populationEffect:
      "Expanded family planning and education correlate with declining fertility in multiple regions.",
    worldEffect:
      "Policy framing broadens from pure growth control to health and development outcomes.",
    countries: ["EGY", "BGD", "ETH"],
  },
  {
    year: 2001,
    title: "Globalization deepens",
    description:
      "Labor mobility and interconnected economies continue to reshape country-level demographic patterns.",
    populationEffect:
      "Urban hubs and migrant-destination countries absorb faster population increases.",
    worldEffect:
      "International migration becomes a larger driver of population change in many states.",
    countries: ["USA", "ARE", "ESP"],
  },
  {
    year: 2008,
    title: "Global financial crisis",
    description:
      "Economic slowdown affects fertility, migration, and employment across many regions.",
    populationEffect:
      "Some countries experience delayed childbirth and lower migration inflows.",
    worldEffect:
      "Population growth remains positive globally but decelerates in several economies.",
    countries: ["USA", "ESP", "GRC"],
  },
  {
    year: 2015,
    title: "UN Sustainable Development Goals",
    description:
      "SDGs include health, education, and inequality targets linked to long-term demographic change.",
    populationEffect:
      "Investments in education, health, and gender equity can reduce fertility and improve outcomes.",
    worldEffect:
      "Global demographic strategy shifts toward sustainable and inclusive growth.",
    countries: ["IND", "NGA", "BRA"],
  },
  {
    year: 2020,
    title: "COVID-19 disruption",
    description:
      "Pandemic impacts mortality, migration, and population growth trajectories worldwide.",
    populationEffect:
      "Excess mortality and mobility restrictions disrupt growth patterns in many countries.",
    worldEffect:
      "Worldwide demographic trajectories diverge as health shocks and recovery rates vary.",
    countries: ["USA", "IND", "BRA"],
  },
];

// selection state
let selectedIso = null;
let selectedFeature = null;
let previousRankByIso = new Map();
let previousYByIso = new Map();

// --- Color scale & legend ---
let colorScale = d3.scaleSequential(d3.interpolateYlOrRd).clamp(true);
const baselineYear = 1950;

const legendWidth = 220;
const legendHeight = 10;
const legendOffsetX = -width / 2 + 40;
const legendOffsetY = height / 2 - 22;

const defs = svg.append("defs");
const gradient = defs
  .append("linearGradient")
  .attr("id", "pop-gradient")
  .attr("x1", "0%")
  .attr("y1", "0%")
  .attr("x2", "100%")
  .attr("y2", "0%");

const legendGroup = svg
  .append("g")
  .attr(
    "transform",
    `translate(${centerX + legendOffsetX},${centerY + legendOffsetY})`
  );

legendGroup
  .append("text")
  .attr("class", "legend-title")
  .attr("x", 0)
  .attr("y", -6)
  .text("Population gained since 1950 (people, capped)");

legendGroup
  .append("rect")
  .attr("width", legendWidth)
  .attr("height", legendHeight)
  .attr("fill", "url(#pop-gradient)");

const legendAxisGroup = legendGroup
  .append("g")
  .attr("class", "legend-axis")
  .attr("transform", `translate(0, ${legendHeight})`);

function initLegend() {
  const gainValues = [];

  nameByIso.forEach((_, iso) => {
    const base = baseline1950ByIso.get(iso);
    if (base == null || base <= 0) return;
    availableYears.forEach((year) => {
      const pop = getPopulation(iso, year);
      if (pop == null || pop <= 0) return;
      const gain = pop - base;
      if (isFinite(gain)) gainValues.push(gain);
    });
  });

  if (!gainValues.length) {
    gainValues.push(0, 1e8);
  }

  gainValues.sort((a, b) => a - b);
  const q05 = d3.quantileSorted(gainValues, 0.05);
  const q95 = d3.quantileSorted(gainValues, 0.95);

  // Cap extreme outliers so color differences remain visible.
  let minGain = q05 == null ? 0 : q05;
  let maxGain = q95 == null ? 1e8 : q95;
  if (minGain > 0) minGain = 0;
  if (maxGain < 1e7) maxGain = 1e7;
  // Hard clamp to a readable range.
  minGain = Math.max(minGain, -2e8);
  maxGain = Math.min(maxGain, 1.5e9);
  if (maxGain <= minGain) {
    minGain = 0;
    maxGain = 1e8;
  }

  // Mostly gains are positive, but keep cool colors for declines.
  if (minGain < 0) {
    colorScale = d3
      .scaleDiverging(d3.interpolateRdYlBu)
      .domain([maxGain, 0, minGain])
      .clamp(true);
  } else {
    colorScale = d3
      .scaleSequential(d3.interpolateYlOrRd)
      .domain([0, maxGain])
      .clamp(true);
  }

  gradient.selectAll("stop").remove();
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const value = minGain + t * (maxGain - minGain);
    gradient
      .append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", colorScale(value));
  }

  const legendScale = d3
    .scaleLinear()
    .domain([minGain, maxGain])
    .range([0, legendWidth]);
  const legendAxis = d3
    .axisBottom(legendScale)
    .ticks(5)
    .tickFormat((d) => `${(d / 1e6).toFixed(0)}M`);
  legendAxisGroup.call(legendAxis);
}

// --- Trend chart ---
const trendMargin = { top: 8, right: 12, bottom: 18, left: 40 };
const trendWidth = 640 - trendMargin.left - trendMargin.right;
const trendHeight = 160 - trendMargin.top - trendMargin.bottom;

trendSvg.attr(
  "viewBox",
  `0 0 ${trendWidth + trendMargin.left + trendMargin.right} ${
    trendHeight + trendMargin.top + trendMargin.bottom
  }`
);

const trendG = trendSvg
  .append("g")
  .attr("transform", `translate(${trendMargin.left},${trendMargin.top})`);

const trendX = d3.scaleLinear().range([0, trendWidth]);
const trendY = d3.scaleLinear().range([trendHeight, 0]);

const trendXAxisG = trendG
  .append("g")
  .attr("class", "trend-axis")
  .attr("transform", `translate(0, ${trendHeight})`);

const trendYAxisG = trendG.append("g").attr("class", "trend-axis");

const trendYearLine = trendG
  .append("line")
  .attr("class", "trend-year-line")
  .style("opacity", 0);

const trendGlobalPath = trendG
  .append("path")
  .attr("class", "trend-line-global");

const trendCountryPath = trendG
  .append("path")
  .attr("class", "trend-line-country")
  .style("opacity", 0);

const trendLine = d3
  .line()
  .x((d) => trendX(d.year))
  .y((d) => trendY(d.value));

let globalTrend = [];
let countryTrendCache = new Map();

function buildGlobalTrend() {
  globalTrend = availableYears.map((year) => ({
    year,
    value: globalPopByYear.get(year) || 0,
  }));

  trendX.domain(d3.extent(availableYears));
  const extent = d3.extent(globalTrend, (d) => d.value);
  const pad = (extent[1] - extent[0]) * 0.05;
  trendY.domain([extent[0] - pad, extent[1] + pad]);

  const xAxis = d3
    .axisBottom(trendX)
    .ticks(6)
    .tickFormat(d3.format("d"));
  const yAxis = d3
    .axisLeft(trendY)
    .ticks(3)
    .tickFormat((d) => `${(d / 1e9).toFixed(2)}B`);

  trendXAxisG.call(xAxis);
  trendYAxisG.call(yAxis);

  trendGlobalPath.datum(globalTrend).attr("d", trendLine);

  updateTrendYearLine();
}

function updateCountryTrend() {
  if (!selectedIso) {
    trendCountryPath.style("opacity", 0);
    return;
  }
  const iso = selectedIso;
  if (!countryTrendCache.has(iso)) {
    const series = availableYears.map((year) => ({
      year,
      value: getPopulation(iso, year) || 0,
    }));
    countryTrendCache.set(iso, series);
  }
  const series = countryTrendCache.get(iso);
  trendCountryPath.datum(series).attr("d", trendLine).style("opacity", 1);
}

function updateTrendYearLine() {
  if (!globalTrend.length) {
    trendYearLine.style("opacity", 0);
    return;
  }
  const xPos = trendX(currentYear);
  trendYearLine
    .style("opacity", 1)
    .attr("x1", xPos)
    .attr("x2", xPos)
    .attr("y1", 0)
    .attr("y2", trendHeight);
}

// --- Utility helpers ---
function keyIsoYear(iso, year) {
  return `${iso}-${year}`;
}

function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const geoToCsvNameAlias = {
  "united states of america": "united states",
  "russia": "russian federation",
  "iran": "iran islamic rep",
  "syria": "syrian arab republic",
  "venezuela": "venezuela rb",
  "egypt": "egypt arab rep",
  "laos": "lao pdr",
  "slovakia": "slovak republic",
  "kyrgyzstan": "kyrgyz republic",
  "yemen": "yemen rep",
  "gambia": "gambia the",
  "bahamas": "bahamas the",
  "czechia": "czech republic",
  "brunei": "brunei darussalam",
  "south korea": "korea rep",
  "north korea": "korea dem peoples rep",
  "democratic republic of the congo": "congo dem rep",
  "republic of the congo": "congo rep",
  "cote d ivoire": "cote d'ivoire",
  "eswatini": "swaziland",
};

function getPopulation(iso, year) {
  return popByIsoYear.get(keyIsoYear(iso, year)) ?? null;
}

function getPopulationGainSince1950(iso, year) {
  const pop = getPopulation(iso, year);
  const base = baseline1950ByIso.get(iso);
  if (pop == null || base == null || base <= 0) return null;
  return pop - base;
}

function getLeaderboardValueColor(gain) {
  if (gain == null || !isFinite(gain)) return null;
  const c = d3.color(colorScale(gain));
  return c ? c.darker(0.6).formatHex() : null;
}

function formatLanguages(languages) {
  if (!languages || typeof languages !== "object") return "n/a";
  const vals = Object.values(languages).filter(Boolean);
  return vals.length ? vals.join(", ") : "n/a";
}

function formatCurrencies(currencies) {
  if (!currencies || typeof currencies !== "object") return "n/a";
  const vals = Object.values(currencies)
    .map((c) => {
      const name = c && c.name ? c.name : null;
      const symbol = c && c.symbol ? c.symbol : null;
      if (name && symbol) return `${name} (${symbol})`;
      return name || symbol || null;
    })
    .filter(Boolean);
  return vals.length ? vals.join(", ") : "n/a";
}

function fetchCountryMeta(iso) {
  if (!iso) return Promise.resolve(null);
  if (restCountryMetaByIso.has(iso)) {
    return Promise.resolve(restCountryMetaByIso.get(iso));
  }
  if (restCountryPendingByIso.has(iso)) {
    return restCountryPendingByIso.get(iso);
  }

  const url =
    `https://restcountries.com/v3.1/alpha/${iso}` +
    "?fields=name,capital,region,subregion,languages,currencies,flags,coatOfArms,population,cca3";

  const req = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`REST Countries error ${res.status}`);
      return res.json();
    })
    .then((payload) => {
      const row = Array.isArray(payload) ? payload[0] : payload;
      if (!row || typeof row !== "object") {
        restCountryMetaByIso.set(iso, { unavailable: true });
        return restCountryMetaByIso.get(iso);
      }
      const meta = {
        unavailable: false,
        nameCommon: row.name && row.name.common ? row.name.common : null,
        flag: row.flag || (row.flags && row.flags.emoji ? row.flags.emoji : ""),
        flagPng: row.flags && row.flags.png ? row.flags.png : null,
        coatPng: row.coatOfArms && row.coatOfArms.png ? row.coatOfArms.png : null,
        capital:
          Array.isArray(row.capital) && row.capital.length ? row.capital[0] : null,
        region: row.region || null,
        subregion: row.subregion || null,
        languages: formatLanguages(row.languages),
        currencies: formatCurrencies(row.currencies),
      };
      restCountryMetaByIso.set(iso, meta);
      return meta;
    })
    .catch(() => {
      const fallback = { unavailable: true };
      restCountryMetaByIso.set(iso, fallback);
      return fallback;
    })
    .finally(() => {
      restCountryPendingByIso.delete(iso);
    });

  restCountryPendingByIso.set(iso, req);
  return req;
}

function getIsoFromFeature(d) {
  const rawIso = (
    d.properties.iso_a3 ||
    d.properties.ISO_A3 ||
    d.id ||
    ""
  ).toUpperCase();
  if (nameByIso.has(rawIso)) return rawIso;

  const geoName = normalizeName(d.properties.name || "");
  const mapped = geoToCsvNameAlias[geoName] || geoName;
  if (isoByNormalizedName.has(mapped)) {
    return isoByNormalizedName.get(mapped);
  }
  return rawIso;
}

function renderEventTimeline() {
  if (!eventsStrip) return;
  const data = historicalEvents
    .filter((e) => availableYears.includes(e.year))
    .sort((a, b) => a.year - b.year);
  const dots = d3
    .select(eventsStrip)
    .selectAll("button.event-dot")
    .data(data, (d) => d.year);

  dots.exit().remove();

  const dotsEnter = dots
    .enter()
    .append("button")
    .attr("type", "button")
    .attr("class", "event-dot")
    .on("click", (_, d) => {
      currentYear = d.year;
      slider.value = currentYear;
      sliderLabel.textContent = currentYear;
      updateFills();
      showCountryPanel();
      updateCountryTrend();
      updateLeaderboard();
      updateTrendYearLine();
      updateEventContext();
    });

  dotsEnter.merge(dots).text((d) => d.year);
}

function updateEventContext() {
  if (!eventDetail) return;
  const candidates = historicalEvents.filter((e) => availableYears.includes(e.year));
  if (!candidates.length) {
    eventDetail.innerHTML =
      '<p class="hint">No historical events are configured for this range.</p>';
    return;
  }

  let nearest = candidates[0];
  let nearestDist = Math.abs(currentYear - nearest.year);
  for (let i = 1; i < candidates.length; i += 1) {
    const dist = Math.abs(currentYear - candidates[i].year);
    if (dist < nearestDist) {
      nearest = candidates[i];
      nearestDist = dist;
    }
  }

  d3.select(eventsStrip)
    .selectAll("button.event-dot")
    .classed("active", (d) => d.year === nearest.year);

  const relation =
    nearest.year === currentYear
      ? "exact year match"
      : `nearest context point (${Math.abs(nearest.year - currentYear)} year${
          Math.abs(nearest.year - currentYear) === 1 ? "" : "s"
        } away)`;

  eventDetail.innerHTML = `
    <p>
      <span class="metric-label">${nearest.year}:</span>
      <span class="metric-secondary"><strong>${nearest.title}</strong> &mdash; ${relation}</span>
    </p>
    <p class="hint">${nearest.description}</p>
    <p>
      <span class="metric-label">Population impact:</span>
      <span class="metric-secondary">${nearest.populationEffect || "n/a"}</span>
    </p>
    <p>
      <span class="metric-label">World context:</span>
      <span class="metric-secondary">${nearest.worldEffect || "n/a"}</span>
    </p>
    <p>
      <span class="metric-label">Explore related countries:</span>
      <span class="event-country-links">
        ${
          Array.isArray(nearest.countries) && nearest.countries.length
            ? nearest.countries
                .map((iso) => {
                  const label = nameByIso.get(iso) || iso;
                  return `<button type="button" class="event-country-link" data-iso="${iso}">${label}</button>`;
                })
                .join("")
            : '<span class="metric-secondary"> n/a</span>'
        }
      </span>
    </p>
  `;

  if (Array.isArray(nearest.countries) && nearest.countries.length) {
    eventDetail.querySelectorAll(".event-country-link").forEach((btn) => {
      btn.addEventListener("click", () => {
        const iso = btn.getAttribute("data-iso");
        if (iso) focusCountryByIso(iso);
      });
    });
  }
}

function focusCountryByIso(iso) {
  if (!iso || !countries) return;
  const feature = countries.find((f) => getIsoFromFeature(f) === iso);
  if (!feature) return;
  selectedIso = iso;
  selectedFeature = feature;
  jumpButton.disabled = false;
  showCountryPanel();
  updateCountryTrend();
  centerOnSelected();
  updateLeaderboard();
}

function redrawGlobe() {
  svg.select(".globe-water").attr("d", path);
  svg.select(".globe-graticule").attr("d", path);
  landGroup.selectAll("path").attr("d", path);
}

// --- Globe fill, tooltip, click ---
function updateFills() {
  if (!countries) return;
  const landPaths = landGroup.selectAll("path");
  landPaths
    .attr("fill", (d) => {
      const iso = getIsoFromFeature(d);
      const gain = getPopulationGainSince1950(iso, currentYear);
      if (gain == null) {
        return "#bfd6f5";
      }
      return colorScale(gain);
    })
    .classed("is-selected", (d) => getIsoFromFeature(d) === selectedIso)
    .on("mousemove", (event, d) => {
      const iso = getIsoFromFeature(d);
      const pop = getPopulation(iso, currentYear);
      const gain = getPopulationGainSince1950(iso, currentYear);
      if (pop == null || pop <= 0 || gain == null) {
        tooltip.style("opacity", 0);
        return;
      }
      const fmt = d3.format(",.0f");
      const name = nameByIso.get(iso) || d.properties.name || iso;
      const world = globalPopByYear.get(currentYear) || null;
      const share =
        world && world > 0 ? ((pop / world) * 100).toFixed(2) : null;
      const gainColor = getLeaderboardValueColor(gain) || "#2a4f7f";

      // Position tooltip relative to the viz container, not the viewport.
      const svgBounds = svg.node().getBoundingClientRect();
      tooltip
        .style("opacity", 1)
        .html(
          `<span class="country">${name}</span><br>` +
            `<span>${currentYear}</span> &middot; ` +
            `<span class="temp">${fmt(pop)} people${
              share ? ` (${share}% of world)` : ""
            }</span><br>` +
            `<span class="temp" style="color:${gainColor}">+${fmt(gain)} people since ${baselineYear}</span>`
        );

      const tooltipNode = tooltip.node();
      const tooltipWidth = tooltipNode ? tooltipNode.offsetWidth : 160;
      const tooltipHeight = tooltipNode ? tooltipNode.offsetHeight : 48;

      let x = event.clientX - svgBounds.left + 14;
      let y = event.clientY - svgBounds.top - 10;
      x = Math.max(8, Math.min(x, svgBounds.width - tooltipWidth - 8));
      y = Math.max(8, Math.min(y, svgBounds.height - tooltipHeight - 8));

      tooltip.style("left", `${x}px`).style("top", `${y}px`);
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
    })
    .on("click", (_, d) => {
      const iso = getIsoFromFeature(d);
      selectedIso = iso;
      selectedFeature = d;
      jumpButton.disabled = false;
      centerOnSelected();
      showCountryPanel();
      updateCountryTrend();
      updateLeaderboard();
    });

  // Keep selected country above neighbors so the highlight is always visible.
  if (selectedIso) {
    landPaths.filter((d) => getIsoFromFeature(d) === selectedIso).raise();
  }
}

// --- Country details panel ---
function showCountryPanel() {
  if (!selectedIso) {
    countryPanelBody.innerHTML =
      '<p class="hint">Click a country to view details.</p>';
    return;
  }
  const iso = selectedIso;
  const fallbackName =
    selectedFeature && selectedFeature.properties && selectedFeature.properties.name
      ? selectedFeature.properties.name
      : iso;
  const name = nameByIso.get(iso) || fallbackName;
  const pop = getPopulation(iso, currentYear);
  const basePop = baseline1950ByIso.get(iso);
  const worldNow = globalPopByYear.get(currentYear) || null;
  const worldBase = d3.sum(
    Array.from(baseline1950ByIso.values()).filter((v) => v != null && v > 0)
  );
  const countryGain = pop != null && basePop != null ? pop - basePop : null;
  const worldGain =
    worldNow != null && worldBase != null ? worldNow - worldBase : null;
  const countryGainColor = getLeaderboardValueColor(countryGain) || "#2a4f7f";
  const worldGainColor = getLeaderboardValueColor(worldGain) || "#2a4f7f";
  const restMeta = restCountryMetaByIso.get(iso) || null;
  const metaLoading =
    !restCountryMetaByIso.has(iso) && restCountryPendingByIso.has(iso);
  const fmt = d3.format(",.0f");

  if (!restCountryMetaByIso.has(iso) && !restCountryPendingByIso.has(iso)) {
    fetchCountryMeta(iso).then(() => {
      if (selectedIso === iso) showCountryPanel();
    });
  }

  if (pop == null) {
    countryPanelBody.innerHTML = `
      <p>
        <span class="country-name">${name}</span> has no population data
        for <span class="metric-secondary">${currentYear}</span> in this dataset.
      </p>
      ${
        metaLoading
          ? '<p><span class="metric-secondary">Loading country profile...</span></p>'
          : ""
      }
    `;
    return;
  }

  countryPanelBody.innerHTML = `
    <p>
      In <span class="metric-secondary">${currentYear}</span>,
      <span class="country-name">${name}</span> had
      <span class="metric-value" style="color:${countryGainColor}">${fmt(pop)} people</span>.
    </p>
    <p>
      <span class="metric-label">Change since ${baselineYear}:</span>
      ${
        basePop == null
          ? '<span class="metric-secondary"> no baseline available.</span>'
          : `
        up <span class="metric-value" style="color:${countryGainColor}">${fmt(pop - basePop)} people</span>
        compared to ${baselineYear}.
      `
      }
    </p>
    <p>
      <span class="metric-label">World change since ${baselineYear}:</span>
      ${
        worldBase == null || worldNow == null
          ? '<span class="metric-secondary"> not available.</span>'
          : `
        world population increased by
        <span class="metric-value" style="color:${worldGainColor}">${fmt(worldNow - worldBase)} people</span>
        over the same period.
      `
      }
    </p>
    <hr style="border:0;border-top:1px solid rgba(120,150,200,0.25);margin:8px 0;" />
    ${
      restMeta && !restMeta.unavailable
        ? `
      ${
        restMeta.flagPng || restMeta.coatPng
          ? `
      <div class="country-images">
        ${
          restMeta.flagPng
            ? `<img class="country-thumb" src="${restMeta.flagPng}" alt="${restMeta.nameCommon || name} flag" />`
            : ""
        }
        ${
          restMeta.coatPng
            ? `<img class="country-thumb" src="${restMeta.coatPng}" alt="${restMeta.nameCommon || name} emblem" />`
            : ""
        }
      </div>
      `
          : ""
      }
      <p>
        <span class="metric-label">Country profile (REST Countries):</span>
        <span class="metric-secondary">${restMeta.flag || ""} ${restMeta.nameCommon || name}</span>
      </p>
      <p>
        <span class="metric-label">Capital:</span>
        <span class="metric-secondary">${restMeta.capital || "n/a"}</span>
        &nbsp;|&nbsp;
        <span class="metric-label">Region:</span>
        <span class="metric-secondary">${restMeta.region || "n/a"}${restMeta.subregion ? ` (${restMeta.subregion})` : ""}</span>
      </p>
      <p>
        <span class="metric-label">Languages:</span>
        <span class="metric-secondary">${restMeta.languages}</span>
      </p>
      <p>
        <span class="metric-label">Currencies:</span>
        <span class="metric-secondary">${restMeta.currencies}</span>
      </p>
    `
        : metaLoading
          ? `<p><span class="metric-secondary">Loading country profile...</span></p>`
          : `<p><span class="metric-secondary">Country profile unavailable from REST Countries.</span></p>`
    }
  `;
}

// --- Leaderboard ---
function updateLeaderboard() {
  if (!availableYears.length) return;
  const year = currentYear;
  const records = [];
  const worldBase = d3.sum(
    Array.from(baseline1950ByIso.values()).filter((v) => v != null && v > 0)
  );
  const worldNow = globalPopByYear.get(year) || null;
  const worldGrowth =
    worldNow != null && worldBase > 0 ? worldNow - worldBase : null;

  popByIsoYear.forEach((pop, key) => {
    const [iso, yStr] = key.split("-");
    const y = +yStr;
    if (y !== year) return;
    if (pop == null || pop <= 0) return;
    if (!nameByIso.has(iso)) return;
    const basePop = baseline1950ByIso.get(iso);
    if (basePop == null || basePop <= 0) return;
    const deltaAbs = pop - basePop;
    const shareOfGlobalGrowth =
      worldGrowth == null || worldGrowth === 0
        ? null
        : (deltaAbs / worldGrowth) * 100;
    records.push({
      iso,
      pop,
      name: nameByIso.get(iso),
      deltaAbs,
      shareOfGlobalGrowth,
    });
  });

  records.sort((a, b) => d3.descending(a.deltaAbs, b.deltaAbs));
  const top = records.slice(0, 5);

  if (!top.length) {
    leaderboardBody.innerHTML =
      '<p class="hint">No population data available for this year.</p>';
    previousRankByIso = new Map();
    previousYByIso = new Map();
    return;
  }

  const container = d3
    .select(leaderboardBody)
    .selectAll(".leaderboard-list")
    .data([null]);

  const containerEnter = container
    .enter()
    .append("div")
    .attr("class", "leaderboard-list");

  const list = containerEnter.merge(container);

  const rows = list
    .selectAll(".leader-row")
    .data(top, (d) => d.iso);

  rows
    .exit()
    .transition()
    .duration(220)
    .style("opacity", 0)
    .remove();

  const rowsEnter = rows
    .enter()
    .append("div")
    .attr("class", "leader-row")
    .style("opacity", 0);

  const merged = rowsEnter.merge(rows);
  merged.order(); // force DOM order to match current rank order

  merged
    .classed("selected", (d) => d.iso === selectedIso)
    .html((d, i) => {
      const currentRank = i + 1;
      return `
        <span class="leader-rank">${currentRank}.</span>
        <span class="leader-name">${d.name}</span>
        <span class="leader-value" style="color:${getLeaderboardValueColor(d.deltaAbs) || "#2a4f7f"}">+${d3.format(",.0f")(d.deltaAbs)} (${d.shareOfGlobalGrowth == null ? "n/a" : `${d3.format(".1f")(d.shareOfGlobalGrowth)}%`})</span>
      `;
    })
    .each(function (d, i) {
      const currentRank = i + 1;
      const prevRank = previousRankByIso.get(d.iso);
      const deltaRank = prevRank == null ? 0 : prevRank - currentRank;
      const rowHeight = 34;
      d3.select(this).style("transform", `translateY(${deltaRank * rowHeight}px)`);
    })
    .on("click", (_, d) => {
      focusCountryByIso(d.iso);
    });

  requestAnimationFrame(() => {
    merged
      .transition()
      .duration(450)
      .style("transform", "translateY(0px)")
      .style("opacity", 1);
  });

  // save rank/position for next update so movement can animate
  previousRankByIso = new Map(top.map((d, i) => [d.iso, i + 1]));
  previousYByIso = new Map(top.map((d, i) => [d.iso, i * 34]));
}

// --- Center globe on selected country ---
function centerOnSelected() {
  if (!selectedFeature) return;
  const centroid = d3.geoCentroid(selectedFeature);
  if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return;
  const [lon, lat] = centroid;
  projection.rotate([-lon, -lat]);
  redrawGlobe();
  updateFills();
}

jumpButton.addEventListener("click", centerOnSelected);

// --- Slider & playback controls ---
slider.addEventListener("input", (e) => {
  currentYear = +e.target.value;
  sliderLabel.textContent = currentYear;
  updateFills();
  showCountryPanel();
  updateCountryTrend();
  updateLeaderboard();
  updateTrendYearLine();
  updateEventContext();
});

speedSlider.addEventListener("input", (e) => {
  currentSpeed = parseInt(e.target.value, 10);
  if (![1, 2, 3].includes(currentSpeed)) currentSpeed = 1;
  speedLabel.textContent = `${currentSpeed}×`;
  if (animationTimer) {
    startAnimation(); // restart with new speed
  }
});

playButton.addEventListener("click", () => {
  if (animationTimer) {
    stopAnimation();
  } else {
    startAnimation();
  }
});

spinButton.addEventListener("click", () => {
  if (spinTimer) {
    stopSpin();
  } else {
    startSpin();
  }
});

function startAnimation() {
  playButton.textContent = "Pause";
  playButton.classList.remove("paused");

  const minYear = d3.min(availableYears);
  const maxYear = d3.max(availableYears);
  if (animationTimer) animationTimer.stop();

  const intervalMs = Math.max(80, 1000 / currentSpeed);

  animationTimer = d3.interval(() => {
    if (currentYear >= maxYear) {
      currentYear = minYear;
    } else {
      currentYear += 1;
    }
    slider.value = currentYear;
    sliderLabel.textContent = currentYear;
    updateFills();
    showCountryPanel();
    updateCountryTrend();
    updateLeaderboard();
    updateTrendYearLine();
    updateEventContext();
  }, intervalMs);
}

function stopAnimation() {
  playButton.textContent = "Play timeline";
  playButton.classList.add("paused");
  if (animationTimer) {
    animationTimer.stop();
    animationTimer = null;
  }
}

function startSpin() {
  spinButton.textContent = "Stop spin";
  spinButton.classList.remove("paused");
  if (spinTimer) spinTimer.stop();

  let lastTime = Date.now();
  spinTimer = d3.timer(() => {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    const rotate = projection.rotate();
    projection.rotate([rotate[0] + spinSpeedDegPerSec * dt, rotate[1], rotate[2]]);
    redrawGlobe();
  });
}

function stopSpin() {
  spinButton.textContent = "Spin globe";
  spinButton.classList.add("paused");
  if (spinTimer) {
    spinTimer.stop();
    spinTimer = null;
  }
}

// --- Drag to rotate globe ---
const drag = d3
  .drag()
  .on("start", () => {
    // Manual interaction should take priority over auto-spin.
    if (spinTimer) stopSpin();
  })
  .on("drag", (event) => {
    const rotate = projection.rotate();
    const k = 0.25;
    const newRotate = [
      rotate[0] + event.dx * k,
      rotate[1] - event.dy * k,
      rotate[2],
    ];
    projection.rotate(newRotate);
    redrawGlobe();
  });

svg.call(drag);

// --- Data loading: World Bank CSV + GeoJSON ---
Promise.all([
  d3.csv("API_SP.POP.TOTL_DS2_en_csv_v2_2763937.csv", d3.autoType),
  d3.json(
    "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"
  ),
]).then(([rows, world]) => {
  countries = world.features;

  // iso set from map
  const isoSet = new Set(
    countries.map((f) =>
      (f.properties.iso_a3 || f.properties.ISO_A3 || f.id || "").toUpperCase()
    )
  );

  // year columns (1960..2020)
  const yearCols = Object.keys(rows[0]).filter((k) =>
    /^\d{4}$/.test(k)
  );
  const years = yearCols.map((y) => +y).sort((a, b) => a - b);
  availableYears = years;

  slider.min = years[0];
  slider.max = years[years.length - 1];
  currentYear = years[0];
  slider.value = currentYear;
  sliderLabel.textContent = currentYear;

  // accumulate populations
  rows.forEach((row) => {
    const iso = (row["Country Code"] || "").toUpperCase();
    const name = row["Country Name"];
    if (!isoSet.has(iso)) return; // skip aggregates like "World", regions, etc.
    nameByIso.set(iso, name);
    isoByNormalizedName.set(normalizeName(name), iso);
    years.forEach((year) => {
      const pop = row[year];
      if (!isFinite(pop) || pop <= 0) return;
      const key = keyIsoYear(iso, year);
      popByIsoYear.set(key, pop);
      const gVal = globalPopByYear.get(year) || 0;
      globalPopByYear.set(year, gVal + pop);
    });
  });

  // Estimate 1950 baseline using 1960 and 1961 growth when available.
  nameByIso.forEach((_, iso) => {
    const pop60 = getPopulation(iso, 1960);
    const pop61 = getPopulation(iso, 1961);
    if (pop60 == null || pop60 <= 0) return;

    let base50 = pop60;
    if (pop61 != null && pop61 > 0) {
      let growth = pop61 / pop60 - 1;
      growth = Math.max(-0.1, Math.min(0.1, growth));
      base50 = pop60 / Math.pow(1 + growth, 10);
    }
    baseline1950ByIso.set(iso, base50);
  });

  // draw land
  landGroup
    .selectAll("path")
    .data(countries)
    .enter()
    .append("path")
    .attr("class", "globe-land")
    .attr("d", path);

  initLegend();
  buildGlobalTrend();
  renderEventTimeline();
  updateFills();
  updateLeaderboard();
  showCountryPanel();
  updateEventContext();
});


