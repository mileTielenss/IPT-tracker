# CLAUDE.md — ontwikkelaarsdocumentatie

SPEC.md is de bron van waarheid voor gedrag. Dit document motiveert de
architectuurkeuzes en houdt de valkuilen bij.

## Architectuur

Vanilla HTML, CSS en JavaScript met ES-modules. Geen framework, geen
build-stap, geen runtime-dependencies. De app wordt statisch geserveerd vanaf
GitHub Pages; alle paden in `index.html`, `sw.js` en het manifest zijn relatief
(`./`) zodat ze ook onder een subpad werken.

Er is **één scherm** en dus geen router: `js/app.js` bouwt bij elke `render()`
de volledige `<main>` opnieuw op uit statusvlak, grafiek, kerngetallen, de
ververs-knop en — uitgeklapt — het instellingenpaneel. Alle DOM komt uit de
helper `el()` in `js/dom.js`, zonder innerHTML; enige uitzondering is de
SVG-grafiek, die als string wordt gegenereerd en in één keer wordt gezet.

De modules onder `js/` zijn vlak, zonder submappen, en hebben elk één taak:
`opslag.js` (parameters en cache), `reken.js` (de kernberekening),
`koersen.js` (ophalen en parsen), `grafiek.js` (SVG), `format.js`
(nl-BE-formattering), `meldingen.js` (banners en toasts), `dom.js` en `app.js`
(alle UI en bedrading). Alleen `app.js` raakt `window`, `document` en
`localStorage` aan; de rest is pure functies. Daardoor is bijna alles testbaar
zonder DOM.

### Opslag: localStorage in plaats van IndexedDB

Wat bewaard moet blijven is een handvol parameters, een klein woordenboek met
maandkoersen (bij een looptijd van veertig jaar zijn dat een paar honderd
getallen) en een paar controledatums. Twee sleutels, twee JSON-blobs, altijd in
hun geheel gelezen en geschreven, nooit gequeryd. IndexedDB zou daarvoor een
asynchrone wrapper, versiemigraties en object stores binnenhalen zonder één
voordeel: er is niets te indexeren en niets te doorlopen. localStorage is
synchroon, wat de render-code aanzienlijk vereenvoudigt — `render()` kan
gewoon lezen en tekenen, zonder await. De grens van vijf megabyte is voor deze
data nooit in zicht.

De prijs staat in de valkuilen: localStorage hangt aan de origin en is weg als
de gebruiker sitedata wist.

### De kernberekening (`js/reken.js`)

1. **Units-simulatie.** Voor elke verstreken premiemaand sinds de startdatum
   wordt het nettobedrag (premie min instapkost) omgezet in units tegen de
   *interne* NAV van die maand: `NAV_intern(m) = koers(m) × (1 − beheerskost)^(m/12)`.
   De beheerskost van de verzekeraar zit dus niet in een aparte kostenpost maar
   als een aanhoudende afwaardering in de NAV zelf — dat is precies hoe een
   tak-23-fonds met een beheersvergoeding zich gedraagt, en het maakt de
   reserve één vermenigvuldiging: Σ units × NAV_intern(vandaag). Ontbrekende
   maandkoersen vallen terug op de laatst bekende koers; het aantal gemiste
   maanden wordt doorgegeven zodat het scherm het kan melden.
2. **Doelpad.** Maandelijkse inleg van datzelfde nettobedrag tegen het netto
   rendement, premie aan het begin van de maand, van start tot einddatum. Dit
   is de grijze lijn en tegelijk de referentie voor "je ligt N% voor/achter".
3. **Projectie.** De reserve van vandaag doorgerekend met de resterende
   premies tegen hetzelfde netto rendement, tot de einddatum: de verwachte
   eindwaarde E.
4. **Status.** E vergeleken met het brutodoel (`doelNetto / (1 − eindtaks)`):
   groen vanaf honderd procent, oranje vanaf negentig, daaronder rood. De
   delta wordt bruto én netto getoond.

De **ijkfactor** hangt aan het einde van stap 1: `reserve = ruwe simulatie ×
ijkFactor`. Eén getal, één plaats, en het houdt de simulatie zelf zuiver.

### Handgetekende SVG in plaats van een chartlib

`js/grafiek.js` bouwt de grafiek als SVG-string. Er is precies één grafiek, met
vier vaste elementen (doelpad, werkelijke reserve, projectie, doellijn), vaste
kleuren en geen zoom of animatie. Een grafiekbibliotheek zou daarvoor een
dependency en een veelvoud aan code binnenhalen, terwijl de app juist
dependency-vrij en offline-gegarandeerd moet zijn. Zelf tekenen is hier kleiner
en volledig testbaar: de tests kunnen de gegenereerde string rechtstreeks
inspecteren. De tap-op-grafiek is geen tooltip-laag maar een omrekening van de
horizontale klikfractie naar een maandindex (`waardeOpPunt`), waarna de waarden
als gewone tekst onder de grafiek verschijnen.

### Koersen en de CORS-proxy

De Yahoo-chart-API stuurt geen CORS-headers, dus een browserfetch erop faalt
altijd. `js/koersen.js` bouwt daarom de doel-URL en stuurt die door een
doorgeefluik:

- **Optie A** — een eigen proxy (bijvoorbeeld een gratis Cloudflare Worker),
  in te vullen als proxy-URL in de instellingen. Betrouwbaar, maar vereist
  setup.
- **Optie B** — `api.allorigins.win`, nul setup, af en toe traag of down.

`haalKoersen()` probeert A en valt bij een fout of een niet-ok status terug op
B; is er geen A ingesteld, dan gaat het meteen naar B. Alleen als beide falen
gooit de functie de laatste fout door, waarna het scherm een infomelding toont
en de bestaande koersen laat staan. De `fetch` wordt als argument
binnengegeven, zodat de tests geen netwerk nodig hebben.

Deze verzoeken gaan naar een **ander domein**, en dat is precies waarom de
service worker alleen same-origin verzoeken onderschept (zie hieronder).

### Cachestrategie en het VERSIE-mechanisme

`sw.js` bedient de app-assets cache-first. Motivatie: het doel is offline-first
en de app-assets veranderen alleen bij een release — er is dus nooit een reden
om voor een asset naar het netwerk te gaan. Live data (de koersen) loopt niet
via de cache maar via een expliciete gebruikersactie naar een extern domein, en
die verzoeken laat de service worker ongemoeid: hij controleert de origin en
bemoeit zich alleen met eigen bestanden.

Updates lopen niet via de asset-fetches maar via een aparte, cache-gebuste
fetch van `sw.js` zelf (bij start en bij `visibilitychange`), die de service
worker bewust nooit onderschept. `app.js` leest de `VERSIE`-constante als tekst
uit dat antwoord en vergelijkt ze met de versie die bij de vorige start actief
was. De constante `VERSIE` in `sw.js` is tegelijk cachenaam en updatesignaal;
nergens anders in de code staat een versienummer. Een nieuwe versie toont
alleen een balk; de gebruiker beslist over het herladen, waarna registraties en
caches worden opgeruimd en er precies één keer herladen wordt.

## Tests

`npm test` draait de volledige suite (Node 22+, `node:test`, geen
dependencies) met dekkingsdrempels van honderd procent op regels, takken en
functies voor alle bestanden onder `js/` — de harde faalvoorwaarde uit SPEC 11.
De rekenkern wordt rechtstreeks getest; de UI draait tegen een minimale eigen
fake-DOM en fake-localStorage in `tests/helpers/`, zodat kliks, formulieren,
de ververs-flow en de updatebalk headless getest worden.
`tests/helpers/omgeving.js` levert de gedeelde parameterset uit de spec en een
koersenbouwer, zodat testgegevens niet in elke test opnieuw worden verzonnen.
`sw.js` draait in de service-worker-context en wordt tekstueel getest: de
assetlijst tegen `index.html` en tegen de bestanden op schijf, en het
fetch-gedrag (niet zichzelf, alleen same-origin). Wat alleen op het toestel kan
staat in `docs/handmatige-checklist.md`; bij elke release ligt die checklist
bij de gebruiker.

## Valkuilen

- **De TER van de ETF zit al in de koers.** De opgehaalde slotkoersen zijn
  NAV's ná fondskosten; de TER is daar al uit weggelekt. Wie hem in de
  simulatie nog eens aftrekt, telt dubbel en maakt de app structureel te
  pessimistisch. De TER staat daarom alleen als informatief, controleerbaar
  veld in de instellingen — het label zegt dat er ook bij. Enkel de
  *beheerskost van de verzekeraar* wordt actief van de NAV afgetrokken, want
  die zit niet in de ETF-koers.
- **De units-simulatie is een benadering, geen boekhouding.** Ze werkt met
  maandslotkoersen, één premiedatum per maand en een gladde
  kostenafwaardering; Vivium werkt met echte aankoopdata, echte koersen en een
  eigen kostenafrekening. Zonder de jaarlijkse ijking tegen het
  Vivium-overzicht klopt het bedrag niet op de euro. Voor rood/groen is dat
  geen probleem, voor elke uitspraak over een exact bedrag wel.
- **IJken is idempotent, niet cumulatief.** Het ijkveld deelt eerst door de
  bestaande `ijkFactor` om de ruwe simulatiewaarde terug te vinden en berekent
  daaruit de nieuwe factor. Wie dat weglaat en gewoon `echte / zicht.reserve`
  neemt, vermenigvuldigt de correctie elk jaar met zichzelf.
- **localStorage hangt aan de origin en heeft geen kopie.** Sitedata wissen,
  de app verwijderen of een andere origin (bijvoorbeeld een preview-URL of een
  eigen domein naast het `github.io`-adres) betekent: alles opnieuw invullen.
  Er is geen backend en dus geen herstel. `navigator.storage.persist()` wordt
  bij de start één keer geprobeerd, maar het resultaat daarvan is
  uitdrukkelijk geen garantie — iOS kan opslag van weinig gebruikte webapps
  alsnog opruimen.
- **Nooit persoonlijke cijfers in de code.** De repo is publiek. Premie,
  doelkapitaal, datums, reservestanden en ijkbedragen horen in localStorage,
  niet in `STANDAARD_PARAMS`, niet in een test-fixture met echte waarden, niet
  in een commit-bericht. `STANDAARD_PARAMS` laat de persoonlijke velden
  bewust leeg; `paramsVolledig()` stuurt de gebruiker dan naar het
  invulscherm. De testset in `tests/helpers/omgeving.js` gebruikt de
  referentiecijfers uit de spec, niet de echte polis.
- **De service worker mag koersverzoeken niet onderscheppen.** De fetch-handler
  controleert `event.request.url.startsWith(self.location.origin)` en laat al
  het andere door. Zonder die controle probeert de cache-first-strategie ook
  proxy- en Yahoo-verzoeken te beantwoorden en krijgt de gebruiker eeuwig
  dezelfde koersen — of een mislukte ophaling die offline nooit meer herstelt.
- **De service worker mag zichzelf niet onderscheppen.** De updatecheck haalt
  `sw.js` cache-gebust op; wordt dat verzoek uit de cache bediend, dan leest de
  app voor altijd zijn eigen oude `VERSIE` en verschijnt de updatebalk nooit.
  De handler springt daarom eerst op `url.includes('sw.js')`.
- **De updatecheck leest `sw.js` als tekst.** `app.js` matcht letterlijk op
  `VERSIE = '…'`. Wie die regel herformatteert (dubbele quotes, een berekende
  waarde, een andere naam) breekt de updatebalk stilzwijgend — de app blijft
  gewoon draaien. De sw-assettest pint de vorm vast.
- **Percentages worden als fractie bewaard, als procent getoond.** In de opslag
  staat `0.0125`, in het invoerveld `1.25`. De omrekening zit alleen in
  `veldRij()`; wie elders een percentage leest of schrijft moet weten aan welke
  kant van die deling hij staat.
- **Een nulwaarde toont als leeg veld.** De invoervelden renderen `0` bewust
  als lege string, zodat een nog niet ingevulde premie geen misleidende nul
  toont. Gevolg: een parameter die je écht op nul wil zetten (bijvoorbeeld een
  instapkost van 0%) ziet er daarna leeg uit. Dat is bekend en aanvaard; ga er
  niet van uit dat leeg "niet ingesteld" betekent.
- **Bedragen zijn gewone floats in euro, geen centen.** Anders dan bij
  klassieke boekhoudsoftware wordt hier niets opgeteld dat exact moet kloppen:
  alles is een projectie met een marge van procenten. Afronden gebeurt
  uitsluitend in `js/format.js`. Voer geen centen-integers in — de
  units-simulatie deelt en machtsverheft, dus dat zou alleen schijnprecisie
  toevoegen.
- **Datums zijn ISO-strings en worden lexicografisch vergeleken.** De
  premieteller bouwt `'2026-01-01'`-achtige sleutels en vergelijkt met `<` en
  `<=`. Dat werkt alleen zolang alles nul-gepad en even lang is; een
  `Date`-object of een dagnummer zonder padding breekt de vergelijking. Let ook
  op een startdag na de 28e: de gegenereerde sleutel voor februari bestaat dan
  niet als kalenderdatum, maar de vergelijking blijft correct omdat er nooit
  een `Date` van gemaakt wordt. Maak er dus ook geen `Date` van.
- **Maandsleutels zijn UTC-maanden.** `parseChart()` zet de Yahoo-timestamps om
  via `toISOString().slice(0, 7)`; `maandSleutel()` bouwt dezelfde vorm uit de
  startdatum. Beide moeten in hetzelfde formaat blijven (`YYYY-MM`, met
  padding), anders vindt de simulatie geen enkele koers en valt alles terug op
  "geen koersdata".
- **Het doelpad heeft één element méér dan het aantal premies.** `pad[0]` is de
  nulstand vóór de eerste premie, dus `pad[betaald]` is de stand ná `betaald`
  premies — terwijl de reeks uit de units-simulatie bij de éérste premie
  begint. Vandaar dat de grafiek die reeks vanaf index 1 tekent. Off-by-one
  hier verschuift de hele werkelijke lijn een maand.
- **`pctVsPad` deelt door het doelpad van vandaag.** Dat mag alleen omdat
  `koersBeschikbaar` impliceert dat er minstens één premie betaald is en het
  pad dus positief is. Wie die volgorde in `overzicht()` verandert, riskeert
  een deling door nul in het statusvlak.
- **Sorteercomparators en dekking:** `Array.prototype.sort` roept een
  comparator bij kleine of al gesorteerde arrays maar in één richting aan;
  tests hebben ongesorteerde invoer van minstens drie elementen nodig om beide
  takken te raken.
