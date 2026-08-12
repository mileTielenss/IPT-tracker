import test from 'node:test';
import assert from 'node:assert/strict';
import { suggereerCategorie, HERKENNINGSLIJST } from '../js/suggestions.js';
import { maakTx } from './helpers/omgeving.js';

test('herkenningslijst bevat minstens de mappings uit spec 6.4', () => {
  const per = Object.fromEntries(HERKENNINGSLIJST.map((i) => [i.zoek, i.categoryId]));
  assert.equal(per.telenet, 'telecom');
  assert.equal(per.liantis, 'sociaal-secretariaat');
  assert.equal(per.dkv, 'verzekeringen');
  assert.equal(per.vivium, 'verzekeringen');
  assert.equal(per['nn insurance'], 'verzekeringen');
  assert.equal(per['dats 24'], 'brandstof');
  assert.equal(per.fastned, 'brandstof');
  assert.equal(per.nmbs, 'mobiliteit');
  assert.equal(per['btw-ontvangsten'], 'belastingen');
  assert.equal(per.belastingen, 'belastingen');
  assert.equal(per.leasing, 'leasing');
  assert.equal(per.edenred, 'loon');
  assert.equal(per.anthropic, 'software');
  assert.equal(per.mollie, 'software');
  assert.equal(per.teamleader, 'software');
});

test('suggereerCategorie matcht op naam, handelaar en omschrijving', () => {
  assert.equal(suggereerCategorie(maakTx({ counterpartyName: 'Telenet BV' })), 'telecom');
  assert.equal(suggereerCategorie(maakTx({ merchant: 'DATS 24' })), 'brandstof');
  assert.equal(suggereerCategorie(maakTx({ description: 'KBC Autolease leasing factuur' })), 'leasing');
  assert.equal(suggereerCategorie(maakTx({ counterpartyName: 'Onbekende BVBA' })), null);
});
