import test from 'node:test';
import assert from 'node:assert/strict';
import { prognoseVoorBoekjaar } from '../js/prognose.js';
import { maakTx } from './helpers/omgeving.js';

function juniTotAugustus() {
  return [
    // omzet: 3000 + 1500 + 1500 over juni-augustus
    maakTx({ amountCents: 300000, bookingDate: '2026-06-09', categoryId: 'omzet-consulting' }),
    maakTx({ amountCents: 150000, bookingDate: '2026-07-07', categoryId: 'omzet-epc' }),
    maakTx({ amountCents: 150000, bookingDate: '2026-08-11', categoryId: 'omzet-consulting' }),
    // kosten: telecom 3 × 60, btw 900 in juli, ongecategoriseerd 90
    maakTx({ amountCents: -6000, bookingDate: '2026-06-05', categoryId: 'telecom' }),
    maakTx({ amountCents: -6000, bookingDate: '2026-07-05', categoryId: 'telecom' }),
    maakTx({ amountCents: -6000, bookingDate: '2026-08-05', categoryId: 'telecom' }),
    maakTx({ amountCents: -90000, bookingDate: '2026-07-03', categoryId: 'belastingen' }),
    maakTx({ amountCents: -9000, bookingDate: '2026-06-20' }),
    // intern en eenmalig tellen nooit mee
    maakTx({ amountCents: -999999, bookingDate: '2026-07-22', isInternal: true }),
    maakTx({ amountCents: -888888, bookingDate: '2026-07-23', isOneOff: true }),
  ];
}

test('prognose trekt het maandgemiddelde door over de resterende maanden', () => {
  const prognose = prognoseVoorBoekjaar(juniTotAugustus(), 2026, 1);
  assert.ok(prognose.heeftData);
  assert.deepEqual(prognose.eersteMaand, { jaar: 2026, maand: 6 });
  assert.deepEqual(prognose.laatsteMaand, { jaar: 2026, maand: 8 });
  assert.equal(prognose.verstreken, 3);
  assert.equal(prognose.resterend, 4);
  // omzet: 6000 gerealiseerd, 2000/maand, 8000 verwacht, 14000 jaar
  assert.equal(prognose.omzet.gerealiseerdCents, 600000);
  assert.equal(prognose.omzet.perMaandCents, 200000);
  assert.equal(prognose.omzet.verwachtCents, 800000);
  assert.equal(prognose.omzet.jaarCents, 1400000);
  // kosten totaal: 1170 gerealiseerd, 390/maand, 1560 verwacht, 2730 jaar
  assert.equal(prognose.kostenTotaal.gerealiseerdCents, 117000);
  assert.equal(prognose.kostenTotaal.perMaandCents, 39000);
  assert.equal(prognose.kostenTotaal.jaarCents, 273000);
  // per categorie, gesorteerd op verwacht jaartotaal
  assert.equal(prognose.kosten[0].categoryId, 'belastingen');
  assert.equal(prognose.kosten[0].jaarCents, 210000);
  assert.equal(prognose.kosten[1].categoryId, 'telecom');
  assert.equal(prognose.kosten[1].perMaandCents, 6000);
  assert.equal(prognose.kosten[1].jaarCents, 42000);
  assert.equal(prognose.kosten[2].categoryId, 'ongecategoriseerd');
  // resultaat vóór belastingen: omzet − (kosten − belastingen)
  assert.equal(prognose.resultaat.jaarCents, 1400000 - (273000 - 210000));
  assert.equal(prognose.resultaat.gerealiseerdCents, 600000 - (117000 - 90000));
});

test('zonder telbare transacties is er geen prognose', () => {
  assert.deepEqual(prognoseVoorBoekjaar([], 2026, 1), { heeftData: false });
  const alleenIntern = [maakTx({ bookingDate: '2026-07-01', isInternal: true })];
  assert.deepEqual(prognoseVoorBoekjaar(alleenIntern, 2026, 1), { heeftData: false });
  const buitenBoekjaar = [maakTx({ bookingDate: '2025-12-31' })];
  assert.deepEqual(prognoseVoorBoekjaar(buitenBoekjaar, 2026, 1), { heeftData: false });
});

test('volledig boekjaar: niets meer te verwachten', () => {
  const txs = [
    maakTx({ amountCents: 100000, bookingDate: '2026-01-15' }),
    maakTx({ amountCents: -50000, bookingDate: '2026-12-10', categoryId: 'telecom' }),
  ];
  const prognose = prognoseVoorBoekjaar(txs, 2026, 1);
  assert.equal(prognose.verstreken, 12);
  assert.equal(prognose.resterend, 0);
  assert.equal(prognose.omzet.verwachtCents, 0);
  assert.equal(prognose.omzet.jaarCents, 100000);
  assert.equal(prognose.kostenTotaal.jaarCents, 50000);
  assert.equal(prognose.resultaat.jaarCents, 50000);
});

test('zonder belastingcategorie is het resultaat gewoon omzet min kosten', () => {
  const txs = [
    maakTx({ amountCents: 100000, bookingDate: '2026-07-01' }),
    maakTx({ amountCents: -40000, bookingDate: '2026-01-01', categoryId: 'horeca' }),
  ];
  const prognose = prognoseVoorBoekjaar(txs, 2026, 1);
  assert.equal(prognose.belastingen.jaarCents, 0);
  assert.equal(prognose.resultaat.gerealiseerdCents, 60000);
});

test('afwijkende startmaand van het boekjaar', () => {
  const txs = [
    maakTx({ amountCents: 120000, bookingDate: '2026-07-15' }),
    maakTx({ amountCents: -12000, bookingDate: '2026-08-15', categoryId: 'telecom' }),
  ];
  const prognose = prognoseVoorBoekjaar(txs, 2026, 7);
  assert.equal(prognose.verstreken, 2);
  assert.equal(prognose.resterend, 10);
  assert.equal(prognose.omzet.perMaandCents, 60000);
  assert.equal(prognose.omzet.jaarCents, 120000 + 60000 * 10);
});
