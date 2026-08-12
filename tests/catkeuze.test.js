import test from 'node:test';
import assert from 'node:assert/strict';
import { maakRegel, maakRegelVoorTransactie, categoriePaneel, suggestieVoorstel } from '../js/views/catkeuze.js';
import { alles, bewaarAlle, haal } from '../js/db.js';
import { categorieMap, standaardCategorieen } from '../js/categories.js';
import { maakCtx, maakTx } from './helpers/omgeving.js';
import { zoekKnop, zoekTag, zoekAlle, spoel } from './helpers/fakedom.js';

const catMap = categorieMap(standaardCategorieen());

test('maakRegel voegt toe, past direct toe en telt hits', async () => {
  const ctx = await maakCtx();
  const raak = maakTx({ counterpartyName: 'TELENET BV' });
  const handmatig = maakTx({ counterpartyName: 'TELENET BV', manualCategory: true });
  await bewaarAlle(ctx.db, 'transactions', [raak, handmatig]);
  const aantal = await maakRegel(ctx, {
    field: 'counterpartyName', matchType: 'contains', value: 'telenet', categoryId: 'telecom',
  }, [raak, handmatig]);
  assert.equal(aantal, 1);
  const regels = await alles(ctx.db, 'rules');
  assert.equal(regels.length, 1);
  assert.equal(regels[0].hitCount, 1);
  assert.equal((await haal(ctx.db, 'transactions', raak.id)).categoryId, 'telecom');
  assert.equal((await haal(ctx.db, 'transactions', handmatig.id)).categoryId, null);
});

test('maakRegelVoorTransactie kiest equals voor IBAN en contains voor tekst', async () => {
  const ctx = await maakCtx();
  const metIban = maakTx({ counterpartyIban: 'BE12', counterpartyName: 'TELENET BV' });
  await bewaarAlle(ctx.db, 'transactions', [metIban]);
  await maakRegelVoorTransactie(ctx, metIban, 'telecom', [metIban]);
  const [ibanRegel] = await alles(ctx.db, 'rules');
  assert.equal(ibanRegel.field, 'counterpartyIban');
  assert.equal(ibanRegel.matchType, 'equals');
  const metNaam = maakTx({ counterpartyName: 'LIANTIS VZW' });
  await maakRegelVoorTransactie(ctx, metNaam, 'sociaal-secretariaat', [metNaam]);
  const naamRegel = (await alles(ctx.db, 'rules')).find((r) => r.field === 'counterpartyName');
  assert.equal(naamRegel.matchType, 'contains');
});

test('categoriePaneel: alleen deze transactie, met undo', async () => {
  const ctx = await maakCtx();
  const tx = maakTx({ counterpartyName: 'X' });
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  let klaar = 0;
  const paneel = categoriePaneel(ctx, tx, standaardCategorieen(), [tx], () => klaar++);
  const kiezer = zoekTag(paneel, 'select')[0];
  // uitgaande transactie: geen inkomstencategorieën en geen systeemcategorie
  const waarden = kiezer.children.map((optie) => optie.getAttribute('value'));
  assert.ok(!waarden.includes('omzet-consulting'));
  assert.ok(!waarden.includes('ongecategoriseerd'));
  kiezer.value = 'horeca';
  await kiezer.dispatch('change');
  await zoekKnop(paneel, 'Alleen deze transactie').click();
  await spoel();
  const bewaard = await haal(ctx.db, 'transactions', tx.id);
  assert.equal(bewaard.categoryId, 'horeca');
  assert.equal(bewaard.manualCategory, true);
  assert.equal(klaar, 1);
  const toasts = ctx.doc.getElementById('meldingen');
  await zoekKnop(toasts, 'Ongedaan maken').click();
  await spoel();
  assert.equal((await haal(ctx.db, 'transactions', tx.id)).categoryId, null);
  assert.equal(klaar, 2);
});

test('categoriePaneel: terug naar ongecategoriseerd via lege keuze', async () => {
  const ctx = await maakCtx();
  const tx = maakTx({ categoryId: 'horeca', manualCategory: true });
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  let klaar = 0;
  const paneel = categoriePaneel(ctx, tx, standaardCategorieen(), [tx], () => klaar++);
  const kiezer = zoekTag(paneel, 'select')[0];
  kiezer.value = '';
  await kiezer.dispatch('change');
  await spoel();
  const bewaard = await haal(ctx.db, 'transactions', tx.id);
  assert.equal(bewaard.categoryId, null);
  assert.equal(bewaard.manualCategory, false);
  assert.equal(klaar, 1);
});

test('categoriePaneel: regel aanmaken met live teller en aanpasbare velden', async () => {
  const ctx = await maakCtx();
  const tx = maakTx({ counterpartyName: 'TELENET BV', amountCents: -6250 });
  const tweede = maakTx({ counterpartyName: 'TELENET BV', amountCents: -6250 });
  const andere = maakTx({ counterpartyName: 'PROXIMUS' });
  const alleTx = [tx, tweede, andere];
  await bewaarAlle(ctx.db, 'transactions', alleTx);
  let klaar = 0;
  const paneel = categoriePaneel(ctx, tx, standaardCategorieen(), alleTx, () => klaar++);
  const kiezer = zoekTag(paneel, 'select')[0];
  kiezer.value = 'telecom';
  await kiezer.dispatch('change');
  await zoekKnop(paneel, 'Regel aanmaken').click();
  const teller = zoekAlle(paneel, (e) => e.textContent.includes('raakt'))[0];
  assert.ok(teller.textContent.includes('2'));
  // veld, matchtype en waarde aanpassen vóór bevestiging (spec 6.3)
  const [veldKeuze, typeKeuze] = zoekTag(paneel, 'select').slice(1);
  const invoer = zoekTag(paneel, 'input')[0];
  invoer.value = 'PROXIMUS';
  await invoer.dispatch('input');
  assert.ok(teller.textContent.includes('1'));
  veldKeuze.value = 'description';
  await veldKeuze.dispatch('change');
  assert.ok(teller.textContent.includes('0'));
  veldKeuze.value = 'counterpartyName';
  await veldKeuze.dispatch('change');
  typeKeuze.value = 'equals';
  await typeKeuze.dispatch('change');
  assert.ok(teller.textContent.includes('1'));
  invoer.value = 'telenet bv';
  await invoer.dispatch('input');
  await zoekKnop(paneel, 'Regel bevestigen').click();
  await spoel();
  assert.equal(klaar, 1);
  const regels = await alles(ctx.db, 'rules');
  assert.equal(regels.length, 1);
  assert.equal(regels[0].matchType, 'equals');
  assert.equal((await haal(ctx.db, 'transactions', tweede.id)).categoryId, 'telecom');
  assert.equal((await haal(ctx.db, 'transactions', andere.id)).categoryId, null);
});

test('regelformulier stelt equals voor bij een transactie met IBAN', async () => {
  const ctx = await maakCtx();
  const tx = maakTx({ counterpartyIban: 'BE12', counterpartyName: 'TELENET BV' });
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  const paneel = categoriePaneel(ctx, tx, standaardCategorieen(), [tx], () => {});
  const kiezer = zoekTag(paneel, 'select')[0];
  kiezer.value = 'telecom';
  await kiezer.dispatch('change');
  await zoekKnop(paneel, 'Regel aanmaken').click();
  await zoekKnop(paneel, 'Regel bevestigen').click();
  await spoel();
  const [regel] = await alles(ctx.db, 'rules');
  assert.equal(regel.field, 'counterpartyIban');
  assert.equal(regel.matchType, 'equals');
  assert.equal(regel.value, 'BE12');
});

test('suggestieVoorstel: bevestigen maakt een regel op het beste veld', async () => {
  const ctx = await maakCtx();
  const tx = maakTx({ counterpartyName: 'LIANTIS VZW', counterpartyIban: 'BE45' });
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  let klaar = 0;
  const paneel = suggestieVoorstel(ctx, tx, standaardCategorieen(), catMap, [tx], () => klaar++);
  assert.ok(paneel.textContent.includes('Sociaal secretariaat'));
  await zoekKnop(paneel, 'Bevestig suggestie').click();
  await spoel();
  assert.equal(klaar, 1);
  const [regel] = await alles(ctx.db, 'rules');
  assert.equal(regel.field, 'counterpartyIban');
  assert.equal(regel.categoryId, 'sociaal-secretariaat');
  assert.equal((await haal(ctx.db, 'transactions', tx.id)).categoryId, 'sociaal-secretariaat');
});

test('suggestieVoorstel: andere categorie en geen suggestie', async () => {
  const ctx = await maakCtx();
  const bekend = maakTx({ counterpartyName: 'TELENET BV' });
  const paneel = suggestieVoorstel(ctx, bekend, standaardCategorieen(), catMap, [bekend], () => {});
  await zoekKnop(paneel, 'Andere categorie').click();
  assert.equal(zoekTag(paneel, 'select').length, 1);
  const onbekend = maakTx({ counterpartyName: 'MYSTERIE BV' });
  const direct = suggestieVoorstel(ctx, onbekend, standaardCategorieen(), catMap, [onbekend], () => {});
  assert.equal(zoekTag(direct, 'select').length, 1);
  assert.ok(!direct.textContent.includes('Suggestie'));
});
