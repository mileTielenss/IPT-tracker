# SPEC.md — Cashflow PWA voor KBC-bankafschriften

Versie van dit document: definitief, conform basis-v1. Dit is de bron van waarheid voor gedrag (BASIS.md, regel 17). Alles wat niet in dit document staat, is buiten scope. Bij twijfel geldt de letterlijke tekst boven eigen interpretatie van de bouwer. Waar dit document afspraken uit BASIS.md herhaalt, is dat ter verduidelijking; BASIS.md blijft leidend en dit project wijkt er nergens van af.

## 1. Doel

Een progressive web app waarmee één gebruiker KBC-CSV-exports van zijn zakelijke rekening oplaadt, transacties categoriseert via een zelf te sturen regelsysteem, en per maand en per boekjaar inzicht krijgt in inkomsten en uitgaven, opgesplitst in vaste, variabele en discretionaire kosten, met de mogelijkheid om transacties als eenmalig te markeren zodat ze uit de overzichten verdwijnen. De app werkt volledig lokaal, offline-first, zonder backend, zonder accounts, zonder telemetrie. Doelplatform is iPhone/Safari.

## 2. Scope-afbakening

In scope: KBC-CSV-import via uploadknop, deduplicatie, categorisatie met regels en suggesties, markering eigen rekeningen, markering eenmalig, dashboard met maand- en boekjaarweergave, prognosescherm voor het boekjaar (zie 15, op vraag van de gebruiker toegevoegd), vaste-kostendetectie, transactielijst met filters en drilldown, JSON-backup en -restore, CSV-export van gecategoriseerde data, installeerbaar als PWA met volledige offline werking.

Expliciet buiten scope: andere bankformaten dan KBC, PSD2- of API-koppelingen, beleggingen, pensioenverzekering, multi-user, btw-logica, budgetten, notificaties, versleuteling van de backup, donkere modus als vereiste. De bouwer voegt niets van deze lijst toe.

## 3. Invoerformaat: KBC-CSV

### 3.1 Structuur

Puntkomma-gescheiden, eerste rij is de header. Kolommen in exacte volgorde: Rekeningnummer, Rubrieknaam, Naam, Munt, Afschriftnummer, Datum, Omschrijving, Valuta, Bedrag, Saldo, Credit, Debet, Rekening tegenpartij, BIC code tegenpartij, Naam tegenpartij, Adres tegenpartij, gestructureerde mededeling, vrije mededeling. Datums in dd/mm/jjjj. Bedragen met decimale komma en zonder duizendtallenscheiding. Het veld Omschrijving staat tussen dubbele aanhalingstekens en kan puntkomma's en regelovergangen bevatten; de parser moet quoted fields per RFC 4180-logica correct verwerken. De CSV-parser is een eigen module in vanilla JS (geen externe bibliotheek nodig zolang de eigen module de fixture uit sectie 12 foutloos verwerkt; volstaat dat niet, dan wordt PapaParse lokaal gevendord en staat die keuze gemotiveerd in de project-CLAUDE.md). Encoding: verwerk zowel UTF-8 als Windows-1252; probeer UTF-8, en val bij decodeerfouten terug op Windows-1252 via TextDecoder.

### 3.2 Validatie bij upload

Controleer dat de headerrij exact de verwachte kolomnamen bevat (case-insensitief, whitespace-getrimd). Zo niet: weiger de import met de actiegerichte melding "Dit bestand heeft niet het verwachte KBC-formaat. Exporteer in KBC Mobile of Touch via Rekening, Zoeken, CSV en probeer opnieuw", en toon de gevonden headerrij. Toon voor bevestiging van elke import een preview met aantal rijen, datumbereik en de eerste vijf transacties. Rijen waarvan Bedrag niet numeriek parsebaar is of waarvan Datum ongeldig is, worden overgeslagen en geteld als foutief; de import gaat door voor de geldige rijen.

### 3.3 Normalisatie naar intern model

Elke geldige rij wordt een transactie met deze velden. `id`: SHA-256-hex (WebCrypto) van de aaneenschakeling rekeningnummer, boekdatum (ISO), bedrag in cent, saldo in cent, en volledige omschrijving, gescheiden door het pipe-teken. `accountIban`: Rekeningnummer zonder spaties. `bookingDate` en `valueDate`: ISO 8601 datum (jjjj-mm-dd), respectievelijk uit Datum en Valuta. `amountCents`: integer, bedrag maal honderd, negatief voor uitgaand; nergens in de app floats voor geldbedragen. `balanceCents`: integer uit Saldo. `direction`: "in" als amountCents groter dan nul, anders "uit". `counterpartyIban`: Rekening tegenpartij zonder spaties, leeg toegestaan. `counterpartyName`: Naam tegenpartij, leeg toegestaan. `description`: Omschrijving, ruw. `merchant`: geëxtraheerde handelaarsnaam, zie 3.4. `structuredRef` en `freeRef`: de twee mededelingsvelden. `categoryId`: null bij import. `costClass`: null bij import (wordt afgeleid van categorie, per transactie overschrijfbaar). `isInternal`: boolean, zie 5. `isOneOff`: boolean, standaard false, zie 7. `manualCategory`: boolean, standaard false; wordt true zodra de gebruiker de categorie van deze transactie handmatig zet, en beschermt die keuze tegen herclassificatie.

### 3.4 Handelaarsextractie voor kaartbetalingen

Voor transacties zonder counterpartyIban waarvan de omschrijving begint met "BETALING VIA DEBIT MASTERCARD" of "BETALING VIA BANCONTACT": extraheer de handelaarsnaam als de tekst tussen "UUR " en de eerste daaropvolgende match van het patroon "BE" gevolgd door vier cijfers, of, indien afwezig, tot " MET ". Trim het resultaat. Voorbeeld: uit "BETALING VIA DEBIT MASTERCARD 13-07-2026 OM 13.14 UUR LE MIRANTE BE1000 BRUXELLES MET APPLE PAY…" wordt merchant "LE MIRANTE". Als extractie mislukt, blijft merchant leeg en matchen regels op description.

### 3.5 Deduplicatie en continuïteit

Import is idempotent: rijen waarvan `id` al in de opslag zit, worden overgeslagen. De importsamenvatting toont drie tellers: nieuw, dubbel, foutief. Continuïteitscheck: sorteer na import alle transacties van dezelfde rekening op boekdatum en afschriftvolgorde; als er tussen de laatst bekende `balanceCents` van de bestaande data en de eerste nieuwe rij een sprong zit die niet verklaard wordt door het bedrag van die rij, toon een niet-blokkerende waarschuwing "Mogelijk ontbreken er transacties tussen [datum] en [datum]. Exporteer die periode bij KBC en laad ze op".

## 4. Categorieën en kostenklassen

### 4.1 Model

Een categorie heeft `id`, `name`, `type` ("in" of "uit"), `costClass` ("vast", "variabel" of "discretionair"; alleen relevant voor type uit, voor type in is de waarde null) en `color` (hex, gebruikt in grafieken). Eén niveau, geen subcategorieën. De gebruiker kan categorieën toevoegen, hernoemen, van kostenklasse veranderen en verwijderen. Verwijderen is destructief en vraagt dus een confirm() met vermelding van het aantal getroffen transacties; die worden teruggezet naar Ongecategoriseerd.

### 4.2 Startset

Inkomsten: Omzet consulting, Omzet EPC, Overige inkomsten. Uitgaven met klasse vast: Verzekeringen, IPT en pensioen (op vraag van de gebruiker toegevoegd voor IPT-premies), Sociaal secretariaat, Leasing, Telecom en abonnementen, Loon. Uitgaven met klasse variabel: Belastingen en btw, Brandstof en laden, Mobiliteit, Software en IT, Bankkosten. Uitgaven met klasse discretionair: Horeca, Aankopen divers. Plus één systeemcategorie "Ongecategoriseerd" die niet verwijderbaar is.

### 4.3 Kostenklasse per transactie

De klasse van een transactie is standaard die van haar categorie, maar per transactie overschrijfbaar via de detailweergave. De overschrijving overleeft herclassificatie.

## 5. Eigen rekeningen en interne overschrijvingen

De gebruiker beheert in instellingen een lijst eigen IBAN's met label. Elke transactie waarvan counterpartyIban in die lijst staat, krijgt `isInternal` true, met terugwerkende kracht bij toevoeging van een IBAN. Interne transacties tellen nooit mee in enige som, grafiek of teller van het dashboard, maar blijven zichtbaar in de transactielijst met een herkenbaar label en via een filter "toon interne" opvraagbaar. De app stelt bij import kandidaten voor: tegenpartij-IBAN's waarvan counterpartyName gelijkenis vertoont met de rekeninghoudersnaam uit kolom Naam (case-insensitieve substring-match op achternaam). De gebruiker bevestigt of verwerpt per kandidaat; de app voegt nooit zelf een IBAN aan de lijst toe.

## 6. Regelsysteem voor categorisatie

### 6.1 Regelmodel

Een regel heeft `id`, `field` ("counterpartyIban", "counterpartyName", "merchant" of "description"), `matchType` ("contains", "startsWith", "equals"; alle case-insensitief), `value`, `categoryId`, optioneel `costClass` (overschrijft de categorieklasse voor gematchte transacties), `priority` (integer, lager is eerder), `active` (boolean) en `hitCount`. Evaluatievolgorde: oplopende priority, eerste match wint. Nieuwe regels krijgen standaard een priority na alle bestaande; regels op counterpartyIban krijgen bij aanmaak standaard priority vóór tekstregels.

### 6.2 Toepassing

Regels lopen automatisch over elke nieuw geïmporteerde transactie. Transacties met `manualCategory` true worden nooit door regels overschreven. Een knop "Alles herclassificeren" in het regelbeheer past de actuele regelset toe op alle transacties behalve die met manualCategory true, en meldt hoeveel transacties van categorie veranderden.

### 6.3 Regel aanmaken vanuit een transactie

Wanneer de gebruiker in de detailweergave een categorie kiest, toont de app twee opties: "Alleen deze transactie" (zet manualCategory true) of "Regel aanmaken". Bij regel aanmaken stelt de app het matchveld en de waarde voor: counterpartyIban als dat gevuld is, anders merchant als dat gevuld is, anders counterpartyName, anders een door de gebruiker in te korten fragment van description. De gebruiker kan veld, matchtype en waarde aanpassen voor bevestiging, en ziet live hoeveel bestaande transacties de regel zou raken. Na bevestiging wordt de regel direct toegepast op alle niet-handmatige transacties.

### 6.4 Ingebouwde suggestielijst

Voor ongecategoriseerde transacties toont de app een suggestie op basis van een vaste, in de code opgenomen herkenningslijst van Belgische tegenpartijen, gematcht op counterpartyName, merchant of description (contains, case-insensitief). Minimaal deze mappings: Telenet naar Telecom en abonnementen; Liantis naar Sociaal secretariaat; DKV, Vivium en NN Insurance naar Verzekeringen; DATS 24 en Fastned naar Brandstof en laden; NMBS naar Mobiliteit; "btw-ontvangsten" en "belastingen" naar Belastingen en btw; "leasing" in de omschrijving naar Leasing; Edenred naar Loon; Anthropic, Mollie en Teamleader naar Software en IT. Een suggestie wordt getoond met één bevestigingsknop en één knop "Andere categorie"; bevestigen maakt automatisch een regel aan volgens 6.3 met het best beschikbare matchveld. De app categoriseert nooit definitief zonder gebruikersbevestiging, met als enige uitzondering door de gebruiker zelf aangemaakte of bevestigde regels.

### 6.5 Regelbeheer

Een scherm met alle regels: veld, waarde, categorie, klasse-overschrijving, priority, actief-toggle, hitCount, verwijderknop (met confirm(), want destructief), en pijltjes om priority te herordenen.

## 7. Eenmalige transacties

Elke transactie kan via de detailweergave en via een contextactie in de lijst gemarkeerd worden als eenmalig (`isOneOff` true), en even makkelijk terug ontmarkeerd. Markeren is frequent en omkeerbaar en krijgt dus een undo-toast van circa zes seconden, geen confirm(). Semantiek, strikt toe te passen: eenmalige transacties tellen niet mee in geen enkel totaal, geen enkele grafiek, geen enkele categoriesom en geen enkele klassesom van het dashboard, in maand- noch boekjaarweergave. Ze blijven bestaan in de opslag en in de transactielijst, waar ze een zichtbaar "eenmalig"-label dragen. Het dashboard toont per periode één regel "n eenmalige transacties verborgen, samen € x" als die er zijn; die regel is klikbaar en opent de transactielijst gefilterd op eenmalig, zodat het bedrag nooit stilletjes verdwijnt. Interne en eenmalige transacties zijn twee onafhankelijke vlaggen met hetzelfde uitsluitingsgedrag.

## 8. Dashboard

### 8.1 Periodekeuze

Bovenaan het dashboard staat een periodeschakelaar met twee standen: Maand en Boekjaar. In de stand Maand navigeert de gebruiker met vorige- en volgende-pijlen per kalendermaand; standaard de meest recente maand met data. In de stand Boekjaar idem per boekjaar. Het boekjaar is instelbaar in de instellingen als startmaand (1 tot 12), standaard januari; een boekjaar loopt twaalf maanden vanaf die startmaand en wordt getoond als "Boekjaar 2026" (bij start januari) of "Boekjaar 2026–2027" (bij afwijkende startmaand). Alle bedragen op het dashboard worden herrekend naar de gekozen periode: uitsluitend transacties met bookingDate binnen de periode, exclusief interne en eenmalige transacties, tellen mee.

### 8.2 Inhoud, van boven naar onder

Eerst drie kerncijfers: totaal in, totaal uit, netto, elk met daaronder in kleiner formaat het verschil tegenover de vorige overeenkomstige periode (vorige maand respectievelijk vorig boekjaar), in euro en als percentage; als de vorige periode geen data heeft, blijft het verschil leeg. Daarna een gestapelde balkgrafiek van de uitgaven per kostenklasse: in maandstand één balk per week van de maand, in boekjaarstand één balk per maand van het boekjaar, met de drie klassen als segmenten in vaste kleuren en een legende. De grafiek wordt zelf getekend als SVG in een eigen module; geen grafiekbibliotheek. Daarna een blok "Vaste lasten" met de som van alle uitgaven met effectieve klasse vast in de periode, en in boekjaarstand tevens het maandgemiddelde ervan. Daarna "Top uitgavencategorieën": de vijf grootste uitgavencategorieën van de periode met bedrag, aandeel in procent en verschil tegenover de vorige periode; elke rij klikbaar naar de gefilterde transactielijst. Daarna de discretionaire samenvatting: totaal discretionair, aantal transacties, en de grootste discretionaire categorie met bedrag. Onderaan de eventuele eenmalig-regel uit sectie 7 en een lijst van de tien recentste transacties van de periode met datum, tegenpartij of handelaar, categorie en bedrag, elk klikbaar naar de detailweergave.

### 8.3 Ongecategoriseerd

Zolang de periode ongecategoriseerde transacties bevat, toont het dashboard bovenaan een niet-wegklikbare banner "n transacties wachten op een categorie" die doorlinkt naar een werklijst waarin de gebruiker ze één voor één met suggesties (6.4) kan afwerken. Ongecategoriseerde uitgaven tellen in alle sommen mee onder de categorie Ongecategoriseerd met klasse variabel, zodat de totalen altijd kloppen met de bankrealiteit.

## 9. Transactielijst en detail

De transactielijst toont alle transacties, nieuwste eerst, met filters op periode, categorie, kostenklasse, richting, tekst (zoekt in counterpartyName, merchant, description en beide mededelingen), en toggles voor interne en eenmalige transacties. Elke rij toont datum, tegenpartij of handelaar, categorie als gekleurde chip, labels voor intern en eenmalig, en het bedrag met teken. De detailweergave toont alle velden van de transactie, de categoriekiezer met de flow uit 6.3, de klasse-overschrijving, de eenmalig-toggle en, als een regel deze transactie categoriseerde, welke regel dat was met een link naar het regelbeheer.

## 10. Vaste-kostendetectie

Achtergrondlogica na elke import: groepeer uitgaande, niet-interne, niet-eenmalige transacties op counterpartyIban plus merchant. Een groep is een kandidaat-vaste-kost als hij minstens drie transacties telt met intervallen van achtentwintig tot drieëndertig dagen (maandelijks), vierentachtig tot achtennegentig dagen (driemaandelijks) of driehonderdvijftig tot driehonderdtachtig dagen (jaarlijks), en de bedragen binnen tien procent van hun mediaan liggen. Kandidaten verschijnen in een lijst "Herkende vaste kosten" waar de gebruiker per kandidaat bevestigt of verwerpt. Bevestigde reeksen zetten de klasse-overschrijving van hun transacties op vast en verschijnen in het blok Vaste lasten met hun maandequivalent (driemaandelijks gedeeld door drie, jaarlijks door twaalf). De app wijzigt nooit klassen zonder die bevestiging.

## 11. Techniek

### 11.1 Stack en architectuur, conform BASIS.md

Vanilla HTML, CSS en JavaScript (ES-modules). Geen framework, geen build-stap, geen runtime-dependencies; de enige toegestane uitzondering is een lokaal gevendorde PapaParse als de eigen CSV-module de fixture niet aankan (zie 3.1), gemotiveerd in de project-CLAUDE.md. Navigatie tussen de vijf hoofdschermen (Dashboard, Prognose, Transacties, Regels, Instellingen met daaronder categorieën, eigen rekeningen, boekjaar-startmaand, backup) via hash-routing in een eigen module. Opslag rechtstreeks in IndexedDB via een eigen dunne wrapper-module met promise-interface; geen Dexie. Alles in het Nederlands: interface, foutmeldingen, commits en documentatie. Mobile-first layout voor iPhone/Safari, bruikbaar vanaf 360 pixels breed, met de uploadknop en periodeschakelaar op het dashboard bereikbaar zonder scrollen. iOS-beperkingen die het project raakt worden eerlijk opgevangen en gedocumenteerd; concreet minstens deze: bestandsupload gebeurt via een input type file (werkt in Safari), en het risico dat iOS IndexedDB-data van weinig gebruikte webapps opruimt wordt beantwoord met de maandelijkse backup-herinnering uit 11.4 plus een poging tot navigator.storage.persist() bij eerste gebruik, waarvan het resultaat niet als garantie wordt voorgesteld.

### 11.2 Opslagschema (IndexedDB object stores)

`transactions` met sleutel id en indexen op bookingDate, categoryId, counterpartyIban, isInternal, isOneOff. `categories` met sleutel id. `rules` met sleutel id en index op priority. `ownAccounts` met sleutel iban. `recurringCandidates` met sleutel id (hash van groepssleutel) en veld status ("kandidaat", "bevestigd", "verworpen"). `settings` als key-value store.

### 11.3 Service worker, versie en updates

Cachestrategie: cache-first voor alle app-assets, gemotiveerd in de project-CLAUDE.md door het offline-first doel en het feit dat de app geen externe data ophaalt. Eén versieconstante `VERSIE` in sw.js, tegelijk cachenaam en updatesignaal; nergens anders een versienummer in code. Updatecheck bij start en bij visibilitychange via een cache-gebuste netwerk-fetch van sw.js die de service worker nooit onderschept; geen periodieke polling, want niets in dit project motiveert dat. Bij een nieuwe versie verschijnt de balk "Nieuwe versie beschikbaar" met een knop die service workers deregistreert, alle caches wist en herlaadt; nooit ongevraagd herladen. De asset-lijst in sw.js wordt door een test vergeleken met index.html.

### 11.4 Backup en export

Instellingen bevat "Backup downloaden": één JSON-bestand met een schemaversienummer en de volledige inhoud van alle stores. En "Backup terugzetten": leest zo'n bestand, valideert het schemaversienummer, en vervangt na confirm() ("Dit vervangt alle huidige data") de volledige opslag. Daarnaast "Exporteer transacties als CSV": puntkomma-gescheiden bestand met alle transactievelden plus categorienaam en effectieve kostenklasse, decimale komma, dd/mm/jjjj, zodat het in Excel met Belgische regio-instellingen direct opent. De app herinnert maandelijks aan een backup via een subtiele banner.

### 11.5 Fouten en opslagfeedback

Foutmeldingen zeggen wat de gebruiker kan doen, niet enkel wat misging; de teksten in 3.2 en 3.5 zijn het referentieniveau. Een mislukte schrijfactie naar IndexedDB is zichtbaar als rode balk met retry-knop tot ze slaagt; geslaagde opslag is stil. Destructieve acties (categorie verwijderen, regel verwijderen, backup terugzetten) vragen confirm(); frequente omkeerbare acties (eenmalig markeren, hercategoriseren van één transactie) krijgen een undo-toast van circa zes seconden.

### 11.6 Kwaliteitseisen

Alle geldberekeningen in integer-centen; weergave via één centrale formatter (Intl.NumberFormat nl-BE, EUR). Alle datums intern ISO-strings; weergave dd/mm/jjjj. Geen netwerkverzoeken behalve het laden van de app zelf en de updatecheck. Toetsenbordfocus zichtbaar, prefers-reduced-motion gerespecteerd.

## 12. Tests

De volledige suite draait vóór elke push; honderd procent dekking op de app-bestanden is een harde faalvoorwaarde. Onbereikbare defensieve code wordt verwijderd, niet gedoogd. De CSV-parser en de handelaarsextractie worden getest tegen een bevroren echte KBC-export als fixture (de referentie-export van dit project, met een refresh-script dat een nieuwe export op de fixture-plaats zet), niet enkel tegen handgemaakte data. Verder minstens: unit-tests voor bedrag- en datumnormalisatie, id-hashing, deduplicatie, regelmatching en prioriteit, periodeberekening voor maand en boekjaar inclusief afwijkende startmaand, de uitsluitingslogica van intern en eenmalig in elke som, en de vaste-kostendetectie met randgevallen op de intervalgrenzen; plus de test die de asset-lijst in sw.js vergelijkt met index.html. Wat alleen op het echte toestel kan (installatie op het beginscherm, gedrag van navigator.storage.persist(), bestandskiezer in Safari, offline gebruik na installatie) staat in een handmatige checklist in de projectdocs; bij elke release wordt expliciet vermeld dat die checklist bij de gebruiker ligt.

## 13. Documentatie

README voor de gebruiker: wat de app doet, hoe je een KBC-export maakt en oplaadt, wat eenmalig en intern betekenen, hoe backup werkt. CLAUDE.md voor de ontwikkelaar: architectuurkeuzes met motivatie (cachestrategie, eigen CSV-parser of gevendorde PapaParse, eigen SVG-grafiek), en een valkuilen-sectie die vanaf de eerste betaalde les wordt bijgehouden. Dit SPEC.md blijft de bron van waarheid voor gedrag. Geen versienummers of regeltellingen in doc-proza.

## 14. Acceptatiecriteria

Eén: de referentie-KBC-export importeert zonder foutieve rijen; een tweede import van hetzelfde bestand meldt nul nieuwe en alle rijen als dubbel. Twee: na het toevoegen van het privé-IBAN van de zaakvoerder als eigen rekening zijn alle overschrijvingen van en naar dat IBAN intern, en zijn totaal in en totaal uit van de betrokken maand exact de som van de resterende transacties. Drie: een transactie als eenmalig markeren verlaagt onmiddellijk alle betrokken totalen, klassesommen en categoriesommen in beide periodestanden, toont een undo-toast, en de verborgen-regel toont aantal en bedrag correct. Vier: een regel op counterpartyName contains "Telenet" categoriseert beide Telenet-domiciliëringen en elke latere import ervan, met hitCount die meetelt. Vijf: de boekjaarweergave met startmaand januari over 2026 toont per maand een balk waarvan de klassensom gelijk is aan totaal uit van die maand exclusief intern en eenmalig. Zes: een handmatig gecategoriseerde transactie verandert niet bij "Alles herclassificeren". Zeven: de app is na eerste load installeerbaar en werkt volledig zonder netwerk, inclusief nieuwe CSV-import en alle schermen, en een VERSIE-bump toont na deploy de updatebalk zonder ongevraagde herlaadactie. Acht: de testsuite is groen met honderd procent dekking op de app-bestanden en de sw.js-assettest slaagt.

## 15. Prognose (aanvulling, op vraag van de gebruiker)

Een vijfde hoofdscherm "Prognose" rekent het lopende boekjaar door op basis van de echte cijfers, op kasbasis en met dezelfde uitsluitingen als het dashboard (interne en eenmalige transacties tellen nooit mee). Methode, op dagbasis: de app neemt letterlijk de periode van de eerste tot en met de laatste datum met data binnen het boekjaar, berekent per categorie het daggemiddelde over die periode, en trekt dat door over de resterende dagen tot het einde van het boekjaar; jaartotaal is gerealiseerd plus verwacht. Zowel de omzet als de kosten worden per categorie apart doorgerekend en getoond (omzet consulting en omzet EPC dus als aparte lijnen), elk met gerealiseerd bedrag, verwacht bedrag, maandgemiddelde en een balk die het aandeel gerealiseerd toont, plus drie kerncijfers bovenaan (verwachte omzet, verwachte kosten, verwacht resultaat vóór belastingen). Betalingen in de categorie "Belastingen en btw" tellen niet mee in het resultaat vóór belastingen; dat staat er expliciet bij, net als de dataperiode waarop de prognose steunt en de vermelding dat het om bankbedragen inclusief btw gaat. Zonder data verwijst het scherm naar de import. Eigen omzetverwachting: de gebruiker kan een dagtarief en een aantal werkdagen per jaar invullen (bewaard in de instellingen-store); zijn beide ingevuld, dan is de verwachte omzet dagtarief maal werkdagen in plaats van de doorgetrokken bankontvangsten, telt het resultaat vóór belastingen met die eigen omzet, en blijft de bankprognose als vergelijking zichtbaar. Leegmaken keert terug naar de bankcijfers.
