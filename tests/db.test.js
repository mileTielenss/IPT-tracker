import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, alles, haal, bewaar, bewaarAlle, verwijder, leegStore, haalInstelling, bewaarInstelling, STORES } from '../js/db.js';
import { maakFakeIndexedDB } from './helpers/fakeidb.js';

test('openDb maakt alle stores aan', async () => {
  const db = await openDb(maakFakeIndexedDB());
  for (const store of STORES) assert.deepEqual(await alles(db, store), []);
});

test('openDb geeft de fout door als IndexedDB weigert', async () => {
  await assert.rejects(openDb(maakFakeIndexedDB({ faalOpen: true })), /niet beschikbaar/);
});

test('bewaar, haal, alles, verwijder en leegStore', async () => {
  const db = await openDb(maakFakeIndexedDB());
  await bewaar(db, 'categories', { id: 'a', name: 'A' });
  await bewaar(db, 'categories', { id: 'b', name: 'B' });
  assert.equal((await haal(db, 'categories', 'a')).name, 'A');
  assert.equal(await haal(db, 'categories', 'zoek'), undefined);
  assert.equal((await alles(db, 'categories')).length, 2);
  await verwijder(db, 'categories', 'a');
  assert.equal((await alles(db, 'categories')).length, 1);
  await leegStore(db, 'categories');
  assert.deepEqual(await alles(db, 'categories'), []);
});

test('bewaarAlle schrijft alles in één transactie', async () => {
  const db = await openDb(maakFakeIndexedDB());
  await bewaarAlle(db, 'rules', [{ id: 'r1' }, { id: 'r2' }]);
  assert.equal((await alles(db, 'rules')).length, 2);
});

test('mislukte schrijfacties verwerpen de belofte', async () => {
  const db = await openDb(maakFakeIndexedDB());
  db.faalModus = true;
  await assert.rejects(bewaar(db, 'categories', { id: 'x' }), /opslag mislukt/);
  await assert.rejects(bewaarAlle(db, 'rules', [{ id: 'r' }]), /opslag mislukt/);
});

test('instellingen als key-value store met standaardwaarde', async () => {
  const db = await openDb(maakFakeIndexedDB());
  assert.equal(await haalInstelling(db, 'boekjaarStartMaand', 1), 1);
  await bewaarInstelling(db, 'boekjaarStartMaand', 7);
  assert.equal(await haalInstelling(db, 'boekjaarStartMaand', 1), 7);
});
