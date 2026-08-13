// Koersen ophalen (spec 5): Yahoo Finance chart-API via een CORS-proxy.
// Optie A: eigen doorgeefluik (Cloudflare Worker), instelbaar als proxy-URL.
// Optie B (fallback, nul setup): allorigins.win.

export const ALLORIGINS = 'https://api.allorigins.win/raw?url=';

export function chartUrl(ticker, vanIso, totIso) {
  const van = Math.floor(Date.parse(vanIso) / 1000);
  const tot = Math.floor(Date.parse(totIso) / 1000) + 86400;
  return 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    `${encodeURIComponent(ticker)}?period1=${van}&period2=${tot}&interval=1mo&events=div`;
}

export function viaProxy(proxyBasis, doelUrl) {
  const basis = proxyBasis === '' ? ALLORIGINS : proxyBasis;
  return basis + encodeURIComponent(doelUrl);
}

// Yahoo-antwoord naar maandkoersen: { '2026-07': 9.87, ... }
export function parseChart(data) {
  const resultaat = data.chart.result[0];
  const tijden = resultaat.timestamp;
  const slot = resultaat.indicators.quote[0].close;
  const koersen = {};
  for (let i = 0; i < tijden.length; i++) {
    if (slot[i] === null) continue;
    koersen[new Date(tijden[i] * 1000).toISOString().slice(0, 7)] = slot[i];
  }
  return koersen;
}

// Probeer eerst de ingestelde proxy, val terug op allorigins.
export async function haalKoersen(fetchFn, params, vanIso, totIso) {
  const doel = chartUrl(params.ticker, vanIso, totIso);
  const pogingen = params.proxyUrl === ''
    ? [viaProxy('', doel)]
    : [viaProxy(params.proxyUrl, doel), viaProxy('', doel)];
  let laatsteFout = null;
  for (const url of pogingen) {
    try {
      const antwoord = await fetchFn(url);
      if (!antwoord.ok) throw new Error(`HTTP ${antwoord.status}`);
      return parseChart(await antwoord.json());
    } catch (fout) {
      laatsteFout = fout;
    }
  }
  throw laatsteFout;
}
