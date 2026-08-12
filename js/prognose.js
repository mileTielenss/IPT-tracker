// Prognose voor het boekjaar op basis van echte cijfers, op dagbasis: van de
// eerste tot de laatste datum met data wordt het daggemiddelde berekend en
// doorgetrokken tot het einde van het boekjaar. Alles op kasbasis; interne en
// eenmalige transacties tellen niet mee.
import { boekjaarBereik, inBereik, dagenTussen } from './periods.js';
import { ONGECATEGORISEERD } from './categories.js';
import { telbaar } from './stats.js';

export const BELASTING_CATEGORIE = 'belastingen';

const DAGEN_PER_MAAND_MAAL_100 = 3044; // 365,25 / 12, in honderdsten

function projectie(gerealiseerdCents, dagen, resterendeDagen) {
  const verwachtCents = Math.round((gerealiseerdCents * resterendeDagen) / dagen);
  return {
    gerealiseerdCents,
    perMaandCents: Math.round((gerealiseerdCents * DAGEN_PER_MAAND_MAAL_100) / (dagen * 100)),
    verwachtCents,
    jaarCents: gerealiseerdCents + verwachtCents,
  };
}

function rijenPerCategorie(sommen, dagen, resterendeDagen) {
  return [...sommen.entries()]
    .map(([categoryId, cents]) => ({ categoryId, ...projectie(cents, dagen, resterendeDagen) }))
    .sort((a, b) => b.jaarCents - a.jaarCents);
}

export function prognoseVoorBoekjaar(transacties, startJaar, startMaand) {
  const bereik = boekjaarBereik(startJaar, startMaand);
  const relevant = transacties.filter((tx) => telbaar(tx) && inBereik(tx.bookingDate, bereik));
  if (relevant.length === 0) return { heeftData: false };
  let eersteDatum = relevant[0].bookingDate;
  let laatsteDatum = relevant[0].bookingDate;
  for (const tx of relevant) {
    if (tx.bookingDate < eersteDatum) eersteDatum = tx.bookingDate;
    if (tx.bookingDate > laatsteDatum) laatsteDatum = tx.bookingDate;
  }
  const dagen = dagenTussen(eersteDatum, laatsteDatum) + 1;
  const resterendeDagen = dagenTussen(laatsteDatum, bereik.tot);
  let omzetCents = 0;
  let kostenCents = 0;
  const omzetPerCategorie = new Map();
  const kostenPerCategorie = new Map();
  for (const tx of relevant) {
    const catId = tx.categoryId === null ? ONGECATEGORISEERD : tx.categoryId;
    if (tx.direction === 'in') {
      omzetCents += tx.amountCents;
      omzetPerCategorie.set(catId, (omzetPerCategorie.get(catId) ?? 0) + tx.amountCents);
    } else {
      kostenCents += -tx.amountCents;
      kostenPerCategorie.set(catId, (kostenPerCategorie.get(catId) ?? 0) + -tx.amountCents);
    }
  }
  const omzetTotaal = projectie(omzetCents, dagen, resterendeDagen);
  const kostenTotaal = projectie(kostenCents, dagen, resterendeDagen);
  const kosten = rijenPerCategorie(kostenPerCategorie, dagen, resterendeDagen);
  // Resultaat vóór belastingen: betalingen in de categorie Belastingen en btw
  // zijn geen kosten maar (voorschotten op) belastingen, dus die tellen niet mee.
  const belastingen = kosten.find((rij) => rij.categoryId === BELASTING_CATEGORIE) ??
    projectie(0, dagen, resterendeDagen);
  return {
    heeftData: true,
    eersteDatum,
    laatsteDatum,
    eindDatum: bereik.tot,
    dagen,
    resterendeDagen,
    omzet: rijenPerCategorie(omzetPerCategorie, dagen, resterendeDagen),
    omzetTotaal,
    kosten,
    kostenTotaal,
    belastingen,
    resultaat: {
      gerealiseerdCents: omzetTotaal.gerealiseerdCents -
        (kostenTotaal.gerealiseerdCents - belastingen.gerealiseerdCents),
      jaarCents: omzetTotaal.jaarCents - (kostenTotaal.jaarCents - belastingen.jaarCents),
    },
  };
}
