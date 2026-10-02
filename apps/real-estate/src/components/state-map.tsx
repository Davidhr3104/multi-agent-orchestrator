"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { cn } from "@/lib/utils";

export type StateMapValue = { bucket: number | null; label: string };

type Basemap = "map" | "satellite" | "minimal";
const BASEMAPS: { id: Basemap; label: string }[] = [
  { id: "map", label: "Map" },
  { id: "satellite", label: "Satellite" },
  { id: "minimal", label: "Minimal" },
];
const STYLE_KEY = "helix-re:map-style";

const US_VIEW: [L.LatLngTuple, number] = [[39.5, -97], 4];
const BUCKET_OPACITY = [0.12, 0.28, 0.45, 0.65, 0.85];
/** Street and satellite tiles already carry detail, so the state fill is lighter to keep them readable. */
const FILL_SCALE: Record<Basemap, number> = { map: 0.9, satellite: 0.8, minimal: 1 };
const ESRI = (service: string) => `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`;
const ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, HERE, Garmin, Maxar, USGS, NGA and the GIS user community';

function tileUrls(kind: Basemap, dark: boolean): { base: string; labels: string | null } {
  if (kind === "satellite") return { base: ESRI("World_Imagery"), labels: ESRI("Reference/World_Boundaries_and_Places") };
  if (kind === "minimal") {
    const tone = dark ? "Dark" : "Light";
    return { base: ESRI(`Canvas/World_${tone}_Gray_Base`), labels: ESRI(`Canvas/World_${tone}_Gray_Reference`) };
  }
  return { base: ESRI("World_Street_Map"), labels: null };
}

const isDark = () => document.documentElement.classList.contains("dark");
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const savedBasemap = (): Basemap => {
  const v = localStorage.getItem(STYLE_KEY);
  return v === "satellite" || v === "minimal" ? v : "map";
};

/** Pan/zoom map of US states over street, satellite or minimal tiles. Values are keyed by state name, as in the GeoJSON. */
export default function StateMap({ values, selected, onSelect }: { values: Record<string, StateMapValue>; selected: string; onSelect: (name: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<{ base: L.TileLayer; labels: L.TileLayer } | null>(null);
  const states = useRef<L.GeoJSON | null>(null);
  const [basemap, setBasemap] = useState<Basemap>(savedBasemap);
  const latest = useRef({ values, selected, onSelect, basemap });
  const flownTo = useRef(selected);
  const [geo, setGeo] = useState<GeoJSON.FeatureCollection | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    latest.current = { values, selected, onSelect, basemap };
  });

  const style = (f?: GeoJSON.Feature): L.PathOptions => {
    const name = String(f?.properties?.name ?? "");
    const { values: vs, selected: sel, basemap: kind } = latest.current;
    const v = vs[name];
    const dark = isDark();
    const onImagery = kind === "satellite";
    return {
      fillColor: v?.bucket == null ? (dark ? "#334155" : "#cbd5e1") : cssVar("--primary") || "#c9a227",
      fillOpacity: (v?.bucket == null ? 0.3 : BUCKET_OPACITY[v.bucket]) * FILL_SCALE[kind],
      color: name === sel ? (onImagery ? "#fff" : cssVar("--foreground") || "#fff") : onImagery || dark ? "rgba(255,255,255,0.5)" : "rgba(70,50,10,0.45)",
      weight: name === sel ? 3 : 1,
    };
  };

  const applyTiles = () => {
    const m = map.current;
    const t = tiles.current;
    if (!m || !t) return;
    const urls = tileUrls(latest.current.basemap, isDark());
    t.base.setUrl(urls.base);
    if (urls.labels) {
      t.labels.setUrl(urls.labels);
      if (!m.hasLayer(t.labels)) t.labels.addTo(m);
    } else if (m.hasLayer(t.labels)) {
      t.labels.remove();
    }
    states.current?.setStyle(style);
  };

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: US_VIEW[0], zoom: US_VIEW[1], minZoom: 3, maxZoom: 13, zoomSnap: 0.5, worldCopyJump: true });
    m.createPane("labels");
    const labelPane = m.getPane("labels")!;
    labelPane.style.zIndex = "450";
    labelPane.style.pointerEvents = "none";
    const urls = tileUrls(latest.current.basemap, isDark());
    const base = L.tileLayer(urls.base, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(m);
    const labels = L.tileLayer(urls.labels ?? urls.base, { pane: "labels", maxZoom: 19 });
    if (urls.labels) labels.addTo(m);
    tiles.current = { base, labels };
    map.current = m;

    const theme = new MutationObserver(applyTiles);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    fetch("/geo/us-states.json")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setGeo)
      .catch(() => setFailed(true));

    return () => {
      theme.disconnect();
      m.remove();
      map.current = null;
      tiles.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the map is created once; handlers read the latest props from a ref
  }, []);

  useEffect(() => {
    localStorage.setItem(STYLE_KEY, basemap);
    applyTiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyTiles reads the latest basemap from a ref
  }, [basemap]);

  useEffect(() => {
    const m = map.current;
    if (!m || !geo) return;
    const layer = L.geoJSON(geo, {
      style,
      onEachFeature: (f, l) => {
        const name = String(f.properties?.name ?? "");
        l.bindTooltip(() => `<strong>${name}</strong><br/>${latest.current.values[name]?.label ?? "No data"}`, { sticky: true, direction: "top", className: "helix-map-tip" });
        l.on({
          mouseover: (e) => {
            const p = e.target as L.Path;
            p.setStyle({ weight: 2.5, color: latest.current.basemap === "satellite" ? "#fff" : cssVar("--foreground") || "#fff" });
            p.bringToFront();
          },
          mouseout: (e) => layer.resetStyle(e.target as L.Path),
          click: () => latest.current.values[name] && latest.current.onSelect(name),
        });
      },
    }).addTo(m);
    states.current = layer;
    return () => {
      layer.remove();
      states.current = null;
    };
  }, [geo]);

  useEffect(() => {
    const layer = states.current;
    if (!layer) return;
    layer.setStyle(style);
    if (flownTo.current === selected) return;
    flownTo.current = selected;
    const target = layer.getLayers().find((l) => (l as L.Polygon).feature?.properties?.name === selected) as L.Polygon | undefined;
    if (target) map.current?.flyToBounds(target.getBounds(), { padding: [40, 40], maxZoom: 6.5, duration: 0.8 });
  }, [values, selected, geo]);

  return (
    <div className="relative isolate z-0 h-[40rem] overflow-hidden rounded-xl border border-border">
      <div ref={el} className="size-full bg-muted" aria-label="Map of US states. Use the ranking list for a keyboard-friendly view." role="region" />
      <button
        type="button"
        onClick={() => map.current?.flyTo(US_VIEW[0], US_VIEW[1], { duration: 0.8 })}
        className="glass-panel absolute top-3 right-3 z-[1000] inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition hover:text-primary"
      >
        <LocateFixed className="size-3.5" aria-hidden />
        Whole US
      </button>
      <div role="radiogroup" aria-label="Map style" className="glass-panel absolute bottom-7 left-3 z-[1000] flex gap-1 rounded-lg p-1">
        {BASEMAPS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={basemap === b.id}
            onClick={() => setBasemap(b.id)}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition",
              basemap === b.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
      {failed ? <p className="absolute inset-x-0 bottom-16 z-[1000] text-center text-xs text-rose-300">Couldn&apos;t load state shapes.</p> : null}
    </div>
  );
}
