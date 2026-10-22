# Chapoli Dam 3D

Interactive 3D digital twin of **Chapoli M.I. Tank** (Canacona, South Goa, India). It shows the terrain, the earthen dam, reservoir water depth and monthly silt, all from survey and satellite data, in the browser.

## Features

- **3D terrain and dam**: DTM ground model, 760 m earthen dam, trees, adjustable height scale.
- **Satellite water and depth**: Sentinel-1 permanent water extent, shaded blue by Sentinel-2 relative depth (6.5–20 m), with a moving water surface.
- **What-if water level**: drag a slider from the deepest bed (15.5 m) to the dam top (41 m) to see the area and volume of stored water.
- **Silt monitoring**: Sentinel-2 silt classes (Low / Moderate / High / Very High) and silt amount for each month of 2026, drawn as a solid deposit layer.
- **Cross-section**: one-click cut through the reservoir showing earth, the silt band and the water column.
- **Live sky**: current temperature, wind, clouds and rain from Open-Meteo, plus the real sun position.
- **Point inspector**: click anywhere for coordinates, elevation and water depth.
- **Dam profile and silt report**: dam cross-section with key heights, and a month-by-month silt chart.

## Tech stack

React 19 · TypeScript · Vite 6 · Three.js · Python (data preparation)

## Getting started

Requirements: Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173.

Production build:

```bash
npm run build
npm run preview
```

## Project structure

```
data_raw/            Source data (DTM, KML boundary and contours, satellite KMZ/KML)
scripts/             Python scripts that turn raw data into app data
src/
  components/
    Scene3D/         Three.js layers (terrain, dam, water, silt, sky, weather)
    Dashboard/       UI panels, controls and popups
  data/              Generated JSON used by the app
  types/             TypeScript types
  utils/             Coordinates, analysis, live weather
public/raw_data/     Raw files served to the browser
```

## Updating the data

The app reads pre-generated JSON from `src/data/`. Regenerate it after replacing files in `data_raw/` (requires Python 3 with `numpy`, `Pillow` and `pyproj`):

| Script | Input | Output |
|---|---|---|
| `scripts/process_data.py` | DTM, tank boundary, contours | `src/data/chapoli_data.json` |
| `scripts/process_silt_data.py` | `data_raw/silt_volume/*.kmz` | `src/data/silt_series.json` |
| `scripts/process_water_depth.py` | `data_raw/permanent_water.kml`, `data_raw/depth.kml` | `src/data/water_depth.json` |

Run them from the project root, for example:

```bash
python scripts/process_silt_data.py
```

## URL options

Preview a weather state while keeping the live temperature and wind:

- `?weather=rain`
- `?weather=cloudy`
- `?weather=clear`

## Data sources

- Dam and reservoir specifications: [Goa Water Resources Department](https://goawrd.gov.in/project/chapoli-mi-tank)
- Water level: Goa WRD gauge readings
- Water extent: Sentinel-1 SAR · Depth and silt: Sentinel-2
- Weather: [Open-Meteo](https://open-meteo.com/) (free for non-commercial use)

## Notes

- Satellite depth and silt values are **relative estimates**, not survey-grade measurements.
- Height and depth exaggeration are for display only. Readouts and calculations use real metres.
