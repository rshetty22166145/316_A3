# Global Population Globe (CSC316 A3)

Interactive D3 visualization of country-level population change over time on an orthographic globe.

## Overview

This project visualizes World Bank population data (`1960-2020`) with:
- A draggable, clickable globe (`D3 geoOrthographic`)
- Year simulation with play/pause controls
- Playback speed control (`1x`, `2x`, `3x`)
- Country tooltip and details-on-demand panel
- Dynamic Top 5 leaderboard by absolute population gain
- Color encoding based on **population gained since 1950**

## Data Sources

- Population CSV: `API_SP.POP.TOTL_DS2_en_csv_v2_2763937.csv`
  - World Bank indicator: `SP.POP.TOTL`
- World geometry: GeoJSON from the D3 Graph Gallery world dataset

## Interaction Summary

- **Drag globe** to rotate.
- **Hover country** to see population and gain since 1950.
- **Click country** to:
  - select it,
  - auto-center the globe on it,
  - update the details panel.
- **Adjust year slider** for a specific year.
- **Play timeline** to animate year progression.
- **Use leaderboard rows** to jump to and center a country.

## Implementation Notes (D3 Best Practices)

- Uses `Map`-based keyed lookups for fast `country-year` retrieval.
- Uses `d3.autoType` for robust numeric CSV parsing.
- Uses D3 data join/update pattern for the animated leaderboard.
- Keeps rendering and interaction logic separated by function (`updateFills`, `showCountryPanel`, `updateLeaderboard`, etc.).
- Uses quantile-capped color domain for more readable visual contrast.

## Baseline Note

The visualization colors and growth metrics are defined relative to **1950**.  
Because the provided population dataset starts at `1960`, a 1950 country baseline is estimated from early-year growth (1960->1961) for consistency.

## Run Locally

Use any local static server from this folder. Example:

```bash
python3 -m http.server 8000
```

Then open: [http://localhost:8000](http://localhost:8000)

## Disclaimer

AI assistance was used to help clean up code structure, improve UI polish, and apply D3 visualization best practices.  
