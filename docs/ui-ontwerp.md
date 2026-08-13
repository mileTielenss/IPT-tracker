# UI-ontwerp — IPT Tracker

Schermontwerp voor iPhone 15 Pro (393 × 852 logische px), donker thema, één
scherm, geen navigatie. `SPEC.md` blijft de bron van waarheid voor het *gedrag*;
dit document beschrijft de *vorm* en is concreet genoeg om rechtstreeks te
bouwen. Alle maten zijn logische px.

Uitgangssituatie: een zaakvoerder, geen financieel specialist, opent de app twee
keer per jaar in de zetel en wil binnen drie seconden weten of zijn
pensioenopbouw nog goed zit. Alles wat die drie seconden niet dient, staat
lager op het scherm of achter het tandwiel.

---

## 1. Ontwerpprincipes

**P1 — Eén antwoord, dan pas het bewijs.** De volgorde op het scherm is de
volgorde van de vragen: *haal ik het?* (statuskaart) → *hoe loopt dat?*
(grafiek) → *waar sta ik precies?* (kerngetallen) → *is dit nog vers?*
(ververs) → *klopt mijn invoer?* (instellingen). Er staat nooit een cijfer boven
het oordeel.

**P2 — Precies één element mag schreeuwen.** De statuskaart krijgt de volle
kleur, de grootste letter (40 px) en de meeste hoogte (≈ 236 px, 28 % van het
zichtbare scherm). Al de rest is donkergrijs op donkergrijs met kleur alleen als
functie. Twee schreeuwende blokken = geen hiërarchie.

**P3 — Kleur is nooit het enige signaal.** Elke status draagt vier signalen
tegelijk: kleur, glyph (✓ / ! / ×), woord (GOED / NET NIET / NIET GOED) en de
*lengte* van de doelmeter. Wie kleurenblind is of het scherm in fel zonlicht
bekijkt, leest hetzelfde antwoord.

**P4 — Getallen die je moet vergelijken, staan naast elkaar.** "Ik heb 4,8 %
nodig, het fonds deed 11,9 %" is de kern van de app. Die twee krijgen daarom
twee gelijke tegels naast elkaar plus één zin die de vergelijking uitspreekt —
geen twee losse rijen in een lijst waar de gebruiker zelf moet aftrekken.

**P5 — De grafiek is een verhaal over veertig jaar, geen sierlijn.** Assen,
raster, jaartallen, een "vandaag"-markering en een legende zijn geen decoratie:
zonder y-as is een lijn die stijgt betekenisloos. Wat de grafiek niet kan tonen
(in jaar 9 van 48 is het verschil met het doelpad enkele pixels), tonen de
kerngetallen in euro's.

**P6 — Instellingen zijn onderhoud, geen dashboard.** Ze verhuizen naar een
sheet over het scherm met een eigen kop en een "Klaar"-knop, in plaats van
onder het dashboard aan te schuiven. Wie twee keer per jaar komt ijken, wil de
velden bovenaan zien, niet na 900 px scrollen.

**P7 — Niets beweegt zonder reden.** Eén overgang (de sheet), één laadindicatie,
één toast. Geen grafiekanimatie: de lijn is geen gebeurtenis.

**Wat bewust géén gewicht krijgt:** de app-naam (12 px, grijs — hij staat al op
het beginscherm), de ETF-ticker en het ISIN (achter "Geavanceerd"), de
handmatige controledatums (onder in de sheet), en de proxy-instelling (die zie
je pas als je ze nodig hebt).

---

## 2. Schermopbouw van boven naar onder

Paginaraster: `#scherm` heeft `padding: calc(8px + env(safe-area-inset-top))
16px calc(24px + env(safe-area-inset-bottom))`, `max-width: 480px`, gecentreerd.
Inhoudsbreedte op 393 px = **361 px**. Verticale tussenruimte tussen kaarten:
**12 px**. Spatiëringsschaal: 4 / 8 / 12 / 16 / 20 / 24. Hoeken: 20 px
(statuskaart), 16 px (kaarten), 12 px (tegels, knoppen, invoervelden), 999 px
(badges).

### 2.1 Kopregel — 44 px

*Toont:* "IPT TRACKER" links, tandwiel rechts.
*Waarom hier:* de gebruiker moet het tandwiel altijd op dezelfde plaats vinden;
verder is de kop dood gewicht en krijgt hij dus het minimum.
*Vorm:* titel 12 px / 700 / `letter-spacing: 0.14em` / uppercase, kleur
`--tekst-zwak`. Tandwiel: knop van 44 × 44, radius 12, transparant, glyph 20 px
in `--tekst-zacht`; ingedrukt `background: var(--kaart-2)`. `aria-label`
"Instellingen openen". Marge onder: 8 px.

### 2.2 Statuskaart — ≈ 236 px, de hero

*Toont:* het oordeel, het bedrag boven/onder doel (bruto én netto), de verwachte
eindwaarde met datum, een doelmeter en één zin over de achterstand/voorsprong.
*Waarom hier:* dit is het antwoord op de enige vraag. Bovenaan, volledige
breedte, volle kleur.
*Vorm:* breedte 361, radius 20, geen rand, `padding: 20px 18px 18px`,
achtergrond = de statuskleur, tekst = de bijhorende inktkleur (zie § 5). Geen
enkele tekst op dit vlak gebruikt transparantie — hiërarchie komt van grootte en
gewicht, zodat het contrast gemeten en gehaald blijft.

| regel | inhoud | vorm |
|---|---|---|
| 1 | `(✓)` + `GOED` | schijf 26 px (inkt op 16 % dekking) met glyph 15 px/800; woord 13 px/800, `letter-spacing: .16em`, uppercase; tussenruimte 10 px |
| 2 | `+ € 84.000` | `font-size: clamp(26px, 10vw, 40px)`, 800, `line-height: 1.05`, `letter-spacing: -0.015em`, proportionele cijfers, `white-space: nowrap`; marge boven 10 px |
| 3 | `verwacht € 656.000 op 01/09/2065 · doel € 572.000` | 13 px/600, marge boven 6 px |
| 4 | `netto + € 69.300 boven je doel` | 13 px/500 |
| 5 | doelmeter | hoogte 10 px, radius 999, spoor inkt @ 20 %, vulling inkt 100 %; twee streepjes van 2 px op 90 % en 100 % (inkt @ 45 %); schaal 0–115 % zodat "ruim boven doel" niet tegen de rand plakt; marge boven 14 px |
| 6 | `115% van je doel · streepjes op 90% en 100%` | 11 px/600, marge boven 6 px |
| 7 | `Je ligt 6% voor op het doelpad.` | 15 px/700, marge boven 10 px, met `border-top: 1px solid rgba(inkt,.18)` en 10 px padding erboven |

Het teken is altijd expliciet (`+` of `−`, U+2212), ook bij nul, en staat vóór
het euroteken: `+ € 84.000`. Tussen teken en bedrag een smalle harde spatie.

*Varianten.* Oranje: glyph `!`, woord `NET NIET`. Rood: glyph `×`, woord `NIET
GOED`. Zonder koersen maar met een ijkbedrag: het woord krijgt het achtervoegsel
`· ZONDER KOERSEN` en regel 7 wordt `Gerekend met je jaaroverzicht van
12/03/2026.` Zonder gegevens: neutrale kaart (`--kaart`, 1 px rand), glyph `?`,
woord `VUL JE GEGEVENS IN`, twee regels uitleg en één primaire knop "Gegevens
invullen" (volle breedte, 48 px) die de sheet opent.

### 2.3 Grafiekkaart — ≈ 359 px

*Toont:* doelpad, werkelijke opbouw, projectie, doellijn, vandaag-markering,
assen, legende en een tapregel.
*Waarom hier:* meteen onder het oordeel, want het is het bewijsstuk. Nog net
zichtbaar zonder scrollen (de onderrand van de kaart ligt op ≈ 726 px).
*Vorm:* 361 breed, radius 16, `background: var(--kaart)`, `1px solid var(--rand)`,
`padding: 12px 12px 10px`. Inhoud: SVG (335 × 219) → legende (marge boven 8 px)
→ tapregel (marge boven 8 px, **vaste hoogte 34 px** zodat een tap de pagina
nooit verspringt) → `<details>` "Cijfers per 10 jaar" (44 px hoge samenvatting,
13 px). Details in § 4.

### 2.4 Kerngetallen — ≈ 244 px

*Toont:* reserve vandaag, doelpad vandaag, verschil, optioneel de bewaarde stand
uit het jaaroverzicht, en daaronder de twee rendementen naast elkaar.
*Waarom hier:* dit is het "waar sta ik precies"-blok; het beantwoordt geen vraag
die je in drie seconden stelt, maar wel de eerste vraag die je daarna stelt.
*Vorm:* kaart als 2.3, `padding: 6px 16px 16px`.

- **Rijen:** `display: flex; justify-content: space-between; align-items:
  baseline; gap: 12px; min-height: 44px; padding: 11px 0;` met
  `border-bottom: 1px solid var(--rand)` behalve de laatste. Label links 15 px /
  400 in `--tekst-zacht`; waarde rechts 17 px / 600 in `--tekst`,
  `font-variant-numeric: tabular-nums`. Bij te weinig plaats wrapt de waarde
  onder het label (`flex-wrap: wrap`), nooit ellipsis.
- **Verschil** krijgt kleur (`--groen` / `--rood`) én een expliciet teken.
- **Referentierij** (indien `echteReserve > 0`): label
  `Jouw overzicht (12/03/2026)` 13 px, waarde 15 px, beide in `--tekst-zacht`.
- **Rendementtegels:** `display: grid; grid-template-columns: 1fr 1fr; gap:
  10px; margin-top: 14px`. Elke tegel 163 × 92, `background: var(--kaart-2)`,
  `1px solid var(--rand)`, radius 12, padding 12. Kop 11 px / 700 / `.08em` /
  uppercase in `--tekst-zwak`; waarde 26 px / 700 in `--tekst`; onderschrift
  12 px in `--tekst-zacht`. Links "NODIG VANAF NU / 4,8 % / netto per jaar",
  rechts "FONDS DEED (9 JAAR) / 11,9 % / bruto per jaar".
- **Verdictzin** onder de tegels, 13 px, `--tekst-zacht`, met het kerngetal in
  `--tekst` / 600: "Het fonds deed **7,1 punt** méér dan je nodig hebt." Bij
  tekort: "Je hebt **2,2 punt** méér nodig dan het fonds deed."
- Is er niets gemeten, dan toont de rechtertegel `—`, "nog niet gemeten" en een
  knop "Meet nu" (44 px hoog, secundair).
- Melding "N maanden zonder koers; de laatst bekende koers werd gebruikt."
  verschijnt als 12 px voetnoot ín deze kaart, niet als losse alinea.

### 2.5 Ververskaart — ≈ 102 px

*Toont:* de knop, de datum van de laatste geslaagde ophaling, en een badge als
die verouderd is.
*Waarom hier:* een handeling, geen informatie; ze hoort onder het antwoord.
*Vorm:* kaart als 2.3, padding 14 px. Knop over de volle breedte (333 × 50,
radius 14, `--accent-vlak`, tekst `#FFFFFF` 17 px / 600); ingedrukt `#2A62B8`.
Daaronder (marge 10 px) een regel van 13 px in `--tekst-zacht`: "Laatste koers
01/08/2026", of "Nog geen koersen opgehaald." Is de laatste koers ouder dan
35 dagen, dan volgt een pil: 11 px / 700, uppercase, `padding: 3px 9px`, radius
999, `--oranje` met inkt, tekst "VEROUDERD". De regel staat in
`aria-live="polite"`.

### 2.6 Voettekst — 2 regels

12 px in `--tekst-zwak`, marge boven 16 px: "Geen financieel advies. Alles
blijft op dit toestel." en "Het Vivium-jaaroverzicht is de waarheid — ijk
1×/jaar." Dit is de plaats voor de eerlijke waarschuwing uit de README; hij mag
het oordeel niet vertroebelen maar moet wel ergens staan.

### 2.7 Instellingen-sheet

*Toont:* alles wat je twee keer per jaar aanpast.
*Waarom als sheet:* het paneel is ruim 1200 px lang. Onder het dashboard
geplakt betekent dat scrollen langs een grafiek die je net gelezen hebt. Een
sheet met eigen kop houdt het dashboard intact en kost geen router — het is een
`position: fixed` overlay met een klasse.
*Vorm:* `position: fixed; inset: 0; background: var(--plane); overflow-y: auto;
overscroll-behavior: contain; z-index: 10`, padding als `#scherm`. Bovenaan een
kleverige kop (`position: sticky; top: 0; height: 56px;` achtergrond
`rgba(11,13,17,.92)` met `backdrop-filter: blur(12px)`, onderrand 1 px
`--rand`): titel "Instellingen" 17 px / 700 links, knop "Klaar" rechts (44 px
hoog, 17 px / 600, `--accent`).

Volgorde van de secties — van "moet ingevuld" naar "raak je nooit aan":

1. **Jouw polis** — maandpremie, doelkapitaal, startdatum, einddatum, gevolgd
   door de afgeleide regel ("Netto belegd € 348,25/maand · doel bruto
   € 303.030").
2. **Rendement** — twee keuzekaarten (gemeten / eigen aanname), de zin welk
   nettorendement de app werkelijk gebruikt, en de meetknop.
3. **Eindtaxatie** — één veld.
4. **Mijn reserve volgens het overzicht** — uitleg, invoerveld + knop, en na
   bewaren de stand met de ijkfactor plus "Wissen".
5. **Handmatig nagekeken** — drie rijen met bron en datum.
6. **Geavanceerd** — dichtgeklapte `<details>` met instapkost, beheerskost, TER,
   ticker, ISIN, fondsnummer en proxy-URL.

Sectiekop: 12 px / 700 / `.08em` / uppercase in `--tekst-zwak`, marge
`22px 0 8px`.

**Veldrij.** Label 13 px in `--tekst-zacht`, 6 px eronder het veld: hoogte 48 px,
`background: var(--kaart-2)`, `1px solid var(--rand)`, radius 12, tekst 17 px in
`--tekst`, binnenmarge 12 px. Bedragen krijgen een vast voorvoegsel `€` (15 px,
`--tekst-zwak`, 12 px links) en percentages een achtervoegsel `%` rechts; het
getal zelf staat links uitgelijnd. Focus: rand `--accent` + `outline: 3px solid
rgba(76,154,255,.35)`. `inputmode="decimal"` op alle getalvelden. Datumvelden
over de volle breedte (nooit twee naast elkaar: het iOS-datumveld is breed).
Een leeg veld toont een grijze `placeholder` ("bv. 350"), zodat "leeg" en "0"
niet meer op elkaar lijken.

**Keuzekaart rendement.** 361 breed, radius 12, `1px solid var(--rand)`, padding
14, `min-height: 88px`, opgebouwd als `display: grid; grid-template-columns:
22px 1fr; gap: 12px`. Links een radioschijf van 22 px (rand 2 px `--rand-sterk`;
actief: rand `--accent`, kern 10 px `--accent`). Rechts: titel 15 px / 700,
waarde 20 px / 700, uitleg 12 px in `--tekst-zacht`. De actieve kaart krijgt
`border-color: var(--accent)`, `background: rgba(76,154,255,.10)` en rechtsboven
de pil "IN GEBRUIK" (11 px/700, `--accent-vlak`, wit). **De niet-actieve kaart
wordt niet gedimd** — de hele kaart is aanraakbaar en schakelt de keuze om.

**Controlerij.** Twee kolommen: links naam (15 px / 600) met daaronder de datum
(12 px, `--tekst-zacht`); rechts de knoppen "Bron ↗" en "Nagekeken" (elk 44 px
hoog, secundair, radius 10). Is de controle ouder dan twaalf maanden, dan staat
vóór de naam een schijf van 18 px in `--oranje` met een zwarte `!` en kleurt de
datumregel `--oranje` met de tekst "— ouder dan een jaar". Geen emoji: die
rendert per platform anders en is voor VoiceOver ruis.

---

## 3. Schetsen van elke toestand

Alle schetsen zijn 65 tekens breed ≈ 393 px (1 teken ≈ 6 px). De buitenrand is
het scherm; de blokken erbinnen zijn 57 tekens ≈ 361 px, de kaartbreedte.

### A · Normaal gebruik (groen)

```text
┌───────────────────────────────────────────────────────────────┐
│ A · NORMAAL GEBRUIK (groen) — 393 × 852                       │
├───────────────────────────────────────────────────────────────┤
│   IPT TRACKER                                        ( ⚙ )    │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │ (✓)  GOED                                             │   │
│   │                                                       │   │
│   │ + € 84.000                                            │   │
│   │                                                       │   │
│   │ verwacht € 656.000 op 01/09/2065 · doel € 572.000     │   │
│   │ netto + € 69.300 boven je doel                        │   │
│   │                                                       │   │
│   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┃▓▓▓┃▓▓▓▓░░░░░░░░░░░░  │   │
│   │ 115% van je doel · streepjes op 90% en 100%           │   │
│   │ ───────────────────────────────────────────────────── │   │
│   │ Je ligt 6% voor op het doelpad.                       │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │ €800k┤ · · · · · · · · · · · · · · · · · · · · · ·    │   │
│   │      ┤                                        _,-'    │   │
│   │  600k┤ · · · · · · · · · · · · · · · · · ·,-'' · ·    │   │
│   │      ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄,-'┄┄ doel €572k  │   │
│   │  400k┤ · · · · · · · · · · · · · ,-'' · · · · · ·     │   │
│   │      ┤                       _,-''                    │   │
│   │  200k┤ · · · · · · · · ·_,-'' · · · · · · · · · ·     │   │
│   │      ┤   nu € 12.480 ,-'                              │   │
│   │     0┼──┬─────●━━━┬────────┬─────────┬─────────┬───   │   │
│   │      2017      2030       2040      2050       2065   │   │
│   │                                                       │   │
│   │ ━ jouw opbouw  ┈ projectie  ─ doelpad  ┄ doel €572k   │   │
│   │                                                       │   │
│   │ Tik op de grafiek voor de waarden van dat jaar.       │   │
│   │ ▸ Cijfers per 10 jaar                                 │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
│   · · · · · · · onderrand scherm (852 px) · · · · · · ·       │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │ Reserve vandaag                              € 12.480 │   │
│   │ Doelpad vandaag                              € 11.760 │   │
│   │ Verschil                                      + € 720 │   │
│   │                                                       │   │
│   │ ┌───────────────────────┐ ┌───────────────────────┐   │   │
│   │ │ NODIG VANAF NU        │ │ FONDS DEED (9 JAAR)   │   │   │
│   │ │ 4,8 %                 │ │ 11,9 %                │   │   │
│   │ │ netto per jaar        │ │ bruto per jaar        │   │   │
│   │ └───────────────────────┘ └───────────────────────┘   │   │
│   │ Het fonds deed 7,1 punt méér dan je nodig hebt.       │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │ ┌─────────────────────────────────────────────────┐   │   │
│   │ │             Koersen vernieuwen                  │   │   │
│   │ └─────────────────────────────────────────────────┘   │   │
│   │ Laatste koers 01/08/2026                              │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
│   Geen financieel advies. Alles blijft op dit toestel.        │
│   Het Vivium-jaaroverzicht is de waarheid — ijk 1×/jaar.      │
└───────────────────────────────────────────────────────────────┘
```

### B · Waarschuwing (oranje en rood)

```text
┌───────────────────────────────────────────────────────────────┐
│ B · WAARSCHUWING — oranje boven, rood onder                   │
├───────────────────────────────────────────────────────────────┤
│   IPT TRACKER                                        ( ⚙ )    │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │ (!)  NET NIET                                         │   │
│   │                                                       │   │
│   │ − € 41.200                                            │   │
│   │                                                       │   │
│   │ verwacht € 531.000 op 01/09/2065 · doel € 572.000     │   │
│   │ netto − € 34.000 onder je doel                        │   │
│   │                                                       │   │
│   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░┃░░░┃░░░░░░░░░░░░░░░░░  │   │
│   │ 93% van je doel · streepjes op 90% en 100%            │   │
│   │ ───────────────────────────────────────────────────── │   │
│   │ Je ligt 4% achter op het doelpad.                     │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
│   · · · · · · zelfde scherm, rode variant · · · · · · ·       │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │ (×)  NIET GOED                                        │   │
│   │                                                       │   │
│   │ − € 96.400                                            │   │
│   │                                                       │   │
│   │ verwacht € 475.600 op 01/09/2065 · doel € 572.000     │   │
│   │ netto − € 79.500 onder je doel                        │   │
│   │                                                       │   │
│   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░┃░░░┃░░░░░░░░░░░░░░░░░  │   │
│   │ 83% van je doel · streepjes op 90% en 100%            │   │
│   │ ───────────────────────────────────────────────────── │   │
│   │ Je ligt 11% achter op het doelpad.                    │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │ Reserve vandaag                              € 10.150 │   │
│   │ Doelpad vandaag                              € 11.760 │   │
│   │ Verschil                                    − € 1.610 │   │
│   │                                                       │   │
│   │ ┌───────────────────────┐ ┌───────────────────────┐   │   │
│   │ │ NODIG VANAF NU        │ │ FONDS DEED (9 JAAR)   │   │   │
│   │ │ 8,6 %                 │ │ 6,4 %                 │   │   │
│   │ │ netto per jaar        │ │ bruto per jaar        │   │   │
│   │ └───────────────────────┘ └───────────────────────┘   │   │
│   │ Je hebt 2,2 punt méér nodig dan het fonds deed.       │   │
│   └───────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### C · Geen koersdata

Met een bewaarde reservestand rekent de app door en tekent ze doelpad,
projectie en doellijn; alleen de historische lijn ontbreekt. Zonder reservestand
én zonder koersen vervalt de statuskaart naar de neutrale variant met "NOG GEEN
CIJFERS" en verdwijnt de grafiekkaart volledig.

```text
┌───────────────────────────────────────────────────────────────┐
│ C · GEEN KOERSDATA (wel een ijkbedrag ingevuld)               │
├───────────────────────────────────────────────────────────────┤
│   IPT TRACKER                                        ( ⚙ )    │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │ (✓)  GOED · ZONDER KOERSEN                            │   │
│   │                                                       │   │
│   │ + € 12.900                                            │   │
│   │                                                       │   │
│   │ verwacht € 584.900 op 01/09/2065 · doel € 572.000     │   │
│   │ netto + € 10.600 boven je doel                        │   │
│   │                                                       │   │
│   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┃▓▓▓┃░░░░░░░░░░░░░░░░   │   │
│   │ 102% van je doel · streepjes op 90% en 100%           │   │
│   │ ───────────────────────────────────────────────────── │   │
│   │ Gerekend met je jaaroverzicht van 12/03/2026.         │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │ €800k┤ · · · · · · · · · · · · · · · · · · · · · ·    │   │
│   │      ┤                                        _,-'    │   │
│   │  600k┤ · · · · · · · · · · · · · · · · · ·,-'' · ·    │   │
│   │      ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄,-'┄┄ doel €572k  │   │
│   │  400k┤ · · · · · · · · · · · · · ,-'' · · · · · ·     │   │
│   │      ┤                       _,-''                    │   │
│   │  200k┤ · · · · · · · · ·_,-'' · · · · · · · · · ·     │   │
│   │      ┤   nu € 11.900 ,-'                              │   │
│   │     0┼──┬─────○┈┈┬────────┬─────────┬─────────┬───    │   │
│   │      2017      2030       2040      2050       2065   │   │
│   │                                                       │   │
│   │ ○ jouw overzicht  ┈ projectie  ─ doelpad  ┄ doel      │   │
│   │                                                       │   │
│   │ (i) Nog geen koersen: geen lijn van je opbouw. Tik op │   │
│   │ "Koersen vernieuwen"; lukt dat niet, dan rekent       │   │
│   │ de app verder met de stand van je jaaroverzicht.      │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │ Reserve (overzicht 12/03/2026)               € 11.900 │   │
│   │ Doelpad vandaag                              € 11.760 │   │
│   │ Verschil                                      + € 140 │   │
│   │                                                       │   │
│   │ ┌───────────────────────┐ ┌───────────────────────┐   │   │
│   │ │ NODIG VANAF NU        │ │ FONDS DEED            │   │   │
│   │ │ 6,8 %                 │ │ — nog niet gemeten    │   │   │
│   │ │ netto per jaar        │ │ [ Meet nu ]           │   │   │
│   │ └───────────────────────┘ └───────────────────────┘   │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │ ┌─────────────────────────────────────────────────┐   │   │
│   │ │             Koersen vernieuwen                  │   │   │
│   │ └─────────────────────────────────────────────────┘   │   │
│   │ Laatste koers 01/08/2026                              │   │
│   └───────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### D · Eerste gebruik (leeg)

```text
┌───────────────────────────────────────────────────────────────┐
│ D · EERSTE GEBRUIK — leeg; sheet staat meteen open            │
├───────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Instellingen                                     Klaar    │ │
│ │ ───────────────────────────────────────────────────────── │ │
│ │                                                           │ │
│ │ Vier cijfers van je polis en de app kan rekenen. Alles    │ │
│ │ blijft op dit toestel; niets gaat naar een server.        │ │
│ │                                                           │ │
│ │ JOUW POLIS                                                │ │
│ │ Maandpremie hoofdwaarborg excl. taks                      │ │
│ │ ┌───────────────────────────────────────────────────────┐ │ │
│ │ │ €   bv. 350                                           │ │ │
│ │ └───────────────────────────────────────────────────────┘ │ │
│ │ Doelkapitaal netto                                        │ │
│ │ ┌───────────────────────────────────────────────────────┐ │ │
│ │ │ €   bv. 250000                                        │ │ │
│ │ └───────────────────────────────────────────────────────┘ │ │
│ │ Startdatum premies                                        │ │
│ │ ┌───────────────────────────────────────────────────────┐ │ │
│ │ │ dd/mm/jjjj                                            │ │ │
│ │ └───────────────────────────────────────────────────────┘ │ │
│ │ Einddatum polis                                           │ │
│ │ ┌───────────────────────────────────────────────────────┐ │ │
│ │ │ dd/mm/jjjj                                            │ │ │
│ │ └───────────────────────────────────────────────────────┘ │ │
│ │                                                           │ │
│ │ Nog 4 velden nodig voor de app kan rekenen.               │ │
│ │                                                           │ │
│ │ RENDEMENT                                                 │ │
│ │ …                                                         │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ Achter het paneel, zichtbaar zodra je Klaar tikt:             │
│                                                               │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ ( ? )  VUL JE GEGEVENS IN                                 │ │
│ │                                                           │ │
│ │ Tik op ⚙ en vul je maandpremie, doelkapitaal en de        │ │
│ │ twee datums van je polis in. Daarna rekent de app.        │ │
│ │                                                           │ │
│ │ ┌─────────────────────────────────────────────────┐       │ │
│ │ │             Gegevens invullen                   │       │ │
│ │ └─────────────────────────────────────────────────┘       │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### E · Instellingen open

```text
┌───────────────────────────────────────────────────────────────┐
│ E · INSTELLINGEN OPEN (sheet over het dashboard)              │
├───────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ Instellingen                                     Klaar    │ │
│ │ ───────────────────────────────────────────────────────── │ │
│ │ JOUW POLIS                                                │ │
│ │ Maandpremie      [ €   350                            ]   │ │
│ │ Doelkapitaal     [ €   250000                         ]   │ │
│ │ Startdatum       [ 01/09/2017                         ]   │ │
│ │ Einddatum        [ 01/09/2065                         ]   │ │
│ │ Netto belegd € 348,25/maand · doel bruto € 303.030        │ │
│ │                                                           │ │
│ │ RENDEMENT                                                 │ │
│ │ ┌───────────────────────────────────────────────────────┐ │ │
│ │ │ (●) Gemeten uit de koersen            [ IN GEBRUIK ]  │ │ │
│ │ │     11,9 % bruto per jaar                             │ │ │
│ │ │     over 9 jaar, tot 07/2026. Een korte,           │    │ │
│ │ │     gunstige periode is geen belofte.              │    │ │
│ │ └───────────────────────────────────────────────────────┘ │ │
│ │ ┌───────────────────────────────────────────────────────┐ │ │
│ │ │ ( ) Mijn eigen aanname                                │ │ │
│ │ │     [ 7,0                                        % ]  │ │ │
│ │ └───────────────────────────────────────────────────────┘ │ │
│ │ De app rekent met 10,5 % netto per jaar: 11,9 % gemeten   │ │
│ │ min 1,25 % beheerskost (fondskosten zitten in de koers).  │ │
│ │ [ Meet rendement uit de koershistoriek ]                  │ │
│ │                                                           │ │
│ │ EINDTAXATIE                                               │ │
│ │ Eindtaxatie      [ 17,5                           % ]     │ │
│ │                                                           │ │
│ │ MIJN RESERVE VOLGENS HET OVERZICHT                        │ │
│ │ [ €   11900                    ] [ Bewaar reserve ]       │ │
│ │ Bewaard € 11.900 op 12/03/2026 · geijkt (factor 1,032)    │ │
│ │ Wissen                                                    │ │
│ │                                                           │ │
│ │ HANDMATIG NAGEKEKEN                                       │ │
│ │ TER van de ETF                 [ Bron ↗ ] [ Nagekeken ]   │ │
│ │ nagekeken op 03/02/2026                                   │ │
│ │ (!) Beheerskost                [ Bron ↗ ] [ Nagekeken ]   │ │
│ │ nagekeken op 11/01/2025 — ouder dan een jaar              │ │
│ │ Eindtaxatie                              [ Nagekeken ]    │ │
│ │ nooit nagekeken                                           │ │
│ │                                                           │ │
│ │ ▸ GEAVANCEERD                                             │ │
│ │   instapkost · beheerskost · TER · ticker · ISIN ·        │ │
│ │   fondsnummer · eigen proxy-URL                           │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### F · Laadmoment tijdens het vernieuwen

```text
┌───────────────────────────────────────────────────────────────┐
│ F · LAADMOMENT tijdens het vernieuwen van koersen             │
├───────────────────────────────────────────────────────────────┤
│   IPT TRACKER                                        ( ⚙ )    │
│                                                               │
│   statuskaart, grafiek en kerngetallen blijven staan          │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐   │
│   │ ┌─────────────────────────────────────────────────┐   │   │
│   │ │             Koersen ophalen…                    │   │   │
│   │ │ ▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂▂                               │   │   │
│   │ └─────────────────────────────────────────────────┘   │   │
│   │ Even geduld — meestal 2 tot 5 seconden.               │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
│   Knop uitgeschakeld (dekking 0,6), label vervangen,          │
│   3 px voortgangsbalk op de onderrand van de knop.            │
│   Met prefers-reduced-motion staat die balk stil op 100%.     │
│                                                               │
│   Daarna onderaan het scherm (3 s):                           │
│   ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮   │
│   ┊ Koersen bijgewerkt tot 01/08/2026.                    ┊   │
│   ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯   │
│                                                               │
│   Of bij mislukking (blijft staan tot je tikt):               │
│   ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮   │
│   ┊ Ophalen mislukt. De bestaande koersen blijven staan.  ┊   │
│   ┊ Stel bij ⚙ een eigen proxy in.                        ┊   │
│   ┊                                           [ Opnieuw ] ┊   │
│   ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯   │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Het grafiekontwerp

### 4.1 Wat de grafiek moet overleven

Veertig tot achtenveertig jaar op 276 px plotbreedte is ongeveer 6 px per jaar.
Twee gevolgen sturen het hele ontwerp:

1. **Er is geen plaats voor jaarlijkse labels.** Alleen decennia, plus het
   start- en eindjaar.
2. **De eerste tien jaar plakken tegen de nullijn.** Bij samengestelde groei is
   de stand in jaar 9 ongeveer 2 % van de eindwaarde. Een lineaire y-as toont
   het verschil tussen doelpad en werkelijkheid dan als één of twee pixels. Dat
   is geen fout van de grafiek maar de waarheid over de schaal; de app lost het
   op met (a) de **nu-markering met bijschrift**, (b) een **verschilstaafje** met
   minimumlengte op de vandaag-lijn, en (c) de kerngetallen in euro's. Een
   logaritmische as is verworpen: hij maakt "hoe ver zit ik van mijn doel"
   onleesbaar voor wie geen grafieken leest.

### 4.2 Geometrie

```
viewBox      0 0 336 220        (rendert op 335 × 219 in de kaart)
plotvlak     x 52 → 328  (276 breed)   y 14 → 192  (178 hoog)
marge links  52  (y-labels, rechts uitgelijnd op x = 46)
marge rechts 8   (zodat de eindpuntstip niet afgesneden wordt)
marge boven  14  (ruimte voor de "nu"-tekst en de doelchip)
marge onder  28  (jaartallen op basislijn y = 208)
```

Afbeeldingen:

```
x(m) = 52 + (m / totaal) * 276          m = premiemaandindex, 0 … totaal
y(v) = 192 − (v / topAs) * 178          v = bedrag in euro
```

### 4.3 De y-as

Vier tot vijf gridlijnen plus de nullijn — meer wordt op 178 px een ladder.

```
ruw   = max(pad[laatste], doel, eindwaarde) * 1.06
stap  = kleinste waarde uit {1, 2, 2.5, 5} × 10^k met 4 ≤ ceil(ruw/stap) ≤ 5
topAs = stap * ceil(ruw / stap)
ticks = 0, stap, 2·stap, … topAs
```

Labels: 11 px, `text-anchor="end"`, x = 46, `dy=".32em"` voor verticale
centrering (betrouwbaarder dan `dominant-baseline` in Safari), kleur
`--tekst-zwak`. Alleen de **bovenste** tick draagt het euroteken, de rest is
kaal — dat scheelt 12 px linkermarge zonder dubbelzinnigheid. Notatie:
`0` → `0`; < 100 000 → `7,5k`; < 1 000 000 → `640k`; daarboven `1,2 mln`.

Horizontale gridlijnen: 1 px `--grid`, van x 52 tot 328, solide (nooit
gestippeld — stippeling is voorbehouden aan data). De nullijn is 1 px
`--as-lijn` en dus net iets zichtbaarder.

### 4.4 De x-as

Verticale gridlijn + tick op elk decennium binnen de looptijd (1 px `--grid`).
Labels 11 px `--tekst-zwak` op basislijn y = 208:

- startjaar links, `text-anchor="start"`, x = 52;
- eindjaar rechts, `text-anchor="end"`, x = 328;
- elk decennium `text-anchor="middle"` op zijn x.

**Botsingsregel:** een decenniumlabel waarvan het midden binnen 22 px van de
linker- of rechterrand van het start-/eindlabel valt, wordt weggelaten (de tick
blijft staan). Bij 2017–2065 verdwijnen zo 2020 en 2060 en houd je
`2017 · 2030 · 2040 · 2050 · 2065` over: vijf labels op 276 px, geen enkele
overlap.

### 4.5 De vier gegevens uit elkaar houden

| gegeven | vorm | reden |
|---|---|---|
| doelpad | 2 px doorlopend, `--pad-grijs` (#7A8698), `stroke-linejoin: round` | neutrale referentie, mag niet met de status concurreren |
| werkelijke opbouw | **3 px** doorlopend, statuskleur, ronde uiteinden | het enige dat écht gemeten is: het dikst en het felst |
| projectie | 2 px, statuskleur, `stroke-dasharray="6 5"` | zelfde entiteit, andere zekerheid: streepjes lezen als "aanname" |
| doelbedrag | 1,5 px horizontaal, `--tekst-zacht`, `stroke-dasharray="6 4"`, met tekstchip rechts | een grens, geen reeks; horizontaal + label maakt hem uniek |
| vlak doelpad ↔ werkelijk | gesloten pad, statuskleur op `fill-opacity: .14` | toont voorsprong/achterstand als oppervlak; positie t.o.v. de grijze lijn geeft de richting |
| vandaag | 1 px verticaal, `--tekst-zwak`, `stroke-dasharray="2 3"`, van y 14 tot 192 | scheidt gemeten van geprojecteerd |
| nu-punt | cirkel r = 4,5 in de statuskleur, 2,5 px ring in `--kaart` | het punt dat de gebruiker zoekt |
| verschilstaafje | 3 px verticaal op de vandaag-lijn, van y(doelpad) tot y(reserve), ronde uiteinden, **minimum 6 px lang** | maakt een verschil van 1 px in de vroege jaren toch zichtbaar |
| eindpunt projectie | cirkel r = 3,5, statuskleur, 2 px ring in `--kaart` | ankert de projectie op de einddatum |

De doelchip is rechts uitgelijnd op x = 326, 6 px onder de doellijn (of 14 px
erboven als de lijn hoger dan y = 34 ligt), 11 px / 700 in `#C8D0DC`, met
`stroke="#151A22" stroke-width="3" paint-order="stroke"` als halo, zodat de
gestippelde lijn niet door de letters loopt. Tekst: `doel € 572k`.

De "nu"-tekst staat 4 px rechts van de vandaag-lijn op y = 26 (11 px / 700,
`--tekst-zacht`), met daaronder op y = 40 het bedrag (`nu € 12.480`). Zit de
lijn voorbij 75 % van de plotbreedte, dan springen beide naar links met
`text-anchor="end"`.

### 4.6 Legende

Als HTML **onder** de SVG, niet erin: zo wrapt ze netjes op smalle schermen en
schaalt ze mee met de tekstinstelling van het toestel.
`display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px;` elk item
`display: inline-flex; align-items: center; gap: 6px;` 12 px in `--tekst-zacht`.
Het sleuteltje is een SVG van 18 × 8 met exact dezelfde streek als in de grafiek
(dikte, stippeling, kleur). Vier items: **jouw opbouw · projectie · doelpad ·
doel € 572k**. Bij de variant zonder koersen wordt het eerste item een cirkeltje
met het label "jouw overzicht".

### 4.7 Aanraking

De hele SVG is het raakvlak (335 × 219, ruim boven 44 × 44). `touch-action:
pan-y` zodat verticaal scrollen blijft werken terwijl horizontaal slepen scrubt.

- `pointerdown` → `setPointerCapture`, `pointermove` → verplaatsen,
  `pointerup` → laten staan. De selectie blijft zichtbaar tot de volgende tap.
- De x-positie komt uit `event.clientX − svg.getBoundingClientRect().left`,
  gedeeld door de breedte van het rechthoekje. **Niet `offsetX`:** in Safari is
  dat relatief tot het geraakte kindelement en springt de selectie zodra je een
  lijn raakt in plaats van de achtergrond.
- `index = round(fractie × totaal)`, geklemd op 0 … totaal.
- Getekend wordt: een verticale lijn van 1 px in `--tekst` op 55 % dekking, een
  ring van r = 3,5 op het doelpad (`--pad-grijs`, 2 px ring in `--kaart`) en een
  ring van r = 4 op de werkelijke/geprojecteerde lijn (statuskleur).
- De tapregel eronder toont: `2034 · doelpad € 96.400 · verwacht € 104.100
  (+ € 7.700)`. Vóór de eerste tap staat er in `--tekst-zwak`: "Tik op de
  grafiek voor de waarden van dat jaar."
- Er is geen zweeftooltip in de SVG: op een telefoon bestaat hover niet, en
  tekst onder de grafiek is groter en beter voorleesbaar.

### 4.8 Prestatie en toegankelijkheid van de SVG

Achtenveertig jaar geeft 577 punten voor doelpad en projectie. Die worden
**per kwartaal uitgedund** (elk derde punt, plus altijd het laatste) — op 276 px
is dat 1,7 px per punt en visueel niet te onderscheiden van maandelijks. De
werkelijke lijn blijft maandelijks: ze is kort en het is de enige gemeten reeks.
Coördinaten op één decimaal. Resultaat: ± 8 kB SVG-string in plaats van ± 25 kB.

De SVG krijgt `role="img"` met `<title>` ("Opbouw tegenover doelpad,
2017–2065") en `<desc>` (één zin met reserve, doelpad, verschil en verwachte
eindwaarde), en `focusable="false"`. Daaronder staat `<details>` "Cijfers per
10 jaar" met een echte tabel (jaar · doelpad · jouw lijn), zodat elk cijfer ook
zonder beeld beschikbaar is.

### 4.9 SVG-skelet

Tekenvolgorde is betekenisvolgorde: raster achteraan, gemeten data vooraan.

```svg
<svg viewBox="0 0 336 220" width="100%" role="img"
     aria-labelledby="g-titel g-uitleg" focusable="false">
  <title id="g-titel">Opbouw tegenover doelpad, 2017–2065</title>
  <desc  id="g-uitleg">Vandaag € 12.480, doelpad € 11.760, verwacht
    € 656.000 op 01/09/2065 tegenover een doel van € 572.000.</desc>

  <!-- 1. raster -->
  <g stroke="#232A35" stroke-width="1">
    <line x1="52" y1="14"  x2="328" y2="14"/>   <!-- per y-tick -->
    <line x1="83" y1="14"  x2="83"  y2="192"/>  <!-- per decennium -->
  </g>
  <line x1="52" y1="192" x2="328" y2="192" stroke="#39424F" stroke-width="1"/>

  <!-- 2. as-labels -->
  <g fill="#8892A3" font-size="11"
     font-family="-apple-system, system-ui, sans-serif">
    <text x="46" y="14" dy=".32em" text-anchor="end">€800k</text>
    <text x="52"  y="208" text-anchor="start">2017</text>
    <text x="163" y="208" text-anchor="middle">2040</text>
    <text x="328" y="208" text-anchor="end">2065</text>
  </g>

  <!-- 3. vlak tussen doelpad en werkelijk -->
  <path d="M52,192 L… L… Z" fill="#3ED8A0" fill-opacity=".14"/>

  <!-- 4. doellijn + chip -->
  <line x1="52" y1="65" x2="328" y2="65"
        stroke="#A6B0C0" stroke-width="1.5" stroke-dasharray="6 4"/>
  <text x="326" y="79" text-anchor="end" font-size="11" font-weight="700"
        fill="#C8D0DC" stroke="#151A22" stroke-width="3"
        paint-order="stroke">doel € 572k</text>

  <!-- 5. doelpad -->
  <polyline points="…" fill="none" stroke="#7A8698" stroke-width="2"
            stroke-linejoin="round"/>

  <!-- 6. vandaag -->
  <line x1="104" y1="14" x2="104" y2="192"
        stroke="#8892A3" stroke-width="1" stroke-dasharray="2 3"/>
  <text x="108" y="26" font-size="11" font-weight="700" fill="#A6B0C0">nu</text>
  <text x="108" y="40" font-size="11" fill="#A6B0C0">€ 12.480</text>

  <!-- 7. data -->
  <polyline points="…" fill="none" stroke="#3ED8A0" stroke-width="2"
            stroke-dasharray="6 5"/>
  <polyline points="…" fill="none" stroke="#3ED8A0" stroke-width="3"
            stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="104" y1="187" x2="104" y2="181" stroke="#3ED8A0"
        stroke-width="3" stroke-linecap="round"/>
  <circle cx="328" cy="47" r="3.5" fill="#3ED8A0" stroke="#151A22"
          stroke-width="2"/>
  <circle cx="104" cy="181" r="4.5" fill="#3ED8A0" stroke="#151A22"
          stroke-width="2.5"/>

  <!-- 8. tapselectie, leeg tot de eerste aanraking -->
  <g id="tap"></g>
</svg>
```

---

## 5. Kleurenpalet (donker thema)

Contrastverhoudingen zijn berekend met de WCAG-2-formule (relatieve
luminantie), afgerond op twee decimalen. Eis: **4,5:1** voor gewone tekst,
**3:1** voor tekst ≥ 24 px, iconen, lijnen en randen die betekenis dragen.

### 5.1 Tokens

| token | hex | rol |
|---|---|---|
| `--plane` | `#0B0D11` | paginavlak |
| `--kaart` | `#151A22` | kaartvlak, ook het tekenvlak van de grafiek |
| `--kaart-2` | `#10141B` | invoervelden en tegels (verdiept, niet verhoogd) |
| `--rand` | `#2A313D` | hairline rond kaarten en velden |
| `--rand-sterk` | `#39424F` | radiorand, basislijn van de grafiek |
| `--grid` | `#232A35` | gridlijnen in de grafiek |
| `--tekst` | `#F2F5FA` | primaire tekst |
| `--tekst-zacht` | `#A6B0C0` | labels, uitleg, legende |
| `--tekst-zwak` | `#8892A3` | as-labels, voetnoten, app-naam |
| `--pad-grijs` | `#7A8698` | de doelpadlijn |
| `--accent` | `#4C9AFF` | links, focusring, actieve keuze |
| `--accent-vlak` | `#2F6FD0` | vulling van de primaire knop |
| `--groen` | `#3ED8A0` | status "haalt het" |
| `--oranje` | `#FFB020` | status "≥ 90 %" + verouderd-badge |
| `--rood` | `#FF5F6B` | status "< 90 %" |
| `--inkt-groen` | `#04140D` | tekst op groen vlak |
| `--inkt-oranje` | `#1A1103` | tekst op oranje vlak |
| `--inkt-rood` | `#1F0407` | tekst op rood vlak |

### 5.2 Gemeten contrast

| combinatie | verhouding | eis | |
|---|---|---|---|
| `--tekst` op `--plane` | **17,80:1** | 4,5 | ✓ |
| `--tekst` op `--kaart` | **15,98:1** | 4,5 | ✓ |
| `--tekst` op `--kaart-2` | **16,89:1** | 4,5 | ✓ |
| `--tekst-zacht` op `--kaart` | **7,98:1** | 4,5 | ✓ |
| `--tekst-zacht` op `--plane` | **8,88:1** | 4,5 | ✓ |
| `--tekst-zwak` op `--kaart` | **5,56:1** | 4,5 | ✓ |
| `--accent` als tekst op `--kaart` | **6,13:1** | 4,5 | ✓ |
| `#FFFFFF` op `--accent-vlak` | **4,88:1** | 4,5 | ✓ |
| `--groen` als lijn/cijfer op `--kaart` | **9,59:1** | 3 | ✓ |
| `--oranje` als lijn/cijfer op `--kaart` | **9,55:1** | 3 | ✓ |
| `--rood` als lijn/cijfer op `--kaart` | **5,90:1** | 3 | ✓ |
| `--groen` op `--plane` | **10,68:1** | 3 | ✓ |
| `--oranje` op `--plane` | **10,63:1** | 3 | ✓ |
| `--rood` op `--plane` | **6,58:1** | 3 | ✓ |
| `--inkt-groen` op `--groen` | **10,38:1** | 4,5 | ✓ |
| `--inkt-oranje` op `--oranje` | **10,20:1** | 4,5 | ✓ |
| `--inkt-rood` op `--rood` | **6,58:1** | 4,5 | ✓ |
| `--pad-grijs` op `--kaart` | **4,73:1** | 3 | ✓ |

Decoratief en dus buiten de eis: `--grid` op `--kaart` 1,21:1, `--rand` op
`--kaart` 1,33:1, `--rand-sterk` op `--kaart` 1,72:1, `--kaart` op `--plane`
1,11:1. Die vier mogen fluisteren; ze dragen geen informatie die niet ook in
tekst staat.

### 5.3 Kleurenblindheid

De drie statuskleuren zijn gecontroleerd met een CVD-simulatie in OKLab
(ΔE × 100, waarbij 8 de ondergrens is):

| paar | deuteranopie | tritanopie | normaal zicht |
|---|---|---|---|
| rood ↔ groen | **9,1** | 16,6 | 20,6 |
| rood ↔ oranje | > 9 | > 16 | 20,6 |
| oranje ↔ groen | > 9 | > 16 | 22,5 |

Dit is bewust bijgestuurd: het gebruikelijke paar `#34C77B` / `#F05252` haalt
maar ΔE 5,6 bij deuteranopie en is dus voor de meest voorkomende vorm van
kleurenblindheid nagenoeg identiek. Het groen is naar teal geschoven en het rood
naar rozerood; beide blijven onmiskenbaar "groen" en "rood" voor wie ze wél
onderscheidt.

**Tweede signaal, altijd aanwezig:** glyph (✓ / ! / ×) plus het woord in
hoofdletters op de statuskaart, en de **lengte van de doelmeter** met streepjes
op 90 % en 100 %. Ook zonder enige kleurwaarneming staat er dus: `(!) NET NIET
— 93% van je doel`. In de grafiek onderscheiden lijndikte (3 px versus 2 px) en
stippeling de reeksen; de legende herhaalt dat met identieke sleuteltjes, en de
tabel achter `<details>` maakt de cijfers los van elke visuele codering.

---

## 6. Typografische schaal

Systeemfont: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
sans-serif`. Eén familie, geen display- of schreeffont.

| rol | grootte | gewicht | extra |
|---|---|---|---|
| hero-delta (statuskaart) | `clamp(26px, 10vw, 40px)` | 800 | `-0.015em`, proportionele cijfers, nowrap |
| tegelwaarde (rendement) | 26 px | 700 | proportionele cijfers |
| keuzewaarde (sheet) | 20 px | 700 | |
| knop, invoerveld, sheetkop | 17 px | 600 / 400 | |
| rijwaarde kerngetallen | 17 px | 600 | `tabular-nums` |
| statuszin, rijlabel, keuzetitel | 15 px | 700 / 400 | |
| onderschrift, tapregel, controledatum | 13 px | 400 | |
| sectiekop, badge, meterbijschrift, legende | 11–12 px | 700 | uppercase + `.08em` bij koppen |
| as-labels in de grafiek | 11 px | 400 | `tabular-nums` |
| statuswoord | 13 px | 800 | uppercase + `.16em` |
| app-naam in de kop | 12 px | 700 | uppercase + `.14em` |

Regelafstand: 1,45 voor lopende tekst, 1,25 voor labels en waarden, 1,05 voor
de hero. `font-variant-numeric: tabular-nums` **alleen** in kolommen die moeten
uitlijnen (kerngetallen, as-labels, tabel); een groot alleenstaand getal krijgt
proportionele cijfers omdat tabulaire cijfers op 40 px los ogen.

Niets staat onder 11 px. Getallen volgen `nl-BE`: punt als duizendtal, komma als
decimaal, euroteken vooraan met spatie.

---

## 7. Raakvlakken en toegankelijkheid

- **44 × 44 px minimum** voor alles wat reageert: tandwiel (44 × 44),
  Klaar-knop (44 hoog), rij-knoppen "Bron ↗" / "Nagekeken" (44), keuzekaarten
  (88 hoog, volledig aanraakbaar), invoervelden (48), primaire knop (50),
  `<details>`-samenvattingen (44). De grafiek is 335 × 219 in haar geheel.
  Tussen twee naburige knoppen minstens 8 px.
- **Focus.** `:focus-visible { outline: 3px solid var(--accent); outline-offset:
  2px; }` op knoppen, links en velden. Op de gekleurde statuskaart (mocht daar
  ooit een knop staan) wordt de ring de inktkleur, want `--accent` verdwijnt in
  het oranje. De focusring wordt nooit met `outline: none` weggehaald.
- **Toetsenbordvolgorde** = leesvolgorde. De sheet is een `<dialog>`-achtige
  overlay: bij openen gaat de focus naar de kop, `Escape` sluit, en de
  achtergrond krijgt `inert` zodat de focus er niet achter wegvalt.
- **prefers-reduced-motion.** Zonder voorkeur: sheet schuift 180 ms omhoog,
  toast verschijnt met 200 ms opacity + 8 px verplaatsing, de laadbalk pulseert.
  Met `reduce`: geen verplaatsing en geen pulsering — de sheet verschijnt
  onmiddellijk, de toast alleen met opacity (120 ms), en de laadbalk staat stil
  op volle breedte met de tekst "Koersen ophalen…". De grafiek animeert nooit.
- **Zeer lange bedragen.** De hero gebruikt `clamp()` op de vw-breedte, zodat
  `− € 1.284.000` (13 tekens) op 393 px nog op één regel past; de kaartbreedte
  is de bovengrens, niet de tekst. In de kerngetallen mag de waarde onder het
  label wrappen (`flex-wrap: wrap; min-width: 0`) — nooit `text-overflow:
  ellipsis`, want een half bedrag is erger dan twee regels. In de grafiek zijn
  alle bedragen k/mln-genoteerd en dus hoogstens 8 tekens. De sheetvelden
  scrollen horizontaal binnen het veld.
- **Voorlezen.** De statuskaart is één `role="status"` met `aria-live="polite"`,
  zodat een herberekening na het opslaan van een veld wordt uitgesproken als
  "GOED, plus 84.000 euro". De verversregel is eveneens `aria-live="polite"`.
  De grafiek heeft `<title>`/`<desc>` plus de tabel. Iconen zijn
  `aria-hidden="true"`; het woord ernaast draagt de betekenis.
- **Tekstgrootte.** Geen enkel blok heeft een vaste hoogte (behalve de SVG en de
  tapregel); alle kaarten groeien mee. Op 200 % paginazoom blijven de twee
  rendementtegels naast elkaar staan tot 320 px effectieve breedte en gaan
  daaronder onder elkaar (`grid-template-columns: 1fr` onder `@media (max-width:
  340px)`).
- **Contrast in daglicht.** De statuskaart is het enige verzadigde vlak; hij
  haalt ≥ 6,5:1 voor zijn eigen tekst in alle drie de kleuren, wat hem ook bij
  volle helderheid buiten leesbaar houdt.

---

## 8. Wijzigingen tegenover de huidige implementatie

Van meeste naar minste impact.

1. **Grafiek volledig herbouwd** (`js/grafiek.js`): y-as met bedragen en vier à
   vijf gridlijnen, x-as met jaartallen en botsingsregel, vlakvulling tussen
   doelpad en werkelijkheid, vandaag-lijn met bijschrift en verschilstaafje,
   eindpunten met ring, doelchip met halo. *Waarom:* een lijn zonder assen zegt
   niet of je op € 12.000 of € 120.000 zit; dit is de klacht die het ontwerp
   veroorzaakte.
2. **Statuskaart wordt een hero met doelmeter** (`statusVlak` in `js/app.js`):
   glyph, verwachte eindwaarde mét datum, en een meter met streepjes op 90 % en
   100 %. *Waarom:* het bedrag "+ € 84.000" is betekenisloos zonder de schaal
   waarop het slaat, en de meter is het tweede, kleurvrije signaal.
3. **Instellingen worden een sheet met eigen kop en Klaar-knop** in plaats van
   een sectie onder het dashboard. *Waarom:* 1200 px aan velden hoort niet in
   dezelfde scrollkolom als het antwoord dat je in drie seconden wil lezen.
4. **Twee rendementtegels naast elkaar plus een verdictzin** in plaats van twee
   losse rijen. *Waarom:* SPEC 3.5 noemt dit de kernvraag; naast elkaar hoef je
   niet zelf af te trekken.
5. **Nieuw kleurenpalet** (`css/stijl.css`): groen `#34C77B` → `#3ED8A0`, rood
   `#F05252` → `#FF5F6B`, oranje `#F2A33C` → `#FFB020`, accent `#3987E5` →
   `#4C9AFF` (+ `#2F6FD0` als knopvulling), zachte tekst `#8B93A3` → `#A6B0C0`.
   *Waarom:* het oude rood/groen-paar haalt ΔE 5,6 bij deuteranopie en het oude
   accent 4,80:1 als tekst; het nieuwe palet haalt alle drempels met marge.
6. **Grafiek ook zonder koersen** wanneer er een reservestand uit het
   jaaroverzicht bewaard is (doelpad + projectie + doellijn + één punt).
   *Waarom:* `overzicht()` levert die reeksen al; ze verbergen kost informatie
   zonder iets op te lossen.
7. **Ververs-knop over de volle breedte met een echte laadtoestand** (label
   wisselt, voortgangsbalk, `aria-live`) in plaats van een knop die alleen
   `disabled` wordt. *Waarom:* de proxy doet er soms vijf seconden over; zonder
   terugkoppeling tikt de gebruiker opnieuw.
8. **Typografische schaal met tabulaire cijfers alleen in kolommen** en een
   hero met `clamp()`. *Waarom:* nu is 2,1 rem hard gezet en breekt
   `− € 1.284.000` over twee regels.
9. **Keuzekaarten niet meer op `opacity: .65`.** De inactieve kaart onderscheidt
   zich door rand en achtergrond; de tekst blijft op volle sterkte. *Waarom:*
   0,65 dekking brengt `--tekst-zacht` onder 4,5:1.
10. **Tapregel krijgt een vaste hoogte van 34 px** met een vooraf ingevulde hint.
    *Waarom:* nu verschijnt de regel pas ná de tap en verspringt de halve pagina
    onder je vinger.
11. **Tapdetectie via `clientX` + `getBoundingClientRect()`** in plaats van
    `offsetX`. *Waarom:* in Safari is `offsetX` relatief tot het geraakte
    kindelement, dus een tap op een lijn levert een verkeerd jaar op.
12. **Uitdunnen van doelpad en projectie naar kwartaalpunten.** *Waarom:* 577
    punten op 276 px zijn onzichtbaar en verdrievoudigen de SVG-string bij elke
    render.
13. **`⚠️` vervangen door een oranje schijf met een `!`**, en `⚙` blijft maar
    krijgt een `aria-label`. *Waarom:* emoji renderen per platform anders en
    worden voorgelezen als "waarschuwingsteken".
14. **Lege velden krijgen een placeholder** (`bv. 350`) en persoonlijke
    parameters worden `null` in plaats van `0` zolang ze niet ingevuld zijn.
    *Waarom:* nu ziet een instapkost die je bewust op 0 % zet er identiek uit
    aan een veld dat nooit ingevuld werd (zie de valkuil in `CLAUDE.md`).
15. **Tabel "Cijfers per 10 jaar" achter `<details>`** onder de grafiek.
    *Waarom:* de enige manier om de grafiekinhoud voor te lezen, en gratis
    controleerbaar bij het ijken.
16. **Voettekst met de disclaimer.** *Waarom:* de README waarschuwt uitdrukkelijk
    dat dit geen advies is; op het scherm stond dat nergens.
