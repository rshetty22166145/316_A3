# CSC316 A3 Write-Up: Global Population Increase Globe

## 1) Project Goal and Dataset

This interactive visualization helps viewers explore how country populations changed over time, with a focus on **absolute population increase since 1950**. The goal is to support fast comparison across countries and years while still allowing details-on-demand for specific countries.

Dataset source (as requested):  
[Kaggle: Historical Worldwide Countries Population](https://www.kaggle.com/datasets/aliaamiri/historical-worldwide-countries-population)

The implementation uses the population CSV included in this repository and world geometry data for country boundaries.

## 2) Design Rationale

### Visual Encoding Choices

- **Orthographic globe map** was chosen because the dataset is geographically distributed and country-level comparisons benefit from spatial context.
- **Country color** encodes population gain since 1950, using a capped color domain to prevent extreme outliers from flattening the rest of the scale.
- A **legend** is shown directly under the globe to explain the color mapping.
- A **Top 5 leaderboard** provides a clear ranking for high-growth countries in the selected year.

Alternatives considered:
- A line chart for many countries was considered early, but it became visually dense and weaker for geographic exploration.

### Interaction and Animation Choices

- **Drag-to-rotate globe** enables geographic exploration and supports countries not visible in the default view.
- **Hover tooltip** provides details-on-demand (country, year, population, and gain since 1950).
- **Click-to-select country** updates the details panel and automatically centers the globe on that country.
- **Year slider + play/pause + speed control** supports both direct querying and animated temporal exploration.
- **Animated leaderboard updates** help communicate rank changes over time.

Why these interactions:
- They combine low-friction exploration (hover, drag) with deliberate analysis (click, year controls).
- Animation supports trend discovery, while static selection supports detailed reading.

## 3) Development Process

### Workflow

Development proceeded iteratively:
1. Basic map rendering and data loading.
2. Year controls and color updates by year.
3. Click/hover interactions and detail panels.
4. Ranking panel with animated transitions.
5. Visual design polish (layout, typography, color harmonization, compact view).
6. Deployment pipeline setup for GitHub Pages.

### Technical Decisions

- Used `Map`-based lookups (`country + year`) for fast updates.
- Used `d3.autoType` to ensure numeric parsing of CSV fields.
- Used D3 data joins for clean leaderboard enter/update/exit transitions.
- Estimated 1950 baselines from early-year growth because the working CSV begins in 1960.


Most time-consuming tasks:
- aligning country identifiers between geometry and data,
- ensuring robust parsing/filtering and valid numeric handling,
- tuning visual scale/domain so color differences remain readable.

## 4) LLM / AI Usage Disclosure

AI tools were used to assist with:
- code cleanup and refactoring,
- interaction implementation ideas,
- D3.js best-practice patterns,
- UI/UX styling polish,
- deployment workflow setup

All final integration decisions, debugging checks, and feature-level adjustments were reviewed and finalized by me.

