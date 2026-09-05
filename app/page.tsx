'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  Landmark,
  Layers3,
  MapPin,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { HeritageMap } from '@/components/heritage-map';
import { CloudAccount, RecordEditor } from '@/components/cloud-records';
import { useHeritageCloud } from '@/hooks/use-heritage-cloud';
import { applyVisitRecords, recordStatistics } from '@/lib/visit-records';
import {
  selectMapSites,
  toggleMapSelection,
  isMapSelected,
  type MapSelection,
} from '@/lib/map-selection';
import {
  isConfirmed,
  parseAnswers,
  resolveConfirmations,
  type Answers,
} from '@/lib/confirmations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  getVisitState,
  officialSource,
  pendingConfirmations,
  sites,
  type VisitState,
} from '@/lib/heritage-data';

type Filter = 'all' | VisitState;
const statusCopy: Record<VisitState, { label: string; note: string }> = {
  visited: { label: '已到访', note: '已有到访记录' },
  partial: { label: '部分到访', note: '还有子项待探访' },
  unvisited: { label: '未到访', note: '尚未发现到访照片' },
};

function StatusIcon({ status }: { status: VisitState }) {
  return (
    <span className={`status-icon ${status}`} aria-hidden="true">
      {status === 'visited' ? (
        <Check />
      ) : status === 'partial' ? (
        <Clock3 />
      ) : (
        <Circle />
      )}
    </span>
  );
}

export default function Home() {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部类别');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapSelections, setMapSelections] = useState<MapSelection[]>([]);
  const [collapsedSites, setCollapsedSites] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [localAnswers, setLocalAnswers] = useState<Answers>({});
  const cloud = useHeritageCloud();
  const answers = useMemo(
    () =>
      cloud.user
        ? parseAnswers(
            Object.fromEntries(
              Object.entries(cloud.records)
                .filter(([key]) => key.startsWith('confirmation:'))
                .map(([key, value]) => [key.slice(13), value]),
            ),
          )
        : localAnswers,
    [cloud.user, cloud.records, localAnswers],
  );
  const [answersLoaded, setAnswersLoaded] = useState(false);
  const [confirmationError, setConfirmationError] = useState('');

  useEffect(() => {
    try {
      setLocalAnswers(
        parseAnswers(
          JSON.parse(
            localStorage.getItem('nanjing-heritage-confirmations') || '{}',
          ),
        ),
      );
    } catch {
      setConfirmationError(
        '无法读取当前浏览器的确认记录，请检查浏览器存储设置。',
      );
    } finally {
      setAnswersLoaded(true);
    }
  }, []);
  const resolved = useMemo(
    () =>
      sites.map((site) =>
        applyVisitRecords(
          resolveConfirmations(site, answers),
          cloud.records,
          cloud.photos,
        ),
      ),
    [answers, cloud.records, cloud.photos],
  );
  const visitedUnits = resolved.filter(
    (site) => getVisitState(site) !== 'unvisited',
  ).length;
  const pointStats = recordStatistics(resolved);
  const photoCount = new Set(resolved.flatMap((site) => site.photos || []))
    .size;
  const unresolvedConfirmations = pendingConfirmations.filter(
    (item) => !isConfirmed(item.id, answers[item.id]),
  );
  const unresolvedCount = unresolvedConfirmations.length;
  const categories = [
    '全部类别',
    ...Array.from(new Set(sites.map((site) => site.category))),
  ];
  const visibleSites = useMemo(
    () =>
      resolved.filter((site) => {
        const status = getVisitState(site);
        const normalized = query.trim().toLowerCase();
        const childText = site.subItems
          ?.map((item) => `${item.name}${item.address || ''}`)
          .join('');
        return (
          (!normalized ||
            `${site.name}${site.district}${site.era}${site.address}${childText || ''}`
              .toLowerCase()
              .includes(normalized)) &&
          (filter === 'all' || status === filter) &&
          (category === '全部类别' || site.category === category)
        );
      }),
    [resolved, query, filter, category],
  );
  const mappedSites = useMemo(
    () =>
      selectMapSites(visibleSites, mapSelections).map((site) => ({
        ...site,
        status: getVisitState(site),
      })),
    [visibleSites, mapSelections],
  );
  const mapPointCount = mappedSites.reduce(
    (total, site) => total + (site.subItems?.length || 1),
    0,
  );
  const selectionNames = mapSelections.map(
    (selection) =>
      selection.childName ||
      resolved.find((site) => site.id === selection.siteId)?.name ||
      '',
  );
  const selectedSite = resolved.find((site) => site.id === selectedId) ?? null;
  const selectedOfficialSubItems =
    selectedSite?.subItems?.filter((item) => item.official !== false) ?? [];
  const selectedVisitedPointCount = selectedOfficialSubItems.filter(
    (item) => item.visited,
  ).length;

  function focusMap(siteId: string, childName?: string) {
    setMapSelections((current) =>
      toggleMapSelection(resolved, current, { siteId, childName }),
    );
    setSelectedId(null);
  }

  function showAll() {
    setMapSelections([]);
    setQuery('');
    setFilter('all');
    setCategory('全部类别');
  }

  function toggleChildren(siteId: string) {
    setCollapsedSites((current) => {
      const next = new Set(current);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  }

  async function saveAnswer(id: string, value: string) {
    if (cloud.configured) {
      if (!cloud.user || !cloud.ready) {
        setConfirmationError(
          '请先通过顶部“跨设备同步”登录并读取记录，再确认。',
        );
        return;
      }
      if (await cloud.save(`confirmation:${id}`, value))
        setConfirmationError('');
      else setConfirmationError('尚未保存到云端，请检查网络后重试。');
      return;
    }
    const next = { ...answers, [id]: value };
    try {
      localStorage.setItem(
        'nanjing-heritage-confirmations',
        JSON.stringify(next),
      );
      setLocalAnswers(next);
      setConfirmationError('');
    } catch {
      setConfirmationError('未能保存确认结果，请检查浏览器存储空间后重试。');
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <Landmark />
        </div>
        <div className="brand-copy">
          <p className="eyebrow">我的国保足迹</p>
          <h1>金陵访古图</h1>
        </div>
        <div className="header-actions">
          <CloudAccount cloud={cloud} localAnswers={localAnswers} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="confirm-button"
            disabled={!answersLoaded || Boolean(cloud.user && !cloud.ready)}
          >
            {unresolvedCount ? <TriangleAlert /> : <Check />}
            {!answersLoaded
              ? '读取记录中'
              : unresolvedCount
                ? `待你确认 ${unresolvedCount}`
                : '全部已确认'}
          </Button>
          <a
            className="source-link"
            href={officialSource}
            target="_blank"
            rel="noreferrer"
          >
            官方名录 · 55处112点 <ExternalLink />
          </a>
        </div>
      </header>

      <section className="summary-strip" aria-label="到访统计">
        <div>
          <strong>{visitedUnits}</strong>
          <span>处已到访（含无照片）</span>
        </div>
        <div>
          <strong>{55 - visitedUnits}</strong>
          <span>处等待探访</span>
        </div>
        <div>
          <strong>{photoCount}</strong>
          <span>张南京留念照</span>
        </div>
        <div className="completion">
          <span>单位到访率</span>
          <b>{Math.round((visitedUnits / 55) * 100)}%</b>
          <i>
            <em style={{ width: `${(visitedUnits / 55) * 100}%` }} />
          </i>
        </div>
      </section>

      <section className="workspace">
        <aside className="catalog-panel">
          <div className="catalog-head">
            <div>
              <p className="eyebrow">全国重点文物保护单位</p>
              <h2>南京名录</h2>
            </div>
            <span className="progress-number">{visibleSites.length} / 55</span>
          </div>
          <div className="record-statistics" aria-label="点位统计">
            <span>
              已到访{' '}
              <b>
                {pointStats.visited}/{pointStats.total}
              </b>
            </span>
            <span>
              去过无照片 <b>{pointStats.noPhoto}</b>
            </span>
            <span>
              不对外开放 <b>{pointStats.closed}</b>
            </span>
            <small>
              按地图子项统计，含城墙拆分点；单位级未知子项记录不计入此处。
            </small>
          </div>
          <div className="search-wrap">
            <Search aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setMapSelections([]);
              }}
              aria-label="搜索文物保护单位"
              placeholder="搜索名称、区或年代"
            />
          </div>
          <div className="filter-toolbar">
            <div className="filter-row" aria-label="到访状态筛选">
              {(
                [
                  ['all', '全部'],
                  ['visited', '已到访'],
                  ['partial', '部分'],
                  ['unvisited', '未到访'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={filter === value ? 'default' : 'outline'}
                  onClick={() => {
                    setFilter(value);
                    setMapSelections([]);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <select
              aria-label="按类别筛选"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setMapSelections([]);
              }}
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <p className="catalog-hint">
            点击名称选中，再点取消；单位和子项可多选。清空选择后显示全部。
          </p>
          <div className="site-list">
            {visibleSites.map((site) => {
              const status = getVisitState(site);
              const officialPoints = site.subItems?.filter(
                (item) => item.official !== false,
              );
              const visitedPoints = officialPoints?.filter(
                (item) => item.visited,
              ).length;
              return (
                <section
                  className={`catalog-group ${mapSelections.some((selection) => selection.siteId === site.id) ? 'focused' : ''}`}
                  key={site.id}
                  aria-label={site.name}
                >
                  <button
                    className={`site-card ${isMapSelected(mapSelections, site.id) ? 'selected' : ''}`}
                    aria-pressed={isMapSelected(mapSelections, site.id)}
                    onClick={() => focusMap(site.id)}
                  >
                    <StatusIcon status={status} />
                    <span className="site-copy">
                      <strong>{site.name}</strong>
                      <small>
                        {site.district} · {site.era}
                      </small>
                      <em>
                        {site.subItems
                          ? `${visitedPoints}/${officialPoints?.length} 个子项 · ${statusCopy[status].label}`
                          : statusCopy[status].note}
                      </em>
                    </span>
                    {site.photos?.[0] ? (
                      <img src={site.photos[0]} alt="" loading="lazy" />
                    ) : (
                      <span className="empty-thumb">
                        <Landmark />
                      </span>
                    )}
                    <ChevronRight className="card-arrow" />
                  </button>
                  <div className="catalog-group-actions">
                    {site.subItems && (
                      <button
                        aria-expanded={!collapsedSites.has(site.id)}
                        aria-controls={`children-${site.id}`}
                        onClick={() => toggleChildren(site.id)}
                      >
                        <ChevronDown
                          className={
                            collapsedSites.has(site.id) ? 'collapsed' : ''
                          }
                        />
                        {collapsedSites.has(site.id) ? '展开' : '收起'}{' '}
                        {site.subItems.length} 个子项
                      </button>
                    )}
                    <button
                      className="catalog-details"
                      onClick={() => setSelectedId(site.id)}
                    >
                      照片与记录 <ChevronRight />
                    </button>
                  </div>
                  {site.subItems && (
                    <ul
                      className="catalog-children"
                      id={`children-${site.id}`}
                      hidden={collapsedSites.has(site.id)}
                    >
                      {site.subItems.map((item) => {
                        const childStatus = item.visited
                          ? 'visited'
                          : item.uncertain
                            ? 'partial'
                            : 'unvisited';
                        const active = isMapSelected(
                          mapSelections,
                          site.id,
                          item.name,
                        );
                        return (
                          <li key={item.name}>
                            <button
                              className={`catalog-child ${active ? 'selected' : ''}`}
                              aria-pressed={active}
                              onClick={() => focusMap(site.id, item.name)}
                            >
                              <i
                                className={`dot ${childStatus}`}
                                aria-hidden="true"
                              />
                              <span>
                                {item.name}
                                {item.official === false && (
                                  <small>补充现场碑记录</small>
                                )}
                                {item.access === 'closed' && (
                                  <small>不对外开放</small>
                                )}
                              </span>
                              <em>
                                {item.visited
                                  ? '已到访'
                                  : item.uncertain
                                    ? '待确认'
                                    : '未到访'}
                              </em>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
            {!visibleSites.length && (
              <div className="no-results">
                <Search />
                <strong>没有找到匹配项</strong>
                <span>试试更换关键词或筛选条件</span>
              </div>
            )}
          </div>
        </aside>

        <section
          className="map-panel"
          aria-label="南京全国重点文物保护单位地图"
        >
          <HeritageMap
            sites={mappedSites}
            highlightSelection={mapSelections.length > 0}
            onSelect={setSelectedId}
          />
          <div className="map-legend">
            <span>
              <i className="dot visited" />
              已到访
            </span>
            <span>
              <i className="dot partial" />
              待确认
            </span>
            <span>
              <i className="dot unvisited" />
              未到访
            </span>
          </div>
          <div className="map-scope">
            <span aria-live="polite">
              <small>
                {mapSelections.length
                  ? `多选中 · ${mapSelections.length} 项`
                  : '当前地图'}{' '}
                · {mapPointCount} 个点位
              </small>
              <strong title={selectionNames.join('、')}>
                {selectionNames.length
                  ? `${selectionNames.slice(0, 2).join('、')}${selectionNames.length > 2 ? `等 ${selectionNames.length} 项` : ''}`
                  : '全部匹配地点'}
              </strong>
            </span>
            <Button size="sm" variant="outline" onClick={showAll}>
              显示全部
            </Button>
          </div>
          <div className="map-note">
            <Layers3 />
            多点项目已逐个标出子项；南京城墙按重要门址、城段和水关展示。
          </div>
        </section>
      </section>

      <Sheet
        open={Boolean(selectedSite)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent className="detail-sheet sm:max-w-lg">
          {selectedSite && (
            <>
              <SheetHeader className="detail-head">
                <div className="detail-kicker">
                  <Badge variant="outline">{selectedSite.category}</Badge>
                  <span className={`state-pill ${getVisitState(selectedSite)}`}>
                    {statusCopy[getVisitState(selectedSite)].label}
                  </span>
                </div>
                <SheetTitle>{selectedSite.name}</SheetTitle>
                <SheetDescription>
                  {selectedSite.era} · {selectedSite.district}
                </SheetDescription>
              </SheetHeader>
              <div className="detail-body">
                <div className="address">
                  <MapPin />
                  <span>
                    <b>保护地址</b>
                    {selectedSite.address}
                  </span>
                </div>
                <RecordEditor
                  key={`${selectedSite.id}:${mapSelections.length === 1 ? mapSelections[0].childName || '' : ''}`}
                  cloud={cloud}
                  site={selectedSite}
                  initialChild={
                    mapSelections.length === 1 &&
                    mapSelections[0].siteId === selectedSite.id
                      ? mapSelections[0].childName || ''
                      : ''
                  }
                />
                {selectedSite.subItems && (
                  <section className="subitems">
                    <div className="section-title">
                      <span>子项进度</span>
                      <b>
                        {selectedVisitedPointCount}/
                        {selectedOfficialSubItems.length}
                      </b>
                    </div>
                    <div className="point-progress">
                      <i
                        style={{
                          width: `${(selectedVisitedPointCount / selectedOfficialSubItems.length) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="subitem-list">
                      {selectedSite.subItems.map((item) => (
                        <div
                          key={item.name}
                          className={`${
                            item.visited
                              ? 'done'
                              : item.uncertain
                                ? 'uncertain'
                                : ''
                          }${item.official === false ? ' extra' : ''}`}
                        >
                          {item.visited ? (
                            <Check />
                          ) : item.uncertain ? (
                            <TriangleAlert />
                          ) : (
                            <Circle />
                          )}
                          <span>
                            {item.name}
                            {(item.address || item.note) && (
                              <small>{item.note || item.address}</small>
                            )}
                            {item.access === 'closed' && (
                              <small>不对外开放</small>
                            )}
                          </span>
                          <button
                            onClick={() => focusMap(selectedSite.id, item.name)}
                            aria-label={`${isMapSelected(mapSelections, selectedSite.id, item.name) ? '取消' : '选中'}${item.name}`}
                          >
                            {isMapSelected(
                              mapSelections,
                              selectedSite.id,
                              item.name,
                            )
                              ? '取消选中'
                              : '地图选中'}
                          </button>
                          {item.uncertain && (
                            <button onClick={() => setConfirmOpen(true)}>
                              确认
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <section className="photo-section">
                  <div className="section-title">
                    <span>我的现场照片</span>
                    <b>{selectedSite.photos?.length ?? 0} 张</b>
                  </div>
                  {selectedSite.photos?.length ? (
                    <div className="photo-grid">
                      {selectedSite.photos.map((photo, index) => (
                        <a href={photo} target="_blank" key={photo}>
                          <img
                            src={photo}
                            alt={`${selectedSite.name}留念照 ${index + 1}`}
                            loading="lazy"
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-photos">
                      <Camera />
                      <strong>这里还没有照片</strong>
                      <span>下一处金陵访古目的地</span>
                    </div>
                  )}
                </section>
                <p className="data-note">
                  到访状态由照片中的文保碑文字与拍摄位置综合匹配；点位与子项名称依据南京市文化和旅游局名录整理。
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="confirm-dialog">
          <DialogHeader>
            <DialogTitle>
              {unresolvedCount
                ? `请你确认 ${unresolvedCount} 组子项`
                : '全部已确认'}
            </DialogTitle>
            <DialogDescription>
              这些照片能确认到国保单位，但需要你判定具体子项。
              {cloud.configured
                ? '登录后，确认结果保存到云端。'
                : '当前确认结果保存在本浏览器；同步启用后可以导入。'}
            </DialogDescription>
          </DialogHeader>
          <div className="confirmation-list">
            {confirmationError && <p role="alert">{confirmationError}</p>}
            {!unresolvedCount && (
              <p className="confirmation-complete">
                已确认的项目不会再出现在待确认列表中。
              </p>
            )}
            {unresolvedConfirmations.map((item) => (
              <article
                key={item.id}
                className={
                  answers[item.id] &&
                  !['暂不确定', '其他子项'].includes(answers[item.id])
                    ? 'answered'
                    : ''
                }
              >
                <img src={item.photo} alt={item.title} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.note}</p>
                  <div className="answer-options">
                    {item.options.map((option) => (
                      <Button
                        key={option}
                        size="sm"
                        disabled={cloud.busy}
                        variant={
                          answers[item.id] === option ? 'default' : 'outline'
                        }
                        onClick={() => saveAnswer(item.id, option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                  {answers[item.id] && (
                    <span className="saved">
                      <Check />
                      已记录：{answers[item.id]}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
