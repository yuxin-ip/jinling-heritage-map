'use client';
import { useEffect, useRef } from 'react';
import type { HeritageSite, VisitState } from '@/lib/heritage-data';

type MappedSite = HeritageSite & { status: VisitState };
export function HeritageMap({
  sites,
  selectedId,
  onSelect,
}: {
  sites: MappedSite[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import('leaflet').then(({ default: L }) => {
      if (cancelled || !container.current) return;
      const map = L.map(container.current, {
        zoomControl: false,
        attributionControl: true,
        minZoom: 8,
      }).setView([32.01, 118.81], 10);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);
      const bounds = L.latLngBounds([]);
      sites.forEach((site) => {
        const icon = L.divIcon({
          className: 'heritage-marker-wrap',
          html: `<span class="heritage-marker ${site.status} ${site.id === selectedId ? 'selected' : ''}"></span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const marker = L.marker([site.lat, site.lng], { icon })
          .addTo(map)
          .bindTooltip(
            `<strong>${site.name}</strong><br/><span>${site.district} · ${site.status === 'visited' ? '已到访' : site.status === 'partial' ? '部分到访' : '未到访'}</span>`,
            { direction: 'top', offset: [0, -9] },
          );
        marker.on('click', () => selectRef.current(site.id));
        bounds.extend([site.lat, site.lng]);
      });
      if (sites.length > 1)
        map.fitBounds(bounds, { padding: [42, 42], maxZoom: 12 });
      else if (sites.length === 1)
        map.setView([sites[0].lat, sites[0].lng], 14);
      dispose = () => map.remove();
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [sites, selectedId]);
  return <div className="map-canvas" ref={container} />;
}
