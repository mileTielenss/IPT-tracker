// Detailweergave van één transactie (spec 9): alle velden, categoriekiezer,
// klasse-overschrijving, eenmalig-toggle en de regel die categoriseerde.
import { el, keuzelijst } from '../dom.js';
import { alles, haal, bewaar } from '../db.js';
import { categorieMap, categorieNaam, effectieveKlasse, KLASSEN } from '../categories.js';
import { formatteerCenten, formatteerDatum } from '../format.js';
import { zetEenmalig } from '../flows.js';
import { categoriePaneel } from './catkeuze.js';

function rij(naam, waarde) {
  return el('div', { class: 'veld-rij' }, el('span', { class: 'veld-naam' }, naam),
    el('span', {}, waarde));
}

export async function renderDetail(ctx, wortel, route) {
  const tx = await haal(ctx.db, 'transactions', route.id);
  if (tx === undefined) {
    wortel.append(el('p', {}, 'Transactie niet gevonden. Ga terug naar de transactielijst.'));
    return;
  }
  const alleTx = await alles(ctx.db, 'transactions');
  const categorieen = await alles(ctx.db, 'categories');
  const regels = await alles(ctx.db, 'rules');
  const catMap = categorieMap(categorieen);
  wortel.append(el('h1', {}, 'Transactie'),
    el('div', { class: 'velden' },
      rij('Boekdatum', formatteerDatum(tx.bookingDate)),
      rij('Valutadatum', formatteerDatum(tx.valueDate)),
      rij('Bedrag', formatteerCenten(tx.amountCents)),
      rij('Saldo na boeking', formatteerCenten(tx.balanceCents)),
      rij('Rekening', tx.accountIban),
      rij('Richting', tx.direction),
      rij('Tegenpartij', `${tx.counterpartyName} ${tx.counterpartyIban}`.trim()),
      rij('Handelaar', tx.merchant),
      rij('Omschrijving', tx.description),
      rij('Gestructureerde mededeling', tx.structuredRef),
      rij('Vrije mededeling', tx.freeRef),
      rij('Labels', `${tx.isInternal ? 'intern ' : ''}${tx.isOneOff ? 'eenmalig' : ''}`.trim())));

  wortel.append(el('h2', {}, `Categorie: ${categorieNaam(catMap, tx.categoryId)}`),
    categoriePaneel(ctx, tx, categorieen, alleTx, () => ctx.herlaad()));

  // Klasse-overschrijving per transactie; overleeft herclassificatie (spec 4.3).
  if (tx.direction === 'uit') {
    const klasseKeuze = keuzelijst(
      [['', `Automatisch (${effectieveKlasse({ ...tx, costClass: null }, catMap)})`],
        ...KLASSEN.map((k) => [k, k])],
      tx.manualClass ? tx.costClass : '',
      async () => {
        const waarde = klasseKeuze.value;
        const nieuw = {
          ...tx,
          costClass: waarde === '' ? null : waarde,
          manualClass: waarde !== '',
        };
        await ctx.bewaar(() => bewaar(ctx.db, 'transactions', nieuw));
        ctx.meldingen.toonUndo('Kostenklasse aangepast.', async () => {
          await ctx.bewaar(() => bewaar(ctx.db, 'transactions', tx));
          ctx.herlaad();
        });
        ctx.herlaad();
      });
    wortel.append(el('h2', {}, 'Kostenklasse'), klasseKeuze);
  }

  wortel.append(el('h2', {}, 'Eenmalig'),
    el('button', { onclick: () => zetEenmalig(ctx, tx, !tx.isOneOff) },
      tx.isOneOff ? 'Eenmalig-markering verwijderen' : 'Markeer als eenmalig'));

  if (tx.ruleId !== null) {
    const regel = regels.find((r) => r.id === tx.ruleId);
    if (regel !== undefined) {
      wortel.append(el('p', { class: 'klein' },
        `Gecategoriseerd door regel: ${regel.field} ${regel.matchType} "${regel.value}". `,
        el('a', { href: '#/regels' }, 'Naar regelbeheer')));
    }
  }
}
