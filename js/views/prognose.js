// Prognosescherm: verwachte omzet per categorie, kosten per categorie en
// resultaat vóór belastingen, doorgerekend uit de echte cijfers op dagbasis.
import { el } from '../dom.js';
import { alles, haalInstelling } from '../db.js';
import { categorieMap, categorieNaam } from '../categories.js';
import { boekjaarLabel, boekjaarVoorDatum, recentsteMaandMetData } from '../periods.js';
import { prognoseVoorBoekjaar, BELASTING_CATEGORIE } from '../prognose.js';
import { formatteerCenten, formatteerDatum } from '../format.js';

function heroKaart(klasse, titel, jaarCents, ondertitel) {
  return el('div', { class: `hero-kaart ${klasse}` },
    el('span', { class: 'hero-titel' }, titel),
    el('strong', { class: 'hero-bedrag' }, formatteerCenten(jaarCents)),
    el('span', { class: 'klein' }, ondertitel));
}

// Rij per categorie met balk: hoeveel is al gerealiseerd, hoeveel verwacht.
function categorieRij(catMap, rij, grootste, balkKlasse, voetnoot) {
  const categorie = catMap.get(rij.categoryId);
  const breedte = Math.max(2, Math.round((rij.jaarCents / grootste) * 100));
  const aandeel = Math.round((rij.gerealiseerdCents / rij.jaarCents) * 100);
  return el('div', { class: 'kosten-rij' },
    el('div', { class: 'kosten-kop' },
      el('span', {},
        el('i', { class: 'kleur-stip', style: `background:${categorie.color}` }),
        ` ${categorieNaam(catMap, rij.categoryId)}`),
      el('span', { class: 'tabel-cijfer' }, formatteerCenten(rij.jaarCents))),
    el('div', { class: `kosten-balk ${balkKlasse}`.trim(), style: `width:${breedte}%` },
      el('span', { class: 'kosten-balk-gerealiseerd', style: `width:${aandeel}%` })),
    el('span', { class: 'klein' },
      `${formatteerCenten(rij.gerealiseerdCents)} gerealiseerd + ` +
      `${formatteerCenten(rij.verwachtCents)} verwacht · ` +
      `${formatteerCenten(rij.perMaandCents)}/maand${voetnoot}`));
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
    `${boekjaarLabel(startJaar, startMaand)} · cijfers van ` +
    `${formatteerDatum(prognose.eersteDatum)} tot ${formatteerDatum(prognose.laatsteDatum)} ` +
    `(${prognose.dagen} ${prognose.dagen === 1 ? 'dag' : 'dagen'})` +
    (prognose.resterendeDagen === 0 ? ' · het boekjaar is volledig.'
      : `; het daggemiddelde wordt doorgetrokken over de ${prognose.resterendeDagen} ` +
        `resterende dagen tot ${formatteerDatum(prognose.eindDatum)}.`)));

  wortel.append(el('div', { class: 'hero-rij' },
    heroKaart('omzet', 'Verwachte omzet', prognose.omzetTotaal.jaarCents,
      `${formatteerCenten(prognose.omzetTotaal.gerealiseerdCents)} al ontvangen`),
    heroKaart('kosten', 'Verwachte kosten', prognose.kostenTotaal.jaarCents,
      `${formatteerCenten(prognose.kostenTotaal.gerealiseerdCents)} al betaald`),
    heroKaart(prognose.resultaat.jaarCents < 0 ? 'resultaat negatief' : 'resultaat',
      'Resultaat vóór belastingen', prognose.resultaat.jaarCents,
      'excl. betalingen aan Belastingen en btw')));

  const grootsteOmzet = prognose.omzet.length === 0 ? 1 : prognose.omzet[0].jaarCents;
  const omzetSectie = el('section', {}, el('h2', {}, 'Verwachte omzet per categorie'));
  for (const rij of prognose.omzet) {
    omzetSectie.append(categorieRij(catMap, rij, grootsteOmzet, 'omzet', ''));
  }
  if (prognose.omzet.length === 0) {
    omzetSectie.append(el('p', { class: 'klein' }, 'Nog geen ontvangsten in dit boekjaar.'));
  }
  wortel.append(omzetSectie);

  const grootsteKost = prognose.kosten.length === 0 ? 1 : prognose.kosten[0].jaarCents;
  const kostenSectie = el('section', {}, el('h2', {}, 'Verwachte kosten per categorie'));
  for (const rij of prognose.kosten) {
    kostenSectie.append(categorieRij(catMap, rij, grootsteKost, '',
      rij.categoryId === BELASTING_CATEGORIE ? ' · telt niet mee in het resultaat' : ''));
  }
  if (prognose.kosten.length === 0) {
    kostenSectie.append(el('p', { class: 'klein' }, 'Nog geen uitgaven in dit boekjaar.'));
  }
  wortel.append(kostenSectie);

  wortel.append(el('section', {},
    el('h2', {}, 'Hoe wordt dit berekend?'),
    el('p', { class: 'klein' },
      'Kasbasis: alle bedragen zijn bankontvangsten en -betalingen (inclusief btw), ' +
      'zonder interne overschrijvingen en eenmalige transacties. Per categorie wordt het ' +
      'daggemiddelde van de periode met data doorgetrokken tot het einde van het boekjaar. ' +
      'Hoe meer dagen data, hoe betrouwbaarder de prognose.')));
}
