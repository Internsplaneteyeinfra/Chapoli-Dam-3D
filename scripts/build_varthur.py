"""
Build src/data/varthur_data.json for the Varthur Lake digital twin.

Inputs (copied from the supplied downloads):
  data_raw/varthur/Varthur_lake.kml       lake shoreline
  data_raw/varthur/Varthur_lake_box.kml   terrain extent

The supplied GeoTIFF is an 8-bit grayscale preview (113 x 59, no elevation
values), so heights come from AWS Terrain Tiles (Mapzen Terrarium / SRTM)
over that box, the same source family used for the Chapoli DTM.

Inside the lake, SRTM returns the water surface. A shallow bowl (max 2.3 m,
tapered to the shoreline) is modelled so the bed can be drawn and the water
slider has somewhere to fall. That bowl is marked MODELLED.
"""
import json
import math
import os
from io import BytesIO

import numpy as np
import requests
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAKE_KML = os.path.join(ROOT, 'data_raw', 'varthur', 'Varthur_lake.kml')
BOX_KML = os.path.join(ROOT, 'data_raw', 'varthur', 'Varthur_lake_box.kml')
OUT_JSON = os.path.join(ROOT, 'src', 'data', 'varthur_data.json')
TILE_ZOOM = 14
GRID_STEP = 12.0
MAX_BOWL_M = 2.3
BOWL_SCALE_M = 80.0


def utm43(lon, lat):
    """WGS84 lon/lat to UTM zone 43N easting, northing."""
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


def kml_ring(path):
    import xml.etree.ElementTree as ET
    root = ET.parse(path).getroot()
    for elem in root.iter():
        if '}' in elem.tag:
            elem.tag = elem.tag.split('}', 1)[1]
    text = root.find('.//coordinates').text.strip()
    return [[float(p.split(',')[0]), float(p.split(',')[1])] for p in text.split()]


def lon2px(lon, z):
    return (lon + 180.0) / 360.0 * (256 * 2 ** z)


def lat2px(lat, z):
    s = math.sin(math.radians(lat))
    return (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * (256 * 2 ** z)


def point_in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi):
            inside = not inside
        j = i
    return inside


def dist_to_ring(px, py, ring):
    best = 1e12
    for i in range(len(ring) - 1):
        ax, ay = ring[i]
        bx, by = ring[i + 1]
        vx, vy = bx - ax, by - ay
        len2 = vx * vx + vy * vy
        t = 0.0 if len2 == 0 else max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / len2))
        dx, dy = px - (ax + t * vx), py - (ay + t * vy)
        d = dx * dx + dy * dy
        if d < best:
            best = d
    return math.sqrt(best)


def fetch_mosaic(west, south, east, north, z):
    tile = 256
    x0 = math.floor(lon2px(west, z) / tile)
    x1 = math.floor(lon2px(east, z) / tile)
    y0 = math.floor(lat2px(north, z) / tile)
    y1 = math.floor(lat2px(south, z) / tile)
    cols = x1 - x0 + 1
    rows = y1 - y0 + 1
    mosaic = np.zeros((rows * tile, cols * tile), dtype=np.float32)
    print('Fetching terrarium z%d tiles %d x %d (%d,%d .. %d,%d)' % (z, cols, rows, x0, y0, x1, y1))
    session = requests.Session()
    session.headers['User-Agent'] = 'Chapoli-Dam-3D varthur terrain build'
    for ty in range(y0, y1 + 1):
        for tx in range(x0, x1 + 1):
            url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{tx}/{ty}.png'
            resp = session.get(url, timeout=60)
            resp.raise_for_status()
            im = Image.open(BytesIO(resp.content)).convert('RGB')
            arr = np.asarray(im).astype(np.float32)
            elev = arr[:, :, 0] * 256.0 + arr[:, :, 1] + arr[:, :, 2] / 256.0 - 32768.0
            r0 = (ty - y0) * tile
            c0 = (tx - x0) * tile
            mosaic[r0:r0 + tile, c0:c0 + tile] = elev
    return mosaic, x0 * tile, y0 * tile


def sample_elev(mosaic, ox, oy, z, lon, lat):
    px = lon2px(lon, z) - ox - 0.5
    py = lat2px(lat, z) - oy - 0.5
    h, w = mosaic.shape
    px = min(max(px, 0.0), w - 1.001)
    py = min(max(py, 0.0), h - 1.001)
    x0 = int(math.floor(px))
    y0 = int(math.floor(py))
    fx = px - x0
    fy = py - y0
    a = mosaic[y0, x0]
    b = mosaic[y0, x0 + 1]
    c = mosaic[y0 + 1, x0]
    d = mosaic[y0 + 1, x0 + 1]
    return float(a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy)


def main():
    lake_wgs = kml_ring(LAKE_KML)
    box_wgs = kml_ring(BOX_KML)
    lons = [p[0] for p in box_wgs]
    lats = [p[1] for p in box_wgs]
    west, east = min(lons), max(lons)
    south, north = min(lats), max(lats)

    lake_utm = [utm43(lon, lat) for lon, lat in lake_wgs]
    cx = sum(p[0] for p in lake_utm[:-1]) / (len(lake_utm) - 1)
    cy = sum(p[1] for p in lake_utm[:-1]) / (len(lake_utm) - 1)
    # centroid of the polygon (shoelace), falling back to the vertex mean
    area2 = 0.0
    gx = 0.0
    gy = 0.0
    for i in range(len(lake_utm) - 1):
        x1, y1 = lake_utm[i]
        x2, y2 = lake_utm[i + 1]
        cross = x1 * y2 - x2 * y1
        area2 += cross
        gx += (x1 + x2) * cross
        gy += (y1 + y2) * cross
    if abs(area2) > 1:
        cx = gx / (3 * area2)
        cy = gy / (3 * area2)
    area_m2 = abs(area2) / 2.0
    perim = 0.0
    for i in range(len(lake_utm) - 1):
        perim += math.hypot(lake_utm[i + 1][0] - lake_utm[i][0], lake_utm[i + 1][1] - lake_utm[i][1])

    origin_lon, origin_lat = None, None
    # invert roughly by sampling; store origin from the centroid via a local search is unnecessary:
    # convert centroid back with a small iterative correction using the forward UTM.
    # Use the vertex-mean lon/lat as a seed and project it, then we only need lon/lat of the UTM centroid
    # for weather. Approximate by inverse of the vertex mean if shoelace centroid is close.
    mean_lon = sum(p[0] for p in lake_wgs[:-1]) / (len(lake_wgs) - 1)
    mean_lat = sum(p[1] for p in lake_wgs[:-1]) / (len(lake_wgs) - 1)
    # Newton step in lon/lat so utm(lon,lat) ~= (cx, cy)
    lon, lat = mean_lon, mean_lat
    for _ in range(6):
        ex, ny = utm43(lon, lat)
        dlon = 1e-6
        dlat = 1e-6
        ex2, ny2 = utm43(lon + dlon, lat)
        ex3, ny3 = utm43(lon, lat + dlat)
        j11 = (ex2 - ex) / dlon
        j21 = (ny2 - ny) / dlon
        j12 = (ex3 - ex) / dlat
        j22 = (ny3 - ny) / dlat
        det = j11 * j22 - j12 * j21
        dx, dy = cx - ex, cy - ny
        lon += (j22 * dx - j12 * dy) / det
        lat += (-j21 * dx + j11 * dy) / det
    origin_lon, origin_lat = lon, lat
    print(f'Origin UTM43 {cx:.2f} E, {cy:.2f} N  WGS84 {origin_lon:.6f}, {origin_lat:.6f}')
    print(f'Lake area {area_m2 / 10000:.2f} ha  perimeter {perim:.0f} m')

    lake_local = [[round(p[0] - cx, 2), round(-(p[1] - cy), 2)] for p in lake_utm]

    mosaic, ox, oy = fetch_mosaic(west, south, east, north, TILE_ZOOM)

    # Local linear map from UTM metres back to lon/lat (accurate to about a metre over this box)
    ex0, ny0 = utm43(origin_lon, origin_lat)
    ex1, ny1 = utm43(origin_lon + 0.001, origin_lat)
    ex2, ny2 = utm43(origin_lon, origin_lat + 0.001)
    dlon_per_m = 0.001 / (ex1 - ex0)
    dlat_per_m = 0.001 / (ny2 - ny0)

    # Grid covers the box in local metres
    box_local = []
    for lon_b, lat_b in box_wgs:
        ex, ny = utm43(lon_b, lat_b)
        box_local.append((ex - cx, -(ny - cy)))
    min_x = math.floor(min(p[0] for p in box_local) / GRID_STEP) * GRID_STEP
    max_x = math.ceil(max(p[0] for p in box_local) / GRID_STEP) * GRID_STEP
    min_z = math.floor(min(p[1] for p in box_local) / GRID_STEP) * GRID_STEP
    max_z = math.ceil(max(p[1] for p in box_local) / GRID_STEP) * GRID_STEP
    xs = np.arange(min_x, max_x + GRID_STEP * 0.5, GRID_STEP)
    zs = np.arange(min_z, max_z + GRID_STEP * 0.5, GRID_STEP)
    num_rows = len(zs)
    num_cols = len(xs)
    print(f'Grid {num_rows} x {num_cols} at {GRID_STEP:.0f} m')

    raw = np.empty((num_rows, num_cols), dtype=np.float64)
    inside = np.zeros((num_rows, num_cols), dtype=bool)
    shore_dist = np.full((num_rows, num_cols), 1e9)
    for r, z in enumerate(zs):
        for c, x in enumerate(xs):
            easting = cx + x
            northing = cy - z
            lon_g = origin_lon + (easting - ex0) * dlon_per_m
            lat_g = origin_lat + (northing - ny0) * dlat_per_m
            raw[r, c] = sample_elev(mosaic, ox, oy, TILE_ZOOM, lon_g, lat_g)
            if point_in_ring(x, z, lake_local):
                inside[r, c] = True
                shore_dist[r, c] = dist_to_ring(x, z, lake_local)
        if r % 20 == 0:
            print(f'  row {r}/{num_rows}')

    valid = (raw > 200) & (raw < 1500)
    if not np.all(valid):
        print(f'Filling {int((~valid).sum())} void cells')
        filled = raw.copy()
        yy, xx = np.where(valid)
        for r, c in zip(*np.where(~valid)):
            d2 = (yy - r) ** 2 + (xx - c) ** 2
            k = int(np.argmin(d2))
            filled[r, c] = raw[yy[k], xx[k]]
        raw = filled

    inside_vals = raw[inside]
    # Shoreline water surface: mode of the interior (SRTM lake returns are nearly flat)
    bins = np.round(inside_vals * 2) / 2  # 0.5 m bins
    vals, counts = np.unique(bins, return_counts=True)
    frl = float(vals[int(np.argmax(counts))])
    print(f'Interior elev {inside_vals.min():.2f} .. {inside_vals.max():.2f}  mode FRL {frl:.2f} m  n={inside_vals.size}')
    print(f'Terrain elev {raw.min():.2f} .. {raw.max():.2f}  mean {raw.mean():.2f}')

    bed = raw.copy()
    for r in range(num_rows):
        for c in range(num_cols):
            if not inside[r, c]:
                continue
            if raw[r, c] > frl + 1.5:
                continue  # bank or island above the water surface
            # Depth below FRL; normalised below so the deepest cell is exactly MAX_BOWL_M
            depth = 1.0 - math.exp(-shore_dist[r, c] / BOWL_SCALE_M)
            bed[r, c] = frl - depth

    # Stretch the bowl so maximum water depth at FRL is exactly MAX_BOWL_M
    if inside.any():
        carved = frl - bed[inside]
        peak = float(carved.max()) if carved.size else 0.0
        if peak > 1e-6:
            bed[inside] = frl - carved * (MAX_BOWL_M / peak)

    deepest = float(bed[inside].min()) if inside.any() else float(bed.min())
    datum = math.floor(float(raw.min()) - 2.0)
    print(f'Deepest modelled bed {deepest:.2f} m  max depth {frl - deepest:.2f} m  vertical datum {datum:.0f} m')

    def rnd(v):
        return round(float(v), 2)

    vertices = []
    raw_vertices = []
    grid = []
    raw_grid = []
    cells = []
    elevs = []
    for r, z in enumerate(zs):
        row = []
        raw_row = []
        for c, x in enumerate(xs):
            elev = rnd(bed[r, c])
            raw_elev = rnd(raw[r, c])
            lx = rnd(x)
            lz = rnd(z)
            row.append(elev)
            raw_row.append(raw_elev)
            elevs.append(elev)
            vertices.extend([lx, elev, lz])
            raw_vertices.extend([lx, raw_elev, lz])
            in_tank = bool(inside[r, c])
            if not in_tank:
                prov = 'OBSERVED'
            elif raw[r, c] > frl + 1.5:
                prov = 'OBSERVED'
            else:
                prov = 'MODELLED'
            cells.append({
                'row': int(r),
                'col': int(c),
                'x': rnd(cx + x),
                'y': rnd(cy - z),
                'localX': lx,
                'localZ': lz,
                'elevation': elev,
                'rawFabdemElevation': raw_elev,
                'isValid': True,
                'inTank': in_tank,
                'provenance': prov
            })
        grid.append(row)
        raw_grid.append(raw_row)

    cell_area = GRID_STEP * GRID_STEP
    storage = []
    steps = np.arange(math.floor(deepest * 2) / 2, frl + 1.51, 0.5)
    for h in steps:
        h = round(float(h), 2)
        submerged = [cell for cell in cells if cell['inTank'] and cell['elevation'] <= h]
        area = len(submerged) * cell_area
        volume = sum((h - cell['elevation']) * cell_area for cell in submerged)
        storage.append({
            'elevation': h,
            'submergedCells': len(submerged),
            'area_m2': round(area, 1),
            'area_ha': round(area / 10000, 2),
            'volume_m3': round(volume, 1),
            'volume_mcm': round(volume / 1e6, 4)
        })
    at_frl = min(storage, key=lambda s: abs(s['elevation'] - frl))
    gross_mcm = at_frl['volume_mcm']

    output = {
        'origin': {
            'x': round(cx, 2),
            'y': round(cy, 2),
            'lon': round(origin_lon, 6),
            'lat': round(origin_lat, 6),
            'crs': 'EPSG:32643'
        },
        'tank': {
            'area_m2': round(area_m2, 2),
            'area_ha': round(area_m2 / 10000, 2),
            'perimeter_m': round(perim, 2),
            'bounds_32643': [
                round(min(p[0] for p in lake_utm), 2),
                round(min(p[1] for p in lake_utm), 2),
                round(max(p[0] for p in lake_utm), 2),
                round(max(p[1] for p in lake_utm), 2)
            ],
            'coords_wgs84': [[round(p[0], 8), round(p[1], 8)] for p in lake_wgs],
            'coords_local': lake_local
        },
        'dem': {
            'width': int(num_cols),
            'height': int(num_rows),
            'crs': 'EPSG:32643',
            'bounds': {
                'left': float(min_x + cx),
                'bottom': float(-max_z + cy),
                'right': float(max_x + cx),
                'top': float(-min_z + cy)
            },
            'dx': GRID_STEP,
            'dy': GRID_STEP,
            'nodata': -32768.0,
            'totalCells': int(num_rows * num_cols),
            'validCells': int(num_rows * num_cols),
            'nodataCells': 0,
            'minElevation': rnd(min(elevs)),
            'maxElevation': rnd(max(elevs)),
            'meanElevation': rnd(float(np.mean(elevs))),
            'medianElevation': rnd(float(np.median(elevs))),
            'rawDemValidCells': int(num_rows * num_cols),
            'rawDemTotalCells': int(num_rows * num_cols),
            'contourLevels': 0,
            'verticalDatum_m': float(datum),
            'sourceDtm': 'AWS Terrain Tiles terrarium z14 (SRTM) clipped to the supplied Varthur box KML. Interior bed is a modelled 2.3 m bowl because SRTM returns the water surface inside the lake.'
        },
        'dem_grid': grid,
        'raw_fabdem_grid': raw_grid,
        'cells': cells,
        'mesh_data': {'vertices': vertices, 'colors': [], 'indices': []},
        'raw_mesh_data': {'vertices': raw_vertices, 'colors': [], 'indices': []},
        'contours': [],
        'storage_curve': storage,
        'baseline_specs': {
            'reservoirName': 'Varthur Lake',
            'location': 'Varthur, Bengaluru, Karnataka',
            'river': 'Outflow toward the Dakshina Pinakini',
            'catchmentArea_km2': 0,
            'grossStorage_MCM': gross_mcm,
            'grossStorage_Hamts': round(gross_mcm * 100, 2),
            'liveStorage_MCM': gross_mcm,
            'liveStorage_Hamts': round(gross_mcm * 100, 2),
            'deadStorage_MCM': 0,
            'deadStorage_Hamts': 0,
            'frl_m': frl,
            'mddl_m': rnd(deepest),
            'deepestBedLevel_m': rnd(deepest),
            'submergenceArea_ha': round(area_m2 / 10000, 2),
            'sourceAttribution': 'Lake outline from the supplied Varthur KML. Terrain from AWS Terrain Tiles (SRTM) over the supplied box. The lake bed below the water surface is a modelled bowl (maximum 2.3 m), not a hydrographic survey.'
        }
    }

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, 'w') as f:
        json.dump(output, f, separators=(',', ':'))
    print(f'Wrote {OUT_JSON} ({os.path.getsize(OUT_JSON) / 1e6:.1f} MB)')
    print(f'FRL {frl:.2f} m  storage {gross_mcm:.4f} MCM  area {at_frl["area_ha"]:.2f} ha')


if __name__ == '__main__':
    main()
