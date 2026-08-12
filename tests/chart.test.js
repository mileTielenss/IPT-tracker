import test from 'node:test';
import assert from 'node:assert/strict';
import { gestapeldeBalken } from '../js/chart.js';
import { KLASSE_KLEUREN } from '../js/categories.js';

test('gestapeldeBalken tekent per bucket segmenten in vaste kleuren', () => {
  const svg = gestapeldeBalken([
    { label: 'W1', vast: 1000, variabel: 500, discretionair: 250 },
    { label: 'W2', vast: 0, variabel: 0, discretionair: 0 },
  ]);
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes(`fill="${KLASSE_KLEUREN.vast}"`));
  assert.ok(svg.includes(`fill="${KLASSE_KLEUREN.variabel}"`));
  assert.ok(svg.includes(`fill="${KLASSE_KLEUREN.discretionair}"`));
  assert.ok(svg.includes('>W1</text>'));
  assert.ok(svg.includes('>W2</text>'));
  // lege bucket: alleen label, geen rects erbij
  assert.equal((svg.match(/<rect/g) ?? []).length, 3);
});

test('gestapeldeBalken schaalt op het grootste bucket-totaal', () => {
  const svg = gestapeldeBalken([{ label: 'A', vast: 100, variabel: 0, discretionair: 0 }], 100, 100);
  assert.ok(svg.includes('viewBox="0 0 100 100"'));
  const leeg = gestapeldeBalken([{ label: 'A', vast: 0, variabel: 0, discretionair: 0 }]);
  assert.ok(!leeg.includes('<rect'));
});
