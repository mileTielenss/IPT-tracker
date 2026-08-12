import test from 'node:test';
import assert from 'node:assert/strict';
import { zetDocument } from '../js/dom.js';
import { maakMeldingen, metRetry } from '../js/meldingen.js';
import { maakFakeDocument, zoekKnop, spoel } from './helpers/fakedom.js';

function opzet() {
  const doc = maakFakeDocument();
  zetDocument(doc);
  const banners = doc.getElementById('banners');
  const toasts = doc.getElementById('meldingen');
  return { doc, banners, toasts, meldingen: maakMeldingen(banners, toasts) };
}

test('banners vervangen elkaar per id en zijn verwijderbaar', () => {
  const { banners, meldingen, doc } = opzet();
  const eerste = doc.createElement('div');
  const tweede = doc.createElement('div');
  meldingen.toonBanner('x', eerste);
  meldingen.toonBanner('x', tweede);
  assert.equal(banners.children.length, 1);
  assert.equal(banners.children[0], tweede);
  meldingen.verwijderBanner('x');
  meldingen.verwijderBanner('x');
  assert.equal(banners.children.length, 0);
});

test('undo-toast: knop draait actie terug en toast verdwijnt vanzelf', async () => {
  const { toasts, meldingen } = opzet();
  let teruggedraaid = 0;
  meldingen.toonUndo('Gedaan.', () => teruggedraaid++);
  assert.equal(toasts.children.length, 1);
  await zoekKnop(toasts, 'Ongedaan maken').click();
  assert.equal(teruggedraaid, 1);
  assert.equal(toasts.children.length, 0);
  // automatisch sluiten na de ingestelde tijd
  meldingen.toonUndo('Weer.', () => teruggedraaid++, 1);
  await spoel();
  assert.equal(toasts.children.length, 0);
  assert.equal(teruggedraaid, 1);
});

test('toonInfo verdwijnt vanzelf', async () => {
  const { toasts, meldingen } = opzet();
  meldingen.toonInfo('Klaar.', 1);
  assert.equal(toasts.children.length, 1);
  await spoel();
  assert.equal(toasts.children.length, 0);
});

test('metRetry toont rode balk en herhaalt tot de actie slaagt', async () => {
  const { toasts, meldingen } = opzet();
  let pogingen = 0;
  const belofte = metRetry(async () => {
    pogingen++;
    if (pogingen < 3) throw new Error('opslag vol');
    return 'gelukt';
  }, meldingen);
  await spoel();
  assert.equal(toasts.children.length, 1);
  assert.ok(toasts.children[0].textContent.includes('Opslaan is mislukt'));
  await zoekKnop(toasts, 'Opnieuw proberen').click();
  await spoel();
  await zoekKnop(toasts, 'Opnieuw proberen').click();
  assert.equal(await belofte, 'gelukt');
  assert.equal(pogingen, 3);
  assert.equal(toasts.children.length, 0);
});
