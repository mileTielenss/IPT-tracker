// Wat de app zelf kan meten in plaats van te laten intikken: het werkelijke
// rendement van de ETF uit haar koershistoriek. De TER staat bewust niet in
// dit bestand — Yahoo geeft die voor Europese ETF's niet vrij, dus daarvoor
// toont de app een bronlink naar justETF. Contractuele voorwaarden
// (instapkost, beheerskost) en fiscale aannames hebben sowieso geen bron.
import { proxyKeten, parseChart } from './koersen.js';

// Volledige maandhistoriek van de ETF, zo ver als Yahoo teruggaat.
export function maxChartUrl(ticker) {
  return 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    `${encodeURIComponent(ticker)}?range=max&interval=1mo`;
}

export async function haalHistoriek(fetchFn, params) {
  for (const url of proxyKeten(params, maxChartUrl(params.ticker))) {
    try {
      const antwoord = await fetchFn(url);
      if (!antwoord.ok) continue;
      const koersen = parseChart(await antwoord.json());
      if (Object.keys(koersen).length > 0) return koersen;
    } catch {
      // volgende proxy proberen
    }
  }
  return null;
}

export function maandenTussenSleutels(vanSleutel, totSleutel) {
  const [vanJaar, vanMaand] = vanSleutel.split('-').map(Number);
  const [totJaar, totMaand] = totSleutel.split('-').map(Number);
  return (totJaar - vanJaar) * 12 + (totMaand - vanMaand);
}

// Samengesteld jaarrendement (CAGR) uit de maandkoersen. Minder dan drie
// jaar historiek zegt te weinig over een langetermijnaanname.
export const MINIMUM_MAANDEN = 36;

export function historischRendement(koersen) {
  const sleutels = Object.keys(koersen).sort();
  if (sleutels.length < 2) return null;
  const eerste = sleutels[0];
  const laatste = sleutels[sleutels.length - 1];
  const maanden = maandenTussenSleutels(eerste, laatste);
  if (maanden < MINIMUM_MAANDEN) return null;
  const begin = koersen[eerste];
  const eind = koersen[laatste];
  if (begin <= 0 || eind <= 0) return null;
  return { rendement: (eind / begin) ** (12 / maanden) - 1, maanden, van: eerste, tot: laatste };
}
