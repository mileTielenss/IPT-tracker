// Sinds de vereenvoudiging doet dit bestand geen netwerk meer: het rendement
// wordt gemeten uit dezelfde koersen die haalKoersen ophaalt. De tests voor
// maxChartUrl en haalHistoriek zijn daarmee vervallen.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as afleiden from '../js/afleiden.js';
import { maandenTussenSleutels, historischRendement, MINIMUM_MAANDEN } from '../js/afleiden.js';

test('afleiden doet geen netwerk meer: alleen meten uit bestaande koersen', () => {
  assert.deepEqual(Object.keys(afleiden).sort(),
    ['MINIMUM_MAANDEN', 'historischRendement', 'maandenTussenSleutels']);
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
