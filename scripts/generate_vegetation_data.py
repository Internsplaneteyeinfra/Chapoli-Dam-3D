import json
import math
import random

# Load chapoli data
with open("src/data/chapoli_data.json", "r", encoding="utf-8") as f:
    d = json.load(f)

origin = d["origin"]
origin_x = origin["x"] # 397766.33
origin_y = origin["y"] # 1661280.76

# UTM 43N -> WGS84 conversion formula
# Or standard pyproj if available
try:
    import pyproj
    utm_proj = pyproj.Proj(proj='utm', zone=43, ellps='WGS84', datum='WGS84', units='m')
    def to_wgs84(easting, northing):
        lon, lat = utm_proj(easting, northing, inverse=True)
        return lon, lat
except ImportError:
    # Accurate local Goa UTM 43N inverse approximation
    def to_wgs84(easting, northing):
        # Origin reference
        dx = easting - origin_x
        dy = northing - origin_y
        lat = origin["lat"] + (dy / 110574.0)
        lon = origin["lon"] + (dx / (111320.0 * math.cos(math.radians(origin["lat"]))))
        return lon, lat

# Dam axis segment
dam = d["dam_geometry"]
na = dam["northAbutmentLocal"] # [-468.0, -411.6]
sa = dam["southAbutmentLocal"] # [-389.8, 353.2]

def dist_to_segment(px, pz, ax, az, bx, bz):
    dx = bx - ax
    dz = bz - az
    len_sq = dx*dx + dz*dz
    if len_sq == 0:
        return math.hypot(px - ax, pz - az)
    t = max(0, min(1, ((px - ax)*dx + (pz - az)*dz) / len_sq))
    proj_x = ax + t * dx
    proj_z = az + t * dz
    return math.hypot(px - proj_x, pz - proj_z)

# Collect all valid land cells outside the reservoir
cells = d["cells"]
land_cells = []
for c in cells:
    if c.get("isValid") and not c.get("inTank"):
        elev = c.get("elevation")
        if elev is not None and elev >= 38.5:
            # Check distance to dam
            lx = c["localX"]
            lz = c["localZ"]
            d_dam = dist_to_segment(lx, lz, na[0], na[1], sa[0], sa[1])
            if d_dam > 32.0: # Keep dam crest clear
                land_cells.append(c)

print(f"Eligible land cells for vegetation: {len(land_cells)}")

# Color palettes for Western Ghats vegetation
PALETTES = {
    "large_canopy": [
        "#1b4322", "#1f4a27", "#24572c", "#2d6632", "#346e38"
    ],
    "medium_forest": [
        "#275a28", "#2f6b30", "#3a7a3b", "#438844", "#4d964f"
    ],
    "small_tree": [
        "#387739", "#448946", "#509b52", "#5ca85e", "#66b368"
    ],
    "shrub": [
        "#4b8543", "#56964c", "#63a356", "#72b063", "#5c8c4a"
    ]
}

# Plant trees with spatial variation and natural clustering
random.seed(42) # Reproducible, geographically stable

# Simple 2D Perlin/value noise for natural vegetation clustering
def pseudo_noise(x, z, scale=120.0):
    val = (math.sin(x / scale * 1.5) + math.cos(z / scale * 1.7) + 
           math.sin((x + z) / (scale * 2.1))) / 3.0
    return (val + 1.0) / 2.0 # 0.0 to 1.0

trees = []
tree_id = 1

# Shuffle cells for varied sampling
sampled_cells = list(land_cells)
random.shuffle(sampled_cells)

target_count = 2400

for c in sampled_cells:
    if len(trees) >= target_count:
        break

    lx = c["localX"]
    lz = c["localZ"]
    elev = c["elevation"]

    # Natural density weighting:
    # High hills (elev > 70m) and riparian buffer (39m - 55m) have higher vegetation probability
    noise = pseudo_noise(lx, lz)
    
    # Elevation factor
    is_riparian = 38.5 <= elev <= 52.0
    is_hill_slope = elev > 65.0
    
    threshold = 0.38
    if is_riparian:
        threshold = 0.22 # Dense riparian belt
    elif is_hill_slope:
        threshold = 0.30 # Dense hill slopes

    if noise < threshold:
        continue

    # Add small sub-grid jitter within cell so trees are not on a rigid grid
    jitter_x = (random.random() - 0.5) * 8.0
    jitter_z = (random.random() - 0.5) * 8.0
    tree_lx = round(lx + jitter_x, 2)
    tree_lz = round(lz + jitter_z, 2)

    utm_x = round(origin_x + tree_lx, 2)
    utm_y = round(origin_y - tree_lz, 2)
    lon, lat = to_wgs84(utm_x, utm_y)

    # Determine tree archetype and height based on landscape position
    rand_val = random.random()
    
    if is_riparian and rand_val < 0.40:
        # Shoreline shrubs & low vegetation
        tree_type = "shrub"
        height = round(random.uniform(1.8, 3.4), 2)
        crown_radius = round(height * random.uniform(0.65, 0.95), 2)
    elif elev > 110.0 and rand_val < 0.35:
        # Mountain ridge wind-adapted smaller canopy trees
        tree_type = "small_tree"
        height = round(random.uniform(4.0, 7.2), 2)
        crown_radius = round(height * random.uniform(0.45, 0.65), 2)
    elif rand_val < 0.25:
        # Big mature canopy trees (Banyan, Teak, Fig)
        tree_type = "large_canopy"
        height = round(random.uniform(12.0, 16.5), 2)
        crown_radius = round(height * random.uniform(0.42, 0.58), 2)
    elif rand_val < 0.70:
        # Medium forest trees (Terminalia, Jamun)
        tree_type = "medium_forest"
        height = round(random.uniform(7.5, 11.8), 2)
        crown_radius = round(height * random.uniform(0.42, 0.60), 2)
    else:
        # Understory / younger trees
        tree_type = "small_tree"
        height = round(random.uniform(4.2, 7.5), 2)
        crown_radius = round(height * random.uniform(0.45, 0.65), 2)

    color = random.choice(PALETTES[tree_type])

    trees.append({
        "id": tree_id,
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "utmX": utm_x,
        "utmY": utm_y,
        "localX": tree_lx,
        "localZ": tree_lz,
        "elevation": round(elev, 2),
        "height": height,
        "crownRadius": crown_radius,
        "type": tree_type,
        "color": color
    })
    tree_id += 1

print(f"Generated {len(trees)} trees with realistic coordinates and heights.")

# Summary by type
counts = {}
for t in trees:
    counts[t["type"]] = counts.get(t["type"], 0) + 1
for k, v in counts.items():
    print(f"  {k}: {v} trees")

output_payload = {
    "totalTrees": len(trees),
    "crs": "EPSG:32643",
    "origin": origin,
    "heightStats": {
        "minHeight_m": min(t["height"] for t in trees),
        "maxHeight_m": max(t["height"] for t in trees),
        "meanHeight_m": round(sum(t["height"] for t in trees) / len(trees), 2)
    },
    "typeCounts": counts,
    "trees": trees
}

with open("src/data/vegetation.json", "w", encoding="utf-8") as f:
    json.dump(output_payload, f, indent=1)

print("Saved to src/data/vegetation.json successfully.")
