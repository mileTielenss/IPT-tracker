# KBC Cashflow

Een progressive web app die KBC-CSV-exports van je zakelijke rekening omzet in
cashflow-inzicht per maand en per boekjaar. Alles draait lokaal in je browser:
geen backend, geen accounts, geen telemetrie. De app is gemaakt voor
iPhone/Safari en werkt volledig offline na de eerste keer laden.

## Wat de app doet

- **Importeren**: je laadt een KBC-CSV-export op; de app leest de transacties
  in, slaat dubbels automatisch over en waarschuwt als er mogelijk een periode
  ontbreekt tussen twee imports.
- **Categoriseren**: transacties krijgen een categorie via regels die je zelf
  opbouwt. De app doet suggesties voor bekende Belgische tegenpartijen
  (Telenet, Liantis, DKV, …), maar categoriseert nooit definitief zonder jouw
  bevestiging. Elke categorie heeft een kostenklasse: vast, variabel of
  discretionair.
- **Dashboard**: totaal in, totaal uit en netto per maand of per boekjaar, met
  het verschil tegenover de vorige periode, een grafiek van de uitgaven per
  kostenklasse, je vaste lasten, de grootste uitgavencategorieën en een
  discretionaire samenvatting.
- **Vaste-kostendetectie**: terugkerende betalingen (maandelijks,
  driemaandelijks of jaarlijks) worden herkend en na jouw bevestiging als
  vaste kost geklasseerd.

## Een KBC-export maken en opladen

1. Open KBC Mobile of KBC Touch.
2. Ga naar je rekening en kies **Zoeken**, stel de gewenste periode in en kies
   **CSV** als exportformaat.
3. Bewaar het bestand (bijvoorbeeld in iCloud Drive of de Bestanden-app).
4. Open KBC Cashflow, tik op het dashboard op **CSV opladen** en kies het
   bestand.
5. Controleer de preview (aantal rijen, periode, eerste vijf transacties) en
   bevestig.

Je kan hetzelfde bestand gerust twee keer opladen: reeds gekende transacties
worden herkend en overgeslagen.

## Wat betekenen "intern" en "eenmalig"?

- **Intern**: een overschrijving van of naar een van je eigen rekeningen
  (bijvoorbeeld je privérekening). Die is geen inkomst of uitgave van de zaak
  en telt dus nooit mee in totalen of grafieken. Je beheert je eigen IBAN's in
  **Instellingen → Eigen rekeningen**; de app stelt na een import kandidaten
  voor maar voegt nooit zelf een IBAN toe.
- **Eenmalig**: een uitzonderlijke transactie (een eenmalige investering, een
  terugbetaling) die je uit de overzichten wil houden. Eenmalige transacties
  tellen nergens mee, maar verdwijnen niet: het dashboard toont hoeveel er
  verborgen zijn en voor welk bedrag, en in de transactielijst dragen ze een
  label. Markeren en ontmarkeren kan altijd, met een undo-knop.

## Backup

iOS kan lokale data van weinig gebruikte webapps opruimen. Maak daarom
regelmatig een backup; de app herinnert je er maandelijks aan.

- **Backup downloaden** (Instellingen): één JSON-bestand met al je data.
- **Backup terugzetten**: kies zo'n JSON-bestand; na bevestiging vervangt het
  de volledige inhoud van de app.
- **Exporteer transacties als CSV**: een puntkomma-gescheiden bestand met alle
  transacties, categorie en kostenklasse, dat in Excel met Belgische
  regio-instellingen direct opent.

## Installeren op je iPhone

Open de app in Safari, tik op **Delen** en kies **Zet op beginscherm**. Daarna
werkt de app volledig offline, inclusief nieuwe CSV-imports.

## Voor ontwikkelaars

Zie `CLAUDE.md` voor architectuurkeuzes en `SPEC.md` voor het functionele
gedrag. Tests draaien met `npm test` (Node 22+, geen dependencies).
