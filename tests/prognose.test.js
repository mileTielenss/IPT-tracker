import test from 'node:test';
import assert from 'node:assert/strict';
import { prognoseVoorBoekjaar, vergelijkMetDoel } from '../js/prognose.js';
import { maakTx } from './helpers/omgeving.js';

// Data van 01/01 tot 10/01/2026: 10 dagen, 355 resterende dagen tot 31/12.
function eersteTienDagen() {
  return [
    maakTx({ amountCents: -5000, bookingDate: '2026-01-01', categoryId: 'telecom' }),
    maakTx({ amountCents: 10000, bookingDate: '2026-01-03', categoryId: 'omzet-consulting' }),
    maakTx({ amountCents: 5000, bookingDate: '2026-01-04' }),
    maakTx({ amountCents: 20000, bookingDate: '2026-01-05', categoryId: 'omzet-epc' }),
    maakTx({ amountCents: -1000, bookingDate: '2026-01-10', categoryId: 'belastingen' }),
    // intern en eenmalig tellen nooit mee
    maakTx({ amountCents: -999999, bookingDate: '2026-01-06', isInternal: true }),
    maakTx({ amountCents: 888888, bookingDate: '2026-01-07', isOneOff: true }),
  ];
}

test('prognose rekent letterlijk van de eerste tot de laatste datum met data', () => {
  const prognose = prognoseVoorBoekjaar(eersteTienDagen(), 2026, 1);
  assert.ok(prognose.heeftData);
  assert.equal(prognose.eersteDatum, '2026-01-01');
  assert.equal(prognose.laatsteDatum, '2026-01-10');
  assert.equal(prognose.eindDatum, '2026-12-31');
  assert.equal(prognose.dagen, 10);
  assert.equal(prognose.resterendeDagen, 355);
  // omzet totaal: 350 gerealiseerd, 12.425 verwacht, 12.775 jaar
  assert.equal(prognose.omzetTotaal.gerealiseerdCents, 35000);
  assert.equal(prognose.omzetTotaal.verwachtCents, 1242500);
  assert.equal(prognose.omzetTotaal.jaarCents, 1277500);
});

test('omzet wordt per categorie apart doorgerekend', () => {
  const prognose = prognoseVoorBoekjaar(eersteTienDagen(), 2026, 1);
  assert.deepEqual(prognose.omzet.map((rij) => rij.categoryId),
    ['omzet-epc', 'omzet-consulting', 'ongecategoriseerd']);
  const [epc, consulting, ongecat] = prognose.omzet;
  assert.equal(epc.gerealiseerdCents, 20000);
  assert.equal(epc.jaarCents, 730000);
  assert.equal(consulting.jaarCents, 365000);
  assert.equal(consulting.perMaandCents, 30440);
  assert.equal(ongecat.jaarCents, 182500);
});

test('kosten per categorie en resultaat vóór belastingen', () => {
  const prognose = prognoseVoorBoekjaar(eersteTienDagen(), 2026, 1);
  assert.deepEqual(prognose.kosten.map((rij) => rij.categoryId), ['telecom', 'belastingen']);
  assert.equal(prognose.kosten[0].jaarCents, 182500);
  assert.equal(prognose.belastingen.jaarCents, 36500);
  assert.equal(prognose.kostenTotaal.gerealiseerdCents, 6000);
  assert.equal(prognose.kostenTotaal.jaarCents, 219000);
  assert.equal(prognose.resultaat.jaarCents, 1277500 - (219000 - 36500));
  assert.equal(prognose.resultaat.gerealiseerdCents, 35000 - (6000 - 1000));
});

test('vergelijkMetDoel slaat het jaardoel pro rata om over de dataperiode', () => {
  const prognose = prognoseVoorBoekjaar(eersteTienDagen(), 2026, 1);
  assert.equal(prognose.totaalDagen, 365);
  // jaardoel 3.650: 10 euro per dag, dus 100 euro doel voor 10 dagen
  const doel = vergelijkMetDoel(prognose, 365000);
  assert.equal(doel.doelJaarCents, 365000);
  assert.equal(doel.doelPeriodeCents, 10000);
  // 350 ontvangen tegenover 100 doel: 250 voor op schema
  assert.equal(doel.verschilPeriodeCents, 25000);
  assert.equal(doel.verschilJaarCents, 1277500 - 365000);
  // hoog doel: achterstand wordt negatief
  const hoog = vergelijkMetDoel(prognose, 36500000);
  assert.equal(hoog.doelPeriodeCents, 1000000);
  assert.equal(hoog.verschilPeriodeCents, 35000 - 1000000);
});

test('zonder telbare transacties is er geen prognose', () => {
  assert.deepEqual(prognoseVoorBoekjaar([], 2026, 1), { heeftData: false });
  const alleenIntern = [maakTx({ bookingDate: '2026-07-01', isInternal: true })];
  assert.deepEqual(prognoseVoorBoekjaar(alleenIntern, 2026, 1), { heeftData: false });
  const buitenBoekjaar = [maakTx({ bookingDate: '2025-12-31' })];
  assert.deepEqual(prognoseVoorBoekjaar(buitenBoekjaar, 2026, 1), { heeftData: false });
});

test('data tot en met de laatste dag van het boekjaar: niets meer te verwachten', () => {
  const txs = [
    maakTx({ amountCents: 100000, bookingDate: '2026-01-15' }),
    maakTx({ amountCents: -50000, bookingDate: '2026-12-31', categoryId: 'telecom' }),
  ];
  const prognose = prognoseVoorBoekjaar(txs, 2026, 1);
  assert.equal(prognose.resterendeDagen, 0);
  assert.equal(prognose.omzetTotaal.verwachtCents, 0);
  assert.equal(prognose.omzetTotaal.jaarCents, 100000);
  assert.equal(prognose.resultaat.jaarCents, 50000);
});

test('zonder belastingcategorie is het resultaat gewoon omzet min kosten', () => {
  const txs = [
    maakTx({ amountCents: 100000, bookingDate: '2026-07-01' }),
    maakTx({ amountCents: -40000, bookingDate: '2026-07-01', categoryId: 'horeca' }),
  ];
  const prognose = prognoseVoorBoekjaar(txs, 2026, 1);
  assert.equal(prognose.dagen, 1);
  assert.equal(prognose.belastingen.jaarCents, 0);
  assert.equal(prognose.resultaat.gerealiseerdCents, 60000);
});

test('afwijkende startmaand: doorrekenen tot het einde van dat boekjaar', () => {
  const txs = [
    maakTx({ amountCents: 120000, bookingDate: '2026-07-15' }),
    maakTx({ amountCents: -12000, bookingDate: '2026-08-15', categoryId: 'telecom' }),
  ];
  const prognose = prognoseVoorBoekjaar(txs, 2026, 7);
  assert.equal(prognose.eindDatum, '2027-06-30');
  assert.equal(prognose.dagen, 32);
  assert.equal(prognose.resterendeDagen, 319);
  assert.equal(prognose.omzetTotaal.jaarCents, 120000 + Math.round((120000 * 319) / 32));
});
