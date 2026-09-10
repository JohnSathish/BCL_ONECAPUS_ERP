/** Official Google Maps listing for St. Luke's Secondary School, Walbakgre. */
export const ST_LUKES_MAPS_URL = 'https://maps.app.goo.gl/Qw4TGRgL1CpX76tw7';
export const ST_LUKES_MAP_LAT = 25.5179091;
export const ST_LUKES_MAP_LNG = 90.1719162;

export function schoolMapsEmbedSrc(opts: {
  query?: string;
  mapsUrl?: string;
  lat?: string | number;
  lng?: string | number;
}) {
  const url = String(opts.mapsUrl || '').trim();
  if (url.includes('/maps/embed') || /output=embed/i.test(url)) return url;
  const lat = Number(opts.lat);
  const lng = Number(opts.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps?q=${lat},${lng}&hl=en&z=17&output=embed`;
  }
  const query = String(opts.query || '').trim();
  if (query) return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
  return `https://www.google.com/maps?q=${ST_LUKES_MAP_LAT},${ST_LUKES_MAP_LNG}&hl=en&z=17&output=embed`;
}

export function schoolMapsDirectionsUrl(opts: {
  query?: string;
  mapsUrl?: string;
  lat?: string | number;
  lng?: string | number;
}) {
  const url = String(opts.mapsUrl || '').trim();
  if (url) return url;
  const lat = Number(opts.lat);
  const lng = Number(opts.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  const query = String(opts.query || '').trim();
  if (query)
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  return ST_LUKES_MAPS_URL;
}
