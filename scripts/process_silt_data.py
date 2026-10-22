"""
Process and compile all 20 KMZ files from data_raw/silt volume classify/
Extracts metadata, bounding box in UTM 43N, pixel statistics, and base64 PNG images
for both Silt Classification (4 classes) and Silt Volume Surface (continuous YlOrBr)
across all 10 months of 2026.
"""

import zipfile
import xml.etree.ElementTree as ET
import glob
import os
import re
import json
import base64
from io import BytesIO
from PIL import Image
import numpy as np
import pyproj

def main():
    silt_dir = 'data_raw/silt volume classify'
    if not os.path.exists(silt_dir):
        print(f"Directory {silt_dir} not found!")
        return

    # UTM 43N & Centroid Origin
    p43 = pyproj.CRS('EPSG:32643')
    wgs = pyproj.CRS('EPSG:4326')
    t_to_43 = pyproj.Transformer.from_crs(wgs, p43, always_xy=True).transform
    origin = {'x': 397766.33, 'y': 1661280.76}

    # Common LatLonBox across all KMZ files
    north = 15.02980826
    south = 15.01954928
    east = 74.05435143
    west = 74.04461429

    x_min, y_min = t_to_43(west, south)
    x_max, y_max = t_to_43(east, north)

    local_x_min = round(float(x_min - origin['x']), 2)
    local_x_max = round(float(x_max - origin['x']), 2)
    local_z_min = round(float(-(y_max - origin['y'])), 2)
    local_z_max = round(float(-(y_min - origin['y'])), 2)

    bbox_info = {
        'wgs84': {
            'north': north,
            'south': south,
            'east': east,
            'west': west
        },
        'utm43n': {
            'minEasting': round(x_min, 2),
            'maxEasting': round(x_max, 2),
            'minNorthing': round(y_min, 2),
            'maxNorthing': round(y_max, 2)
        },
        'local': {
            'minX': local_x_min,
            'maxX': local_x_max,
            'minZ': local_z_min,
            'maxZ': local_z_max,
            'width': round(local_x_max - local_x_min, 2),
            'depth': round(local_z_max - local_z_min, 2)
        }
    }

    month_order = [
        ('jan', 'January', '01'),
        ('feb', 'February', '02'),
        ('mar', 'March', '03'),
        ('apr', 'April', '04'),
        ('may', 'May', '05'),
        ('jun', 'June', '06'),
        ('jul', 'July', '07'),
        ('aug', 'August', '08'),
        ('sep', 'September', '09'),
        ('oct', 'October', '10')
    ]

    months_data = {}
    chart_series = []

    for key, name, num in month_order:
        clf_pattern = os.path.join(silt_dir, f'Silt Classification *{name}*.kmz')
        vol_pattern = os.path.join(silt_dir, f'Silt Volume Surface *{name}*.kmz')

        clf_matches = glob.glob(clf_pattern)
        vol_matches = glob.glob(vol_pattern)

        if not clf_matches or not vol_matches:
            print(f"Missing KMZ for month: {name}")
            continue

        clf_file = clf_matches[0]
        vol_file = vol_matches[0]

        # 1. Parse Classification KMZ
        with zipfile.ZipFile(clf_file, 'r') as z_c:
            kml_c = z_c.read('doc.kml').decode('utf-8', errors='ignore')
            clf_img_start = kml_c.find('base64,') + 7
            clf_img_end = kml_c.find('</href>')
            clf_b64 = kml_c[clf_img_start:clf_img_end].strip()
            clf_data_url = f"data:image/png;base64,{clf_b64}"

            water_area = 0.0
            mean_score = 0.0
            p5 = 0.0
            p95 = 0.0

            w_match = re.search(r'Water area:\s*([\d\.]+)\s*ha', kml_c)
            if w_match: water_area = float(w_match.group(1))

            s_match = re.search(r'Mean silt score:\s*([\d\.]+)', kml_c)
            if s_match: mean_score = float(s_match.group(1))

            p_match = re.search(r'Sediment index P5=([-\d\.]+)\s*[\D]+P95=([-\d\.]+)', kml_c)
            if p_match:
                p5 = float(p_match.group(1))
                p95 = float(p_match.group(2))

            # Decode image array to count classes
            img_c = Image.open(BytesIO(base64.b64decode(clf_b64)))
            arr_c = np.array(img_c)
            img_h, img_w = arr_c.shape[:2]

            alpha = arr_c[:, :, 3] > 0
            r_c = arr_c[:, :, 0]
            g_c = arr_c[:, :, 1]
            b_c = arr_c[:, :, 2]

            # Classes:
            # Low = [0, 255, 0]
            # Moderate = [255, 255, 0]
            # High = [255, 165, 0]
            # Very High = [255, 0, 0]
            c1_mask = alpha & (r_c == 0) & (g_c == 255) & (b_c == 0)
            c2_mask = alpha & (r_c == 255) & (g_c == 255) & (b_c == 0)
            c3_mask = alpha & (r_c == 255) & (g_c >= 140) & (g_c <= 180) & (b_c == 0)
            c4_mask = alpha & (r_c == 255) & (g_c == 0) & (b_c == 0)

            total_valid_pixels = int(np.sum(alpha))
            low_count = int(np.sum(c1_mask))
            mod_count = int(np.sum(c2_mask))
            high_count = int(np.sum(c3_mask))
            vhigh_count = int(np.sum(c4_mask))

            pct_low = round((low_count / total_valid_pixels * 100), 1) if total_valid_pixels > 0 else 0.0
            pct_mod = round((mod_count / total_valid_pixels * 100), 1) if total_valid_pixels > 0 else 0.0
            pct_high = round((high_count / total_valid_pixels * 100), 1) if total_valid_pixels > 0 else 0.0
            pct_vhigh = round((vhigh_count / total_valid_pixels * 100), 1) if total_valid_pixels > 0 else 0.0

            # Build a 2D integer matrix of classes (0: NoData, 1: Low, 2: Mod, 3: High, 4: VHigh)
            class_grid = np.zeros((img_h, img_w), dtype=int)
            class_grid[c1_mask] = 1
            class_grid[c2_mask] = 2
            class_grid[c3_mask] = 3
            class_grid[c4_mask] = 4

        # 2. Parse Volume Surface KMZ
        with zipfile.ZipFile(vol_file, 'r') as z_v:
            kml_v = z_v.read('doc.kml').decode('utf-8', errors='ignore')
            vol_img_start = kml_v.find('base64,') + 7
            vol_img_end = kml_v.find('</href>')
            vol_b64 = kml_v[vol_img_start:vol_img_end].strip()
            vol_data_url = f"data:image/png;base64,{vol_b64}"

            total_vol = 0.0
            v_match = re.search(r'Total relative silt volume:\s*([\d\.]+)\s*m', kml_v)
            if v_match: total_vol = float(v_match.group(1))

            # Decode volume image to compute approximate thickness grid
            img_v = Image.open(BytesIO(base64.b64decode(vol_b64)))
            arr_v = np.array(img_v)
            
            # Reconstruct volume grid per pixel (0 - 96.58 m3 per 10m pixel)
            vol_grid = np.zeros((img_h, img_w), dtype=float)
            thickness_grid = np.zeros((img_h, img_w), dtype=float)
            for y in range(img_h):
                for x in range(img_w):
                    if arr_v[y, x, 3] > 0:
                        r = arr_v[y, x, 0]
                        g = arr_v[y, x, 1]
                        if r >= 250 and g >= 150:
                            t = max(0.0, min(1.0, (255 - g) / (255 - 153)))
                            vol_val = t * 48.29
                        else:
                            t = max(0.0, min(1.0, (254 - r) / (254 - 102)))
                            vol_val = 48.29 + t * (96.58 - 48.29)
                        vol_grid[y, x] = round(vol_val, 2)
                        # thickness in meters = volume m3 / 100 m2
                        thickness_grid[y, x] = round(vol_val / 100.0, 3)

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
            'validPixels': total_valid_pixels,
            'classificationBreakdown': {
                'low': {'count': low_count, 'percent': pct_low, 'color': '#22c55e', 'label': 'Low Silt'},
                'moderate': {'count': mod_count, 'percent': pct_mod, 'color': '#eab308', 'label': 'Moderate Silt'},
                'high': {'count': high_count, 'percent': pct_high, 'color': '#f97316', 'label': 'High Silt'},
                'veryHigh': {'count': vhigh_count, 'percent': pct_vhigh, 'color': '#ef4444', 'label': 'Very High Silt'}
            },
            'classificationDataUrl': clf_data_url,
            'volumeDataUrl': vol_data_url,
            'gridDimensions': {'width': img_w, 'height': img_h},
            'classGrid': class_grid.tolist(),
            'thicknessGrid': thickness_grid.tolist()
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
            'isPeak': bool(key == 'sep'),
            'isMonsoon': bool(key in ['jun', 'jul', 'aug', 'sep'])
        })

        print(f"Processed: {name:10s} | Vol: {total_vol:8.1f} m3 | Water: {water_area:5.1f} ha | Valid Pixels: {total_valid_pixels}")

    output_payload = {
        'source': 'Sentinel-2 Multispectral Water & Silt Classification (SCL + Spectral Indices)',
        'targetReservoir': 'Chapoli M.I. Tank, Goa',
        'year': 2026,
        'bbox': bbox_info,
        'months': months_data,
        'timeline': chart_series,
        'activeDefaultMonth': 'sep', # Default to September peak post-monsoon silt
        'classificationLegend': [
            {'level': 1, 'label': 'Low Silt', 'color': '#22c55e', 'hex': '#00FF00', 'desc': 'Clear to low suspended sediment'},
            {'level': 2, 'label': 'Moderate Silt', 'color': '#eab308', 'hex': '#FFFF00', 'desc': 'Moderate littoral sediment load'},
            {'level': 3, 'label': 'High Silt', 'color': '#f97316', 'hex': '#FFA500', 'desc': 'High inflow sediment suspension'},
            {'level': 4, 'label': 'Very High Silt', 'color': '#ef4444', 'hex': '#FF0000', 'desc': 'Severe sedimentation deposit zone'}
        ],
        'volumeLegend': {
            'minVal': 0.0,
            'midVal': 48.29,
            'maxVal': 96.58,
            'unit': 'm³ / 100m² pixel',
            'thicknessMaxM': 0.966,
            'palette': ['#FFFFE5', '#FE9929', '#662506']
        }
    }

    out_file = 'src/data/silt_series.json'
    with open(out_file, 'w') as f:
        json.dump(output_payload, f, indent=2)

    print(f"\nSuccessfully compiled 10-month silt dataset into {out_file} ({os.path.getsize(out_file)} bytes)")

if __name__ == '__main__':
    main()
