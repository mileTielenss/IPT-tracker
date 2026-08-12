import test from 'node:test';
import assert from 'node:assert/strict';
import { maakBackup, valideerBackup, exporteerCsv, SCHEMA_VERSIE } from '../js/backup.js';
import { categorieMap, standaardCategorieen } from '../js/categories.js';
import { parseCsv } from '../js/csv.js';
import { maakTx } from './helpers/omgeving.js';

const stores = {
  transactions: [maakTx()],
  categories: standaardCategorieen(),
  rules: [],
  ownAccounts: [],
  recurringCandidates: [],
  settings: [{ sleutel: 'boekjaarStartMaand', waarde: 1 }],
};

test('maakBackup en valideerBackup horen bij elkaar', () => {
  const backup = maakBackup(stores);
  assert.equal(backup.schemaVersie, SCHEMA_VERSIE);
  assert.ok(valideerBackup(backup));
  assert.ok(valideerBackup(JSON.parse(JSON.stringify(backup))));
  assert.ok(!valideerBackup(null));
  assert.ok(!valideerBackup('tekst'));
  assert.ok(!valideerBackup({ ...backup, schemaVersie: 99 }));
  assert.ok(!valideerBackup({ ...backup, rules: 'geen-lijst' }));
});

test('exporteerCsv: puntkomma, decimale komma, dd/mm/jjjj, quoting', () => {
  const catMap = categorieMap(standaardCategorieen());
  const txs = [
    maakTx({
      bookingDate: '2026-07-13', valueDate: '2026-07-14', amountCents: -4550, balanceCents: 878177,
      merchant: 'LE MIRANTE', categoryId: 'horeca',
      description: 'BETALING; MET "QUOTES"\nEN REGEL', isOneOff: true,
    }),
    maakTx({ amountCents: 302500, bookingDate: '2026-06-09', counterpartyName: 'ACME', isInternal: true }),
  ];
  const csv = exporteerCsv(txs, catMap);
  const rijen = parseCsv(csv);
  assert.equal(rijen.length, 3);
  assert.equal(rijen[0][0], 'id');
  const uitgave = rijen[1];
  assert.equal(uitgave[2], '13/07/2026');
  assert.equal(uitgave[3], '14/07/2026');
  assert.equal(uitgave[4], '-45,50');
  assert.equal(uitgave[5], '8781,77');
  assert.equal(uitgave[10], 'BETALING; MET "QUOTES"\nEN REGEL');
  assert.equal(uitgave[13], 'Horeca');
  assert.equal(uitgave[14], 'discretionair');
  assert.equal(uitgave[16], 'ja');
  const inkomst = rijen[2];
  assert.equal(inkomst[4], '3025,00');
  assert.equal(inkomst[13], 'Ongecategoriseerd');
  assert.equal(inkomst[14], '');
  assert.equal(inkomst[15], 'ja');
  assert.equal(inkomst[16], 'nee');
});
