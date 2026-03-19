# Global Population Globe (CSC316 A3)

Interactive D3 visualization for exploring country population growth over time with geographic context, animation, and lightweight storytelling.

## Overview

The visualization combines an orthographic globe with coordinated controls and narrative context:

- Country color encodes **absolute population gained since 1950**
- Year controls: slider + play/pause animation + speed (`1x`, `2x`, `3x`)
- Optional **auto-spin** globe toggle
- Hover tooltip with population and gain details
- Click-to-select + auto-center country
- Top 5 leaderboard by absolute growth (plus share of world growth)
- Country details panel with:
  - population metrics
  - REST Countries profile metadata
  - flag / coat-of-arms images (when available)
- Historical context timeline with important events and linked country jump buttons

## Data Sources

- Primary dataset attribution (project source):  
  [Kaggle - Historical Worldwide Countries Population](https://www.kaggle.com/datasets/aliaamiri/historical-worldwide-countries-population)
- Population CSV used in app: `API_SP.POP.TOTL_DS2_en_csv_v2_2763937.csv` (World Bank indicator `SP.POP.TOTL`)
- World geometry: GeoJSON from the D3 Graph Gallery world dataset
- Country metadata API: [REST Countries v3.1](https://restcountries.com/)

## Interaction Summary

- **Drag globe** to rotate manually.
- **Spin globe** button toggles automatic rotation.
- **Hover country** to view details-on-demand tooltip.
- **Click country** to select, center, and update detail panels.
- **Adjust year slider** for direct temporal querying.
- **Play timeline** to animate year-by-year changes.
- **Click leaderboard rows** to jump to high-growth countries.
- **Click timeline event years/country chips** to navigate historical context.

## Implementation Notes (D3 Best Practices)

- Uses `Map`-based keyed lookups for efficient country-year queries.
- Uses `d3.autoType` for robust CSV numeric parsing.
- Uses D3 join pattern for dynamic/animated leaderboard rendering.
- Keeps logic modular (`updateFills`, `showCountryPanel`, `updateLeaderboard`, `updateEventContext`, etc.).
- Uses capped quantile-based color scaling for readability across large value ranges.
- Uses lightweight client-side caching for REST Countries API responses.

## Baseline Note

Population growth is measured relative to **1950**.  
Because the available population table starts at `1960`, a 1950 baseline is estimated from early-year growth (`1960 -> 1961`) for consistent comparison.

## Run Locally

```bash
python3 -m http.server 8000
```

Open: [http://localhost:8000](http://localhost:8000)

## Deployment (GitHub Pages)

This repo includes `.github/workflows/deploy-pages.yml` to deploy static files to GitHub Pages via GitHub Actions.

- Trigger: push to `main` or manual workflow run
- Output URL format: `https://<account>.github.io/<repo>/`

## Disclaimer

AI assistance was used for code cleanup, UI polish, and D3 best-practice guidance.  
Final feature decisions, integration, and validation were completed by the project author.
