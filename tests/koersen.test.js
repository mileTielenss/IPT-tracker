import test from 'node:test';
import assert from 'node:assert/strict';
import { PROXIES, ALLORIGINS, chartUrl, viaProxy, proxyKeten, parseChart, haalKoersen, metTijdslimiet } from '../js/koersen.js';
import { specParams } from './helpers/omgeving.js';

// Fake fetch die de opgevraagde URL's logt; elk antwoord uit de rij wordt op
// volgorde teruggegeven, een Error in de rij wordt gegooid (netwerkfout).
function maakFetch(antwoorden) {
  const geroepen = [];
  const fetchFn = async (url) => {
    geroepen.push(url);
    const antwoord = antwoorden.shift();
    if (antwoord instanceof Error) throw antwoord;
    return antwoord;
  };
  return { fetchFn, geroepen };
}

function okAntwoord(data) {
  return { ok: true, status: 200, json: async () => data };
}

function stukAntwoord() {
  return { ok: false, status: 500, json: async () => yahooData };
}

// Yahoo-vorm: juli 2026, augustus 2026 en een maand zonder slotkoers.
const yahooData = {
  chart: {
    result: [{
      timestamp: [1782864000, 1785542400, 1788220800],
      indicators: { quote: [{ close: [9.87, 10.25, null] }] },
    }],
  },
};

const KOERSEN = { '2026-07': 9.87, '2026-08': 10.25 };
const EIGEN = 'https://eigen.workers.dev/?u=';

test('chartUrl zet de datums om naar unix-seconden en codeert de ticker', () => {
  assert.equal(
    chartUrl('SUSW.L', '2026-01-01', '2026-08-13'),
    'https://query1.finance.yahoo.com/v8/finance/chart/SUSW.L' +
    '?period1=1767225600&period2=1786665600&interval=1mo&events=div');
  // period2 loopt een volle dag door zodat de laatste dag meetelt
  assert.equal(1786665600 - Math.floor(Date.parse('2026-08-13') / 1000), 86400);
  assert.ok(chartUrl('^GSPC', '2026-01-01', '2026-08-13').includes('/%5EGSPC?'));
});

test('PROXIES is een lijst publieke doorgeefluiken met allorigins erin', () => {
  assert.equal(PROXIES.length, 3);
  assert.equal(ALLORIGINS, PROXIES[1]);
  for (const proxy of PROXIES) assert.ok(proxy.startsWith('https://'));
  // elk voorvoegsel eindigt op een parameter waar de doel-URL achter past
  for (const proxy of PROXIES) assert.match(proxy, /[?&][a-z]+=$/);
});

test('viaProxy: lege basis valt terug op de eerste publieke proxy', () => {
  const doel = 'https://query1.finance.yahoo.com/v8/finance/chart/A?period1=1&period2=2';
  assert.equal(viaProxy('', doel), PROXIES[0] + encodeURIComponent(doel));
  assert.equal(viaProxy(EIGEN, doel), EIGEN + encodeURIComponent(doel));
  // de doel-URL zit gecodeerd in de proxy-URL, dus zonder rauwe ? of &
  assert.ok(!viaProxy('', doel).slice(PROXIES[0].length).includes('?'));
});

test('proxyKeten: zonder eigen proxy precies de publieke lijst', () => {
  const doel = 'https://query1.finance.yahoo.com/v8/finance/chart/A?period1=1';
  const keten = proxyKeten(specParams(), doel);
  assert.equal(keten.length, PROXIES.length);
  assert.deepEqual(keten, PROXIES.map((p) => p + encodeURIComponent(doel)));
  // de doel-URL staat overal gecodeerd in
  for (const url of keten) assert.ok(url.includes(encodeURIComponent(doel)));
});

test('proxyKeten: een eigen proxy gaat vooraan, de publieke blijven als vangnet', () => {
  const doel = 'https://query1.finance.yahoo.com/v8/finance/chart/A?period1=1';
  const keten = proxyKeten(specParams({ proxyUrl: EIGEN }), doel);
  assert.equal(keten.length, PROXIES.length + 1);
  assert.equal(keten[0], EIGEN + encodeURIComponent(doel));
  assert.deepEqual(keten.slice(1), PROXIES.map((p) => p + encodeURIComponent(doel)));
});

test('parseChart maakt maandkoersen en slaat null-slotkoersen over', () => {
  assert.deepEqual(parseChart(yahooData), KOERSEN);
  assert.deepEqual(parseChart({
    chart: { result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }] },
  }), {});
});

test('haalKoersen zonder eigen proxy begint bij de eerste publieke proxy', async () => {
  const { fetchFn, geroepen } = maakFetch([okAntwoord(yahooData)]);
  const koersen = await haalKoersen(fetchFn, specParams(), '2026-01-01', '2026-08-13');
  assert.deepEqual(koersen, KOERSEN);
  assert.equal(geroepen.length, 1);
  assert.ok(geroepen[0].startsWith(PROXIES[0]));
});

test('haalKoersen probeert eerst de eigen proxy en dan de publieke keten', async () => {
  const { fetchFn, geroepen } = maakFetch([
    new Error('netwerk weg'),
    okAntwoord(yahooData),
  ]);
  const params = specParams({ proxyUrl: EIGEN });
  assert.deepEqual(await haalKoersen(fetchFn, params, '2026-01-01', '2026-08-13'), KOERSEN);
  assert.equal(geroepen.length, 2);
  assert.ok(geroepen[0].startsWith(EIGEN));
  assert.ok(geroepen[1].startsWith(PROXIES[0]));
});

test('haalKoersen telt een niet-ok antwoord als een mislukte poging', async () => {
  const { fetchFn, geroepen } = maakFetch([stukAntwoord(), okAntwoord(yahooData)]);
  const params = specParams({ proxyUrl: EIGEN });
  assert.deepEqual(await haalKoersen(fetchFn, params, '2026-01-01', '2026-08-13'), KOERSEN);
  assert.equal(geroepen.length, 2);
});

test('haalKoersen behandelt een leeg antwoord als een mislukking', async () => {
  // Sommige proxy's geven met status 200 een lege of onbruikbare payload
  // terug; dat mag de bestaande koersen niet wegvegen.
  const leegChart = { chart: { result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }] } };
  const { fetchFn, geroepen } = maakFetch([okAntwoord(leegChart), okAntwoord(yahooData)]);
  assert.deepEqual(await haalKoersen(fetchFn, specParams(), '2026-01-01', '2026-08-13'), KOERSEN);
  assert.equal(geroepen.length, 2);
  // niets dan lege antwoorden: dan is het echt mislukt
  const alleenLeeg = maakFetch([okAntwoord(leegChart), okAntwoord(leegChart), okAntwoord(leegChart)]);
  await assert.rejects(
    () => haalKoersen(alleenLeeg.fetchFn, specParams(), '2026-01-01', '2026-08-13'),
    /leeg antwoord/);
  assert.equal(alleenLeeg.geroepen.length, 3);
});

test('haalKoersen gooit de laatste fout als de hele keten faalt', async () => {
  const { fetchFn, geroepen } = maakFetch([
    new Error('eigen proxy plat'),
    new Error('proxy 1 plat'),
    new Error('proxy 2 plat'),
    stukAntwoord(),
  ]);
  const params = specParams({ proxyUrl: EIGEN });
  await assert.rejects(
    () => haalKoersen(fetchFn, params, '2026-01-01', '2026-08-13'),
    /HTTP 500/);
  assert.equal(geroepen.length, 4);
});

test('een geldig maar leeg antwoord telt als mislukking, niet als nul koersen', async () => {
  // Een proxy die een afgeknot antwoord doorgeeft mag de cache nooit wissen.
  const leeg = async () => ({
    ok: true,
    json: async () => ({
      chart: { result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }] },
    }),
  });
  await assert.rejects(haalKoersen(leeg, specParams(), '2026-01-01', '2026-08-01'),
    /leeg antwoord/);
});

test('metTijdslimiet breekt een fetch af die te lang duurt', async () => {
  // Zonder tijdslimiet blokkeert één dode proxy de hele keten en lijkt de
  // knop niets te doen.
  const gezien = [];
  const traag = (url, opties) => new Promise((_, mislukt) => {
    gezien.push(opties.signal);
    opties.signal.addEventListener('abort', () => mislukt(new Error('afgebroken')));
  });
  const venster = { AbortController };
  await assert.rejects(metTijdslimiet(traag, venster, 5)('https://x'), /afgebroken/);
  assert.equal(gezien.length, 1);
  // een snelle fetch komt gewoon door en de timer wordt opgeruimd
  const snel = async () => 'klaar';
  assert.equal(await metTijdslimiet(snel, venster, 5000)('https://x'), 'klaar');
  // zonder AbortController (oudere omgeving) blijft de fetch ongemoeid
  assert.equal(await metTijdslimiet(snel, {}, 5000)('https://x'), 'klaar');
});
