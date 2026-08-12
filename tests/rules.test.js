import test from 'node:test';
import assert from 'node:assert/strict';
import { regelMatcht, sorteerRegels, vindRegel, herclassificeer, telHits, voegRegelToe, verplaatsRegel, voorstelRegelVeld } from '../js/rules.js';
import { maakTx, maakRegelObject } from './helpers/omgeving.js';

test('regelMatcht: contains, startsWith en equals, case-insensitief', () => {
  const tx = maakTx({ counterpartyName: 'Telenet BV' });
  assert.ok(regelMatcht(maakRegelObject({ matchType: 'contains', value: 'TELENET' }), tx));
  assert.ok(regelMatcht(maakRegelObject({ matchType: 'startsWith', value: 'tele' }), tx));
  assert.ok(!regelMatcht(maakRegelObject({ matchType: 'startsWith', value: 'net' }), tx));
  assert.ok(regelMatcht(maakRegelObject({ matchType: 'equals', value: 'telenet bv' }), tx));
  assert.ok(!regelMatcht(maakRegelObject({ matchType: 'equals', value: 'telenet' }), tx));
});

test('vindRegel: oplopende priority, eerste actieve match wint', () => {
  const tx = maakTx({ counterpartyName: 'Telenet BV' });
  const laag = maakRegelObject({ id: 'laag', priority: 2, categoryId: 'telecom' });
  const hoog = maakRegelObject({ id: 'hoog', priority: 1, categoryId: 'software' });
  assert.equal(vindRegel([laag, hoog], tx).id, 'hoog');
  const inactief = maakRegelObject({ id: 'uit', priority: 0, active: false });
  assert.equal(vindRegel([laag, inactief], tx).id, 'laag');
  assert.equal(vindRegel([maakRegelObject({ value: 'proximus' })], tx), null);
  assert.deepEqual(sorteerRegels([laag, hoog]).map((r) => r.id), ['hoog', 'laag']);
});

test('herclassificeer categoriseert, respecteert manualCategory en telt wissels', () => {
  const regels = [maakRegelObject({ id: 'r1', value: 'telenet', categoryId: 'telecom' })];
  const raak = maakTx({ counterpartyName: 'TELENET BV' });
  const handmatig = maakTx({ counterpartyName: 'TELENET BV', manualCategory: true, categoryId: 'horeca' });
  const mis = maakTx({ counterpartyName: 'PROXIMUS' });
  const { bijgewerkt, veranderd } = herclassificeer(regels, [raak, handmatig, mis]);
  assert.equal(veranderd, 1);
  assert.equal(bijgewerkt.length, 1);
  assert.equal(bijgewerkt[0].categoryId, 'telecom');
  assert.equal(bijgewerkt[0].ruleId, 'r1');
});

test('herclassificeer zet regelloze transacties terug naar ongecategoriseerd', () => {
  const gecategoriseerd = maakTx({ counterpartyName: 'X', categoryId: 'telecom', ruleId: 'weg' });
  const { bijgewerkt, veranderd } = herclassificeer([], [gecategoriseerd]);
  assert.equal(veranderd, 1);
  assert.equal(bijgewerkt[0].categoryId, null);
  assert.equal(bijgewerkt[0].ruleId, null);
});

test('herclassificeer: klasse-overschrijving van regel en van gebruiker', () => {
  const metKlasse = [maakRegelObject({ id: 'r1', value: 'telenet', costClass: 'discretionair' })];
  const tx = maakTx({ counterpartyName: 'TELENET BV' });
  const { bijgewerkt } = herclassificeer(metKlasse, [tx]);
  assert.equal(bijgewerkt[0].costClass, 'discretionair');
  // handmatige klasse overleeft herclassificatie (spec 4.3)
  const handKlasse = maakTx({ counterpartyName: 'TELENET BV', costClass: 'vast', manualClass: true });
  const resultaat = herclassificeer(metKlasse, [handKlasse]);
  assert.equal(resultaat.bijgewerkt[0].costClass, 'vast');
  // niets te wijzigen: geen kopie
  const alKlaar = herclassificeer(metKlasse, resultaat.bijgewerkt);
  assert.equal(alKlaar.bijgewerkt.length, 0);
});

test('telHits telt transacties per regel', () => {
  const regels = [maakRegelObject({ id: 'r1' }), maakRegelObject({ id: 'r2' })];
  const txs = [maakTx({ ruleId: 'r1' }), maakTx({ ruleId: 'r1' }), maakTx({ ruleId: 'zwerver' }), maakTx()];
  const geteld = telHits(regels, txs);
  assert.equal(geteld[0].hitCount, 2);
  assert.equal(geteld[1].hitCount, 0);
});

test('voegRegelToe: achteraan, maar IBAN-regels vóór tekstregels', () => {
  const tekst = maakRegelObject({ id: 'tekst', field: 'counterpartyName', priority: 1 });
  const metTekst = voegRegelToe([tekst], maakRegelObject({ id: 'iban', field: 'counterpartyIban' }));
  assert.deepEqual(metTekst.map((r) => r.id), ['iban', 'tekst']);
  assert.deepEqual(metTekst.map((r) => r.priority), [1, 2]);
  const nogTekst = voegRegelToe(metTekst, maakRegelObject({ id: 'tekst2', field: 'merchant' }));
  assert.deepEqual(nogTekst.map((r) => r.id), ['iban', 'tekst', 'tekst2']);
  const alleenIban = voegRegelToe([maakRegelObject({ id: 'iban', field: 'counterpartyIban', priority: 1 })],
    maakRegelObject({ id: 'iban2', field: 'counterpartyIban' }));
  assert.deepEqual(alleenIban.map((r) => r.id), ['iban', 'iban2']);
});

test('verplaatsRegel wisselt buren en hernummert', () => {
  const a = maakRegelObject({ id: 'a', priority: 1 });
  const b = maakRegelObject({ id: 'b', priority: 2 });
  assert.deepEqual(verplaatsRegel([a, b], 'b', -1).map((r) => r.id), ['b', 'a']);
  assert.deepEqual(verplaatsRegel([a, b], 'a', 1).map((r) => r.id), ['b', 'a']);
  assert.deepEqual(verplaatsRegel([a, b], 'a', -1).map((r) => r.id), ['a', 'b']);
  assert.deepEqual(verplaatsRegel([a, b], 'b', 1).map((r) => r.id), ['a', 'b']);
});

test('voorstelRegelVeld kiest het best beschikbare veld', () => {
  assert.deepEqual(voorstelRegelVeld(maakTx({ counterpartyIban: 'BE1', merchant: 'M', counterpartyName: 'N' })),
    { field: 'counterpartyIban', value: 'BE1' });
  assert.deepEqual(voorstelRegelVeld(maakTx({ merchant: 'M', counterpartyName: 'N' })),
    { field: 'merchant', value: 'M' });
  assert.deepEqual(voorstelRegelVeld(maakTx({ counterpartyName: 'N' })),
    { field: 'counterpartyName', value: 'N' });
  assert.deepEqual(voorstelRegelVeld(maakTx({ description: ' een hele lange omschrijving die afgekort wordt tot veertig tekens precies genoeg ' })),
    { field: 'description', value: 'een hele lange omschrijving die afgekor' });
});
