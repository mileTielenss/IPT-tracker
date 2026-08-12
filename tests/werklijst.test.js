import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWerklijst } from '../js/views/werklijst.js';
import { alles, bewaarAlle, haal } from '../js/db.js';
import { maakCtx, maakTx, scherm } from './helpers/omgeving.js';
import { zoekKnop, spoel } from './helpers/fakedom.js';

test('werklijst toont de nieuwste ongecategoriseerde met suggestie', async () => {
  const ctx = await maakCtx();
  const oud = maakTx({ bookingDate: '2026-07-05', counterpartyName: 'MYSTERIE BV' });
  const nieuw = maakTx({ bookingDate: '2026-07-15', counterpartyName: 'TELENET BV', counterpartyIban: 'BE12' });
  const middel = maakTx({ bookingDate: '2026-07-10', counterpartyName: 'TUSSENDOOR' });
  const intern = maakTx({ bookingDate: '2026-07-20', isInternal: true });
  const klaarTx = maakTx({ bookingDate: '2026-07-21', categoryId: 'horeca' });
  await bewaarAlle(ctx.db, 'transactions', [oud, nieuw, middel, intern, klaarTx]);
  await renderWerklijst(ctx, scherm(ctx));
  const tekst = scherm(ctx).textContent;
  assert.ok(tekst.includes('Nog 3 te categoriseren'));
  assert.ok(tekst.includes('TELENET BV'));
  assert.ok(tekst.includes('Suggestie: Telecom en abonnementen'));
  // bevestigen maakt een regel en categoriseert
  await zoekKnop(scherm(ctx), 'Bevestig suggestie').click();
  await spoel();
  assert.equal((await haal(ctx.db, 'transactions', nieuw.id)).categoryId, 'telecom');
  assert.equal((await alles(ctx.db, 'rules')).length, 1);
  assert.equal(ctx.herlaadTeller, 1);
});

test('lege werklijst meldt dat alles klaar is', async () => {
  const ctx = await maakCtx();
  await renderWerklijst(ctx, scherm(ctx));
  assert.ok(scherm(ctx).textContent.includes('Alles is gecategoriseerd'));
});

test('werklijst zonder suggestie toont meteen de categoriekiezer', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', [maakTx({ merchant: 'ONBEKEND', description: 'iets' })]);
  await renderWerklijst(ctx, scherm(ctx));
  assert.ok(!scherm(ctx).textContent.includes('Suggestie:'));
  assert.ok(scherm(ctx).textContent.includes('ONBEKEND'));
});
