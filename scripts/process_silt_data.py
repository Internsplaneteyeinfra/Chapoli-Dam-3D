"""
Process the monthly Silt Classification + Silt Volume Surface KMZ pairs in
data_raw/silt_volume/ (the "_smooth" exports) into src/data/silt_series.json.

Each KMZ holds a doc.kml (metadata + LatLonBox) and an anti-aliased overlay.png.
Because the overlays are smoothed (feathered alpha, blended colours), pixels are
classified by nearest palette colour rather than exact RGB matches, and the
volume ramp is inverted against the YlOrBr colormap then calibrated so the mean
score over water pixels equals the "Mean silt score" stated in the KML, and the
~10 m grid is finally scaled so sum(thickness x cell area) equals the reported
total relative volume (volume = score x pixel area x 1.0 m assumed thickness).
"""

import zipfile
import glob
import os
import re
import json
import base64
from io import BytesIO
from PIL import Image
import numpy as np
import pyproj

SILT_DIR = 'data_raw/silt_volume'
OUT_FILE = 'src/data/silt_series.json'

# Same scene origin used by process_data.py for the local coordinate frame
ORIGIN = {'x': 397766.33, 'y': 1661280.76}

# Overlay pixels below this alpha are feathered edges, not water
ALPHA_VALID = 128

# Output grid cell ~10 m (Sentinel-2 native) => downsample overlay by this factor
GRID_FACTOR = 4

# Volume scale shared across months (m3 per 10 m pixel at 1.0 m layer thickness)
VOL_MAX = 96.58
VOL_MID = 48.29

CLASS_PALETTE = np.array([
    [0, 255, 0],     # 1 Low
    [255, 255, 0],   # 2 Moderate
    [255, 165, 0],   # 3 High
    [255, 0, 0],     # 4 Very High
], dtype=float)

# matplotlib YlOrBr stops - the overlay colours fit this far better than the
# 3-stop legend written in the KML description
YLORBR = ['ffffe5', 'fff7bc', 'fee391', 'fec44f', 'fe9929', 'ec7014', 'cc4c02', '993404', '662506']

MONTHS = [
    ('jan', 'January', '01'), ('feb', 'February', '02'), ('mar', 'March', '03'),
    ('apr', 'April', '04'), ('may', 'May', '05'), ('jun', 'June', '06'),
    ('jul', 'July', '07'), ('aug', 'August', '08'), ('sep', 'September', '09'),
    ('oct', 'October', '10'), ('nov', 'November', '11'), ('dec', 'December', '12'),
]
MONSOON = {'jun', 'jul', 'aug', 'sep'}


def build_ramp(n=256):
    stops = np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)] for h in YLORBR], dtype=float)
    t = np.linspace(0.0, 1.0, n)
    seg = len(stops) - 1
    idx = np.minimum((t * seg).astype(int), seg - 1)
    frac = (t * seg - idx)[:, None]
    return t, stops[idx] * (1 - frac) + stops[idx + 1] * frac


RAMP_T, RAMP_RGB = build_ramp()


def read_kmz(path):
    with zipfile.ZipFile(path, 'r') as z:
        kml_name = next(n for n in z.namelist() if n.lower().endswith('.kml'))
        kml = z.read(kml_name).decode('utf-8', errors='ignore')
        href = re.search(r'<href>\s*([^<]+?)\s*</href>', kml).group(1)
        if href.startswith('data:'):
            png_bytes = base64.b64decode(href.split('base64,', 1)[1])
        else:
            png_bytes = z.read(href)
    box = {k: float(re.search(rf'<{k}>([-\d\.]+)</{k}>', kml).group(1)) for k in ('north', 'south', 'east', 'west')}
    return kml, png_bytes, box


def find_float(pattern, text, default=0.0):
    m = re.search(pattern, text)
    return float(m.group(1)) if m else default


def block_reduce(arr, factor, fn):
    h, w = arr.shape[:2]
    gh, gw = h // factor, w // factor
    blocks = arr[:gh * factor, :gw * factor].reshape(gh, factor, gw, factor, *arr.shape[2:])
    return fn(blocks.swapaxes(1, 2).reshape(gh, gw, factor * factor, *arr.shape[2:]))


def classify(rgba):
    valid = rgba[:, :, 3] >= ALPHA_VALID
    rgb = rgba[:, :, :3].astype(float)
    dist = ((rgb[:, :, None, :] - CLASS_PALETTE[None, None, :, :]) ** 2).sum(-1)
    classes = np.where(valid, dist.argmin(-1) + 1, 0)
    return classes, valid


def invert_volume(rgba):
    valid = rgba[:, :, 3] >= ALPHA_VALID
    px = rgba[valid][:, :3].astype(float)
    dist = ((px[:, None, :] - RAMP_RGB[None, :, :]) ** 2).sum(-1)
    t = np.zeros(rgba.shape[:2], dtype=float)
    t[valid] = RAMP_T[dist.argmin(1)]
    return t, valid


def main():
    if not os.path.isdir(SILT_DIR):
        print(f"Directory {SILT_DIR} not found!")
        return

    t_to_43 = pyproj.Transformer.from_crs('EPSG:4326', 'EPSG:32643', always_xy=True).transform

    months_data = {}
    chart_series = []
    bbox_info = None

    for key, name, num in MONTHS:
        clf_matches = glob.glob(os.path.join(SILT_DIR, f'Silt Classification*{name}*.kmz'))
        vol_matches = glob.glob(os.path.join(SILT_DIR, f'Silt Volume Surface*{name}*.kmz'))
        if not clf_matches or not vol_matches:
            continue

        kml_c, png_c, box = read_kmz(clf_matches[0])
        kml_v, png_v, _ = read_kmz(vol_matches[0])

        if bbox_info is None:
            x_min, y_min = t_to_43(box['west'], box['south'])
            x_max, y_max = t_to_43(box['east'], box['north'])
            lx_min = round(float(x_min - ORIGIN['x']), 2)
            lx_max = round(float(x_max - ORIGIN['x']), 2)
            lz_min = round(float(-(y_max - ORIGIN['y'])), 2)
            lz_max = round(float(-(y_min - ORIGIN['y'])), 2)
            bbox_info = {
                'wgs84': box,
                'utm43n': {
                    'minEasting': round(x_min, 2), 'maxEasting': round(x_max, 2),
                    'minNorthing': round(y_min, 2), 'maxNorthing': round(y_max, 2)
                },
                'local': {
                    'minX': lx_min, 'maxX': lx_max, 'minZ': lz_min, 'maxZ': lz_max,
                    'width': round(lx_max - lx_min, 2), 'depth': round(lz_max - lz_min, 2)
                }
            }

        water_area = find_float(r'Water area:\s*([\d\.]+)\s*ha', kml_c)
        mean_score = find_float(r'Mean silt score:\s*([\d\.]+)', kml_c)
        p5 = find_float(r'P5=([-\d\.]+)', kml_c)
        p95 = find_float(r'P95=([-\d\.]+)', kml_c)
        total_vol = find_float(r'Total relative silt volume:\s*([\d\.]+)', kml_v)

        rgba_c = np.array(Image.open(BytesIO(png_c)).convert('RGBA'))
        rgba_v = np.array(Image.open(BytesIO(png_v)).convert('RGBA'))

        # Classification: full-res class % of water area, ~10 m grid by majority vote
        classes, valid_c = classify(rgba_c)
        n_valid = int(valid_c.sum())
        counts = [int((classes == c).sum()) for c in (1, 2, 3, 4)]
        pcts = [round(c / n_valid * 100, 1) if n_valid else 0.0 for c in counts]

        def majority(blocks):
            votes = np.stack([(blocks == c).sum(-1) for c in range(5)], -1)
            water = votes[..., 1:].sum(-1)
            winner = votes[..., 1:].argmax(-1) + 1
            return np.where(water * 2 >= blocks.shape[-1], winner, 0)

        class_grid = block_reduce(classes, GRID_FACTOR, majority)

        # Volume: colour -> ramp position -> score, calibrated to the reported mean score
        t_full, valid_v = invert_volume(rgba_v)
        raw_mean = float(t_full[valid_v].mean()) if valid_v.any() else 0.0
        score_scale = (mean_score / raw_mean) if raw_mean > 0 else 0.0
        score_full = np.clip(t_full * score_scale, 0.0, VOL_MAX / 100.0)

        def masked_mean(blocks):
            return blocks.sum(-1) / np.maximum((blocks > 0).sum(-1), 1)

        # thickness (m) == silt score, since volume assumes a 1.0 m layer
        thickness_grid = np.where(class_grid > 0, block_reduce(score_full, GRID_FACTOR, masked_mean), 0.0)

        grid_h, grid_w = class_grid.shape
        local = bbox_info['local']
        cell_area = (local['width'] / grid_w) * (local['depth'] / grid_h)
        raw_grid_vol = float((thickness_grid * cell_area).sum())

        # Overlay water footprint differs slightly from the reported water area;
        # pin the grid to the reported total so sampled thicknesses sum to it
        if raw_grid_vol > 0 and total_vol > 0:
            thickness_grid = thickness_grid * (total_vol / raw_grid_vol)
        grid_vol = float((thickness_grid * cell_area).sum())

        month_record = {
            'key': key,
            'name': name,
            'monthNumber': num,
            'year': 2026,
            'dateLabel': f"{name} 2026",
            'waterAreaHa': water_area,
            'meanSiltScore': mean_score,
            'sedimentIndexP5': p5,
            'sedimentIndexP95': p95,
            'totalSiltVolumeM3': total_vol,
            'totalSiltVolumeMCM': round(total_vol / 1e6, 4),
            'validPixels': int((class_grid > 0).sum()),
            'classificationBreakdown': {
                'low': {'count': counts[0], 'percent': pcts[0], 'color': '#22c55e', 'label': 'Low Silt'},
                'moderate': {'count': counts[1], 'percent': pcts[1], 'color': '#eab308', 'label': 'Moderate Silt'},
                'high': {'count': counts[2], 'percent': pcts[2], 'color': '#f97316', 'label': 'High Silt'},
                'veryHigh': {'count': counts[3], 'percent': pcts[3], 'color': '#ef4444', 'label': 'Very High Silt'}
            },
            'classificationDataUrl': 'data:image/png;base64,' + base64.b64encode(png_c).decode('ascii'),
            'volumeDataUrl': 'data:image/png;base64,' + base64.b64encode(png_v).decode('ascii'),
            'gridDimensions': {'width': grid_w, 'height': grid_h},
            'classGrid': class_grid.astype(int).tolist(),
            'thicknessGrid': np.round(thickness_grid, 3).tolist()
        }

        months_data[key] = month_record
        chart_series.append({
            'key': key,
            'month': name[:3],
            'fullName': f"{name} 2026",
            'volumeM3': total_vol,
            'volumeMCM': round(total_vol / 1e6, 4),
            'meanScore': mean_score,
            'waterAreaHa': water_area,
            'isPeak': False,
            'isMonsoon': key in MONSOON
        })

        print(f"Processed: {name:10s} | Vol: {total_vol:9.1f} m3 (grid {grid_vol:9.1f}) | "
              f"Water: {water_area:5.1f} ha | Classes L/M/H/VH %: {pcts}")

    if not chart_series:
        print(f"No KMZ pairs found in {SILT_DIR}")
        return

    peak = max(chart_series, key=lambda m: m['volumeM3'])
    peak['isPeak'] = True

    output_payload = {
        'source': 'Sentinel-2 Multispectral Water & Silt Classification (SCL + Spectral Indices)',
        'targetReservoir': 'Chapoli M.I. Tank, Goa',
        'year': 2026,
        'bbox': bbox_info,
        'months': months_data,
        'timeline': chart_series,
        'activeDefaultMonth': peak['key'],
        'classificationLegend': [
            {'level': 1, 'label': 'Low Silt', 'color': '#22c55e', 'hex': '#00FF00', 'desc': 'Clear to low suspended sediment'},
            {'level': 2, 'label': 'Moderate Silt', 'color': '#eab308', 'hex': '#FFFF00', 'desc': 'Moderate littoral sediment load'},
            {'level': 3, 'label': 'High Silt', 'color': '#f97316', 'hex': '#FFA500', 'desc': 'High inflow sediment suspension'},
            {'level': 4, 'label': 'Very High Silt', 'color': '#ef4444', 'hex': '#FF0000', 'desc': 'Severe sedimentation deposit zone'}
        ],
        'volumeLegend': {
            'minVal': 0.0,
            'midVal': VOL_MID,
            'maxVal': VOL_MAX,
            'unit': 'm³ / 100m² pixel',
            'thicknessMaxM': round(VOL_MAX / 100.0, 3),
            'palette': ['#' + h.upper() for h in YLORBR]
        }
    }

    with open(OUT_FILE, 'w') as f:
        json.dump(output_payload, f)

    print(f"\nCompiled {len(chart_series)}-month silt dataset into {OUT_FILE} "
          f"({os.path.getsize(OUT_FILE)} bytes), peak month: {peak['fullName']}")


if __name__ == '__main__':
    main()
