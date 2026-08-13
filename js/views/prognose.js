// Prognosescherm: verwachte omzet per categorie, kosten per categorie en
// resultaat vóór belastingen, doorgerekend uit de echte cijfers op dagbasis.
import { el } from '../dom.js';
import { alles, haalInstelling, bewaarInstelling } from '../db.js';
import { categorieMap, categorieNaam } from '../categories.js';
import { boekjaarLabel, boekjaarVoorDatum, recentsteMaandMetData } from '../periods.js';
import { prognoseVoorBoekjaar, vergelijkMetDoel, BELASTING_CATEGORIE } from '../prognose.js';
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
  // Jaardoel op dagtarief x werkdagen: verandert de prognose niet, maar
  // toont of de echte inkomsten op schema liggen.
  const dagtariefCents = await haalInstelling(ctx.db, 'dagtariefCents', 0);
  const werkdagen = await haalInstelling(ctx.db, 'werkdagenPerJaar', 0);
  const doel = dagtariefCents > 0 && werkdagen > 0
    ? vergelijkMetDoel(prognose, dagtariefCents * werkdagen)
    : null;
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

  // Jaardoel: dagtarief en werkdagen, bewaard in de instellingen.
  const tariefInvoer = el('input', {
    type: 'number', min: '0', step: '1', inputmode: 'numeric',
    value: dagtariefCents === 0 ? '' : String(dagtariefCents / 100),
  });
  const dagenInvoer = el('input', {
    type: 'number', min: '0', step: '1', inputmode: 'numeric',
    value: werkdagen === 0 ? '' : String(werkdagen),
  });
  const bewaarDoel = async () => {
    const tarief = Math.round(Number(tariefInvoer.value) * 100);
    const dagen = Math.round(Number(dagenInvoer.value));
    await ctx.bewaar(async () => {
      await bewaarInstelling(ctx.db, 'dagtariefCents', Number.isFinite(tarief) && tarief > 0 ? tarief : 0);
      await bewaarInstelling(ctx.db, 'werkdagenPerJaar', Number.isFinite(dagen) && dagen > 0 ? dagen : 0);
    });
    ctx.herlaad();
  };
  tariefInvoer.addEventListener('change', bewaarDoel);
  dagenInvoer.addEventListener('change', bewaarDoel);
  const doelSectie = el('section', {},
    el('h2', {}, 'Lig ik op schema?'),
    el('div', { class: 'verwachting-invoer' },
      el('label', { class: 'filter' }, 'Dagtarief (€)', tariefInvoer),
      el('label', { class: 'filter' }, 'Werkdagen per jaar', dagenInvoer)));
  if (doel === null) {
    doelSectie.append(el('p', { class: 'klein' },
      'Vul je dagtarief en werkdagen in om je echte inkomsten te vergelijken met je jaardoel. ' +
      'Dit verandert niets aan de prognose hierboven.'));
  } else {
    const opSchema = doel.verschilPeriodeCents >= 0;
    const jaarBoven = doel.verschilJaarCents >= 0;
    doelSectie.append(
      el('p', {}, el('strong', { class: 'tabel-cijfer' },
        `Jaardoel: ${formatteerCenten(dagtariefCents)} × ${werkdagen} dagen = ` +
        `${formatteerCenten(doel.doelJaarCents)}`)),
      el('div', { class: 'cijfer-rij' },
        el('span', {}, `Doel voor deze ${prognose.dagen} dagen`),
        el('span', { class: 'tabel-cijfer' }, formatteerCenten(doel.doelPeriodeCents))),
      el('div', { class: 'cijfer-rij' },
        el('span', {}, 'Effectief ontvangen'),
        el('span', { class: 'tabel-cijfer' },
          formatteerCenten(prognose.omzetTotaal.gerealiseerdCents))),
      el('p', { class: opSchema ? 'positief' : 'negatief' },
        opSchema
          ? `Je ligt ${formatteerCenten(doel.verschilPeriodeCents)} voor op schema.`
          : `Je loopt ${formatteerCenten(-doel.verschilPeriodeCents)} achter op schema.`),
      el('p', { class: 'klein' },
        `In dit tempo eindig je op ${formatteerCenten(prognose.omzetTotaal.jaarCents)}: ` +
        (jaarBoven
          ? `${formatteerCenten(doel.verschilJaarCents)} boven je jaardoel.`
          : `${formatteerCenten(-doel.verschilJaarCents)} onder je jaardoel.`) +
        ' Let op: bankontvangsten zijn inclusief btw, je dagtarief wellicht exclusief.'));
  }
  wortel.append(doelSectie);

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
