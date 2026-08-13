# IPT Tracker

Eén scherm dat één vraag beantwoordt: **ligt mijn IPT op koers?**

Je IPT (de individuele pensioentoezegging bij Vivium, een groepsverzekering
waarvan de reserve in een ETF belegd is) moet op de einddatum een bepaald
kapitaal opleveren. Deze app rekent uit waar je vandaag staat, trekt die lijn
door tot de einddatum en zegt met één kleur, één getal en één grafiek of dat
volstaat.

Geen login, geen accounts, geen meldingen, geen menu's. Je opent de app, je
ziet meteen of het goed zit, en je sluit ze weer.

## Wat je ziet

- **Een gekleurd vlak** met het oordeel en het bedrag dat je op de einddatum
  boven of onder je doel uitkomt.
- **Een grafiek** met het doelpad (de grijze lijn), je werkelijke opbouw tot
  vandaag (de dikke gekleurde lijn), de projectie tot de einddatum (de
  stippellijn) en een horizontale streep op het bedrag dat je moet halen. Tik
  ergens op de grafiek om de waarden van dat punt te zien.
- **Drie getallen**: je reserve vandaag, waar het doelpad vandaag zou moeten
  staan, en het verschil daartussen.

### De kleuren

| kleur | betekenis |
|---|---|
| 🟢 groen | de verwachte eindwaarde haalt je doel |
| 🟠 oranje | je zit op minstens negentig procent van je doel — bijsturen kan nog makkelijk |
| 🔴 rood | je zit onder negentig procent van je doel |

Meer dan dat wil de app niet zeggen. Het is een stoplicht, geen rapport.

## Eerste gebruik: je gegevens invullen

De app staat publiek op GitHub Pages. Daarom staat er **geen enkel persoonlijk
cijfer in de app zelf** — die vul je zelf in bij het eerste gebruik. Zolang ze
ontbreken toont de app het invulscherm in plaats van een status.

Tik op het tandwiel (⚙) rechtsboven en vul in, onder "Jouw polis":

1. **Maandpremie excl. taks** — het bedrag van de hoofdwaarborg dat maandelijks
   betaald wordt, zonder de premietaks. Staat op je polis.
2. **Doelkapitaal netto** — wat je op de einddatum netto in handen wil hebben
   (typisch het bedrag van je krediet).
3. **Startdatum premies** — vanaf wanneer er premies betaald worden.
4. **Einddatum polis** — de einddatum uit de polis.
5. **Eindtaxatie** — het belastingpercentage op de uitkering (standaard 17,5%,
   een aanname van de makelaar). De app rekent hiermee je *bruto* doel uit: wat
   er vóór belastingen moet staan om netto je doel te halen.

### Waar blijven die gegevens?

**Uitsluitend op dit toestel**, in de lokale opslag van je browser
(localStorage). Er is geen server, geen account, geen backend en geen
telemetrie. Niets van wat je invult verlaat je telefoon — ook al is de app zelf
publiek zichtbaar.

De keerzijde: als je in je browserinstellingen de sitedata wist, of de app van
je beginscherm verwijdert en de data mee opruimt, zijn je gegevens weg. Er is
geen kopie elders. Ze opnieuw invullen is een minuutje werk; noteer je cijfers
gerust ergens anders ook.

## Koersen vernieuwen

De app haalt de koersen van de onderliggende ETF op bij Yahoo Finance, maar
**nooit vanzelf en nooit op de achtergrond**. Jij beslist: tik op **Koersen
vernieuwen**. Daaronder staat de datum van de laatste geslaagde ophaling.

- Staat er een **"verouderd"-badge** naast, dan is de laatste koers ouder dan
  ongeveer vijf weken. De cijfers kloppen dan nog steeds als momentopname, maar
  ze zijn niet meer van vandaag. Even vernieuwen volstaat.
- Lukt het ophalen niet, dan zegt de app dat en blijven de oude koersen staan.
  Meestal is dat een verbindingsprobleem. Werkt het hardnekkig niet, dan kan je
  in de instellingen een eigen doorgeefluik (proxy-URL) invullen; zonder
  invulling gebruikt de app een gratis publieke dienst die af en toe hapert.

## Eén keer per jaar ijken

Dit is het belangrijkste onderhoud aan de app, en het duurt een minuut.

**Waarom.** De app *benadert* je reserve: ze simuleert maand na maand hoeveel
deelbewijzen je premie gekocht heeft tegen de koers van die maand, en trekt de
beheerskosten daarvan af. Dat is een goede benadering, maar het is niet
Vivium's boekhouding: de exacte aankoopdatum, de exacte koers en de exacte
kostenafrekening wijken altijd wat af. Het **Vivium-jaaroverzicht is de
waarheid**, de app is de tussentijdse indicatie.

**Hoe.** Als je jaaroverzicht binnenkomt: open ⚙ → **IJk met het
Vivium-overzicht**, vul de echte reservestand in en tik op **IJk reserve**. De
app herschaalt de hele simulatie zodat ze op dat bedrag uitkomt, en houdt die
correctie aan. De foutmarge blijft daarna onder de twee procent. Wil je terug
naar de onbewerkte berekening, tik dan op **Reset**.

Zonder ijking blijft het stoplicht bruikbaar, maar geloof de eurocenten niet.

## Installeren op je iPhone

1. Open de app in **Safari** (niet in een andere browser — enkel Safari kan op
   iOS naar het beginscherm installeren).
2. Tik op **Delen** (het vierkantje met het pijltje).
3. Kies **Zet op beginscherm**.

Daarna start de app als een gewone app, zonder browserbalken. Ze werkt ook
zonder internet: je ziet dan de laatst opgehaalde koersen en de status die
daaruit volgt, met de "verouderd"-badge als die koersen intussen oud zijn.

Verschijnt er bovenaan een balk **"Nieuwe versie beschikbaar"**, dan staat er
een update klaar. De app herlaadt nooit uit zichzelf; ze wacht tot jij op **Nu
bijwerken** tikt. Je gegevens blijven daarbij staan.

## Eerlijke waarschuwing

Dit is **geen financieel advies** en geen officieel document. Het is een
indicatie: rood of groen.

De uitkomst hangt volledig af van aannames die je in de instellingen zelf kan
aanpassen — het verwachte rendement, de instap- en beheerskosten, de TER van de
ETF en het percentage eindtaxatie. Wie het verwachte rendement een procentje
optrekt, ziet rood in groen veranderen zonder dat er in de werkelijkheid iets
verandert. Beleggingsrendement uit het verleden is bovendien geen belofte voor
de toekomst; de app rekent met één vast pad en simuleert geen slechte jaren.

De niet-automatisch op te halen cijfers (TER, beheerskost, eindtaxatie) krijgen
in de instellingen een datum van laatste controle. Staat er een ⚠️ bij, dan is
die controle meer dan een jaar oud: kijk het even na bij de bron ernaast. Dat
telt niet mee in de kleur, maar oude aannames maken de kleur wel minder waard.

Voor beslissingen: je makelaar en het Vivium-jaaroverzicht.

## Voor ontwikkelaars

`SPEC.md` beschrijft het gedrag, `CLAUDE.md` de architectuurkeuzes en de
valkuilen, `docs/handmatige-checklist.md` wat alleen op een echt toestel te
testen valt. Tests draaien met `npm test` (Node 22+, geen dependencies).
