"use client";
// Leaflet + OpenStreetMap (free, no API key). Swap the TileLayer for Google later if wanted.
import { MapContainer, TileLayer, Circle, Marker, CircleMarker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import type { Person, Site } from "@/lib/types";
import { DOHA } from "@/lib/geo";
import { initials } from "@/lib/time";

export interface PersonPin {
  person: Person;
  lat: number;
  lng: number;
  note?: string;
}
export interface Dot {
  lat: number;
  lng: number;
  color: string;
  label: string;
}

export interface MapProps {
  sites: Site[];
  people?: PersonPin[];
  dots?: Dot[];
  pick?: { lat: number; lng: number } | null;
  pickRadius?: number;
  onPick?: (p: { lat: number; lng: number }) => void;
  onSiteClick?: (id: string) => void;
  showLabels?: boolean;
  fitKey?: string;
  zoom?: number;
}

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const read = () => {
      const t = document.documentElement.dataset.theme;
      setDark(t ? t === "dark" : m.matches);
    };
    read();
    m.addEventListener("change", read);
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      m.removeEventListener("change", read);
      obs.disconnect();
    };
  }, []);
  return dark;
}

function Fit({ pts, fitKey, zoom }: { pts: [number, number][]; fitKey?: string; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!pts.length) return;
    if (pts.length === 1) map.setView(pts[0], zoom ?? 16);
    else map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: zoom ?? 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function Picker({ onPick }: { onPick: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

const personIcon = (p: Person) =>
  L.divIcon({
    className: "",
    html: `<div class="mpin" style="width:30px;height:30px;background:${p.color}">${initials(p.name)}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
const labelIcon = (text: string) =>
  L.divIcon({ className: "", html: `<span class="mlabel">${text.replace(/</g, "&lt;")}</span>`, iconSize: [0, 0] });
const pickIcon = L.divIcon({
  className: "",
  html: `<div class="mpin" style="width:22px;height:22px;background:#1E4A16;box-shadow:0 0 0 4px #B6EC78,0 2px 8px rgba(0,0,0,.3)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function MapView({ sites, people = [], dots = [], pick, pickRadius = 150, onPick, onSiteClick, showLabels = true, fitKey, zoom }: MapProps) {
  const dark = useDark();
  const pts = useMemo<[number, number][]>(() => {
    const all: [number, number][] = [
      ...sites.map((s) => [s.lat, s.lng] as [number, number]),
      ...people.map((p) => [p.lat, p.lng] as [number, number]),
      ...dots.map((p) => [p.lat, p.lng] as [number, number]),
    ];
    if (pick) all.push([pick.lat, pick.lng]);
    return all;
  }, [sites, people, dots, pick]);

  // spread people standing at the same site so they don't hide each other
  const spread = useMemo(() => {
    const seen: Record<string, number> = {};
    return people.map((p) => {
      const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
      const i = (seen[key] = (seen[key] ?? -1) + 1);
      return i ? { ...p, lng: p.lng + i * 0.0006 } : p;
    });
  }, [people]);

  return (
    <MapContainer center={[DOHA.lat, DOHA.lng]} zoom={11} scrollWheelZoom style={{ height: "100%", width: "100%" }} attributionControl>
      <TileLayer
        key={dark ? "d" : "l"}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={`https://{s}.basemaps.cartocdn.com/${dark ? "dark_all" : "rastertiles/voyager"}/{z}/{x}/{y}{r}.png`}
      />
      <Fit pts={pts} fitKey={fitKey} zoom={zoom} />
      {onPick && <Picker onPick={onPick} />}
      {sites.map((s) => (
        <Circle
          key={s.id}
          center={[s.lat, s.lng]}
          radius={s.radius}
          pathOptions={{ color: s.color, weight: 2, fillOpacity: 0.16 }}
          eventHandlers={onSiteClick ? { click: () => onSiteClick(s.id) } : undefined}
        >
          <Tooltip>{s.name} · zone {s.radius} m</Tooltip>
        </Circle>
      ))}
      {showLabels && sites.map((s) => <Marker key={`l-${s.id}`} position={[s.lat, s.lng]} icon={labelIcon(s.name)} interactive={false} />)}
      {dots.map((d, i) => (
        <CircleMarker key={i} center={[d.lat, d.lng]} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: d.color, fillOpacity: 1 }}>
          <Tooltip>{d.label}</Tooltip>
        </CircleMarker>
      ))}
      {spread.map((p) => (
        <Marker key={p.person.id} position={[p.lat, p.lng]} icon={personIcon(p.person)}>
          <Tooltip direction="top" offset={[0, -14]}>
            <b>{p.person.name}</b>
            {p.note ? <><br />{p.note}</> : null}
          </Tooltip>
        </Marker>
      ))}
      {pick && (
        <>
          <Circle center={[pick.lat, pick.lng]} radius={pickRadius} pathOptions={{ color: "#1E4A16", weight: 2, fillColor: "#B6EC78", fillOpacity: 0.3 }} />
          <Marker position={[pick.lat, pick.lng]} icon={pickIcon} />
        </>
      )}
    </MapContainer>
  );
}
