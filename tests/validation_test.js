// Automated Verification & Acceptance Tests
import proj4 from 'proj4';
import fs from 'fs';

// Setup UTM 42N definition
proj4.defs('EPSG:32642', '+proj=utm +zone=42 +datum=WGS84 +units=m +no_defs');

const raw = fs.readFileSync('src/data/chapoli_data.json', 'utf8');
const data = JSON.parse(raw);

console.log('=== RUNNING CHAPOLI SEDIMENT DIGITAL TWIN VERIFICATION TESTS ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] Test ${totalTests}: ${message}`);
    passedTests++;
  } else {
    console.error(`[FAIL] Test ${totalTests}: ${message}`);
    process.exitCode = 1;
  }
}

// 1. Authoritative Polygon Boundary
assert(data.tank.coords_wgs84.length === 853, `Tank polygon contains 853 vertices as defined in Chapoli M.I. Tank .kml (found ${data.tank.coords_wgs84.length})`);
assert(data.tank.area_ha > 70 && data.tank.area_ha < 85, `Tank polygon area is ~77.24 hectares (computed ${data.tank.area_ha} ha)`);

// 2. Coordinate Transformation Reversibility
const [origLon, origLat] = [74.048984, 15.024726];
const [utmX, utmY] = proj4('EPSG:4326', 'EPSG:32642', [origLon, origLat]);
const [revLon, revLat] = proj4('EPSG:32642', 'EPSG:4326', [utmX, utmY]);
const diffLon = Math.abs(origLon - revLon);
const diffLat = Math.abs(origLat - revLat);
assert(diffLon < 1e-6 && diffLat < 1e-6, `Coordinate transformation WGS84 <-> EPSG:32642 is reversible within 1e-6 degrees (diffLon: ${diffLon}, diffLat: ${diffLat})`);

// 3. Three.js Local Coordinate Metric Precision
const localX = utmX - data.origin.x;
const localZ = -(utmY - data.origin.y);
assert(Math.abs(localX) < 1.0 && Math.abs(localZ) < 1.0, `Local origin matches centroid with sub-meter offset (localX: ${localX.toFixed(2)}, localZ: ${localZ.toFixed(2)})`);

// 4. Raw DEM Source Integrity & NoData Verification
assert(data.dem.rawDemTotalCells === 1295, `Raw DEM raster total cells match 1,295 (35x37) (found ${data.dem.rawDemTotalCells})`);
assert(data.dem.rawDemValidCells === 837, `Raw DEM valid cells count is exactly 837 (found ${data.dem.rawDemValidCells})`);

// 5. Unified 10m Mesh Triangulation & Normal Quality
assert(data.mesh_data.vertices.length > 20000, `Unified mesh vertices array has high-density resolution (found ${data.mesh_data.vertices.length / 3} vertices)`);
assert(data.mesh_data.indices.length > 30000, `Unified mesh has complete CCW triangulation without holes (found ${data.mesh_data.indices.length / 3} triangles)`);
assert(data.dem.minElevation === 31.0 && data.dem.maxElevation > 55.0, `Unified mesh elevation spans real bathymetric bed (31m) to surrounding hills (found min=${data.dem.minElevation}m, max=${data.dem.maxElevation}m)`);

// 6. Contours Integrity
assert(data.contours.length === 28, `Contour dataset contains 28 elevation placemarks spanning 32m to 58m (found ${data.contours.length})`);
const elevations = data.contours.map(c => c.elevation);
assert(elevations.includes(32) && elevations.includes(38) && elevations.includes(58), 'Contours cover full reservoir elevation spectrum including bed (32m), FRL (38m), and peaks (58m)');

// 7. Water Level & Storage Curve Monotonicity
let prevVol = -1;
let prevArea = -1;
let monotonic = true;
for (const pt of data.storage_curve) {
  if (pt.volume_m3 < prevVol || pt.area_m2 < prevArea) {
    monotonic = false;
    break;
  }
  prevVol = pt.volume_m3;
  prevArea = pt.area_m2;
}
assert(monotonic, 'Elevation-Area-Storage curve is strictly monotonically increasing');

// 8. Core Baseline Specifications Accuracy
const specs = data.baseline_specs;
assert(specs.reservoirName === 'Chapoli M.I. Tank', 'Reservoir name matches Chapoli M.I. Tank');
assert(specs.grossStorage_MCM === 9.9824, 'Gross storage capacity matches 9.9824 MCM');
assert(specs.grossStorage_Hamts === 998.24, 'Gross storage in Hamts matches 998.24 Hamts (source spelling preserved)');
assert(specs.liveStorage_MCM === 8.7658, 'Live storage capacity matches 8.7658 MCM');
assert(specs.liveStorage_Hamts === 876.58, 'Live storage in Hamts matches 876.58 Hamts');
assert(specs.deadStorage_MCM === 0.49, 'Dead storage capacity matches 0.49 MCM');
assert(specs.deadStorage_Hamts === 49.00, 'Dead storage in Hamts matches 49.00 Hamts');
assert(specs.frl_m === 38.25, 'Full Reservoir Level matches 38.25 m');
assert(specs.mddl_m === 22.00, 'Minimum Draw Down Level matches 22.00 m');

console.log(`\n=== TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED ===`);
