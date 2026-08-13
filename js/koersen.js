// Koersen ophalen (spec 5). Twee bronnen, in deze volgorde.
//
// 1. `data/koersen.json` op onze eigen origin. Dat bestand wordt bij elke
//    publicatie en elke maand door een GitHub Action gevuld. Die draait op een
//    server, en een server kent geen same-origin-policy: daar antwoordt Yahoo
//    gewoon. Voor de browser is het resultaat een doodgewoon bestand naast
//    index.html — geen CORS, geen doorgeefluik, geen gratis dienst die plat
//    kan liggen. Dit is het normale pad.
// 2. Yahoo rechtstreeks via een CORS-doorgeefluik. Alleen nog nodig als je een
//    andere ticker volgt dan het gepubliceerde bestand, of tussen twee
//    publicaties door wil verversen. Dit was vroeger het enige pad, en dat is
//    precies waarom de knop het zo vaak liet afweten.

// Het maandbestand naast index.html; relatief, zodat het ook onder een subpad
// van GitHub Pages klopt.
export const LOKAAL_PAD = './data/koersen.json';

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

// Alle te proberen proxy-URL's voor één doel: eigen proxy eerst, dan de publieke.
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

// Het maandbestand lezen. De ticker moet kloppen: wie in de instellingen een
// ander fonds kiest dan het gepubliceerde bestand, moet doorvallen naar de
// proxy's in plaats van stilzwijgend de koersen van een vreemd fonds te zien.
export function leesBestand(data, ticker) {
  if (data.ticker !== ticker) {
    throw new Error(`bestand bevat ${data.ticker}, niet ${ticker}`);
  }
  return data.koersen ?? {};
}

// De bronnen op volgorde van voorkeur, elk met de lezer die bij zijn vorm
// hoort. Het eigen bestand staat vooraan; de doorgeefluiken zijn het vangnet.
export function bronnen(params) {
  const doel = chartUrl(params.ticker);
  const proxies = params.proxyUrl === '' ? PROXIES : [params.proxyUrl, ...PROXIES];
  return [
    {
      naam: 'het maandbestand van de app',
      url: LOKAAL_PAD,
      lees: (data) => leesBestand(data, params.ticker),
    },
    ...proxies.map((basis, i) => ({
      naam: i === 0 && params.proxyUrl !== '' ? 'je eigen doorgeefluik' : 'een publiek doorgeefluik',
      url: basis + encodeURIComponent(doel),
      lees: parseChart,
    })),
  ];
}

// Probeer de bronnen na elkaar; pas als geen enkele werkt, geef het op.
// De melder krijgt bij elke poging bericht, zodat het scherm kan tonen dat er
// gewerkt wordt in plaats van dertig seconden stil te blijven staan.
export async function haalKoersen(fetchFn, params, melder = () => {}) {
  const lijst = bronnen(params);
  let laatsteFout = null;
  for (let i = 0; i < lijst.length; i++) {
    const bron = lijst[i];
    melder(i + 1, lijst.length, bron.naam);
    try {
      const antwoord = await fetchFn(bron.url);
      if (!antwoord.ok) throw new Error(`HTTP ${antwoord.status}`);
      const koersen = bron.lees(await antwoord.json());
      if (Object.keys(koersen).length === 0) throw new Error('leeg antwoord');
      return koersen;
    } catch (fout) {
      laatsteFout = fout;
    }
  }
  throw laatsteFout;
}
