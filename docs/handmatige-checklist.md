# Handmatige checklist (echte iPhone vereist)

Deze punten kunnen niet in de geautomatiseerde suite en worden op het toestel
gecontroleerd. Bij elke release ligt deze checklist bij de gebruiker.

## Installatie op het beginscherm

- [ ] Open de app in Safari op iPhone; ze laadt en toont een status (of het
      invulscherm als de polisgegevens nog ontbreken).
- [ ] Deel → **Zet op beginscherm**; het icoon en de naam "IPT" kloppen.
- [ ] Open de app vanaf het beginscherm: standalone, zonder Safari-balken.

## Eerste gebruik: polisgegevens invullen

- [ ] Bij een lege opslag toont de app het invulscherm in plaats van een
      status.
- [ ] Tik op het tandwiel (⚙) en vul onder "Jouw polis" in: maandpremie excl.
      taks, doelkapitaal netto, startdatum premies, einddatum en eindtaxatie.
- [ ] Zodra alle velden ingevuld zijn verschijnt de statuskaart met een kleur,
      een glyph, het woord GOED/NET NIET/NIET GOED, een delta-bedrag, de
      doelmeter en de zin "Je ligt N% voor/achter op het doelpad".
- [ ] Sluit de app volledig af en heropen ze: de ingevulde gegevens staan er
      nog.
- [ ] De productwaarden (instapkost, beheerskost, TER, rendement, ticker,
      ISIN, intern fonds) staan vooraf ingevuld en zijn bewerkbaar.

## Koersen vernieuwen op het toestel

- [ ] Tik op **Koersen vernieuwen**: de knop toont "Koersen ophalen…" met een
      voortgangsbalk, en daarna melden de toast en de regel eronder uit welke
      bron de koersen komen. Op het gepubliceerde fonds hoort dat "het
      maandbestand van de app" te zijn — dus zonder doorgeefluik.
- [ ] Zet vliegtuigmodus aan en tik nogmaals: de app meldt dat het ophalen niet
      lukte en laat de bestaande koersen én de status staan.
- [ ] Zet onder "Geavanceerd" een andere ticker en ververs: de app valt door
      naar een doorgeefluik in plaats van stilzwijgend de koersen van het
      gepubliceerde fonds te tonen. Zet de ticker daarna terug.
- [ ] Ontbreken er maandkoersen, dan meldt de app hoeveel maanden zijn
      teruggevallen op de laatst bekende koers.

## Offline gebruik en de verouderd-badge

- [ ] Zet vliegtuigmodus aan en heropen de app vanaf het beginscherm: ze laadt
      volledig uit de cache en toont de laatst gecachte status en grafiek.
- [ ] Zijn de laatste koersen ouder dan ongeveer vijf weken, dan staat de
      **"verouderd"-badge** naast de datum bij de refresh-knop.
- [ ] Na een geslaagde verversing verdwijnt die badge.

## Updates

- [ ] Verhoog `VERSIE` in sw.js op de server; heropen de app: de balk "Nieuwe
      versie beschikbaar" verschijnt zonder dat de app zelf herlaadt.
- [ ] Schakel weg naar een andere app en terug (`visibilitychange`): de
      updatecheck loopt opnieuw en de balk blijft correct.
- [ ] Tik **Nu bijwerken**: de app herlaadt precies één keer en draait op de
      nieuwe versie; de ingevulde polisgegevens en de gecachte koersen blijven
      staan.

## Weergave en leesbaarheid (donker thema)

- [ ] Bruikbaar bij 360 px breed: statusvlak, grafiek, de drie kerngetallen en
      de refresh-knop staan zonder horizontaal scrollen in beeld.
- [ ] Het donkere thema is leesbaar bij vol en bij laag schermlicht, ook
      buiten in de zon.
- [ ] De statuskleuren groen, oranje en rood zijn duidelijk te onderscheiden
      op het donkere vlak.
- [ ] Een tap op de grafiek toont de waarden van dat punt als tekst onder de
      grafiek; de raakvlakken zijn groot genoeg voor een duim.
- [ ] Het instellingenpaneel klapt vlot open en dicht; de invoervelden roepen
      het juiste iOS-toetsenbord op (cijfers voor bedragen, datumkiezer voor
      datums).
- [ ] Toetsenbordfocus is zichtbaar (extern toetsenbord of VoiceOver).
- [ ] Met "Verminder beweging" aan verschijnen toasts zonder animatie.

## De nieuwe schermopbouw (v3)

- [ ] De statuskaart is leesbaar in vol zonlicht: het woord en de glyph blijven
      zichtbaar ook als je de kleur niet kunt onderscheiden.
- [ ] De doelmeter vult mee met het percentage, en de twee streepjes op 90% en
      100% zijn zichtbaar — ook als de meter helemaal vol staat.
- [ ] De grafiek toont bedragen langs de y-as en jaartallen langs de x-as; geen
      enkel jaartal overlapt een ander.
- [ ] Tik ergens op de grafiek: de regel eronder toont jaar, doelpad en de
      waarde op jouw lijn, en de pagina verspringt niet onder je vinger.
- [ ] Sleep horizontaal over de grafiek: verticaal scrollen blijft werken.
- [ ] Klap "Cijfers per 10 jaar" open: het driehoekje is zichtbaar en de tabel
      komt overeen met de grafiek.
- [ ] De twee rendementtegels staan naast elkaar, en de zin eronder noemt het
      verschil in procentpunten.
- [ ] Tik op ⚙: de instellingen schuiven als een sheet over het scherm, met
      "Instellingen" en "Klaar" bovenaan die blijven staan bij het scrollen.
      Het dashboard eronder scrollt niet mee.
- [ ] Tik in de sheet op een datumveld: het veld blijft binnen het scherm.
- [ ] Tik "Klaar": je staat terug op het dashboard, op dezelfde plaats.
- [ ] Zet in Instellingen → Beeldscherm de tekstgrootte een paar stappen groter:
      niets loopt buiten beeld en niets wordt afgekapt.

## Bijwerken naar een nieuwe versie

- [ ] Verschijnt de balk "Nieuwe versie beschikbaar", tik dan op **Nu
      bijwerken**: de knop wordt "Bijwerken…", het scherm herlaadt één keer, en
      wat er nieuw is in die versie is meteen zichtbaar. Zie je na het herladen
      exact hetzelfde scherm, dan is er iets mis met de volgorde in de
      updateknop.
- [ ] Je ingevulde gegevens, koersen en ijkpunt staan er na het bijwerken nog.
- [ ] Open het instellingenpaneel en laat de app even op de achtergrond staan;
      verschijnt de updatebalk terwijl het paneel openstaat, dan moet je hem
      nog steeds kunnen aantikken.

## Het gemeten rendement

- [ ] Open ⚙ → Rendement: de kaart noemt de periode ("van … tot …") en die
      begint drie jaar vóór de startdatum van je polis, niet bij de eerste
      notering van het fonds. Ook bij een verse polis staat er dus een cijfer.
- [ ] Heeft het fonds zelf minder dan drie jaar historiek, dan meet de app
      niets en rekent ze met je eigen aanname.
- [ ] De tegel "Nodig vanaf nu" toont een nettocijfer én wat het fonds daarvoor
      bruto moet halen; dat tweede getal ligt altijd hoger. De tegel "Fonds
      deed" toont een brutocijfer én wat er netto van overblijft.

## Scrollen blijft staan

- [ ] Scroll in het instellingenpaneel naar beneden en tik op "Nagekeken" of
      wijzig een veld: het paneel blijft staan waar het stond.
- [ ] Sluit het paneel en open het opnieuw: het begint wél bovenaan.
- [ ] Scroll op het dashboard tot bij de grafiek en tik erop: de pagina springt
      niet, alleen de regel onder de grafiek verandert.
