import type { HeritageSite } from './heritage-data';

export type MapSelection = { siteId: string; childName?: string };

export function isMapSelected(
  selections: MapSelection[],
  siteId: string,
  childName?: string,
): boolean {
  return selections.some(
    (item) =>
      item.siteId === siteId &&
      (!item.childName || item.childName === childName),
  );
}

/** Parent selections cover all children. Clicking one of those children excludes it. */
export function toggleMapSelection(
  sites: HeritageSite[],
  selections: MapSelection[],
  target: MapSelection,
): MapSelection[] {
  const site = sites.find((item) => item.id === target.siteId);
  if (
    !site ||
    (target.childName &&
      !site.subItems?.some((item) => item.name === target.childName))
  )
    return selections;
  const otherSites = selections.filter((item) => item.siteId !== target.siteId);
  const parentSelected = selections.some(
    (item) => item.siteId === target.siteId && !item.childName,
  );
  if (!target.childName)
    return parentSelected
      ? otherSites
      : [...otherSites, { siteId: target.siteId }];

  const childNames = new Set(
    parentSelected
      ? site.subItems!.map((item) => item.name)
      : selections
          .filter((item) => item.siteId === target.siteId && item.childName)
          .map((item) => item.childName!),
  );
  if (childNames.has(target.childName)) childNames.delete(target.childName);
  else childNames.add(target.childName);
  if (site.subItems!.every((item) => childNames.has(item.name)))
    return [...otherSites, { siteId: target.siteId }];
  return [
    ...otherSites,
    ...Array.from(childNames, (childName) => ({
      siteId: target.siteId,
      childName,
    })),
  ];
}

/** Keep the catalogue intact; narrow only the points passed to the map. */
export function selectMapSites(
  sites: HeritageSite[],
  selections: MapSelection[],
): HeritageSite[] {
  if (!selections.length) return sites;
  return sites.flatMap((site) => {
    const selected = selections.filter((item) => item.siteId === site.id);
    if (!selected.length) return [];
    if (selected.some((item) => !item.childName)) return [site];
    const children = site.subItems?.filter((item) =>
      selected.some((selection) => selection.childName === item.name),
    );
    return children?.length ? [{ ...site, subItems: children }] : [];
  });
}
