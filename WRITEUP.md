# CSC316 A3 Write-Up: Global Population Increase Globe

## 1) Project Goal and Dataset

This project explores how country populations changed over time, with a primary measure of **absolute population increase since 1950**. The visualization is designed for both quick scanning (ranking and color overview) and deeper inspection (country details, contextual events, and metadata).

Dataset source (project attribution):  
[Kaggle: Historical Worldwide Countries Population](https://www.kaggle.com/datasets/aliaamiri/historical-worldwide-countries-population)

Implementation data assets:
- Country population table (`SP.POP.TOTL`) stored locally in CSV form.
- Country boundary geometry from a public world GeoJSON source.
- Country profile metadata (capital, region, languages, currencies, flags) from REST Countries v3.1.

## 2) Design Rationale

### Visual Encodings

- **Orthographic globe**: preserves geographic context and supports region-based comparison.
- **Choropleth color**: maps country growth since 1950 to a capped scale to avoid outlier domination.
- **Legend**: explains scale directly below the globe.
- **Top 5 leaderboard**: surfaces largest contributors quickly and complements the map.

I initially considered a dense multi-line chart, but the globe + leaderboard combination better balanced geographic context with ranking clarity.

### Interaction and Animation

- **Drag rotation** and **optional spin mode** support full-world exploration.
- **Hover tooltip** gives details-on-demand.
- **Click country** selects, highlights, and auto-centers the map.
- **Year slider + play/pause + speed control** support dynamic query and animated trend exploration.
- **Timeline context panel** adds event-based storytelling with year markers.
- **Linked country chips in events** connect narrative context to direct map interaction.

These interactions were chosen to combine exploratory analysis with guided narrative cues in a single interface.

## 3) Storytelling Layer

To strengthen narrative quality, I added a historical context timeline above the main view. For each highlighted event, the interface provides:
- short historical description,
- likely population-growth effect,
- world-level context,
- related country links that jump and center the globe.

This turns the visualization from a pure dashboard into an explorable explanation that connects data patterns to major global events.

## 4) Development Process

### Workflow

1. Built base globe rendering and data loading.
2. Added temporal controls and color updates.
3. Added tooltip, click selection, and country detail panel.
4. Added Top 5 leaderboard with transitions.
5. Added REST Countries metadata + flag/emblem media.
6. Added historical event timeline and linked interactions.
7. Polished UI and deployed using GitHub Pages pipeline.

### Technical Decisions

- `Map`-based lookup structures for responsive country-year queries.
- `d3.autoType` for reliable CSV parsing.
- D3 data join pattern for dynamic list rendering.
- Cached API responses to avoid repeated REST Countries fetches.
- Estimated 1950 baseline (dataset begins in 1960) using early growth extrapolation.

Most time was spent on country-name/code alignment, data consistency checks, and tuning visual scales for readability.

## 5) AI Usage Disclosure

AI assistance was used for:
- D3 implementation patterns and refactoring support,
- UI/interaction design iteration,
- debugging and deployment workflow setup,
- code and documentation cleanup.

Final implementation decisions, feature selection, and validation were completed by the author.

## 6) Sources

- Kaggle dataset page:  
  [Historical Worldwide Countries Population](https://www.kaggle.com/datasets/aliaamiri/historical-worldwide-countries-population)
- D3.js: [https://d3js.org/](https://d3js.org/)
- REST Countries API: [https://restcountries.com/](https://restcountries.com/)

