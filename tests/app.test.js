// Tests voor de app-shell tegen de eigen fake-DOM en fake-localStorage.
// De app leest de systeemklok voor "vandaag"; de testparameters worden daarom
// relatief aan vandaag gebouwd zodat de tests niet verlopen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from '../js/app.js';
import { laadParams, laadKoersen, bewaarParams, bewaarKoersen } from '../js/opslag.js';
import { parseChart } from '../js/koersen.js';
import { maakFakeVenster, zoekAlle, zoekKnop, zoekTag, spoel } from './helpers/fakedom.js';
import { overzicht } from '../js/reken.js';
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

// Yahoo-antwoord uit paren [unix-tijdstip, slotkoers].
function chartAntwoord(...paren) {
  return {
    chart: {
      result: [{
        timestamp: paren.map(([tijd]) => tijd),
        indicators: { quote: [{ close: paren.map(([, koers]) => koers) }] },
      }],
    },
  };
}

// Fake fetch die de updatecheck (sw.js) beantwoordt, het maandbestand van de
// app serveert en al het andere als een Yahoo-chart achter een doorgeefluik.
// Eén verzoek voor de koersen: er is geen tweede voor de historiek.
function koersFetch(chart, { lokaal = 'SUSW.L' } = {}) {
  return (url) => {
    if (url.includes('sw.js')) return { ok: true, text: async () => "const VERSIE = '2.0.0';" };
    if (url.includes('data/koersen.json')) {
      if (lokaal === null) throw new Error('geen bestand');
      return { ok: true, json: async () => ({ ticker: lokaal, koersen: parseChart(chart) }) };
    }
    return { ok: true, json: async () => chart };
  };
}

// Tien jaar historiek met een verdubbeling: 2^(1/10) − 1 = 7,18% per jaar.
const TIEN_JAAR = chartAntwoord([1136073600, 100], [1451606400, 200]);

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
  assert.ok(tekst.includes('op het doelpad'));
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
  // het meten hangt aan "Koersen vernieuwen"; een aparte meetknop is er niet
  assert.equal(zoekKnop(scherm(venster), 'Meet rendement'), undefined);
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
  // vier polisvelden, twee aannames, zeven geavanceerde en het bedrag plus de
  // datum van het jaaroverzicht
  assert.equal(zoekTag(scherm(venster), 'input').length, 15);
});

test('koersen vernieuwen: succes bewaart, mislukking laat de oude staan', async () => {
  const venster = opgezetVenster();
  venster.fetchHandler = koersFetch(chartAntwoord([1751328000, 42]));
  await startApp(venster);
  await zoekKnop(scherm(venster), 'Koersen vernieuwen').click();
  await spoel();
  // nieuwe koersen komen over de bestaande heen, ze vegen ze niet weg
  const na = laadKoersen(venster.localStorage).koersen;
  assert.equal(na['2025-07'], 42);
  assert.equal(na[maandVerschoven(0)], 10);
  assert.ok(meldingen(venster).includes('Koersen uit het maandbestand van de app'));
  // nu een mislukking: de zonet bewaarde koersen blijven staan
  venster.fetchHandler = (url) => {
    if (url.includes('sw.js')) return { ok: true, text: async () => "const VERSIE = '2.0.0';" };
    throw new Error('offline');
  };
  await zoekKnop(scherm(venster), 'Koersen vernieuwen').click();
  await spoel();
  assert.deepEqual(laadKoersen(venster.localStorage).koersen, na);
  // een mislukking is een blijvende banner, geen toast die je na zes
  // seconden gemist hebt
  const banner = venster.document.getElementById('banners').textContent;
  assert.ok(banner.includes('Koersen ophalen lukt niet'));
  assert.ok(banner.includes('SUSW.L'));
  await zoekKnop(venster.document.getElementById('banners'), 'Sluiten').click();
  assert.equal(venster.document.getElementById('banners').children.length, 0);
  // een historiek van één maand levert geen meting op
  assert.equal(laadParams(venster.localStorage).gemetenMaanden, 0);
});

test('één druk op "Koersen vernieuwen" bewaart de koersen én meet het rendement', async () => {
  // Bij elke verversing wordt de volledige historiek gemeten: het rendement
  // dat de tracker écht haalde is een feit, de aanname is dat niet. Dat gaat
  // met hetzelfde ene verzoek — er is geen tweede ophaling meer.
  const venster = opgezetVenster();
  venster.fetchHandler = koersFetch(TIEN_JAAR);
  await startApp(venster);
  const terVoor = laadParams(venster.localStorage).ter;
  const verzoekenVoor = venster.fetchLog.length;
  await zoekKnop(scherm(venster), 'Koersen vernieuwen').click();
  await spoel();
  // de koersen zijn bewaard, over de bestaande heen
  const koersen = laadKoersen(venster.localStorage).koersen;
  assert.equal(koersen['2006-01'], 100);
  assert.equal(koersen['2016-01'], 200);
  assert.equal(koersen[maandVerschoven(0)], 10);
  assert.equal(laadKoersen(venster.localStorage).opgehaald, VANDAAG);
  // en het rendement is uit diezelfde koersen gemeten
  const params = laadParams(venster.localStorage);
  assert.equal(params.gemetenMaanden, 120);
  assert.ok(Math.abs(params.gemetenRendement - (2 ** 0.1 - 1)) < 1e-12);
  assert.equal(params.gemetenTot, '2016-01');
  // één enkel koersverzoek volstond
  assert.equal(venster.fetchLog.length - verzoekenVoor, 1);
  // de eigen aanname en de TER blijven onaangeroerd handmatige velden
  assert.equal(params.rendementBruto, 0.07);
  assert.equal(params.ter, terVoor);
  assert.equal(params.terGecontroleerd, null);
  // de toast noemt de bron, de maanden en het gemeten rendement
  assert.ok(meldingen(venster).includes(
    'Koersen uit het maandbestand van de app: 2 maanden, rendement 7,2% per jaar.'));
  // het hoofdscherm toont wat de tracker deed
  assert.ok(scherm(venster).textContent.includes('Fonds deed (10 jaar)'));
  // en het instellingenpaneel rekent er meteen mee
  await tandwiel(venster).click();
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('Gemeten uit de koersen'));
  assert.ok(tekst.includes('7,2% bruto per jaar'));
  assert.ok(tekst.includes('Over 10 jaar, tot 2016-01'));
  assert.ok(tekst.includes('in gebruik'));
  assert.ok(tekst.includes('gemeten, min'));
});

test('de koersen komen van de eigen origin, niet van een doorgeefluik', async () => {
  // De kern van de oplossing: het maandbestand wordt door de werkstroom
  // server-side gevuld en staat naast index.html. Geen CORS, dus geen proxy.
  const venster = opgezetVenster();
  venster.fetchHandler = koersFetch(TIEN_JAAR);
  await startApp(venster);
  const voor = venster.fetchLog.length;
  await zoekKnop(scherm(venster), 'Koersen vernieuwen').click();
  await spoel();
  const koersVerzoeken = venster.fetchLog.slice(voor);
  assert.deepEqual(koersVerzoeken, ['./data/koersen.json']);
  assert.ok(!koersVerzoeken.some((url) => url.includes('yahoo') || url.includes('cors')));
  assert.equal(laadKoersen(venster.localStorage).koersen['2016-01'], 200);
});

test('een eigen ticker valt terug op de doorgeefluiken', async () => {
  // Het gepubliceerde bestand bevat één fonds. Wie er een ander volgt mag
  // nooit stilzwijgend de koersen van dat ene fonds te zien krijgen.
  const venster = opgezetVenster();
  venster.fetchHandler = koersFetch(TIEN_JAAR, { lokaal: 'ANDER.L' });
  await startApp(venster);
  const voor = venster.fetchLog.length;
  await zoekKnop(scherm(venster), 'Koersen vernieuwen').click();
  await spoel();
  const koersVerzoeken = venster.fetchLog.slice(voor);
  assert.equal(koersVerzoeken.length, 2);
  assert.equal(koersVerzoeken[0], './data/koersen.json');
  assert.ok(koersVerzoeken[1].includes(encodeURIComponent('SUSW.L')));
  assert.ok(meldingen(venster).includes('Koersen uit een publiek doorgeefluik'));
});

test('te weinig historiek: koersen wél bewaard, rendement niet gemeten', async () => {
  // Minder dan drie jaar zegt niets over een looptijd van veertig jaar. De
  // opgehaalde koersen zijn daarom wel bruikbaar, de meting niet.
  const venster = opgezetVenster();
  // twee maanden historiek: 2025-07 en 2025-08
  venster.fetchHandler = koersFetch(chartAntwoord([1751328000, 100], [1754006400, 200]));
  await startApp(venster);
  await zoekKnop(scherm(venster), 'Koersen vernieuwen').click();
  await spoel();
  const koersen = laadKoersen(venster.localStorage).koersen;
  assert.equal(koersen['2025-07'], 100);
  assert.equal(koersen['2025-08'], 200);
  const params = laadParams(venster.localStorage);
  assert.equal(params.gemetenMaanden, 0);
  assert.equal(params.gemetenRendement, 0);
  assert.equal(params.gemetenTot, null);
  assert.equal(params.rendementBruto, 0.07);
  assert.ok(meldingen(venster).includes('Koersen uit het maandbestand van de app: 2 maanden. ' +
    'Te weinig historiek om het rendement te meten.'));
  // en er verschijnt geen bannerfout: de ophaling zelf is gelukt
  assert.equal(venster.document.getElementById('banners').children.length, 0);
  assert.ok(scherm(venster).textContent.includes('nog niet gemeten'));
});

test('achterlopende koersen worden gemeld, niet een oude ophaaldatum', async () => {
  // Wat telt is de ouderdom van de koersen zelf: haal je met succes een
  // bestand op dat al maanden stilstaat, dan hoort de app dat te zeggen.
  const venster = opgezetVenster();
  bewaarKoersen(venster.localStorage, koersenVoorDrieMaanden(), '2020-01-01');
  await startApp(venster);
  const tekst = scherm(venster).textContent;
  // koersen tot deze maand: bij tot vandaag is er niets aan de hand
  assert.ok(tekst.includes(`Koersen tot ${maandVerschoven(0).slice(5)}/${maandVerschoven(0).slice(0, 4)}`));
  assert.ok(tekst.includes('opgehaald 01/01/2020'));
  // "achter" staat ook in de statuszin, dus kijk naar de badge zelf
  const badge = (v) => zoekAlle(scherm(v), (e) => e.className === 'badge-verouderd');
  assert.equal(badge(venster).length, 0);

  // nu een bestand dat drie maanden achterloopt
  const oud = opgezetVenster(lopendeParams(), { [maandVerschoven(-3)]: 10 });
  bewaarKoersen(oud.localStorage, { [maandVerschoven(-3)]: 10 }, VANDAAG);
  await startApp(oud);
  const oudeTekst = scherm(oud).textContent;
  assert.equal(badge(oud)[0].textContent, '2 maanden achter');
  assert.ok(oudeTekst.includes('draait de maandelijkse werkstroom niet meer'));

  // en één maand achterstand telt als één maand, in enkelvoud
  const bijna = opgezetVenster(lopendeParams(), { [maandVerschoven(-2)]: 10 });
  bewaarKoersen(bijna.localStorage, { [maandVerschoven(-2)]: 10 }, VANDAAG);
  await startApp(bijna);
  assert.equal(badge(bijna)[0].textContent, '1 maand achter');
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
  await grafiek.dispatch('click', { clientX: 1 });
  assert.ok(scherm(venster).textContent.includes('doelpad'));
  assert.ok(scherm(venster).textContent.includes('werkelijk'));
  // rechts: in de projectie
  const opnieuw = zoekAlle(scherm(venster), (e) => e.className === 'grafiek')[0];
  await opnieuw.dispatch('click', { clientX: 359 });
  assert.ok(scherm(venster).textContent.includes('verwacht'));
});

test('tap helemaal links valt op het begin van de grafiek', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  const grafiek = zoekAlle(scherm(venster), (e) => e.className === 'grafiek')[0];
  await grafiek.dispatch('click', { clientX: 0 });
  const regel = zoekAlle(scherm(venster), (e) => e.className === 'tapregel')[0];
  assert.ok(regel.textContent.includes('doelpad'));
  // Regressie: punt 0 is de nulstand vóór de eerste premie en heeft dus
  // noch een gerealiseerde noch een verwachte waarde. De app toonde daar
  // "verwacht € NaN"; nu hoort alleen het doelpad te verschijnen.
  assert.ok(!regel.textContent.includes('NaN'));
  assert.ok(!regel.textContent.includes('verwacht'));
  assert.ok(!regel.textContent.includes('werkelijk'));
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
  assert.ok(tekst.includes('Gemeten uit de koersen'));
  assert.ok(tekst.includes('12%'));
  // en de hele gemeten-kaart is de weg terug
  await zoekAlle(scherm(venster), (e) => e.tagName === 'button' &&
    e.className.startsWith('keuze') && e.textContent.includes('Gemeten uit'))[0].click();
  await spoel();
  assert.equal(laadParams(venster.localStorage).gebruikGemeten, true);
  assert.ok(scherm(venster).textContent.includes('gemeten, min'));
});

test('zonder meting wijst het rendementblok naar "Koersen vernieuwen"', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await tandwiel(venster).click();
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('Nog niets gemeten'));
  // de tekst noemt het minimum en de weg ernaartoe, niet een knop hieronder
  assert.ok(tekst.includes('minstens 3 jaar koershistoriek'));
  assert.ok(tekst.includes('Tik op "Koersen vernieuwen"'));
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
  assert.ok(tekst.includes('Fonds deed (10 jaar)'));
  assert.ok(tekst.includes('12%'));
  assert.ok(tekst.includes('bruto per jaar'));
  // en één zin die de vergelijking uitspreekt in procentpunten
  assert.match(tekst, /Na de beheerskost houdt het fonds .* netto over — .* punt (méér|minder) dan je nodig hebt\./);
});

test('een afgelopen polis toont geen vereist rendement meer', async () => {
  // Alle premies zijn betaald: het rendement kan de uitkomst niet meer sturen,
  // dus die rij hoort weg te blijven in plaats van een onzinnig getal te tonen.
  const venster = opgezetVenster(lopendeParams({ eindDatum: `${maandVerschoven(0)}-01` }));
  await startApp(venster);
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('Reserve vandaag'));
  // de tegel blijft staan, maar zonder cijfer: er valt niets meer te sturen
  assert.ok(tekst.includes('Nodig vanaf nu'));
  assert.ok(tekst.includes('alle premies zijn betaald'));
  // de tegel toont geen percentage meer; de statuskaart noemt nog wel waarmee
  // er doorgerekend is
  const tegel = zoekAlle(scherm(venster), (e) => e.className === 'tegel')[0];
  assert.ok(!tegel.textContent.includes('netto per jaar'));
});

test('een mislukte ophaling meet niets en laat de bestaande meting staan', async () => {
  const venster = opgezetVenster(lopendeParams({
    gemetenRendement: 0.12, gemetenMaanden: 120, gemetenTot: '2016-01',
  }));
  venster.fetchHandler = (url) => {
    if (url.includes('sw.js')) return { ok: true, text: async () => "const VERSIE = '2.0.0';" };
    return { ok: false, status: 404 };
  };
  await startApp(venster);
  await zoekKnop(scherm(venster), 'Koersen vernieuwen').click();
  await spoel();
  const params = laadParams(venster.localStorage);
  assert.equal(params.gemetenRendement, 0.12);
  assert.equal(params.gemetenMaanden, 120);
  assert.equal(params.rendementBruto, 0.07);
  assert.ok(!meldingen(venster).includes('Koersen bijgewerkt'));
  assert.ok(venster.document.getElementById('banners').textContent
    .includes('Koersen ophalen lukt niet'));
});

test('handmatige controle op vandaag zetten haalt het uitroepteken weg', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await tandwiel(venster).click();
  assert.equal(zoekAlle(scherm(venster), (e) => e.className === 'let-op').length, 3);
  assert.ok(scherm(venster).textContent.includes('nooit nagekeken'));
  const controleKnoppen = () => zoekAlle(scherm(venster),
    (e) => e.tagName === 'button' && e.textContent === 'Nagekeken');
  for (let i = 0; i < 3; i++) {
    // de knop zit in .controle-acties binnen .controle-rij, dus een niveau hoger kijken
    const knop = controleKnoppen().find(
      (k) => k.parentNode.parentNode.textContent.includes('nooit nagekeken'));
    await knop.click();
    await spoel();
  }
  const params = laadParams(venster.localStorage);
  assert.equal(params.terGecontroleerd, VANDAAG);
  assert.equal(params.beheerskostGecontroleerd, VANDAAG);
  assert.equal(params.eindtaksGecontroleerd, VANDAAG);
  assert.equal(zoekAlle(scherm(venster), (e) => e.className === 'let-op').length, 0);
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
  assert.ok(tekst.includes('simulatie geijkt op'));
  assert.ok(tekst.includes('(factor'));
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
  assert.ok(tekst.includes('Gerekend met je jaaroverzicht van'));
  assert.ok(tekst.includes('ZONDER KOERSEN'));
  // de grafiek blijft staan: doelpad, projectie en doellijn zijn er wel
  assert.equal(zoekAlle(scherm(venster), (e) => e.className === 'grafiek').length, 1);
  assert.ok(tekst.includes('jouw overzicht'));
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
  // Eerst de nieuwe service worker laten installeren, dan pas herladen:
  // anders komt de oude code uit de HTTP-cache terug en lijkt er niets te
  // gebeuren. Het opruimen van oude caches doet die worker zelf.
  assert.equal(venster.swBijgewerkt, true);
  assert.equal(venster.swGeregistreerd, 'sw.js');
  assert.equal(venster.herladen, 1);
});

test('bijwerken gaat door als de nieuwe worker de pagina niet overneemt', async () => {
  // Vangnet: neemt de nieuwe service worker het niet over — bijvoorbeeld omdat
  // hij al aan de beurt was — dan mag de knop niet blijven hangen op
  // "Bijwerken…". Na de tijdslimiet herlaadt de app alsnog.
  const venster = maakFakeVenster({ zonderOvername: true });
  venster.overnameMs = 10;
  bewaarParams(venster.localStorage, lopendeParams());
  bewaarKoersen(venster.localStorage, koersenVoorDrieMaanden(), VANDAAG);
  venster.localStorage.setItem('actieveVersie', '1.0.0');
  venster.fetchTekst = "const VERSIE = '2.0.0';";
  await startApp(venster);
  const banners = venster.document.getElementById('banners');
  const knop = zoekKnop(banners, 'Nu bijwerken');
  await knop.click();
  await spoel(12);
  assert.equal(venster.swBijgewerkt, true);
  assert.equal(venster.herladen, 1);
  assert.equal(knop.textContent, 'Bijwerken…');
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

test('de knop op de lege statuskaart opent het instellingenpaneel', async () => {
  const venster = opgezetVenster(null, null);
  await startApp(venster);
  // De sheet staat al open en blijft dat ook als je hem sluit: zonder
  // gegevens kan de app niets anders tonen. De knop op de kaart erachter is
  // de expliciete weg ernaartoe.
  await zoekKnop(scherm(venster), 'Klaar').click();
  await spoel();
  assert.ok(scherm(venster).textContent.includes('Jouw polis'));
  await zoekKnop(scherm(venster), 'Gegevens invullen').click();
  await spoel();
  assert.ok(scherm(venster).textContent.includes('Jouw polis'));
});

test('Escape sluit het instellingenpaneel', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await tandwiel(venster).click();
  assert.ok(scherm(venster).textContent.includes('Jouw polis'));
  await venster.document.dispatch('keydown', { key: 'Escape' });
  assert.ok(!scherm(venster).textContent.includes('Jouw polis'));
  // een andere toets doet niets, en met een gesloten paneel ook Escape niet
  await venster.document.dispatch('keydown', { key: 'Escape' });
  await venster.document.dispatch('keydown', { key: 'a' });
  assert.ok(!scherm(venster).textContent.includes('Jouw polis'));
});

test('een tap op een lijn boven het doelpad toont een positief verschil', async () => {
  // De koers verdrievoudigde: de reserve staat dan boven het doelpad en het
  // verschil in de tapregel hoort met een plus te beginnen.
  const koersen = {
    [maandVerschoven(-2)]: 10, [maandVerschoven(-1)]: 10, [maandVerschoven(0)]: 30,
  };
  const venster = opgezetVenster(lopendeParams(), koersen);
  await startApp(venster);
  const grafiek = zoekAlle(scherm(venster), (e) => e.className === 'grafiek')[0];
  // de laatste betaalde maand: daar telt de koers van vandaag
  await grafiek.dispatch('click', { clientX: 3 });
  const regel = zoekAlle(scherm(venster), (e) => e.className === 'tapregel')[0];
  assert.ok(regel.textContent.includes('werkelijk'));
  assert.ok(regel.textContent.includes('· +'));
});

test('een afgelopen polis met meting toont de tegels zonder verdictzin', async () => {
  // Er valt niets meer te sturen, dus de vergelijking "nodig versus gehaald"
  // heeft geen betekenis meer.
  const venster = opgezetVenster(lopendeParams({
    eindDatum: `${maandVerschoven(0)}-01`,
    gemetenRendement: 0.12, gemetenMaanden: 120, gemetenTot: '2016-01',
  }));
  await startApp(venster);
  const tekst = scherm(venster).textContent;
  assert.ok(tekst.includes('alle premies zijn betaald'));
  assert.ok(tekst.includes('Fonds deed (10 jaar)'));
  assert.ok(!tekst.includes('Na de beheerskost'));
});

test('een controle van lang geleden krijgt "ouder dan een jaar" bij de datum', async () => {
  const venster = opgezetVenster(lopendeParams({ terGecontroleerd: '2020-01-01' }));
  await startApp(venster);
  await tandwiel(venster).click();
  const rij = zoekAlle(scherm(venster),
    (e) => e.className === 'controle-datum verouderd')[0];
  assert.ok(rij.textContent.includes('nagekeken op 01/01/2020'));
  assert.ok(rij.textContent.includes('ouder dan een jaar'));
  // een controle van vandaag krijgt die staart niet
  await zoekAlle(scherm(venster), (e) => e.tagName === 'button' && e.textContent === 'Nagekeken')[0].click();
  await spoel();
  const vers = zoekAlle(scherm(venster), (e) => e.className === 'controle-datum')[0];
  assert.ok(vers.textContent.includes(`nagekeken op ${VANDAAG.slice(8)}/`));
  assert.ok(!vers.textContent.includes('ouder dan een jaar'));
});

test('de instellingen zijn een eigen pagina: terug sluit ze, niet de app', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  assert.equal(venster.location.hash, '');
  await tandwiel(venster).click();
  await spoel();
  // het paneel staat open én in de geschiedenis
  assert.ok(scherm(venster).textContent.includes('Jouw polis'));
  assert.equal(venster.location.hash, '#instellingen');
  assert.equal(venster.geschiedenis.length, 2);
  // de terugveeg van het toestel sluit het paneel in plaats van de app
  await venster.history.back();
  await spoel();
  assert.ok(!scherm(venster).textContent.includes('Jouw polis'));
  assert.equal(venster.location.hash, '');
  // en "Klaar" doet hetzelfde: terug in de geschiedenis, niet een pagina erbij
  await tandwiel(venster).click();
  await spoel();
  await zoekKnop(scherm(venster), 'Klaar').click();
  await spoel();
  assert.ok(!scherm(venster).textContent.includes('Jouw polis'));
  assert.equal(venster.geschiedenis.length, 1);
});

test('rechtstreeks op #instellingen landen opent het paneel en gooit je er niet uit', async () => {
  // Herladen met het paneel open, of een gedeelde link: dan is de pagina van
  // de instellingen niet door ons toegevoegd en mag "Klaar" niet terug.
  const venster = maakFakeVenster({ hash: '#instellingen' });
  bewaarParams(venster.localStorage, lopendeParams());
  bewaarKoersen(venster.localStorage, koersenVoorDrieMaanden(), VANDAAG);
  await startApp(venster);
  assert.ok(scherm(venster).textContent.includes('Jouw polis'));
  await zoekKnop(scherm(venster), 'Klaar').click();
  await spoel();
  assert.ok(!scherm(venster).textContent.includes('Jouw polis'));
  // de hash is opgeruimd zonder de app te verlaten
  assert.equal(venster.location.hash, '');
  assert.equal(venster.geschiedenis.length, 1);
});

test('de statuskaart zegt met welk rendement er doorgerekend is', async () => {
  // Zonder die regel is een fors overschot een raadsel: het hangt volledig aan
  // het gekozen rendement, en dat is standaard het gemeten cijfer.
  const venster = opgezetVenster(lopendeParams({
    gemetenRendement: 0.12, gemetenMaanden: 120, gemetenTot: '2016-01',
  }));
  await startApp(venster);
  const basis = zoekAlle(scherm(venster), (e) => e.className === 'status-basis')[0];
  assert.match(basis.textContent,
    /Doorgerekend met .* netto per jaar, het gemeten rendement van het fonds over 10 jaar\./);
  // met de eigen aanname zegt hij dat
  const eigen = opgezetVenster(lopendeParams({ gebruikGemeten: false }));
  await startApp(eigen);
  assert.ok(zoekAlle(scherm(eigen), (e) => e.className === 'status-basis')[0]
    .textContent.includes('jouw eigen aanname'));
});

test('de reserve krijgt een eigen datum, en die datum bepaalt de ijking', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await tandwiel(venster).click();
  const datumVeld = veld(venster, 'Datum van dat overzicht');
  // standaard vandaag, maar bewerkbaar
  assert.equal(datumVeld.value, VANDAAG);
  const vorigeMaand = `${maandVerschoven(-1)}-15`;
  datumVeld.value = vorigeMaand;
  veld(venster, 'Reserve volgens het overzicht').value = '400';
  await zoekKnop(scherm(venster), 'Bewaar reserve').click();
  await spoel();
  const params = laadParams(venster.localStorage);
  assert.equal(params.echteReserve, 400);
  assert.equal(params.echteReserveDatum, vorigeMaand);
  assert.equal(params.ijkDatum, vorigeMaand);
  // geijkt tegen de simulatie van díé datum, niet die van vandaag
  const opDatum = overzicht(lopendeParams(), koersenVoorDrieMaanden(), vorigeMaand);
  assert.ok(Math.abs(params.ijkFactor - 400 / opDatum.reserve) < 1e-9);
  // het bedrag en de datum staan voorgevuld als je terugkomt
  assert.equal(veld(venster, 'Reserve volgens het overzicht').value, '400');
  assert.equal(veld(venster, 'Datum van dat overzicht').value, vorigeMaand);
  assert.ok(scherm(venster).textContent.includes('simulatie geijkt op'));
});

test('een leeg datumveld bij de reserve valt terug op vandaag', async () => {
  const venster = opgezetVenster();
  await startApp(venster);
  await tandwiel(venster).click();
  veld(venster, 'Datum van dat overzicht').value = '';
  veld(venster, 'Reserve volgens het overzicht').value = '400';
  await zoekKnop(scherm(venster), 'Bewaar reserve').click();
  await spoel();
  assert.equal(laadParams(venster.localStorage).echteReserveDatum, VANDAAG);
});
