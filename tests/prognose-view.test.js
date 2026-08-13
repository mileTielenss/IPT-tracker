import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPrognose } from '../js/views/prognose.js';
import { bewaarAlle, bewaarInstelling, haalInstelling } from '../js/db.js';
import { maakCtx, maakTx, scherm } from './helpers/omgeving.js';
import { zoekAlle, zoekTag, spoel } from './helpers/fakedom.js';

test('prognosescherm toont omzet en kosten per categorie op dagbasis', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', [
    maakTx({ amountCents: 600000, bookingDate: '2026-07-07', categoryId: 'omzet-consulting' }),
    maakTx({ amountCents: 100000, bookingDate: '2026-07-20', categoryId: 'omzet-epc' }),
    maakTx({ amountCents: -30000, bookingDate: '2026-07-05', categoryId: 'telecom' }),
    maakTx({ amountCents: -90000, bookingDate: '2026-07-03', categoryId: 'belastingen' }),
    maakTx({ amountCents: -20000, bookingDate: '2026-08-05', categoryId: 'telecom' }),
  ]);
  await renderPrognose(ctx, scherm(ctx));
  const tekst = scherm(ctx).textContent;
  assert.ok(tekst.includes('Boekjaar 2026'));
  assert.ok(tekst.includes('cijfers van 03/07/2026 tot 05/08/2026'));
  assert.ok(tekst.includes('(34 dagen)'));
  assert.ok(tekst.includes('148 resterende dagen tot 31/12/2026'));
  assert.ok(tekst.includes('Verwachte omzet per categorie'));
  assert.ok(tekst.includes('Omzet consulting'));
  assert.ok(tekst.includes('Omzet EPC'));
  assert.ok(tekst.includes('telt niet mee in het resultaat'));
  assert.ok(tekst.includes('/maand'));
  // omzet en kosten elk gesorteerd op verwacht jaartotaal
  const rijen = zoekAlle(scherm(ctx), (e) => e.className === 'kosten-rij');
  assert.equal(rijen.length, 4);
  assert.ok(rijen[0].textContent.includes('Omzet consulting'));
  assert.ok(rijen[2].textContent.includes('Belastingen en btw'));
  // grootste rij per sectie krijgt de volle balkbreedte
  const omzetBalken = zoekAlle(scherm(ctx), (e) => e.className === 'kosten-balk omzet');
  assert.equal(omzetBalken.length, 2);
  assert.ok(omzetBalken[0].getAttribute('style').includes('width:100%'));
  const kostenBalken = zoekAlle(scherm(ctx), (e) => e.className === 'kosten-balk');
  assert.ok(kostenBalken[0].getAttribute('style').includes('width:100%'));
});

test('lege prognose verwijst naar het opladen van een export', async () => {
  const ctx = await maakCtx();
  await renderPrognose(ctx, scherm(ctx));
  assert.ok(scherm(ctx).textContent.includes('Laad eerst een KBC-export op'));
});

test('alleen omzet op één dag: enkelvoud en lege kostensectie', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', [
    maakTx({ amountCents: 500000, bookingDate: '2026-07-07', categoryId: 'omzet-consulting' }),
  ]);
  await renderPrognose(ctx, scherm(ctx));
  const tekst = scherm(ctx).textContent;
  assert.ok(tekst.includes('(1 dag)'));
  assert.ok(tekst.includes('Nog geen uitgaven in dit boekjaar.'));
  assert.equal(zoekAlle(scherm(ctx), (e) => e.className === 'kosten-balk').length, 0);
});

test('alleen kosten: lege omzetsectie en rode resultaatkaart', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', [
    maakTx({ amountCents: -80000, bookingDate: '2026-07-05', categoryId: 'telecom' }),
  ]);
  await renderPrognose(ctx, scherm(ctx));
  assert.ok(scherm(ctx).textContent.includes('Nog geen ontvangsten in dit boekjaar.'));
  const kaarten = zoekAlle(scherm(ctx), (e) => e.className.includes('hero-kaart'));
  assert.equal(kaarten.length, 3);
  assert.ok(kaarten[2].className.includes('negatief'));
});

test('eigen omzetverwachting op dagtarief wint van de bankcijfers', async () => {
  const ctx = await maakCtx();
  await bewaarAlle(ctx.db, 'transactions', [
    maakTx({ amountCents: 100000, bookingDate: '2026-07-07', categoryId: 'omzet-consulting' }),
    maakTx({ amountCents: -30000, bookingDate: '2026-07-05', categoryId: 'telecom' }),
  ]);
  await renderPrognose(ctx, scherm(ctx));
  // invullen van dagtarief en werkdagen bewaart en herlaadt
  const invoeren = zoekTag(scherm(ctx), 'input');
  invoeren[0].value = '620';
  await invoeren[0].dispatch('change');
  await spoel();
  invoeren[1].value = '220';
  await invoeren[1].dispatch('change');
  await spoel();
  assert.equal(await haalInstelling(ctx.db, 'dagtariefCents', 0), 62000);
  assert.equal(await haalInstelling(ctx.db, 'werkdagenPerJaar', 0), 220);
  assert.equal(ctx.herlaadTeller, 2);
  // opnieuw renderen: heldenkaart toont 620 x 220 = 136.400
  scherm(ctx).textContent = '';
  await renderPrognose(ctx, scherm(ctx));
  const tekst = scherm(ctx).textContent;
  assert.ok(tekst.includes('136.400,00'));
  assert.ok(tekst.includes('jouw dagtarief × werkdagen'));
  assert.ok(tekst.includes('620,00'));
  assert.ok(tekst.includes('× 220 dagen'));
  // resultaat gebruikt de eigen omzet: 136.400 - verwachte kosten
  const kaarten = zoekAlle(scherm(ctx), (e) => e.className.includes('hero-kaart'));
  assert.ok(!kaarten[2].className.includes('negatief'));
  // ongeldig of leeg maken: terug naar bankcijfers
  const invoeren2 = zoekTag(scherm(ctx), 'input');
  invoeren2[0].value = 'abc';
  await invoeren2[0].dispatch('change');
  await spoel();
  assert.equal(await haalInstelling(ctx.db, 'dagtariefCents', 0), 0);
  scherm(ctx).textContent = '';
  await renderPrognose(ctx, scherm(ctx));
  assert.ok(scherm(ctx).textContent.includes('al ontvangen'));
  assert.ok(!scherm(ctx).textContent.includes('jouw dagtarief'));
});

test('volledig boekjaar meldt dat het compleet is en respecteert de startmaand', async () => {
  const ctx = await maakCtx();
  await bewaarInstelling(ctx.db, 'boekjaarStartMaand', 7);
  await bewaarAlle(ctx.db, 'transactions', [
    maakTx({ amountCents: 100000, bookingDate: '2026-07-15' }),
    maakTx({ amountCents: -5000, bookingDate: '2027-06-30', categoryId: 'telecom' }),
  ]);
  await renderPrognose(ctx, scherm(ctx));
  const tekst = scherm(ctx).textContent;
  assert.ok(tekst.includes('Boekjaar 2026–2027'));
  assert.ok(tekst.includes('het boekjaar is volledig'));
});
