// Opslag in localStorage: parameters, gecachte koersen en controle-datums.
// Generiek: persoonlijke cijfers (premie, doel, datums) zitten nooit in de
// code maar worden door de gebruiker ingevuld en alleen lokaal bewaard.

export const PARAMS_SLEUTEL = 'ipt-params';
export const KOERSEN_SLEUTEL = 'ipt-koersen';

// Standaardwaarden voor een Vivium Top-Hat Plus Plan met deze ETF als
// onderliggende; alles bewerkbaar via de instellingen.
export const STANDAARD_PARAMS = {
  // persoonlijk: leeg tot de gebruiker ze invult
  startDatum: '',
  eindDatum: '',
  premiePerMaand: 0,
  doelNetto: 0,
  // productstructuur (bronnen: polis, beheersreglement, justETF)
  instapkost: 0.005,
  beheerskost: 0.0125,
  ter: 0.002,
  eindtaks: 0.175,
  rendementBruto: 0.07,
  rendementNetto: 0.056,
  ticker: 'SUSW.L',
  isin: 'IE00BYX2JD69',
  internFonds: 'BE6333127940',
  proxyUrl: '',
  // ijking tegen het echte Vivium-overzicht
  ijkFactor: 1,
  ijkDatum: null,
  // laatste handmatige controle van niet-automatiseerbare gegevens
  terGecontroleerd: null,
  beheerskostGecontroleerd: null,
  eindtaksGecontroleerd: null,
};

export function laadParams(opslag) {
  const bewaard = JSON.parse(opslag.getItem(PARAMS_SLEUTEL) ?? '{}');
  return { ...STANDAARD_PARAMS, ...bewaard };
}

export function bewaarParams(opslag, params) {
  opslag.setItem(PARAMS_SLEUTEL, JSON.stringify(params));
}

// Netto belegd per maand: premie minus instapkost.
export function nettoPerMaand(params) {
  return params.premiePerMaand * (1 - params.instapkost);
}

// Doelkapitaal bruto: wat er vóór eindtaxatie moet staan om netto het doel te halen.
export function doelBruto(params) {
  return params.doelNetto / (1 - params.eindtaks);
}

// Zijn alle persoonlijke gegevens ingevuld?
export function paramsVolledig(params) {
  return params.premiePerMaand > 0 && params.doelNetto > 0 &&
    params.startDatum !== '' && params.eindDatum !== '';
}

export function laadKoersen(opslag) {
  return JSON.parse(opslag.getItem(KOERSEN_SLEUTEL) ?? '{"koersen":{},"opgehaald":null}');
}

export function bewaarKoersen(opslag, koersen, opgehaald) {
  opslag.setItem(KOERSEN_SLEUTEL, JSON.stringify({ koersen, opgehaald }));
}

// Ouder dan twaalf maanden (of nooit gecontroleerd): geel uitroepteken.
export function controleVerouderd(gecontroleerdIso, vandaagIso) {
  if (gecontroleerdIso === null) return true;
  const [jaar, maand, dag] = gecontroleerdIso.split('-').map(Number);
  const grens = `${jaar + 1}-${String(maand).padStart(2, '0')}-${String(dag).padStart(2, '0')}`;
  return vandaagIso >= grens;
}
