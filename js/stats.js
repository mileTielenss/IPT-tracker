// Dashboardstatistieken per periode (spec 7 en 8).
// Interne en eenmalige transacties tellen nooit mee in totalen of grafieken.
import { ONGECATEGORISEERD, effectieveKlasse } from './categories.js';
import { inBereik, weekVanMaand, aantalWekenInMaand, maandBereik, maandenVanBoekjaar } from './periods.js';

export function telbaar(tx) {
  return !tx.isInternal && !tx.isOneOff;
}

export function periodeStats(transacties, catMap, bereik) {
  let totInCents = 0;
  let totUitCents = 0;
  const perKlasse = { vast: 0, variabel: 0, discretionair: 0 };
  const perCategorie = new Map();
  const perDiscretionaireCategorie = new Map();
  let discretionairAantal = 0;
  let eenmaligAantal = 0;
  let eenmaligSomCents = 0;
  let ongecategoriseerd = 0;
  for (const tx of transacties) {
    if (tx.isInternal || !inBereik(tx.bookingDate, bereik)) continue;
    if (tx.isOneOff) {
      eenmaligAantal++;
      eenmaligSomCents += tx.amountCents;
      continue;
    }
    if (tx.categoryId === null) ongecategoriseerd++;
    if (tx.direction === 'in') {
      totInCents += tx.amountCents;
      continue;
    }
    const bedrag = -tx.amountCents;
    totUitCents += bedrag;
    const klasse = effectieveKlasse(tx, catMap);
    perKlasse[klasse] += bedrag;
    const catId = tx.categoryId === null ? ONGECATEGORISEERD : tx.categoryId;
    perCategorie.set(catId, (perCategorie.get(catId) ?? 0) + bedrag);
    if (klasse === 'discretionair') {
      discretionairAantal++;
      perDiscretionaireCategorie.set(catId, (perDiscretionaireCategorie.get(catId) ?? 0) + bedrag);
    }
  }
  return {
    totInCents,
    totUitCents,
    nettoCents: totInCents - totUitCents,
    perKlasse,
    perCategorie,
    perDiscretionaireCategorie,
    discretionairAantal,
    eenmaligAantal,
    eenmaligSomCents,
    ongecategoriseerd,
    heeftData: totInCents !== 0 || totUitCents !== 0,
  };
}

// Uitgaven per kostenklasse per bucket voor de gestapelde balkgrafiek.
function leegBucket() {
  return { vast: 0, variabel: 0, discretionair: 0 };
}

function telUitgaveIn(bucket, tx, catMap) {
  bucket[effectieveKlasse(tx, catMap)] += -tx.amountCents;
}

export function bucketsVoorMaand(transacties, catMap, jaar, maand) {
  const bereik = maandBereik(jaar, maand);
  const buckets = Array.from({ length: aantalWekenInMaand(jaar, maand) }, leegBucket);
  for (const tx of transacties) {
    if (!telbaar(tx) || tx.direction !== 'uit' || !inBereik(tx.bookingDate, bereik)) continue;
    telUitgaveIn(buckets[weekVanMaand(tx.bookingDate)], tx, catMap);
  }
  return buckets.map((b, i) => ({ label: `W${i + 1}`, ...b }));
}

export function bucketsVoorBoekjaar(transacties, catMap, startJaar, startMaand) {
  const maanden = maandenVanBoekjaar(startJaar, startMaand);
  const buckets = maanden.map(leegBucket);
  const index = new Map(maanden.map((m, i) => [`${m.jaar}-${String(m.maand).padStart(2, '0')}`, i]));
  for (const tx of transacties) {
    if (!telbaar(tx) || tx.direction !== 'uit') continue;
    const i = index.get(tx.bookingDate.slice(0, 7));
    if (i === undefined) continue;
    telUitgaveIn(buckets[i], tx, catMap);
  }
  return buckets.map((b, i) => ({ label: `${String(maanden[i].maand).padStart(2, '0')}`, ...b }));
}

// De vijf grootste uitgavencategorieën met aandeel en verschil (spec 8.2).
export function topCategorieen(stats, vorigeStats, aantal = 5) {
  const rijen = [...stats.perCategorie.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, aantal);
  return rijen.map(([categoryId, cents]) => ({
    categoryId,
    cents,
    aandeel: cents / stats.totUitCents,
    vorigCents: vorigeStats.heeftData ? (vorigeStats.perCategorie.get(categoryId) ?? 0) : null,
  }));
}

export function grootsteDiscretionaireCategorie(stats) {
  let beste = null;
  for (const [categoryId, cents] of stats.perDiscretionaireCategorie.entries()) {
    if (beste === null || cents > beste.cents) beste = { categoryId, cents };
  }
  return beste;
}

export function recenteTransacties(transacties, bereik, aantal = 10) {
  return transacties
    .filter((tx) => telbaar(tx) && inBereik(tx.bookingDate, bereik))
    .sort((a, b) => (a.bookingDate < b.bookingDate ? 1 : -1))
    .slice(0, aantal);
}
