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

// De "Reken hiermee"-knop binnen het keuzeblok waarvan de kop begint met tekst.
function keuzeKnop(venster, kop) {
  const blok = zoekAlle(scherm(venster),
    (e) => e.className.startsWith('keuze') && e.textContent.includes(kop))[0];
  return zoekKnop(blok, 'Reken hiermee');
}
const meldingen = (venster) => venster.document.getElementById('meldingen').textContent;
const tandwiel = (venster) => zoekAlle(scherm(venster), (e) => e.className === 'tandwiel')[0];
// Elke klik hertekent het scherm, dus elementen telkens opnieuw opzoeken.
const veld = (venster, label) => zoekAlle(scherm(venster),
  (e) => e.tagName === 'label' && e.textContent.startsWith(label))[0].children.at(-1);
const ijkVeld = (venster) => zoekAlle(scherm(venster),
  (e) => e.getAttribute('placeholder') === 'Echte reserve (€)')[0];

test('lege app opent meteen het instellingenpaneel', async () => {
  const venster = opgezetVenster(null, null);
  await startApp(venster);
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('VUL JE GEGEVENS IN'));
  assert.ok(tekst.includes('Jouw polis'));
  // geen statuskleur, geen grafiek en geen ververs-knop zonder gegevens
  assert.equal(zoekAlle(scherm(venster), (e) => e.className === 'grafiek').length, 0);
  assert.equal(zoekKnop(scherm(venster), 'Koersen vernieuwen'), undefined);
  // zonder volledige polis geen afgeleide-samenvatting bij "Jouw polis"
  assert.ok(!tekst.includes('Netto belegd'));
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
  // vlakke koers tegen een groeiend doelpad: je ligt achter
  assert.ok(vlak.textContent.includes('achter'));
  // zonder bewaard overzicht geen extra referentierij
  assert.ok(!tekst.includes('Jouw overzicht'));
  // het instellingenpaneel blijft dicht tot je op het tandwiel tikt
  assert.ok(!tekst.includes('Jouw polis'));
});

test('een haalbaar doel geeft een groene status met een positief verschil', async () => {
  const venster = opgezetVenster(lopendeParams({ doelNetto: 50000 }));
  await startApp(venster);
  const vlak = zoekAlle(scherm(venster), (e) => e.className.startsWith('status-vlak'))[0];
  assert.equal(vlak.className, 'status-vlak groen');
  assert.ok(vlak.textContent.includes('GOED'));
  assert.ok(vlak.textContent.includes('+'));
});

test('parameters ingevuld maar nog geen cijfers: vraag om te vernieuwen', async () => {
  const venster = opgezetVenster(lopendeParams(), null);
  await startApp(venster);
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('NOG GEEN CIJFERS'));
  assert.ok(tekst.includes('Koersen vernieuwen'));
  assert.ok(tekst.includes('Nog geen koersen opgehaald'));
  assert.equal(zoekAlle(scherm(venster), (e) => e.className === 'grafiek').length, 0);
  // zonder cijfers ook geen kerngetallen
  assert.ok(!tekst.includes('Doelpad vandaag'));
});

test('rode status bij een index die stilstaat', async () => {
  // rendementBruto 0 laat na TER en beheerskost een negatief nettorendement over
  const venster = opgezetVenster(lopendeParams({ rendementBruto: 0, doelNetto: 900000 }));
  await startApp(venster);
  const vlak = zoekAlle(scherm(venster), (e) => e.className.startsWith('status-vlak'))[0];
  assert.equal(vlak.className, 'status-vlak rood');
  assert.ok(vlak.textContent.includes('NIET GOED'));
  assert.ok(vlak.textContent.includes('−'));
  // het doelpad groeit hier niet, dus de reserve loopt er licht op voor
  assert.ok(vlak.textContent.includes('voor'));
});

test('tandwiel klapt de instellingen open en weer dicht, in vaste groepen', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await tandwiel(venster).click();
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('Jouw polis'));
  assert.ok(tekst.includes('Rendement'));
  assert.ok(tekst.includes('Eindtaxatie'));
  assert.ok(tekst.includes('Geavanceerd'));
  assert.ok(tekst.includes('Meet rendement uit de koershistoriek'));
  assert.ok(tekst.includes('Netto belegd'));
  // het nettorendement wordt getoond, niet ingevuld
  assert.ok(tekst.includes('De app rekent met'));
  assert.equal(zoekAlle(scherm(venster),
    (e) => e.tagName === 'label' && e.textContent.includes('Nettorendement')).length, 0);
  await tandwiel(venster).click();
  assert.ok(!scherm(venster).textContent.includes('Jouw polis'));
});

test('velden bewerken schrijft naar de opslag, ook percentages en tekst', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await tandwiel(venster).click();
  const invoeren = zoekTag(scherm(venster), 'input');
  // getal
  const premie = veld(venster, 'Maandpremie');
  premie.value = '300';
  await premie.dispatch('change');
  assert.equal(laadParams(venster.localStorage).premiePerMaand, 300);
  // percentage wordt als fractie bewaard
  const taks = veld(venster, 'Eindtaxatie');
  taks.value = '20';
  await taks.dispatch('change');
  assert.ok(Math.abs(laadParams(venster.localStorage).eindtaks - 0.2) < 1e-12);
  // de aanname over de index staat in het rendementblok, niet als nettorendement
  const bruto = veld(venster, 'Verwacht rendement van de index');
  bruto.value = '8';
  await bruto.dispatch('change');
  assert.ok(Math.abs(laadParams(venster.localStorage).rendementBruto - 0.08) < 1e-12);
  // datum: wordt getrimd bewaard, net als de tekstvelden
  const eind = veld(venster, 'Einddatum');
  eind.value = ' 2070-01-01 ';
  await eind.dispatch('change');
  assert.equal(laadParams(venster.localStorage).eindDatum, '2070-01-01');
  // onzin in een getalveld wordt nul, niet NaN
  const doel = veld(venster, 'Doelkapitaal');
  doel.value = 'abc';
  await doel.dispatch('change');
  assert.equal(laadParams(venster.localStorage).doelNetto, 0);
  assert.ok(invoeren.length > 5);
});

test('een parameter op nul toont als leeg veld, niet als "0"', async () => {
  // Een percentage én een bedrag op nul: beide velden horen leeg te staan
  // zodat een nog niet ingevulde waarde geen misleidende nul toont.
  const venster = opgezetVenster(lopendeParams({ eindtaks: 0, premiePerMaand: 0 }));
  await startApp(venster);
  await tandwiel(venster).click();
  assert.equal(veld(venster, 'Eindtaxatie').value, '');
  assert.equal(veld(venster, 'Maandpremie').value, '');
  // ter vergelijking: ingevulde waarden tonen wel, percentages als procent
  // Percentages worden als fractie bewaard; het veld toont het weer als een
  // net getal in plaats van 7.000000000000001.
  assert.equal(veld(venster, 'Verwacht rendement van de index').value, '7');
  assert.equal(veld(venster, 'Doelkapitaal').value, '250000');
});

test('alle velden onder "Geavanceerd" staan echt in de DOM', async () => {
  // Regressie: PRODUCT_VELDEN.map(...) werd als ARRAY aan append() gegeven.
  // append() neemt alleen knopen en strings, dus de browser maakte er één
  // tekstknoop van en de zeven velden waren onbereikbaar.
  const venster = opgezetVenster();
  await startApp(venster);
  await tandwiel(venster).click();
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('Geavanceerd'));
  assert.ok(!tekst.includes('[object Object]'));
  for (const label of ['Instapkost', 'Beheerskost verzekeraar', 'TER van de ETF',
    'ETF-ticker', 'ETF ISIN', 'Intern fonds', 'Eigen CORS-proxy']) {
    assert.equal(zoekAlle(scherm(venster),
      (e) => e.tagName === 'label' && e.textContent.startsWith(label)).length, 1, label);
  }
  // vier polisvelden, twee aannames, zeven geavanceerde en de reserve-invoer
  assert.equal(zoekTag(scherm(venster), 'input').length, 14);
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
  // nieuwe koersen komen over de bestaande heen, ze vegen ze niet weg
  const na = laadKoersen(venster.localStorage).koersen;
  assert.equal(na['2025-07'], 42);
  assert.equal(na[maandVerschoven(0)], 10);
  assert.ok(meldingen(venster).includes('bijgewerkt'));
  // nu een mislukking: de zonet bewaarde koersen blijven staan
  venster.fetchHandler = (url) => {
    if (url.includes('sw.js')) return { ok: true, text: async () => "const VERSIE = '2.0.0';" };
    throw new Error('offline');
  };
  await zoekKnop(scherm(venster), 'Koersen vernieuwen').click();
  await spoel();
  assert.deepEqual(laadKoersen(venster.localStorage).koersen, na);
  assert.ok(meldingen(venster).includes('mislukt'));
  // een historiek van één maand levert geen meting op
  assert.equal(laadParams(venster.localStorage).gemetenMaanden, 0);
});

test('koersen vernieuwen meet meteen ook het rendement van de tracker', async () => {
  // Bij elke verversing wordt de volledige historiek gemeten: het rendement
  // dat de tracker écht haalde is een feit, de aanname is dat niet.
  const venster = opgezetVenster();
  venster.fetchHandler = (url) => {
    if (url.includes('sw.js')) return { ok: true, text: async () => "const VERSIE = '2.0.0';" };
    // tien jaar historiek, verdubbeling: 2^(1/10) - 1 = 7,18% per jaar
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
  await zoekKnop(scherm(venster), 'Koersen vernieuwen').click();
  await spoel();
  const params = laadParams(venster.localStorage);
  assert.equal(params.gemetenMaanden, 120);
  assert.ok(Math.abs(params.gemetenRendement - (2 ** 0.1 - 1)) < 1e-12);
  assert.equal(params.gemetenTot, '2016-01');
  // de aanname blijft onaangeroerd naast de meting staan
  assert.equal(params.rendementBruto, 0.07);
  // en het hoofdscherm toont wat de tracker deed
  assert.ok(scherm(venster).textContent.includes('Tracker deed (10 jaar)'));
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
  // vlak links, maar wel voorbij index 0: de gerealiseerde reeks
  const grafiek = zoekAlle(scherm(venster), (e) => e.className === 'grafiek')[0];
  await grafiek.dispatch('click', { offsetX: 1 });
  assert.ok(scherm(venster).textContent.includes('doelpad'));
  assert.ok(scherm(venster).textContent.includes('werkelijk'));
  // rechts: in de projectie
  const opnieuw = zoekAlle(scherm(venster), (e) => e.className === 'grafiek')[0];
  await opnieuw.dispatch('click', { offsetX: 359 });
  assert.ok(scherm(venster).textContent.includes('verwacht'));
});

test('tap zonder offsetX valt terug op het begin van de grafiek', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  const grafiek = zoekAlle(scherm(venster), (e) => e.className === 'grafiek')[0];
  await grafiek.dispatch('click', {});
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('doelpad'));
  // Regressie: punt 0 is de nulstand vóór de eerste premie en heeft dus
  // noch een gerealiseerde noch een verwachte waarde. De app toonde daar
  // "verwacht € NaN"; nu hoort alleen het doelpad te verschijnen.
  assert.ok(!tekst.includes('NaN'));
  assert.ok(!tekst.includes('verwacht'));
  assert.ok(!tekst.includes('werkelijk'));
});

test('rendement meten uit de koershistoriek bewaart de meting', async () => {
  const venster = opgezetVenster();
  venster.fetchHandler = (url) => {
    if (url.includes('sw.js')) return { ok: true, text: async () => "const VERSIE = '2.0.0';" };
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
  const terVoor = laadParams(venster.localStorage).ter;
  await tandwiel(venster).click();
  await zoekKnop(scherm(venster), 'Meet rendement uit de koershistoriek').click();
  await spoel();
  const params = laadParams(venster.localStorage);
  assert.ok(Math.abs(params.gemetenRendement - (2 ** 0.1 - 1)) < 1e-12);
  assert.equal(params.gemetenMaanden, 120);
  assert.equal(params.gemetenTot, '2016-01');
  // de eigen aanname en de TER blijven onaangeroerd handmatige velden
  assert.equal(params.rendementBruto, 0.07);
  assert.equal(params.ter, terVoor);
  assert.equal(params.terGecontroleerd, null);
  assert.ok(meldingen(venster).includes('Gemeten'));
  assert.ok(meldingen(venster).includes('bruto per jaar over 10 jaar'));
  // de app rekent er meteen mee en zegt dat ook
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('Gemeten: 7,2% bruto per jaar'));
  assert.ok(tekst.includes('over 10 jaar, tot 2016-01'));
  // het gemeten blok is gemarkeerd als het cijfer waarmee gerekend wordt
  assert.ok(tekst.includes('in gebruik'));
  assert.ok(tekst.includes('gemeten, min'));
});

test('de gebruiker kan terugschakelen naar zijn eigen aanname', async () => {
  const gemeten = lopendeParams({
    gemetenRendement: 0.12, gemetenMaanden: 120, gemetenTot: '2016-01',
  });
  const venster = opgezetVenster(gemeten);
  await startApp(venster);
  await tandwiel(venster).click();
  // met een meting én de keuze ervoor rekent de app met het gemeten cijfer
  assert.ok(scherm(venster).textContent.includes('gemeten, min'));
  await keuzeKnop(venster, 'Mijn eigen aanname').click();
  await spoel();
  assert.equal(laadParams(venster.localStorage).gebruikGemeten, false);
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('aanname, min'));
  assert.ok(tekst.includes('fondskosten'));
  // de meting blijft bewaard en zichtbaar
  assert.equal(laadParams(venster.localStorage).gemetenMaanden, 120);
  assert.ok(tekst.includes('Gemeten: 12% bruto per jaar'));
  // en de knop biedt de weg terug aan
  await keuzeKnop(venster, 'Gemeten').click();
  await spoel();
  assert.equal(laadParams(venster.localStorage).gebruikGemeten, true);
  assert.ok(scherm(venster).textContent.includes('gemeten, min'));
});

test('zonder meting nodigt het rendementblok uit om te meten', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await tandwiel(venster).click();
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('Nog niets gemeten'));
  assert.ok(!tekst.includes('Gemeten:'));
  // zonder meting valt er niets te kiezen
  assert.equal(zoekKnop(scherm(venster), 'Reken hiermee'), undefined);
});

test('het hoofdscherm zet het vereiste rendement naast het gemeten rendement', async () => {
  const venster = opgezetVenster(lopendeParams({
    gemetenRendement: 0.12, gemetenMaanden: 120, gemetenTot: '2016-01',
  }));
  await startApp(venster);
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('Nodig vanaf nu'));
  assert.ok(tekst.includes('netto per jaar'));
  assert.ok(tekst.includes('Tracker deed (10 jaar)'));
  assert.ok(tekst.includes('12% bruto per jaar'));
});

test('een afgelopen polis toont geen vereist rendement meer', async () => {
  // Alle premies zijn betaald: het rendement kan de uitkomst niet meer sturen,
  // dus die rij hoort weg te blijven in plaats van een onzinnig getal te tonen.
  const venster = opgezetVenster(lopendeParams({ eindDatum: `${maandVerschoven(0)}-01` }));
  await startApp(venster);
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('Reserve vandaag'));
  assert.ok(!tekst.includes('Nodig vanaf nu'));
  assert.ok(!tekst.includes('Tracker deed'));
});

test('rendement meten meldt het netjes als er geen bruikbare historiek is', async () => {
  const venster = opgezetVenster();
  venster.fetchHandler = (url) => {
    if (url.includes('sw.js')) return { ok: true, text: async () => "const VERSIE = '2.0.0';" };
    return { ok: false, status: 404 };
  };
  await startApp(venster);
  await tandwiel(venster).click();
  await zoekKnop(scherm(venster), 'Meet rendement uit de koershistoriek').click();
  await spoel();
  assert.ok(meldingen(venster).includes('Geen bruikbare historiek'));
  assert.equal(laadParams(venster.localStorage).rendementBruto, 0.07);
});

test('rendement meten weigert een te korte historiek', async () => {
  const venster = opgezetVenster();
  venster.fetchHandler = (url) => {
    if (url.includes('sw.js')) return { ok: true, text: async () => "const VERSIE = '2.0.0';" };
    // maar twee maanden historiek: te weinig voor een langetermijnaanname
    return {
      ok: true,
      json: async () => ({
        chart: {
          result: [{
            timestamp: [1751328000, 1753920000],
            indicators: { quote: [{ close: [100, 200] }] },
          }],
        },
      }),
    };
  };
  await startApp(venster);
  await tandwiel(venster).click();
  await zoekKnop(scherm(venster), 'Meet rendement uit de koershistoriek').click();
  await spoel();
  assert.ok(meldingen(venster).includes('Geen bruikbare historiek'));
  assert.equal(laadParams(venster.localStorage).rendementBruto, 0.07);
});

test('handmatige controle op vandaag zetten haalt het uitroepteken weg', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await tandwiel(venster).click();
  assert.ok(scherm(venster).textContent.includes('⚠️'));
  assert.ok(scherm(venster).textContent.includes('nooit gecontroleerd'));
  const controleKnoppen = () => zoekAlle(scherm(venster),
    (e) => e.tagName === 'button' && e.textContent === 'Nagekeken');
  for (let i = 0; i < 3; i++) {
    // de knop zit in .controle-acties binnen .controle-rij, dus een niveau hoger kijken
    const knop = controleKnoppen().find(
      (k) => k.parentNode.parentNode.textContent.includes('nooit gecontroleerd'));
    await knop.click();
    await spoel();
  }
  const params = laadParams(venster.localStorage);
  assert.equal(params.terGecontroleerd, VANDAAG);
  assert.equal(params.beheerskostGecontroleerd, VANDAAG);
  assert.equal(params.eindtaksGecontroleerd, VANDAAG);
  assert.ok(!scherm(venster).textContent.includes('⚠️'));
  // twee van de drie controles hebben een bronlink, de fiscale aanname niet
  assert.equal(zoekTag(scherm(venster), 'a').length, 2);
});

test('reserve bewaren ijkt de simulatie en is terug te draaien', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await tandwiel(venster).click();
  // ongeldig bedrag verandert niets
  const leeg = ijkVeld(venster);
  leeg.value = '-5';
  await zoekKnop(scherm(venster), 'Bewaar reserve').click();
  await spoel();
  assert.equal(laadParams(venster.localStorage).ijkFactor, 1);
  assert.equal(laadParams(venster.localStorage).echteReserve, 0);
  assert.ok(meldingen(venster).includes('geldig bedrag'));
  // geldig bedrag: de reserve wordt bewaard én de simulatie erop geijkt
  const goed = ijkVeld(venster);
  goed.value = '1000';
  await zoekKnop(scherm(venster), 'Bewaar reserve').click();
  await spoel();
  const geijkt = laadParams(venster.localStorage);
  assert.equal(geijkt.echteReserve, 1000);
  assert.equal(geijkt.echteReserveDatum, VANDAAG);
  assert.ok(geijkt.ijkFactor > 1);
  assert.equal(geijkt.ijkDatum, VANDAAG);
  assert.ok(meldingen(venster).includes('geijkt'));
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('Bewaard:'));
  assert.ok(tekst.includes('simulatie geijkt (factor'));
  // het bewaarde bedrag blijft ook op het hoofdscherm als referentie staan
  assert.ok(tekst.includes('Jouw overzicht'));
  assert.ok(tekst.includes('1.000'));
  // de reserve staat nu vóór op het doelpad
  const vlak = zoekAlle(scherm(venster), (e) => e.className.startsWith('status-vlak'))[0];
  assert.ok(vlak.textContent.includes('voor'));
  assert.equal(zoekAlle(scherm(venster), (e) => e.className === 'positief').length, 1);
  // wissen zet alles terug
  await zoekKnop(scherm(venster), 'Wissen').click();
  await spoel();
  const gewist = laadParams(venster.localStorage);
  assert.equal(gewist.ijkFactor, 1);
  assert.equal(gewist.ijkDatum, null);
  assert.equal(gewist.echteReserve, 0);
  assert.equal(gewist.echteReserveDatum, null);
  assert.ok(!scherm(venster).textContent.includes('Bewaard:'));
});

test('ijken is idempotent: twee keer hetzelfde bedrag geeft dezelfde factor', async () => {
  // Valkuil uit CLAUDE.md: wie niet eerst door de bestaande ijkFactor deelt,
  // vermenigvuldigt de correctie elke keer met zichzelf.
  const venster = opgezetVenster();
  await startApp(venster);
  await tandwiel(venster).click();
  const eerste = ijkVeld(venster);
  eerste.value = '1000';
  await zoekKnop(scherm(venster), 'Bewaar reserve').click();
  await spoel();
  const na1 = laadParams(venster.localStorage);
  assert.ok(na1.ijkFactor > 1);
  // nog eens hetzelfde bedrag bewaren
  const tweede = ijkVeld(venster);
  tweede.value = '1000';
  await zoekKnop(scherm(venster), 'Bewaar reserve').click();
  await spoel();
  const na2 = laadParams(venster.localStorage);
  assert.ok(Math.abs(na2.ijkFactor - na1.ijkFactor) < 1e-9);
  // en het scherm toont nog altijd exact de opgegeven reserve
  assert.ok(scherm(venster).textContent.includes('1.000'));
  // een derde keer verandert er nog altijd niets
  const derde = ijkVeld(venster);
  derde.value = '1000';
  await zoekKnop(scherm(venster), 'Bewaar reserve').click();
  await spoel();
  assert.ok(Math.abs(laadParams(venster.localStorage).ijkFactor - na1.ijkFactor) < 1e-9);
});

test('zonder koersen wordt de bewaarde reserve zelf de rekenbasis', async () => {
  const venster = opgezetVenster(lopendeParams(), null);
  await startApp(venster);
  await tandwiel(venster).click();
  const invoer = ijkVeld(venster);
  invoer.value = '1000';
  await zoekKnop(scherm(venster), 'Bewaar reserve').click();
  await spoel();
  const params = laadParams(venster.localStorage);
  assert.equal(params.echteReserve, 1000);
  assert.equal(params.echteReserveDatum, VANDAAG);
  // zonder koersen valt er niets te ijken
  assert.equal(params.ijkFactor, 1);
  assert.equal(params.ijkDatum, null);
  assert.ok(meldingen(venster).includes('zolang er geen koersen zijn'));
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('Bewaard:'));
  assert.ok(!tekst.includes('simulatie geijkt'));
  // het hoofdscherm rekent er nu mee, maar zonder grafiek
  assert.ok(!tekst.includes('NOG GEEN CIJFERS'));
  assert.ok(tekst.includes('Reserve (jouw overzicht)'));
  assert.ok(tekst.includes('Gerekend met de reserve van je jaaroverzicht'));
  assert.equal(zoekAlle(scherm(venster), (e) => e.className === 'grafiek').length, 0);
  const vlak = zoekAlle(scherm(venster), (e) => e.className.startsWith('status-vlak'))[0];
  assert.ok(['status-vlak groen', 'status-vlak oranje', 'status-vlak rood'].includes(vlak.className));
});

test('reserve bewaren kan al voordat de polisgegevens volledig zijn', async () => {
  const venster = opgezetVenster(null, null);
  await startApp(venster);
  const invoer = ijkVeld(venster);
  invoer.value = '750';
  await zoekKnop(scherm(venster), 'Bewaar reserve').click();
  await spoel();
  const params = laadParams(venster.localStorage);
  assert.equal(params.echteReserve, 750);
  assert.equal(params.ijkFactor, 1);
  // zonder polisgegevens blijft het scherm om die gegevens vragen
  assert.ok(scherm(venster).textContent.includes('VUL JE GEGEVENS IN'));
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

test('het scherm staat er al voordat het netwerk antwoordt', async () => {
  // render() draait vóór de netwerkoproepen: een trage verbinding mag nooit
  // een leeg scherm opleveren (spec 1 en 8).
  const venster = opgezetVenster();
  let losmaken = null;
  venster.fetchHandler = () => new Promise((klaar) => { losmaken = klaar; });
  const bezig = startApp(venster);
  assert.ok(scherm(venster).textContent.includes('IPT Tracker'));
  assert.ok(scherm(venster).textContent.includes('Reserve vandaag'));
  losmaken({ ok: true, text: async () => "const VERSIE = '2.0.0';" });
  await bezig;
});

test('een weigerende storage-API laat de app gewoon starten', async () => {
  const venster = opgezetVenster();
  venster.navigator.storage = { persist: async () => { throw new Error('geweigerd'); } };
  await startApp(venster);
  await spoel();
  assert.ok(scherm(venster).textContent.includes('IPT Tracker'));
});
