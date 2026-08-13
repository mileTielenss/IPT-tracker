import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRegels } from '../js/views/regels.js';
import { alles, bewaar, bewaarAlle, haal } from '../js/db.js';
import { maakCtx, maakTx, maakRegelObject, scherm } from './helpers/omgeving.js';
import { zoekKnop, zoekTag, zoekAlle, spoel } from './helpers/fakedom.js';

function kandidaatObject(over = {}) {
  return {
    id: 'k1', sleutel: 'BE12|', naam: 'TELENET BV', frequentie: 'maandelijks',
    mediaanCents: 6250, maandbedragCents: 6250, txIds: [], status: 'kandidaat', ...over,
  };
}

test('regellijst toont veld, waarde, categorie, priority en hits', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'rules', [
    maakRegelObject({ id: 'r1', value: 'telenet', priority: 1, hitCount: 3 }),
    maakRegelObject({ id: 'r2', value: 'liantis', categoryId: 'sociaal-secretariaat', priority: 2, costClass: 'vast' }),
  ]);
  await renderRegels(ctx, scherm(ctx));
  const rijen = zoekAlle(scherm(ctx), (e) => e.className === 'regel-rij');
  assert.equal(rijen.length, 2);
  assert.ok(rijen[0].textContent.includes('Tegenpartij-naam bevat "telenet"'));
  assert.ok(rijen[0].textContent.includes('Telecom en abonnementen'));
  assert.ok(rijen[0].textContent.includes('3 transacties'));
  assert.equal(zoekTag(rijen[1], 'select')[0].value, 'vast');
  assert.ok(scherm(ctx).textContent.includes('Geen nieuwe kandidaten'));
});

test('alles herclassificeren respecteert handmatige categorieën (acceptatie 6)', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'rules', [maakRegelObject({ id: 'r1', value: 'telenet', categoryId: 'telecom' })]);
  const vrij = maakTx({ counterpartyName: 'TELENET BV' });
  const handmatig = maakTx({ counterpartyName: 'TELENET BV', manualCategory: true, categoryId: 'horeca' });
  await bewaarAlle(ctx.db, 'transactions', [vrij, handmatig]);
  await renderRegels(ctx, scherm(ctx));
  await zoekKnop(scherm(ctx), 'Alles herclassificeren').click();
  await spoel();
  assert.equal((await haal(ctx.db, 'transactions', vrij.id)).categoryId, 'telecom');
  assert.equal((await haal(ctx.db, 'transactions', handmatig.id)).categoryId, 'horeca');
  assert.ok(ctx.doc.getElementById('meldingen').textContent.includes('1 transacties veranderden'));
  assert.equal((await alles(ctx.db, 'rules'))[0].hitCount, 1);
  assert.equal(ctx.herlaadTeller, 1);
});

test('actief-toggle, klasse-overschrijving, herordenen en verwijderen', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'rules', [
    maakRegelObject({ id: 'r1', value: 'a', priority: 1 }),
    maakRegelObject({ id: 'r2', value: 'b', priority: 2 }),
  ]);
  const tx = maakTx({ ruleId: 'r1', categoryId: 'telecom' });
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  await renderRegels(ctx, scherm(ctx));
  const rijen = zoekAlle(scherm(ctx), (e) => e.className === 'regel-rij');
  // actief uitzetten
  const vak = zoekTag(rijen[0], 'input')[0];
  vak.checked = false;
  await vak.dispatch('change');
  await spoel();
  assert.equal((await haal(ctx.db, 'rules', 'r1')).active, false);
  // klasse-overschrijving instellen en terug
  const klasseKeuze = zoekTag(rijen[0], 'select')[0];
  klasseKeuze.value = 'vast';
  await klasseKeuze.dispatch('change');
  await spoel();
  assert.equal((await haal(ctx.db, 'rules', 'r1')).costClass, 'vast');
  klasseKeuze.value = '';
  await klasseKeuze.dispatch('change');
  await spoel();
  assert.equal((await haal(ctx.db, 'rules', 'r1')).costClass, null);
  // herordenen met pijltjes
  await zoekAlle(rijen[0], (e) => e.getAttribute('aria-label') === 'Regel omlaag')[0].click();
  await spoel();
  assert.equal((await haal(ctx.db, 'rules', 'r1')).priority, 2);
  await zoekAlle(rijen[1], (e) => e.getAttribute('aria-label') === 'Regel omhoog')[0].click();
  await spoel();
  assert.equal((await haal(ctx.db, 'rules', 'r2')).priority, 1);
  // verwijderen met confirm; transactie wordt losgekoppeld
  ctx.venster.confirmAntwoord = false;
  await zoekKnop(rijen[0], 'Verwijder').click();
  await spoel();
  assert.equal((await alles(ctx.db, 'rules')).length, 2);
  ctx.venster.confirmAntwoord = true;
  await zoekKnop(rijen[0], 'Verwijder').click();
  await spoel();
  assert.equal((await alles(ctx.db, 'rules')).length, 1);
  assert.ok(ctx.venster.confirmTeksten.at(-1).includes('verwijderen'));
  assert.equal((await haal(ctx.db, 'transactions', tx.id)).ruleId, null);
});

test('vaste kosten bevestigen zet klasse-overschrijving op de reeks', async () => {
  const ctx = await maakCtx();
  const reeks = ['2026-06-05', '2026-07-05', '2026-08-05'].map((datum) => maakTx({
    bookingDate: datum, amountCents: -6250, counterpartyIban: 'BE12',
  }));
  await bewaarAlle(ctx.db, 'transactions', reeks);
  await bewaar(ctx.db, 'recurringCandidates', kandidaatObject({ txIds: reeks.map((tx) => tx.id) }));
  await renderRegels(ctx, scherm(ctx));
  assert.ok(scherm(ctx).textContent.includes('TELENET BV · maandelijks'));
  await zoekKnop(scherm(ctx), 'Bevestig als vaste kost').click();
  await spoel();
  assert.equal((await haal(ctx.db, 'recurringCandidates', 'k1')).status, 'bevestigd');
  for (const tx of reeks) {
    const bewaard = await haal(ctx.db, 'transactions', tx.id);
    assert.equal(bewaard.costClass, 'vast');
    assert.equal(bewaard.manualClass, true);
  }
});

test('vaste kosten verwerpen laat de transacties met rust', async () => {
  const ctx = await maakCtx();
  const tx = maakTx({ amountCents: -6250, counterpartyIban: 'BE12' });
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  await bewaar(ctx.db, 'recurringCandidates', kandidaatObject({ txIds: [tx.id] }));
  await renderRegels(ctx, scherm(ctx));
  await zoekKnop(scherm(ctx), 'Verwerp').click();
  await spoel();
  assert.equal((await haal(ctx.db, 'recurringCandidates', 'k1')).status, 'verworpen');
  assert.equal((await haal(ctx.db, 'transactions', tx.id)).costClass, null);
});
