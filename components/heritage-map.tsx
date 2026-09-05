'use client';
import { useEffect, useRef } from 'react';
import type { HeritageSite, VisitState } from '@/lib/heritage-data';

type MappedSite = HeritageSite & { status: VisitState };

type MapPoint = {
  id: string;
  parentId: string;
  name: string;
  parentName: string;
  address: string;
  lat: number;
  lng: number;
  status: VisitState;
};

function mapPoints(sites: MappedSite[]): MapPoint[] {
  return sites.flatMap((site) => {
    if (!site.subItems?.length) {
      return [
        {
          id: site.id,
          parentId: site.id,
          name: site.name,
          parentName: site.name,
          address: `${site.district} · ${site.address}`,
          lat: site.lat,
          lng: site.lng,
          status: site.status,
        },
      ];
    }
    return site.subItems.map((item, index) => ({
      id: `${site.id}-${index}`,
      parentId: site.id,
      name: item.name,
      parentName: site.name,
      address: item.address || site.district,
      lat: item.lat,
      lng: item.lng,
      status: item.visited
        ? 'visited'
        : item.uncertain
          ? 'partial'
          : 'unvisited',
    }));
  });
}
export function HeritageMap({
  sites,
  highlightSelection,
  onSelect,
}: {
  sites: MappedSite[];
  highlightSelection: boolean;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import('leaflet').then(({ default: L }) => {
      if (cancelled || !container.current) return;
      const points = mapPoints(sites);
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
      points.forEach((point) => {
        const icon = L.divIcon({
          className: 'heritage-marker-wrap',
          html: `<span class="heritage-marker ${point.status} ${highlightSelection ? 'selected' : ''}"></span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const marker = L.marker([point.lat, point.lng], { icon })
          .addTo(map)
          .bindTooltip(
            `<strong>${point.name}</strong><br/><span>${point.parentName !== point.name ? `${point.parentName} · ` : ''}${point.status === 'visited' ? '已到访' : point.status === 'partial' ? '待确认' : '未到访'}</span><br/><small>${point.address}</small>`,
            { direction: 'top', offset: [0, -9] },
          );
        marker.on('click', () => selectRef.current(point.parentId));
        bounds.extend([point.lat, point.lng]);
      });
      if (points.length > 1)
        map.fitBounds(bounds, {
          paddingTopLeft: [42, 160],
          paddingBottomRight: [42, 70],
          maxZoom: 16,
        });
      else if (points.length === 1)
        map.setView([points[0].lat, points[0].lng], 16);
      dispose = () => map.remove();
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [sites, highlightSelection]);
  return <div className="map-canvas" ref={container} />;
}
