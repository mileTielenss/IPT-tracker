# SPEC — IPT Tracker PWA ("Ligt het op koers of niet?")

Dit document is de bron van waarheid voor het gedrag van de app. `CLAUDE.md`
motiveert de architectuurkeuzes; `docs/handmatige-checklist.md` bevat wat
alleen op een echt toestel te controleren valt.

## 1. Doel

Eén-pagina PWA die bij openen in minder dan 3 seconden toont of de IPT — een
individuele pensioentoezegging bij Vivium, tak 23, met een ETF als
onderliggende — op koers ligt om op de einddatum het doelkapitaal te halen.

Eén kleur, één getal, één grafiek. Persoonlijk gebruik, geen login, geen
backend.

## 2. Parameters

Alle parameters zijn bewerkbaar in het instellingenpaneel en worden opgeslagen
in localStorage.

### 2.1 Persoonlijke gegevens (niet in de code)

De app staat publiek op GitHub Pages. Daarom staat er géén persoonlijk cijfer
in de code; de gebruiker vult deze velden zelf in. Zolang ze ontbreken toont de
app het invulscherm in plaats van een status.

| parameter | bron |
|---|---|
| startdatum premies | polis |
| einddatum | polis |
| maandpremie hoofdwaarborg excl. taks | polis |
| doelkapitaal netto | kredietbedrag |
| reserve volgens het overzicht, met de datum die erop staat | jaaroverzicht |

De reservestand krijgt een eigen, bewerkbare datum. Een jaaroverzicht is per
definitie van een dag in het verleden, en de ijking vergelijkt dat bedrag met
de simulatie **van die dag** — niet met die van vandaag.

### 2.2 Productwaarden (bewerkbare standaardwaarde in de app)

| parameter | standaard | opmerking |
|---|---|---|
| instapkost | 0,50% | uit de polis |
| beheerskost verzekeraar | 1,25% per jaar | uit het beheersreglement |
| TER ETF | 0,20% per jaar | zit al als drag in de NAV — niet dubbel tellen |
| eindtaxatie | 17,5% | aanname |
| verwacht rendement index | 7,0% per jaar | aanname, alleen gebruikt als er niets gemeten is |
| ETF-ticker | SUSW.L | |
| ETF ISIN | IE00BYX2JD69 | |
| intern fonds | BE6333127940 | |
| eigen CORS-proxy-URL | leeg | optioneel |

Afgeleide waarden: het netto belegde maandbedrag is `premie × (1 − instapkost)`
en het brutodoel is `doelkapitaal netto ÷ (1 − eindtaxatie)`.

Het **nettorendement wordt altijd berekend, nooit ingevuld**:

- is het rendement van de tracker gemeten (zie 5), dan geldt
  `(1 + gemeten) × (1 − beheerskost) − 1` — de fondskosten zitten al in de
  gemeten koersen;
- anders `(1 + aanname index) × (1 − TER) × (1 − beheerskost) − 1`.

Dat is de enige plaats waar de TER meetelt; in de units-simulatie nooit.

**Aanname vastgelegd in de app:** alle premies worden altijd correct en op tijd
betaald.

## 3. Kernberekening (client-side, deterministisch)

1. **Units-simulatie.** Voor elke verstreken premiemaand sinds de startdatum
   wordt het nettobedrag (premie min instapkost) omgezet in units tegen de
   interne NAV van die maand:

   `NAV_intern = ETF-slotkoers × (1 − beheerskost)^(maanden / 12)`

   De reserve van vandaag is `Σ units × NAV_intern(vandaag)`. Ontbrekende
   maandkoersen vallen terug op de laatst bekende koers; die maanden worden
   geteld en aan de gebruiker gemeld.

2. **Doelpad.** Maandelijkse inleg van datzelfde nettobedrag tegen het netto
   rendement, van start tot einddatum. Dit is de grijze referentielijn.

   Een premie groeit pas vanaf de **maand ná** haar storting, precies zoals in
   de units-simulatie: daar koopt ze units tegen de slotkoers van haar eigen
   maand en groeit ze die maand dus nog niet mee. Doelpad, projectie en
   simulatie moeten dezelfde conventie hanteren; doen ze dat niet, dan wijkt de
   reserve structureel ongeveer een half procent van het doelpad af — meer dan
   het "voor/achter"-signaal dat de app erover geeft.

3. **Projectie.** De reserve van vandaag doorgerekend met de resterende premies
   tegen hetzelfde netto rendement tot de einddatum. Dat geeft de verwachte
   eindwaarde **E**.

4. **Delta.** `delta = E − brutodoel`, met
   `brutodoel = doelkapitaal netto ÷ (1 − eindtaks)`. De delta wordt bruto én
   netto getoond.

5. **Vereist rendement.** Welk netto jaarrendement is vanaf vandaag nodig om
   het brutodoel precies te halen, gegeven de huidige reserve en de resterende
   premies? Numeriek opgelost met bisectie, want de eindwaarde stijgt monotoon
   met het rendement. Dit getal staat naast het gemeten rendement van de
   tracker: samen beantwoorden ze de vraag "haal ik het met wat dit fonds
   werkelijk doet?" zonder aannames van derden.

   Die twee cijfers staan in **verschillende eenheden**: het vereiste rendement
   is netto, het gemeten rendement bruto. Beide tegels tonen daarom ook de
   omrekening — wat het fonds bruto moet halen om dat netto over te houden, en
   wat het gemeten cijfer netto oplevert. Zonder die vertaling leest een
   gebruiker "5,5% nodig, fonds doet 12,1%" en denkt hij dat 5,5% fondsgroei
   volstaat; dat is het niet, want de beheerskost gaat er nog af.

## 4. Statuslogica

| kleur | conditie |
|---|---|
| 🟢 groen | E ≥ brutodoel |
| 🟠 oranje | E ≥ 90% van het brutodoel |
| 🔴 rood | E < 90% van het brutodoel |

Het hoofdscherm toont een kleurvlak met het oordeel, het delta-bedrag, en één
zin: "Je ligt N% voor/achter op het doelpad".

De statuskaart noemt altijd **met welk rendement er doorgerekend is** en waar
dat vandaan komt. Zonder die regel is een fors overschot onverklaarbaar: het
hangt volledig aan die keuze, en standaard is dat het gemeten rendement van het
fonds — niet de aanname van een makelaar.

## 5. Data-verversing

Verversen gebeurt **uitsluitend via een refresh-knop**, nooit automatisch op de
achtergrond.

De ETF-maandkoersen staan als **`data/koersen.json` naast `index.html`**, op
dezelfde origin als de app. Dat bestand wordt bij elke publicatie en op de
tweede van elke maand door een GitHub Action gevuld, die de Yahoo Finance
chart-API server-side bevraagt. Op een server geldt geen same-origin-policy,
dus daar is geen CORS-doorgeefluik nodig; voor de browser is het resultaat een
gewoon eigen bestand. Dit is het normale pad.

Als vangnet blijft de rechtstreekse weg bestaan: Yahoo via een CORS-proxy — de
eigen proxy als die is ingesteld, anders een reeks publieke doorgeefluiken.
Dat pad is alleen nog nodig wie een andere ticker volgt dan het gepubliceerde
bestand, of tussen twee publicaties door wil verversen. De bronnen worden na
elkaar geprobeerd tot er één bruikbare koersen geeft.

Een maandbestand met een **andere ticker** dan de ingestelde telt niet mee: de
app valt dan door naar de doorgeefluiken in plaats van stilzwijgend de koersen
van een vreemd fonds te tonen. Een leeg antwoord telt als mislukking en wist
de gecachte historiek nooit; nieuwe koersen worden over de bestaande gelegd.

Wat geen betrouwbare API heeft, krijgt een datum van laatste handmatige
controle. Is die ouder dan twaalf maanden, dan verschijnt een geel uitroepteken
naast de instelling. Dat telt niet mee in de hoofdstatus.

De app meet bij elke verversing het **werkelijke langetermijnrendement** van
de tracker uit haar koershistoriek en rekent daar standaard mee in plaats van
met een aanname. De gebruiker kan terugschakelen naar de eigen aanname. Bij
het cijfer staat expliciet over welke periode het gemeten is, want een korte,
gunstige periode is geen belofte voor veertig jaar.

Gemeten wordt er **vanaf drie jaar vóór de startdatum van de polis**, niet
vanaf de eerste notering van het fonds. Twee redenen, en ze duwen elk een kant
op. Vanaf de eerste notering meet je een decennium waarin de gebruiker nog niet
belegd was, en dat kan er heel anders uitzien dan het zijne. Vanaf de start
zélf levert het de eerste drie jaar niets op — te kort om te annualiseren — en
dan zie je jarenlang niet wat het fonds doet. De aanloop van drie jaar lost
allebei op: er staat altijd een cijfer, en het venster groeit mee met de
looptijd, zodat het aandeel eigen periode elk jaar stijgt.

Er valt niets in te stellen: de startdatum staat al in de polisgegevens.

Heeft het fonds zelf minder dan **drie jaar** historiek, dan wordt er nog
steeds niets gemeten — enkele maanden opblazen tot een jaarcijfer is ruis — en
rekent de app met de eigen aanname.

Het rendement wordt gemeten over **alle bekende koersen** binnen dat venster,
niet alleen over wat de laatste ophaling opleverde: de simulatie rekent met
diezelfde verzameling.

De **TER** wordt niet automatisch opgehaald: Yahoo geeft die voor Europese
ETF's niet vrij zonder sessiecookie. Daarvoor toont de app een bronlink naar
justETF die de ingevulde ISIN volgt. Ook niet op te zoeken en dus altijd
handmatig: de **instapkost** en de **beheerskost** (die staan in de polis en
het beheersreglement) en de **eindtaxatie** (een fiscale aanname).

## 6. Grafiek

Eén lijngrafiek van startjaar tot einddatum, met assen — een lijn zonder
schaal zegt niet of je op € 12.000 of € 120.000 staat:

- een **y-as** met vier of vijf gridlijnen op ronde bedragen;
- een **x-as** met het start- en eindjaar plus elk decennium dat er zonder
  overlap bij past;
- een **grijze lijn** voor het doelpad;
- een **dikke gekleurde lijn** voor de werkelijke reserve tot vandaag, met het
  vlak tussen die lijn en het doelpad licht ingekleurd;
- een **stippellijn** voor de projectie vanaf vandaag, met een punt op de
  einddatum;
- een **horizontale markering** op het brutodoel, met bijschrift;
- een **vandaag-lijn** met het bedrag van nu en een verschilstaafje van
  minstens zes pixels — in de eerste jaren is het verschil met het doelpad
  anders onzichtbaar.

Onder de grafiek staan een legende, een tapregel met vaste hoogte en een
uitklapbare tabel met de cijfers per tien jaar, zodat elk cijfer ook zonder
beeld beschikbaar is.

Geen zoom en geen animatie. Een tap toont de waarden op dat punt als gewone
tekst in de tapregel; de horizontale positie komt uit `clientX` min de
linkerrand van de grafiek.

## 7. UI

Mobile-first, één scherm, donker thema, geen navigatie en geen onboarding.
Van boven naar onder:

1. **statuskaart**: het oordeel in vier signalen tegelijk — kleur, glyph
   (✓ / ! / ×), woord (GOED / NET NIET / NIET GOED) en de lengte van een
   doelmeter met streepjes op 90% en 100%. Daarbij het bedrag boven of onder
   doel (bruto én netto), de verwachte eindwaarde met datum, en één zin over de
   voorsprong of achterstand op het doelpad. Kleur is nooit het enige signaal;
2. grafiek;
3. kerngetallen: reserve vandaag, doelpad vandaag, verschil, en daaronder twee
   tegels naast elkaar — het vanaf nu vereiste rendement en wat het fonds
   werkelijk deed — met één zin die het verschil in procentpunten uitspreekt.
   Staat er een reservestand uit het jaaroverzicht bewaard, dan blijft die als
   referentierij zichtbaar;
4. refresh-knop over de volle breedte met de datum van de laatste koers;
5. een voettekst met de waarschuwing dat dit geen advies is;
6. een tandwiel dat de instellingen opent als een volledig scherm over het
   dashboard, met een eigen kop en een "Klaar"-knop. Dat scherm is een eigen
   pagina in de geschiedenis (`#instellingen`): de terugveeg van het toestel en
   de terugknop sluiten het paneel in plaats van de app te verlaten, en een
   herlaad met het paneel open komt terug op het paneel. Escape sluit ook.

De vormgeving staat uitgewerkt in `docs/ui-ontwerp.md`: raster, typografische
schaal, kleurtokens met gemeten contrastverhoudingen, en een controle op
kleurenblindheid.

## 8. Techniek

- Vanilla HTML, CSS en JavaScript met ES-modules. Geen framework, geen
  build-stap, geen runtime-dependencies.
- Opslag in localStorage: parameters, gecachte koershistoriek en
  controledatums.
- Service worker met cache-first voor de app-assets, zodat de app offline de
  laatst gecachte staat toont — met een "verouderd"-badge als de koersen ouder
  zijn dan ongeveer vijf weken.
- Eén versieconstante `VERSIE` in `sw.js`, tegelijk cachenaam en
  updatesignaal. Nergens anders staat een versienummer.
- Updatecheck bij start en bij `visibilitychange` via een cache-gebuste fetch
  van `sw.js` die de service worker nooit onderschept. Een nieuwe versie toont
  enkel een balk en herlaadt nooit ongevraagd.
- Geen analytics, geen accounts.

## 9. Buiten scope

- Schuldsaldopolis-opvolging.
- Het ophalen van de werkelijke Vivium-reservestand (daar is geen API voor).
- Meerdere scenario's of monte-carlo-simulaties.

## 10. Nauwkeurigheid

De app benadert de reserve; het Vivium-jaaroverzicht is de waarheid. Daarom is
er een **ijk-veld**: de gebruiker vult één keer per jaar de echte reserve in en
de app herschaalt de simulatie met een ijkfactor, waarna de foutmarge onder de
twee procent blijft. Zonder ijking blijft de indicatie bruikbaar voor
rood/groen, maar niet exact op de euro.

IJken is **idempotent**: er wordt eerst door de bestaande ijkfactor gedeeld om
de ruwe simulatiewaarde terug te vinden.

De ingevulde reservestand wordt bewaard met haar datum en blijft als
referentiepunt op het hoofdscherm staan. Zijn er (nog) geen koersen, dan
rekent de app volledig met die stand: status, projectie en vereist rendement
volgen er dan uit, zonder historische lijn. Zo is de app bruikbaar vanaf het
eerste jaaroverzicht, ook als het ophalen van koersen faalt.

## 11. Tests

De volledige suite draait vóór elke push. Honderd procent dekking op regels,
takken en functies voor alle bestanden onder `js/` is een harde
faalvoorwaarde. Onbereikbare defensieve code wordt verwijderd, niet gedoogd.

Minstens getest:

- de units-simulatie, inclusief ontbrekende koersen (ook een gat vóór de
  eerste bekende koers, waarbij geen premie mag verdwijnen), de herwaardering
  tegen de recentste koers, en de ijkfactor;
- dat de TER de historische simulatie niet beïnvloedt;
- het vereiste rendement en de afleiding van het nettorendement;
- de bronketen: eerst het eigen maandbestand, dan de eigen proxy, dan de
  publieke doorgeefluiken, inclusief de tickercontrole op het bestand;
- het doelpad;
- de projectie;
- de statuslogica op de grenzen;
- het parsen van het Yahoo-antwoord en de proxy-fallback;
- het meten van het historische rendement;
- de grafiekgeneratie;
- de app-shell tegen een fake-DOM: velden bewerken, de ververs-flow, ijken en
  de updatebalk;
- een test die de asset-lijst in `sw.js` vergelijkt met `index.html` en met de
  bestanden op schijf.

Wat alleen op een echt toestel kan, staat in `docs/handmatige-checklist.md`.
