import test from 'node:test';
import assert from 'node:assert/strict';
import { laadParams, bewaarParams, laadKoersen, bewaarKoersen, paramsVolledig, nettoPerMaand, nettoRendement, doelBruto, controleVerouderd, STANDAARD_PARAMS } from '../js/opslag.js';
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
  // Het nettorendement wordt afgeleid, niet bewaard; de reservestand van het
  // laatste overzicht wel — leeg tot de gebruiker hem invult.
  assert.ok(!('rendementNetto' in params));
  assert.equal(params.echteReserve, 0);
  assert.equal(params.echteReserveDatum, null);
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

test('paramsVolledig weigert een einddatum die niet ná de startdatum ligt', () => {
  // Een einddatum vóór de startdatum levert nul premies op: dan is er niets
  // te tekenen en hoort de gebruiker terug naar het invulscherm.
  assert.equal(paramsVolledig(specParams({ eindDatum: '2020-01-01' })), false);
  // gelijke datums geven ook nul premies
  assert.equal(paramsVolledig(specParams({ eindDatum: specParams().startDatum })), false);
  // één dag later is wel geldig
  assert.equal(paramsVolledig(specParams({ eindDatum: '2026-01-02' })), true);
});

test('nettoRendement: index min fondskosten min beheerskost', () => {
  // 7% index, 0,20% TER, 1,25% beheerskost:
  // 1,07 x 0,998 x 0,9875 - 1 = 0,05451175
  assert.ok(Math.abs(nettoRendement(specParams()) - 0.05451175) < 1e-12);
  // zonder kosten blijft het brutorendement staan
  assert.ok(Math.abs(nettoRendement(specParams({ ter: 0, beheerskost: 0 })) - 0.07) < 1e-12);
  // elke kost apart drukt het rendement
  assert.ok(nettoRendement(specParams({ ter: 0 })) > nettoRendement(specParams()));
  assert.ok(nettoRendement(specParams({ beheerskost: 0 })) > nettoRendement(specParams()));
  // een index die niets doet levert netto verlies op: de kosten lopen door
  assert.ok(nettoRendement(specParams({ rendementBruto: 0 })) < 0);
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
