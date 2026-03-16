// --- DOM references ---
const svg = d3.select("#temp-chart");
const tooltip = d3.select("#tooltip");
const slider = document.getElementById("year-slider");
const sliderLabel = document.getElementById("year-label");
const playButton = document.getElementById("play-button");
const speedSlider = document.getElementById("speed-slider");
const speedLabel = document.getElementById("speed-label");
const countryPanelBody = document.getElementById("country-panel-body");
const jumpButton = document.getElementById("jump-button");
const trendSvg = d3.select("#trend-chart");
const leaderboardBody = document.getElementById("leaderboard-body");

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
let currentYear = 1960;
let currentSpeed = 1; // years per second

// population lookup: key "ISO-1960" -> pop
const popByIsoYear = new Map();
const nameByIso = new Map();
const globalPopByYear = new Map();
const isoByNormalizedName = new Map();
const baseline1950ByIso = new Map();
let availableYears = [];

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

function redrawGlobe() {
  svg.select(".globe-water").attr("d", path);
  svg.select(".globe-graticule").attr("d", path);
  landGroup.selectAll("path").attr("d", path);
}

// --- Globe fill, tooltip, click ---
function updateFills() {
  if (!countries) return;
  landGroup
    .selectAll("path")
    .attr("fill", (d) => {
      const iso = getIsoFromFeature(d);
      const gain = getPopulationGainSince1950(iso, currentYear);
      if (gain == null) {
        return "#bfd6f5";
      }
      return colorScale(gain);
    })
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
      tooltip
        .style("opacity", 1)
        .html(
          `<span class="country">${name}</span><br>` +
            `<span>${currentYear}</span> &middot; ` +
            `<span class="temp">${fmt(pop)} people${
              share ? ` (${share}% of world)` : ""
            }</span><br>` +
            `<span class="temp" style="color:${gainColor}">+${fmt(gain)} people since ${baselineYear}</span>`
        )
        .style("left", `${event.clientX + 14}px`)
        .style("top", `${event.clientY - 10}px`);
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
  const fmt = d3.format(",.0f");

  if (pop == null) {
    countryPanelBody.innerHTML = `
      <p>
        <span class="country-name">${name}</span> has no population data
        for <span class="metric-secondary">${currentYear}</span> in this dataset.
      </p>
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
      const prevRank = previousRankByIso.get(d.iso);
      let deltaHtml = '<span class="rank-delta rank-same">--</span>';
      if (prevRank != null) {
        const delta = prevRank - currentRank;
        if (delta > 0) {
          deltaHtml = `<span class="rank-delta rank-up">+${delta}</span>`;
        } else if (delta < 0) {
          deltaHtml = `<span class="rank-delta rank-down">${delta}</span>`;
        } else {
          deltaHtml = '<span class="rank-delta rank-same">0</span>';
        }
      }
      return `
        <span class="leader-rank">${currentRank}.</span>
        <span class="leader-name">${d.name}</span>
        <span class="leader-value" style="color:${getLeaderboardValueColor(d.deltaAbs) || "#2a4f7f"}">+${d3.format(",.0f")(d.deltaAbs)} (${d.shareOfGlobalGrowth == null ? "n/a" : `${d3.format(".1f")(d.shareOfGlobalGrowth)}%`})</span>
        ${deltaHtml}
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
      const iso = d.iso;
      const feature = countries.find((f) => getIsoFromFeature(f) === iso);
      if (!feature) return;
      selectedIso = iso;
      selectedFeature = feature;
      jumpButton.disabled = false;
      showCountryPanel();
      updateCountryTrend();
      centerOnSelected();
      updateLeaderboard();
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

// --- Drag to rotate globe ---
const drag = d3
  .drag()
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
  updateFills();
  updateLeaderboard();
  showCountryPanel();
});


