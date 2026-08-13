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

### 2.2 Productwaarden (bewerkbare standaardwaarde in de app)

| parameter | standaard | opmerking |
|---|---|---|
| instapkost | 0,50% | uit de polis |
| beheerskost verzekeraar | 1,25% per jaar | uit het beheersreglement |
| TER ETF | 0,20% per jaar | zit al als drag in de NAV — niet dubbel tellen |
| eindtaxatie | 17,5% | aanname |
| rendement bruto | 7,0% per jaar | aanname |
| rendement netto | 5,6% per jaar | aanname |
| ETF-ticker | SUSW.L | |
| ETF ISIN | IE00BYX2JD69 | |
| intern fonds | BE6333127940 | |
| eigen CORS-proxy-URL | leeg | optioneel |

Afgeleide waarden: het netto belegde maandbedrag is `premie × (1 − instapkost)`
en het brutodoel is `doelkapitaal netto ÷ (1 − eindtaxatie)`.

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
   rendement, premie aan het begin van de maand, van start tot einddatum. Dit
   is de grijze referentielijn.

3. **Projectie.** De reserve van vandaag doorgerekend met de resterende premies
   tegen hetzelfde netto rendement tot de einddatum. Dat geeft de verwachte
   eindwaarde **E**.

4. **Delta.** `delta = E − brutodoel`, met
   `brutodoel = doelkapitaal netto ÷ (1 − eindtaks)`. De delta wordt bruto én
   netto getoond.

## 4. Statuslogica

| kleur | conditie |
|---|---|
| 🟢 groen | E ≥ brutodoel |
| 🟠 oranje | E ≥ 90% van het brutodoel |
| 🔴 rood | E < 90% van het brutodoel |

Het hoofdscherm toont een kleurvlak met het oordeel, het delta-bedrag, en één
zin: "Je ligt N% voor/achter op het pad".

## 5. Data-verversing

Verversen gebeurt **uitsluitend via een refresh-knop**, nooit automatisch op de
achtergrond.

De ETF-maandkoersen komen van de Yahoo Finance chart-API via een CORS-proxy:
de eigen proxy als die is ingesteld, anders `allorigins.win` als fallback.

Wat geen betrouwbare API heeft, krijgt een datum van laatste handmatige
controle. Is die ouder dan twaalf maanden, dan verschijnt een geel uitroepteken
naast de instelling. Dat telt niet mee in de hoofdstatus.

De app kan wél zelf:

- de **TER van de ETF** opzoeken via het Yahoo-fondsprofiel;
- het **werkelijke langetermijnrendement** meten uit de volledige
  koershistoriek (minstens drie jaar historiek nodig). Het netto rendement
  volgt daaruit als bruto rendement min de beheerskost van de verzekeraar.

Niet op te zoeken en dus altijd handmatig: de **instapkost** en de
**beheerskost** (die staan in de polis en het beheersreglement) en de
**eindtaxatie** (een fiscale aanname).

## 6. Grafiek

Eén lijngrafiek van startjaar tot einddatum met:

- een **grijze lijn** voor het doelpad;
- een **dikke gekleurde lijn** voor de werkelijke reserve tot vandaag;
- een **stippellijn** voor de projectie vanaf vandaag;
- een **horizontale markering** op het brutodoel.

Geen zoom. Een tap toont de waarden op dat punt als gewone tekst onder de
grafiek.

## 7. UI

Mobile-first, één scherm, donker thema, geen navigatie en geen onboarding.
Van boven naar onder:

1. statusvlak;
2. grafiek;
3. drie kerngetallen: reserve vandaag, doelpad vandaag, verschil;
4. refresh-knop met de datum van de laatste koers;
5. een tandwiel dat het instellingenpaneel open- en dichtklapt.

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

## 11. Tests

De volledige suite draait vóór elke push. Honderd procent dekking op regels,
takken en functies voor alle bestanden onder `js/` is een harde
faalvoorwaarde. Onbereikbare defensieve code wordt verwijderd, niet gedoogd.

Minstens getest:

- de units-simulatie, inclusief ontbrekende koersen en de ijkfactor;
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
