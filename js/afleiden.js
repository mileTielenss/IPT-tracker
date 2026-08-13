// Wat de app zelf kan opzoeken of afleiden, in plaats van te laten intikken.
// Bewust beperkt tot wat een betrouwbare bron heeft: contractuele
// voorwaarden (instapkost, beheerskost) en fiscale aannames staan nergens
// machineleesbaar en blijven handmatig.
import { viaProxy, parseChart } from './koersen.js';

// Volledige maandhistoriek van de ETF, zo ver als Yahoo teruggaat.
export function maxChartUrl(ticker) {
  return 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    `${encodeURIComponent(ticker)}?range=max&interval=1mo`;
}

// Fondsprofiel van Yahoo; bevat voor veel ETF's de lopende kosten (TER).
export function fondsUrl(ticker) {
  return 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' +
    `${encodeURIComponent(ticker)}?modules=fundProfile`;
}

// Yahoo geeft getallen soms kaal, soms als { raw, fmt }.
function ruweWaarde(waarde) {
  if (typeof waarde === 'number') return waarde;
  if (waarde !== null && typeof waarde === 'object' && typeof waarde.raw === 'number') {
    return waarde.raw;
  }
  return null;
}

export function parseFondsInfo(data) {
  const resultaten = data.quoteSummary?.result;
  if (!Array.isArray(resultaten) || resultaten.length === 0) return null;
  const kosten = resultaten[0].fundProfile?.feesExpensesInvestment;
  if (kosten === undefined || kosten === null) return null;
  return ruweWaarde(kosten.annualReportExpenseRatio);
}

export async function haalTer(fetchFn, params) {
  const doel = fondsUrl(params.ticker);
  const pogingen = params.proxyUrl === ''
    ? [viaProxy('', doel)]
    : [viaProxy(params.proxyUrl, doel), viaProxy('', doel)];
  for (const url of pogingen) {
    try {
      const antwoord = await fetchFn(url);
      if (!antwoord.ok) continue;
      const ter = parseFondsInfo(await antwoord.json());
      if (ter !== null) return ter;
    } catch {
      // volgende poging
    }
  }
  return null;
}

// Volledige historiek van de ETF, voor het meten van het langetermijnrendement.
export async function haalHistoriek(fetchFn, params) {
  const doel = maxChartUrl(params.ticker);
  const pogingen = params.proxyUrl === ''
    ? [viaProxy('', doel)]
    : [viaProxy(params.proxyUrl, doel), viaProxy('', doel)];
  for (const url of pogingen) {
    try {
      const antwoord = await fetchFn(url);
      if (!antwoord.ok) continue;
      return parseChart(await antwoord.json());
    } catch {
      // volgende poging
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

// Netto rendement volgt uit het bruto rendement en de beheerskost van de
// verzekeraar; de TER van de ETF zit al in de koers en telt niet nog eens mee.
export function nettoUitBruto(bruto, beheerskost) {
  return (1 + bruto) * (1 - beheerskost) - 1;
}
