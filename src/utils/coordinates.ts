import proj4 from 'proj4';
import { ReservoirOrigin } from '../types/reservoir';

// Define UTM Zone 43N (WGS84) for Goa (74°E, 15°N)
proj4.defs('EPSG:32643', '+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs');
// Fallback definition for legacy references
proj4.defs('EPSG:32642', '+proj=utm +zone=42 +datum=WGS84 +units=m +no_defs');

export class GeoTransform {
  private origin: ReservoirOrigin;
  private crs: string;

  constructor(origin: ReservoirOrigin) {
    this.origin = origin;
    this.crs = origin.crs || 'EPSG:32643';
  }

  /**
   * Convert WGS84 Lon/Lat to UTM EPSG:32643
   */
  wgs84ToUTM(lon: number, lat: number): [number, number] {
    return proj4('EPSG:4326', this.crs, [lon, lat]);
  }

  /**
   * Convert UTM EPSG:32643 to WGS84 Lon/Lat
   */
  utmToWgs84(easting: number, northing: number): [number, number] {
    return proj4(this.crs, 'EPSG:4326', [easting, northing]);
  }

  /**
   * Convert UTM Easting/Northing to Three.js World (X, Z)
   * Local metric system: X is East (+), Z is South (+), -Z is North (+)
   */
  utmToLocal(easting: number, northing: number): [number, number] {
    const localX = easting - this.origin.x;
    const localZ = -(northing - this.origin.y);
    return [localX, localZ];
  }

  /**
   * Convert Three.js World (X, Z) to UTM Easting/Northing
   */
  localToUTM(localX: number, localZ: number): [number, number] {
    const easting = localX + this.origin.x;
    const northing = -localZ + this.origin.y;
    return [easting, northing];
  }

  /**
   * Convert Three.js World (X, Z) to WGS84 Lon/Lat
   */
  localToWGS84(localX: number, localZ: number): [number, number] {
    const [easting, northing] = this.localToUTM(localX, localZ);
    return proj4(this.crs, 'EPSG:4326', [easting, northing]);
  }

  /**
   * Format decimal degrees into human-readable DMS
   */
  static toDMS(val: number, isLat: boolean): string {
    const absVal = Math.abs(val);
    const deg = Math.floor(absVal);
    const min = Math.floor((absVal - deg) * 60);
    const sec = ((absVal - deg - min / 60) * 3600).toFixed(2);
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return `${deg}°${min}'${sec}" ${dir}`;
  }
}
