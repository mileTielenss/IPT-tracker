import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDetail } from '../js/views/detail.js';
import { bewaarAlle, haal } from '../js/db.js';
import { maakCtx, maakTx, maakRegelObject, scherm } from './helpers/omgeving.js';
import { zoekKnop, zoekTag, zoekAlle, spoel } from './helpers/fakedom.js';

test('detail toont alle velden en labels', async () => {
  const ctx = await maakCtx();
  const tx = maakTx({
    bookingDate: '2026-07-13', valueDate: '2026-07-14', amountCents: -4550, balanceCents: 878177,
    counterpartyName: 'LE MIRANTE', counterpartyIban: 'BE10', merchant: 'LE MIRANTE',
    description: 'BETALING VIA DEBIT MASTERCARD', structuredRef: '+++1+++', freeRef: 'vrij',
    isInternal: true, isOneOff: true, categoryId: 'horeca',
  });
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  await renderDetail(ctx, scherm(ctx), { naam: 'transactie', id: tx.id, query: {} });
  const tekst = scherm(ctx).textContent;
  assert.ok(tekst.includes('13/07/2026'));
  assert.ok(tekst.includes('14/07/2026'));
  assert.ok(tekst.includes('45,50'));
  assert.ok(tekst.includes('8.781,77'));
  assert.ok(tekst.includes('LE MIRANTE BE10'));
  assert.ok(tekst.includes('+++1+++'));
  assert.ok(tekst.includes('vrij'));
  assert.ok(tekst.includes('intern eenmalig'));
  assert.ok(tekst.includes('Categorie: Horeca'));
  assert.ok(tekst.includes('Eenmalig-markering verwijderen'));
});

test('onbekende transactie geeft een nette melding', async () => {
  const ctx = await maakCtx();
  await renderDetail(ctx, scherm(ctx), { naam: 'transactie', id: 'bestaat-niet', query: {} });
  assert.ok(scherm(ctx).textContent.includes('niet gevonden'));
});

test('klasse-overschrijving zetten en terugdraaien via undo', async () => {
  const ctx = await maakCtx();
  const tx = maakTx({ categoryId: 'verzekeringen' });
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  await renderDetail(ctx, scherm(ctx), { naam: 'transactie', id: tx.id, query: {} });
  // automatisch-label toont de categorie-klasse
  const kop = zoekAlle(scherm(ctx), (e) => e.tagName === 'h2' && e.textContent === 'Kostenklasse')[0];
  const kiezer = scherm(ctx).children[scherm(ctx).children.indexOf(kop) + 1];
  assert.ok(kiezer.children[0].textContent.includes('vast'));
  kiezer.value = 'discretionair';
  await kiezer.dispatch('change');
  await spoel();
  let bewaard = await haal(ctx.db, 'transactions', tx.id);
  assert.equal(bewaard.costClass, 'discretionair');
  assert.equal(bewaard.manualClass, true);
  assert.equal(ctx.herlaadTeller, 1);
  await zoekKnop(ctx.doc.getElementById('meldingen'), 'Ongedaan maken').click();
  await spoel();
  bewaard = await haal(ctx.db, 'transactions', tx.id);
  assert.equal(bewaard.costClass, null);
  // terug naar automatisch
  await bewaarAlle(ctx.db, 'transactions', [{ ...tx, costClass: 'vast', manualClass: true }]);
  scherm(ctx).textContent = '';
  await renderDetail(ctx, scherm(ctx), { naam: 'transactie', id: tx.id, query: {} });
  const kiezer2 = zoekTag(scherm(ctx), 'select').at(-1);
  assert.equal(kiezer2.value, 'vast');
  kiezer2.value = '';
  await kiezer2.dispatch('change');
  await spoel();
  bewaard = await haal(ctx.db, 'transactions', tx.id);
  assert.equal(bewaard.costClass, null);
  assert.equal(bewaard.manualClass, false);
});

test('categorie kiezen vanuit het detail herlaadt het scherm', async () => {
  const ctx = await maakCtx();
  const tx = maakTx();
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  await renderDetail(ctx, scherm(ctx), { naam: 'transactie', id: tx.id, query: {} });
  const kiezer = zoekTag(scherm(ctx), 'select')[0];
  kiezer.value = 'horeca';
  await kiezer.dispatch('change');
  await zoekKnop(scherm(ctx), 'Alleen deze transactie').click();
  await spoel();
  assert.equal((await haal(ctx.db, 'transactions', tx.id)).categoryId, 'horeca');
  assert.equal(ctx.herlaadTeller, 1);
});

test('inkomende transactie heeft geen klassekiezer', async () => {
  const ctx = await maakCtx();
  const tx = maakTx({ amountCents: 302500 });
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  await renderDetail(ctx, scherm(ctx), { naam: 'transactie', id: tx.id, query: {} });
  assert.ok(!scherm(ctx).textContent.includes('Kostenklasse'));
});

test('eenmalig-knop en regelverwijzing', async () => {
  const ctx = await maakCtx();
  const regel = maakRegelObject({ id: 'r1', value: 'telenet' });
  const tx = maakTx({ categoryId: 'telecom', ruleId: 'r1' });
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  await bewaarAlle(ctx.db, 'rules', [regel]);
  await renderDetail(ctx, scherm(ctx), { naam: 'transactie', id: tx.id, query: {} });
  assert.ok(scherm(ctx).textContent.includes('gecategoriseerd door de regel'));
  assert.ok(scherm(ctx).textContent.includes('"telenet"'));
  await zoekKnop(scherm(ctx), 'Markeer als eenmalig').click();
  await spoel();
  assert.equal((await haal(ctx.db, 'transactions', tx.id)).isOneOff, true);
  // verwijderde regel: geen verwijzing meer
  const zwerver = maakTx({ categoryId: 'telecom', ruleId: 'weg' });
  await bewaarAlle(ctx.db, 'transactions', [zwerver]);
  scherm(ctx).textContent = '';
  await renderDetail(ctx, scherm(ctx), { naam: 'transactie', id: zwerver.id, query: {} });
  assert.ok(!scherm(ctx).textContent.includes('gecategoriseerd door de regel'));
});
