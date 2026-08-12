import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, controleerUpdate, controleerBackupHerinnering } from '../js/app.js';
import { alles, bewaar, bewaarAlle, haalInstelling, bewaarInstelling } from '../js/db.js';
import { maakFakeVenster, zoekKnop, zoekTag, spoel } from './helpers/fakedom.js';
import { maakCtx, maakTx } from './helpers/omgeving.js';

const SW_TEKST = "const VERSIE = '1.0.0';";

test('startApp zaait categorieën, registreert sw en rendert het dashboard', async () => {
  const venster = maakFakeVenster({ fetchTekst: SW_TEKST });
  const ctx = await startApp(venster);
  await spoel();
  assert.equal((await alles(ctx.db, 'categories')).length, 17);
  assert.equal(venster.swGeregistreerd, 'sw.js');
  assert.equal(await haalInstelling(ctx.db, 'actieveVersie', null), '1.0.0');
  const navigatie = venster.document.getElementById('navigatie');
  assert.equal(zoekTag(navigatie, 'a').length, 5);
  assert.ok(navigatie.textContent.includes('Prognose'));
  assert.ok(venster.document.getElementById('scherm').textContent.includes('CSV opladen'));
  // navigeren via hash
  venster.location.hash = '#/instellingen';
  await venster.emit('hashchange');
  await spoel();
  assert.ok(venster.document.getElementById('scherm').textContent.includes('Instellingen'));
  // herlaad rendert dezelfde route opnieuw
  await ctx.herlaad();
  await spoel();
  assert.ok(venster.document.getElementById('scherm').textContent.includes('Boekjaar'));
  // tweede start: categorieën niet opnieuw zaaien
  const ctx2 = await startApp(venster);
  assert.equal((await alles(ctx2.db, 'categories')).length, 17);
  // ctx-hulpfuncties uit de app-shell
  ctx.navigeer('#/regels');
  assert.equal(venster.location.hash, '#/regels');
  assert.equal(ctx.bevestig('Zeker?'), true);
  assert.equal(venster.confirmTeksten.at(-1), 'Zeker?');
  assert.equal(await ctx.bewaar(async () => 'ok'), 'ok');
});

test('startApp vult ontbrekende standaardcategorieën aan zonder bestaande te overschrijven', async () => {
  const venster = maakFakeVenster({ fetchTekst: SW_TEKST });
  const ctx = await startApp(venster);
  await spoel();
  // simuleer een oudere installatie: één standaardcategorie ontbreekt,
  // een andere is door de gebruiker hernoemd
  const { verwijder, bewaar } = await import('../js/db.js');
  await verwijder(ctx.db, 'categories', 'ipt-pensioen');
  const hernoemd = { id: 'horeca', name: 'Resto en café', type: 'uit', costClass: 'discretionair', color: '#8e24aa' };
  await bewaar(ctx.db, 'categories', hernoemd);
  const ctx2 = await startApp(venster);
  const categorieen = await alles(ctx2.db, 'categories');
  assert.equal(categorieen.length, 17);
  assert.ok(categorieen.some((c) => c.id === 'ipt-pensioen' && c.name === 'IPT en pensioen'));
  assert.equal(categorieen.find((c) => c.id === 'horeca').name, 'Resto en café');
});

test('startApp zonder storage- en serviceworker-API werkt gewoon', async () => {
  const venster = maakFakeVenster({ fetchTekst: SW_TEKST, zonderStorage: true, zonderServiceWorker: true });
  const ctx = await startApp(venster);
  assert.equal(venster.swGeregistreerd, null);
  assert.ok(ctx !== null);
});

test('updatecheck: offline en onherkenbare sw.js doen niets', async () => {
  const ctx = await maakCtx({ fetchFout: true });
  await controleerUpdate(ctx);
  assert.equal(ctx.doc.getElementById('banners').children.length, 0);
  const ctx2 = await maakCtx({ fetchTekst: 'iets zonder versie' });
  await controleerUpdate(ctx2);
  assert.equal(ctx2.doc.getElementById('banners').children.length, 0);
  assert.equal(await haalInstelling(ctx2.db, 'actieveVersie', null), null);
});

test('updatecheck: nieuwe versie toont balk; knop wist sw, caches en herlaadt', async () => {
  const ctx = await maakCtx({ fetchTekst: "const VERSIE = '1.1.0';" });
  await bewaarInstelling(ctx.db, 'actieveVersie', '1.0.0');
  await controleerUpdate(ctx);
  const banner = ctx.doc.getElementById('banners');
  assert.ok(banner.textContent.includes('Nieuwe versie beschikbaar'));
  // gelijke versie: geen tweede balk
  const ctxGelijk = await maakCtx({ fetchTekst: "const VERSIE = '1.0.0';" });
  await bewaarInstelling(ctxGelijk.db, 'actieveVersie', '1.0.0');
  await controleerUpdate(ctxGelijk);
  assert.equal(ctxGelijk.doc.getElementById('banners').children.length, 0);
  // knop voert de update uit; nooit ongevraagd herladen vooraf
  assert.equal(ctx.venster.herladen, 0);
  await zoekKnop(banner, 'Nu bijwerken').click();
  await spoel();
  assert.equal(await haalInstelling(ctx.db, 'actieveVersie', null), '1.1.0');
  assert.equal(ctx.venster.gederegistreerd, true);
  assert.deepEqual(ctx.venster.cacheVerwijderd, ['kbc-cashflow-0.9.9']);
  assert.equal(ctx.venster.herladen, 1);
});

test('updatecheck draait opnieuw wanneer de app zichtbaar wordt', async () => {
  const venster = maakFakeVenster({ fetchTekst: SW_TEKST });
  const ctx = await startApp(venster);
  await spoel();
  await bewaarInstelling(ctx.db, 'actieveVersie', '0.0.1');
  await venster.document.dispatch('visibilitychange');
  await spoel();
  assert.ok(venster.document.getElementById('banners').textContent.includes('Nieuwe versie'));
  // niet zichtbaar: geen check
  venster.document.getElementById('banners').textContent = '';
  venster.document.visibilityState = 'hidden';
  await venster.document.dispatch('visibilitychange');
  await spoel();
  assert.equal(venster.document.getElementById('banners').textContent, '');
});

test('backupherinnering verschijnt maandelijks zodra er data is', async () => {
  const ctx = await maakCtx();
  // zonder transacties: niets
  await controleerBackupHerinnering(ctx);
  assert.equal(ctx.doc.getElementById('banners').children.length, 0);
  await bewaar(ctx.db, 'transactions', maakTx());
  await controleerBackupHerinnering(ctx);
  const banner = ctx.doc.getElementById('banners');
  assert.ok(banner.textContent.includes('backup'));
  // 'Later' dempt de herinnering een maand
  await zoekKnop(banner, 'Later').click();
  await spoel();
  assert.equal(banner.children.length, 0);
  await controleerBackupHerinnering(ctx);
  assert.equal(banner.children.length, 0);
  // recente backup: geen herinnering
  const ctx2 = await maakCtx();
  await bewaar(ctx2.db, 'transactions', maakTx());
  await bewaarInstelling(ctx2.db, 'laatsteBackupMoment', Date.now());
  await controleerBackupHerinnering(ctx2);
  assert.equal(ctx2.doc.getElementById('banners').children.length, 0);
});
