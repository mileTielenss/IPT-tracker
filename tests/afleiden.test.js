import test from 'node:test';
import assert from 'node:assert/strict';
import { maxChartUrl, fondsUrl, parseFondsInfo, haalTer, haalHistoriek, maandenTussenSleutels, historischRendement, nettoUitBruto, MINIMUM_MAANDEN } from '../js/afleiden.js';
import { specParams } from './helpers/omgeving.js';

const params = specParams();

test('URLs voor historiek en fondsprofiel', () => {
  assert.ok(maxChartUrl('SUSW.L').includes('range=max'));
  assert.ok(maxChartUrl('SUSW.L').includes('interval=1mo'));
  assert.ok(maxChartUrl('A B').includes('A%20B'));
  assert.ok(fondsUrl('SUSW.L').includes('quoteSummary/SUSW.L'));
  assert.ok(fondsUrl('SUSW.L').includes('modules=fundProfile'));
});

test('parseFondsInfo leest de TER, kaal of als raw-object', () => {
  const kaal = { quoteSummary: { result: [{ fundProfile: { feesExpensesInvestment: { annualReportExpenseRatio: 0.002 } } }] } };
  assert.equal(parseFondsInfo(kaal), 0.002);
  const metRaw = { quoteSummary: { result: [{ fundProfile: { feesExpensesInvestment: { annualReportExpenseRatio: { raw: 0.0022, fmt: '0.22%' } } } }] } };
  assert.equal(parseFondsInfo(metRaw), 0.0022);
});

test('parseFondsInfo geeft null bij elke vorm van ontbrekende data', () => {
  assert.equal(parseFondsInfo({}), null);
  assert.equal(parseFondsInfo({ quoteSummary: { result: [] } }), null);
  assert.equal(parseFondsInfo({ quoteSummary: { result: [{}] } }), null);
  assert.equal(parseFondsInfo({ quoteSummary: { result: [{ fundProfile: {} }] } }), null);
  assert.equal(parseFondsInfo({ quoteSummary: { result: [{ fundProfile: { feesExpensesInvestment: null } }] } }), null);
  const leeg = { quoteSummary: { result: [{ fundProfile: { feesExpensesInvestment: { annualReportExpenseRatio: {} } } }] } };
  assert.equal(parseFondsInfo(leeg), null);
  const tekst = { quoteSummary: { result: [{ fundProfile: { feesExpensesInvestment: { annualReportExpenseRatio: 'n.v.t.' } } } ] } };
  assert.equal(parseFondsInfo(tekst), null);
});

test('haalTer probeert de eigen proxy en valt terug op allorigins', async () => {
  const gezien = [];
  const fetchFn = async (url) => {
    gezien.push(url);
    if (gezien.length === 1) return { ok: false, status: 500 };
    return {
      ok: true,
      json: async () => ({ quoteSummary: { result: [{ fundProfile: { feesExpensesInvestment: { annualReportExpenseRatio: 0.002 } } }] } }),
    };
  };
  const metProxy = specParams({ proxyUrl: 'https://eigen.proxy/?u=' });
  assert.equal(await haalTer(fetchFn, metProxy), 0.002);
  assert.equal(gezien.length, 2);
  assert.ok(gezien[0].startsWith('https://eigen.proxy/?u='));
  assert.ok(gezien[1].includes('allorigins'));
});

test('haalTer geeft null als niets lukt', async () => {
  const stuk = async () => { throw new Error('offline'); };
  assert.equal(await haalTer(stuk, params), null);
  const zonderTer = async () => ({ ok: true, json: async () => ({}) });
  assert.equal(await haalTer(zonderTer, params), null);
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
  // met eigen proxy: eerste poging faalt, tweede slaagt
  let n = 0;
  const tweede = async () => {
    n++;
    if (n === 1) throw new Error('proxy weg');
    return goed();
  };
  assert.deepEqual(await haalHistoriek(tweede, specParams({ proxyUrl: 'https://p/?u=' })), { '2025-07': 12.5 });
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

test('nettoUitBruto trekt de beheerskost van het brutorendement af', () => {
  // 7% bruto met 1,25% beheerskost ligt vlak bij de 5,6% uit de spec
  const netto = nettoUitBruto(0.07, 0.0125);
  assert.ok(Math.abs(netto - 0.0566) < 0.0002);
  assert.ok(Math.abs(nettoUitBruto(0.07, 0) - 0.07) < 1e-12);
});
