// Spec 8/11: de asset-lijst in sw.js wordt vergeleken met index.html en met de
// werkelijke bestanden op schijf, en het fetch-gedrag van de service worker
// (nooit zijn eigen updatecheck, nooit andere origins) wordt tekstueel getest.
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
  const treffers = [...swTekst.matchAll(/const VERSIE = '[^']+';/g)];
  assert.equal(treffers.length, 1);
  // De cachenaam is afgeleid van diezelfde constante, niet apart genoteerd.
  assert.match(swTekst, /const CACHE = `[^`]*\$\{VERSIE\}`;/);
});

test('alle verwijzingen in index.html staan in de asset-lijst', () => {
  const assets = new Set(assetsUitSw());
  const verwijzingen = [...indexTekst.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(verwijzingen.length >= 4);
  for (const verwijzing of verwijzingen) {
    assert.ok(assets.has(verwijzing), `${verwijzing} ontbreekt in sw.js ASSETS`);
  }
  const imports = [...indexTekst.matchAll(/from '\.\/(js\/[^']+)'/g)].map((m) => m[1]);
  assert.ok(imports.length >= 1, 'index.html moet de app-module importeren');
  for (const moduleImport of imports) {
    assert.ok(assets.has(moduleImport), `${moduleImport} ontbreekt in sw.js ASSETS`);
  }
});

test('elke JS-module staat in de asset-lijst en elk asset bestaat', () => {
  const assets = assetsUitSw();
  const assetSet = new Set(assets);
  // Vlakke structuur: alle modules staan rechtstreeks in js/, geen submappen.
  const modules = readdirSync(join(wortel, 'js'), { withFileTypes: true })
    .filter((ingang) => ingang.isFile() && ingang.name.endsWith('.js'))
    .map((ingang) => `js/${ingang.name}`);
  assert.ok(modules.length >= 8);
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

test('het koersenbestand zit in de cache maar wordt netwerk-eerst bediend', () => {
  // Het enige asset dat tussen releases verandert: de maandelijkse werkstroom
  // zet er een maand bij. Cache-first zou de app voor altijd vastzetten op de
  // koersen van de installatiedag; zonder cache zou hij offline breken.
  assert.ok(assetsUitSw().includes('data/koersen.json'));
  assert.match(swTekst, /const KOERSEN_PAD = 'data\/koersen\.json';/);
  const handler = swTekst.slice(swTekst.indexOf("addEventListener('fetch'"));
  const netwerkEerst = handler.indexOf('includes(KOERSEN_PAD)');
  const cacheEerst = handler.indexOf('caches.match(event.request, { ignoreSearch: true })\n    .then');
  assert.ok(netwerkEerst > 0 && netwerkEerst < cacheEerst,
    'de koersen-tak moet vóór de cache-first-tak staan');
  assert.match(handler.slice(netwerkEerst), /fetch\(event\.request\)\.then/);
  // en de cache blijft het vangnet, zodat de app offline blijft werken
  assert.match(handler.slice(netwerkEerst), /\.catch\(\(\) => caches\.match/);
});

test('de service worker onderschept alleen same-origin verzoeken', () => {
  // Koersverzoeken gaan naar Yahoo via een proxy en moeten rechtstreeks het
  // net op; zonder deze controle zou de cache-first-strategie ze inslikken.
  assert.match(swTekst, /startsWith\(self\.location\.origin\)/);
});
