// Kernberekening (spec 3): units-simulatie, doelpad, projectie en status.
// Deterministisch en volledig client-side; premies worden verondersteld
// altijd correct en op tijd betaald te zijn.
import { nettoPerMaand, doelBruto } from './opslag.js';

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
  const rente = maandRendement(params.rendementNetto);
  const inleg = nettoPerMaand(params);
  const pad = [0];
  let waarde = 0;
  for (let m = 0; m < aantalPremiesTotaal(params); m++) {
    waarde = (waarde + inleg) * (1 + rente);
    pad.push(waarde);
  }
  return pad;
}

// Units-simulatie: koop elke betaalde maand voor het nettobedrag units tegen
// de interne NAV van die maand; NAV_intern = ETF-koers x (1-beheerskost)^jaren.
// Ontbrekende maandkoersen vallen terug op de laatst bekende koers.
export function unitsSimulatie(params, koersen, vandaagIso) {
  const betaald = aantalPremiesBetaald(params, vandaagIso);
  const inleg = nettoPerMaand(params);
  const reeks = [];
  let units = 0;
  let laatsteKoers = null;
  let gemist = 0;
  for (let m = 0; m < betaald; m++) {
    const koers = koersen[maandSleutel(params, m)];
    if (koers === undefined) gemist++;
    else laatsteKoers = koers;
    if (laatsteKoers === null) {
      reeks.push(0);
      continue;
    }
    const nav = laatsteKoers * (1 - params.beheerskost) ** (m / 12);
    units += inleg / nav;
    reeks.push(units * nav);
  }
  return {
    betaald,
    units,
    reserve: reeks.length === 0 ? 0 : reeks[reeks.length - 1],
    reeks,
    gemist,
    koersBeschikbaar: laatsteKoers !== null,
  };
}

// Projectie: de reserve van vandaag doorgerekend met de resterende premies
// tegen het netto rendement; geeft de waarde per resterende maand terug.
export function projectieReeks(params, startWaarde, betaald) {
  const rente = maandRendement(params.rendementNetto);
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
  if (!sim.koersBeschikbaar) return { ...basis, koersBeschikbaar: false };
  const reserve = sim.reserve * params.ijkFactor;
  const reeks = sim.reeks.map((waarde) => waarde * params.ijkFactor);
  const projectie = projectieReeks(params, reserve, sim.betaald);
  const eindwaarde = projectie[projectie.length - 1];
  const doel = doelBruto(params);
  const padVandaag = pad[sim.betaald];
  return {
    ...basis,
    koersBeschikbaar: true,
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
