import test from 'node:test';
import assert from 'node:assert/strict';
import { periodeStats, bucketsVoorMaand, bucketsVoorBoekjaar, topCategorieen, grootsteDiscretionaireCategorie, recenteTransacties, telbaar } from '../js/stats.js';
import { categorieMap, standaardCategorieen, effectieveKlasse, categorieNaam, ONGECATEGORISEERD } from '../js/categories.js';
import { maakTx } from './helpers/omgeving.js';

const catMap = categorieMap(standaardCategorieen());
const juli = { van: '2026-07-01', tot: '2026-07-31' };

test('effectieveKlasse: overschrijving wint, ongecategoriseerd is variabel', () => {
  assert.equal(effectieveKlasse(maakTx({ categoryId: 'verzekeringen' }), catMap), 'vast');
  assert.equal(effectieveKlasse(maakTx({ categoryId: 'verzekeringen', costClass: 'discretionair' }), catMap), 'discretionair');
  assert.equal(effectieveKlasse(maakTx(), catMap), 'variabel');
  assert.equal(effectieveKlasse(maakTx({ categoryId: 'omzet-consulting' }), catMap), 'variabel');
  assert.equal(categorieNaam(catMap, null), 'Ongecategoriseerd');
  assert.equal(categorieNaam(catMap, 'horeca'), 'Horeca');
});

test('periodeStats sluit interne en eenmalige transacties overal uit', () => {
  const txs = [
    maakTx({ amountCents: 100000, bookingDate: '2026-07-05', categoryId: 'omzet-consulting' }),
    maakTx({ amountCents: -20000, bookingDate: '2026-07-06', categoryId: 'verzekeringen' }),
    maakTx({ amountCents: -3000, bookingDate: '2026-07-07', categoryId: 'horeca' }),
    maakTx({ amountCents: -2000, bookingDate: '2026-07-07', categoryId: 'horeca' }),
    maakTx({ amountCents: -3000, bookingDate: '2026-07-08' }),
    maakTx({ amountCents: -99900, bookingDate: '2026-07-09', isInternal: true, categoryId: 'horeca' }),
    maakTx({ amountCents: -7500, bookingDate: '2026-07-10', isOneOff: true, categoryId: 'verzekeringen' }),
    maakTx({ amountCents: -1000, bookingDate: '2026-08-01', categoryId: 'horeca' }),
  ];
  const stats = periodeStats(txs, catMap, juli);
  assert.equal(stats.totInCents, 100000);
  assert.equal(stats.totUitCents, 28000);
  assert.equal(stats.nettoCents, 72000);
  assert.equal(stats.perKlasse.vast, 20000);
  assert.equal(stats.perKlasse.variabel, 3000);
  assert.equal(stats.perKlasse.discretionair, 5000);
  assert.equal(stats.perCategorie.get('verzekeringen'), 20000);
  assert.equal(stats.perCategorie.get(ONGECATEGORISEERD), 3000);
  assert.equal(stats.eenmaligAantal, 1);
  assert.equal(stats.eenmaligSomCents, -7500);
  assert.equal(stats.ongecategoriseerd, 1);
  assert.equal(stats.discretionairAantal, 2);
  assert.equal(stats.perCategorie.get('horeca'), 5000);
  assert.equal(stats.perDiscretionaireCategorie.get('horeca'), 5000);
  assert.ok(stats.heeftData);
  assert.ok(!periodeStats([], catMap, juli).heeftData);
  assert.ok(!telbaar(txs[5]));
  assert.ok(telbaar(txs[0]));
});

test('bucketsVoorMaand groepeert uitgaven per week en klasse', () => {
  const txs = [
    maakTx({ amountCents: -1000, bookingDate: '2026-01-01', categoryId: 'verzekeringen' }),
    maakTx({ amountCents: -2000, bookingDate: '2026-07-09', categoryId: 'horeca' }),
    maakTx({ amountCents: -4000, bookingDate: '2026-07-31', categoryId: 'brandstof' }),
    maakTx({ amountCents: 5000, bookingDate: '2026-07-03' }),
    maakTx({ amountCents: -8000, bookingDate: '2026-07-15', isOneOff: true }),
    maakTx({ amountCents: -8000, bookingDate: '2026-06-30' }),
  ];
  const buckets = bucketsVoorMaand(txs, catMap, 2026, 7);
  assert.equal(buckets.length, 5);
  assert.equal(buckets[0].label, 'W1');
  assert.equal(buckets[0].vast, 1000);
  assert.equal(buckets[1].discretionair, 2000);
  assert.equal(buckets[4].variabel, 4000);
  assert.equal(buckets[2].vast + buckets[2].variabel + buckets[2].discretionair, 0);
});

test('bucketsVoorBoekjaar: één balk per maand, klassensom klopt met totaal uit', () => {
  const txs = [
    maakTx({ amountCents: -1000, bookingDate: '2026-01-15', categoryId: 'verzekeringen' }),
    maakTx({ amountCents: -2500, bookingDate: '2026-01-20', categoryId: 'horeca' }),
    maakTx({ amountCents: -4000, bookingDate: '2026-12-31', categoryId: 'brandstof' }),
    maakTx({ amountCents: -999, bookingDate: '2025-12-31' }),
    maakTx({ amountCents: -999, bookingDate: '2027-01-01' }),
  ];
  const buckets = bucketsVoorBoekjaar(txs, catMap, 2026, 1);
  assert.equal(buckets.length, 12);
  assert.equal(buckets[0].label, '01');
  // acceptatiecriterium 5: klassensom per maand == totaal uit van die maand
  const januari = periodeStats(txs, catMap, { van: '2026-01-01', tot: '2026-01-31' });
  assert.equal(buckets[0].vast + buckets[0].variabel + buckets[0].discretionair, januari.totUitCents);
  assert.equal(buckets[11].variabel, 4000);
});

test('topCategorieen: top 5 met aandeel en verschil', () => {
  const maak = (id, cents) => maakTx({ amountCents: -cents, bookingDate: '2026-07-10', categoryId: id });
  const txs = [maak('verzekeringen', 5000), maak('horeca', 4000), maak('brandstof', 3000),
    maak('telecom', 2000), maak('software', 1000), maak('bankkosten', 500), maak('leasing', 6000)];
  const stats = periodeStats(txs, catMap, juli);
  const vorig = periodeStats([maak('leasing', 6000)].map((tx) => ({ ...tx, bookingDate: '2026-06-10' })),
    catMap, { van: '2026-06-01', tot: '2026-06-30' });
  const top = topCategorieen(stats, vorig);
  assert.equal(top.length, 5);
  assert.equal(top[0].categoryId, 'leasing');
  assert.equal(top[0].cents, 6000);
  assert.equal(top[0].vorigCents, 6000);
  assert.equal(top[1].vorigCents, 0);
  assert.ok(Math.abs(top[0].aandeel - 6000 / 21500) < 1e-9);
  // vorige periode zonder data: verschil leeg
  const zonderVorig = topCategorieen(stats, periodeStats([], catMap, juli));
  assert.equal(zonderVorig[0].vorigCents, null);
  // geen uitgaven: aandeel 0
  const leeg = periodeStats([], catMap, juli);
  assert.deepEqual(topCategorieen(leeg, leeg), []);
  const alleenIn = periodeStats([maakTx({ amountCents: 1, bookingDate: '2026-07-01' })], catMap, juli);
  assert.equal(topCategorieen(alleenIn, alleenIn).length, 0);
});

test('grootsteDiscretionaireCategorie', () => {
  const txs = [
    maakTx({ amountCents: -4000, bookingDate: '2026-07-10', categoryId: 'horeca' }),
    maakTx({ amountCents: -9000, bookingDate: '2026-07-11', categoryId: 'aankopen-divers' }),
    maakTx({ amountCents: -1000, bookingDate: '2026-07-12', categoryId: 'verzekeringen' }),
  ];
  const stats = periodeStats(txs, catMap, juli);
  assert.deepEqual(grootsteDiscretionaireCategorie(stats), { categoryId: 'aankopen-divers', cents: 9000 });
  assert.equal(grootsteDiscretionaireCategorie(periodeStats([], catMap, juli)), null);
});

test('recenteTransacties: nieuwste eerst, telbaar, maximaal tien', () => {
  const txs = [];
  for (let dag = 1; dag <= 12; dag++) {
    txs.push(maakTx({ bookingDate: `2026-07-${String(dag).padStart(2, '0')}` }));
  }
  txs.push(maakTx({ bookingDate: '2026-07-20', isInternal: true }));
  const recent = recenteTransacties(txs, juli);
  assert.equal(recent.length, 10);
  assert.equal(recent[0].bookingDate, '2026-07-12');
  assert.equal(recent[9].bookingDate, '2026-07-03');
});
