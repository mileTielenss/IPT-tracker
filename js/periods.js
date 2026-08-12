// Periodeberekening voor maand- en boekjaarweergave.
// Alle datums zijn ISO-strings (jjjj-mm-dd); vergelijken kan lexicografisch.

export function laatsteDag(jaar, maand) {
  return new Date(Date.UTC(jaar, maand, 0)).getUTCDate();
}

function tweeCijfers(n) {
  return String(n).padStart(2, '0');
}

export function maandBereik(jaar, maand) {
  const mm = tweeCijfers(maand);
  return { van: `${jaar}-${mm}-01`, tot: `${jaar}-${mm}-${tweeCijfers(laatsteDag(jaar, maand))}` };
}

export function vorigeMaand({ jaar, maand }) {
  return maand === 1 ? { jaar: jaar - 1, maand: 12 } : { jaar, maand: maand - 1 };
}

export function volgendeMaand({ jaar, maand }) {
  return maand === 12 ? { jaar: jaar + 1, maand: 1 } : { jaar, maand: maand + 1 };
}

export function maandLabel({ jaar, maand }) {
  const namen = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
    'augustus', 'september', 'oktober', 'november', 'december'];
  return `${namen[maand - 1]} ${jaar}`;
}

// Het boekjaar dat de gegeven datum bevat; geïdentificeerd door zijn startjaar.
export function boekjaarVoorDatum(iso, startMaand) {
  const jaar = Number(iso.slice(0, 4));
  const maand = Number(iso.slice(5, 7));
  return maand >= startMaand ? jaar : jaar - 1;
}

export function boekjaarBereik(startJaar, startMaand) {
  const eind = vorigeMaand({ jaar: startJaar + 1, maand: startMaand });
  return {
    van: `${startJaar}-${tweeCijfers(startMaand)}-01`,
    tot: `${eind.jaar}-${tweeCijfers(eind.maand)}-${tweeCijfers(laatsteDag(eind.jaar, eind.maand))}`,
  };
}

export function boekjaarLabel(startJaar, startMaand) {
  return startMaand === 1 ? `Boekjaar ${startJaar}` : `Boekjaar ${startJaar}–${startJaar + 1}`;
}

export function maandenVanBoekjaar(startJaar, startMaand) {
  const maanden = [];
  let huidig = { jaar: startJaar, maand: startMaand };
  for (let i = 0; i < 12; i++) {
    maanden.push(huidig);
    huidig = volgendeMaand(huidig);
  }
  return maanden;
}

// Weekindex binnen de maand: dag 1-7 is week 0, 8-14 week 1, enzovoort.
export function weekVanMaand(iso) {
  return Math.floor((Number(iso.slice(8, 10)) - 1) / 7);
}

export function aantalWekenInMaand(jaar, maand) {
  return Math.ceil(laatsteDag(jaar, maand) / 7);
}

export function inBereik(iso, bereik) {
  return iso >= bereik.van && iso <= bereik.tot;
}

export function dagenTussen(isoA, isoB) {
  return Math.round((Date.parse(isoB) - Date.parse(isoA)) / 86400000);
}

export function recentsteMaandMetData(transacties) {
  let recentste = null;
  for (const tx of transacties) {
    if (recentste === null || tx.bookingDate > recentste) recentste = tx.bookingDate;
  }
  if (recentste === null) return null;
  return { jaar: Number(recentste.slice(0, 4)), maand: Number(recentste.slice(5, 7)) };
}
