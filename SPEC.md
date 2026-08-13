# SPEC — IPT Tracker PWA ("Gaat het goed of niet?")

## 1. Doel
Eén-pagina PWA die bij openen in <3 sec toont of de IPT (Vivium Top-Hat Plus Plan) op koers ligt om op de einddatum het doelkapitaal te halen. Eén kleur, één getal, één grafiek. Persoonlijk gebruik, geen login, geen backend-verplichting.

**Generiek (aanvulling):** de app staat publiek op GitHub Pages en bevat daarom géén persoonlijke gegevens in de code. De productstructuur (Vivium-kosten, ETF) staat als bewerkbare standaardwaarde; de persoonlijke cijfers — maandpremie, doelkapitaal, start- en einddatum, eindtaxatie — vult de gebruiker in via het instellingenpaneel en blijven uitsluitend in localStorage op het toestel. Zolang ze ontbreken toont de app een invulscherm in plaats van een status.

## 2. Parameters (standaardwaarden, alle bewerkbaar via instellingen-paneel)
| parameter | standaard | bron |
|---|---|---|
| startdatum premies | (in te vullen) | polis |
| einddatum | (in te vullen) | polis |
| premie hoofdwaarborg excl. taks /mnd | (in te vullen) | polis |
| doel netto | (in te vullen) | kredietbedrag |
| instapkost | 0,50% | polis |
| netto belegd/mnd | premie × (1 − instapkost), berekend | berekend |
| beheerskost Vivium | 1,25% /jr | beheersreglement 01/01/2026 |
| TER onderliggende ETF | 0,20% /jr (drag in NAV, niet dubbel tellen) | justETF |
| eindtaxatie | 17,5% | aanname makelaar |
| doel bruto | doel netto ÷ (1 − eindtaxatie), berekend | berekend |
| basis-rendement index | 7,0% bruto/jr → 5,6% netto | aanname |
| ETF ISIN | IE00BYX2JD69 (ticker SUSW.L) | polis + beheersreglement |
| intern fonds | BE6333127940 | beheersreglement |

Aanname vastgelegd in de app: alle premies worden altijd correct en op tijd betaald.

## 3. Kernberekening (client-side, deterministisch)
1. **Units-simulatie**: voor elke verstreken premiemaand sinds de startdatum: koop het nettobedrag aan units tegen de ETF-slotkoers van die maand, gecorrigeerd voor de Vivium-beheerskost (NAV_intern(t) = NAV_ETF(t) × (1 − beheerskost)^(jaren sinds start)). Reserve vandaag = Σ units × NAV_intern(vandaag). Ontbrekende maandkoersen vallen terug op de laatst bekende koers.
2. **Doelpad** (de prognoselijn): maandelijkse opbouw met het nettobedrag tegen het netto rendement, van start tot einddatum (premie aan het begin van de maand). Bij de referentiecijfers uit de polis eindigt dit op ±344.500 bruto, met marge boven het brutodoel.
3. **Projectie vandaag**: reserve vandaag doorgerekend met de resterende premies tegen het netto rendement → verwachte eindwaarde E.
4. **Delta** = E − doel bruto, en × (1 − eindtaxatie) voor netto-weergave.

## 4. Statuslogica (het enige dat echt telt)
| kleur | conditie |
|---|---|
| 🟢 GROEN | E ≥ doel bruto |
| 🟠 ORANJE | E ≥ 90% van doel bruto |
| 🔴 ROOD | E < 90% van doel bruto |

Hoofdscherm toont: kleurvlak + "+/− X EUR t.o.v. doel op einddatum" + één zin ("Je ligt N% voor/achter op het pad").

## 5. Data-verversing (refresh-knop, nooit automatisch op achtergrond)
| gegeven | bron | methode |
|---|---|---|
| ETF-koers actueel + maandhistoriek sinds start | Yahoo Finance chart-API (query1.finance.yahoo.com) | fetch via CORS-proxy (zie §8) |
| TER ETF | geen betrouwbare API | gecachte waarde + link justETF + "laatst gecontroleerd"-datum; handmatig bewerkbaar |
| Vivium-beheerskost | geen API; staat in PDF-beheersreglement | idem: gecachte waarde + link vivium.be + herinnering 1×/jaar |
| eindtaxatie % | geen bron | handmatig veld |

Regel: alles wat niet automatisch op te halen is, wordt getoond met de datum van de laatste handmatige controle; ouder dan 12 mnd → geel uitroepteken naast de instelling (telt niet mee in de hoofdstatus).

## 6. Grafiek
Eén lijngrafiek, x = startjaar→eindjaar:
- grijze lijn: doelpad (§3.2)
- groene/oranje/rode dikke lijn: werkelijke reserve tot vandaag (units-simulatie)
- stippellijn vanaf vandaag: projectie E
- horizontale markering op het brutodoel
Geen zoom, geen tooltips-overdaad; tap toont waarde op dat punt.

## 7. UI (mobile-first, één scherm)
1. Statusvlak (kleur, delta-bedrag, één zin)
2. Grafiek
3. Drie kerngetallen: reserve vandaag / doelpad vandaag / verschil
4. Refresh-knop (toont datum laatste koers; ouder dan ±35 dagen → "verouderd"-badge)
5. ⚙️ instellingen (alle parameters §2 bewerkbaar, met bronlinks, controle-datums en het ijk-veld uit §9)
Donker thema, geen navigatie, geen onboarding.

## 8. Techniek
- Vanilla HTML/JS/CSS (ES-modules), manifest + service worker (offline = laatst gecachte staat tonen; de "verouderd"-badge dekt oude koersen)
- Opslag: localStorage (parameters, gecachte koershistoriek, laatste-controle-datums)
- CORS: Yahoo-endpoint vereist proxy → optie A: eigen doorgeefluik (bv. gratis Cloudflare Worker), instelbaar als proxy-URL; optie B: allorigins.win (nul setup, minder betrouwbaar). De code gebruikt A als die is ingesteld en B als fallback.
- Versiebeheer en updates zoals voorheen: één VERSIE-constante in sw.js (cachenaam + updatesignaal), updatecheck bij start en visibilitychange via cache-gebuste fetch van sw.js die de service worker nooit onderschept, updatebalk zonder ongevraagd herladen. De service worker onderschept alleen same-origin verzoeken; koersverzoeken gaan rechtstreeks het net op.
- Geen analytics, geen accounts, geen externe libs; de grafiek is een handgetekende SVG.

## 9. Expliciet buiten scope
- Schuldsaldopolis-opvolging (vast contractueel schema, niets te monitoren)
- Werkelijke Vivium-reservestand ophalen (geen API; de units-simulatie is de benadering — wijkt af door exacte aankoopdata/koersen; jaarlijks te ijken met het Vivium-overzicht via een "ijk reserve"-veld dat de simulatie herschaalt)
- Meerdere scenario's/monte carlo — één basispad volstaat voor rood/groen

## 10. Nauwkeurigheid — eerlijke grenzen
De app benadert de reserve; het Vivium-jaaroverzicht is de waarheid. Daarom het ijk-veld (§9): vul 1×/jaar de echte reserve in → app herschaalt en de foutmarge blijft <2%. Zonder ijking blijft de indicatie bruikbaar voor rood/groen maar niet op de euro exact.

## 11. Tests
De volledige suite draait vóór elke push; honderd procent dekking (regels, takken, functies) op de bestanden onder `js/` blijft de harde faalvoorwaarde. Minstens: de premietelling en maandsleutels, het doelpad tegen de referentiecijfers (±344.500), de units-simulatie (vlakke koers, koersstijging, beheerskost-effect, ontbrekende maanden, geen koersen), de statusgrenzen op 100% en 90%, de ijk-herschaling, de proxy-fallback bij het koersen ophalen, de grafiekonderdelen, en de asset-lijst in sw.js tegen index.html en de bestanden op schijf. Wat alleen op het toestel kan staat in docs/handmatige-checklist.md.
