import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPrognose } from '../js/views/prognose.js';
import { bewaarAlle, bewaarInstelling } from '../js/db.js';
import { maakCtx, maakTx, scherm } from './helpers/omgeving.js';
import { zoekAlle } from './helpers/fakedom.js';

test('prognosescherm toont omzet, kosten en resultaat vóór belastingen', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', [
    maakTx({ amountCents: 600000, bookingDate: '2026-07-07', categoryId: 'omzet-consulting' }),
    maakTx({ amountCents: -30000, bookingDate: '2026-07-05', categoryId: 'telecom' }),
    maakTx({ amountCents: -90000, bookingDate: '2026-07-03', categoryId: 'belastingen' }),
    maakTx({ amountCents: -20000, bookingDate: '2026-08-05', categoryId: 'telecom' }),
  ]);
  await renderPrognose(ctx, scherm(ctx));
  const tekst = scherm(ctx).textContent;
  assert.ok(tekst.includes('Boekjaar 2026'));
  assert.ok(tekst.includes('2 maanden echte cijfers'));
  assert.ok(tekst.includes('juli 2026 – augustus 2026'));
  assert.ok(tekst.includes('4 resterende maanden'));
  assert.ok(tekst.includes('Verwachte omzet'));
  assert.ok(tekst.includes('Resultaat vóór belastingen'));
  assert.ok(tekst.includes('telt niet mee in het resultaat'));
  assert.ok(tekst.includes('Telecom en abonnementen'));
  // omzet: 6000 over 2 maanden -> 3000/maand, 12000 verwacht, 18000 jaar
  assert.ok(tekst.includes('18.000,00'));
  // kostenbalken: eerste rij is de grootste (belastingen)
  const rijen = zoekAlle(scherm(ctx), (e) => e.className === 'kosten-rij');
  assert.equal(rijen.length, 2);
  assert.ok(rijen[0].textContent.includes('Belastingen en btw'));
  const balken = zoekAlle(scherm(ctx), (e) => e.className === 'kosten-balk');
  assert.ok(balken[0].getAttribute('style').includes('width:100%'));
});

test('lege prognose verwijst naar het opladen van een export', async () => {
  const ctx = await maakCtx();
  await renderPrognose(ctx, scherm(ctx));
  assert.ok(scherm(ctx).textContent.includes('Laad eerst een KBC-export op'));
});

test('prognose met alleen omzet en één maand data', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', [
    maakTx({ amountCents: 500000, bookingDate: '2026-07-07', categoryId: 'omzet-consulting' }),
  ]);
  await renderPrognose(ctx, scherm(ctx));
  const tekst = scherm(ctx).textContent;
  assert.ok(tekst.includes('1 maand echte cijfers'));
  assert.equal(zoekAlle(scherm(ctx), (e) => e.className === 'kosten-rij').length, 0);
});

test('negatief resultaat kleurt de resultaatkaart rood', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', [
    maakTx({ amountCents: 10000, bookingDate: '2026-07-07' }),
    maakTx({ amountCents: -80000, bookingDate: '2026-07-05', categoryId: 'telecom' }),
  ]);
  await renderPrognose(ctx, scherm(ctx));
  const kaarten = zoekAlle(scherm(ctx), (e) => e.className.includes('hero-kaart'));
  assert.equal(kaarten.length, 3);
  assert.ok(kaarten[2].className.includes('negatief'));
});

test('volledig boekjaar meldt dat het compleet is en respecteert de startmaand', async () => {
  const ctx = await maakCtx();
  await bewaarInstelling(ctx.db, 'boekjaarStartMaand', 7);
  await bewaarAlle(ctx.db, 'transactions', [
    maakTx({ amountCents: 100000, bookingDate: '2026-07-15' }),
    maakTx({ amountCents: -5000, bookingDate: '2027-06-15', categoryId: 'telecom' }),
  ]);
  await renderPrognose(ctx, scherm(ctx));
  const tekst = scherm(ctx).textContent;
  assert.ok(tekst.includes('Boekjaar 2026–2027'));
  assert.ok(tekst.includes('het boekjaar is volledig'));
  assert.ok(tekst.includes('12 maanden echte cijfers'));
});
