'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
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
  photoCount,
  sites,
  type HeritageSite,
  type VisitState,
} from '@/lib/heritage-data';

type Filter = 'all' | VisitState;
type Answers = Record<string, string>;
const statusCopy: Record<VisitState, { label: string; note: string }> = {
  visited: { label: '已到访', note: '照片已匹配' },
  partial: { label: '部分到访', note: '还有子项待探访' },
  unvisited: { label: '未到访', note: '尚未发现到访照片' },
};

function resolvedSite(site: HeritageSite, answers: Answers): HeritageSite {
  if (!site.subItems) return site;
  const confirmed = new Set<string>();
  if (site.id === 'mingxiaoling') {
    const answer = answers['wu-tombs'];
    if (answer === '两处都去了') {
      confirmed.add('吴良墓');
      confirmed.add('吴桢墓');
    } else if (answer && answer !== '暂不确定') confirmed.add(answer);
  }
  if (site.id === 'southern-dynasty-stone') {
    for (const id of ['jiangning-stone-1', 'jiangning-stone-2']) {
      const answer = answers[id];
      if (answer && !['暂不确定', '其他子项'].includes(answer))
        confirmed.add(answer);
    }
  }
  return {
    ...site,
    subItems: site.subItems.map((item) => ({
      ...item,
      visited: item.visited || confirmed.has(item.name),
      uncertain: item.uncertain && !confirmed.has(item.name),
    })),
  };
}

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});

  useEffect(() => {
    try {
      setAnswers(
        JSON.parse(
          localStorage.getItem('nanjing-heritage-confirmations') || '{}',
        ),
      );
    } catch {
      /* ignore malformed local data */
    }
  }, []);
  const resolved = useMemo(
    () => sites.map((site) => resolvedSite(site, answers)),
    [answers],
  );
  const visitedUnits = resolved.filter(
    (site) => getVisitState(site) !== 'unvisited',
  ).length;
  const unresolvedCount = pendingConfirmations.filter(
    (item) =>
      !answers[item.id] || ['暂不确定', '其他子项'].includes(answers[item.id]),
  ).length;
  const categories = [
    '全部类别',
    ...Array.from(new Set(sites.map((site) => site.category))),
  ];
  const visibleSites = resolved.filter((site) => {
    const status = getVisitState(site);
    const normalized = query.trim().toLowerCase();
    return (
      (!normalized ||
        `${site.name}${site.district}${site.era}${site.address}`
          .toLowerCase()
          .includes(normalized)) &&
      (filter === 'all' || status === filter) &&
      (category === '全部类别' || site.category === category)
    );
  });
  const selectedSite = resolved.find((site) => site.id === selectedId) ?? null;

  function saveAnswer(id: string, value: string) {
    setAnswers((current) => {
      const next = { ...current, [id]: value };
      localStorage.setItem(
        'nanjing-heritage-confirmations',
        JSON.stringify(next),
      );
      return next;
    });
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            className="confirm-button"
          >
            <TriangleAlert />
            待你确认 {unresolvedCount}
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
          <span>处已留下足迹</span>
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
          <div className="search-wrap">
            <Search aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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
                  onClick={() => setFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <select
              aria-label="按类别筛选"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="site-list">
            {visibleSites.map((site) => {
              const status = getVisitState(site);
              const visitedPoints = site.subItems?.filter(
                (item) => item.visited,
              ).length;
              return (
                <button
                  className={`site-card ${selectedId === site.id ? 'selected' : ''}`}
                  key={site.id}
                  onClick={() => setSelectedId(site.id)}
                >
                  <StatusIcon status={status} />
                  <span className="site-copy">
                    <strong>{site.name}</strong>
                    <small>
                      {site.district} · {site.era}
                    </small>
                    <em>
                      {site.subItems
                        ? `${visitedPoints}/${site.subItems.length} 个子项 · ${statusCopy[status].label}`
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
            sites={visibleSites.map((site) => ({
              ...site,
              status: getVisitState(site),
            }))}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="map-legend">
            <span>
              <i className="dot visited" />
              已到访
            </span>
            <span>
              <i className="dot partial" />
              部分到访
            </span>
            <span>
              <i className="dot unvisited" />
              未到访
            </span>
          </div>
          <div className="map-note">
            <Layers3 />
            地图点位为文保单位代表位置；多点项目请打开详情查看子项。
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
                {selectedSite.subItems && (
                  <section className="subitems">
                    <div className="section-title">
                      <span>子项进度</span>
                      <b>
                        {
                          selectedSite.subItems.filter((item) => item.visited)
                            .length
                        }
                        /{selectedSite.subItems.length}
                      </b>
                    </div>
                    <div className="point-progress">
                      <i
                        style={{
                          width: `${(selectedSite.subItems.filter((item) => item.visited).length / selectedSite.subItems.length) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="subitem-list">
                      {selectedSite.subItems.map((item) => (
                        <div
                          key={item.name}
                          className={
                            item.visited
                              ? 'done'
                              : item.uncertain
                                ? 'uncertain'
                                : ''
                          }
                        >
                          {item.visited ? (
                            <Check />
                          ) : item.uncertain ? (
                            <TriangleAlert />
                          ) : (
                            <Circle />
                          )}
                          <span>{item.name}</span>
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
            <DialogTitle>请你确认 3 组子项</DialogTitle>
            <DialogDescription>
              这些照片能确认到国保单位，但无法仅靠碑面或坐标准确判定具体子项。选择会自动保存在当前浏览器。
            </DialogDescription>
          </DialogHeader>
          <div className="confirmation-list">
            {pendingConfirmations.map((item) => (
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
