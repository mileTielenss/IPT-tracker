import test from 'node:test';
import assert from 'node:assert/strict';
import { importeerBestand } from '../js/views/importflow.js';
import { alles, bewaar, bewaarAlle, haalInstelling } from '../js/db.js';
import { maakCtx, maakTx, maakRegelObject, leesFixture } from './helpers/omgeving.js';
import { maakFakeBestand, zoekKnop, zoekAlle, spoel } from './helpers/fakedom.js';

async function importeerFixture(ctx) {
  await importeerBestand(ctx, maakFakeBestand(leesFixture()));
  await spoel();
  const overlay = zoekAlle(ctx.doc.body, (e) => e.className === 'overlay')[0];
  await zoekKnop(overlay, 'Importeren').click();
  await spoel(10);
}

test('volledige importflow met preview, regels, vaste kosten en kandidaten', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'rules', [maakRegelObject({ value: 'telenet', categoryId: 'telecom' })]);
  await importeerBestand(ctx, maakFakeBestand(leesFixture()));
  await spoel();
  const overlay = zoekAlle(ctx.doc.body, (e) => e.className === 'overlay')[0];
  assert.ok(overlay.textContent.includes('21 rijen: 21 nieuw, 0 dubbel, 0 foutief'));
  assert.ok(overlay.textContent.includes('05/06/2026'));
  assert.ok(overlay.textContent.includes('19/08/2026'));
  await zoekKnop(overlay, 'Importeren').click();
  await spoel(10);
  const transacties = await alles(ctx.db, 'transactions');
  assert.equal(transacties.length, 21);
  // regel liep automatisch over de import (acceptatie 4)
  const telenet = transacties.filter((tx) => tx.counterpartyName === 'TELENET BV');
  assert.equal(telenet.length, 3);
  assert.ok(telenet.every((tx) => tx.categoryId === 'telecom'));
  assert.equal((await alles(ctx.db, 'rules'))[0].hitCount, 3);
  // vaste-kostendetectie vond de drie reeksen
  const kandidaten = await alles(ctx.db, 'recurringCandidates');
  assert.equal(kandidaten.length, 3);
  // kandidaten voor eigen rekeningen (TIELENS MILE)
  const banner = ctx.doc.getElementById('banners');
  assert.ok(banner.textContent.includes('BE77987654321098'));
  assert.ok(banner.textContent.includes('rekening van de zaak'));
  assert.equal(ctx.herlaadTeller, 1);
  // toast met tellers
  assert.ok(ctx.doc.getElementById('meldingen').textContent.includes('21 nieuw, 0 dubbel, 0 foutief'));
});

test('tweede import van hetzelfde bestand: nul nieuw, alles dubbel (acceptatie 1)', async () => {
  const ctx = await maakCtx();
  await importeerFixture(ctx);
  await importeerBestand(ctx, maakFakeBestand(leesFixture()));
  await spoel();
  const overlay = zoekAlle(ctx.doc.body, (e) => e.className === 'overlay').at(-1);
  assert.ok(overlay.textContent.includes('0 nieuw, 21 dubbel, 0 foutief'));
  await zoekKnop(overlay, 'Importeren').click();
  await spoel(10);
  assert.equal((await alles(ctx.db, 'transactions')).length, 21);
});

test('eigen rekening bevestigen markeert retroactief; verwerpen onthoudt de keuze', async () => {
  const ctx = await maakCtx();
  await importeerFixture(ctx);
  const banner = ctx.doc.getElementById('banners');
  await zoekKnop(banner, 'Ja, rekening van de zaak').click();
  await spoel();
  assert.deepEqual((await alles(ctx.db, 'ownAccounts')).map((r) => r.iban), ['BE77987654321098']);
  const intern = (await alles(ctx.db, 'transactions')).filter((tx) => tx.isInternal);
  assert.equal(intern.length, 2);
  // volgende import stelt dezelfde rekening niet opnieuw voor
  ctx.meldingen.verwijderBanner('eigen-rekening');
  await importeerBestand(ctx, maakFakeBestand(leesFixture()));
  await spoel();
  const overlay = zoekAlle(ctx.doc.body, (e) => e.className === 'overlay').at(-1);
  await zoekKnop(overlay, 'Importeren').click();
  await spoel(10);
  assert.ok(!banner.textContent.includes('rekening van de zaak'));
});

test('eigen rekening verwerpen: IBAN komt niet terug', async () => {
  const ctx = await maakCtx();
  await importeerFixture(ctx);
  const banner = ctx.doc.getElementById('banners');
  await zoekKnop(banner, 'Nee').click();
  await spoel();
  assert.deepEqual(await alles(ctx.db, 'ownAccounts'), []);
  assert.deepEqual(await haalInstelling(ctx.db, 'verworpenEigenIbans', []), ['BE77987654321098']);
  await zoekKnop(banner, 'Sluiten').click();
  assert.ok(!ctx.doc.getElementById('banners').textContent.includes('rekening van de zaak'));
});

test('preview valt terug op de omschrijving zonder naam of handelaar', async () => {
  const ctx = await maakCtx();
  const regels = leesFixture().split('\n');
  const bankkosten = regels.find((r) => r.includes('AANREKENING KBC-PLUSREKENING'));
  await importeerBestand(ctx, maakFakeBestand(`${regels[0]}\n${bankkosten}`));
  await spoel();
  const overlay = zoekAlle(ctx.doc.body, (e) => e.className === 'overlay')[0];
  assert.ok(overlay.textContent.includes('AANREKENING KBC-PLUSREKENING'));
  await zoekKnop(overlay, 'Annuleren').click();
});

test('verkeerd formaat toont de actiegerichte fout met gevonden header', async () => {
  const ctx = await maakCtx();
  await importeerBestand(ctx, maakFakeBestand('Datum;Bedrag\n01/01/2026;1,00'));
  await spoel();
  const banner = ctx.doc.getElementById('banners');
  assert.ok(banner.textContent.includes('niet het verwachte KBC-formaat'));
  assert.ok(banner.textContent.includes('Datum;Bedrag'));
  await zoekKnop(banner, 'Sluiten').click();
  assert.equal(banner.children.length, 0);
  assert.deepEqual(await alles(ctx.db, 'transactions'), []);
});

test('annuleren in de preview importeert niets', async () => {
  const ctx = await maakCtx();
  await importeerBestand(ctx, maakFakeBestand(leesFixture()));
  await spoel();
  const overlay = zoekAlle(ctx.doc.body, (e) => e.className === 'overlay')[0];
  await zoekKnop(overlay, 'Annuleren').click();
  assert.deepEqual(await alles(ctx.db, 'transactions'), []);
  assert.equal(zoekAlle(ctx.doc.body, (e) => e.className === 'overlay').length, 0);
});

test('continuïteitswaarschuwing verschijnt bij een saldogat', async () => {
  const ctx = await maakCtx();
  // bestaande transactie met saldo dat niet aansluit op de fixture
  await bewaar(ctx.db, 'transactions', maakTx({
    bookingDate: '2026-05-30', amountCents: -100, balanceCents: 55555,
  }));
  await importeerFixture(ctx);
  const banner = ctx.doc.getElementById('banners');
  assert.ok(banner.textContent.includes('Mogelijk ontbreken er transacties'));
  await zoekKnop(banner, 'Sluiten').click();
  assert.ok(!banner.textContent.includes('Mogelijk ontbreken'));
});

test('interne markering bij import op basis van bestaande eigen rekeningen', async () => {
  const ctx = await maakCtx();
  await bewaar(ctx.db, 'ownAccounts', { iban: 'BE77987654321098', label: 'Privé' });
  await importeerFixture(ctx);
  const intern = (await alles(ctx.db, 'transactions')).filter((tx) => tx.isInternal);
  assert.equal(intern.length, 2);
  // geen kandidaat-banner: de rekening was al bekend
  assert.ok(!ctx.doc.getElementById('banners').textContent.includes('rekening van de zaak'));
});
