# Handmatige checklist (echte iPhone vereist)

Deze punten kunnen niet in de geautomatiseerde suite en worden op het toestel
gecontroleerd. Bij elke release ligt deze checklist bij de gebruiker.

## Installatie en offline

- [ ] Open de app in Safari op iPhone; alles laadt en het dashboard verschijnt.
- [ ] Deel → **Zet op beginscherm**; het icoon en de naam "Cashflow" kloppen.
- [ ] Open de app vanaf het beginscherm: standalone, zonder Safari-balken.
- [ ] Zet vliegtuigmodus aan en heropen de app: alle schermen werken.
- [ ] Importeer offline een nieuwe CSV (uit Bestanden): de import slaagt.

## Bestandskiezer en opslag

- [ ] **CSV opladen** opent de iOS-bestandskiezer en aanvaardt een .csv uit
      iCloud Drive/Bestanden.
- [ ] **Backup downloaden** levert een JSON-bestand op dat in Bestanden staat.
- [ ] **Backup terugzetten** met dat bestand herstelt alle data.
- [ ] Controleer in Safari-instellingen dat websitedata voor de app bestaat;
      noteer of `navigator.storage.persist()` werd toegekend (geen garantie).

## Updates

- [ ] Verhoog `VERSIE` in sw.js op de server; heropen de app: de balk "Nieuwe
      versie beschikbaar" verschijnt zonder dat de app zelf herlaadt.
- [ ] Tik **Nu bijwerken**: de app herlaadt één keer en draait op de nieuwe
      versie; data blijft staan.

## Weergave

- [ ] Bruikbaar bij 360 px breed; uploadknop en periodeschakelaar staan op het
      dashboard zonder scrollen in beeld.
- [ ] Toetsenbordfocus is zichtbaar (extern toetsenbord of VoiceOver).
- [ ] Met "Verminder beweging" aan verschijnen toasts zonder animatie.
