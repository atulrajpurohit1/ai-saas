'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Layers, Loader2, Maximize2, MapPinOff, Minimize2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Raster tiles come from OpenStreetMap by default: free, key-less, and good
// enough for "where is this checkpoint / where did the guard walk". Both
// values are overridable so a tenant that needs a commercial provider (or an
// on-prem tile server, for sites whose coordinates must not leave their
// network) can point this at another endpoint without a code change.
const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
const MAX_ZOOM = 19;
// Zoom used when focusing a single point - close enough to see the doorway a
// checkpoint sits at, not so close that the rest of the site is lost.
const FOCUS_ZOOM = 18;

export type MapPointTone = 'checkpoint' | 'scanned' | 'issue' | 'missed' | 'guard';

const TONE_COLORS: Record<MapPointTone, string> = {
  checkpoint: '#2563eb', // --info
  scanned: '#059669', // --success
  issue: '#d97706', // --warning
  missed: '#dc2626', // --error
  guard: '#e0221f', // --primary
};

export interface MapPoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  /** Secondary line in the popup - a location note, a scan time, etc. */
  sublabel?: string | null;
  tone?: MapPointTone;
  /**
   * Explicit pin colour, for scales the fixed tone set can't express (e.g. a
   * four-step incident-severity ramp). Overrides `tone` when set.
   */
  color?: string;
  /** Short text drawn inside the pin: a route sequence number, usually. */
  badge?: string | number | null;
  /** Draws the checkpoint's geofence as a circle when set. */
  radiusMeters?: number | null;
  /** Marks the point as the guard's live position (adds a pulsing halo). */
  pulse?: boolean;
}

export interface PatrolMapProps {
  points: MapPoint[];
  /**
   * Ordered positions the guard was actually at, drawn as a walked path.
   * Deliberately separate from `points`: the trail is where the guard WAS,
   * the points are where the checkpoints ARE, and the gap between the two is
   * the whole reason a supervisor opens this map.
   */
  trail?: Array<{ latitude: number; longitude: number }>;
  /** Pans to this point and opens its popup. */
  focusId?: string | null;
  /** Bump to re-focus the same point again (e.g. a second click on a row). */
  focusNonce?: number;
  heightClassName?: string;
  /** Shown when no point has coordinates. */
  emptyTitle?: string;
  emptyHint?: string;
  /** Count of records that exist but have no GPS, surfaced as a footnote. */
  missingCoordinatesCount?: number;
  onPointClick?: (id: string) => void;
  className?: string;
  /** Hides the expand control where it would be redundant (inside a modal). */
  allowFullscreen?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Built as raw HTML rather than Leaflet's default PNG marker: the default
// icon's image paths break under bundlers, and a div icon lets each pin carry
// its sequence number and verification colour directly.
function pointColor(point: MapPoint): string {
  return point.color || TONE_COLORS[point.tone || 'checkpoint'];
}

function pinHtml(point: MapPoint): string {
  const color = pointColor(point);
  const badge = point.badge === null || point.badge === undefined ? '' : String(point.badge);
  const pulse = point.pulse
    ? `<span style="position:absolute;left:13px;top:13px;width:34px;height:34px;margin-left:-17px;margin-top:-17px;border-radius:9999px;background:${color};opacity:0.3;animation:aegis-map-pulse 1.8s ease-out infinite;"></span>`
    : '';
  return [
    '<div style="position:relative;width:26px;height:34px;">',
    pulse,
    `<div style="position:absolute;left:50%;top:22px;margin-left:-5px;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:10px solid #fff;"></div>`,
    `<div style="position:absolute;left:50%;top:21px;margin-left:-4px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:8px solid ${color};"></div>`,
    `<div style="position:absolute;left:0;top:0;width:26px;height:26px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(17,24,39,0.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;line-height:1;">${escapeHtml(badge)}</div>`,
    '</div>',
  ].join('');
}

function popupHtml(point: MapPoint): string {
  const mapsUrl = `https://www.google.com/maps?q=${point.latitude},${point.longitude}`;
  const sub = point.sublabel
    ? `<div style="margin-top:2px;color:#6b7280;font-size:11px;line-height:1.4;white-space:pre-line;">${escapeHtml(point.sublabel)}</div>`
    : '';
  const radius =
    typeof point.radiusMeters === 'number' && point.radiusMeters > 0
      ? `<div style="margin-top:4px;color:#2563eb;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Geofence ${point.radiusMeters}m</div>`
      : '';
  return [
    '<div style="min-width:170px;font-family:inherit;">',
    `<div style="font-weight:700;font-size:13px;color:#111827;line-height:1.3;">${escapeHtml(point.label)}</div>`,
    sub,
    radius,
    `<div style="margin-top:6px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;color:#6b7280;">${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}</div>`,
    `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="margin-top:6px;display:inline-block;font-size:11px;font-weight:700;color:#2563eb;text-decoration:none;">Open in Google Maps &rarr;</a>`,
    '</div>',
  ].join('');
}

function isUsable(point: { latitude: number; longitude: number }): boolean {
  return (
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180 &&
    !(point.latitude === 0 && point.longitude === 0)
  );
}

/**
 * The shared patrol map. Leaflet is loaded lazily inside an effect because it
 * touches `window` at import time and this app server-renders every page.
 */
export default function PatrolMap({
  points,
  trail,
  focusId,
  focusNonce = 0,
  heightClassName = 'h-[420px]',
  emptyTitle = 'Nothing to map yet',
  emptyHint = 'Add GPS coordinates to see these on a map.',
  missingCoordinatesCount = 0,
  onPointClick,
  className = '',
  allowFullscreen = true,
}: PatrolMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const [ready, setReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '');

  const usablePoints = useMemo(() => points.filter(isUsable), [points]);
  const usableTrail = useMemo(() => (trail || []).filter(isUsable), [trail]);
  const hasData = usablePoints.length > 0 || usableTrail.length > 0;

  // Only a change in the actual geometry should re-fit the view. Re-renders
  // from polling (a refreshed timestamp, a new badge) must not yank the map
  // back out from under someone who has panned in to look at something.
  const geometrySignature = useMemo(
    () =>
      JSON.stringify([
        usablePoints.map((p) => [p.id, p.latitude, p.longitude, p.radiusMeters ?? null]),
        usableTrail.map((p) => [p.latitude, p.longitude]),
      ]),
    [usablePoints, usableTrail],
  );

  const onPointClickRef = useRef(onPointClick);
  useEffect(() => {
    onPointClickRef.current = onPointClick;
  }, [onPointClick]);

  // --- create the map once -------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const leaflet = await import('leaflet');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const L = ((leaflet as any).default || leaflet) as any;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        // A trackpad scroll past the map must not zoom it; clicking the map
        // first enables the wheel, and leaving it disables it again.
        scrollWheelZoom: false,
        attributionControl: true,
      }).setView([20, 0], 2);

      L.tileLayer(TILE_URL, {
        maxZoom: MAX_ZOOM,
        attribution: TILE_ATTRIBUTION,
      }).addTo(map);

      map.on('click', () => {
        if (!map.scrollWheelZoom.enabled()) map.scrollWheelZoom.enable();
      });
      // `mouseleave` on the container rather than Leaflet's own mouseout:
      // it does not bubble, so moving between the map's own panes and
      // controls cannot spuriously switch the wheel back off.
      containerRef.current.addEventListener('mouseleave', () => map.scrollWheelZoom.disable());

      leafletRef.current = L;
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setReady(true);
    }

    void init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        markersRef.current = {};
      }
    };
  }, []);

  // --- draw markers, geofences and the walked trail ------------------------
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;

    layer.clearLayers();
    markersRef.current = {};

    if (usableTrail.length > 1) {
      L.polyline(
        usableTrail.map((p) => [p.latitude, p.longitude]),
        { color: '#2563eb', weight: 3, opacity: 0.75, dashArray: '6 6', lineJoin: 'round' },
      ).addTo(layer);
    }

    usablePoints.forEach((point) => {
      if (typeof point.radiusMeters === 'number' && point.radiusMeters > 0) {
        const color = pointColor(point);
        L.circle([point.latitude, point.longitude], {
          radius: point.radiusMeters,
          color,
          weight: 1,
          opacity: 0.5,
          fillColor: color,
          fillOpacity: 0.08,
        }).addTo(layer);
      }

      const marker = L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({
          html: pinHtml(point),
          className: 'aegis-map-pin',
          iconSize: [26, 34],
          iconAnchor: [13, 34],
          popupAnchor: [0, -30],
        }),
        title: point.label,
      })
        .bindPopup(popupHtml(point))
        .addTo(layer);

      marker.on('click', () => onPointClickRef.current?.(point.id));
      markersRef.current[point.id] = marker;
    });
  }, [ready, usablePoints, usableTrail]);

  // --- fit the view to the data -------------------------------------------
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !hasData) return;

    const coords = [
      ...usablePoints.map((p) => [p.latitude, p.longitude] as [number, number]),
      ...usableTrail.map((p) => [p.latitude, p.longitude] as [number, number]),
    ];
    if (coords.length === 1) {
      map.setView(coords[0], FOCUS_ZOOM);
      return;
    }
    map.fitBounds(L.latLngBounds(coords).pad(0.2), { maxZoom: FOCUS_ZOOM });
    // geometrySignature is the intentional trigger: the arrays it summarises
    // get a new identity on every poll even when the coordinates are identical.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, geometrySignature, hasData]);

  // --- focus one point on request ------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focusId) return;
    const marker = markersRef.current[focusId];
    if (!marker) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), FOCUS_ZOOM), { duration: 0.6 });
    marker.openPopup();
  }, [ready, focusId, focusNonce]);

  // Leaflet measures its container when it is created, so any later resize
  // (expanding to full screen, a panel opening) needs an explicit invalidate.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const timer = setTimeout(() => map.invalidateSize(), 220);
    return () => clearTimeout(timer);
  }, [ready, fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const handleResize = useCallback(() => {
    const map = mapRef.current;
    if (map) map.invalidateSize();
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [ready, handleResize]);

  return (
    <div
      className={
        fullscreen ? 'fixed inset-0 z-[200] flex flex-col bg-background p-4' : `relative ${className}`
      }
    >
      {/* Leaflet renders outside React, so its chrome is themed here. The
          per-instance class keeps these rules from leaking to other maps. */}
      <style>{`@keyframes aegis-map-pulse{0%{transform:scale(0.6);opacity:0.45}70%{transform:scale(1.6);opacity:0}100%{transform:scale(1.6);opacity:0}}
.aegis-map-${instanceId} .leaflet-container{font:inherit;background:#eef1f5}
.aegis-map-${instanceId} .leaflet-popup-content-wrapper{border-radius:10px;box-shadow:0 12px 32px rgba(17,24,39,0.18)}
.aegis-map-${instanceId} .leaflet-popup-content{margin:10px 12px}
.aegis-map-${instanceId} .leaflet-bar a{color:#111827}
.aegis-map-${instanceId} .leaflet-control-attribution{font-size:10px;background:rgba(255,255,255,0.85)}`}</style>

      <div
        className={`aegis-map-${instanceId} relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted ${
          fullscreen ? 'flex-1' : heightClassName
        }`}
      >
        <div ref={containerRef} className="h-full w-full" />

        {!ready && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center gap-2 bg-muted text-sm font-semibold text-muted-foreground">
            <Loader2 className="animate-spin" size={16} />
            Loading map…
          </div>
        )}

        {ready && !hasData && (
          <div className="absolute inset-0 z-[900] flex flex-col items-center justify-center gap-1 bg-muted/95 px-6 text-center">
            <MapPinOff className="mb-1 text-muted-foreground" size={22} />
            <p className="text-sm font-bold text-foreground">{emptyTitle}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{emptyHint}</p>
          </div>
        )}

        {allowFullscreen && ready && (
          <button
            type="button"
            onClick={() => setFullscreen((v) => !v)}
            className="absolute right-3 top-3 z-[1000] inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-muted"
            title={fullscreen ? 'Exit full screen (Esc)' : 'Expand map'}
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {fullscreen ? 'Close' : 'Expand'}
          </button>
        )}
      </div>

      {missingCoordinatesCount > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPinOff size={12} />
          {missingCoordinatesCount} {missingCoordinatesCount === 1 ? 'record has' : 'records have'} no
          GPS coordinates, so {missingCoordinatesCount === 1 ? 'it is' : 'they are'} not on the map.
        </p>
      )}
    </div>
  );
}

/** Small shared legend, so every map in the app explains its own colours. */
export function PatrolMapLegend({
  items,
  className = '',
}: {
  // Each swatch is coloured by an explicit `color` when given, else by `tone`.
  items: Array<{ tone?: MapPointTone; color?: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Layers size={12} />
        Legend
      </span>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white"
            style={{ background: item.color || TONE_COLORS[item.tone || 'checkpoint'] }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export { TONE_COLORS };
