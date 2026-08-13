import test from 'node:test';
import assert from 'node:assert/strict';
import { grafiekSvg, waardeOpPunt, asVerdeling, kortBedrag, dun, jaarLabels, legendeHtml, tabelRijen, VLAK } from '../js/grafiek.js';
import { overzicht } from '../js/reken.js';
import { doelBruto } from '../js/opslag.js';
import { specParams, vlakkeKoersen } from './helpers/omgeving.js';

const params = specParams();
const zicht = overzicht(params, vlakkeKoersen(2), '2026-02-15');

function polylines(svg) {
  return svg.match(/<polyline [^/]*\/>/g) ?? [];
}

function lijnen(svg) {
  return svg.match(/<line [^/]*\/>/g) ?? [];
}

test('asVerdeling kiest een mooie stap met vier of vijf ticks', () => {
  // De stap komt altijd uit {1, 2, 2,5, 5} × een macht van tien, en de
  // bovengrens ligt nooit onder de gevraagde waarde.
  for (const ruw of [1, 7, 42, 990, 1001, 12345, 287654, 3.7e6, 0.004]) {
    const as = asVerdeling(ruw);
    assert.ok(as.ticks === 4 || as.ticks === 5, `${ruw}: ${as.ticks} ticks`);
    assert.ok(as.top >= ruw, `${ruw}: top ${as.top}`);
    const factor = as.stap / 10 ** Math.floor(Math.log10(as.stap));
    assert.ok([1, 2, 2.5, 5].some((m) => Math.abs(m - factor) < 1e-9), `${ruw}: factor ${factor}`);
    // en de bovengrens blijft krap: nooit meer dan de helft eroverheen
    assert.ok(as.top < ruw * 1.5, `${ruw}: top ${as.top} te ruim`);
  }
  // van de twee kandidaten wint de krapste bovengrens
  assert.deepEqual(asVerdeling(1000), { stap: 250, ticks: 4, top: 1000 });
  // een lege of onmogelijke grens loopt niet vast op log10(0)
  assert.equal(asVerdeling(0).top > 0, true);
});

test('kortBedrag houdt as-labels kort en in nl-BE-notatie', () => {
  assert.equal(kortBedrag(0), '0');
  assert.equal(kortBedrag(7500), '7,5k');
  assert.equal(kortBedrag(50000), '50k');
  assert.equal(kortBedrag(640000), '640k');
  assert.equal(kortBedrag(1200000), '1,2 mln');
  assert.equal(kortBedrag(2000000), '2 mln');
});

test('dun houdt elk n-de punt plus altijd het laatste', () => {
  assert.deepEqual(dun([0, 1, 2, 3], 3), [[0, 0], [3, 3]]);
  // het laatste punt zit er al in en wordt niet verdubbeld
  assert.deepEqual(dun([0, 1, 2, 3, 4, 5, 6], 3), [[0, 0], [3, 3], [6, 6]]);
  assert.deepEqual(dun([9], 3), [[0, 9]]);
  // een lege reeks levert geen kapotte coördinaat op
  assert.deepEqual(dun([], 3), [[-1, undefined]]);
});

test('jaarLabels laat een decennium weg dat tegen start of einde plakt', () => {
  // 2017–2065 op 276 px: 2020 en 2060 liggen te dicht bij het start- en eindlabel.
  const xVan = (jaar) => VLAK.x0 + ((jaar - 2017) * 12 / 576) * (VLAK.x1 - VLAK.x0);
  const labels = jaarLabels(2017, 2065, xVan).map((l) => l.jaar);
  assert.deepEqual(labels, [2017, 2030, 2040, 2050, 2065]);
  // start en einde staan er altijd, en met het juiste anker
  const rand = jaarLabels(2017, 2065, xVan);
  assert.equal(rand[0].anker, 'start');
  assert.equal(rand[rand.length - 1].anker, 'end');
  assert.equal(rand[1].anker, 'middle');
  // een korte polis houdt alleen start en einde over
  assert.deepEqual(jaarLabels(2026, 2028, () => 200).map((l) => l.jaar), [2026, 2028]);
});

test('grafiekSvg: omhulsel, titel en beschrijving', () => {
  const svg = grafiekSvg(zicht);
  assert.ok(svg.startsWith('<svg viewBox="0 0 336 220" width="100%" role="img" ' +
    'aria-labelledby="g-titel g-uitleg" focusable="false">'));
  assert.ok(svg.endsWith('</svg>'));
  assert.match(svg, /<title id="g-titel">Opbouw tegenover doelpad, 2026–2066<\/title>/);
  // de beschrijving noemt de vier cijfers die de grafiek toont
  assert.match(svg, /<desc id="g-uitleg">Vandaag €\s.*doelpad €\s.*verwacht €\s.*doel van €/);
  assert.ok(!svg.includes('NaN'));
});

test('grafiekSvg: y-as met gridlijnen, bedragen en één euroteken', () => {
  const svg = grafiekSvg(zicht);
  const as = asVerdeling(Math.max(zicht.pad[zicht.totaal], zicht.doel, zicht.eindwaarde) * 1.06);
  // nullabel plus één label per tick
  const bedragen = [...svg.matchAll(/<text x="46" y="[\d.]+" dy="\.32em" text-anchor="end">([^<]+)</g)]
    .map((m) => m[1]);
  assert.equal(bedragen.length, as.ticks + 1);
  assert.equal(bedragen[0], '0');
  // alleen de bovenste tick draagt het euroteken
  assert.equal(bedragen.filter((b) => b.startsWith('€')).length, 1);
  assert.ok(bedragen[bedragen.length - 1].startsWith('€'));
  // de basislijn ligt op y 192 en is net iets sterker dan het raster
  assert.ok(svg.includes('<line x1="52" y1="192" x2="328" y2="192" stroke="#39424f" stroke-width="1"/>'));
});

test('grafiekSvg: x-as toont start, decennia en eindjaar', () => {
  const jaren = [...grafiekSvg(zicht).matchAll(/y="208"[^>]*>(\d{4})</g)].map((m) => Number(m[1]));
  assert.deepEqual(jaren, [2026, 2040, 2050, 2060, 2066]);
  // 2030 ligt te dicht bij het startlabel en verliest dus zijn label
  assert.ok(!jaren.includes(2030));
});

test('grafiekSvg: doellijn met chip, en de chip wijkt bij een hoge lijn', () => {
  const svg = grafiekSvg(zicht);
  const doelLijn = lijnen(svg).find((l) => l.includes('stroke-dasharray="6 4"'));
  assert.match(doelLijn, /x1="52" y1="[\d.]+" x2="328"/);
  assert.match(svg, /<text x="326" y="[\d.]+" text-anchor="end"[^>]*paint-order="stroke">doel [^<]+</);
  // een lager doel legt de lijn lager in beeld (grotere y)
  const hoogY = Number(/stroke-dasharray="6 4"/.exec(svg) && doelLijn.match(/y1="([\d.]+)"/)[1]);
  const laag = overzicht(specParams({ doelNetto: 150000 }), vlakkeKoersen(2), '2026-02-15');
  const laagLijn = lijnen(grafiekSvg(laag)).find((l) => l.includes('stroke-dasharray="6 4"'));
  assert.ok(Number(laagLijn.match(/y1="([\d.]+)"/)[1]) > hoogY);
});

test('grafiekSvg: doelpad grijs en uitgedund, werkelijke lijn dik en volledig', () => {
  const svg = grafiekSvg(zicht);
  const grijs = polylines(svg).find((l) => l.includes('#7a8698'));
  assert.match(grijs, /stroke-width="2" stroke-linejoin="round"/);
  // pad[0] is nul: het eerste punt ligt op de basislijn, links in de plot
  assert.match(grijs, /points="52\.0,192\.0 /);
  // uitgedund naar elk derde punt plus het laatste
  assert.equal(grijs.match(/[\d.]+,[\d.]+/g).length, dun(zicht.pad, 3).length);
  const dik = polylines(svg).find((l) => l.includes('stroke-width="3"'));
  assert.equal(zicht.kleur, 'groen');
  assert.match(dik, /stroke="#3ed8a0" stroke-width="3" stroke-linecap="round"/);
  // de werkelijke reeks begint bij premie 1, niet bij 0, en blijft maandelijks
  assert.equal(dik.match(/[\d.]+,[\d.]+/g).length, zicht.reeks.length);
});

test('grafiekSvg: projectie gestippeld, met vlak, nu-punt en eindpunt', () => {
  const svg = grafiekSvg(zicht);
  const projectie = polylines(svg).find((l) => l.includes('stroke-dasharray="6 5"'));
  assert.match(projectie, /stroke="#3ed8a0" stroke-width="2"/);
  assert.equal(projectie.match(/[\d.]+,[\d.]+/g).length, dun(zicht.projectie, 3).length);
  // het vlak tussen doelpad en werkelijke lijn is een gesloten pad
  assert.match(svg, /<path d="M[^"]+Z" fill="#3ed8a0" fill-opacity="\.14"\/>/);
  // twee cirkels: het punt van vandaag en het eindpunt van de projectie
  const cirkels = svg.match(/<circle [^/]*\/>/g);
  assert.equal(cirkels.length, 2);
  assert.ok(cirkels.some((c) => c.includes('r="4.5"')));
  assert.ok(cirkels.some((c) => c.includes(`cx="${VLAK.x1}"`) && c.includes('r="3.5"')));
  // en een verschilstaafje van minstens 6 px op de vandaag-lijn
  const staaf = lijnen(svg).find((l) => l.includes('stroke-width="3" stroke-linecap="round"'));
  const [y1, y2] = [...staaf.matchAll(/y[12]="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(Math.abs(y2 - y1) >= 6);
  // en het staafje blijft binnen het plotvlak, ook vlak boven de nullijn
  assert.ok(Math.min(y1, y2) >= VLAK.y0 && Math.max(y1, y2) <= VLAK.y1);
});

test('grafiekSvg: de lijnkleur volgt de status', () => {
  // een index die stilstaat: na kosten blijft er een negatief nettorendement over
  const rood = overzicht(specParams({ rendementBruto: 0 }), vlakkeKoersen(2), '2026-02-15');
  assert.equal(rood.kleur, 'rood');
  assert.ok(grafiekSvg(rood).includes('stroke="#ff5f6b"'));
  const oranje = overzicht(specParams({ doelNetto: 285000 }), vlakkeKoersen(2), '2026-02-15');
  assert.equal(oranje.kleur, 'oranje');
  assert.ok(grafiekSvg(oranje).includes('stroke="#ffb020"'));
});

test('grafiekSvg: één betaalde premie geeft geen dikke lijn, wel een projectie', () => {
  const eenPunt = overzicht(params, vlakkeKoersen(1), '2026-01-01');
  assert.equal(eenPunt.reeks.length, 1);
  const svg = grafiekSvg(eenPunt);
  assert.ok(!polylines(svg).some((lijn) => lijn.includes('stroke-width="3"')));
  assert.ok(!svg.includes('<path d='));
  assert.ok(polylines(svg).some((lijn) => lijn.includes('stroke-dasharray="6 5"')));
});

test('grafiekSvg: met een bewaarde reserve maar zonder koersen is er toch een lijn', () => {
  // De overzicht-modus levert een doel en een projectie, maar geen gemeten
  // historiek. Die grafiek verbergen zou informatie kosten zonder iets op te lossen.
  const geenKoers = overzicht(specParams({ echteReserve: 5000 }), {}, '2026-02-15');
  assert.equal(geenKoers.koersBeschikbaar, false);
  assert.ok(Math.abs(geenKoers.doel - doelBruto(params)) < 1e-9);
  const svg = grafiekSvg(geenKoers);
  assert.ok(svg.includes('stroke-dasharray="6 5"'));
  assert.ok(!svg.includes('stroke-width="3" stroke-linecap="round"/>\n') );
  assert.ok(!svg.includes('<path d='));
  assert.ok(!svg.includes('NaN'));
});

test('grafiekSvg: het nu-bijschrift springt naar links als vandaag rechts ligt', () => {
  assert.match(grafiekSvg(zicht), /text-anchor="start">[^]*?>nu</);
  // een polis die bijna afgelopen is: vandaag ligt voorbij driekwart
  const laat = overzicht(specParams({ startDatum: '1990-01-01', eindDatum: '2027-01-01' }),
    vlakkeKoersen(2), '2026-02-15');
  assert.match(grafiekSvg(laat), /text-anchor="end">[^]*?>nu</);
});

test('grafiekSvg: zonder enige data blijft het raster staan en verschijnt geen lijn', () => {
  const kaal = overzicht(specParams(), {}, '2026-02-15');
  assert.equal(kaal.doel, undefined);
  const svg = grafiekSvg(kaal);
  assert.ok(!svg.includes('NaN'));
  assert.ok(!svg.includes('stroke-dasharray="6 5"'));
  assert.ok(!svg.includes('<circle'));
  assert.ok(!svg.includes('doel '));
  assert.match(svg, /<desc id="g-uitleg">Alleen het doelpad;/);
  assert.ok(svg.includes('<polyline'));
});

test('grafiekSvg: een tap tekent een lijn met ringen op beide reeksen', () => {
  const tap = waardeOpPunt(zicht, 0.5);
  const svg = grafiekSvg(zicht, tap);
  assert.match(svg, /stroke="#f2f5fa" stroke-opacity="\.55"/);
  // twee extra cirkels bovenop de vaste twee: doelpad en projectie
  assert.equal((svg.match(/<circle /g) ?? []).length, 4);
  // op index 0 is er geen tweede reeks, dus maar één extra ring
  const begin = grafiekSvg(zicht, waardeOpPunt(zicht, 0));
  assert.equal((begin.match(/<circle /g) ?? []).length, 3);
});

test('legendeHtml noemt precies de getekende reeksen', () => {
  const legende = legendeHtml(zicht);
  assert.ok(legende.includes('jouw opbouw'));
  assert.ok(legende.includes('projectie'));
  assert.ok(legende.includes('doelpad'));
  assert.match(legende, /doel \d/);
  // zonder koersen maar met een bewaarde reserve wordt het eerste item een punt
  const uitOverzicht = legendeHtml(overzicht(specParams({ echteReserve: 5000 }), {}, '2026-02-15'));
  assert.ok(uitOverzicht.includes('jouw overzicht'));
  assert.ok(uitOverzicht.includes('<circle'));
  assert.ok(!uitOverzicht.includes('jouw opbouw'));
  // en zonder enige data blijft alleen het doelpad over
  const kaal = legendeHtml(overzicht(specParams(), {}, '2026-02-15'));
  assert.ok(kaal.includes('doelpad'));
  assert.ok(!kaal.includes('projectie'));
  assert.ok(!kaal.includes('doel '));
});

test('tabelRijen geeft de grafiek in cijfers, per tien jaar plus het einde', () => {
  const rijen = tabelRijen(zicht);
  assert.deepEqual(rijen.map((r) => r.jaar), [2026, 2036, 2046, 2056, 2066]);
  assert.equal(rijen[0].index, 0);
  assert.equal(rijen[rijen.length - 1].index, zicht.totaal);
  assert.equal(rijen[rijen.length - 1].verwacht, zicht.eindwaarde);
  // een looptijd die precies op een tienvoud eindigt telt het einde niet dubbel
  const rond = overzicht(specParams({ eindDatum: '2046-01-01' }), vlakkeKoersen(2), '2026-02-15');
  assert.equal(rond.totaal, 240);
  assert.deepEqual(tabelRijen(rond).map((r) => r.index), [0, 120, 240]);
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

test('waardeOpPunt: zonder projectie alleen index, jaar en doelpad', () => {
  const geenData = overzicht(params, {}, '2026-02-15');
  assert.deepEqual(waardeOpPunt(geenData, 0.5),
    { index: 240, jaar: 2046, pad: geenData.pad[240] });
  // met een bewaarde reserve is er wél een projectie maar geen historische
  // lijn: een punt vóór vandaag geeft dan alleen het doelpad
  const uitOverzicht = overzicht(specParams({ echteReserve: 5000 }), {}, '2026-02-15');
  const vroeg = waardeOpPunt(uitOverzicht, 1 / uitOverzicht.totaal);
  assert.equal(vroeg.werkelijk, undefined);
  assert.equal(vroeg.verwacht, undefined);
  assert.equal(vroeg.pad, uitOverzicht.pad[1]);
});

test('grafiekSvg: een doellijn tegen de bovenrand duwt de chip eronder', () => {
  // Ligt het doel boven alles wat er verder getekend wordt, dan komt de lijn
  // vlak onder y = 14 en zou het bijschrift erboven buiten beeld vallen.
  const hoog = overzicht(specParams({ doelNetto: 733000, rendementBruto: 0 }),
    vlakkeKoersen(2), '2026-02-15');
  const svg = grafiekSvg(hoog);
  const doelY = Number(lijnen(svg).find((l) => l.includes('stroke-dasharray="6 4"'))
    .match(/y1="([\d.]+)"/)[1]);
  assert.ok(doelY < 34);
  const chipY = Number(svg.match(/<text x="326" y="([\d.]+)"/)[1]);
  assert.ok(chipY > doelY, 'de chip staat onder de lijn in plaats van erboven');
  assert.ok(chipY < VLAK.y1);
});
