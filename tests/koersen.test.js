import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROXIES, ALLORIGINS, LOKAAL_PAD, chartUrl, viaProxy, proxyKeten, parseChart,
  leesBestand, bronnen, haalKoersen, metTijdslimiet,
} from '../js/koersen.js';
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

// Het maandbestand dat de werkstroom in de repo zet.
function bestandAntwoord(ticker = 'SUSW.L', koersen = KOERSEN) {
  return okAntwoord({ ticker, munt: 'EUR', bijgewerkt: '2026-08-13', koersen });
}

// Een mislukt maandbestand (404 bij een verse fork), zodat de proxy's aan bod
// komen zoals in de tests die het vangnet nagaan.
function geenBestand() {
  return new Error('404');
}

test('chartUrl vraagt met één argument de volledige maandhistoriek op', () => {
  // Eén verzoek voor alles: de koersen van de premiemaanden én de historiek
  // waaruit het rendement gemeten wordt. Dus geen datumgrenzen meer.
  assert.equal(chartUrl.length, 1);
  assert.equal(chartUrl('SUSW.L'),
    'https://query1.finance.yahoo.com/v8/finance/chart/SUSW.L?range=max&interval=1mo');
  assert.ok(!chartUrl('SUSW.L').includes('period1'));
  assert.ok(!chartUrl('SUSW.L').includes('period2'));
  // een extra argument verandert niets aan de URL
  assert.equal(chartUrl('SUSW.L', '2026-01-01'), chartUrl('SUSW.L'));
});

test('chartUrl codeert bijzondere tekens in de ticker', () => {
  // ^GSPC zou zonder codering het pad van de URL breken.
  assert.equal(chartUrl('^GSPC'),
    'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=max&interval=1mo');
  assert.ok(chartUrl('A B').includes('/A%20B?'));
  assert.ok(chartUrl('X&Y').includes('/X%26Y?'));
});

test('PROXIES is een lijst publieke doorgeefluiken met allorigins erin', () => {
  assert.equal(PROXIES.length, 3);
  assert.equal(ALLORIGINS, PROXIES[1]);
  for (const proxy of PROXIES) assert.ok(proxy.startsWith('https://'));
  // elk voorvoegsel eindigt op een parameter waar de doel-URL achter past
  for (const proxy of PROXIES) assert.match(proxy, /[?&][a-z]+=$/);
});

test('viaProxy: lege basis valt terug op de eerste publieke proxy', () => {
  const doel = 'https://query1.finance.yahoo.com/v8/finance/chart/A?range=max&interval=1mo';
  assert.equal(viaProxy('', doel), PROXIES[0] + encodeURIComponent(doel));
  assert.equal(viaProxy(EIGEN, doel), EIGEN + encodeURIComponent(doel));
  // de doel-URL zit gecodeerd in de proxy-URL, dus zonder rauwe ? of &
  assert.ok(!viaProxy('', doel).slice(PROXIES[0].length).includes('?'));
});

test('proxyKeten: zonder eigen proxy precies de publieke lijst', () => {
  const doel = 'https://query1.finance.yahoo.com/v8/finance/chart/A?range=max&interval=1mo';
  const keten = proxyKeten(specParams(), doel);
  assert.equal(keten.length, PROXIES.length);
  assert.deepEqual(keten, PROXIES.map((p) => p + encodeURIComponent(doel)));
  // de doel-URL staat overal gecodeerd in
  for (const url of keten) assert.ok(url.includes(encodeURIComponent(doel)));
});

test('proxyKeten: een eigen proxy gaat vooraan, de publieke blijven als vangnet', () => {
  const doel = 'https://query1.finance.yahoo.com/v8/finance/chart/A?range=max&interval=1mo';
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

test('LOKAAL_PAD wijst relatief naar het gepubliceerde maandbestand', () => {
  // Relatief, want GitHub Pages serveert de app onder een subpad.
  assert.equal(LOKAAL_PAD, './data/koersen.json');
  assert.ok(!LOKAAL_PAD.startsWith('/'));
  assert.ok(!LOKAAL_PAD.includes('://'));
});

test('leesBestand geeft de koersen terug, maar alleen van de juiste ticker', () => {
  const bestand = { ticker: 'SUSW.L', koersen: KOERSEN };
  assert.deepEqual(leesBestand(bestand, 'SUSW.L'), KOERSEN);
  // een ander fonds mag nooit stilzwijgend doorgaan voor het jouwe
  assert.throws(() => leesBestand(bestand, 'IWDA.AS'), /bevat SUSW.L, niet IWDA.AS/);
  // een bestand zonder koersen telt als leeg, niet als een crash
  assert.deepEqual(leesBestand({ ticker: 'SUSW.L' }, 'SUSW.L'), {});
});

test('bronnen zet het eigen bestand vooraan en de doorgeefluiken erachter', () => {
  const zonder = bronnen(specParams());
  assert.equal(zonder.length, PROXIES.length + 1);
  assert.equal(zonder[0].url, LOKAAL_PAD);
  assert.equal(zonder[0].naam, 'het maandbestand van de app');
  for (const bron of zonder.slice(1)) {
    assert.equal(bron.naam, 'een publiek doorgeefluik');
    assert.ok(bron.url.includes(encodeURIComponent(chartUrl(specParams().ticker))));
  }
  // een eigen proxy schuift tussen het bestand en de publieke luiken
  const met = bronnen(specParams({ proxyUrl: EIGEN }));
  assert.equal(met.length, PROXIES.length + 2);
  assert.equal(met[0].url, LOKAAL_PAD);
  assert.equal(met[1].naam, 'je eigen doorgeefluik');
  assert.ok(met[1].url.startsWith(EIGEN));
  assert.equal(met[2].naam, 'een publiek doorgeefluik');
});

test('haalKoersen begint bij het eigen bestand: geen CORS, geen doorgeefluik', async () => {
  const { fetchFn, geroepen } = maakFetch([bestandAntwoord()]);
  // handtekening: (fetchFn, params, melder)
  assert.equal(haalKoersen.length, 2);
  const koersen = await haalKoersen(fetchFn, specParams());
  assert.deepEqual(koersen, KOERSEN);
  assert.deepEqual(geroepen, [LOKAAL_PAD]);
});

test('haalKoersen valt bij een ontbrekend bestand terug op de publieke proxy', async () => {
  const { fetchFn, geroepen } = maakFetch([geenBestand(), okAntwoord(yahooData)]);
  assert.deepEqual(await haalKoersen(fetchFn, specParams()), KOERSEN);
  assert.equal(geroepen.length, 2);
  assert.equal(geroepen[0], LOKAAL_PAD);
  assert.ok(geroepen[1].startsWith(PROXIES[0]));
  // de opgevraagde doel-URL is de volledige maandhistoriek
  assert.ok(geroepen[1].includes(encodeURIComponent(chartUrl(specParams().ticker))));
});

test('een bestand met een ander fonds telt niet mee', async () => {
  // Wie in de instellingen een eigen ticker zet, krijgt niet stilzwijgend de
  // koersen van het gepubliceerde fonds te zien.
  const { fetchFn, geroepen } = maakFetch([bestandAntwoord('ANDER.L'), okAntwoord(yahooData)]);
  assert.deepEqual(await haalKoersen(fetchFn, specParams()), KOERSEN);
  assert.equal(geroepen.length, 2);
  assert.ok(geroepen[1].startsWith(PROXIES[0]));
});

test('haalKoersen probeert na het bestand de eigen proxy en dan de publieke keten', async () => {
  const { fetchFn, geroepen } = maakFetch([
    geenBestand(),
    new Error('netwerk weg'),
    okAntwoord(yahooData),
  ]);
  const params = specParams({ proxyUrl: EIGEN });
  assert.deepEqual(await haalKoersen(fetchFn, params), KOERSEN);
  assert.equal(geroepen.length, 3);
  assert.equal(geroepen[0], LOKAAL_PAD);
  assert.ok(geroepen[1].startsWith(EIGEN));
  assert.ok(geroepen[2].startsWith(PROXIES[0]));
});

test('haalKoersen meldt elke poging met naam zodat het scherm teken van leven geeft', async () => {
  const { fetchFn } = maakFetch([geenBestand(), okAntwoord(yahooData)]);
  const pogingen = [];
  const koersen = await haalKoersen(fetchFn, specParams(),
    (poging, totaal, naam) => pogingen.push(`${poging}/${totaal} ${naam}`));
  assert.deepEqual(koersen, KOERSEN);
  assert.deepEqual(pogingen, [
    '1/4 het maandbestand van de app',
    '2/4 een publiek doorgeefluik',
  ]);
});

test('haalKoersen telt een niet-ok antwoord als een mislukte poging', async () => {
  const { fetchFn, geroepen } = maakFetch([stukAntwoord(), stukAntwoord(), okAntwoord(yahooData)]);
  const params = specParams({ proxyUrl: EIGEN });
  assert.deepEqual(await haalKoersen(fetchFn, params), KOERSEN);
  assert.equal(geroepen.length, 3);
});

test('haalKoersen behandelt een leeg antwoord als een mislukking', async () => {
  // Sommige proxy's geven met status 200 een lege of onbruikbare payload
  // terug; dat mag de bestaande koersen niet wegvegen. Een leeg maandbestand
  // (verse fork, werkstroom nog niet gedraaid) net zo goed.
  const leegChart = { chart: { result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }] } };
  const { fetchFn, geroepen } = maakFetch([bestandAntwoord('SUSW.L', {}), okAntwoord(yahooData)]);
  assert.deepEqual(await haalKoersen(fetchFn, specParams()), KOERSEN);
  assert.equal(geroepen.length, 2);
  // niets dan lege antwoorden: dan is het echt mislukt
  const alleenLeeg = maakFetch([
    bestandAntwoord('SUSW.L', {}),
    okAntwoord(leegChart), okAntwoord(leegChart), okAntwoord(leegChart),
  ]);
  await assert.rejects(
    () => haalKoersen(alleenLeeg.fetchFn, specParams()),
    /leeg antwoord/);
  assert.equal(alleenLeeg.geroepen.length, 4);
});

test('haalKoersen gooit de laatste fout als de hele keten faalt', async () => {
  const { fetchFn, geroepen } = maakFetch([
    new Error('geen bestand'),
    new Error('eigen proxy plat'),
    new Error('proxy 1 plat'),
    new Error('proxy 2 plat'),
    stukAntwoord(),
  ]);
  const params = specParams({ proxyUrl: EIGEN });
  await assert.rejects(() => haalKoersen(fetchFn, params), /HTTP 500/);
  // bestand, eigen proxy en de drie publieke: alles is geprobeerd
  assert.equal(geroepen.length, 5);
});

test('een geldig maar leeg antwoord telt als mislukking, niet als nul koersen', async () => {
  // Een proxy die een afgeknot antwoord doorgeeft mag de cache nooit wissen.
  const leeg = async () => ({
    ok: true,
    json: async () => ({
      chart: { result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }] },
    }),
  });
  await assert.rejects(haalKoersen(leeg, specParams()), /leeg antwoord/);
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
