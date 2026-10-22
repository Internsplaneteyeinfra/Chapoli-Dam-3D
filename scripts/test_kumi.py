import urllib.request
import urllib.parse
import json

query = """[out:json][timeout:20];
(
  way["natural"~"wood|scrub"](15.01,74.03,15.04,74.07);
  way["landuse"="forest"](15.01,74.03,15.04,74.07);
  relation["landuse"="forest"](15.01,74.03,15.04,74.07);
);
out tags;
"""
url = "https://overpass.kumi.systems/api/interpreter?data=" + urllib.parse.quote(query)
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'ChapoliVegetation/1.0'})
    with urllib.request.urlopen(req, timeout=15) as resp:
        d = json.loads(resp.read().decode('utf-8'))
        print("Elements from Kumi:", len(d.get('elements', [])))
        for el in d.get('elements', []):
            print(el.get('id'), el.get('tags'))
except Exception as ex:
    print("Error:", ex)
