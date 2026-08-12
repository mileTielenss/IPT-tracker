import test from 'node:test';
import assert from 'node:assert/strict';
import { renderInstellingen } from '../js/views/instellingen.js';
import { alles, bewaar, bewaarAlle, haal, haalInstelling } from '../js/db.js';
import { ONGECATEGORISEERD } from '../js/categories.js';
import { maakCtx, maakTx, maakRegelObject, scherm } from './helpers/omgeving.js';
import { zoekKnop, zoekTag, zoekAlle, spoel, maakFakeBestand } from './helpers/fakedom.js';
import { maakBackup } from '../js/backup.js';
import { standaardCategorieen } from '../js/categories.js';

function categorieRijen(ctx) {
  return zoekAlle(scherm(ctx), (e) => e.className === 'categorie-lijst')[0].children;
}

test('categorie hernoemen, klasse wijzigen en toevoegen', async () => {
  const ctx = await maakCtx();
  await renderInstellingen(ctx, scherm(ctx));
  const eersteUitgave = categorieRijen(ctx).find((rij) => zoekTag(rij, 'select').length > 0);
  const naamInvoer = zoekTag(eersteUitgave, 'input')[0];
  naamInvoer.value = 'Polissen';
  await naamInvoer.dispatch('change');
  await spoel();
  assert.equal((await haal(ctx.db, 'categories', 'verzekeringen')).name, 'Polissen');
  const klasseKeuze = zoekTag(eersteUitgave, 'select')[0];
  klasseKeuze.value = 'variabel';
  await klasseKeuze.dispatch('change');
  await spoel();
  assert.equal((await haal(ctx.db, 'categories', 'verzekeringen')).costClass, 'variabel');
  // toevoegen: uitgave met klasse, daarna inkomst zonder klasse
  const toevoegVak = zoekAlle(scherm(ctx), (e) => e.className === 'toevoegen')[0];
  const nieuwNaam = zoekTag(toevoegVak, 'input')[0];
  const [typeKeuze, klasseNieuw] = zoekTag(toevoegVak, 'select');
  nieuwNaam.value = 'Opleidingen';
  klasseNieuw.value = 'discretionair';
  await klasseNieuw.dispatch('change');
  await typeKeuze.dispatch('change');
  await zoekKnop(toevoegVak, 'Voeg toe').click();
  await spoel();
  const opleidingen = (await alles(ctx.db, 'categories')).find((c) => c.name === 'Opleidingen');
  assert.equal(opleidingen.costClass, 'discretionair');
  assert.equal(opleidingen.type, 'uit');
  nieuwNaam.value = 'Subsidies';
  typeKeuze.value = 'in';
  await zoekKnop(toevoegVak, 'Voeg toe').click();
  await spoel();
  const subsidies = (await alles(ctx.db, 'categories')).find((c) => c.name === 'Subsidies');
  assert.equal(subsidies.type, 'in');
  assert.equal(subsidies.costClass, null);
  // lege naam doet niets
  nieuwNaam.value = '   ';
  await zoekKnop(toevoegVak, 'Voeg toe').click();
  assert.equal((await alles(ctx.db, 'categories')).length, 19);
});

test('categorie verwijderen: confirm met aantal, transacties terug naar ongecategoriseerd', async () => {
  const ctx = await maakCtx();
  const tx = maakTx({ categoryId: 'horeca', manualCategory: true, ruleId: 'r1' });
  await bewaarAlle(ctx.db, 'transactions', [tx]);
  await bewaarAlle(ctx.db, 'rules', [
    maakRegelObject({ id: 'r1', categoryId: 'horeca' }),
    maakRegelObject({ id: 'r2', categoryId: 'telecom' }),
  ]);
  await renderInstellingen(ctx, scherm(ctx));
  const horecaRij = categorieRijen(ctx).find((rij) => zoekTag(rij, 'input')[0].value === 'Horeca');
  // eerst weigeren
  ctx.venster.confirmAntwoord = false;
  await zoekKnop(horecaRij, 'Verwijder').click();
  await spoel();
  assert.ok((await haal(ctx.db, 'categories', 'horeca')) !== undefined);
  // dan bevestigen
  ctx.venster.confirmAntwoord = true;
  await zoekKnop(horecaRij, 'Verwijder').click();
  await spoel();
  assert.ok(ctx.venster.confirmTeksten.at(-1).includes('1 transacties'));
  assert.equal(await haal(ctx.db, 'categories', 'horeca'), undefined);
  const bewaard = await haal(ctx.db, 'transactions', tx.id);
  assert.equal(bewaard.categoryId, null);
  assert.equal(bewaard.manualCategory, false);
  // regels naar die categorie zijn mee verwijderd
  assert.deepEqual((await alles(ctx.db, 'rules')).map((r) => r.id), ['r2']);
  // de systeemcategorie heeft geen verwijderknop
  const systeemRij = categorieRijen(ctx).find((rij) => zoekTag(rij, 'input')[0].value === 'Ongecategoriseerd');
  assert.equal(zoekKnop(systeemRij, 'Verwijder'), undefined);
});

test('eigen rekeningen toevoegen en verwijderen werkt retroactief (acceptatie 2)', async () => {
  const ctx = await maakCtx();
  const naarPrive = maakTx({ counterpartyIban: 'BE77987654321098', amountCents: -150000 });
  const anders = maakTx({ counterpartyIban: 'BE10' });
  await bewaarAlle(ctx.db, 'transactions', [naarPrive, anders]);
  await renderInstellingen(ctx, scherm(ctx));
  const invoeren = zoekAlle(scherm(ctx), (e) => e.getAttribute('placeholder') === 'BE68539007547034');
  const ibanInvoer = invoeren[0];
  const labelInvoer = zoekAlle(scherm(ctx), (e) => e.getAttribute('placeholder') === 'Label')[0];
  ibanInvoer.value = 'BE77 9876 5432 1098';
  labelInvoer.value = 'Privé';
  await zoekKnop(ibanInvoer.parentNode, 'Voeg toe').click();
  await spoel();
  assert.deepEqual((await alles(ctx.db, 'ownAccounts'))[0], { iban: 'BE77987654321098', label: 'Privé' });
  assert.equal((await haal(ctx.db, 'transactions', naarPrive.id)).isInternal, true);
  assert.equal((await haal(ctx.db, 'transactions', anders.id)).isInternal, false);
  // lege invoer doet niets
  ibanInvoer.value = ' ';
  await zoekKnop(ibanInvoer.parentNode, 'Voeg toe').click();
  assert.equal((await alles(ctx.db, 'ownAccounts')).length, 1);
  // verwijderen draait de markering terug
  scherm(ctx).textContent = '';
  await renderInstellingen(ctx, scherm(ctx));
  const rekeningRij = zoekAlle(scherm(ctx), (e) => e.tagName === 'li' && e.textContent.includes('Privé'))[0];
  await zoekKnop(rekeningRij, 'Verwijder').click();
  await spoel();
  assert.deepEqual(await alles(ctx.db, 'ownAccounts'), []);
  assert.equal((await haal(ctx.db, 'transactions', naarPrive.id)).isInternal, false);
});

test('boekjaar-startmaand instellen reset de dashboardstand', async () => {
  const ctx = await maakCtx();
  ctx.dashboardStand.boekjaar = 2026;
  await renderInstellingen(ctx, scherm(ctx));
  const keuze = zoekAlle(scherm(ctx), (e) => e.tagName === 'select' && e.children.length === 12)[0];
  keuze.value = '7';
  await keuze.dispatch('change');
  await spoel();
  assert.equal(await haalInstelling(ctx.db, 'boekjaarStartMaand', 1), 7);
  assert.equal(ctx.dashboardStand.boekjaar, null);
});

test('backup downloaden en CSV-export', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', [maakTx({ categoryId: 'horeca' })]);
  let laatsteBlob = null;
  ctx.venster.URL.createObjectURL = (blob) => {
    laatsteBlob = blob;
    return 'blob:fake';
  };
  await renderInstellingen(ctx, scherm(ctx));
  await zoekKnop(scherm(ctx), 'Backup downloaden').click();
  await spoel();
  const backup = JSON.parse(laatsteBlob.delen[0]);
  assert.equal(backup.schemaVersie, 1);
  assert.equal(backup.transactions.length, 1);
  assert.equal(backup.categories.length, 17);
  assert.ok(await haalInstelling(ctx.db, 'laatsteBackupMoment', 0) > 0);
  await zoekKnop(scherm(ctx), 'Exporteer transacties als CSV').click();
  await spoel();
  assert.ok(laatsteBlob.delen[0].includes('Horeca'));
  assert.ok(laatsteBlob.delen[0].includes(';'));
});

test('backup terugzetten vervangt alles na confirm', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', [maakTx(), maakTx()]);
  const inhoud = JSON.stringify(maakBackup({
    transactions: [maakTx({ counterpartyName: 'UIT BACKUP' })],
    categories: standaardCategorieen(),
    rules: [],
    ownAccounts: [{ iban: 'BE77', label: 'Privé' }],
    recurringCandidates: [],
    settings: [{ sleutel: 'boekjaarStartMaand', waarde: 7 }],
  }));
  await renderInstellingen(ctx, scherm(ctx));
  const herstelInvoer = zoekAlle(scherm(ctx),
    (e) => e.tagName === 'input' && e.getAttribute('type') === 'file')[0];
  let geopend = 0;
  herstelInvoer.addEventListener('click', () => geopend++);
  await zoekKnop(scherm(ctx), 'Backup terugzetten').click();
  assert.equal(geopend, 1);
  // ongeldig JSON
  herstelInvoer.files = [maakFakeBestand('geen json {')];
  await herstelInvoer.dispatch('change');
  await spoel();
  assert.ok(ctx.doc.getElementById('meldingen').textContent.includes('geen leesbare backup'));
  assert.equal((await alles(ctx.db, 'transactions')).length, 2);
  // geldig JSON, fout schema
  herstelInvoer.files = [maakFakeBestand('{"schemaVersie":99}')];
  await herstelInvoer.dispatch('change');
  await spoel();
  assert.ok(ctx.doc.getElementById('meldingen').textContent.includes('schemaversie'));
  // confirm geweigerd
  ctx.venster.confirmAntwoord = false;
  herstelInvoer.files = [maakFakeBestand(inhoud)];
  await herstelInvoer.dispatch('change');
  await spoel();
  assert.equal((await alles(ctx.db, 'transactions')).length, 2);
  // confirm aanvaard: alles vervangen
  ctx.venster.confirmAntwoord = true;
  await herstelInvoer.dispatch('change');
  await spoel();
  assert.ok(ctx.venster.confirmTeksten.at(-1).includes('vervangt alle huidige data'));
  const transacties = await alles(ctx.db, 'transactions');
  assert.equal(transacties.length, 1);
  assert.equal(transacties[0].counterpartyName, 'UIT BACKUP');
  assert.equal(await haalInstelling(ctx.db, 'boekjaarStartMaand', 1), 7);
  assert.equal((await alles(ctx.db, 'ownAccounts')).length, 1);
  assert.equal(ctx.herlaadTeller, 1);
});
