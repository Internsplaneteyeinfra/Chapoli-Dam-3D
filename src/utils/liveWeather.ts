/**
 * Live sky conditions for the reservoir: current weather from Open-Meteo (free, no API key)
 * plus the real solar position for the current time, turned into sky dome colours.
 */

export interface LiveWeather {
  temperatureC: number | null;
  cloudCover: number; // 0..100 %
  weatherCode: number; // WMO code
  isDay: boolean;
  windSpeedKmh: number;
  windDirectionDeg: number; // meteorological: direction the wind blows FROM, clockwise from north
  fetchedAt: Date;
  ok: boolean; // false when the API could not be reached (sun-only fallback)
}

export interface SunPosition {
  elevationDeg: number;
  azimuthDeg: number; // clockwise from north
}

export interface SkyPalette {
  top: [number, number, number];
  horizon: [number, number, number];
  sunColor: [number, number, number];
  sunVisible: number; // 0..1
  cloudCover: number; // 0..1
  cloudColor: [number, number, number];
}

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export const fetchLiveWeather = async (lat: number, lon: number): Promise<LiveWeather> => {
  const url = `${OPEN_METEO_URL}?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`
    + '&current=temperature_2m,cloud_cover,weather_code,is_day,wind_speed_10m,wind_direction_10m&timezone=auto';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const json = await res.json();
    const cur = json.current ?? {};
    return {
      temperatureC: typeof cur.temperature_2m === 'number' ? cur.temperature_2m : null,
      cloudCover: typeof cur.cloud_cover === 'number' ? cur.cloud_cover : 0,
      weatherCode: typeof cur.weather_code === 'number' ? cur.weather_code : 0,
      isDay: cur.is_day === 1,
      windSpeedKmh: typeof cur.wind_speed_10m === 'number' ? cur.wind_speed_10m : 0,
      windDirectionDeg: typeof cur.wind_direction_10m === 'number' ? cur.wind_direction_10m : 0,
      fetchedAt: new Date(),
      ok: true
    };
  } catch {
    const sun = solarPosition(new Date(), lat, lon);
    return {
      temperatureC: null, cloudCover: 0, weatherCode: 0, isDay: sun.elevationDeg > 0,
      windSpeedKmh: 0, windDirectionDeg: 0, fetchedAt: new Date(), ok: false
    };
  }
};

/** WMO codes for drizzle, rain, showers and thunderstorms. */
export const isRainy = (code: number): boolean =>
  (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;

/**
 * Optional `?weather=rain|cloudy|clear` URL override to preview a weather state;
 * keeps the live temperature and wind.
 */
export const applyWeatherOverride = (w: LiveWeather): LiveWeather => {
  const mode = new URLSearchParams(window.location.search).get('weather');
  if (mode === 'rain') return { ...w, weatherCode: 63, cloudCover: Math.max(w.cloudCover, 85) };
  if (mode === 'cloudy') return { ...w, weatherCode: 3, cloudCover: 90 };
  if (mode === 'clear') return { ...w, weatherCode: 0, cloudCover: 10 };
  return w;
};

/** 16-point compass label for a bearing in degrees. */
export const compassLabel = (deg: number): string =>
  ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];

/** NOAA-style solar position (accurate to well under a degree, plenty for a sky dome). */
export const solarPosition = (date: Date, lat: number, lon: number): SunPosition => {
  const rad = Math.PI / 180;
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const epsilon = (23.439 - 0.0000004 * n) * rad;
  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = (gmst * 15 + lon) * rad;
  const ha = lst - ra;
  const latR = lat * rad;
  const elev = Math.asin(Math.sin(latR) * Math.sin(dec) + Math.cos(latR) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(latR) - Math.sin(latR) * Math.cos(ha));
  return { elevationDeg: elev / rad, azimuthDeg: ((az / rad) + 360) % 360 };
};

/** Short human label for a WMO weather code. */
export const describeWeather = (code: number, cloudCover: number): string => {
  if (code >= 95) return 'Thunderstorm';
  if (code >= 80) return 'Rain showers';
  if (code >= 61) return 'Rain';
  if (code >= 51) return 'Drizzle';
  if (code >= 45) return 'Fog';
  if (cloudCover >= 85) return 'Overcast';
  if (cloudCover >= 40) return 'Partly cloudy';
  if (cloudCover >= 15) return 'Mostly clear';
  return 'Clear';
};

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255
];
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t
];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Sky dome colours for the live sun elevation and cloud cover. The base sky always stays blue:
 * live clouds are drawn as white clouds over it (capped so blue still shows when overcast), the
 * sun follows the real time, and night only deepens the blue.
 */
export const skyPaletteFor = (weather: LiveWeather, sun: SunPosition): SkyPalette => {
  const e = sun.elevationDeg;
  const dayT = clamp01((e + 6) / 18); // night (-6 deg) -> full day (+12 deg)
  const blueT = 0.65 + 0.35 * dayT; // never darker than a deep blue
  const goldenT = clamp01(1 - Math.abs(e - 2) / 8) * (e > -6 ? 1 : 0); // warm horizon near sunrise/sunset

  const top = mix(hex('#1b4f8f'), hex('#2f7fd0'), blueT);
  let horizon = mix(hex('#5f9ccf'), hex('#bfe0f4'), blueT);
  horizon = mix(horizon, hex('#f2c08a'), goldenT * 0.45);

  const cloud = clamp01(weather.cloudCover / 100);
  const rain = isRainy(weather.weatherCode);
  return {
    top,
    horizon,
    sunColor: mix(hex('#ffd59a'), hex('#fff6e0'), clamp01(e / 30)),
    sunVisible: clamp01((e + 1) / 3) * (1 - 0.6 * cloud),
    // Always a few clouds, even when sunny
    cloudCover: Math.max(0.15, cloud * 0.55),
    // Rain: only slightly darker clouds, the sky itself stays blue
    cloudColor: rain ? hex('#aab4bf') : mix(hex('#dfe8f2'), hex('#ffffff'), dayT)
  };
};
