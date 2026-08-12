import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, startRouter } from '../js/router.js';
import { maakFakeVenster } from './helpers/fakedom.js';

test('parseHash herkent alle routes', () => {
  assert.deepEqual(parseHash(''), { naam: 'dashboard', query: {} });
  assert.deepEqual(parseHash('#/'), { naam: 'dashboard', query: {} });
  assert.deepEqual(parseHash('#/transacties'), { naam: 'transacties', query: {} });
  assert.deepEqual(parseHash('#/regels'), { naam: 'regels', query: {} });
  assert.deepEqual(parseHash('#/instellingen'), { naam: 'instellingen', query: {} });
  assert.deepEqual(parseHash('#/werklijst'), { naam: 'werklijst', query: {} });
  assert.deepEqual(parseHash('#/prognose'), { naam: 'prognose', query: {} });
  assert.equal(parseHash('#/transactie/abc123').naam, 'transactie');
  assert.equal(parseHash('#/transactie/abc123').id, 'abc123');
  assert.deepEqual(parseHash('#/transactie'), { naam: 'dashboard', query: {} });
  assert.deepEqual(parseHash('#/bestaat-niet'), { naam: 'dashboard', query: {} });
});

test('parseHash leest queryparameters', () => {
  const route = parseHash('#/transacties?eenmalig=1&van=2026-07-01&categorie=a%20b&leeg');
  assert.equal(route.query.eenmalig, '1');
  assert.equal(route.query.van, '2026-07-01');
  assert.equal(route.query.categorie, 'a b');
  assert.equal(route.query.leeg, '');
});

test('startRouter rendert direct en bij elke hashwijziging', async () => {
  const venster = maakFakeVenster();
  const routes = [];
  startRouter(venster, (route) => routes.push(route.naam));
  assert.deepEqual(routes, ['dashboard']);
  venster.location.hash = '#/regels';
  await venster.emit('hashchange');
  assert.deepEqual(routes, ['dashboard', 'regels']);
});
