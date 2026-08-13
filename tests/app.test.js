// Tests voor de app-shell tegen de eigen fake-DOM en fake-localStorage.
// De app leest de systeemklok voor "vandaag"; de testparameters worden daarom
// relatief aan vandaag gebouwd zodat de tests niet verlopen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from '../js/app.js';
import { laadParams, laadKoersen, bewaarParams, bewaarKoersen } from '../js/opslag.js';
import { maakFakeVenster, zoekAlle, zoekKnop, zoekTag, spoel } from './helpers/fakedom.js';
import { specParams } from './helpers/omgeving.js';

const VANDAAG = new Date().toISOString().slice(0, 10);
const JAAR = Number(VANDAAG.slice(0, 4));
const MAAND = Number(VANDAAG.slice(5, 7));

// Maandsleutel n maanden verschoven ten opzichte van deze maand.
function maandVerschoven(verschuiving) {
  const totaal = JAAR * 12 + (MAAND - 1) + verschuiving;
  return `${Math.floor(totaal / 12)}-${String((totaal % 12) + 1).padStart(2, '0')}`;
}

// Polis die twee maanden geleden startte en over dertig jaar eindigt.
function lopendeParams(over = {}) {
  return specParams({
    startDatum: `${maandVerschoven(-2)}-01`,
    eindDatum: `${JAAR + 30}-01-01`,
    ...over,
  });
}

function koersenVoorDrieMaanden(prijs = 10) {
  const koersen = {};
  for (let i = -2; i <= 0; i++) koersen[maandVerschoven(i)] = prijs;
  return koersen;
}

function opgezetVenster(params = lopendeParams(), koersen = koersenVoorDrieMaanden()) {
  const venster = maakFakeVenster();
  if (params !== null) bewaarParams(venster.localStorage, params);
  if (koersen !== null) bewaarKoersen(venster.localStorage, koersen, VANDAAG);
  return venster;
}

const scherm = (venster) => venster.document.getElementById('scherm');

test('lege app opent meteen het instellingenpaneel', async () => {
  const venster = opgezetVenster(null, null);
  await startApp(venster);
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('VUL JE GEGEVENS IN'));
  assert.ok(tekst.includes('Jouw polis'));
  // geen statuskleur, geen grafiek en geen ververs-knop zonder gegevens
  assert.equal(zoekAlle(scherm(venster), (e) => e.className === 'grafiek').length, 0);
  assert.equal(zoekKnop(scherm(venster), 'Koersen vernieuwen'), undefined);
});

test('volledige polis met koersen toont status, grafiek en kerngetallen', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('IPT Tracker'));
  assert.ok(tekst.includes('op het pad'));
  assert.ok(tekst.includes('Reserve vandaag'));
  assert.ok(tekst.includes('Doelpad vandaag'));
  assert.ok(tekst.includes('Verschil'));
  const vlak = zoekAlle(scherm(venster), (e) => e.className.startsWith('status-vlak'))[0];
  assert.ok(['status-vlak groen', 'status-vlak oranje', 'status-vlak rood'].includes(vlak.className));
  const grafiek = zoekAlle(scherm(venster), (e) => e.className === 'grafiek')[0];
  assert.ok(grafiek.innerHTML.includes('<svg'));
  // het instellingenpaneel blijft dicht tot je op het tandwiel tikt
  assert.ok(!tekst.includes('Jouw polis'));
});

test('parameters ingevuld maar nog geen koersen: vraag om te vernieuwen', async () => {
  const venster = opgezetVenster(lopendeParams(), null);
  await startApp(venster);
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('GEEN KOERSDATA'));
  assert.ok(tekst.includes('Koersen vernieuwen'));
  assert.equal(zoekAlle(scherm(venster), (e) => e.className === 'grafiek').length, 0);
});

test('rode status bij een veel te laag rendement', async () => {
  const venster = opgezetVenster(lopendeParams({ rendementNetto: 0, doelNetto: 900000 }));
  await startApp(venster);
  const vlak = zoekAlle(scherm(venster), (e) => e.className.startsWith('status-vlak'))[0];
  assert.equal(vlak.className, 'status-vlak rood');
  assert.ok(vlak.textContent.includes('NIET GOED'));
  assert.ok(vlak.textContent.includes('−'));
});

test('tandwiel klapt de instellingen open en weer dicht', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  const tandwiel = zoekAlle(scherm(venster), (e) => e.className === 'tandwiel')[0];
  await tandwiel.click();
  assert.ok(scherm(venster).textContent.includes('Jouw polis'));
  assert.ok(scherm(venster).textContent.includes('Automatisch opzoeken'));
  await zoekAlle(scherm(venster), (e) => e.className === 'tandwiel')[0].click();
  assert.ok(!scherm(venster).textContent.includes('Jouw polis'));
});

test('velden bewerken schrijft naar de opslag, ook percentages en tekst', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await zoekAlle(scherm(venster), (e) => e.className === 'tandwiel')[0].click();
  const invoeren = zoekTag(scherm(venster), 'input');
  const zoekVeld = (label) => zoekAlle(scherm(venster),
    (e) => e.tagName === 'label' && e.textContent.startsWith(label))[0].children.at(-1);
  // getal
  const premie = zoekVeld('Maandpremie');
  premie.value = '300';
  await premie.dispatch('change');
  assert.equal(laadParams(venster.localStorage).premiePerMaand, 300);
  // percentage wordt als fractie bewaard
  const taks = zoekVeld('Eindtaxatie');
  taks.value = '20';
  await taks.dispatch('change');
  assert.ok(Math.abs(laadParams(venster.localStorage).eindtaks - 0.2) < 1e-12);
  // tekst
  const ticker = zoekVeld('ETF-ticker');
  ticker.value = '  IWDA.AS ';
  await ticker.dispatch('change');
  assert.equal(laadParams(venster.localStorage).ticker, 'IWDA.AS');
  // datum
  const eind = zoekVeld('Einddatum');
  eind.value = '2070-01-01';
  await eind.dispatch('change');
  assert.equal(laadParams(venster.localStorage).eindDatum, '2070-01-01');
  // onzin in een getalveld wordt nul, niet NaN
  const doel = zoekVeld('Doelkapitaal');
  doel.value = 'abc';
  await doel.dispatch('change');
  assert.equal(laadParams(venster.localStorage).doelNetto, 0);
  assert.ok(invoeren.length > 5);
});

test('een parameter op nul toont als leeg veld, niet als "0"', async () => {
  // Een percentage én een bedrag op nul: beide velden horen leeg te staan
  // zodat een nog niet ingevulde waarde geen misleidende nul toont.
  const venster = opgezetVenster(lopendeParams({ instapkost: 0, premiePerMaand: 0 }));
  await startApp(venster);
  await zoekAlle(scherm(venster), (e) => e.className === 'tandwiel')[0].click();
  const zoekVeld = (label) => zoekAlle(scherm(venster),
    (e) => e.tagName === 'label' && e.textContent.startsWith(label))[0].children.at(-1);
  assert.equal(zoekVeld('Instapkost').value, '');
  assert.equal(zoekVeld('Maandpremie').value, '');
  // ter vergelijking: een ingevulde waarde toont wel
  assert.equal(zoekVeld('Beheerskost verzekeraar').value, '1.25');
});

test('koersen vernieuwen: succes bewaart, mislukking laat de oude staan', async () => {
  const venster = opgezetVenster();
  venster.fetchHandler = (url) => {
    if (url.includes('sw.js')) return { ok: true, text: async () => "const VERSIE = '2.0.0';" };
    return {
      ok: true,
      json: async () => ({
        chart: { result: [{ timestamp: [1751328000], indicators: { quote: [{ close: [42] }] } }] },
      }),
    };
  };
  await startApp(venster);
  await zoekKnop(scherm(venster), 'Koersen vernieuwen').click();
  await spoel();
  assert.deepEqual(laadKoersen(venster.localStorage).koersen, { '2025-07': 42 });
  assert.ok(venster.document.getElementById('meldingen').textContent.includes('bijgewerkt'));
  // nu een mislukking: de zonet bewaarde koersen blijven staan
  venster.fetchHandler = (url) => {
    if (url.includes('sw.js')) return { ok: true, text: async () => "const VERSIE = '2.0.0';" };
    throw new Error('offline');
  };
  await zoekKnop(scherm(venster), 'Koersen vernieuwen').click();
  await spoel();
  assert.deepEqual(laadKoersen(venster.localStorage).koersen, { '2025-07': 42 });
  assert.ok(venster.document.getElementById('meldingen').textContent.includes('mislukt'));
});

test('oude koersen krijgen een verouderd-badge', async () => {
  const venster = opgezetVenster();
  bewaarKoersen(venster.localStorage, koersenVoorDrieMaanden(), '2020-01-01');
  await startApp(venster);
  assert.ok(scherm(venster).textContent.includes('verouderd'));
  assert.ok(scherm(venster).textContent.includes('01/01/2020'));
});

test('ontbrekende maandkoersen worden gemeld', async () => {
  const venster = opgezetVenster(lopendeParams(), { [maandVerschoven(-2)]: 10 });
  await startApp(venster);
  assert.ok(scherm(venster).textContent.includes('zonder koers'));
});

test('tap op de grafiek toont de waarden van dat punt', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  const grafiek = zoekAlle(scherm(venster), (e) => e.className === 'grafiek')[0];
  // helemaal links: nog in de gerealiseerde reeks
  await grafiek.dispatch('click', { offsetX: 0 });
  assert.ok(scherm(venster).textContent.includes('doelpad'));
  // rechts: in de projectie
  const opnieuw = zoekAlle(scherm(venster), (e) => e.className === 'grafiek')[0];
  await opnieuw.dispatch('click', { offsetX: 359 });
  assert.ok(scherm(venster).textContent.includes('verwacht'));
  // zonder offsetX valt de tap terug op het begin
  const derde = zoekAlle(scherm(venster), (e) => e.className === 'grafiek')[0];
  await derde.dispatch('click', {});
  assert.ok(scherm(venster).textContent.includes('doelpad'));
});

test('automatisch opzoeken vult TER en rendement in', async () => {
  const venster = opgezetVenster();
  venster.fetchHandler = (url) => {
    if (url.includes('sw.js')) return { ok: true, text: async () => "const VERSIE = '2.0.0';" };
    if (url.includes('quoteSummary')) {
      return {
        ok: true,
        json: async () => ({ quoteSummary: { result: [{ fundProfile: { feesExpensesInvestment: { annualReportExpenseRatio: 0.0021 } } }] } }),
      };
    }
    // tien jaar historiek, verdubbeling
    return {
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            timestamp: [1136073600, 1451606400],
            indicators: { quote: [{ close: [100, 200] }] },
          }],
        },
      }),
    };
  };
  await startApp(venster);
  await zoekAlle(scherm(venster), (e) => e.className === 'tandwiel')[0].click();
  await zoekKnop(scherm(venster), 'Zoek TER en rendement op').click();
  await spoel();
  const params = laadParams(venster.localStorage);
  assert.equal(params.ter, 0.0021);
  assert.equal(params.terGecontroleerd, VANDAAG);
  assert.ok(params.rendementBruto > 0.06 && params.rendementBruto < 0.08);
  assert.ok(params.rendementNetto < params.rendementBruto);
  assert.ok(venster.document.getElementById('meldingen').textContent.includes('Gevonden'));
});

test('automatisch opzoeken meldt het netjes als er niets te vinden is', async () => {
  const venster = opgezetVenster();
  venster.fetchHandler = (url) => {
    if (url.includes('sw.js')) return { ok: true, text: async () => "const VERSIE = '2.0.0';" };
    return { ok: false, status: 404 };
  };
  await startApp(venster);
  await zoekAlle(scherm(venster), (e) => e.className === 'tandwiel')[0].click();
  await zoekKnop(scherm(venster), 'Zoek TER en rendement op').click();
  await spoel();
  assert.ok(venster.document.getElementById('meldingen').textContent.includes('Niets gevonden'));
  assert.equal(laadParams(venster.localStorage).ter, 0.002);
});

test('handmatige controle op vandaag zetten haalt het uitroepteken weg', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await zoekAlle(scherm(venster), (e) => e.className === 'tandwiel')[0].click();
  assert.ok(scherm(venster).textContent.includes('⚠️'));
  assert.ok(scherm(venster).textContent.includes('nooit gecontroleerd'));
  // Elke klik hertekent het scherm, dus telkens opnieuw opzoeken.
  const controleKnoppen = () => zoekAlle(scherm(venster),
    (e) => e.tagName === 'button' && e.textContent === 'Vandaag gecontroleerd');
  for (let i = 0; i < 3; i++) {
    const knop = controleKnoppen().find((k) => k.parentNode.textContent.includes('nooit gecontroleerd'));
    await knop.click();
    await spoel();
  }
  const params = laadParams(venster.localStorage);
  assert.equal(params.terGecontroleerd, VANDAAG);
  assert.equal(params.beheerskostGecontroleerd, VANDAAG);
  assert.equal(params.eindtaksGecontroleerd, VANDAAG);
  assert.ok(!scherm(venster).textContent.includes('⚠️'));
});

test('ijken herschaalt de reserve en is terug te draaien', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await zoekAlle(scherm(venster), (e) => e.className === 'tandwiel')[0].click();
  const ijkVeld = zoekAlle(scherm(venster),
    (e) => e.getAttribute('placeholder') === 'Echte reserve (€)')[0];
  // ongeldig bedrag verandert niets
  ijkVeld.value = '-5';
  await zoekKnop(scherm(venster), 'IJk reserve').click();
  await spoel();
  assert.equal(laadParams(venster.localStorage).ijkFactor, 1);
  assert.ok(venster.document.getElementById('meldingen').textContent.includes('IJken kan pas'));
  // geldig bedrag: de factor wordt gezet en de reserve volgt
  const veld = zoekAlle(scherm(venster), (e) => e.getAttribute('placeholder') === 'Echte reserve (€)')[0];
  veld.value = '1000';
  await zoekKnop(scherm(venster), 'IJk reserve').click();
  await spoel();
  const geijkt = laadParams(venster.localStorage);
  assert.ok(geijkt.ijkFactor > 1);
  assert.equal(geijkt.ijkDatum, VANDAAG);
  assert.ok(scherm(venster).textContent.includes('Geijkt op'));
  assert.ok(scherm(venster).textContent.includes('1.000'));
  // resetten zet alles terug
  await zoekKnop(scherm(venster), 'Reset').click();
  await spoel();
  assert.equal(laadParams(venster.localStorage).ijkFactor, 1);
  assert.equal(laadParams(venster.localStorage).ijkDatum, null);
});

test('ijken kan niet zonder koersdata', async () => {
  const venster = opgezetVenster(lopendeParams(), null);
  await startApp(venster);
  await zoekAlle(scherm(venster), (e) => e.className === 'tandwiel')[0].click();
  const veld = zoekAlle(scherm(venster), (e) => e.getAttribute('placeholder') === 'Echte reserve (€)')[0];
  veld.value = '1000';
  await zoekKnop(scherm(venster), 'IJk reserve').click();
  await spoel();
  assert.equal(laadParams(venster.localStorage).ijkFactor, 1);
  assert.ok(venster.document.getElementById('meldingen').textContent.includes('IJken kan pas'));
});

test('updatebalk verschijnt bij een nieuwe versie en werkt bij op verzoek', async () => {
  const venster = opgezetVenster();
  venster.localStorage.setItem('actieveVersie', '1.0.0');
  venster.fetchTekst = "const VERSIE = '2.0.0';";
  await startApp(venster);
  const banners = venster.document.getElementById('banners');
  assert.ok(banners.textContent.includes('Nieuwe versie beschikbaar'));
  assert.equal(venster.herladen, 0);
  await zoekKnop(banners, 'Nu bijwerken').click();
  await spoel();
  assert.equal(venster.localStorage.getItem('actieveVersie'), '2.0.0');
  assert.equal(venster.gederegistreerd, true);
  assert.deepEqual(venster.cacheVerwijderd, ['ipt-tracker-1.9.9']);
  assert.equal(venster.herladen, 1);
});

test('updatecheck: eerste start onthoudt de versie, gelijke versie zwijgt', async () => {
  const eerste = opgezetVenster();
  await startApp(eerste);
  assert.equal(eerste.localStorage.getItem('actieveVersie'), '2.0.0');
  assert.equal(eerste.document.getElementById('banners').children.length, 0);
  const gelijk = opgezetVenster();
  gelijk.localStorage.setItem('actieveVersie', '2.0.0');
  await startApp(gelijk);
  assert.equal(gelijk.document.getElementById('banners').children.length, 0);
});

test('updatecheck zwijgt offline en bij een onleesbare sw.js', async () => {
  const offline = opgezetVenster();
  offline.fetchFout = true;
  await startApp(offline);
  assert.equal(offline.document.getElementById('banners').children.length, 0);
  assert.equal(offline.localStorage.getItem('actieveVersie'), null);
  const rommel = opgezetVenster();
  rommel.fetchTekst = 'geen versie hier';
  await startApp(rommel);
  assert.equal(rommel.document.getElementById('banners').children.length, 0);
});

test('updatecheck draait opnieuw zodra de app weer zichtbaar wordt', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  venster.localStorage.setItem('actieveVersie', '0.0.1');
  await venster.document.dispatch('visibilitychange');
  await spoel();
  assert.ok(venster.document.getElementById('banners').textContent.includes('Nieuwe versie'));
  // onzichtbaar: geen check
  venster.document.getElementById('banners').textContent = '';
  venster.document.visibilityState = 'hidden';
  venster.localStorage.setItem('actieveVersie', '0.0.2');
  await venster.document.dispatch('visibilitychange');
  await spoel();
  assert.equal(venster.document.getElementById('banners').textContent, '');
});

test('app start ook zonder storage- en serviceworker-API', async () => {
  const venster = maakFakeVenster({ zonderStorage: true, zonderServiceWorker: true });
  bewaarParams(venster.localStorage, lopendeParams());
  bewaarKoersen(venster.localStorage, koersenVoorDrieMaanden(), VANDAAG);
  const app = await startApp(venster);
  assert.equal(venster.swGeregistreerd, undefined);
  assert.ok(scherm(venster).textContent.includes('IPT Tracker'));
  // de teruggegeven render laat het scherm opnieuw opbouwen
  app.render();
  assert.ok(scherm(venster).textContent.includes('IPT Tracker'));
});
