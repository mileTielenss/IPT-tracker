// Kernberekening (spec 3): units-simulatie, doelpad, projectie en status.
// Deterministisch en volledig client-side; premies worden verondersteld
// altijd correct en op tijd betaald te zijn.
import { nettoPerMaand, doelBruto, nettoRendement } from './opslag.js';

// Maandsleutel ('2026-07') voor premiemaand m (0-gebaseerd) vanaf de startdatum.
export function maandSleutel(params, m) {
  const startJaar = Number(params.startDatum.slice(0, 4));
  const startMaand = Number(params.startDatum.slice(5, 7));
  const totaal = startJaar * 12 + (startMaand - 1) + m;
  return `${Math.floor(totaal / 12)}-${String((totaal % 12) + 1).padStart(2, '0')}`;
}

// Totaal aantal maandpremies: elke maand vanaf de startmaand, zolang de
// premiedatum vóór de einddatum valt.
export function aantalPremiesTotaal(params) {
  const dag = params.startDatum.slice(8, 10);
  let m = 0;
  while (`${maandSleutel(params, m)}-${dag}` < params.eindDatum) m++;
  return m;
}

export function aantalPremiesBetaald(params, vandaagIso) {
  const dag = params.startDatum.slice(8, 10);
  const totaal = aantalPremiesTotaal(params);
  let m = 0;
  while (m < totaal && `${maandSleutel(params, m)}-${dag}` <= vandaagIso) m++;
  return m;
}

export function maandRendement(jaarRendement) {
  return (1 + jaarRendement) ** (1 / 12) - 1;
}

// Doelpad: waarde na k premies bij maandelijkse inleg tegen het netto
// rendement (premie aan het begin van de maand, rente tot maandeinde).
export function doelpad(params) {
  const rente = maandRendement(nettoRendement(params));
  const inleg = nettoPerMaand(params);
  const pad = [0];
  let waarde = 0;
  for (let m = 0; m < aantalPremiesTotaal(params); m++) {
    waarde = (waarde + inleg) * (1 + rente);
    pad.push(waarde);
  }
  return pad;
}

// Aantal maanden tussen de startmaand en een maandsleutel.
export function maandenSindsStart(params, sleutel) {
  const startTotaal = Number(params.startDatum.slice(0, 4)) * 12 +
    (Number(params.startDatum.slice(5, 7)) - 1);
  return Number(sleutel.slice(0, 4)) * 12 + (Number(sleutel.slice(5, 7)) - 1) - startTotaal;
}

// De meest recente maand met een koers, niet later dan vandaag.
export function recentsteKoersMaand(koersen, vandaagIso) {
  const grens = vandaagIso.slice(0, 7);
  let beste = null;
  for (const sleutel of Object.keys(koersen)) {
    if (sleutel <= grens && (beste === null || sleutel > beste)) beste = sleutel;
  }
  return beste;
}

// Units-simulatie: koop elke betaalde maand voor het nettobedrag units tegen
// de interne NAV van die maand; NAV_intern = ETF-koers x (1-beheerskost)^jaren.
// Ontbrekende maandkoersen vallen terug op de laatst bekende koers; ontbreekt
// ook die (een gat vóór de eerste notering), dan op de eerstvolgende bekende,
// zodat een premie nooit spoorloos uit de reserve verdwijnt.
export function unitsSimulatie(params, koersen, vandaagIso) {
  const betaald = aantalPremiesBetaald(params, vandaagIso);
  const inleg = nettoPerMaand(params);
  const sleutels = Object.keys(koersen).sort();
  const eersteBekend = sleutels.length === 0 ? null : koersen[sleutels[0]];
  const reeks = [];
  let units = 0;
  let laatsteKoers = null;
  let gemist = 0;
  for (let m = 0; m < betaald; m++) {
    const koers = koersen[maandSleutel(params, m)];
    if (koers === undefined) gemist++;
    else laatsteKoers = koers;
    const gebruikt = laatsteKoers ?? eersteBekend;
    if (gebruikt === null) {
      reeks.push(0);
      continue;
    }
    const nav = gebruikt * (1 - params.beheerskost) ** (m / 12);
    units += inleg / nav;
    reeks.push(units * nav);
  }
  // Waardeer de reserve tegen de NAV van vandaag (spec 3), niet tegen die van
  // de laatste premiemaand: anders lijkt een koersbeweging na de laatste
  // premie niets te doen en bevriest de reserve zodra alles betaald is.
  const nuSleutel = recentsteKoersMaand(koersen, vandaagIso);
  if (units > 0) {
    const maanden = Math.max(0, maandenSindsStart(params, nuSleutel));
    reeks[reeks.length - 1] = units * koersen[nuSleutel] *
      (1 - params.beheerskost) ** (maanden / 12);
  }
  return {
    betaald,
    units,
    reserve: units === 0 ? 0 : reeks[reeks.length - 1],
    reeks,
    gemist,
    koersBeschikbaar: units > 0,
  };
}

// Projectie: de reserve van vandaag doorgerekend met de resterende premies
// tegen het netto rendement; geeft de waarde per resterende maand terug.
export function projectieReeks(params, startWaarde, betaald) {
  const rente = maandRendement(nettoRendement(params));
  const inleg = nettoPerMaand(params);
  const reeks = [startWaarde];
  let waarde = startWaarde;
  for (let m = betaald; m < aantalPremiesTotaal(params); m++) {
    waarde = (waarde + inleg) * (1 + rente);
    reeks.push(waarde);
  }
  return reeks;
}

// Statuslogica (spec 4): het enige dat echt telt.
export function status(eindwaarde, doel) {
  if (eindwaarde >= doel) return 'groen';
  if (eindwaarde >= 0.9 * doel) return 'oranje';
  return 'rood';
}

// Alles samen: het overzicht waar het hoofdscherm op draait.
export function overzicht(params, koersen, vandaagIso) {
  const pad = doelpad(params);
  const totaal = aantalPremiesTotaal(params);
  const sim = unitsSimulatie(params, koersen, vandaagIso);
  const basis = {
    pad,
    totaal,
    betaald: sim.betaald,
    gemist: sim.gemist,
    startJaar: Number(params.startDatum.slice(0, 4)),
  };
  // Zonder koersen kan de app nog altijd rekenen op de reservestand die de
  // gebruiker van zijn overzicht overnam; dan is er geen historische lijn.
  if (!sim.koersBeschikbaar) {
    if (params.echteReserve <= 0) return { ...basis, koersBeschikbaar: false };
    const projectieUitOverzicht = projectieReeks(params, params.echteReserve, sim.betaald);
    const eind = projectieUitOverzicht[projectieUitOverzicht.length - 1];
    const doelUitOverzicht = doelBruto(params);
    return {
      ...basis,
      koersBeschikbaar: false,
      bron: 'overzicht',
      reserve: params.echteReserve,
      reeks: [],
      projectie: projectieUitOverzicht,
      eindwaarde: eind,
      doel: doelUitOverzicht,
      deltaBruto: eind - doelUitOverzicht,
      deltaNetto: (eind - doelUitOverzicht) * (1 - params.eindtaks),
      kleur: status(eind, doelUitOverzicht),
      padVandaag: pad[sim.betaald],
      verschilVandaag: params.echteReserve - pad[sim.betaald],
      pctVsPad: pad[sim.betaald] === 0 ? 0 : params.echteReserve / pad[sim.betaald] - 1,
    };
  }
  const reserve = sim.reserve * params.ijkFactor;
  const reeks = sim.reeks.map((waarde) => waarde * params.ijkFactor);
  const projectie = projectieReeks(params, reserve, sim.betaald);
  const eindwaarde = projectie[projectie.length - 1];
  const doel = doelBruto(params);
  const padVandaag = pad[sim.betaald];
  return {
    ...basis,
    koersBeschikbaar: true,
    bron: 'koersen',
    reserve,
    reeks,
    projectie,
    eindwaarde,
    doel,
    deltaBruto: eindwaarde - doel,
    deltaNetto: (eindwaarde - doel) * (1 - params.eindtaks),
    kleur: status(eindwaarde, doel),
    padVandaag,
    verschilVandaag: reserve - padVandaag,
    // koersBeschikbaar impliceert minstens één betaalde premie, dus pad > 0
    pctVsPad: reserve / padVandaag - 1,
  };
}
