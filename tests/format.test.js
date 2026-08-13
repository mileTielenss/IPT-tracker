import test from 'node:test';
import assert from 'node:assert/strict';
import { formatteerEuro, formatteerEuroPrecies, formatteerProcent, formatteerDatum } from '../js/format.js';

test('bedragen in nl-BE euro-notatie', () => {
  const rond = formatteerEuro(303030.4);
  assert.ok(rond.includes('303.030'));
  assert.ok(rond.includes('€'));
  assert.ok(!rond.includes(','));
  const precies = formatteerEuroPrecies(199.005);
  assert.ok(precies.includes('199,0'));
});

test('procenten en datums', () => {
  assert.ok(formatteerProcent(0.1234).includes('12,3'));
  assert.equal(formatteerDatum('2066-01-01'), '01/01/2066');
});
