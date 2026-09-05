import type { HeritageSite, SubItem } from './heritage-data';

export type VisitChoice = 'auto' | 'visited-no-photo' | 'unvisited';
export type AccessChoice = 'unknown' | 'open' | 'closed';
export type CloudRecords = Record<string, string>;
export type PersonalPhoto = {
  id: string;
  point_key: string;
  storage_path: string;
  filename: string;
  url: string;
};
export const pointKey = (siteId: string, childName = '') =>
  JSON.stringify([siteId, childName]);
export const recordKey = (point: string, field: 'visit' | 'access') =>
  `${point}::${field}`;

export function applyVisitRecords(
  site: HeritageSite,
  records: CloudRecords,
  photos: PersonalPhoto[],
): HeritageSite {
  function resolvePoint<
    T extends { photos?: string[]; visited?: boolean; uncertain?: boolean },
  >(point: T, key: string) {
    const uploaded = photos
      .filter((photo) => photo.point_key === key)
      .map((photo) => photo.url);
    const visit = records[recordKey(key, 'visit')];
    const access = records[recordKey(key, 'access')];
    const visited =
      visit === 'unvisited'
        ? false
        : visit === 'visited-no-photo' || uploaded.length > 0
          ? true
          : point.visited;
    return {
      ...point,
      visited,
      uncertain:
        visit === 'unvisited' ||
        visit === 'visited-no-photo' ||
        uploaded.length > 0
          ? false
          : point.uncertain,
      access:
        access === 'closed' || access === 'open'
          ? access
          : ('unknown' as AccessChoice),
      photos: [...(point.photos || []), ...uploaded],
    };
  }
  const base = resolvePoint(
    { ...site, visited: site.visited ?? Boolean(site.photos?.length) },
    pointKey(site.id),
  );
  const subItems = site.subItems?.map((item) =>
    resolvePoint(item, pointKey(site.id, item.name)),
  );
  const childUploads = photos
    .filter((photo) =>
      subItems?.some(
        (item) => photo.point_key === pointKey(site.id, item.name),
      ),
    )
    .map((photo) => photo.url);
  return { ...base, subItems, photos: [...base.photos, ...childUploads] };
}

export function recordStatistics(sites: HeritageSite[]) {
  const points = sites.flatMap<HeritageSite | SubItem>(
    (site) =>
      site.subItems?.filter((item) => item.official !== false) || [site],
  );
  return {
    total: points.length,
    visited: points.filter((item) => item.visited).length,
    noPhoto: points.filter((item) => item.visited && !item.photos?.length)
      .length,
    closed: points.filter((item) => item.access === 'closed').length,
  };
}
