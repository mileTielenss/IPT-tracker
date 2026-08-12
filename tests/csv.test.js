import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, decodeerCsv } from '../js/csv.js';
import { leesFixture } from './helpers/omgeving.js';

test('parseCsv splitst op puntkomma en regelovergangen', () => {
  const rijen = parseCsv('a;b;c\n1;2;3\r\n4;5;6');
  assert.deepEqual(rijen, [['a', 'b', 'c'], ['1', '2', '3'], ['4', '5', '6']]);
});

test('parseCsv verwerkt quoted velden met puntkomma, quotes en regelovergang', () => {
  const rijen = parseCsv('x;"a;b";y\n1;"zeg ""hoi""\ntweede regel";2');
  assert.deepEqual(rijen, [['x', 'a;b', 'y'], ['1', 'zeg "hoi"\ntweede regel', '2']]);
});

test('parseCsv laat lege slotregel weg en behoudt laatste veld zonder newline', () => {
  assert.deepEqual(parseCsv('a;b\n'), [['a', 'b']]);
  assert.deepEqual(parseCsv('a;b'), [['a', 'b']]);
  assert.deepEqual(parseCsv(''), []);
});

test('parseCsv verwerkt de bevroren KBC-fixture zonder fouten', () => {
  const rijen = parseCsv(leesFixture());
  assert.equal(rijen.length, 22);
  // de header telt 18 kolommen; elke datarij eindigt op een puntkomma en
  // heeft dus een lege 19e slotkolom, net als de echte KBC-export
  assert.equal(rijen[0].length, 18);
  for (const rij of rijen.slice(1)) {
    assert.equal(rij.length, 19);
    assert.equal(rij[18], '');
  }
  const quoted = rijen[8];
  assert.ok(quoted[6].includes('HONORARIUM; ADVIES'));
  assert.ok(quoted[6].includes('\nDOSSIER 2026/456'));
});

test('parseCsv verwerkt CR-regeleindes zoals de echte KBC-export', () => {
  const rijen = parseCsv('a;b;c\r1;2;3\r4;5;6\r');
  assert.deepEqual(rijen, [['a', 'b', 'c'], ['1', '2', '3'], ['4', '5', '6']]);
});

test('decodeerCsv leest UTF-8 en valt terug op Windows-1252', () => {
  const utf8 = new TextEncoder().encode('Domiciliëring').buffer;
  assert.equal(decodeerCsv(utf8), 'Domiciliëring');
  const win1252 = new Uint8Array([0x44, 0x6f, 0x6d, 0x69, 0x63, 0x69, 0x6c, 0x69, 0xeb, 0x72, 0x69, 0x6e, 0x67]).buffer;
  assert.equal(decodeerCsv(win1252), 'Domiciliëring');
});
