"""
Process data_raw/permanent_water.kml (Sentinel-1 SAR water extent) and
data_raw/depth.kml (Sentinel-2 relative depth) into src/data/water_depth.json.

Both KMLs are single GroundOverlays with an inline base64 PNG over the same
LatLonBox. The water PNG gives the continuous water footprint; the depth PNG
is a green -> yellow -> red ramp (green = shallow, red = deep), re-rendered
here in blue shades for display, spanning the
"Depth range" stated in the KML description.
"""

import re
import os
import json
import base64
from io import BytesIO
from PIL import Image
import numpy as np
import pyproj

WATER_KML = 'data_raw/permanent_water.kml'
DEPTH_KML = 'data_raw/depth.kml'
OUT_FILE = 'src/data/water_depth.json'

# Same scene origin used by process_data.py for the local coordinate frame
ORIGIN = {'x': 397766.33, 'y': 1661280.76}

# Overlay pixels below this alpha are feathered edges, not water
ALPHA_VALID = 128

# Output grid cell ~6.5 m => downsample overlay by this factor (finer walls on the 3D water body)
GRID_FACTOR = 2

# Display ramp for the rendered water: light blue (shallow) -> deep navy (deep)
DEPTH_PALETTE = ['#BAE6FD', '#38BDF8', '#0369A1', '#0C2D5A']


def blue_depth_png(t, alpha):
    """Recolour normalised depth t (0 shallow .. 1 deep) with DEPTH_PALETTE, keeping the overlay alpha."""
    stops = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in DEPTH_PALETTE], dtype=float)
    seg = len(stops) - 1
    pos = np.clip(t, 0, 1) * seg
    idx = np.minimum(pos.astype(int), seg - 1)
    frac = (pos - idx)[..., None]
    rgb = stops[idx] * (1 - frac) + stops[idx + 1] * frac
    # Source overlay core alpha is ~178 (70%); stretch so open water is solid, edges stay feathered
    core = max(float(alpha.max()), 1.0)
    alpha = np.clip(alpha / core, 0, 1) * 255
    rgba = np.dstack([rgb, alpha]).round().astype(np.uint8)
    buf = BytesIO()
    Image.fromarray(rgba, 'RGBA').save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def read_kml(path):
    with open(path, encoding='utf-8') as f:
        kml = f.read()
    b64 = re.search(r'base64,([^<]+)<', kml).group(1).strip()
    box = {k: float(re.search(rf'<(?:\w+:)?{k}>([-\d\.]+)</(?:\w+:)?{k}>', kml).group(1))
           for k in ('north', 'south', 'east', 'west')}
    desc = re.search(r'<(?:\w+:)?description>([^<]*)</', kml)
    name = re.search(r'<(?:\w+:)?name>([^<]*)</', kml)
    return {
        'kml': kml,
        'png': base64.b64decode(b64),
        'box': box,
        'description': desc.group(1).strip() if desc else '',
        'name': name.group(1).strip() if name else ''
    }


def find(pattern, text, cast=float, default=None):
    m = re.search(pattern, text)
    return cast(m.group(1)) if m else default


def block_reduce(arr, factor, fn):
    h, w = arr.shape[:2]
    gh, gw = h // factor, w // factor
    blocks = arr[:gh * factor, :gw * factor].reshape(gh, factor, gw, factor)
    return fn(blocks.swapaxes(1, 2).reshape(gh, gw, factor * factor))


def main():
    water = read_kml(WATER_KML)
    depth = read_kml(DEPTH_KML)

    box = water['box']
    t_to_43 = pyproj.Transformer.from_crs('EPSG:4326', 'EPSG:32643', always_xy=True).transform
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

    desc_w, desc_d = water['description'], depth['description']
    water_area = find(r'Water area:\s*([\d\.]+)\s*ha', desc_w, default=0.0)
    depth_min = find(r'Depth range:\s*([\d\.]+)', desc_d, default=0.0)
    depth_max = find(r'Depth range:\s*[\d\.]+\s*-\s*([\d\.]+)', desc_d, default=0.0)

    # Water footprint
    rgba_w = np.array(Image.open(BytesIO(water['png'])).convert('RGBA')).astype(float)
    water_mask = (rgba_w[:, :, 3] >= ALPHA_VALID) & (rgba_w[:, :, 2] > rgba_w[:, :, 0])

    # Depth: green(0,255,0) -> yellow(255,255,0) -> red(255,0,0)
    rgba_d = np.array(Image.open(BytesIO(depth['png'])).convert('RGBA')).astype(float)
    r, g = rgba_d[:, :, 0], rgba_d[:, :, 1]
    t = np.where(r < 250, r / 255.0 * 0.5, 0.5 + (255.0 - g) / 255.0 * 0.5)
    depth_full = np.where(water_mask, depth_min + np.clip(t, 0, 1) * (depth_max - depth_min), 0.0)

    mask_grid = block_reduce(water_mask.astype(int), GRID_FACTOR, lambda b: b.sum(-1) * 2 >= b.shape[-1])
    depth_grid = block_reduce(depth_full, GRID_FACTOR,
                              lambda b: b.sum(-1) / np.maximum((b > 0).sum(-1), 1))
    depth_grid = np.where(mask_grid, depth_grid, 0.0)

    grid_h, grid_w = mask_grid.shape
    cell_area = (bbox_info['local']['width'] / grid_w) * (bbox_info['local']['depth'] / grid_h)
    # Stats from full-res pixels; the coarse grid trims the shoreline
    px_area = (bbox_info['local']['width'] / water_mask.shape[1]) * (bbox_info['local']['depth'] / water_mask.shape[0])
    wet = depth_full[water_mask]

    payload = {
        'source': 'Sentinel-1 SAR water extent + Sentinel-2 relative band-ratio depth',
        'targetReservoir': 'Chapoli M.I. Tank, Goa',
        'water': {
            'name': water['name'],
            'description': desc_w,
            'imageDate': find(r'Image date:\s*([\d-]+)', desc_w, str, ''),
            'waterAreaHa': round(water_area, 2),
            'dataUrl': 'data:image/png;base64,' + base64.b64encode(water['png']).decode('ascii')
        },
        'depth': {
            'name': depth['name'],
            'description': desc_d,
            'imageDate': find(r'Image date:\s*([\d-]+)', desc_d, str, ''),
            'analysisDate': find(r'Analysis date:\s*([\d-]+)', desc_d, str, ''),
            'minDepthM': depth_min,
            'maxDepthM': depth_max,
            'meanDepthM': round(float(wet.mean()), 2) if wet.size else 0.0,
            'relativeVolumeMCM': round(float(wet.sum() * px_area) / 1e6, 3),
            'palette': DEPTH_PALETTE,
            # Source overlay is green->red; the app shows water in blue shades only
            'dataUrl': 'data:image/png;base64,' + base64.b64encode(
                blue_depth_png(t, rgba_d[:, :, 3])).decode('ascii')
        },
        'bbox': bbox_info,
        'gridDimensions': {'width': grid_w, 'height': grid_h},
        'waterGrid': mask_grid.astype(int).tolist(),
        'depthGrid': np.round(depth_grid, 2).tolist()
    }

    with open(OUT_FILE, 'w') as f:
        json.dump(payload, f)

    print(f"Water: {water_area:.2f} ha reported, {water_mask.sum() * px_area / 1e4:.1f} ha in overlay | "
          f"grid {grid_w}x{grid_h}, wet cells {int(mask_grid.sum())} (~{mask_grid.sum() * cell_area / 1e4:.1f} ha)")
    print(f"Depth: {depth_min}-{depth_max} m, mean {payload['depth']['meanDepthM']} m, "
          f"relative volume {payload['depth']['relativeVolumeMCM']} MCM")
    print(f"Wrote {OUT_FILE} ({os.path.getsize(OUT_FILE)} bytes)")


if __name__ == '__main__':
    main()
