import json
import math
import random

with open("src/data/chapoli_data.json", "r", encoding="utf-8") as f:
    d = json.load(f)

origin = d["origin"]
tank = d["tank"]
cells = d["cells"]
dem = d["dem"]

print(f"Origin: {origin}")
print(f"Total cells: {len(cells)}, DEM: {dem['width']}x{dem['height']}")

# Count outside tank cells with valid elevation
valid_land_cells = []
for c in cells:
    if c.get("isValid") and not c.get("inTank"):
        elev = c.get("elevation")
        if elev is not None and elev >= 38.25: # Above FRL
            valid_land_cells.append(c)

print(f"Valid land cells outside reservoir: {len(valid_land_cells)}")
