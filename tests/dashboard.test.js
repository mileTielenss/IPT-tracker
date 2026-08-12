import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDashboard } from '../js/views/dashboard.js';
import { alles, bewaar, bewaarAlle, bewaarInstelling } from '../js/db.js';
import { periodeStats } from '../js/stats.js';
import { categorieMap, standaardCategorieen } from '../js/categories.js';
import { maakCtx, maakTx, scherm } from './helpers/omgeving.js';
import { zoekKnop, zoekAlle, zoekTag, spoel, maakFakeBestand } from './helpers/fakedom.js';

function juliData() {
  return [
    maakTx({ amountCents: 302500, bookingDate: '2026-07-07', categoryId: 'omzet-consulting' }),
    maakTx({ amountCents: -20000, bookingDate: '2026-07-06', categoryId: 'verzekeringen' }),
    maakTx({ amountCents: -4550, bookingDate: '2026-07-13', categoryId: 'horeca', counterpartyName: 'LE MIRANTE' }),
    maakTx({ amountCents: -3000, bookingDate: '2026-07-08', merchant: 'DATS 24' }),
    maakTx({ amountCents: -150000, bookingDate: '2026-07-22', isInternal: true, counterpartyName: 'TIELENS MILE' }),
    maakTx({ amountCents: -7500, bookingDate: '2026-07-10', isOneOff: true, categoryId: 'aankopen-divers' }),
    maakTx({ amountCents: -10000, bookingDate: '2026-06-15', categoryId: 'verzekeringen' }),
  ];
}

test('dashboard toont kerncijfers zonder interne en eenmalige transacties', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', juliData());
  await renderDashboard(ctx, scherm(ctx));
  const tekst = scherm(ctx).textContent;
  // meest recente maand met data is juli 2026
  assert.ok(tekst.includes('juli 2026'));
  // totalen: in 3025,00; uit 275,50 (intern en eenmalig uitgesloten, acceptatie 2)
  assert.ok(tekst.includes('3.025,00'));
  assert.ok(tekst.includes('275,50'));
  assert.ok(tekst.includes('2.749,50'));
  // verschil met juni is aanwezig (juni heeft data)
  assert.ok(tekst.includes('+'));
  // ongecategoriseerd-banner: 1 transactie zonder categorie
  assert.ok(tekst.includes('1 transacties wachten op een categorie'));
  // eenmalig-regel toont aantal en bedrag (acceptatie 3)
  assert.ok(tekst.includes('1 eenmalige transacties verborgen'));
  assert.ok(tekst.includes('75,00'));
  // vaste lasten en discretionair
  assert.ok(tekst.includes('Vaste lasten'));
  assert.ok(tekst.includes('200,00'));
  assert.ok(tekst.includes('Horeca'));
  // grafiek is getekend
  const grafiek = zoekAlle(scherm(ctx), (e) => e.className === 'grafiek')[0];
  assert.ok(grafiek.innerHTML.includes('<svg'));
});

test('eenmalig-regel en topcategorie linken naar de gefilterde lijst', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', juliData());
  await renderDashboard(ctx, scherm(ctx));
  await zoekAlle(scherm(ctx), (e) => e.className === 'eenmalig-regel')[0].click();
  assert.ok(ctx.genavigeerd[0].includes('eenmalig=1'));
  assert.ok(ctx.genavigeerd[0].includes('van=2026-07-01'));
  const top = zoekAlle(scherm(ctx), (e) => e.tagName === 'li' && e.textContent.includes('Verzekeringen'))[0];
  await top.click();
  assert.ok(ctx.genavigeerd[1].includes('categorie=verzekeringen'));
  const recent = zoekAlle(scherm(ctx), (e) => e.tagName === 'li' && e.textContent.includes('LE MIRANTE'))[0];
  await recent.click();
  assert.ok(ctx.genavigeerd[2].startsWith('#/transactie/'));
});

test('periodeschakelaar: boekjaarstand met maandgemiddelde en navigatie', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', juliData());
  await renderDashboard(ctx, scherm(ctx));
  await zoekKnop(scherm(ctx), 'Boekjaar').click();
  assert.equal(ctx.dashboardStand.modus, 'boekjaar');
  assert.equal(ctx.herlaadTeller, 1);
  // herlaad simuleren
  scherm(ctx).textContent = '';
  await renderDashboard(ctx, scherm(ctx));
  const tekst = scherm(ctx).textContent;
  assert.ok(tekst.includes('Boekjaar 2026'));
  assert.ok(tekst.includes('gemiddeld'));
  // pijlen in boekjaarstand
  await zoekAlle(scherm(ctx), (e) => e.getAttribute('aria-label') === 'Vorige periode')[0].click();
  assert.equal(ctx.dashboardStand.boekjaar, 2025);
  await zoekAlle(scherm(ctx), (e) => e.getAttribute('aria-label') === 'Volgende periode')[0].click();
  assert.equal(ctx.dashboardStand.boekjaar, 2026);
  // terug naar maandstand; pijlen per maand
  await zoekKnop(scherm(ctx), 'Maand').click();
  assert.equal(ctx.dashboardStand.modus, 'maand');
  scherm(ctx).textContent = '';
  await renderDashboard(ctx, scherm(ctx));
  await zoekAlle(scherm(ctx), (e) => e.getAttribute('aria-label') === 'Vorige periode')[0].click();
  assert.deepEqual(ctx.dashboardStand.maand, { jaar: 2026, maand: 6 });
  await zoekAlle(scherm(ctx), (e) => e.getAttribute('aria-label') === 'Volgende periode')[0].click();
  assert.deepEqual(ctx.dashboardStand.maand, { jaar: 2026, maand: 7 });
});

test('boekjaar met afwijkende startmaand krijgt dubbel jaartal', async () => {
  const ctx = await maakCtx();
  await bewaarInstelling(ctx.db, 'boekjaarStartMaand', 7);
  await bewaarAlle(ctx.db, 'transactions', juliData());
  ctx.dashboardStand.modus = 'boekjaar';
  await renderDashboard(ctx, scherm(ctx));
  assert.ok(scherm(ctx).textContent.includes('Boekjaar 2026–2027'));
});

test('eenmalig markeren verlaagt onmiddellijk alle betrokken sommen (acceptatie 3)', async () => {
  const ctx = await maakCtx();
  const data = juliData();
  await bewaarAlle(ctx.db, 'transactions', data);
  const catMap = categorieMap(standaardCategorieen());
  const bereik = { van: '2026-07-01', tot: '2026-07-31' };
  const voor = periodeStats(await alles(ctx.db, 'transactions'), catMap, bereik);
  assert.equal(voor.perKlasse.vast, 20000);
  // markeer de verzekeringsuitgave als eenmalig
  await bewaar(ctx.db, 'transactions', { ...data[1], isOneOff: true });
  const na = periodeStats(await alles(ctx.db, 'transactions'), catMap, bereik);
  assert.equal(na.perKlasse.vast, 0);
  assert.equal(na.totUitCents, voor.totUitCents - 20000);
  assert.equal(na.perCategorie.get('verzekeringen'), undefined);
  assert.equal(na.eenmaligAantal, 2);
  assert.equal(na.eenmaligSomCents, -27500);
  // en in boekjaarstand ook
  const jaar = periodeStats(await alles(ctx.db, 'transactions'), catMap,
    { van: '2026-01-01', tot: '2026-12-31' });
  assert.equal(jaar.perKlasse.vast, 10000);
});

test('leeg dashboard valt terug op de huidige maand en toont bevestigde vaste kosten', async () => {
  const ctx = await maakCtx();
  await bewaar(ctx.db, 'recurringCandidates', {
    id: 'k1', sleutel: 'BE12|', naam: 'TELENET BV', frequentie: 'maandelijks',
    mediaanCents: 6250, maandbedragCents: 6250, txIds: [], status: 'bevestigd',
  });
  await bewaar(ctx.db, 'recurringCandidates', {
    id: 'k2', sleutel: 'BE45|', naam: 'LIANTIS', frequentie: 'maandelijks',
    mediaanCents: 1, maandbedragCents: 1, txIds: [], status: 'kandidaat',
  });
  await renderDashboard(ctx, scherm(ctx));
  const tekst = scherm(ctx).textContent;
  assert.ok(tekst.includes('TELENET BV (maandelijks)'));
  assert.ok(!tekst.includes('LIANTIS'));
  assert.ok(!tekst.includes('wachten op een categorie'));
  assert.ok(!tekst.includes('eenmalige transacties verborgen'));
  // geen data: geen verschilregels
  assert.ok(ctx.dashboardStand.maand !== null);
});

test('uploadknop opent de bestandskiezer en start de import', async () => {
  const ctx = await maakCtx();
  await renderDashboard(ctx, scherm(ctx));
  const invoer = zoekAlle(scherm(ctx), (e) => e.tagName === 'input' && e.getAttribute('type') === 'file')[0];
  let geopend = 0;
  invoer.addEventListener('click', () => geopend++);
  await zoekKnop(scherm(ctx), 'CSV opladen').click();
  assert.equal(geopend, 1);
  // zonder bestand doet change niets
  await invoer.dispatch('change');
  // met bestand start de flow (fout formaat -> banner)
  invoer.files = [maakFakeBestand('kapot')];
  await invoer.dispatch('change');
  await spoel();
  assert.ok(ctx.doc.getElementById('banners').textContent.includes('KBC-formaat'));
});
