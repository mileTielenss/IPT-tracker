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
  assert.match(lijn[0], /x1="0" y1="34\.1" x2="360" y2="34\.1"/);
  assert.match(lijn[0], /stroke="#8b93a3" stroke-width="1" stroke-dasharray="2 3"/);
  // een lager doel legt de markering lager in het beeld (grotere y)
  const laagDoel = overzicht(specParams({ doelNetto: 150000 }), vlakkeKoersen(2), '2026-02-15');
  const doelY = Number(grafiekSvg(laagDoel).match(/<line x1="0" y1="([\d.]+)"/)[1]);
  assert.ok(doelY > 27.6);
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
  const rood = overzicht(specParams({ rendementNetto: 0 }), vlakkeKoersen(2), '2026-02-15');
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
  // overzicht() laat doel weg zonder koersen; de grafiek verwacht het wel
  const geenKoers = { ...overzicht(params, {}, '2026-02-15'), doel: doelBruto(params) };
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

test('waardeOpPunt: fractie 0 geeft het startpunt met de werkelijke waarde', () => {
  const punt = waardeOpPunt(zicht, 0);
  assert.deepEqual(punt, { index: 0, jaar: 2026, pad: 0, werkelijk: zicht.reeks[0] });
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
});

test('waardeOpPunt: een betaalde maand zonder reekswaarde valt terug op nul', () => {
  // kan alleen als de reeks korter is dan het aantal betaalde premies
  const punt = waardeOpPunt({ ...zicht, reeks: [] }, 0);
  assert.equal(punt.werkelijk, 0);
});

test('waardeOpPunt: zonder koersdata alleen index, jaar en doelpad', () => {
  const geenKoers = overzicht(params, {}, '2026-02-15');
  assert.deepEqual(waardeOpPunt(geenKoers, 0.5),
    { index: 240, jaar: 2046, pad: geenKoers.pad[240] });
});

test('zonder doel in het zicht blijft de doelmarkering weg (geen NaN)', () => {
  const zicht = overzicht(specParams(), {}, '2026-02-15');
  const svg = grafiekSvg(zicht);
  assert.ok(!svg.includes('NaN'));
  assert.ok(!svg.includes('<line'));
  assert.ok(svg.includes('<polyline'));
});
