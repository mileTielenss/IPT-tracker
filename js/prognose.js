// Prognose voor het boekjaar op basis van echte cijfers: het maandgemiddelde
// van de verstreken maanden wordt doorgetrokken over de resterende maanden.
// Alles op kasbasis; interne en eenmalige transacties tellen niet mee.
import { boekjaarBereik, maandenVanBoekjaar, inBereik } from './periods.js';
import { ONGECATEGORISEERD } from './categories.js';
import { telbaar } from './stats.js';

export const BELASTING_CATEGORIE = 'belastingen';

function projectie(gerealiseerdCents, verstreken, resterend) {
  const perMaandCents = Math.round(gerealiseerdCents / verstreken);
  const verwachtCents = perMaandCents * resterend;
  return {
    gerealiseerdCents,
    perMaandCents,
    verwachtCents,
    jaarCents: gerealiseerdCents + verwachtCents,
  };
}

export function prognoseVoorBoekjaar(transacties, startJaar, startMaand) {
  const bereik = boekjaarBereik(startJaar, startMaand);
  const maanden = maandenVanBoekjaar(startJaar, startMaand);
  const sleutels = maanden.map((m) => `${m.jaar}-${String(m.maand).padStart(2, '0')}`);
  const relevant = transacties.filter((tx) => telbaar(tx) && inBereik(tx.bookingDate, bereik));
  if (relevant.length === 0) return { heeftData: false };
  let eersteIndex = 11;
  let laatsteIndex = 0;
  for (const tx of relevant) {
    const index = sleutels.indexOf(tx.bookingDate.slice(0, 7));
    if (index < eersteIndex) eersteIndex = index;
    if (index > laatsteIndex) laatsteIndex = index;
  }
  const verstreken = laatsteIndex - eersteIndex + 1;
  const resterend = 11 - laatsteIndex;
  let omzetCents = 0;
  let kostenCents = 0;
  const perCategorie = new Map();
  for (const tx of relevant) {
    if (tx.direction === 'in') {
      omzetCents += tx.amountCents;
      continue;
    }
    kostenCents += -tx.amountCents;
    const catId = tx.categoryId === null ? ONGECATEGORISEERD : tx.categoryId;
    perCategorie.set(catId, (perCategorie.get(catId) ?? 0) + -tx.amountCents);
  }
  const omzet = projectie(omzetCents, verstreken, resterend);
  const kostenTotaal = projectie(kostenCents, verstreken, resterend);
  const kosten = [...perCategorie.entries()]
    .map(([categoryId, cents]) => ({ categoryId, ...projectie(cents, verstreken, resterend) }))
    .sort((a, b) => b.jaarCents - a.jaarCents);
  // Resultaat vóór belastingen: betalingen in de categorie Belastingen en btw
  // zijn geen kosten maar (voorschotten op) belastingen, dus die tellen niet mee.
  const belastingen = kosten.find((rij) => rij.categoryId === BELASTING_CATEGORIE) ??
    projectie(0, verstreken, resterend);
  const resultaat = {
    gerealiseerdCents: omzet.gerealiseerdCents - (kostenTotaal.gerealiseerdCents - belastingen.gerealiseerdCents),
    jaarCents: omzet.jaarCents - (kostenTotaal.jaarCents - belastingen.jaarCents),
  };
  return {
    heeftData: true,
    eersteMaand: maanden[eersteIndex],
    laatsteMaand: maanden[laatsteIndex],
    verstreken,
    resterend,
    omzet,
    kosten,
    kostenTotaal,
    belastingen,
    resultaat,
  };
}
