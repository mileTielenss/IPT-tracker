import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLORIGINS, chartUrl, viaProxy, parseChart, haalKoersen } from '../js/koersen.js';
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

// Yahoo-vorm: juli 2026, augustus 2026 en een maand zonder slotkoers.
const yahooData = {
  chart: {
    result: [{
      timestamp: [1782864000, 1785542400, 1788220800],
      indicators: { quote: [{ close: [9.87, 10.25, null] }] },
    }],
  },
};

test('chartUrl zet de datums om naar unix-seconden en codeert de ticker', () => {
  assert.equal(
    chartUrl('SUSW.L', '2026-01-01', '2026-08-13'),
    'https://query1.finance.yahoo.com/v8/finance/chart/SUSW.L' +
    '?period1=1782950400&period2=1786665600&interval=1mo&events=div');
  // period2 loopt een volle dag door zodat de laatste dag meetelt
  assert.equal(1786665600 - Math.floor(Date.parse('2026-08-13') / 1000), 86400);
  assert.ok(chartUrl('^GSPC', '2026-01-01', '2026-08-13').includes('/%5EGSPC?'));
});

test('viaProxy: lege basis valt terug op allorigins, eigen basis wordt gebruikt', () => {
  const doel = 'https://query1.finance.yahoo.com/v8/finance/chart/A?period1=1&period2=2';
  assert.equal(viaProxy('', doel), ALLORIGINS + encodeURIComponent(doel));
  assert.equal(viaProxy('https://eigen.workers.dev/?u=', doel),
    'https://eigen.workers.dev/?u=' + encodeURIComponent(doel));
  // de doel-URL zit gecodeerd in de proxy-URL, dus zonder rauwe ? of &
  assert.ok(!viaProxy('', doel).slice(ALLORIGINS.length).includes('?'));
});

test('parseChart maakt maandkoersen en slaat null-slotkoersen over', () => {
  assert.deepEqual(parseChart(yahooData), { '2026-07': 9.87, '2026-08': 10.25 });
  assert.deepEqual(parseChart({
    chart: { result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }] },
  }), {});
});

test('haalKoersen zonder eigen proxy doet één poging via allorigins', async () => {
  const { fetchFn, geroepen } = maakFetch([okAntwoord(yahooData)]);
  const koersen = await haalKoersen(fetchFn, specParams(), '2026-01-01', '2026-08-13');
  assert.deepEqual(koersen, { '2026-07': 9.87, '2026-08': 10.25 });
  assert.equal(geroepen.length, 1);
  assert.ok(geroepen[0].startsWith(ALLORIGINS));
});

test('haalKoersen probeert eerst de eigen proxy en valt dan terug op allorigins', async () => {
  const { fetchFn, geroepen } = maakFetch([
    new Error('netwerk weg'),
    okAntwoord(yahooData),
  ]);
  const params = specParams({ proxyUrl: 'https://eigen.workers.dev/?u=' });
  const koersen = await haalKoersen(fetchFn, params, '2026-01-01', '2026-08-13');
  assert.deepEqual(koersen, { '2026-07': 9.87, '2026-08': 10.25 });
  assert.equal(geroepen.length, 2);
  assert.ok(geroepen[0].startsWith('https://eigen.workers.dev/?u='));
  assert.ok(geroepen[1].startsWith(ALLORIGINS));
});

test('haalKoersen telt een niet-ok antwoord als een mislukte poging', async () => {
  const { fetchFn, geroepen } = maakFetch([
    { ok: false, status: 500, json: async () => yahooData },
    okAntwoord(yahooData),
  ]);
  const params = specParams({ proxyUrl: 'https://eigen.workers.dev/?u=' });
  assert.deepEqual(await haalKoersen(fetchFn, params, '2026-01-01', '2026-08-13'),
    { '2026-07': 9.87, '2026-08': 10.25 });
  assert.equal(geroepen.length, 2);
});

test('haalKoersen gooit de laatste fout als alle pogingen falen', async () => {
  const { fetchFn, geroepen } = maakFetch([
    new Error('eigen proxy plat'),
    { ok: false, status: 500, json: async () => yahooData },
  ]);
  const params = specParams({ proxyUrl: 'https://eigen.workers.dev/?u=' });
  await assert.rejects(
    () => haalKoersen(fetchFn, params, '2026-01-01', '2026-08-13'),
    /HTTP 500/);
  assert.equal(geroepen.length, 2);
});
