import test from 'node:test';
import assert from 'node:assert/strict';
import { zetDocument, el, leeg, keuzelijst } from '../js/dom.js';
import { maakFakeDocument } from './helpers/fakedom.js';

test('el bouwt elementen met props, listeners en kinderen', async () => {
  zetDocument(maakFakeDocument());
  let geklikt = 0;
  const knoop = el('div', { class: 'kaart', 'data-x': '1' },
    'tekst', null, [el('span', {}, 'kind')],
    el('button', { onclick: () => geklikt++ }, 'Klik'),
    el('input', { value: 'w', checked: true }));
  assert.equal(knoop.className, 'kaart');
  assert.equal(knoop.getAttribute('data-x'), '1');
  assert.ok(knoop.textContent.includes('tekst'));
  assert.ok(knoop.textContent.includes('kind'));
  const knop = knoop.children.find((k) => k.tagName === 'button');
  await knop.click();
  assert.equal(geklikt, 1);
  const invoer = knoop.children.find((k) => k.tagName === 'input');
  assert.equal(invoer.value, 'w');
  assert.equal(invoer.checked, true);
  leeg(knoop);
  assert.equal(knoop.children.length, 0);
});

test('keuzelijst zet opties en selectie', () => {
  zetDocument(maakFakeDocument());
  let veranderd = 0;
  const select = keuzelijst([['a', 'Optie A'], ['b', 'Optie B']], 'b', () => veranderd++);
  assert.equal(select.value, 'b');
  assert.equal(select.children.length, 2);
  assert.equal(select.children[1].getAttribute('selected'), 'selected');
  assert.equal(select.children[0].getAttribute('selected'), null);
  return select.dispatch('change').then(() => assert.equal(veranderd, 1));
});
