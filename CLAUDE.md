# CLAUDE.md — ontwikkelaarsdocumentatie

SPEC.md is de bron van waarheid voor gedrag. Dit document motiveert de
architectuurkeuzes en houdt de valkuilen bij.

## Architectuur

Vanilla HTML, CSS en JavaScript met ES-modules. Geen framework, geen
build-stap, geen runtime-dependencies. De app wordt statisch geserveerd vanaf
GitHub Pages; alle paden in `index.html`, `sw.js` en het manifest zijn relatief
(`./`) zodat ze ook onder een subpad werken.

Er is **één scherm** en dus geen router: `js/app.js` bouwt bij elke `render()`
de volledige `<main>` opnieuw op uit statuskaart, grafiek, kerngetallen,
ververs-knop, voettekst en — geopend — de instellingen-sheet. Die sheet is
geen route en geen dialoogcomponent maar een `position: fixed`-overlay achter
één booleaanse vlag; het paneel is ruim duizend pixels lang en zou onder het
dashboard geplakt betekenen dat je twee keer per jaar langs een grafiek scrolt
die je net gelezen hebt. Alle DOM komt uit de helper `el()` in `js/dom.js`,
zonder innerHTML; de enige uitzonderingen zijn de SVG-grafiek en de legende,
die als string worden gegenereerd en in één keer worden gezet.

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
vaste elementen (assen, raster, doelpad, werkelijke reserve, projectie,
doellijn, vandaag-markering), vaste kleuren en geen zoom of animatie. Een
grafiekbibliotheek zou daarvoor een dependency en een veelvoud aan code
binnenhalen, terwijl de app juist dependency-vrij en offline-gegarandeerd moet
zijn. Zelf tekenen is hier kleiner en volledig testbaar: de tests kunnen de
gegenereerde string rechtstreeks inspecteren.

Drie beslissingen sturen de vorm. **`asVerdeling()`** zoekt voor vier én vijf
gridlijnen de kleinste mooie stap ({1, 2, 2,5, 5} × 10^k) waarvan het product
de gevraagde waarde haalt, en neemt daarvan de krapste bovengrens; een vaste
"vijf ticks, stap naar boven afgerond" zou tot bijna twee keer te veel lege
ruimte geven. **`jaarLabels()`** laat een decennium weg waarvan het midden
binnen `LABEL_MARGE` van de plotrand ligt, want een jaartal van vier cijfers is
op 11 px zo'n 24 px breed en zou anders in het start- of eindlabel lopen; de
tick blijft wel staan. En **`dun()`** houdt van doelpad en projectie elk derde
punt plus altijd het laatste: 577 punten op 276 px zijn visueel identiek aan
193 en verdrievoudigen de string bij elke render. De werkelijke lijn blijft
maandelijks — die is kort, en het is de enige gemeten reeks.

De tap-op-grafiek is geen tooltip-laag maar een omrekening van de horizontale
klikfractie naar een maandindex (`waardeOpPunt`), waarna de waarden als gewone
tekst onder de grafiek verschijnen. De fractie komt uit `clientX` min
`getBoundingClientRect().left`, níét uit `offsetX`: dat laatste is in Safari
relatief tot het geraakte kindelement, dus een tik op een lijn levert een
ander jaar op dan een tik op de achtergrond ernaast.

De legende staat als HTML onder de SVG in plaats van erin, zodat ze wrapt op
smalle schermen en meeschaalt met de tekstinstelling van het toestel;
`legendeHtml()` tekent de sleuteltjes met exact dezelfde streek als de grafiek
zelf. `tabelRijen()` levert dezelfde grafiek als cijfers voor de uitklaptabel
eronder — de enige manier om de inhoud voor te lezen, en gratis controleerbaar
bij het ijken.

### Koersen: het probleem is CORS, de oplossing is een build-stap

De Yahoo-chart-API stuurt geen CORS-headers. Een browser op
`miletielenss.github.io` mag dat antwoord dus niet lezen — niet omdat Yahoo
weigert, maar omdat de browser het tegenhoudt. De eerste versies losten dat op
met een publiek doorgeefluik (`allorigins.win` en consorten). Dat werkt tot
het niet werkt: die gratis diensten worden zwaar misbruikt, liggen geregeld
plat en rate-limiten hele IP-blokken. Op het toestel van de gebruiker faalden
op een gegeven moment alle drie tegelijk, en de knop deed dus gewoon niets.

De omweg is overbodig zodra je het verzoek niet in de browser doet.
`scripts/koersen-ophalen.mjs` draait in GitHub Actions, waar geen
same-origin-policy bestaat: daar antwoordt Yahoo rechtstreeks. Het schrijft
`data/koersen.json` en de werkstroom publiceert dat mee. Voor de app is het
daarna een doodgewoon bestand op de eigen origin — geen CORS, geen derde
partij, en meteen ook offline beschikbaar via de service worker.

Dat kan alleen omdat de app **maand**koersen nodig heeft. Een maand die nog
loopt heeft geen slotkoers, dus verser dan maandelijks bestaat niet; de
werkstroom draait op de tweede van elke maand plus bij elke publicatie. Het
bestand is klein (honderd maanden ≈ 4 kB) en de commit-diff is één regel,
omdat de sleutels gesorteerd worden weggeschreven.

De proxyketen blijft als vangnet in `bronnen()` staan, want het gepubliceerde
bestand bevat één fonds. Wie in de instellingen een andere ticker zet, valt
door naar Yahoo-via-proxy. `leesBestand()` bewaakt dat: een bestand met een
andere ticker dan de ingestelde gooit, in plaats van stilzwijgend de koersen
van een vreemd fonds door te geven. `haalKoersen()` loopt de bronnen af tot er
één bruikbare koersen geeft en gooit anders de laatste fout, waarna het scherm
een blijvende banner toont en de bestaande koersen laat staan. De `fetch`
wordt als argument binnengegeven, zodat de tests geen netwerk nodig hebben.

De proxyverzoeken gaan naar een **ander domein**, en dat is precies waarom de
service worker alleen same-origin verzoeken onderschept (zie hieronder).

### Cachestrategie en het VERSIE-mechanisme

`sw.js` bedient de app-assets cache-first. Motivatie: het doel is offline-first
en de app-assets veranderen alleen bij een release — er is dus nooit een reden
om voor een asset naar het netwerk te gaan.

Op één na. `data/koersen.json` verandert wél tussen releases, want de
maandelijkse werkstroom zet er een maand bij zonder dat `VERSIE` opschuift.
Dat bestand krijgt daarom een eigen tak in de fetch-handler: netwerk eerst, en
het antwoord gaat meteen de cache in; mislukt het netwerk, dan antwoordt de
cache. Zo blijft de app offline werken met de laatst gepubliceerde koersen
zonder ooit vast te lopen op de koersen van de installatiedag.

Verzoeken naar de doorgeefluiken (het vangnet voor een eigen ticker) gaan naar
een extern domein en laat de service worker ongemoeid: hij controleert de
origin en bemoeit zich alleen met eigen bestanden.

Updates lopen niet via de asset-fetches maar via een aparte, cache-gebuste
fetch van `sw.js` zelf (bij start en bij `visibilitychange`), die de service
worker bewust nooit onderschept. `app.js` leest de `VERSIE`-constante als tekst
uit dat antwoord en vergelijkt ze met de versie die bij de vorige start actief
was. De constante `VERSIE` in `sw.js` is tegelijk cachenaam en updatesignaal;
nergens anders in de code staat een versienummer. Een nieuwe versie toont
alleen een balk; de gebruiker beslist over het herladen.

Dat herladen doet drie dingen in een vaste volgorde, en die volgorde is de hele
truc: de nieuwe worker registreren, wachten tot hij deze pagina overneemt
(`controllerchange`, met een tijdslimiet als vangnet), en pas dán herladen.
Meteen herladen wordt nog door de óude worker bediend en levert de oude bytes —
het scherm ziet er dan na het bijwerken exact hetzelfde uit, alsof de knop niets
deed. Het opruimen van oude caches doet de nieuwe worker zelf in zijn
`activate`.

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
- **De sheet is een geschiedenispagina, geen vlag.** Openen doet een
  `pushState('#instellingen')`, sluiten een `history.back()` — maar alleen als
  wíj die pagina hebben toegevoegd. Wie rechtstreeks op `#instellingen` landt
  (herlaad, gedeelde link) krijgt een `replaceState`; zonder dat onderscheid
  gooit "Klaar" hem de app uit.
- **Het ijkpunt hoort bij zijn eigen datum.** `Bewaar reserve` draait de
  simulatie opnieuw op de ingevulde overzichtsdatum en ijkt daartegen. Wie de
  reserve van maart tegen de simulatie van vandaag legt, stopt elke koersbeweging
  sindsdien in de ijkfactor en houdt die fout de rest van de looptijd vast.
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
- **`data/koersen.json` mag nooit cache-first.** Het is het enige asset dat
  tussen releases verandert. Wie het gewoon in de cache-first-tak laat vallen,
  bevriest de koersen op de dag van installatie: de werkstroom publiceert
  netjes een nieuwe maand en de gebruiker ziet er niets van. De eigen tak in
  `sw.js` moet dus vóór de algemene tak blijven staan; de sw-test pint die
  volgorde vast.
- **De ouderdom van de koersen is iets anders dan die van de ophaling.** Ligt
  de maandelijkse werkstroom stil, dan haalt de knop met succes een bestand op
  dat al maanden stilstaat: de ophaaldatum is dan vandaag en er is geen enkele
  fout. Daarom hangt de badge aan de nieuwste maandsleutel in de koersen, niet
  aan `cache.opgehaald`. Eén maand achterstand is normaal — de lopende maand
  heeft nog geen slotkoers.
- **Geplande werkstromen worden vanzelf uitgeschakeld.** GitHub zet `schedule`
  in publieke repo's stil na zestig dagen zonder repo-activiteit; of de
  maandelijkse bot-commit die klok herstart is niet gegarandeerd. Er is geen
  waterdichte oplossing binnen de repo, dus de app moet het zichtbaar maken —
  vandaar de achterstandsbadge hierboven. Bij een melding volstaat "Enable
  workflow" of één willekeurige commit.
- **De publicatie mag niet van de commit afhangen.** Ophalen en publiceren
  gebeuren daarom in dezelfde job: `upload-pages-artifact` neemt het bestand
  uit de werkmap, niet uit de commit. Het terugcommitten is `continue-on-error`
  en puur historiek. Zonder die scheiding zet één ontbrekend recht
  (`contents: write` staat repo-breed op read-only) of één push-race de hele
  deploy stil, en dat zou je pas een maand later merken. Een push door de
  werkstroom start trouwens ook geen tweede werkstroom — een aparte job die
  commit en daarna een deploy verwacht, deployt dus de oude toestand.
- **De service worker mag zichzelf niet onderscheppen.** De updatecheck haalt
  `sw.js` cache-gebust op; wordt dat verzoek uit de cache bediend, dan leest de
  app voor altijd zijn eigen oude `VERSIE` en verschijnt de updatebalk nooit.
  De handler springt daarom eerst op `url.includes('sw.js')`.
- **De installatie moet de HTTP-cache omzeilen.** GitHub Pages zet
  `max-age=600` op alles. Zonder `new Request(pad, { cache: 'reload' })` in de
  install kan een nieuwe versie de bytes van de vórige inslaan onder haar eigen
  cachenaam. De app draait dan oude code met een nieuw versienummer, en omdat
  `actieveVersie` intussen bijgewerkt is verschijnt de updatebalk nooit meer.
- **Banners moeten boven de sheet liggen.** De instellingen dekken het hele
  scherm af (`z-index: 10`). Zonder een eigen laag voor `#banners` is de
  updatebalk niet aan te tikken zolang die sheet openstaat — en bij een verse
  installatie staat hij altijd open.
- **De updatecheck leest `sw.js` als tekst.** `app.js` matcht letterlijk op
  `VERSIE = '…'`. Wie die regel herformatteert (dubbele quotes, een berekende
  waarde, een andere naam) breekt de updatebalk stilzwijgend — de app blijft
  gewoon draaien. De sw-assettest pint de vorm vast.
- **De statuskleur is nooit het enige signaal.** Bij elke status horen ook een
  glyph, een woord in hoofdletters en de lengte van de doelmeter. Het oude
  paar `#34C77B` / `#F05252` haalt bij deuteranopie maar ΔE 5,6 en is voor de
  meest voorkomende vorm van kleurenblindheid dus nagenoeg identiek; het huidige
  palet haalt 9,1. Wie een statuskleur wijzigt, controleert die afstand opnieuw
  én laat de drie andere signalen staan.
- **Meten begint bij de startdatum van de polis.** Niet bij de eerste notering
  van het fonds: dat meet een periode waarin de gebruiker nog niet belegd was.
  Het venster is bewust niet instelbaar — een korter venster lijkt
  voorzichtiger maar is het niet. Op deze tracker geeft zeven maanden 26% per
  jaar tegen 12% over negen jaar; hoe korter, hoe meer ruis. `MINIMUM_MAANDEN`
  blijft daarom als harde ondergrens staan, en onder die grens zegt de app
  hoeveel maanden het nog duurt in plaats van kaal "geen data".
- **De meting hoort bij de koersen, niet bij de ophaling.** `metMeting()` is de
  enige plaats waar `gemeten*` gevuld wordt, en ze rekent over álle gecachte
  koersen vanaf de startdatum — niet over wat de laatste fetch toevallig
  teruggaf.
- **Het gemeten rendement is bruto, het vereiste netto.** De twee tegels naast
  elkaar tonen wat ze zijn, maar de zin eronder vergelijkt pas ná
  `nettoUitGemeten()`. Wie die twee cijfers rechtstreeks van elkaar aftrekt,
  scheelt de beheerskost van de verzekeraar — ruim een procentpunt in het
  voordeel van een te rooskleurig antwoord.
- **`summary` mag geen `display: flex` of `block` krijgen.** Chrome laat het
  openklap-driehoekje dan weg en de rij heeft geen enkele affordance meer;
  `display: list-item` houdt hem.
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
