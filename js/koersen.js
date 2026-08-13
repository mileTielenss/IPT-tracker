// Koersen ophalen (spec 5): Yahoo Finance chart-API via een CORS-proxy.
// Optie A: eigen doorgeefluik (Cloudflare Worker), instelbaar als proxy-URL.
// Optie B (fallback, nul setup): allorigins.win.

// Publieke doorgeefluiken, in volgorde van betrouwbaarheid. Er is er altijd
// wel eentje plat, dus de app probeert ze na elkaar; een eigen proxy in de
// instellingen gaat voor.
export const PROXIES = [
  'https://api.cors.lol/?url=',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
];
export const ALLORIGINS = PROXIES[1];

// Eén verzoek voor alles: de volledige maandhistoriek van het fonds. Daaruit
// komen zowel de koersen van de betaalde premiemaanden (voor de simulatie)
// als het langetermijnrendement. Twee aparte verzoeken verdubbelden alleen
// maar de kans dat er eentje mislukt.
export function chartUrl(ticker) {
  return 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    `${encodeURIComponent(ticker)}?range=max&interval=1mo`;
}

export function viaProxy(proxyBasis, doelUrl) {
  const basis = proxyBasis === '' ? PROXIES[0] : proxyBasis;
  return basis + encodeURIComponent(doelUrl);
}

// Een fetch die na een aantal seconden opgeeft. Zonder tijdslimiet blijft een
// dode proxy de hele keten blokkeren en lijkt de knop niets te doen.
export const WACHTTIJD_MS = 6000;

export function metTijdslimiet(fetchFn, venster, ms = WACHTTIJD_MS) {
  return (url) => {
    if (typeof venster.AbortController !== 'function') return fetchFn(url);
    const afbreker = new venster.AbortController();
    const timer = setTimeout(() => afbreker.abort(), ms);
    return fetchFn(url, { signal: afbreker.signal }).finally(() => clearTimeout(timer));
  };
}

// Alle te proberen URL's voor één doel: eigen proxy eerst, dan de publieke.
export function proxyKeten(params, doelUrl) {
  const keten = params.proxyUrl === '' ? [] : [params.proxyUrl];
  return [...keten, ...PROXIES].map((basis) => basis + encodeURIComponent(doelUrl));
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

// Probeer de proxy's na elkaar; pas als geen enkele werkt, geef het op.
// De melder krijgt na elke poging bericht, zodat het scherm kan tonen dat er
// gewerkt wordt in plaats van dertig seconden stil te blijven staan.
export async function haalKoersen(fetchFn, params, melder = () => {}) {
  const doel = chartUrl(params.ticker);
  const keten = proxyKeten(params, doel);
  let laatsteFout = null;
  for (let i = 0; i < keten.length; i++) {
    const url = keten[i];
    melder(i + 1, keten.length);
    try {
      const antwoord = await fetchFn(url);
      if (!antwoord.ok) throw new Error(`HTTP ${antwoord.status}`);
      const koersen = parseChart(await antwoord.json());
      if (Object.keys(koersen).length === 0) throw new Error('leeg antwoord');
      return koersen;
    } catch (fout) {
      laatsteFout = fout;
    }
  }
  throw laatsteFout;
}
