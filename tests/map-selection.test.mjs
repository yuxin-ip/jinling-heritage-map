import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function loadTypeScript(path) {
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
  runInNewContext(outputText, { exports });
  return exports;
}

const { sites } = loadTypeScript('../lib/heritage-data.ts');
const { selectMapSites } = loadTypeScript('../lib/map-selection.ts');

test('overview and reset include every catalogue unit', () => {
  assert.equal(selectMapSites(sites, null), sites);
  assert.equal(sites.length, 55);
});

test('parent selection includes all 17 burial sites, including unvisited children', () => {
  const result = selectMapSites(sites, { siteId: 'massacre-burial' });
  assert.equal(result.length, 1);
  assert.equal(result[0].subItems.length, 17);
  assert.equal(result[0].subItems.filter((item) => item.visited).length, 3);
});

test('child selection isolates exactly one point without changing the catalogue', () => {
  const parent = sites.find((site) => site.id === 'massacre-burial');
  const result = selectMapSites(sites, {
    siteId: parent.id,
    childName: '燕子矶',
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].subItems.length, 1);
  assert.equal(result[0].subItems[0].name, '燕子矶');
  assert.equal(result[0].subItems[0].visited, undefined);
  assert.equal(parent.subItems.length, 17);
});

test('city wall selection includes all sections, and an individual gate isolates one', () => {
  assert.equal(
    selectMapSites(sites, { siteId: 'city-wall' })[0].subItems.length,
    22,
  );
  const result = selectMapSites(sites, {
    siteId: 'city-wall',
    childName: '武定门',
  });
  assert.equal(result[0].subItems.length, 1);
  assert.equal(result[0].subItems[0].name, '武定门');
});

test('single-point units retain their original location', () => {
  const result = selectMapSites(sites, { siteId: 'human-fossil' });
  assert.equal(result.length, 1);
  assert.equal(
    result[0],
    sites.find((site) => site.id === 'human-fossil'),
  );
});

test('invalid or filtered-out selections never leak unrelated markers', () => {
  assert.equal(selectMapSites(sites, { siteId: 'missing' }).length, 0);
  assert.equal(
    selectMapSites(sites, { siteId: 'city-wall', childName: 'missing' }).length,
    0,
  );
  assert.equal(selectMapSites([], { siteId: 'city-wall' }).length, 0);
});
