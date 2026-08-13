// Gedeelde testgegevens. Bewust verzonnen ronde cijfers: de repo is publiek,
// dus er staat nergens een echte premie, een echt doelkapitaal of een echte
// polisdatum in. Een looptijd van veertig jaar met 200 euro per maand geeft
// dezelfde randgevallen als een echte polis.
import { STANDAARD_PARAMS } from '../../js/opslag.js';

export const TEST_START = '2026-01-01';
export const TEST_EINDE = '2066-01-01';

export function specParams(over = {}) {
  return {
    ...STANDAARD_PARAMS,
    startDatum: TEST_START,
    eindDatum: TEST_EINDE,
    premiePerMaand: 200,
    doelNetto: 250000,
    ...over,
  };
}

// Koersen voor de eerste n maanden vanaf de teststartmaand.
export function vlakkeKoersen(aantal, prijs = 10) {
  const koersen = {};
  const startTotaal = Number(TEST_START.slice(0, 4)) * 12 + (Number(TEST_START.slice(5, 7)) - 1);
  for (let m = 0; m < aantal; m++) {
    const totaal = startTotaal + m;
    koersen[`${Math.floor(totaal / 12)}-${String((totaal % 12) + 1).padStart(2, '0')}`] = prijs;
  }
  return koersen;
}
