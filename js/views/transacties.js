// Transactielijst met filters en drilldown (spec 9).
import { el, leeg, keuzelijst } from '../dom.js';
import { alles } from '../db.js';
import { ONGECATEGORISEERD, KLASSEN, categorieMap, effectieveKlasse } from '../categories.js';
import { formatteerCenten, formatteerDatum } from '../format.js';
import { zetEenmalig } from '../flows.js';

export function filterTransacties(transacties, f, catMap) {
  const zoek = f.tekst.toLowerCase();
  return transacties.filter((tx) => {
    if (f.van !== '' && tx.bookingDate < f.van) return false;
    if (f.tot !== '' && tx.bookingDate > f.tot) return false;
    if (f.categorie !== '' && (tx.categoryId ?? ONGECATEGORISEERD) !== f.categorie) return false;
    if (f.klasse !== '' && (tx.direction !== 'uit' || effectieveKlasse(tx, catMap) !== f.klasse)) return false;
    if (f.richting !== '' && tx.direction !== f.richting) return false;
    if (f.intern === 'verberg' && tx.isInternal) return false;
    if (f.intern === 'alleen' && !tx.isInternal) return false;
    if (f.eenmalig === 'verberg' && tx.isOneOff) return false;
    if (f.eenmalig === 'alleen' && !tx.isOneOff) return false;
    if (zoek !== '') {
      const velden = [tx.counterpartyName, tx.merchant, tx.description, tx.structuredRef, tx.freeRef];
      if (!velden.some((veld) => veld.toLowerCase().includes(zoek))) return false;
    }
    return true;
  });
}

export function transactieRij(ctx, tx, catMap) {
  const categorie = catMap.get(tx.categoryId ?? ONGECATEGORISEERD);
  const naam = tx.counterpartyName !== '' ? tx.counterpartyName
    : (tx.merchant !== '' ? tx.merchant : tx.description.slice(0, 40));
  return el('li', { class: 'transactie-rij' },
    el('div', { class: 'transactie-info', onclick: () => ctx.navigeer(`#/transactie/${tx.id}`) },
      el('span', {}, `${formatteerDatum(tx.bookingDate).slice(0, 5)} · ${naam}`),
      el('span', {},
        el('span', { class: 'chip', style: `background:${categorie.color}` }, categorie.name),
        tx.isInternal ? el('span', { class: 'label' }, 'intern') : null,
        tx.isOneOff ? el('span', { class: 'label' }, 'eenmalig') : null)),
    el('span', { class: tx.amountCents < 0 ? 'negatief' : 'positief' },
      formatteerCenten(tx.amountCents)),
    el('button', {
      class: tx.isOneOff ? 'contextactie actief' : 'contextactie',
      'aria-label': tx.isOneOff ? 'Eenmalig-markering verwijderen' : 'Markeer als eenmalig',
      onclick: () => zetEenmalig(ctx, tx, !tx.isOneOff),
    }, 'eenmalig'));
}

export async function renderTransacties(ctx, wortel, route) {
  const transacties = (await alles(ctx.db, 'transactions'))
    .sort((a, b) => (a.bookingDate < b.bookingDate ? 1 : -1));
  const categorieen = await alles(ctx.db, 'categories');
  const catMap = categorieMap(categorieen);
  const f = {
    van: route.query.van ?? '',
    tot: route.query.tot ?? '',
    categorie: route.query.categorie ?? '',
    klasse: '',
    richting: '',
    tekst: '',
    intern: 'toon',
    eenmalig: route.query.eenmalig === '1' ? 'alleen' : 'toon',
  };
  const lijst = el('ul', { class: 'transactie-lijst' });
  function toonLijst() {
    leeg(lijst);
    for (const tx of filterTransacties(transacties, f, catMap)) {
      lijst.append(transactieRij(ctx, tx, catMap));
    }
  }
  const veld = (naam, element) => el('label', { class: 'filter' }, naam, element);
  const vanInvoer = el('input', { type: 'date', value: f.van, onchange: () => { f.van = vanInvoer.value; toonLijst(); } });
  const totInvoer = el('input', { type: 'date', value: f.tot, onchange: () => { f.tot = totInvoer.value; toonLijst(); } });
  const catKeuze = keuzelijst([['', 'Alle categorieën'], ...categorieen.map((c) => [c.id, c.name])],
    f.categorie, () => { f.categorie = catKeuze.value; toonLijst(); });
  const klasseKeuze = keuzelijst([['', 'Alle klassen'], ...KLASSEN.map((k) => [k, k])],
    f.klasse, () => { f.klasse = klasseKeuze.value; toonLijst(); });
  const richtingKeuze = keuzelijst([['', 'In en uit'], ['in', 'In'], ['uit', 'Uit']],
    f.richting, () => { f.richting = richtingKeuze.value; toonLijst(); });
  const internKeuze = keuzelijst([['toon', 'Toon interne'], ['verberg', 'Verberg interne'], ['alleen', 'Alleen interne']],
    f.intern, () => { f.intern = internKeuze.value; toonLijst(); });
  const eenmaligKeuze = keuzelijst([['toon', 'Toon eenmalige'], ['verberg', 'Verberg eenmalige'], ['alleen', 'Alleen eenmalige']],
    f.eenmalig, () => { f.eenmalig = eenmaligKeuze.value; toonLijst(); });
  const tekstInvoer = el('input', {
    type: 'search', placeholder: 'Zoek in naam, handelaar en omschrijving',
    oninput: () => { f.tekst = tekstInvoer.value; toonLijst(); },
  });
  wortel.append(
    el('h1', {}, 'Transacties'),
    el('div', { class: 'filters' },
      veld('Van', vanInvoer), veld('Tot', totInvoer),
      veld('Categorie', catKeuze), veld('Klasse', klasseKeuze),
      veld('Richting', richtingKeuze), veld('Intern', internKeuze),
      veld('Eenmalig', eenmaligKeuze), tekstInvoer),
    lijst);
  toonLijst();
}
