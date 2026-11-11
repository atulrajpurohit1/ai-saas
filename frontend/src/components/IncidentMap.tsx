'use client';

import React, { useMemo } from 'react';
import PatrolMap, { MapPoint, PatrolMapLegend } from '@/components/PatrolMap';
import { Incident } from '@/lib/incidents';
import {
  deriveSiteLocations,
  jitterAround,
  severityColor,
  INCIDENT_SEVERITY_COLORS,
  IncidentSeverity,
} from '@/lib/site-geo';
import { Checkpoint } from '@/lib/patrols';
import { formatDateTime as fmtDateTime, formatEnumLabel } from '@/lib/format';

const SEVERITY_ORDER: IncidentSeverity[] = ['low', 'medium', 'high', 'critical'];

export interface IncidentMapProps {
  incidents: Incident[];
  /** All checkpoints for the tenant - used to derive each site's location. */
  checkpoints: Checkpoint[];
  focusId?: string | null;
  focusNonce?: number;
  heightClassName?: string;
  onIncidentClick?: (id: string) => void;
}

/**
 * Incidents plotted on a map. Each incident has no GPS of its own, so it is
 * placed at its site's derived location (the centroid of that site's
 * checkpoints) with a small deterministic offset so several incidents at one
 * site stay individually clickable. Pins are coloured by severity.
 */
export default function IncidentMap({
  incidents,
  checkpoints,
  focusId,
  focusNonce,
  heightClassName = 'h-[480px]',
  onIncidentClick,
}: IncidentMapProps) {
  const siteLocations = useMemo(() => deriveSiteLocations(checkpoints), [checkpoints]);

  const { points, mappable, unmappable } = useMemo(() => {
    const pts: MapPoint[] = [];
    let mapped = 0;
    let unmapped = 0;

    for (const incident of incidents) {
      const center = siteLocations.get(incident.siteId);
      if (!center) {
        unmapped += 1;
        continue;
      }
      mapped += 1;
      const pos = jitterAround(center, incident.id);
      pts.push({
        id: incident.id,
        latitude: pos.latitude,
        longitude: pos.longitude,
        label: incident.title,
        sublabel: [
          `${formatEnumLabel(incident.severity)} · ${formatEnumLabel(incident.status)}`,
          incident.site.name,
          incident.guard?.name ? `Reported by ${incident.guard.name}` : null,
          fmtDateTime(incident.occurredAt),
          incident.description,
        ]
          .filter(Boolean)
          .join('\n'),
        color: severityColor(incident.severity),
      });
    }
    return { points: pts, mappable: mapped, unmappable: unmapped };
  }, [incidents, siteLocations]);

  // Only the severities actually present, so the legend doesn't advertise
  // colours that aren't on the map.
  const presentSeverities = useMemo(() => {
    const set = new Set(incidents.map((i) => i.severity));
    return SEVERITY_ORDER.filter((s) => set.has(s));
  }, [incidents]);

  return (
    <div>
      <PatrolMap
        points={points}
        focusId={focusId}
        focusNonce={focusNonce}
        heightClassName={heightClassName}
        missingCoordinatesCount={unmappable}
        onPointClick={onIncidentClick}
        emptyTitle="No incidents to map"
        emptyHint="Incidents are placed at their site's location, derived from that site's GPS checkpoints. None of the incidents shown have a site with GPS checkpoints yet."
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <PatrolMapLegend
          items={presentSeverities.map((s) => ({
            color: INCIDENT_SEVERITY_COLORS[s],
            label: formatEnumLabel(s),
          }))}
        />
        <span className="text-xs text-muted-foreground">
          {mappable} of {incidents.length} shown · pins are approximate (site location).
        </span>
      </div>
    </div>
  );
}
