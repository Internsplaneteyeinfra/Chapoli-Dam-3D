"""
Build src/data/varthur_silt_series.json from the Varthur lake KML ground overlays.

Some monsoon exports were saved into the opposite folder and some overlays use
very soft alpha, so this script classifies each KML by its own title/description
and accepts low-alpha water pixels.
"""
import base64
import json
import math
import os
import re
from io import BytesIO

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLASS_DIR = os.path.join(ROOT, 'data_raw', 'varthur', 'silt_classification')
VOL_DIR = os.path.join(ROOT, 'data_raw', 'varthur', 'silt_volume')
OUT_FILE = os.path.join(ROOT, 'src', 'data', 'varthur_silt_series.json')

ORIGIN = {'x': 796859.91, 'y': 1432880.94}
ALPHA_VALID = 12
GRID_FACTOR = 4
VOL_MAX = 97.46
VOL_MID = 48.73

CLASS_PALETTE = np.array([
    [0, 255, 0],
    [255, 255, 0],
    [255, 165, 0],
    [255, 0, 0],
], dtype=float)

YLORBR = ['ffffe5', 'fff7bc', 'fee391', 'fec44f', 'fe9929', 'ec7014', 'cc4c02', '993404', '662506']

MONTH_NAMES = {
    'january': ('jan', 'January', '01'),
    'february': ('feb', 'February', '02'),
    'march': ('mar', 'March', '03'),
    'april': ('apr', 'April', '04'),
    'may': ('may', 'May', '05'),
    'june': ('jun', 'June', '06'),
    'july': ('jul', 'July', '07'),
    'august': ('aug', 'August', '08'),
    'september': ('sep', 'September', '09'),
    'october': ('oct', 'October', '10'),
    'november': ('nov', 'November', '11'),
    'december': ('dec', 'December', '12'),
}
MONSOON = {'jun', 'jul', 'aug', 'sep'}


def utm43(lon, lat):
    a = 6378137.0
    f = 1 / 298.257223563
    k0 = 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    lat_r = math.radians(lat)
    lon_r = math.radians(lon)
    lon0 = math.radians((43 - 1) * 6 - 180 + 3)
    n = a / math.sqrt(1 - e2 * math.sin(lat_r) ** 2)
    t = math.tan(lat_r) ** 2
    c = ep2 * math.cos(lat_r) ** 2
    aa = (lon_r - lon0) * math.cos(lat_r)
    m = a * (
        (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * lat_r
        - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * lat_r)
        + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * lat_r)
        - (35 * e2 ** 3 / 3072) * math.sin(6 * lat_r)
    )
    easting = k0 * n * (
        aa
        + (1 - t + c) * aa ** 3 / 6
        + (5 - 18 * t + t ** 2 + 72 * c - 58 * ep2) * aa ** 5 / 120
    ) + 500000.0
    northing = k0 * (
        m
        + n * math.tan(lat_r) * (
            aa ** 2 / 2
            + (5 - t + 9 * c + 4 * c ** 2) * aa ** 4 / 24
            + (61 - 58 * t + t ** 2 + 600 * c - 330 * ep2) * aa ** 6 / 720
        )
    )
    return easting, northing


def build_ramp(n=256):
    stops = np.array([[int(h[i:i + 2], 16) for i in (0, 2, 4)] for h in YLORBR], dtype=float)
    t = np.linspace(0.0, 1.0, n)
    seg = len(stops) - 1
    idx = np.minimum((t * seg).astype(int), seg - 1)
    frac = (t * seg - idx)[:, None]
    return t, stops[idx] * (1 - frac) + stops[idx + 1] * frac


RAMP_T, RAMP_RGB = build_ramp()


def find_float(pattern, text, default=0.0):
    m = re.search(pattern, text, re.I)
    return float(m.group(1)) if m else default


def read_kml(path):
    text = open(path, 'r', encoding='utf-8', errors='ignore').read()
    href = re.search(r'<[^>]*href[^>]*>\s*([^<]+?)\s*</', text, re.I).group(1)
    if not href.startswith('data:'):
        raise ValueError(f'Expected embedded PNG in {path}')
    png_bytes = base64.b64decode(href.split('base64,', 1)[1])
    box = {
        k: float(re.search(rf'<(?:[\w]+:)?{k}>\s*([-\d\.]+)\s*</(?:[\w]+:)?{k}>', text, re.I).group(1))
        for k in ('north', 'south', 'east', 'west')
    }
    return text, png_bytes, box


def month_from_filename(filename):
    fl = filename.lower()
    for word, meta in MONTH_NAMES.items():
        if word in fl:
            return meta
    for word, meta in MONTH_NAMES.items():
        code = meta[0]
        if re.search(rf'(^|[^a-z]){re.escape(code)}([^a-z]|$)', fl):
            return meta
    return None


def month_from_text(text):
    head = text[:2500].lower()
    for word, meta in MONTH_NAMES.items():
        if re.search(rf'\b{word}\b', head):
            return meta
    return None


def detect_kind_and_month(text, filename):
    head = text[:2500].lower()
    is_volume = ('silt volume surface' in head) or ('total relative silt volume' in head)
    is_class = ('silt classification' in head) or ('mean silt score' in head)
    if is_volume and not is_class:
        kind = 'volume'
    elif is_class and not is_volume:
        kind = 'classification'
    elif is_volume and is_class:
        # both strings can appear; prefer the document title
        title = re.search(r'<[^>]*name[^>]*>(.*?)</', text, re.I | re.S)
        title_l = (title.group(1) if title else '').lower()
        kind = 'volume' if 'volume' in title_l else 'classification'
    else:
        kind = 'volume' if 'vol' in filename.lower() else 'classification'

    file_month = month_from_filename(filename)
    title_month = month_from_text(text)
    fl = filename.lower()

    # silt_class_nov / silt_volume_jan style: titles are often wrong — trust the filename.
    # august-clss / june-vol style: folders were swapped — trust the KML title month.
    if re.search(r'(class|volume|volum)[_\s-].*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)', fl):
        month_key = file_month or title_month
    else:
        month_key = title_month or file_month
    return kind, month_key


def block_reduce(arr, factor, fn):
    h, w = arr.shape[:2]
    gh, gw = h // factor, w // factor
    if gh == 0 or gw == 0:
        return arr
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


def score_record(kind, text, png_bytes):
    rgba = np.array(Image.open(BytesIO(png_bytes)).convert('RGBA'))
    valid = int((rgba[:, :, 3] >= ALPHA_VALID).sum())
    if kind == 'classification':
        area = find_float(r'Water area:\s*([\d\.]+)\s*ha', text)
        return area * 1000 + valid
    vol = find_float(r'Total relative silt volume:\s*([\d\.]+)', text)
    return vol + valid


def collect_overlays():
    by_month = {}
    for folder in (CLASS_DIR, VOL_DIR):
        for name in os.listdir(folder):
            if not name.lower().endswith('.kml'):
                continue
            path = os.path.join(folder, name)
            text, png, box = read_kml(path)
            kind, month_meta = detect_kind_and_month(text, name)
            if month_meta is None:
                print(f'Could not detect month for {name}')
                continue
            key, pretty, num = month_meta
            slot = by_month.setdefault(key, {'pretty': pretty, 'num': num, 'classification': None, 'volume': None})
            rec = {'path': path, 'text': text, 'png': png, 'box': box, 'score': score_record(kind, text, png)}
            prev = slot[kind]
            if prev is None or rec['score'] > prev['score']:
                if prev is not None:
                    print(f'Replacing {kind} for {pretty}: {os.path.basename(prev["path"])} -> {name}')
                slot[kind] = rec
            print(f'{name:40s} -> {kind:14s} {pretty}')
    return by_month


def main():
    by_month = collect_overlays()
    months_data = {}
    chart_series = []
    bbox_info = None

    for key in ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']:
        slot = by_month.get(key)
        if not slot or not slot['classification'] or not slot['volume']:
            missing = []
            if not slot:
                missing = ['classification', 'volume']
            else:
                if not slot['classification']:
                    missing.append('classification')
                if not slot['volume']:
                    missing.append('volume')
            print(f'Skip {key}: missing {", ".join(missing)}')
            continue

        clf = slot['classification']
        vol = slot['volume']
        name = slot['pretty']
        num = slot['num']
        box = clf['box']
        kml_c, png_c = clf['text'], clf['png']
        kml_v, png_v = vol['text'], vol['png']

        if bbox_info is None:
            x_min, y_min = utm43(box['west'], box['south'])
            x_max, y_max = utm43(box['east'], box['north'])
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

        t_full, valid_v = invert_volume(rgba_v)
        raw_mean = float(t_full[valid_v].mean()) if valid_v.any() else 0.0
        score_scale = (mean_score / raw_mean) if raw_mean > 0 and mean_score > 0 else 1.0
        score_full = np.clip(t_full * score_scale, 0.0, VOL_MAX / 100.0)

        def masked_mean(blocks):
            return blocks.sum(-1) / np.maximum((blocks > 0).sum(-1), 1)

        thickness_grid = np.where(class_grid > 0, block_reduce(score_full, GRID_FACTOR, masked_mean), 0.0)

        grid_h, grid_w = class_grid.shape
        local = bbox_info['local']
        cell_area = (local['width'] / max(grid_w, 1)) * (local['depth'] / max(grid_h, 1))
        raw_grid_vol = float((thickness_grid * cell_area).sum())
        if raw_grid_vol > 0 and total_vol > 0:
            thickness_grid = thickness_grid * (total_vol / raw_grid_vol)
        grid_vol = float((thickness_grid * cell_area).sum())

        months_data[key] = {
            'key': key,
            'name': name,
            'monthNumber': num,
            'year': 2026,
            'dateLabel': f'{name} 2026',
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
            'classificationPixelGrid': {
                'width': int(classes.shape[1]),
                'height': int(classes.shape[0]),
                'values': ''.join(map(str, classes.astype(int).ravel()))
            },
            'volumeDataUrl': 'data:image/png;base64,' + base64.b64encode(png_v).decode('ascii'),
            'gridDimensions': {'width': int(grid_w), 'height': int(grid_h)},
            'classGrid': class_grid.astype(int).tolist(),
            'thicknessGrid': np.round(thickness_grid, 3).tolist()
        }
        chart_series.append({
            'key': key,
            'month': name[:3],
            'fullName': f'{name} 2026',
            'volumeM3': total_vol,
            'volumeMCM': round(total_vol / 1e6, 4),
            'meanScore': mean_score,
            'waterAreaHa': water_area,
            'isPeak': False,
            'isMonsoon': key in MONSOON
        })
        print(f'Processed: {name:10s} | Vol: {total_vol:9.1f} m3 (grid {grid_vol:9.1f}) | '
              f'Water: {water_area:5.1f} ha | Classes L/M/H/VH %: {pcts}')

    if not chart_series:
        raise SystemExit('No Varthur silt month pairs found')

    peak = max(chart_series, key=lambda m: m['volumeM3'])
    peak['isPeak'] = True

    payload = {
        'source': 'Sentinel-2 Multispectral Water & Silt Classification (SCL + Spectral Indices)',
        'targetReservoir': 'Varthur Lake, Bengaluru',
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
        json.dump(payload, f)
    print(f'\nWrote {OUT_FILE} ({os.path.getsize(OUT_FILE)} bytes), peak month: {peak["fullName"]}')


if __name__ == '__main__':
    main()
