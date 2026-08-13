import test from 'node:test';
import assert from 'node:assert/strict';
import { maxChartUrl, haalHistoriek, maandenTussenSleutels, historischRendement, MINIMUM_MAANDEN } from '../js/afleiden.js';
import { PROXIES } from '../js/koersen.js';
import { specParams } from './helpers/omgeving.js';

const params = specParams();

test('maxChartUrl vraagt de volledige maandhistoriek op', () => {
  assert.ok(maxChartUrl('SUSW.L').includes('range=max'));
  assert.ok(maxChartUrl('SUSW.L').includes('interval=1mo'));
  assert.ok(maxChartUrl('A B').includes('A%20B'));
});

test('haalHistoriek levert maandkoersen of null', async () => {
  const goed = async () => ({
    ok: true,
    json: async () => ({
      chart: { result: [{ timestamp: [1751328000], indicators: { quote: [{ close: [12.5] }] } }] },
    }),
  });
  assert.deepEqual(await haalHistoriek(goed, params), { '2025-07': 12.5 });
  const mislukt = async () => ({ ok: false, status: 404 });
  assert.equal(await haalHistoriek(mislukt, params), null);
  const stuk = async () => { throw new Error('offline'); };
  assert.equal(await haalHistoriek(stuk, params), null);
  // een leeg antwoord telt als mislukt; de volgende proxy krijgt een kans
  const leeg = async () => ({
    ok: true,
    json: async () => ({ chart: { result: [{ timestamp: [], indicators: { quote: [{ close: [] }] } }] } }),
  });
  assert.equal(await haalHistoriek(leeg, params), null);
});

test('haalHistoriek loopt de proxyketen af tot er één werkt', async () => {
  const goed = {
    ok: true,
    json: async () => ({
      chart: { result: [{ timestamp: [1751328000], indicators: { quote: [{ close: [12.5] }] } }] },
    }),
  };
  const gezien = [];
  const fetchFn = async (url) => {
    gezien.push(url);
    if (gezien.length === 1) throw new Error('eigen proxy weg');
    return goed;
  };
  assert.deepEqual(await haalHistoriek(fetchFn, specParams({ proxyUrl: 'https://p/?u=' })),
    { '2025-07': 12.5 });
  assert.equal(gezien.length, 2);
  assert.ok(gezien[0].startsWith('https://p/?u='));
  assert.ok(gezien[1].startsWith(PROXIES[0]));
  // zonder eigen proxy begint de keten meteen bij de publieke lijst
  const zonder = [];
  await haalHistoriek(async (url) => { zonder.push(url); return goed; }, params);
  assert.ok(zonder[0].startsWith(PROXIES[0]));
});

test('maandenTussenSleutels telt over jaargrenzen', () => {
  assert.equal(maandenTussenSleutels('2026-07', '2026-07'), 0);
  assert.equal(maandenTussenSleutels('2026-07', '2027-07'), 12);
  assert.equal(maandenTussenSleutels('2020-01', '2026-08'), 79);
});

test('historischRendement meet het samengestelde jaarrendement', () => {
  // tien jaar, verdubbeling: 2^(1/10) - 1 = 7,18%
  const koersen = { '2016-01': 100, '2026-01': 200 };
  const gemeten = historischRendement(koersen);
  assert.ok(Math.abs(gemeten.rendement - (2 ** 0.1 - 1)) < 1e-12);
  assert.equal(gemeten.maanden, 120);
  assert.equal(gemeten.van, '2016-01');
  assert.equal(gemeten.tot, '2026-01');
  // sleutels hoeven niet gesorteerd binnen te komen
  assert.equal(historischRendement({ '2026-01': 200, '2016-01': 100 }).maanden, 120);
});

test('historischRendement weigert te korte of onbruikbare reeksen', () => {
  assert.equal(historischRendement({}), null);
  assert.equal(historischRendement({ '2026-01': 100 }), null);
  // exact op de grens van drie jaar mag wel, één maand minder niet
  assert.ok(historischRendement({ '2023-01': 100, '2026-01': 130 }) !== null);
  assert.equal(historischRendement({ '2023-02': 100, '2026-01': 130 }), null);
  assert.equal(MINIMUM_MAANDEN, 36);
  // nulkoersen leveren geen zinnig rendement
  assert.equal(historischRendement({ '2016-01': 0, '2026-01': 200 }), null);
  assert.equal(historischRendement({ '2016-01': 100, '2026-01': 0 }), null);
});
