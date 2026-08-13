import test from 'node:test';
import assert from 'node:assert/strict';
import { zetDocument } from '../js/dom.js';
import { maakMeldingen } from '../js/meldingen.js';
import { maakFakeDocument, spoel } from './helpers/fakedom.js';

function opzet() {
  const doc = maakFakeDocument();
  zetDocument(doc);
  const banners = doc.getElementById('banners');
  const toasts = doc.getElementById('meldingen');
  return { doc, banners, toasts, meldingen: maakMeldingen(banners, toasts) };
}

test('banners vervangen elkaar per id en zijn verwijderbaar', () => {
  const { doc, banners, meldingen } = opzet();
  const eerste = doc.createElement('div');
  eerste.textContent = 'eerste';
  const tweede = doc.createElement('div');
  tweede.textContent = 'tweede';
  meldingen.toonBanner('update', eerste);
  assert.equal(banners.children.length, 1);
  // dezelfde id opnieuw: de oude verdwijnt, er staat er nooit twee
  meldingen.toonBanner('update', tweede);
  assert.equal(banners.children.length, 1);
  assert.equal(banners.textContent, 'tweede');
  meldingen.verwijderBanner('update');
  assert.equal(banners.children.length, 0);
  // nogmaals verwijderen is een no-op
  meldingen.verwijderBanner('update');
  meldingen.verwijderBanner('bestaat-niet');
  assert.equal(banners.children.length, 0);
});

test('infomelding verdwijnt vanzelf', async () => {
  const { toasts, meldingen } = opzet();
  meldingen.toonInfo('Koersen bijgewerkt.', 1);
  assert.equal(toasts.children.length, 1);
  assert.ok(toasts.textContent.includes('bijgewerkt'));
  await spoel();
  assert.equal(toasts.children.length, 0);
});
