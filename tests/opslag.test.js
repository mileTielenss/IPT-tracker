import test from 'node:test';
import assert from 'node:assert/strict';
import { laadParams, bewaarParams, laadKoersen, bewaarKoersen, paramsVolledig, nettoPerMaand, doelBruto, controleVerouderd, STANDAARD_PARAMS } from '../js/opslag.js';
import { maakFakeOpslag } from './helpers/fakedom.js';
import { specParams } from './helpers/omgeving.js';

test('parameters: standaardwaarden zijn generiek, persoonlijke velden leeg', () => {
  const opslag = maakFakeOpslag();
  const params = laadParams(opslag);
  assert.deepEqual(params, STANDAARD_PARAMS);
  assert.equal(params.premiePerMaand, 0);
  assert.equal(params.doelNetto, 0);
  assert.equal(params.ticker, 'SUSW.L');
  assert.equal(paramsVolledig(params), false);
});

test('parameters bewaren en teruglezen, met samenvoeging van nieuwe velden', () => {
  const opslag = maakFakeOpslag();
  bewaarParams(opslag, specParams());
  const terug = laadParams(opslag);
  assert.equal(terug.premiePerMaand, 200);
  assert.equal(paramsVolledig(terug), true);
  // oudere opslag zonder een nieuw veld krijgt de standaardwaarde
  opslag.setItem('ipt-params', JSON.stringify({ premiePerMaand: 100 }));
  assert.equal(laadParams(opslag).beheerskost, 0.0125);
});

test('paramsVolledig eist alle vier persoonlijke gegevens', () => {
  assert.equal(paramsVolledig(specParams({ premiePerMaand: 0 })), false);
  assert.equal(paramsVolledig(specParams({ doelNetto: 0 })), false);
  assert.equal(paramsVolledig(specParams({ startDatum: '' })), false);
  assert.equal(paramsVolledig(specParams({ eindDatum: '' })), false);
  assert.equal(paramsVolledig(specParams()), true);
});

test('koersencache bewaren en teruglezen', () => {
  const opslag = maakFakeOpslag();
  assert.deepEqual(laadKoersen(opslag), { koersen: {}, opgehaald: null });
  bewaarKoersen(opslag, { '2026-07': 10.5 }, '2026-08-13');
  assert.deepEqual(laadKoersen(opslag), {
    koersen: { '2026-07': 10.5 }, opgehaald: '2026-08-13',
  });
});

test('afgeleiden en controle-veroudering', () => {
  const params = specParams();
  assert.ok(Math.abs(nettoPerMaand(params) - 199) < 1e-9);
  assert.ok(Math.abs(doelBruto(params) - 250000 / 0.825) < 1e-9);
  assert.equal(controleVerouderd(null, '2026-08-13'), true);
  assert.equal(controleVerouderd('2026-08-13', '2026-08-13'), false);
  assert.equal(controleVerouderd('2025-08-14', '2026-08-13'), false);
  assert.equal(controleVerouderd('2025-08-13', '2026-08-13'), true);
  assert.equal(controleVerouderd('2024-01-01', '2026-08-13'), true);
});
