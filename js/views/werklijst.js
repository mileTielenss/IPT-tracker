// Werklijst (spec 8.3): ongecategoriseerde transacties één voor één
// afwerken met suggesties uit de herkenningslijst.
import { el } from '../dom.js';
import { alles } from '../db.js';
import { categorieMap } from '../categories.js';
import { formatteerCenten, formatteerDatum } from '../format.js';
import { suggestieVoorstel } from './catkeuze.js';

export async function renderWerklijst(ctx, wortel) {
  const alleTx = await alles(ctx.db, 'transactions');
  const categorieen = await alles(ctx.db, 'categories');
  const catMap = categorieMap(categorieen);
  const open = alleTx
    .filter((tx) => tx.categoryId === null && !tx.isInternal)
    .sort((a, b) => (a.bookingDate < b.bookingDate ? 1 : -1));
  wortel.append(el('h1', {}, 'Werklijst'));
  if (open.length === 0) {
    wortel.append(el('p', {}, 'Alles is gecategoriseerd. Goed bezig!'));
    return;
  }
  const tx = open[0];
  wortel.append(
    el('p', { class: 'klein' }, `Nog ${open.length} te categoriseren.`),
    el('div', { class: 'werk-kaart' },
      el('p', {}, `${formatteerDatum(tx.bookingDate)} · ` +
        `${tx.counterpartyName !== '' ? tx.counterpartyName : tx.merchant} · ` +
        `${formatteerCenten(tx.amountCents)}`),
      el('p', { class: 'klein' }, tx.description),
      suggestieVoorstel(ctx, tx, categorieen, catMap, alleTx, () => ctx.herlaad())));
}
