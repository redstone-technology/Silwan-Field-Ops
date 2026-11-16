import type { GeoPoint, Site } from "./types";

/** Distance in metres between two points (haversine). */
export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function insideSite(p: GeoPoint, site: Site): boolean {
  return distanceM(p, site) <= site.radius;
}

export function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** Move a point by metres north/east (used for demo locations). */
export function offset(p: GeoPoint, northM: number, eastM: number): GeoPoint {
  const dLat = northM / 111320;
  const dLng = eastM / (111320 * Math.cos((p.lat * Math.PI) / 180));
  return { lat: p.lat + dLat, lng: p.lng + dLng };
}

export const DOHA = { lat: 25.3236, lng: 51.5085 };
