# CLAUDE.md — ontwikkelaarsdocumentatie

SPEC.md is de bron van waarheid voor gedrag. Dit document motiveert de
architectuurkeuzes en houdt de valkuilen bij.

## Architectuur

Vanilla HTML, CSS en JavaScript met ES-modules. Geen framework, geen
build-stap, geen runtime-dependencies. De vier hoofdschermen (Dashboard,
Transacties, Regels, Instellingen) plus werklijst en detailweergave worden via
hash-routing (`js/router.js`) gerenderd in één `<main>`; alle DOM wordt
opgebouwd met de helper `el()` uit `js/dom.js`, zonder innerHTML (met als enige
uitzondering de SVG-grafiek, die als string wordt gegenereerd).

### Eigen CSV-parser

`js/csv.js` is een eigen module van zo'n vijftig regels die quoted velden per
RFC 4180-logica verwerkt (puntkomma's en regelovergangen binnen quotes, `""`
als escape). De bevroren referentie-export in `fixtures/kbc-export.csv` —
inclusief een omschrijving met puntkomma, escaped quotes én een regelovergang —
wordt foutloos verwerkt (zie `tests/csv.test.js`), dus PapaParse vendoren was
niet nodig. Encoding: eerst UTF-8 met `fatal: true`, bij een decodeerfout
Windows-1252, beide via `TextDecoder`.

### Cachestrategie: cache-first

`sw.js` bedient alle app-assets cache-first. Motivatie: het doel is
offline-first en de app haalt geen externe data op — er is dus nooit een reden
om voor een asset naar het netwerk te gaan. Updates lopen niet via de
asset-fetches maar via een aparte, cache-gebuste fetch van `sw.js` zelf (bij
start en bij `visibilitychange`), die de service worker bewust nooit
onderschept. De constante `VERSIE` in `sw.js` is tegelijk cachenaam en
updatesignaal; nergens anders in de code staat een versienummer. Een nieuwe
versie toont alleen een balk; de gebruiker beslist over het herladen.

### Eigen SVG-grafiek

`js/chart.js` genereert de gestapelde balkgrafiek als SVG-string (± dertig
regels). Een grafiekbibliotheek zou een dependency en een veelvoud aan code
binnenhalen voor één grafiektype met vaste kleuren; zelf tekenen is hier
kleiner, volledig testbaar en offline gegarandeerd.

### Opslag

IndexedDB via de dunne promise-wrapper `js/db.js` (geen Dexie). Zes object
stores conform SPEC 11.2. Geldbedragen zijn overal integer-centen; delen door
100 gebeurt uitsluitend in de centrale formatter (`js/format.js`,
`Intl.NumberFormat` nl-BE). Datums zijn intern ISO-strings zodat vergelijken
lexicografisch kan.

### Twee extra transactievelden bovenop SPEC 3.3

- `ruleId`: welke regel de transactie categoriseerde. Nodig voor de
  detailweergave ("welke regel was dat") en voor de hitCount-telling.
- `manualClass`: onderscheidt een door de gebruiker gezette klasse-
  overschrijving van een door een regel gezette. SPEC 4.3 eist dat de
  overschrijving van de gebruiker herclassificatie overleeft, terwijl een
  regel-klasse juist mee moet bewegen met de regelset; zonder deze vlag zijn
  die twee niet uit elkaar te houden.

## Tests

`npm test` draait de volledige suite (Node 22+, `node:test`, geen
dependencies) met dekkingsdrempels van honderd procent op regels, takken en
functies voor alle bestanden onder `js/` — de harde faalvoorwaarde uit SPEC 12.
De UI wordt getest tegen een minimale eigen fake-DOM en fake-IndexedDB in
`tests/helpers/`; zo draait ook al het viewcode-gedrag (klikken, formulieren,
undo-toasts, retry-flows) headless. `sw.js` draait in de service-worker-context
en wordt tekstueel getest (assetlijst versus index.html en versus de bestanden
op schijf). Wat alleen op het toestel kan, staat in
`docs/handmatige-checklist.md`; bij elke release ligt die checklist bij de
gebruiker.

Fixture verversen: `scripts/ververs-fixture.sh pad/naar/nieuwe-export.csv`,
daarna `npm test`.

## Valkuilen

Bijgehouden vanaf de eerste betaalde les.

- **KBC sluit elke datarij af met een puntkomma** (een lege 19e kolom), maar
  de header niet; en de regeleindes zijn kale CR's (`\r`), geen LF. Wie op
  exact achttien velden per rij test, keurt daardoor élke echte rij af. De
  parser verwerkt CR/LF/CRLF en `zonderSlotkolom()` knipt de lege slotkolom
  weg (les van de eerste echte export, augustus 2026).
- **Naam tegenpartij is bij domiciliëringen vaak leeg**: de schuldeiser staat
  dan alleen in de omschrijving ("SCHULDEISER : TELENET BV"). Regels op
  counterpartyName missen die transacties; de suggestielijst matcht daarom
  ook op description, en regels op description zijn dan de juiste keuze.
- **KBC-kolom "Valuta" is de valutadatum, "Munt" de munteenheid.** Verwar ze
  niet; de kolomnamen suggereren het omgekeerde.
- **Standaardcategorieën evolueren mee** (bv. "IPT en pensioen", op vraag van
  de gebruiker): de opstartcode zaait niet alleen een lege opslag, maar vult
  bij bestaande installaties ook ontbrekende standaardcategorieën aan — op id,
  zonder ooit bestaande (mogelijk hernoemde) categorieën te overschrijven.
  Let op met korte suggestietrefwoorden: "ipt" zit ook in "subscription",
  daarom matchen we op "bedrijfsleidersplan" en "pensioen".
- **`docs/`-map en hash-URL's:** interne links moeten altijd via `#/…` lopen;
  een echte pathwijziging herlaadt de app en verliest de schermstaat.
- **iOS kan IndexedDB opruimen** bij weinig gebruikte webapps. Antwoord:
  maandelijkse backup-herinnering plus één poging tot
  `navigator.storage.persist()` bij de start — het resultaat daarvan is
  uitdrukkelijk geen garantie.
- **Sorteercomparators en dekking:** `Array.prototype.sort` roept een
  comparator bij kleine of al gesorteerde arrays maar in één richting aan;
  tests hebben ongesorteerde invoer van minstens drie elementen nodig om beide
  takken te raken.
- **`confirm()` versus undo-toast:** destructieve acties (categorie, regel,
  backup terugzetten) vragen `confirm()`; frequente omkeerbare acties
  (eenmalig markeren, hercategoriseren) krijgen een undo-toast van circa zes
  seconden. Niet mengen.
