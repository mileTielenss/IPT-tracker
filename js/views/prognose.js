// Prognosescherm: verwachte omzet, kosten en resultaat vóór belastingen voor
// het lopende boekjaar, doorgerekend uit de echte cijfers.
import { el } from '../dom.js';
import { alles, haalInstelling } from '../db.js';
import { categorieMap, categorieNaam } from '../categories.js';
import { boekjaarLabel, boekjaarVoorDatum, maandLabel, recentsteMaandMetData } from '../periods.js';
import { prognoseVoorBoekjaar, BELASTING_CATEGORIE } from '../prognose.js';
import { formatteerCenten } from '../format.js';

function heroKaart(klasse, titel, jaarCents, ondertitel) {
  return el('div', { class: `hero-kaart ${klasse}` },
    el('span', { class: 'hero-titel' }, titel),
    el('strong', { class: 'hero-bedrag' }, formatteerCenten(jaarCents)),
    el('span', { class: 'klein' }, ondertitel));
}

export async function renderPrognose(ctx, wortel) {
  const transacties = await alles(ctx.db, 'transactions');
  const startMaand = await haalInstelling(ctx.db, 'boekjaarStartMaand', 1);
  const catMap = categorieMap(await alles(ctx.db, 'categories'));
  const recentste = recentsteMaandMetData(transacties);
  wortel.append(el('h1', {}, 'Prognose'));
  if (recentste === null) {
    wortel.append(el('section', { class: 'leeg-melding' },
      el('p', {}, 'Nog geen cijfers om op te rekenen. Laad eerst een KBC-export op via het dashboard.')));
    return;
  }
  const startJaar = boekjaarVoorDatum(
    `${recentste.jaar}-${String(recentste.maand).padStart(2, '0')}-15`, startMaand);
  const prognose = prognoseVoorBoekjaar(transacties, startJaar, startMaand);
  wortel.append(el('p', { class: 'klein' },
    `${boekjaarLabel(startJaar, startMaand)} · gebaseerd op ${prognose.verstreken} ` +
    `${prognose.verstreken === 1 ? 'maand' : 'maanden'} echte cijfers ` +
    `(${maandLabel(prognose.eersteMaand)} – ${maandLabel(prognose.laatsteMaand)})` +
    (prognose.resterend === 0 ? '; het boekjaar is volledig.'
      : `; het maandgemiddelde wordt doorgetrokken over de ${prognose.resterend} resterende maanden.`)));

  wortel.append(el('div', { class: 'hero-rij' },
    heroKaart('omzet', 'Verwachte omzet', prognose.omzet.jaarCents,
      `${formatteerCenten(prognose.omzet.gerealiseerdCents)} al ontvangen`),
    heroKaart('kosten', 'Verwachte kosten', prognose.kostenTotaal.jaarCents,
      `${formatteerCenten(prognose.kostenTotaal.gerealiseerdCents)} al betaald`),
    heroKaart(prognose.resultaat.jaarCents < 0 ? 'resultaat negatief' : 'resultaat',
      'Resultaat vóór belastingen', prognose.resultaat.jaarCents,
      'excl. betalingen aan Belastingen en btw')));

  wortel.append(el('section', {},
    el('h2', {}, 'Omzet'),
    el('div', { class: 'cijfer-rij' },
      el('span', {}, 'Gemiddeld per maand'),
      el('span', { class: 'tabel-cijfer' }, formatteerCenten(prognose.omzet.perMaandCents))),
    el('div', { class: 'cijfer-rij' },
      el('span', {}, 'Nog te verwachten'),
      el('span', { class: 'tabel-cijfer' }, formatteerCenten(prognose.omzet.verwachtCents)))));

  const grootste = prognose.kosten.length === 0 ? 1 : prognose.kosten[0].jaarCents;
  const kostenSectie = el('section', {}, el('h2', {}, 'Verwachte kosten per categorie'));
  for (const rij of prognose.kosten) {
    const categorie = catMap.get(rij.categoryId);
    const breedte = Math.max(2, Math.round((rij.jaarCents / grootste) * 100));
    const aandeelGerealiseerd = Math.round((rij.gerealiseerdCents / rij.jaarCents) * 100);
    kostenSectie.append(el('div', { class: 'kosten-rij' },
      el('div', { class: 'kosten-kop' },
        el('span', {},
          el('i', { class: 'kleur-stip', style: `background:${categorie.color}` }),
          ` ${categorieNaam(catMap, rij.categoryId)}`),
        el('span', { class: 'tabel-cijfer' }, formatteerCenten(rij.jaarCents))),
      el('div', { class: 'kosten-balk', style: `width:${breedte}%` },
        el('span', { class: 'kosten-balk-gerealiseerd', style: `width:${aandeelGerealiseerd}%` })),
      el('span', { class: 'klein' },
        `${formatteerCenten(rij.gerealiseerdCents)} betaald + ` +
        `${formatteerCenten(rij.verwachtCents)} verwacht` +
        (rij.categoryId === BELASTING_CATEGORIE ? ' · telt niet mee in het resultaat' : ''))));
  }
  wortel.append(kostenSectie);

  wortel.append(el('section', {},
    el('h2', {}, 'Hoe wordt dit berekend?'),
    el('p', { class: 'klein' },
      'Kasbasis: alle bedragen zijn bankontvangsten en -betalingen (inclusief btw), ' +
      'zonder interne overschrijvingen en eenmalige transacties. Per categorie wordt het ' +
      'gemiddelde van de verstreken maanden doorgetrokken naar het einde van het boekjaar. ' +
      'Hoe meer maanden data, hoe betrouwbaarder de prognose.')));
}
