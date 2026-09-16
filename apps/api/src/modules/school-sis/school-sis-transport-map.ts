/** Map vendor is a school setting — business logic must not import Google/Mapbox SDKs. */
export type SchoolTransportMapProviderId = 'GOOGLE' | 'MAPBOX' | 'OSM' | 'NONE';

export type SchoolTransportMapConfig = {
  provider: SchoolTransportMapProviderId;
  gpsEnabled: boolean;
  tileUrl: string | null;
  attribution: string;
  /** True when a key is required; the key itself stays in env, never returned to parents. */
  requiresApiKey: boolean;
  hasApiKey: boolean;
  liveChannel: string;
  locationIntervalSeconds: number;
  staleAfterSeconds: number;
  geofenceDefaultMeters: number;
  trackWhenIdle: boolean;
};

export function resolveSchoolTransportMapConfig(input: {
  mapProvider?: string | null;
  gpsEnabled?: boolean;
  intervalSeconds?: number;
  staleSeconds?: number;
  geofenceMeters?: number;
  trackWhenIdle?: boolean;
}): SchoolTransportMapConfig {
  const raw = (input.mapProvider ?? 'OSM').toUpperCase();
  const provider: SchoolTransportMapProviderId =
    raw === 'GOOGLE' || raw === 'MAPBOX' || raw === 'NONE' || raw === 'OSM'
      ? raw
      : 'OSM';
  const googleKey = Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim());
  const mapboxKey = Boolean(process.env.MAPBOX_ACCESS_TOKEN?.trim());
  return {
    provider,
    gpsEnabled: Boolean(input.gpsEnabled),
    tileUrl:
      provider === 'OSM'
        ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        : provider === 'MAPBOX'
          ? 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}'
          : null,
    attribution:
      provider === 'OSM'
        ? '© OpenStreetMap contributors'
        : provider === 'MAPBOX'
          ? '© Mapbox'
          : provider === 'GOOGLE'
            ? '© Google'
            : 'Maps disabled',
    requiresApiKey: provider === 'GOOGLE' || provider === 'MAPBOX',
    hasApiKey:
      provider === 'GOOGLE'
        ? googleKey
        : provider === 'MAPBOX'
          ? mapboxKey
          : false,
    liveChannel: 'school-transport',
    locationIntervalSeconds: input.intervalSeconds ?? 20,
    staleAfterSeconds: input.staleSeconds ?? 90,
    geofenceDefaultMeters: input.geofenceMeters ?? 100,
    trackWhenIdle: Boolean(input.trackWhenIdle),
  };
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const r = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimatedMinutes(
  distanceMeters: number,
  speedKmh: number,
): number {
  const kmh = speedKmh > 0 ? speedKmh : 25;
  return Math.max(1, Math.round((distanceMeters / 1000 / kmh) * 60));
}

export function documentLifecycle(
  expiry: Date | string | null | undefined,
  warnDays: number,
): 'VALID' | 'EXPIRING' | 'EXPIRED' | 'UNKNOWN' {
  if (!expiry) return 'UNKNOWN';
  const end = new Date(expiry);
  if (Number.isNaN(end.getTime())) return 'UNKNOWN';
  const days = Math.floor((end.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'EXPIRED';
  if (days <= warnDays) return 'EXPIRING';
  return 'VALID';
}

export function capacityBand(assigned: number, max: number) {
  if (max <= 0) return { band: 'UNKNOWN' as const, available: 0, over: 0 };
  const over = Math.max(0, assigned - max);
  const available = Math.max(0, max - assigned);
  const ratio = assigned / max;
  const band =
    over > 0
      ? ('OVER' as const)
      : ratio >= 1
        ? ('FULL' as const)
        : ratio >= 0.85
          ? ('NEAR' as const)
          : ('NORMAL' as const);
  return { band, available, over };
}
