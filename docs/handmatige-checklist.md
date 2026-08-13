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
- [ ] Zodra alle velden ingevuld zijn verschijnt het statusvlak met een kleur,
      een delta-bedrag en de zin "Je ligt N% voor/achter op het pad".
- [ ] Sluit de app volledig af en heropen ze: de ingevulde gegevens staan er
      nog.
- [ ] De productwaarden (instapkost, beheerskost, TER, rendement, ticker,
      ISIN, intern fonds) staan vooraf ingevuld en zijn bewerkbaar.

## Koersen vernieuwen op het toestel

- [ ] Tik op **Koersen vernieuwen**: de koersen worden opgehaald en de datum
      van de laatste koers eronder wordt bijgewerkt.
- [ ] Zet vliegtuigmodus aan en tik nogmaals: de app meldt dat het ophalen niet
      lukte en laat de bestaande koersen én de status staan.
- [ ] Vul in de instellingen een eigen proxy-URL in en ververs: de ophaling
      loopt via die proxy. Maak het veld weer leeg en ververs: de fallback
      werkt nog steeds.
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
