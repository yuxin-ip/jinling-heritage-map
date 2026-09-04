import type { HeritageSite } from './heritage-data';

export type MapSelection = { siteId: string; childName?: string } | null;

/** Keep the catalogue intact; narrow only the points passed to the map. */
export function selectMapSites(
  sites: HeritageSite[],
  selection: MapSelection,
): HeritageSite[] {
  if (!selection) return sites;
  const site = sites.find((item) => item.id === selection.siteId);
  if (!site) return [];
  if (!selection.childName) return [site];
  const child = site.subItems?.find(
    (item) => item.name === selection.childName,
  );
  return child ? [{ ...site, subItems: [child] }] : [];
}
