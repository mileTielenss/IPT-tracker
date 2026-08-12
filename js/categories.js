// Categorieën en kostenklassen (spec 4).

export const ONGECATEGORISEERD = 'ongecategoriseerd';
export const KLASSEN = ['vast', 'variabel', 'discretionair'];
// Gevalideerd categorisch palet (drie klassen, alle paren CVD-veilig).
export const KLASSE_KLEUREN = { vast: '#2a78d6', variabel: '#eb6834', discretionair: '#1baf7a' };

export function standaardCategorieen() {
  return [
    { id: 'omzet-consulting', name: 'Omzet consulting', type: 'in', costClass: null, color: '#047857' },
    { id: 'omzet-epc', name: 'Omzet EPC', type: 'in', costClass: null, color: '#15803d' },
    { id: 'overige-inkomsten', name: 'Overige inkomsten', type: 'in', costClass: null, color: '#4d7c0f' },
    { id: 'verzekeringen', name: 'Verzekeringen', type: 'uit', costClass: 'vast', color: '#1d4ed8' },
    { id: 'ipt-pensioen', name: 'IPT en pensioen', type: 'uit', costClass: 'vast', color: '#0e7490' },
    { id: 'sociaal-secretariaat', name: 'Sociaal secretariaat', type: 'uit', costClass: 'vast', color: '#6d28d9' },
    { id: 'leasing', name: 'Leasing', type: 'uit', costClass: 'vast', color: '#0369a1' },
    { id: 'telecom', name: 'Telecom en abonnementen', type: 'uit', costClass: 'vast', color: '#4f46e5' },
    { id: 'loon', name: 'Loon', type: 'uit', costClass: 'vast', color: '#334155' },
    { id: 'belastingen', name: 'Belastingen en btw', type: 'uit', costClass: 'variabel', color: '#92400e' },
    { id: 'brandstof', name: 'Brandstof en laden', type: 'uit', costClass: 'variabel', color: '#c2410c' },
    { id: 'mobiliteit', name: 'Mobiliteit', type: 'uit', costClass: 'variabel', color: '#a16207' },
    { id: 'software', name: 'Software en IT', type: 'uit', costClass: 'variabel', color: '#be185d' },
    { id: 'bankkosten', name: 'Bankkosten', type: 'uit', costClass: 'variabel', color: '#9f1239' },
    { id: 'horeca', name: 'Horeca', type: 'uit', costClass: 'discretionair', color: '#7e22ce' },
    { id: 'aankopen-divers', name: 'Aankopen divers', type: 'uit', costClass: 'discretionair', color: '#a21caf' },
    { id: ONGECATEGORISEERD, name: 'Ongecategoriseerd', type: 'uit', costClass: 'variabel', color: '#6b7280' },
  ];
}

export function categorieMap(categorieen) {
  return new Map(categorieen.map((c) => [c.id, c]));
}

// Effectieve kostenklasse: overschrijving op de transactie wint van de
// categorieklasse; ongecategoriseerd telt als variabel (spec 8.3).
export function effectieveKlasse(tx, catMap) {
  if (tx.costClass !== null) return tx.costClass;
  const categorie = catMap.get(tx.categoryId);
  if (categorie !== undefined && categorie.costClass !== null) return categorie.costClass;
  return 'variabel';
}

export function categorieNaam(catMap, categoryId) {
  const categorie = catMap.get(categoryId);
  return categorie === undefined ? 'Ongecategoriseerd' : categorie.name;
}
