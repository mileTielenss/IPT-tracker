import test from 'node:test';
import assert from 'node:assert/strict';
import { detecteerVasteKosten, voegKandidatenSamen, mediaan, BANDEN } from '../js/recurring.js';
import { dagenTussen } from '../js/periods.js';
import { maakTx } from './helpers/omgeving.js';

function reeks(datums, bedrag = -6250, over = {}) {
  return datums.map((datum) => maakTx({
    bookingDate: datum, amountCents: bedrag, counterpartyIban: 'BE12345678901234', ...over,
  }));
}

test('dagenTussen en mediaan', () => {
  assert.equal(dagenTussen('2026-06-05', '2026-07-05'), 30);
  assert.equal(mediaan([3, 1, 2]), 2);
  assert.equal(mediaan([1, 2, 3, 4]), 3);
  assert.equal(mediaan([10]), 10);
});

test('maandelijkse reeks wordt herkend, ook bij ongesorteerde invoer', async () => {
  const kandidaten = await detecteerVasteKosten(reeks(['2026-08-05', '2026-06-05', '2026-07-05'],
    -6250, { counterpartyName: 'TELENET BV' }));
  assert.equal(kandidaten.length, 1);
  assert.equal(kandidaten[0].frequentie, 'maandelijks');
  assert.equal(kandidaten[0].mediaanCents, 6250);
  assert.equal(kandidaten[0].maandbedragCents, 6250);
  assert.equal(kandidaten[0].status, 'kandidaat');
  assert.equal(kandidaten[0].naam, 'TELENET BV');
  assert.equal(kandidaten[0].txIds.length, 3);
});

test('randgevallen op de intervalgrenzen (spec 10)', async () => {
  // 28 en 33 dagen: geldig maandelijks
  assert.equal((await detecteerVasteKosten(reeks(['2026-01-01', '2026-01-29', '2026-03-03']))).length, 1);
  // 27 dagen: te kort
  assert.equal((await detecteerVasteKosten(reeks(['2026-01-01', '2026-01-28', '2026-02-28']))).length, 0);
  // 34 dagen: te lang voor maandelijks, te kort voor driemaandelijks
  assert.equal((await detecteerVasteKosten(reeks(['2026-01-01', '2026-02-04', '2026-03-08']))).length, 0);
  // 84 en 98 dagen: geldig driemaandelijks
  const kwartaal = await detecteerVasteKosten(reeks(['2026-01-01', '2026-03-26', '2026-01-01'], -30000));
  assert.equal(kwartaal.length, 1);
  assert.equal(kwartaal[0].frequentie, 'driemaandelijks');
  assert.equal(kwartaal[0].maandbedragCents, 10000);
  // 350 en 380 dagen: geldig jaarlijks
  const jaar = await detecteerVasteKosten(reeks(['2024-01-10', '2024-12-25', '2026-01-09'], -120000));
  assert.equal(jaar.length, 1);
  assert.equal(jaar[0].frequentie, 'jaarlijks');
  assert.equal(jaar[0].maandbedragCents, 10000);
  // 349 dagen: net geen jaarlijks
  assert.equal((await detecteerVasteKosten(reeks(['2024-01-10', '2024-12-24', '2025-12-09'], -120000))).length, 0);
  assert.equal(BANDEN.length, 3);
});

test('bedragen moeten binnen tien procent van de mediaan liggen', async () => {
  const stabiel = [
    ...reeks(['2026-01-05'], -10000), ...reeks(['2026-02-05'], -10900), ...reeks(['2026-03-05'], -9100),
  ];
  assert.equal((await detecteerVasteKosten(stabiel)).length, 1);
  const wild = [
    ...reeks(['2026-01-05'], -10000), ...reeks(['2026-02-05'], -11200), ...reeks(['2026-03-05'], -10000),
  ];
  assert.equal((await detecteerVasteKosten(wild)).length, 0);
});

test('groepering: te klein, interne, eenmalige en inkomsten tellen niet mee', async () => {
  const tweeMaar = reeks(['2026-01-05', '2026-02-05']);
  assert.equal((await detecteerVasteKosten(tweeMaar)).length, 0);
  const metIntern = reeks(['2026-01-05', '2026-02-05', '2026-03-05']);
  metIntern[1] = { ...metIntern[1], isInternal: true };
  assert.equal((await detecteerVasteKosten(metIntern)).length, 0);
  const metEenmalig = reeks(['2026-01-05', '2026-02-05', '2026-03-05']);
  metEenmalig[2] = { ...metEenmalig[2], isOneOff: true };
  assert.equal((await detecteerVasteKosten(metEenmalig)).length, 0);
  const inkomsten = reeks(['2026-01-05', '2026-02-05', '2026-03-05'], 6250);
  assert.equal((await detecteerVasteKosten(inkomsten)).length, 0);
  // zonder tegenpartij én zonder handelaar: geen groep
  const anoniem = reeks(['2026-01-05', '2026-02-05', '2026-03-05'], -6250, { counterpartyIban: '' });
  assert.equal((await detecteerVasteKosten(anoniem)).length, 0);
  // groep op handelaar zonder IBAN werkt wel
  const kaart = reeks(['2026-01-05', '2026-02-05', '2026-03-05'], -6250,
    { counterpartyIban: '', merchant: 'DATS 24' });
  assert.equal((await detecteerVasteKosten(kaart)).length, 1);
  assert.equal((await detecteerVasteKosten(kaart))[0].naam, 'DATS 24');
});

test('voegKandidatenSamen behoudt eerdere statussen', async () => {
  const nieuw = await detecteerVasteKosten(reeks(['2026-06-05', '2026-07-05', '2026-08-05']));
  const samengevoegd = voegKandidatenSamen([{ id: nieuw[0].id, status: 'bevestigd' }], nieuw);
  assert.equal(samengevoegd[0].status, 'bevestigd');
  const vers = voegKandidatenSamen([{ id: 'iets-anders', status: 'verworpen' }], nieuw);
  assert.equal(vers[0].status, 'kandidaat');
});
