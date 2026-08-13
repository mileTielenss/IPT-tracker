import test from 'node:test';
import assert from 'node:assert/strict';
import { maandSleutel, aantalPremiesTotaal, aantalPremiesBetaald, maandRendement, doelpad, unitsSimulatie, projectieReeks, status, overzicht } from '../js/reken.js';
import { nettoPerMaand, doelBruto } from '../js/opslag.js';
import { specParams, vlakkeKoersen } from './helpers/omgeving.js';

const params = specParams();

test('afgeleide waarden kloppen met de spec', () => {
  assert.equal(nettoPerMaand(params).toFixed(2), '199.00');
  assert.equal(Math.round(doelBruto(params)), 303030);
});

test('maandsleutels en premietelling', () => {
  assert.equal(maandSleutel(params, 0), '2026-07');
  assert.equal(maandSleutel(params, 5), '2026-12');
  assert.equal(maandSleutel(params, 6), '2027-01');
  // laatste premie op 02/03/2065: juli 2026 t/m maart 2065 = 465 maanden
  assert.equal(aantalPremiesTotaal(params), 465);
  assert.equal(aantalPremiesBetaald(params, '2026-07-01'), 0);
  assert.equal(aantalPremiesBetaald(params, '2026-01-01'), 1);
  assert.equal(aantalPremiesBetaald(params, '2026-08-13'), 2);
  assert.equal(aantalPremiesBetaald(params, '2099-01-01'), 465);
});

test('doelpad eindigt ruim boven het brutodoel (spec: ±344.500)', () => {
  const pad = doelpad(params);
  assert.equal(pad.length, 466);
  assert.equal(pad[0], 0);
  assert.ok(pad[465] > 391000 && pad[465] < 395000);
  assert.ok(pad[465] > doelBruto(params));
  // maandrendement komt overeen met 5,6% per jaar
  assert.ok(Math.abs((1 + maandRendement(0.056)) ** 12 - 1.056) < 1e-12);
});

test('units-simulatie: vlakke koers zonder beheerskost telt gewoon de inleg op', () => {
  const zonderBeheer = specParams({ beheerskost: 0 });
  const sim = unitsSimulatie(zonderBeheer, vlakkeKoersen(2), '2026-08-13');
  assert.equal(sim.betaald, 2);
  assert.equal(sim.gemist, 0);
  assert.ok(Math.abs(sim.reserve - 2 * nettoPerMaand(zonderBeheer)) < 1e-9);
  assert.equal(sim.reeks.length, 2);
});

test('units-simulatie: beheerskost drukt de reserve, koersstijging verhoogt ze', () => {
  const metBeheer = unitsSimulatie(params, vlakkeKoersen(2), '2026-08-13');
  const zonderBeheer = unitsSimulatie(specParams({ beheerskost: 0 }), vlakkeKoersen(2), '2026-08-13');
  assert.ok(metBeheer.reserve < zonderBeheer.reserve);
  const stijging = unitsSimulatie(specParams({ beheerskost: 0 }),
    { '2026-07': 10, '2026-08': 12 }, '2026-08-13');
  assert.ok(stijging.reserve > zonderBeheer.reserve);
});

test('units-simulatie: ontbrekende maanden vallen terug op de laatst bekende koers', () => {
  const sim = unitsSimulatie(specParams({ beheerskost: 0 }), vlakkeKoersen(1), '2026-08-13');
  assert.equal(sim.gemist, 1);
  assert.ok(Math.abs(sim.reserve - 2 * nettoPerMaand(params)) < 1e-9);
  // helemaal geen koersen: geen simulatie mogelijk
  const leeg = unitsSimulatie(params, {}, '2026-08-13');
  assert.equal(leeg.koersBeschikbaar, false);
  assert.equal(leeg.reserve, 0);
  assert.equal(leeg.reeks[0], 0);
  // nog geen premies betaald
  const nogNiks = unitsSimulatie(params, vlakkeKoersen(1), '2026-07-01');
  assert.equal(nogNiks.reserve, 0);
  assert.equal(nogNiks.koersBeschikbaar, false);
});

test('projectie vanaf nul premies volgt het doelpad exact', () => {
  const pad = doelpad(params);
  const projectie = projectieReeks(params, 0, 0);
  assert.equal(projectie.length, 466);
  assert.ok(Math.abs(projectie[465] - pad[465]) < 1e-6);
  // niets meer te betalen: projectie is de huidige waarde
  assert.deepEqual(projectieReeks(params, 1234, 465), [1234]);
});

test('statuslogica op de grenzen (spec 4)', () => {
  assert.equal(status(303030, 303030), 'groen');
  assert.equal(status(360607, 303030), 'groen');
  assert.equal(status(360605, 303030), 'oranje');
  assert.equal(status(0.9 * 303030, 303030), 'oranje');
  assert.equal(status(0.9 * 303030 - 1, 303030), 'rood');
});

test('overzicht: op koers bij vlakke koersen en normale parameters', () => {
  const zicht = overzicht(params, vlakkeKoersen(2), '2026-08-13');
  assert.equal(zicht.koersBeschikbaar, true);
  assert.equal(zicht.startJaar, 2026);
  assert.equal(zicht.betaald, 2);
  assert.equal(zicht.totaal, 465);
  assert.equal(zicht.kleur, 'groen');
  assert.ok(zicht.eindwaarde > doelBruto(params));
  assert.ok(Math.abs(zicht.deltaBruto - (zicht.eindwaarde - zicht.doel)) < 1e-9);
  assert.ok(Math.abs(zicht.deltaNetto - zicht.deltaBruto * 0.825) < 1e-9);
  assert.ok(Math.abs(zicht.verschilVandaag - (zicht.reserve - zicht.padVandaag)) < 1e-9);
  // reserve loopt licht achter op het pad (pad rekent rente bij, koers bleef vlak)
  assert.ok(zicht.pctVsPad < 0);
});

test('overzicht: laag rendement wordt rood, ijkfactor herschaalt de reserve', () => {
  const somber = specParams({ rendementNetto: 0.0 });
  const zicht = overzicht(somber, vlakkeKoersen(2), '2026-08-13');
  assert.equal(zicht.kleur, 'rood');
  const geijkt = overzicht(specParams({ ijkFactor: 2 }), vlakkeKoersen(2), '2026-08-13');
  const ongeijkt = overzicht(params, vlakkeKoersen(2), '2026-08-13');
  assert.ok(Math.abs(geijkt.reserve - 2 * ongeijkt.reserve) < 1e-9);
  assert.ok(Math.abs(geijkt.reeks[1] - 2 * ongeijkt.reeks[1]) < 1e-9);
});

test('overzicht zonder koersen geeft alleen het pad terug', () => {
  const zonderKoersen = overzicht(params, {}, '2026-08-13');
  assert.equal(zonderKoersen.koersBeschikbaar, false);
  assert.equal(zonderKoersen.betaald, 2);
  assert.equal(zonderKoersen.pad.length, 466);
  assert.equal(zonderKoersen.reserve, undefined);
});
