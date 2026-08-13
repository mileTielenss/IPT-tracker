// Gedeelde testgegevens: een volledig ingevulde parameterset (de cijfers uit
// de spec) en een handige koersenbouwer.
import { STANDAARD_PARAMS } from '../../js/opslag.js';

export function specParams(over = {}) {
  return {
    ...STANDAARD_PARAMS,
    startDatum: '2026-01-01',
    eindDatum: '2066-01-01',
    premiePerMaand: 200,
    doelNetto: 250000,
    ...over,
  };
}

// Koersen voor de eerste n maanden vanaf juli 2026.
export function vlakkeKoersen(aantal, prijs = 10) {
  const koersen = {};
  for (let m = 0; m < aantal; m++) {
    const totaal = 2026 * 12 + 6 + m;
    koersen[`${Math.floor(totaal / 12)}-${String((totaal % 12) + 1).padStart(2, '0')}`] = prijs;
  }
  return koersen;
}
