import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../js/csv.js';
import { valideerHeader, parseBedrag, parseDatumBE, extraheerHandelaar, sha256Hex, normaliseerRij, zonderSlotkolom, KOLOMMEN } from '../js/normalize.js';
import { leesFixture } from './helpers/omgeving.js';

test('valideerHeader is case-insensitief en trimt whitespace', () => {
  assert.ok(valideerHeader(KOLOMMEN));
  assert.ok(valideerHeader(KOLOMMEN.map((k) => ` ${k.toUpperCase()} `)));
  assert.ok(valideerHeader([...KOLOMMEN, '']));
  assert.ok(!valideerHeader(KOLOMMEN.slice(0, 17)));
  assert.ok(!valideerHeader(['fout', ...KOLOMMEN.slice(1)]));
});

test('zonderSlotkolom knipt alleen de lege 19e kolom weg', () => {
  assert.equal(zonderSlotkolom([...KOLOMMEN, '']).length, 18);
  assert.equal(zonderSlotkolom([...KOLOMMEN, 'x']).length, 19);
  assert.equal(zonderSlotkolom(KOLOMMEN).length, 18);
});

test('parseBedrag: decimale komma naar integer-centen', () => {
  assert.equal(parseBedrag('1234,56'), 123456);
  assert.equal(parseBedrag('-62,50'), -6250);
  assert.equal(parseBedrag('-62,5'), -6250);
  assert.equal(parseBedrag('7'), 700);
  assert.equal(parseBedrag('0,01'), 1);
  assert.equal(parseBedrag('1.234,56'), null);
  assert.equal(parseBedrag('12,345'), null);
  assert.equal(parseBedrag('N.B.'), null);
  assert.equal(parseBedrag(''), null);
});

test('parseDatumBE valideert echte kalenderdatums', () => {
  assert.equal(parseDatumBE('05/06/2026'), '2026-06-05');
  assert.equal(parseDatumBE('29/02/2024'), '2024-02-29');
  assert.equal(parseDatumBE('29/02/2026'), null);
  assert.equal(parseDatumBE('31/04/2026'), null);
  assert.equal(parseDatumBE('00/05/2026'), null);
  assert.equal(parseDatumBE('01/13/2026'), null);
  assert.equal(parseDatumBE('2026-06-05'), null);
});

test('extraheerHandelaar volgt spec 3.4 inclusief het voorbeeld', () => {
  assert.equal(extraheerHandelaar(
    'BETALING VIA DEBIT MASTERCARD 13-07-2026 OM 13.14 UUR LE MIRANTE BE1000 BRUXELLES MET APPLE PAY'),
  'LE MIRANTE');
  assert.equal(extraheerHandelaar(
    'BETALING VIA BANCONTACT 12-06-2026 OM 12.31 UUR DELHAIZE JAMBES MET KAART 6703 12XX XXXX 1234 5'),
  'DELHAIZE JAMBES');
  assert.equal(extraheerHandelaar('AANREKENING KBC-PLUSREKENING'), '');
  assert.equal(extraheerHandelaar('BETALING VIA BANCONTACT ZONDER TIJDSTIP'), '');
  assert.equal(extraheerHandelaar('BETALING VIA BANCONTACT OM 10.00 UUR WINKEL ZONDER EINDE'), '');
});

test('sha256Hex is deterministisch en hex', async () => {
  const hash = await sha256Hex('abc');
  assert.equal(hash, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('normaliseerRij bouwt het interne model op uit de fixture', async () => {
  const rijen = parseCsv(leesFixture());
  const telenet = await normaliseerRij(rijen[1]);
  assert.equal(telenet.accountIban, 'BE68539007547034');
  assert.equal(telenet.bookingDate, '2026-06-05');
  assert.equal(telenet.valueDate, '2026-06-05');
  assert.equal(telenet.amountCents, -6250);
  assert.equal(telenet.balanceCents, 993750);
  assert.equal(telenet.direction, 'uit');
  assert.equal(telenet.counterpartyIban, 'BE12345678901234');
  assert.equal(telenet.counterpartyName, 'TELENET BV');
  assert.equal(telenet.merchant, '');
  assert.equal(telenet.categoryId, null);
  assert.equal(telenet.isOneOff, false);
  assert.equal(telenet.freeRef, 'klantnummer 0123456');
  const inkomst = await normaliseerRij(rijen[2]);
  assert.equal(inkomst.direction, 'in');
  assert.equal(inkomst.amountCents, 302500);
  const kaart = await normaliseerRij(rijen[3]);
  assert.equal(kaart.merchant, 'DELHAIZE JAMBES');
  const mastercard = await normaliseerRij(rijen[12]);
  assert.equal(mastercard.merchant, 'ANTHROPIC');
});

test('normaliseerRij weigert ongeldige datum, bedrag of saldo', async () => {
  const rijen = parseCsv(leesFixture());
  const kapotDatum = [...rijen[1]];
  kapotDatum[5] = '31/02/2026';
  assert.equal(await normaliseerRij(kapotDatum), null);
  const kapotBedrag = [...rijen[1]];
  kapotBedrag[8] = 'N.B.';
  assert.equal(await normaliseerRij(kapotBedrag), null);
  const kapotSaldo = [...rijen[1]];
  kapotSaldo[9] = 'x';
  assert.equal(await normaliseerRij(kapotSaldo), null);
});

test('normaliseerRij valt voor valutadatum terug op boekdatum', async () => {
  const rijen = parseCsv(leesFixture());
  const zonderValuta = [...rijen[1]];
  zonderValuta[7] = '';
  const tx = await normaliseerRij(zonderValuta);
  assert.equal(tx.valueDate, tx.bookingDate);
});

test('id-hash is stabiel over de bepalende velden', async () => {
  const rijen = parseCsv(leesFixture());
  const a = await normaliseerRij(rijen[1]);
  const b = await normaliseerRij(rijen[1]);
  assert.equal(a.id, b.id);
  const ander = [...rijen[1]];
  ander[9] = '9937,51';
  const c = await normaliseerRij(ander);
  assert.notEqual(a.id, c.id);
});
