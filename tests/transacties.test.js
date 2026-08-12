import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTransacties, filterTransacties } from '../js/views/transacties.js';
import { bewaarAlle, haal } from '../js/db.js';
import { categorieMap, standaardCategorieen } from '../js/categories.js';
import { maakCtx, maakTx, scherm } from './helpers/omgeving.js';
import { zoekAlle, zoekTag, spoel } from './helpers/fakedom.js';

const catMap = categorieMap(standaardCategorieen());

test('filterTransacties dekt alle filters', () => {
  const txs = [
    maakTx({ bookingDate: '2026-07-05', categoryId: 'horeca', counterpartyName: 'LE MIRANTE', amountCents: -4550 }),
    maakTx({ bookingDate: '2026-07-10', categoryId: 'verzekeringen', structuredRef: '+++111+++', amountCents: -14500 }),
    maakTx({ bookingDate: '2026-07-15', isInternal: true, amountCents: -150000 }),
    maakTx({ bookingDate: '2026-07-20', isOneOff: true, freeRef: 'eenmalig ding', amountCents: -7500 }),
    maakTx({ bookingDate: '2026-08-01', amountCents: 302500, counterpartyName: 'ACME' }),
  ];
  const basis = { van: '', tot: '', categorie: '', klasse: '', richting: '', tekst: '', intern: 'toon', eenmalig: 'toon' };
  assert.equal(filterTransacties(txs, basis, catMap).length, 5);
  assert.equal(filterTransacties(txs, { ...basis, van: '2026-07-10' }, catMap).length, 4);
  assert.equal(filterTransacties(txs, { ...basis, tot: '2026-07-10' }, catMap).length, 2);
  assert.equal(filterTransacties(txs, { ...basis, categorie: 'horeca' }, catMap).length, 1);
  assert.equal(filterTransacties(txs, { ...basis, categorie: 'ongecategoriseerd' }, catMap).length, 3);
  assert.equal(filterTransacties(txs, { ...basis, klasse: 'vast' }, catMap).length, 1);
  assert.equal(filterTransacties(txs, { ...basis, klasse: 'variabel' }, catMap).length, 2);
  assert.equal(filterTransacties(txs, { ...basis, richting: 'in' }, catMap).length, 1);
  assert.equal(filterTransacties(txs, { ...basis, intern: 'verberg' }, catMap).length, 4);
  assert.equal(filterTransacties(txs, { ...basis, intern: 'alleen' }, catMap).length, 1);
  assert.equal(filterTransacties(txs, { ...basis, eenmalig: 'verberg' }, catMap).length, 4);
  assert.equal(filterTransacties(txs, { ...basis, eenmalig: 'alleen' }, catMap).length, 1);
  assert.equal(filterTransacties(txs, { ...basis, tekst: 'mirante' }, catMap).length, 1);
  assert.equal(filterTransacties(txs, { ...basis, tekst: '+++111' }, catMap).length, 1);
  assert.equal(filterTransacties(txs, { ...basis, tekst: 'eenmalig ding' }, catMap).length, 1);
  assert.equal(filterTransacties(txs, { ...basis, tekst: 'bestaat niet' }, catMap).length, 0);
});

test('lijst rendert nieuwste eerst met chips en labels', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', [
    maakTx({ bookingDate: '2026-07-05', counterpartyName: 'OUDSTE' }),
    maakTx({ bookingDate: '2026-07-20', counterpartyName: 'NIEUWSTE', isInternal: true, isOneOff: true }),
    maakTx({ bookingDate: '2026-07-10', merchant: 'HANDELAAR' }),
    maakTx({ bookingDate: '2026-07-11', description: 'alleen omschrijving hier' }),
  ]);
  await renderTransacties(ctx, scherm(ctx), { naam: 'transacties', query: {} });
  const rijen = zoekAlle(scherm(ctx), (e) => e.className === 'transactie-rij');
  assert.equal(rijen.length, 4);
  assert.ok(rijen[0].textContent.includes('NIEUWSTE'));
  assert.ok(rijen[0].textContent.includes('intern'));
  assert.ok(rijen[0].textContent.includes('eenmalig'));
  assert.ok(rijen[1].textContent.includes('alleen omschrijving'));
  assert.ok(rijen[2].textContent.includes('HANDELAAR'));
  assert.ok(rijen[3].textContent.includes('OUDSTE'));
  // klik op rij navigeert naar detail
  await zoekAlle(rijen[0], (e) => e.className === 'transactie-info')[0].click();
  assert.ok(ctx.genavigeerd[0].startsWith('#/transactie/'));
});

test('contextactie 1× markeert eenmalig vanuit de lijst', async () => {
  const ctx = await maakCtx();
  const tx = maakTx({ bookingDate: '2026-07-05' });
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  await renderTransacties(ctx, scherm(ctx), { naam: 'transacties', query: {} });
  await zoekAlle(scherm(ctx), (e) => e.className === 'contextactie')[0].click();
  await spoel();
  assert.equal((await haal(ctx.db, 'transactions', tx.id)).isOneOff, true);
  assert.equal(ctx.herlaadTeller, 1);
});

test('queryparameters sturen de filters; besturing werkt de lijst bij', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', [
    maakTx({ bookingDate: '2026-07-05', categoryId: 'horeca', counterpartyName: 'RESTO', amountCents: -4550 }),
    maakTx({ bookingDate: '2026-07-10', isOneOff: true, counterpartyName: 'EENMALIG BV' }),
    maakTx({ bookingDate: '2026-08-09', amountCents: 302500, counterpartyName: 'ACME' }),
  ]);
  await renderTransacties(ctx, scherm(ctx), {
    naam: 'transacties',
    query: { eenmalig: '1', van: '2026-07-01', tot: '2026-07-31' },
  });
  let rijen = zoekAlle(scherm(ctx), (e) => e.className === 'transactie-rij');
  assert.equal(rijen.length, 1);
  assert.ok(rijen[0].textContent.includes('EENMALIG BV'));
  // filters loslaten via de besturing
  const selects = zoekTag(scherm(ctx), 'select');
  const [catKeuze, klasseKeuze, richtingKeuze, internKeuze, eenmaligKeuze] = selects;
  eenmaligKeuze.value = 'toon';
  await eenmaligKeuze.dispatch('change');
  const [vanInvoer, totInvoer] = zoekTag(scherm(ctx), 'input');
  vanInvoer.value = '';
  await vanInvoer.dispatch('change');
  totInvoer.value = '';
  await totInvoer.dispatch('change');
  rijen = zoekAlle(scherm(ctx), (e) => e.className === 'transactie-rij');
  assert.equal(rijen.length, 3);
  // en dan aanscherpen met de andere filters
  richtingKeuze.value = 'uit';
  await richtingKeuze.dispatch('change');
  assert.equal(zoekAlle(scherm(ctx), (e) => e.className === 'transactie-rij').length, 2);
  catKeuze.value = 'horeca';
  await catKeuze.dispatch('change');
  assert.equal(zoekAlle(scherm(ctx), (e) => e.className === 'transactie-rij').length, 1);
  catKeuze.value = '';
  await catKeuze.dispatch('change');
  klasseKeuze.value = 'discretionair';
  await klasseKeuze.dispatch('change');
  assert.equal(zoekAlle(scherm(ctx), (e) => e.className === 'transactie-rij').length, 1);
  klasseKeuze.value = '';
  await klasseKeuze.dispatch('change');
  internKeuze.value = 'verberg';
  await internKeuze.dispatch('change');
  const zoekveld = zoekTag(scherm(ctx), 'input').at(-1);
  zoekveld.value = 'resto';
  await zoekveld.dispatch('input');
  rijen = zoekAlle(scherm(ctx), (e) => e.className === 'transactie-rij');
  assert.equal(rijen.length, 1);
  assert.ok(rijen[0].textContent.includes('RESTO'));
});
