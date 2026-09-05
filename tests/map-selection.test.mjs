import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function loadTypeScript(path, dependencies = {}) {
  const source = readFileSync(
    new URL(path, import.meta.url),
    'utf8',
  ).replaceAll('import.meta.env.BASE_URL', "'/'");
  const exports = {};
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  runInNewContext(outputText, {
    exports,
    require: (name) => {
      if (!dependencies[name]) throw new Error(`Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

const data = loadTypeScript('../lib/heritage-data.ts');
const { sites } = data;
const { isConfirmed, parseAnswers, resolveConfirmations } = loadTypeScript(
  '../lib/confirmations.ts',
  { './heritage-data': data },
);
const { selectMapSites, toggleMapSelection, isMapSelected } = loadTypeScript(
  '../lib/map-selection.ts',
);
const { applyVisitRecords, recordStatistics, pointKey, recordKey } =
  loadTypeScript('../lib/visit-records.ts');

test('no-photo visits count as visited and closed access never invents a visit', () => {
  const site = sites.find((item) => item.id === 'drum-tower');
  const key = pointKey(site.id);
  const closed = applyVisitRecords(
    site,
    { [recordKey(key, 'access')]: 'closed' },
    [],
  );
  assert.equal(data.getVisitState(closed), 'unvisited');
  const visited = applyVisitRecords(
    site,
    {
      [recordKey(key, 'visit')]: 'visited-no-photo',
      [recordKey(key, 'access')]: 'closed',
    },
    [],
  );
  assert.equal(data.getVisitState(visited), 'visited');
  const stats = recordStatistics([visited]);
  assert.equal(stats.noPhoto, 1);
  assert.equal(stats.closed, 1);
});

test('new child photo visits only that child, adds to gallery and counts once', () => {
  const site = sites.find((item) => item.id === 'massacre-burial');
  const photo = {
    id: 'test',
    point_key: pointKey(site.id, '燕子矶'),
    storage_path: 'test.jpg',
    filename: 'test.jpg',
    url: 'https://example.test/photo',
  };
  const result = applyVisitRecords(site, {}, [photo]);
  assert.equal(result.subItems.filter((item) => item.visited).length, 4);
  assert.equal(result.photos.length, 4);
  assert.equal(
    result.subItems.find((item) => item.name === '燕子矶').photos.length,
    1,
  );
  assert.equal(recordStatistics([result]).noPhoto, 0);
});

test('unit-level visit must not mark every child as visited', () => {
  const site = sites.find((item) => item.id === 'eighth-route-office');
  const result = applyVisitRecords(
    site,
    { [recordKey(pointKey(site.id), 'visit')]: 'visited-no-photo' },
    [],
  );
  assert.equal(data.getVisitState(result), 'partial');
  assert.equal(recordStatistics([result]).visited, 0);
});

test('unvisited correction preserves photos and automatic mode restores evidence', () => {
  const site = sites.find((item) => item.id === 'human-fossil');
  const key = recordKey(pointKey(site.id), 'visit');
  const corrected = applyVisitRecords(site, { [key]: 'unvisited' }, []);
  assert.equal(data.getVisitState(corrected), 'unvisited');
  assert.equal(corrected.photos.length, site.photos.length);
  assert.equal(
    data.getVisitState(applyVisitRecords(site, { [key]: 'auto' }, [])),
    'visited',
  );
});

test('overview and reset include every catalogue unit', () => {
  assert.equal(selectMapSites(sites, []), sites);
  assert.equal(sites.length, 55);
});

test('parent selection includes all 17 burial sites, including unvisited children', () => {
  const result = selectMapSites(sites, [{ siteId: 'massacre-burial' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].subItems.length, 17);
  assert.equal(result[0].subItems.filter((item) => item.visited).length, 3);
});

test('child selection isolates exactly one point without changing the catalogue', () => {
  const parent = sites.find((site) => site.id === 'massacre-burial');
  const result = selectMapSites(sites, [
    {
      siteId: parent.id,
      childName: '燕子矶',
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].subItems.length, 1);
  assert.equal(result[0].subItems[0].name, '燕子矶');
  assert.equal(result[0].subItems[0].visited, undefined);
  assert.equal(parent.subItems.length, 17);
});

test('city wall selection includes all sections, and an individual gate isolates one', () => {
  assert.equal(
    selectMapSites(sites, [{ siteId: 'city-wall' }])[0].subItems.length,
    22,
  );
  const result = selectMapSites(sites, [
    {
      siteId: 'city-wall',
      childName: '武定门',
    },
  ]);
  assert.equal(result[0].subItems.length, 1);
  assert.equal(result[0].subItems[0].name, '武定门');
});

test('single-point units retain their original location', () => {
  const result = selectMapSites(sites, [{ siteId: 'human-fossil' }]);
  assert.equal(result.length, 1);
  assert.equal(
    result[0],
    sites.find((site) => site.id === 'human-fossil'),
  );
});

test('invalid or filtered-out selections never leak unrelated markers', () => {
  assert.equal(selectMapSites(sites, [{ siteId: 'missing' }]).length, 0);
  assert.equal(
    selectMapSites(sites, [{ siteId: 'city-wall', childName: 'missing' }])
      .length,
    0,
  );
  assert.equal(selectMapSites([], [{ siteId: 'city-wall' }]).length, 0);
});

test('clicking the last selected name again returns to overview', () => {
  const target = { siteId: 'city-wall' };
  const selected = toggleMapSelection(sites, [], target);
  assert.equal(selectMapSites(sites, selected).length, 1);
  const cleared = toggleMapSelection(sites, selected, target);
  assert.equal(cleared.length, 0);
  assert.equal(selectMapSites(sites, cleared), sites);
});

test('multiple parents and individual children form a deduplicated union', () => {
  let selected = toggleMapSelection(sites, [], { siteId: 'city-wall' });
  selected = toggleMapSelection(sites, selected, {
    siteId: 'massacre-burial',
    childName: '燕子矶',
  });
  const result = selectMapSites(sites, selected);
  assert.equal(result.length, 2);
  assert.equal(
    result.reduce((sum, site) => sum + site.subItems.length, 0),
    23,
  );
  assert.equal(isMapSelected(selected, 'city-wall', '武定门'), true);
  assert.equal(isMapSelected(selected, 'massacre-burial'), false);
  selected = toggleMapSelection(sites, selected, { siteId: 'city-wall' });
  assert.equal(selectMapSites(sites, selected)[0].subItems[0].name, '燕子矶');
});

test('excluding a child from a selected parent preserves siblings and other units', () => {
  let selected = [{ siteId: 'city-wall' }, { siteId: 'human-fossil' }];
  selected = toggleMapSelection(sites, selected, {
    siteId: 'city-wall',
    childName: '武定门',
  });
  assert.equal(isMapSelected(selected, 'city-wall', '武定门'), false);
  assert.equal(isMapSelected(selected, 'city-wall', '玄武门'), true);
  assert.equal(
    selectMapSites(sites, selected).find((site) => site.id === 'city-wall')
      .subItems.length,
    21,
  );
  selected = toggleMapSelection(sites, selected, {
    siteId: 'city-wall',
    childName: '武定门',
  });
  assert.equal(isMapSelected(selected, 'city-wall'), true);
  assert.equal(selected.length, 2);
});

test('completed answers disappear from pending, undecided and invalid answers remain', () => {
  assert.equal(isConfirmed('wu-tombs', '两处都去了'), true);
  assert.equal(isConfirmed('jiangning-stone-2', '方旗庙失考墓石刻'), true);
  assert.equal(isConfirmed('jiangning-stone-2', '暂不确定'), false);
  assert.equal(isConfirmed('jiangning-stone-2', '其他子项'), false);
  assert.equal(isConfirmed('wu-tombs', 'invalid'), false);
  const answers = parseAnswers(
    JSON.parse(
      JSON.stringify({
        'wu-tombs': '吴良墓',
        'jiangning-stone-2': '方旗庙失考墓石刻',
      }),
    ),
  );
  assert.equal(
    data.pendingConfirmations.filter(
      (item) => !isConfirmed(item.id, answers[item.id]),
    ).length,
    0,
  );
});

test('confirmed child is visited and siblings no longer await the same confirmation', () => {
  const site = sites.find((item) => item.id === 'mingxiaoling');
  const resolved = resolveConfirmations(site, { 'wu-tombs': '吴良墓' });
  assert.equal(
    resolved.subItems.find((item) => item.name === '吴良墓').visited,
    true,
  );
  assert.equal(
    Boolean(resolved.subItems.find((item) => item.name === '吴桢墓').visited),
    false,
  );
  assert.equal(
    resolved.subItems.some((item) => item.uncertain),
    false,
  );
  const pending = resolveConfirmations(site, { 'wu-tombs': 'invalid' });
  assert.equal(pending.subItems.filter((item) => item.uncertain).length, 2);
});

test('malformed stored answers cannot produce a false confirmation', () => {
  assert.equal(Object.keys(parseAnswers(null)).length, 0);
  assert.equal(Object.keys(parseAnswers([])).length, 0);
  assert.equal(
    Object.keys(parseAnswers({ 'wu-tombs': 'invalid', ignored: 'value' }))
      .length,
    0,
  );
});
