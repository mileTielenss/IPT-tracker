import test from 'node:test';
import assert from 'node:assert/strict';
import { laatsteDag, maandBereik, vorigeMaand, volgendeMaand, maandLabel, boekjaarVoorDatum, boekjaarBereik, boekjaarLabel, maandenVanBoekjaar, weekVanMaand, aantalWekenInMaand, inBereik, recentsteMaandMetData } from '../js/periods.js';

test('maandbereik en laatste dag, inclusief schrikkeljaar', () => {
  assert.deepEqual(maandBereik(2026, 2), { van: '2026-02-01', tot: '2026-02-28' });
  assert.deepEqual(maandBereik(2024, 2), { van: '2024-02-01', tot: '2024-02-29' });
  assert.deepEqual(maandBereik(2026, 12), { van: '2026-12-01', tot: '2026-12-31' });
  assert.equal(laatsteDag(2026, 4), 30);
});

test('maandnavigatie over jaargrenzen', () => {
  assert.deepEqual(vorigeMaand({ jaar: 2026, maand: 1 }), { jaar: 2025, maand: 12 });
  assert.deepEqual(vorigeMaand({ jaar: 2026, maand: 7 }), { jaar: 2026, maand: 6 });
  assert.deepEqual(volgendeMaand({ jaar: 2026, maand: 12 }), { jaar: 2027, maand: 1 });
  assert.deepEqual(volgendeMaand({ jaar: 2026, maand: 7 }), { jaar: 2026, maand: 8 });
  assert.equal(maandLabel({ jaar: 2026, maand: 7 }), 'juli 2026');
});

test('boekjaar met startmaand januari', () => {
  assert.equal(boekjaarVoorDatum('2026-01-01', 1), 2026);
  assert.equal(boekjaarVoorDatum('2026-12-31', 1), 2026);
  assert.deepEqual(boekjaarBereik(2026, 1), { van: '2026-01-01', tot: '2026-12-31' });
  assert.equal(boekjaarLabel(2026, 1), 'Boekjaar 2026');
});

test('boekjaar met afwijkende startmaand', () => {
  assert.equal(boekjaarVoorDatum('2026-06-30', 7), 2025);
  assert.equal(boekjaarVoorDatum('2026-07-01', 7), 2026);
  assert.deepEqual(boekjaarBereik(2026, 7), { van: '2026-07-01', tot: '2027-06-30' });
  assert.equal(boekjaarLabel(2026, 7), 'Boekjaar 2026–2027');
  const maanden = maandenVanBoekjaar(2026, 7);
  assert.equal(maanden.length, 12);
  assert.deepEqual(maanden[0], { jaar: 2026, maand: 7 });
  assert.deepEqual(maanden[11], { jaar: 2027, maand: 6 });
});

test('weken van de maand', () => {
  assert.equal(weekVanMaand('2026-07-01'), 0);
  assert.equal(weekVanMaand('2026-07-07'), 0);
  assert.equal(weekVanMaand('2026-07-08'), 1);
  assert.equal(weekVanMaand('2026-07-31'), 4);
  assert.equal(aantalWekenInMaand(2026, 7), 5);
  assert.equal(aantalWekenInMaand(2026, 2), 4);
});

test('inBereik en recentste maand met data', () => {
  const bereik = { van: '2026-07-01', tot: '2026-07-31' };
  assert.ok(inBereik('2026-07-01', bereik));
  assert.ok(inBereik('2026-07-31', bereik));
  assert.ok(!inBereik('2026-06-30', bereik));
  assert.ok(!inBereik('2026-08-01', bereik));
  assert.equal(recentsteMaandMetData([]), null);
  assert.deepEqual(recentsteMaandMetData([
    { bookingDate: '2026-06-05' },
    { bookingDate: '2026-08-19' },
    { bookingDate: '2026-07-13' },
  ]), { jaar: 2026, maand: 8 });
});
