import test from 'node:test';
import assert from 'node:assert/strict';
import { maandSleutel, aantalPremiesTotaal, aantalPremiesBetaald, maandRendement, doelpad, maandenSindsStart, recentsteKoersMaand, unitsSimulatie, projectieReeks, eindwaardeBij, vereistRendement, nettoUitGemeten, brutoUitNetto, status, overzicht } from '../js/reken.js';
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

test('eindwaardeBij is het eindpunt van de projectie bij een gegeven rendement', () => {
  const eind = eindwaardeBij(params, 1000, 0, nettoRendement(params));
  const projectie = projectieReeks(params, 1000, 0);
  assert.ok(Math.abs(eind - projectie[projectie.length - 1]) < 1e-6);
  // meer rendement geeft meer eindwaarde: de functie is monotoon stijgend
  assert.ok(eindwaardeBij(params, 1000, 0, 0.08) > eindwaardeBij(params, 1000, 0, 0.04));
  // zonder resterende premies blijft de reserve staan
  assert.equal(eindwaardeBij(params, 1234, 480, 0.05), 1234);
});

test('vereistRendement lost op welk nettorendement het doel precies haalt', () => {
  const nodig = vereistRendement(params, 0, 0);
  // invullen van het gevonden rendement geeft precies het brutodoel terug
  assert.ok(Math.abs(eindwaardeBij(params, 0, 0, nodig) - doelBruto(params)) < 0.01);
  // met dit doelpad ligt de lat lager dan de aanname: die haalt het doel ruim
  assert.ok(nodig < nettoRendement(params));
  // een hoger doel vraagt een hoger rendement
  assert.ok(vereistRendement(specParams({ doelNetto: 400000 }), 0, 0) > nodig);
  // een grotere startreserve vraagt een lager rendement
  assert.ok(vereistRendement(params, 100000, 0) < nodig);
});

test('vereistRendement geeft null als er niets meer te sturen valt', () => {
  // alle premies betaald: het rendement kan de uitkomst niet meer bijsturen
  assert.equal(vereistRendement(params, 250000, 480), null);
  // en een doel dat zelfs bij 100% per jaar onhaalbaar is
  const bijnaKlaar = specParams({ doelNetto: 5000000 });
  assert.equal(vereistRendement(bijnaKlaar, 0, 479), null);
});

test('vereistRendement geeft de ondergrens als het doel sowieso gehaald wordt', () => {
  // een doel dat al binnen is: dan is de ondergrens van de zoekruimte genoeg
  assert.equal(vereistRendement(specParams({ doelNetto: 1 }), 100000, 479), -0.9);
});

test('nettoUitGemeten trekt alleen de beheerskost van het gemeten cijfer af', () => {
  // 10% gemeten met 1,25% beheerskost: 1,10 x 0,9875 - 1 = 8,625%
  assert.ok(Math.abs(nettoUitGemeten(params, 0.10) - 0.08625) < 1e-12);
  // de TER telt hier niet mee, die zit al in de gemeten koersen
  assert.equal(nettoUitGemeten(specParams({ ter: 0.05 }), 0.10), nettoUitGemeten(params, 0.10));
  assert.ok(Math.abs(nettoUitGemeten(specParams({ beheerskost: 0 }), 0.10) - 0.10) < 1e-12);
  // en het komt overeen met wat nettoRendement doet zodra er gemeten is
  const gemeten = specParams({ gemetenRendement: 0.10, gemetenMaanden: 120 });
  assert.ok(Math.abs(nettoRendement(gemeten) - nettoUitGemeten(gemeten, 0.10)) < 1e-12);
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

test('overzicht: het vereiste rendement hoort bij de reserve van vandaag', () => {
  const zicht = overzicht(params, vlakkeKoersen(2), '2026-02-15');
  assert.ok(Math.abs(eindwaardeBij(params, zicht.reserve, zicht.betaald, zicht.vereist) -
    zicht.doel) < 0.01);
  // ook in de overzicht-modus wordt het meegegeven
  const metReserve = specParams({ echteReserve: 5000 });
  const uitOverzicht = overzicht(metReserve, {}, '2026-02-15');
  assert.ok(Math.abs(eindwaardeBij(metReserve, 5000, uitOverzicht.betaald, uitOverzicht.vereist) -
    uitOverzicht.doel) < 0.01);
  // een polis waarvan de laatste premie al betaald is, kan niets meer sturen
  const afgelopen = specParams({ eindDatum: '2026-02-01' });
  const klaar = overzicht(afgelopen, vlakkeKoersen(2), '2026-02-15');
  assert.equal(klaar.betaald, klaar.totaal);
  assert.equal(klaar.vereist, null);
});

test('overzicht: een gemeten rendement stuurt doelpad en projectie', () => {
  const aanname = specParams();
  const gemeten = specParams({ gemetenRendement: 0.12, gemetenMaanden: 120 });
  assert.ok(nettoRendement(gemeten) > nettoRendement(aanname));
  const metAanname = overzicht(aanname, vlakkeKoersen(2), '2026-02-15');
  const metGemeten = overzicht(gemeten, vlakkeKoersen(2), '2026-02-15');
  // de reserve komt uit de koersen en verandert dus niet
  assert.ok(Math.abs(metGemeten.reserve - metAanname.reserve) < 1e-9);
  // de verwachting wél: doelpad en projectie lopen hoger
  assert.ok(metGemeten.eindwaarde > metAanname.eindwaarde);
  assert.ok(metGemeten.pad[480] > metAanname.pad[480]);
  // het vereiste rendement hangt niet van de aanname af, alleen van het doel
  assert.ok(Math.abs(metGemeten.vereist - metAanname.vereist) < 1e-9);
});

test('overzicht: koersen gaan vóór de bewaarde reserve', () => {
  // Zijn er koersen, dan is de simulatie (geijkt) de bron; de bewaarde
  // reservestand blijft dan alleen een referentiepunt voor het scherm.
  const zicht = overzicht(specParams({ echteReserve: 99999 }), vlakkeKoersen(2), '2026-02-15');
  assert.equal(zicht.bron, 'koersen');
  assert.ok(zicht.reserve < 1000);
});

test('brutoUitNetto is het exacte spiegelbeeld van nettoUitGemeten', () => {
  // Het vereiste rendement is netto; wie het fonds precies dát laat halen komt
  // tekort, want de beheerskost gaat er nog af.
  const params = specParams();
  assert.ok(Math.abs(brutoUitNetto(params, 0.055) - 0.055 / (1 - params.beheerskost)
    - params.beheerskost / (1 - params.beheerskost)) < 1e-12);
  for (const netto of [-0.02, 0, 0.055, 0.12]) {
    assert.ok(Math.abs(nettoUitGemeten(params, brutoUitNetto(params, netto)) - netto) < 1e-12);
  }
  // bruto ligt altijd boven netto zolang er een beheerskost is
  assert.ok(brutoUitNetto(params, 0.055) > 0.055);
  // zonder beheerskost vallen ze samen (op zwevendekommaruis na)
  assert.ok(Math.abs(brutoUitNetto(specParams({ beheerskost: 0 }), 0.055) - 0.055) < 1e-12);
});

test('het vereiste rendement is netto: het fonds moet er méér doen', () => {
  // Regressie op de verwarring die dit veroorzaakte. Laat het fonds precies
  // het vereiste rendement halen en je komt tekort; pas met de brutoversie
  // haal je het doel.
  const params = specParams();
  const zicht = overzicht(params, vlakkeKoersen(2), '2026-02-15');
  const netto = zicht.vereist;
  const doel = doelBruto(params);
  // exact het vereiste netto rendement komt precies uit
  assert.ok(Math.abs(eindwaardeBij(params, zicht.reserve, zicht.betaald, netto) - doel) < 1);
  // maar dat cijfer als brutogroei van het fonds nemen levert te weinig op
  assert.ok(eindwaardeBij(params, zicht.reserve, zicht.betaald,
    nettoUitGemeten(params, netto)) < doel);
  // met de brutoversie klopt het weer
  assert.ok(Math.abs(eindwaardeBij(params, zicht.reserve, zicht.betaald,
    nettoUitGemeten(params, brutoUitNetto(params, netto))) - doel) < 1);
});

test('doelpad en simulatie gebruiken dezelfde kosten- én tijdsconventie', () => {
  // De kern van "rekent de prognose met dezelfde kosten als de werkelijkheid?".
  // Laat de koersen exact het gemeten brutorendement groeien; dan hoort de
  // units-simulatie op elk moment precies op het doelpad uit te komen. Wijkt
  // dat af, dan zit er een kostenpost of een maand verschil tussen de twee, en
  // meet de app "voor/achter" tegen zijn eigen ruis.
  const bruto = 0.08;
  const proef = specParams({
    startDatum: '2026-01-01',
    eindDatum: '2046-01-01',
    gemetenRendement: bruto,
    gemetenMaanden: 120,
    gebruikGemeten: true,
  });
  const koersen = {};
  for (let m = 0; m <= 240; m++) {
    const t = 2026 * 12 + m;
    koersen[`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`] =
      100 * (1 + bruto) ** (m / 12);
  }
  const pad = doelpad(proef);
  for (const vandaag of ['2027-01-01', '2031-01-01', '2036-01-01', '2044-06-01']) {
    const sim = unitsSimulatie(proef, koersen, vandaag);
    assert.ok(sim.betaald > 0);
    assert.ok(Math.abs(sim.reserve / pad[sim.betaald] - 1) < 1e-9,
      `${vandaag}: simulatie ${sim.reserve} tegen doelpad ${pad[sim.betaald]}`);
  }
  // en de projectie sluit naadloos aan op het punt waar ze vertrekt
  const sim = unitsSimulatie(proef, koersen, '2031-01-01');
  const projectie = projectieReeks(proef, sim.reserve, sim.betaald);
  assert.equal(projectie[0], sim.reserve);
  assert.ok(Math.abs(projectie[projectie.length - 1] / pad[pad.length - 1] - 1) < 1e-9);
});

test('een premie groeit pas vanaf de maand ná haar storting', () => {
  // Regressie: het doelpad rekende de premie een volle maand rendement toe in
  // haar eigen maand, de simulatie niet. Dat scheelde structureel één maand.
  const proef = specParams({ startDatum: '2026-01-01', eindDatum: '2026-04-01' });
  const pad = doelpad(proef);
  const inleg = nettoPerMaand(proef);
  const rente = maandRendement(nettoRendement(proef));
  assert.equal(pad[0], 0);
  assert.ok(Math.abs(pad[1] - inleg) < 1e-9, 'de eerste premie staat er kaal in');
  assert.ok(Math.abs(pad[2] - (inleg * (1 + rente) + inleg)) < 1e-9);
});
