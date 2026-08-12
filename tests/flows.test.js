import test from 'node:test';
import assert from 'node:assert/strict';
import { pasToe, bewaarRegelsMetTellers, verversVasteKosten, zetInterneStatus, zetEenmalig } from '../js/flows.js';
import { alles, bewaarAlle, bewaar, haal } from '../js/db.js';
import { maakCtx, maakTx, maakRegelObject } from './helpers/omgeving.js';
import { zoekKnop, spoel } from './helpers/fakedom.js';

test('pasToe schuift bijgewerkte kopieën in de lijst', () => {
  const a = maakTx();
  const b = maakTx();
  const nieuw = pasToe([a, b], [{ ...b, categoryId: 'horeca' }]);
  assert.equal(nieuw[0], a);
  assert.equal(nieuw[1].categoryId, 'horeca');
});

test('bewaarRegelsMetTellers schrijft hitCounts weg', async () => {
  const ctx = await maakCtx();
  const regel = maakRegelObject({ id: 'r1' });
  await bewaarRegelsMetTellers(ctx, [regel], [maakTx({ ruleId: 'r1' })]);
  assert.equal((await alles(ctx.db, 'rules'))[0].hitCount, 1);
});

test('verversVasteKosten bewaart kandidaten en past bevestigde reeksen toe', async () => {
  const ctx = await maakCtx();
  const reeks = ['2026-06-05', '2026-07-05', '2026-08-05'].map((datum) => maakTx({
    bookingDate: datum, amountCents: -6250, counterpartyIban: 'BE12', counterpartyName: 'TELENET BV',
  }));
  await bewaarAlle(ctx.db, 'transactions', reeks);
  let alleTx = await verversVasteKosten(ctx, reeks);
  let kandidaten = await alles(ctx.db, 'recurringCandidates');
  assert.equal(kandidaten.length, 1);
  assert.equal(kandidaten[0].status, 'kandidaat');
  assert.equal(alleTx[0].costClass, null);
  // bevestigen en opnieuw verversen: klasse-overschrijving vast op alle leden
  await bewaar(ctx.db, 'recurringCandidates', { ...kandidaten[0], status: 'bevestigd' });
  alleTx = await verversVasteKosten(ctx, alleTx);
  assert.ok(alleTx.every((tx) => tx.costClass === 'vast' && tx.manualClass));
  const bewaard = await alles(ctx.db, 'transactions');
  assert.ok(bewaard.every((tx) => tx.costClass === 'vast'));
  // nog eens: niets meer te wijzigen
  alleTx = await verversVasteKosten(ctx, alleTx);
  kandidaten = await alles(ctx.db, 'recurringCandidates');
  assert.equal(kandidaten[0].status, 'bevestigd');
});

test('zetInterneStatus markeert met terugwerkende kracht en terug', async () => {
  const ctx = await maakCtx();
  const raak = maakTx({ counterpartyIban: 'BE77' });
  const mis = maakTx({ counterpartyIban: 'BE88' });
  await bewaarAlle(ctx.db, 'transactions', [raak, mis]);
  await zetInterneStatus(ctx, 'BE77', true);
  assert.equal((await haal(ctx.db, 'transactions', raak.id)).isInternal, true);
  assert.equal((await haal(ctx.db, 'transactions', mis.id)).isInternal, false);
  await zetInterneStatus(ctx, 'BE77', false);
  assert.equal((await haal(ctx.db, 'transactions', raak.id)).isInternal, false);
  // niets te doen: geen schrijfactie
  await zetInterneStatus(ctx, 'BE99', true);
});

test('zetEenmalig markeert met undo-toast en draait terug', async () => {
  const ctx = await maakCtx();
  const tx = maakTx();
  await bewaar(ctx.db, 'transactions', tx);
  await zetEenmalig(ctx, tx, true);
  assert.equal((await haal(ctx.db, 'transactions', tx.id)).isOneOff, true);
  assert.equal(ctx.herlaadTeller, 1);
  const toast = ctx.doc.getElementById('meldingen');
  assert.ok(toast.textContent.includes('eenmalig'));
  await zoekKnop(toast, 'Ongedaan maken').click();
  await spoel();
  assert.equal((await haal(ctx.db, 'transactions', tx.id)).isOneOff, false);
  assert.equal(ctx.herlaadTeller, 2);
  // ontmarkeren heeft een eigen toast-tekst
  await zetEenmalig(ctx, { ...tx, isOneOff: true }, false);
  assert.ok(toast.textContent.includes('verwijderd'));
  assert.equal((await haal(ctx.db, 'transactions', tx.id)).isOneOff, false);
});

test('verversVasteKosten overschrijft ook een regel-klasse zonder handmatige vlag', async () => {
  const ctx = await maakCtx();
  const reeks = ['2026-06-05', '2026-07-05', '2026-08-05'].map((datum) => maakTx({
    bookingDate: datum, amountCents: -6250, counterpartyIban: 'BE12', costClass: 'vast', manualClass: false,
  }));
  await bewaarAlle(ctx.db, 'transactions', reeks);
  let alleTx = await verversVasteKosten(ctx, reeks);
  const kandidaat = (await alles(ctx.db, 'recurringCandidates'))[0];
  await bewaar(ctx.db, 'recurringCandidates', { ...kandidaat, status: 'bevestigd' });
  alleTx = await verversVasteKosten(ctx, alleTx);
  assert.ok(alleTx.every((tx) => tx.manualClass));
});
