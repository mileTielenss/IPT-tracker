import test from 'node:test';
import assert from 'node:assert/strict';
import { verwerkBestand, continuiteitsWaarschuwing, eigenRekeningKandidaten, FORMAAT_FOUT } from '../js/import.js';
import { maakTx, leesFixture } from './helpers/omgeving.js';

test('fixture-import: alle rijen geldig, nul dubbel, nul foutief (acceptatie 1)', async () => {
  const resultaat = await verwerkBestand(leesFixture(), []);
  assert.ok(resultaat.geldig);
  assert.equal(resultaat.nieuwe.length, 21);
  assert.equal(resultaat.dubbel, 0);
  assert.equal(resultaat.foutief, 0);
  assert.equal(resultaat.houderNaam, 'MILE TIELENS');
  assert.equal(resultaat.preview.aantal, 21);
  assert.equal(resultaat.preview.datumVan, '2026-06-05');
  assert.equal(resultaat.preview.datumTot, '2026-08-19');
  assert.equal(resultaat.preview.eersteVijf.length, 5);
});

test('tweede import van hetzelfde bestand: alles dubbel (acceptatie 1)', async () => {
  const eerste = await verwerkBestand(leesFixture(), []);
  const tweede = await verwerkBestand(leesFixture(), eerste.nieuwe.map((tx) => tx.id));
  assert.ok(tweede.geldig);
  assert.equal(tweede.nieuwe.length, 0);
  assert.equal(tweede.dubbel, 21);
  assert.equal(tweede.foutief, 0);
  assert.equal(tweede.preview.datumVan, null);
});

test('dubbels binnen één bestand worden ook geteld', async () => {
  const regels = leesFixture().split('\n');
  const metDubbel = [...regels.slice(0, 2), regels[1], ...regels.slice(2)].join('\n');
  const resultaat = await verwerkBestand(metDubbel, []);
  assert.equal(resultaat.dubbel, 1);
  assert.equal(resultaat.nieuwe.length, 21);
});

test('verkeerde header wordt geweigerd met actiegerichte melding', async () => {
  const resultaat = await verwerkBestand('Datum;Bedrag\n01/01/2026;10,00', []);
  assert.ok(!resultaat.geldig);
  assert.equal(resultaat.foutmelding, FORMAAT_FOUT);
  assert.equal(resultaat.gevondenHeader, 'Datum;Bedrag');
  const leegBestand = await verwerkBestand('', []);
  assert.ok(!leegBestand.geldig);
  assert.equal(leegBestand.gevondenHeader, '(leeg bestand)');
});

test('foutieve rijen worden overgeslagen en geteld, de rest gaat door', async () => {
  const regels = leesFixture().split('\n');
  const kapot = regels[1].replace('-62,50', 'N.B.');
  const teKort = 'a;b;c';
  const inhoud = [regels[0], kapot, teKort, ...regels.slice(2)].join('\n');
  const resultaat = await verwerkBestand(inhoud, []);
  assert.ok(resultaat.geldig);
  assert.equal(resultaat.foutief, 2);
  assert.equal(resultaat.nieuwe.length, 20);
});

test('continuïteitscheck waarschuwt bij een saldosprong', () => {
  const oud = [
    maakTx({ bookingDate: '2026-06-05', amountCents: -6250, balanceCents: 993750 }),
    maakTx({ bookingDate: '2026-06-01', amountCents: -100, balanceCents: 1000000 }),
    maakTx({ bookingDate: '2026-06-03', amountCents: -100, balanceCents: 999900 }),
  ];
  const sluitAan = [
    maakTx({ bookingDate: '2026-06-12', amountCents: -1840, balanceCents: 1294410 }),
    maakTx({ bookingDate: '2026-06-09', amountCents: 302500, balanceCents: 1296250 }),
    maakTx({ bookingDate: '2026-06-13', amountCents: -100, balanceCents: 1294310 }),
  ];
  assert.equal(continuiteitsWaarschuwing(oud, sluitAan), null);
  const metGat = [maakTx({ bookingDate: '2026-07-09', amountCents: 302500, balanceCents: 1236250 })];
  const waarschuwing = continuiteitsWaarschuwing(oud, metGat);
  assert.ok(waarschuwing.includes('2026-06-05'));
  assert.ok(waarschuwing.includes('2026-07-09'));
  assert.ok(waarschuwing.includes('Exporteer die periode bij KBC'));
  // geen bestaande data of andere rekening: geen waarschuwing
  assert.equal(continuiteitsWaarschuwing([], metGat), null);
  const andereRekening = [maakTx({ accountIban: 'BE00', bookingDate: '2026-01-01', balanceCents: 1 })];
  assert.equal(continuiteitsWaarschuwing(andereRekening, metGat), null);
  // alleen oudere rijen in de nieuwe import: geen check mogelijk
  const ouder = [maakTx({ bookingDate: '2026-01-01', amountCents: -1, balanceCents: 1 })];
  assert.equal(continuiteitsWaarschuwing(oud, ouder), null);
});

test('eigenRekeningKandidaten matcht op achternaam van de rekeninghouder', () => {
  const txs = [
    maakTx({ counterpartyIban: 'BE77', counterpartyName: 'TIELENS MILE' }),
    maakTx({ counterpartyIban: 'BE77', counterpartyName: 'TIELENS MILE' }),
    maakTx({ counterpartyIban: 'BE88', counterpartyName: 'IMMO VERHAEGHE' }),
    maakTx({ counterpartyIban: '', counterpartyName: 'TIELENS MILE' }),
    maakTx({ counterpartyIban: 'BE99', counterpartyName: 'mevrouw tielens-peeters' }),
  ];
  const kandidaten = eigenRekeningKandidaten(txs, 'MILE TIELENS', new Set());
  assert.deepEqual(kandidaten.map((k) => k.iban), ['BE77', 'BE99']);
  // reeds bekende IBAN's worden niet opnieuw voorgesteld
  assert.deepEqual(eigenRekeningKandidaten(txs, 'MILE TIELENS', new Set(['BE77', 'BE99'])), []);
  // lege houdernaam: geen kandidaten
  assert.deepEqual(eigenRekeningKandidaten(txs, '', new Set()), []);
});
