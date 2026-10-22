import urllib.request
import urllib.parse
import json
import os

query = """[out:json][timeout:25];
(
  way["natural"="wood"](15.01,74.03,15.04,74.07);
  way["landuse"="forest"](15.01,74.03,15.04,74.07);
  relation["landuse"="forest"](15.01,74.03,15.04,74.07);
  way["natural"="scrub"](15.01,74.03,15.04,74.07);
  node["natural"="tree"](15.01,74.03,15.04,74.07);
);
out body;
>;
out skel qt;
"""

url = "https://overpass-api.de/api/interpreter?data=" + urllib.parse.quote(query)
print("Querying OSM Overpass API...")
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'ChapoliVegetation/1.0'})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        elements = data.get('elements', [])
        print(f"Total elements returned: {len(elements)}")
        tagged = [e for e in elements if 'tags' in e]
        print(f"Tagged elements: {len(tagged)}")
        for e in tagged[:15]:
            print(e.get('type'), e.get('tags'))
except Exception as ex:
    print(f"OSM query error or timeout: {ex}")
