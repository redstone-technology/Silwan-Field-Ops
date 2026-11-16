"use client";
import dynamic from "next/dynamic";

// Leaflet needs the browser, so it is loaded on the client only.
export const Map = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div style={{ height: "100%", display: "grid", placeItems: "center" }} className="muted small">Loading map…</div>,
});
