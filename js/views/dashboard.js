// Dashboard (spec 8): kerncijfers, grafiek, vaste lasten, topcategorieën,
// discretionair, eenmalig-regel en recente transacties.
import { el } from '../dom.js';
import { alles, haalInstelling } from '../db.js';
import { categorieMap, categorieNaam, KLASSEN, KLASSE_KLEUREN } from '../categories.js';
import { maandBereik, vorigeMaand, volgendeMaand, maandLabel, boekjaarBereik, boekjaarLabel, boekjaarVoorDatum, recentsteMaandMetData } from '../periods.js';
import { periodeStats, bucketsVoorMaand, bucketsVoorBoekjaar, topCategorieen, grootsteDiscretionaireCategorie, recenteTransacties } from '../stats.js';
import { gestapeldeBalken } from '../chart.js';
import { formatteerCenten, formatteerDatum, formatteerProcent, formatteerVerschil } from '../format.js';
import { importeerBestand } from './importflow.js';

function kerncijfer(titel, cents, verschil) {
  return el('div', { class: 'kerncijfer' },
    el('span', { class: 'kerncijfer-titel' }, titel),
    el('strong', {}, formatteerCenten(cents)),
    el('span', { class: 'klein' }, verschil));
}

export async function renderDashboard(ctx, wortel) {
  const transacties = await alles(ctx.db, 'transactions');
  const categorieen = await alles(ctx.db, 'categories');
  const vasteKosten = await alles(ctx.db, 'recurringCandidates');
  const startMaand = await haalInstelling(ctx.db, 'boekjaarStartMaand', 1);
  const catMap = categorieMap(categorieen);
  const stand = ctx.dashboardStand;
  if (stand.maand === null) {
    const nu = new Date();
    stand.maand = recentsteMaandMetData(transacties) ?? { jaar: nu.getFullYear(), maand: nu.getMonth() + 1 };
  }
  if (stand.boekjaar === null) {
    stand.boekjaar = boekjaarVoorDatum(
      `${stand.maand.jaar}-${String(stand.maand.maand).padStart(2, '0')}-15`, startMaand);
  }
  const isMaand = stand.modus === 'maand';
  const bereik = isMaand ? maandBereik(stand.maand.jaar, stand.maand.maand)
    : boekjaarBereik(stand.boekjaar, startMaand);
  const vorigBereik = isMaand
    ? (() => {
      const vm = vorigeMaand(stand.maand);
      return maandBereik(vm.jaar, vm.maand);
    })()
    : boekjaarBereik(stand.boekjaar - 1, startMaand);
  const stats = periodeStats(transacties, catMap, bereik);
  const vorig = periodeStats(transacties, catMap, vorigBereik);
  const vorigOf = (cents) => (vorig.heeftData ? cents : null);

  // Kopregel: upload en periodeschakelaar bereikbaar zonder scrollen (spec 11.1).
  const invoer = el('input', {
    type: 'file', accept: '.csv,text/csv', class: 'verborgen',
    onchange: () => {
      if (invoer.files.length > 0) importeerBestand(ctx, invoer.files[0]);
    },
  });
  const wissel = (modus) => {
    stand.modus = modus;
    ctx.herlaad();
  };
  const stap = (richting) => {
    if (isMaand) stand.maand = richting === -1 ? vorigeMaand(stand.maand) : volgendeMaand(stand.maand);
    else stand.boekjaar += richting;
    ctx.herlaad();
  };
  wortel.append(el('header', { class: 'dashboard-kop' },
    el('button', { class: 'primair', onclick: () => invoer.click() }, 'CSV opladen'),
    invoer,
    el('div', { class: 'periode-schakelaar' },
      el('button', { class: isMaand ? 'actief' : '', onclick: () => wissel('maand') }, 'Maand'),
      el('button', { class: isMaand ? '' : 'actief', onclick: () => wissel('boekjaar') }, 'Boekjaar')),
    el('div', { class: 'periode-navigatie' },
      el('button', { 'aria-label': 'Vorige periode', onclick: () => stap(-1) }, '‹'),
      el('strong', {}, isMaand ? maandLabel(stand.maand) : boekjaarLabel(stand.boekjaar, startMaand)),
      el('button', { 'aria-label': 'Volgende periode', onclick: () => stap(1) }, '›'))));

  // Niet-wegklikbare banner zolang er ongecategoriseerde transacties zijn (spec 8.3).
  if (stats.ongecategoriseerd > 0) {
    wortel.append(el('div', { class: 'banner ongecategoriseerd' },
      el('a', { href: '#/werklijst' },
        `${stats.ongecategoriseerd} transacties wachten op een categorie`)));
  }

  wortel.append(el('section', { class: 'kerncijfers' },
    kerncijfer('Totaal in', stats.totInCents, formatteerVerschil(stats.totInCents, vorigOf(vorig.totInCents))),
    kerncijfer('Totaal uit', stats.totUitCents, formatteerVerschil(stats.totUitCents, vorigOf(vorig.totUitCents))),
    kerncijfer('Netto', stats.nettoCents, formatteerVerschil(stats.nettoCents, vorigOf(vorig.nettoCents)))));

  const buckets = isMaand
    ? bucketsVoorMaand(transacties, catMap, stand.maand.jaar, stand.maand.maand)
    : bucketsVoorBoekjaar(transacties, catMap, stand.boekjaar, startMaand);
  const grafiek = el('div', { class: 'grafiek' });
  grafiek.innerHTML = gestapeldeBalken(buckets);
  wortel.append(el('section', {},
    el('h2', {}, 'Uitgaven per kostenklasse'),
    grafiek,
    el('div', { class: 'legende' }, KLASSEN.map((klasse) =>
      el('span', {}, el('i', { style: `background:${KLASSE_KLEUREN[klasse]}` }), ` ${klasse}`)))));

  const bevestigd = vasteKosten.filter((k) => k.status === 'bevestigd');
  wortel.append(el('section', {},
    el('h2', {}, 'Vaste lasten'),
    el('p', {}, el('strong', {}, formatteerCenten(stats.perKlasse.vast)),
      isMaand ? '' : ` · gemiddeld ${formatteerCenten(Math.round(stats.perKlasse.vast / 12))} per maand`),
    el('ul', {}, bevestigd.map((k) => el('li', {},
      `${k.naam} (${k.frequentie}) · ${formatteerCenten(k.maandbedragCents)} per maand`)))));

  const top = topCategorieen(stats, vorig);
  wortel.append(el('section', {},
    el('h2', {}, 'Top uitgavencategorieën'),
    el('ul', { class: 'klikbaar' }, top.map((rij) => el('li', {
      onclick: () => ctx.navigeer(
        `#/transacties?categorie=${encodeURIComponent(rij.categoryId)}&van=${bereik.van}&tot=${bereik.tot}`),
    },
    el('span', {}, categorieNaam(catMap, rij.categoryId)),
    el('span', {}, `${formatteerCenten(rij.cents)} · ${formatteerProcent(rij.aandeel)}`),
    el('span', { class: 'klein' }, formatteerVerschil(rij.cents, rij.vorigCents)))))));

  const grootste = grootsteDiscretionaireCategorie(stats);
  wortel.append(el('section', {},
    el('h2', {}, 'Discretionair'),
    el('p', {}, `${formatteerCenten(stats.perKlasse.discretionair)} in ` +
      `${stats.discretionairAantal} transacties`),
    grootste === null ? null : el('p', { class: 'klein' },
      `Grootste: ${categorieNaam(catMap, grootste.categoryId)} (${formatteerCenten(grootste.cents)})`)));

  // Eenmalige transacties verdwijnen nooit stilletjes (spec 7).
  if (stats.eenmaligAantal > 0) {
    wortel.append(el('button', {
      class: 'eenmalig-regel',
      onclick: () => ctx.navigeer(`#/transacties?eenmalig=1&van=${bereik.van}&tot=${bereik.tot}`),
    }, `${stats.eenmaligAantal} eenmalige transacties verborgen, samen ` +
      `${formatteerCenten(stats.eenmaligSomCents)}`));
  }

  wortel.append(el('section', {},
    el('h2', {}, 'Recente transacties'),
    el('ul', { class: 'klikbaar' }, recenteTransacties(transacties, bereik).map((tx) => el('li', {
      onclick: () => ctx.navigeer(`#/transactie/${tx.id}`),
    },
    el('span', {}, `${formatteerDatum(tx.bookingDate)} · ` +
      `${tx.counterpartyName !== '' ? tx.counterpartyName : (tx.merchant !== '' ? tx.merchant : tx.description.slice(0, 30))}`),
    el('span', { class: 'klein' }, categorieNaam(catMap, tx.categoryId)),
    el('span', { class: tx.amountCents < 0 ? 'negatief' : 'positief' },
      formatteerCenten(tx.amountCents)))))));
}
