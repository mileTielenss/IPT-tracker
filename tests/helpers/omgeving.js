// Testomgeving: echte app-modules op een fake window, document en IndexedDB.
import { readFileSync } from 'node:fs';
import { maakFakeVenster } from './fakedom.js';
import { openDb, bewaarAlle } from '../../js/db.js';
import { zetDocument } from '../../js/dom.js';
import { maakMeldingen, metRetry } from '../../js/meldingen.js';
import { standaardCategorieen } from '../../js/categories.js';

export const FIXTURE_PAD = new URL('../../fixtures/kbc-export.csv', import.meta.url);

export function leesFixture() {
  return readFileSync(FIXTURE_PAD, 'utf-8');
}

let txTeller = 0;

// Vlot een transactie in het interne model bouwen; direction volgt het bedrag.
export function maakTx(over = {}) {
  txTeller++;
  const amountCents = over.amountCents ?? -1000;
  return {
    id: `tx-${txTeller}`,
    accountIban: 'BE68539007547034',
    bookingDate: '2026-07-01',
    valueDate: '2026-07-01',
    amountCents,
    balanceCents: 0,
    direction: amountCents > 0 ? 'in' : 'uit',
    counterpartyIban: '',
    counterpartyName: '',
    description: '',
    merchant: '',
    structuredRef: '',
    freeRef: '',
    categoryId: null,
    costClass: null,
    manualClass: false,
    isInternal: false,
    isOneOff: false,
    manualCategory: false,
    ruleId: null,
    ...over,
  };
}

export function maakRegelObject(over = {}) {
  return {
    id: `regel-${++txTeller}`,
    field: 'counterpartyName',
    matchType: 'contains',
    value: 'telenet',
    categoryId: 'telecom',
    costClass: null,
    priority: 1,
    active: true,
    hitCount: 0,
    ...over,
  };
}

// Volledige ctx zoals app.js die bouwt, maar met telbare navigatie/herlaad.
export async function maakCtx(opties = {}) {
  const venster = maakFakeVenster(opties);
  zetDocument(venster.document);
  const db = await openDb(venster.indexedDB);
  await bewaarAlle(db, 'categories', standaardCategorieen());
  const meldingen = maakMeldingen(
    venster.document.getElementById('banners'),
    venster.document.getElementById('meldingen'),
  );
  const ctx = {
    venster,
    doc: venster.document,
    db,
    meldingen,
    bevestig: (tekst) => venster.confirm(tekst),
    bewaar: (actie) => metRetry(actie, meldingen),
    genavigeerd: [],
    navigeer(hash) {
      venster.location.hash = hash;
      ctx.genavigeerd.push(hash);
    },
    herlaadTeller: 0,
    herlaad() {
      ctx.herlaadTeller++;
    },
    dashboardStand: { modus: 'maand', maand: null, boekjaar: null },
  };
  return ctx;
}

export function scherm(ctx) {
  return ctx.doc.getElementById('scherm');
}
