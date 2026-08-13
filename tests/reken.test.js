import test from 'node:test';
import assert from 'node:assert/strict';
import { maandSleutel, aantalPremiesTotaal, aantalPremiesBetaald, maandRendement, doelpad, maandenSindsStart, recentsteKoersMaand, unitsSimulatie, projectieReeks, status, overzicht } from '../js/reken.js';
import { nettoPerMaand, nettoRendement, doelBruto } from '../js/opslag.js';
import { specParams, vlakkeKoersen } from './helpers/omgeving.js';

const params = specParams();

test('afgeleide waarden: premie min instapkost, doel bruto uit doel netto', () => {
  // 200 euro premie min 0,50% instapkost = 199,00 belegd per maand
  assert.equal(nettoPerMaand(params).toFixed(2), '199.00');
  // 250.000 netto bij 17,5% eindtaks vraagt 303.030 bruto
  assert.equal(Math.round(doelBruto(params)), 303030);
});

test('maandsleutels en premietelling', () => {
  assert.equal(maandSleutel(params, 0), '2026-01');
  assert.equal(maandSleutel(params, 11), '2026-12');
  assert.equal(maandSleutel(params, 12), '2027-01');
  // veertig jaar maandpremies, de laatste in december 2065
  assert.equal(aantalPremiesTotaal(params), 480);
  assert.equal(maandSleutel(params, 479), '2065-12');
  assert.equal(aantalPremiesBetaald(params, '2025-12-31'), 0);
  assert.equal(aantalPremiesBetaald(params, '2026-01-01'), 1);
  assert.equal(aantalPremiesBetaald(params, '2026-02-15'), 2);
  assert.equal(aantalPremiesBetaald(params, '2099-01-01'), 480);
});

test('maandenSindsStart telt vooruit én achteruit vanaf de startmaand', () => {
  assert.equal(maandenSindsStart(params, '2026-01'), 0);
  assert.equal(maandenSindsStart(params, '2026-02'), 1);
  assert.equal(maandenSindsStart(params, '2027-03'), 14);
  // een koers van vóór de start levert een negatief getal op
  assert.equal(maandenSindsStart(params, '2025-07'), -6);
});

test('recentsteKoersMaand kiest de jongste maand die niet in de toekomst ligt', () => {
  // bewust ongesorteerd ingevoerd: de functie mag niet op invoegvolgorde leunen
  const koersen = { '2026-03': 12, '2026-01': 10, '2026-02': 11, '2026-09': 20 };
  assert.equal(recentsteKoersMaand(koersen, '2026-04-15'), '2026-03');
  // een koers uit de toekomst telt niet mee
  assert.equal(recentsteKoersMaand(koersen, '2026-02-01'), '2026-02');
  // helemaal geen bruikbare maand
  assert.equal(recentsteKoersMaand(koersen, '2025-01-01'), null);
  assert.equal(recentsteKoersMaand({}, '2026-04-15'), null);
});

test('doelpad eindigt ruim boven het brutodoel', () => {
  const pad = doelpad(params);
  assert.equal(pad.length, 481);
  assert.equal(pad[0], 0);
  // 199 euro per maand, veertig jaar, 5,45% netto: ongeveer 331.700
  assert.ok(pad[480] > 330000 && pad[480] < 334000);
  assert.ok(pad[480] > doelBruto(params));
  // maandrendement komt overeen met het jaarrendement
  assert.ok(Math.abs((1 + maandRendement(0.056)) ** 12 - 1.056) < 1e-12);
  // het pad rekent met het afgeleide nettorendement, niet met het bruto
  const kosteloos = doelpad(specParams({ ter: 0, beheerskost: 0 }));
  assert.ok(kosteloos[480] > pad[480]);
  assert.ok(Math.abs(nettoRendement(specParams({ ter: 0, beheerskost: 0 })) - 0.07) < 1e-12);
});

test('units-simulatie: vlakke koers zonder beheerskost telt gewoon de inleg op', () => {
  const zonderBeheer = specParams({ beheerskost: 0 });
  const sim = unitsSimulatie(zonderBeheer, vlakkeKoersen(2), '2026-02-15');
  assert.equal(sim.betaald, 2);
  assert.equal(sim.gemist, 0);
  assert.ok(Math.abs(sim.reserve - 2 * nettoPerMaand(zonderBeheer)) < 1e-9);
  assert.equal(sim.reeks.length, 2);
  assert.equal(sim.koersBeschikbaar, true);
});

test('units-simulatie: beheerskost drukt de reserve, koersstijging verhoogt ze', () => {
  const metBeheer = unitsSimulatie(params, vlakkeKoersen(2), '2026-02-15');
  const zonderBeheer = unitsSimulatie(specParams({ beheerskost: 0 }), vlakkeKoersen(2), '2026-02-15');
  assert.ok(metBeheer.reserve < zonderBeheer.reserve);
  const stijging = unitsSimulatie(specParams({ beheerskost: 0 }),
    { '2026-01': 10, '2026-02': 12 }, '2026-02-15');
  assert.ok(stijging.reserve > zonderBeheer.reserve);
});

test('units-simulatie: de TER telt hier niet mee, die zit al in de koersen', () => {
  // Valkuil uit CLAUDE.md: wie de TER óók van de gesimuleerde NAV aftrekt,
  // telt de fondskosten dubbel. De opgehaalde slotkoersen zijn NAV's ná
  // fondskosten, dus de simulatie mag niet op de TER reageren.
  const zonder = unitsSimulatie(specParams({ ter: 0 }), vlakkeKoersen(6), '2026-06-15');
  const met = unitsSimulatie(specParams({ ter: 0.05 }), vlakkeKoersen(6), '2026-06-15');
  assert.deepEqual(met, zonder);
  // het verwachte nettorendement reageert er wél op
  assert.ok(nettoRendement(specParams({ ter: 0.05 })) < nettoRendement(specParams({ ter: 0 })));
});

test('units-simulatie: ontbrekende maanden vallen terug op de laatst bekende koers', () => {
  const sim = unitsSimulatie(specParams({ beheerskost: 0 }), vlakkeKoersen(1), '2026-02-15');
  assert.equal(sim.gemist, 1);
  assert.ok(Math.abs(sim.reserve - 2 * nettoPerMaand(params)) < 1e-9);
  // helemaal geen koersen: geen simulatie mogelijk
  const leeg = unitsSimulatie(params, {}, '2026-02-15');
  assert.equal(leeg.koersBeschikbaar, false);
  assert.equal(leeg.reserve, 0);
  assert.equal(leeg.reeks[0], 0);
  assert.equal(leeg.gemist, 2);
  // nog geen premies betaald
  const nogNiks = unitsSimulatie(params, vlakkeKoersen(1), '2025-12-31');
  assert.equal(nogNiks.reserve, 0);
  assert.equal(nogNiks.koersBeschikbaar, false);
  assert.deepEqual(nogNiks.reeks, []);
});

test('units-simulatie: een gat vóór de eerste koers laat geen premie verdwijnen', () => {
  // De historiek begint pas in de tweede premiemaand. De eerste premie mag
  // niet stilletjes uit de reserve vallen; ze koopt units tegen de
  // eerstvolgende bekende koers.
  const zonderBeheer = specParams({ beheerskost: 0 });
  const sim = unitsSimulatie(zonderBeheer, { '2026-02': 10 }, '2026-02-15');
  assert.equal(sim.betaald, 2);
  assert.equal(sim.gemist, 1);
  assert.ok(Math.abs(sim.reserve - 2 * nettoPerMaand(zonderBeheer)) < 1e-9);
  assert.equal(sim.reeks.length, 2);
  assert.equal(sim.koersBeschikbaar, true);
  // ook met een gat van meerdere maanden blijft elke betaalde premie meetellen
  const langGat = unitsSimulatie(zonderBeheer, { '2026-04': 10 }, '2026-04-15');
  assert.equal(langGat.gemist, 3);
  assert.ok(Math.abs(langGat.reserve - 4 * nettoPerMaand(zonderBeheer)) < 1e-9);
});

test('units-simulatie: een koers van vóór de startmaand wordt niet teruggerekend', () => {
  // De enige bekende koers ligt vóór de eerste premie. De herwaardering mag
  // de beheerskost dan niet negatief laten meetellen (Math.max(0, ...)).
  const oud = unitsSimulatie(specParams(), { '2025-06': 10 }, '2026-02-15');
  assert.equal(oud.gemist, 2);
  assert.equal(oud.koersBeschikbaar, true);
  // de herwaardering gebruikt nul maanden, dus de kale koers
  assert.ok(Math.abs(oud.reserve - oud.units * 10) < 1e-9);
  // zonder de klem zou (1-beheerskost)^(-7/12) de reserve juist ophogen
  const ongeklemd = oud.units * 10 * (1 - 0.0125) ** (-7 / 12);
  assert.ok(oud.reserve < ongeklemd);
  // en geen enkele premie is verdwenen
  assert.ok(oud.reserve >= 2 * nettoPerMaand(params) - 1e-9);
});

test('units-simulatie: de reserve wordt tegen de recentste koers gewaardeerd', () => {
  // Startdag 31: in februari valt de premiedatum ná vandaag, dus er is één
  // premie betaald terwijl er al een februarikoers is. Die koers hoort de
  // reserve te bepalen, niet die van de laatste premiemaand.
  const laat = specParams({ startDatum: '2026-01-31', beheerskost: 0 });
  const stil = unitsSimulatie(laat, { '2026-01': 10 }, '2026-02-15');
  const gestegen = unitsSimulatie(laat, { '2026-01': 10, '2026-02': 20 }, '2026-02-15');
  assert.equal(stil.betaald, 1);
  assert.equal(gestegen.betaald, 1);
  assert.ok(Math.abs(stil.reserve - nettoPerMaand(laat)) < 1e-9);
  // koers verdubbeld ná de laatste premie: de reserve verdubbelt mee
  assert.ok(Math.abs(gestegen.reserve - 2 * stil.reserve) < 1e-9);
  // een koers uit de toekomst telt nog niet mee
  const toekomst = unitsSimulatie(laat, { '2026-01': 10, '2026-09': 50 }, '2026-02-15');
  assert.ok(Math.abs(toekomst.reserve - stil.reserve) < 1e-9);
});

test('projectie vanaf nul premies volgt het doelpad exact', () => {
  const pad = doelpad(params);
  const projectie = projectieReeks(params, 0, 0);
  assert.equal(projectie.length, 481);
  assert.ok(Math.abs(projectie[480] - pad[480]) < 1e-6);
  // niets meer te betalen: projectie is de huidige waarde
  assert.deepEqual(projectieReeks(params, 1234, 480), [1234]);
});

test('statuslogica op de grenzen (spec 4)', () => {
  const doel = 100000;
  assert.equal(status(doel, doel), 'groen');
  assert.equal(status(doel + 1, doel), 'groen');
  assert.equal(status(doel - 1, doel), 'oranje');
  assert.equal(status(0.9 * doel, doel), 'oranje');
  assert.equal(status(0.9 * doel - 1, doel), 'rood');
});

test('overzicht: op koers bij vlakke koersen en normale parameters', () => {
  const zicht = overzicht(params, vlakkeKoersen(2), '2026-02-15');
  assert.equal(zicht.koersBeschikbaar, true);
  assert.equal(zicht.bron, 'koersen');
  assert.equal(zicht.startJaar, 2026);
  assert.equal(zicht.betaald, 2);
  assert.equal(zicht.totaal, 480);
  assert.equal(zicht.kleur, 'groen');
  assert.ok(zicht.eindwaarde > doelBruto(params));
  assert.ok(Math.abs(zicht.deltaBruto - (zicht.eindwaarde - zicht.doel)) < 1e-9);
  assert.ok(Math.abs(zicht.deltaNetto - zicht.deltaBruto * 0.825) < 1e-9);
  assert.ok(Math.abs(zicht.verschilVandaag - (zicht.reserve - zicht.padVandaag)) < 1e-9);
  // reserve loopt licht achter op het pad (pad rekent rente bij, koers bleef vlak)
  assert.ok(zicht.pctVsPad < 0);
});

test('overzicht: laag rendement wordt rood, ijkfactor herschaalt de reserve', () => {
  // Een index die stilstaat: na TER en beheerskost blijft er een negatief
  // nettorendement over, dus het doel komt niet in zicht.
  const somber = specParams({ rendementBruto: 0 });
  assert.ok(nettoRendement(somber) < 0);
  const zicht = overzicht(somber, vlakkeKoersen(2), '2026-02-15');
  assert.equal(zicht.kleur, 'rood');
  const geijkt = overzicht(specParams({ ijkFactor: 2 }), vlakkeKoersen(2), '2026-02-15');
  const ongeijkt = overzicht(params, vlakkeKoersen(2), '2026-02-15');
  assert.ok(Math.abs(geijkt.reserve - 2 * ongeijkt.reserve) < 1e-9);
  assert.ok(Math.abs(geijkt.reeks[1] - 2 * ongeijkt.reeks[1]) < 1e-9);
});

test('overzicht zonder koersen en zonder bewaarde reserve geeft alleen het pad', () => {
  const zonderKoersen = overzicht(params, {}, '2026-02-15');
  assert.equal(zonderKoersen.koersBeschikbaar, false);
  assert.equal(zonderKoersen.bron, undefined);
  assert.equal(zonderKoersen.betaald, 2);
  assert.equal(zonderKoersen.pad.length, 481);
  assert.equal(zonderKoersen.reserve, undefined);
  assert.equal(zonderKoersen.doel, undefined);
});

test('overzicht: zonder koersen rekent de bewaarde reserve van het overzicht door', () => {
  const uitOverzicht = specParams({ echteReserve: 5000, echteReserveDatum: '2026-02-01' });
  const zicht = overzicht(uitOverzicht, {}, '2026-02-15');
  assert.equal(zicht.bron, 'overzicht');
  // geen historische lijn: die kan alleen uit koersen komen
  assert.equal(zicht.koersBeschikbaar, false);
  assert.deepEqual(zicht.reeks, []);
  assert.equal(zicht.reserve, 5000);
  // er is wél een volwaardige projectie en dus een status
  assert.equal(zicht.projectie[0], 5000);
  assert.equal(zicht.projectie.length, 480 - zicht.betaald + 1);
  assert.equal(zicht.eindwaarde, zicht.projectie[zicht.projectie.length - 1]);
  assert.ok(Math.abs(zicht.doel - doelBruto(uitOverzicht)) < 1e-9);
  assert.equal(zicht.kleur, status(zicht.eindwaarde, zicht.doel));
  assert.ok(Math.abs(zicht.deltaBruto - (zicht.eindwaarde - zicht.doel)) < 1e-9);
  assert.ok(Math.abs(zicht.deltaNetto - zicht.deltaBruto * 0.825) < 1e-9);
  // een voorsprong van 5000 op een doelpad van ~400 is ruim vóór op schema
  assert.ok(Math.abs(zicht.verschilVandaag - (5000 - zicht.padVandaag)) < 1e-9);
  assert.ok(zicht.pctVsPad > 0);
  // een hogere bewaarde reserve trekt de eindwaarde mee omhoog
  const meer = overzicht(specParams({ echteReserve: 50000 }), {}, '2026-02-15');
  assert.ok(meer.eindwaarde > zicht.eindwaarde);
});

test('overzicht: bewaarde reserve vóór de eerste premie deelt niet door nul', () => {
  // pad[0] is nul; zonder de nulcontrole zou pctVsPad Infinity worden.
  const zicht = overzicht(specParams({ echteReserve: 5000 }), {}, '2025-12-31');
  assert.equal(zicht.bron, 'overzicht');
  assert.equal(zicht.betaald, 0);
  assert.equal(zicht.padVandaag, 0);
  assert.equal(zicht.pctVsPad, 0);
  assert.equal(zicht.verschilVandaag, 5000);
});

test('overzicht: koersen gaan vóór de bewaarde reserve', () => {
  // Zijn er koersen, dan is de simulatie (geijkt) de bron; de bewaarde
  // reservestand blijft dan alleen een referentiepunt voor het scherm.
  const zicht = overzicht(specParams({ echteReserve: 99999 }), vlakkeKoersen(2), '2026-02-15');
  assert.equal(zicht.bron, 'koersen');
  assert.ok(zicht.reserve < 1000);
});
