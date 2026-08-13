import test from 'node:test';
import assert from 'node:assert/strict';
import { grafiekSvg, waardeOpPunt } from '../js/grafiek.js';
import { overzicht } from '../js/reken.js';
import { doelBruto } from '../js/opslag.js';
import { specParams, vlakkeKoersen } from './helpers/omgeving.js';

const params = specParams();
const zicht = overzicht(params, vlakkeKoersen(2), '2026-02-15');

function polylines(svg) {
  return svg.match(/<polyline [^/]*\/>/g) ?? [];
}

test('grafiekSvg: omhulsel en afmetingen', () => {
  const svg = grafiekSvg(zicht);
  assert.ok(svg.startsWith('<svg viewBox="0 0 360 200" role="img" ' +
    'aria-label="Reserve tegenover doelpad">'));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(grafiekSvg(zicht, 640, 300).startsWith('<svg viewBox="0 0 640 300"'));
});

test('grafiekSvg: doelmarkering is een horizontale stippellijn over de volle breedte', () => {
  const lijn = grafiekSvg(zicht).match(/<line [^/]*\/>/g);
  assert.equal(lijn.length, 1);
  assert.match(lijn[0], /x1="0" y1="28\.4" x2="360" y2="28\.4"/);
  assert.match(lijn[0], /stroke="#8b93a3" stroke-width="1" stroke-dasharray="2 3"/);
  // een lager doel legt de markering lager in het beeld (grotere y)
  const laagDoel = overzicht(specParams({ doelNetto: 150000 }), vlakkeKoersen(2), '2026-02-15');
  const doelY = Number(grafiekSvg(laagDoel).match(/<line x1="0" y1="([\d.]+)"/)[1]);
  assert.ok(doelY > 28.4);
});

test('grafiekSvg: grijs doelpad start linksonder op nul', () => {
  const grijs = polylines(grafiekSvg(zicht))[0];
  assert.match(grijs, /stroke="#5a6272" stroke-width="1\.5"/);
  // pad[0] is nul, dus het eerste punt ligt op de basislijn (200 - 16 marge)
  assert.match(grijs, /points="0\.0,184\.0 /);
  assert.equal(grijs.match(/[\d.]+,[\d.]+/g).length, zicht.pad.length);
});

test('grafiekSvg: dikke gekleurde lijn en gestippelde projectie bij koersdata', () => {
  const lijnen = polylines(grafiekSvg(zicht));
  assert.equal(lijnen.length, 3);
  assert.equal(zicht.kleur, 'groen');
  assert.match(lijnen[1], /stroke="#34c77b" stroke-width="3" stroke-linecap="round"/);
  // de werkelijke reeks begint bij premie 1, niet bij 0
  assert.match(lijnen[1], /points="0\.8,/);
  assert.match(lijnen[2], /stroke="#34c77b" stroke-width="2" stroke-dasharray="5 4"/);
  // de projectie start op de dag van vandaag: premie 2 van 480
  assert.match(lijnen[2], /points="1\.5,/);
  assert.equal(lijnen[2].match(/[\d.]+,[\d.]+/g).length, zicht.projectie.length);
});

test('grafiekSvg: de lijnkleur volgt de status', () => {
  // een index die stilstaat: na kosten blijft er een negatief nettorendement over
  const rood = overzicht(specParams({ rendementBruto: 0 }), vlakkeKoersen(2), '2026-02-15');
  assert.equal(rood.kleur, 'rood');
  assert.ok(grafiekSvg(rood).includes('stroke="#f05252"'));
  const oranje = overzicht(specParams({ doelNetto: 285000 }), vlakkeKoersen(2), '2026-02-15');
  assert.equal(oranje.kleur, 'oranje');
  assert.ok(grafiekSvg(oranje).includes('stroke="#f2a33c"'));
});

test('grafiekSvg: één betaalde premie geeft geen dikke lijn, wel een projectie', () => {
  const eenPunt = overzicht(params, vlakkeKoersen(1), '2026-01-01');
  assert.equal(eenPunt.reeks.length, 1);
  const lijnen = polylines(grafiekSvg(eenPunt));
  assert.equal(lijnen.length, 2);
  assert.ok(!lijnen.some((lijn) => lijn.includes('stroke-width="3"')));
  assert.match(lijnen[1], /stroke-width="2" stroke-dasharray="5 4"/);
});

test('grafiekSvg: zonder koersdata alleen doelmarkering en doelpad', () => {
  // De overzicht-modus (bewaarde reserve, geen koersen) levert wél een doel,
  // maar geen gerealiseerde lijn en geen projectielijn in de grafiek.
  const geenKoers = overzicht(specParams({ echteReserve: 5000 }), {}, '2026-02-15');
  assert.equal(geenKoers.koersBeschikbaar, false);
  assert.ok(Math.abs(geenKoers.doel - doelBruto(params)) < 1e-9);
  const svg = grafiekSvg(geenKoers);
  assert.equal(polylines(svg).length, 1);
  assert.ok(!svg.includes('#34c77b'));
  assert.ok(!svg.includes('stroke-dasharray="5 4"'));
  assert.ok(svg.includes('stroke-dasharray="2 3"'));
});

test('grafiekSvg: een jaarlabel per tien jaar binnen de looptijd', () => {
  const labels = grafiekSvg(zicht).match(/>(\d{4})<\/text>/g);
  assert.deepEqual(labels, ['>2030</text>', '>2040</text>', '>2050</text>', '>2060</text>']);
  // een korte polis haalt geen enkel decennium en krijgt dus geen labels
  const kort = overzicht(specParams({ eindDatum: '2028-01-01' }), vlakkeKoersen(2), '2026-02-15');
  assert.equal(kort.startJaar + Math.ceil(kort.totaal / 12), 2028);
  assert.ok(!grafiekSvg(kort).includes('grafiek-label'));
});

test('waardeOpPunt: index 0 is de nulstand vóór de eerste premie', () => {
  // De werkelijke lijn wordt vanaf index 1 getekend, dus op index 0 is er nog
  // geen gerealiseerde waarde — en ook geen projectiewaarde.
  const punt = waardeOpPunt(zicht, 0);
  assert.deepEqual(punt, { index: 0, jaar: 2026, pad: 0 });
});

test('waardeOpPunt: de werkelijke lijn loopt één index achter op de reeks', () => {
  // pad[k] is de stand ná k premies; reeks[k-1] hoort daarbij.
  const eerste = waardeOpPunt(zicht, 1 / zicht.totaal);
  assert.equal(eerste.index, 1);
  assert.equal(eerste.werkelijk, zicht.reeks[0]);
  assert.equal(eerste.pad, zicht.pad[1]);
  const tweede = waardeOpPunt(zicht, 2 / zicht.totaal);
  assert.equal(tweede.index, 2);
  assert.equal(tweede.index, zicht.betaald);
  assert.equal(tweede.werkelijk, zicht.reeks[1]);
  assert.equal(tweede.werkelijk, zicht.reserve);
  assert.equal(tweede.verwacht, undefined);
});

test('waardeOpPunt: fractie 1 geeft het eindpunt met de verwachte waarde', () => {
  const punt = waardeOpPunt(zicht, 1);
  assert.equal(punt.index, 480);
  assert.equal(punt.jaar, 2066);
  assert.equal(punt.pad, zicht.pad[480]);
  assert.equal(punt.verwacht, zicht.eindwaarde);
  assert.equal(punt.werkelijk, undefined);
});

test('waardeOpPunt: fracties buiten [0,1] worden geklemd', () => {
  assert.deepEqual(waardeOpPunt(zicht, -3), waardeOpPunt(zicht, 0));
  assert.deepEqual(waardeOpPunt(zicht, 7), waardeOpPunt(zicht, 1));
});

test('waardeOpPunt: een punt na vandaag krijgt de projectiewaarde', () => {
  const punt = waardeOpPunt(zicht, 0.5);
  assert.equal(punt.index, 240);
  assert.equal(punt.jaar, 2046);
  assert.equal(punt.verwacht, zicht.projectie[240 - zicht.betaald]);
  // de eerste maand ná vandaag ligt al in de projectie
  const netErna = waardeOpPunt(zicht, (zicht.betaald + 1) / zicht.totaal);
  assert.equal(netErna.werkelijk, undefined);
  assert.equal(netErna.verwacht, zicht.projectie[1]);
});

test('waardeOpPunt: zonder koersdata alleen index, jaar en doelpad', () => {
  const geenKoers = overzicht(params, {}, '2026-02-15');
  assert.deepEqual(waardeOpPunt(geenKoers, 0.5),
    { index: 240, jaar: 2046, pad: geenKoers.pad[240] });
});

test('zonder doel in het zicht blijft de doelmarkering weg (geen NaN)', () => {
  const kaal = overzicht(specParams(), {}, '2026-02-15');
  assert.equal(kaal.doel, undefined);
  const svg = grafiekSvg(kaal);
  assert.ok(!svg.includes('NaN'));
  assert.ok(!svg.includes('<line'));
  assert.ok(svg.includes('<polyline'));
});
