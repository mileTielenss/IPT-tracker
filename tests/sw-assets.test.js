// Spec 11.3/12: de asset-lijst in sw.js wordt vergeleken met index.html
// en met de werkelijke bestanden op schijf.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const wortel = new URL('..', import.meta.url).pathname;
const swTekst = readFileSync(join(wortel, 'sw.js'), 'utf-8');
const indexTekst = readFileSync(join(wortel, 'index.html'), 'utf-8');

function assetsUitSw() {
  const m = /const ASSETS = \[([^\]]+)\]/.exec(swTekst);
  assert.ok(m !== null, 'sw.js moet een ASSETS-lijst hebben');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

test('er is precies één versieconstante, in sw.js', () => {
  assert.ok(/const VERSIE = '[^']+';/.test(swTekst));
  assert.ok(swTekst.includes('kbc-cashflow-${VERSIE}'));
});

test('alle verwijzingen in index.html staan in de asset-lijst', () => {
  const assets = new Set(assetsUitSw());
  const verwijzingen = [...indexTekst.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(verwijzingen.length >= 4);
  for (const verwijzing of verwijzingen) {
    assert.ok(assets.has(verwijzing), `${verwijzing} ontbreekt in sw.js ASSETS`);
  }
  const [moduleImport] = [...indexTekst.matchAll(/from '\.\/(js\/[^']+)'/g)].map((m) => m[1]);
  assert.ok(assets.has(moduleImport), `${moduleImport} ontbreekt in sw.js ASSETS`);
});

test('elke JS-module staat in de asset-lijst en elk asset bestaat', () => {
  const assets = assetsUitSw();
  const assetSet = new Set(assets);
  const modules = [];
  for (const map of ['js', 'js/views']) {
    for (const bestand of readdirSync(join(wortel, map))) {
      if (bestand.endsWith('.js')) modules.push(`${map}/${bestand}`);
    }
  }
  assert.ok(modules.length >= 20);
  for (const module of modules) {
    assert.ok(assetSet.has(module), `${module} ontbreekt in sw.js ASSETS`);
  }
  for (const asset of assets) {
    if (asset === './') continue;
    assert.ok(existsSync(join(wortel, asset)), `${asset} staat in ASSETS maar bestaat niet`);
  }
  assert.ok(assetSet.has('./'));
  assert.ok(assetSet.has('index.html'));
  assert.ok(assetSet.has('manifest.webmanifest'));
});

test('de service worker onderschept zijn eigen updatecheck nooit', () => {
  assert.ok(swTekst.includes("url.includes('sw.js')"));
});
