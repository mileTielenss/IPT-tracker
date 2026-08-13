// Sinds de vereenvoudiging doet dit bestand geen netwerk meer: het rendement
// wordt gemeten uit dezelfde koersen die haalKoersen ophaalt. De tests voor
// maxChartUrl en haalHistoriek zijn daarmee vervallen.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as afleiden from '../js/afleiden.js';
import { maandenTussenSleutels, historischRendement, maandVerschuif, rendementVensters, VENSTERS, MINIMUM_MAANDEN } from '../js/afleiden.js';

test('afleiden doet geen netwerk meer: alleen meten uit bestaande koersen', () => {
  assert.deepEqual(Object.keys(afleiden).sort(), ['MINIMUM_MAANDEN', 'VENSTERS',
    'historischRendement', 'maandVerschuif', 'maandenTussenSleutels', 'rendementVensters']);
});

test('maandenTussenSleutels telt over jaargrenzen', () => {
  assert.equal(maandenTussenSleutels('2026-07', '2026-07'), 0);
  assert.equal(maandenTussenSleutels('2026-07', '2027-07'), 12);
  assert.equal(maandenTussenSleutels('2020-01', '2026-08'), 79);
});

test('historischRendement meet het samengestelde jaarrendement', () => {
  // tien jaar, verdubbeling: 2^(1/10) - 1 = 7,18%
  const koersen = { '2016-01': 100, '2026-01': 200 };
  const gemeten = historischRendement(koersen);
  assert.ok(Math.abs(gemeten.rendement - (2 ** 0.1 - 1)) < 1e-12);
  assert.equal(gemeten.maanden, 120);
  assert.equal(gemeten.van, '2016-01');
  assert.equal(gemeten.tot, '2026-01');
  // sleutels hoeven niet gesorteerd binnen te komen
  assert.equal(historischRendement({ '2026-01': 200, '2016-01': 100 }).maanden, 120);
});

test('historischRendement weigert te korte of onbruikbare reeksen', () => {
  assert.equal(historischRendement({}), null);
  assert.equal(historischRendement({ '2026-01': 100 }), null);
  // exact op de grens van drie jaar mag wel, één maand minder niet
  assert.ok(historischRendement({ '2023-01': 100, '2026-01': 130 }) !== null);
  assert.equal(historischRendement({ '2023-02': 100, '2026-01': 130 }), null);
  assert.equal(MINIMUM_MAANDEN, 36);
  // nulkoersen leveren geen zinnig rendement
  assert.equal(historischRendement({ '2016-01': 0, '2026-01': 200 }), null);
  assert.equal(historischRendement({ '2016-01': 100, '2026-01': 0 }), null);
});

test('maandVerschuif rekent over jaargrenzen, vooruit en achteruit', () => {
  assert.equal(maandVerschuif('2026-08', -12), '2025-08');
  assert.equal(maandVerschuif('2026-08', -8), '2025-12');
  assert.equal(maandVerschuif('2026-08', 5), '2027-01');
  assert.equal(maandVerschuif('2026-01', -1), '2025-12');
});

test('historischRendement kan vanaf een gekozen maand meten', () => {
  // Twintig jaar historiek: een verdubbeling in het eerste decennium en een
  // verviervoudiging in het tweede.
  const koersen = { '2006-01': 100, '2016-01': 200, '2026-01': 800 };
  assert.ok(Math.abs(historischRendement(koersen).rendement - (8 ** (1 / 20) - 1)) < 1e-12);
  const laat = historischRendement(koersen, '2016-01');
  assert.ok(Math.abs(laat.rendement - (4 ** 0.1 - 1)) < 1e-12);
  assert.equal(laat.maanden, 120);
  assert.equal(laat.van, '2016-01');
  // een volledige datum werkt ook: er wordt op de maand vergeleken, zodat de
  // koers van die maand zelf niet net buiten het venster valt
  assert.deepEqual(historischRendement(koersen, '2016-01-15'), laat);
  assert.deepEqual(historischRendement(koersen, '2016-01-01'), laat);
  // een venster dat te kort is levert geen meting op
  assert.equal(historischRendement(koersen, '2024-01'), null);
});

test('rendementVensters toont hetzelfde fonds over verschillende periodes', () => {
  const koersen = {};
  // twintig jaar, elke maand een half procent erbij
  for (let m = 0; m <= 240; m++) {
    koersen[maandVerschuif('2006-01', m)] = 100 * 1.005 ** m;
  }
  const rijen = rendementVensters(koersen);
  assert.deepEqual(rijen.map((r) => r.label),
    ['volledige historiek', '10 jaar', '5 jaar', '3 jaar']);
  assert.deepEqual(rijen.map((r) => r.maanden), [240, ...VENSTERS]);
  // bij een constante maandgroei geeft elk venster hetzelfde jaarrendement
  for (const rij of rijen) assert.ok(Math.abs(rij.rendement - (1.005 ** 12 - 1)) < 1e-9);
  // elk venster eindigt op dezelfde laatste maand
  for (const rij of rijen) assert.equal(rij.tot, '2026-01');
  // te weinig historiek: geen enkel venster
  assert.deepEqual(rendementVensters({ '2026-01': 100, '2026-06': 110 }), []);
  // precies het kortste venster: dan is er niets naast de volledige historiek
  const kort = {};
  for (let m = 0; m <= 36; m++) kort[maandVerschuif('2023-01', m)] = 100 * 1.005 ** m;
  assert.deepEqual(rendementVensters(kort).map((r) => r.label), ['volledige historiek']);
});
