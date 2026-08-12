// Categorieën en kostenklassen (spec 4).

export const ONGECATEGORISEERD = 'ongecategoriseerd';
export const KLASSEN = ['vast', 'variabel', 'discretionair'];
export const KLASSE_KLEUREN = { vast: '#1565c0', variabel: '#ef6c00', discretionair: '#8e24aa' };

export function standaardCategorieen() {
  return [
    { id: 'omzet-consulting', name: 'Omzet consulting', type: 'in', costClass: null, color: '#2e7d32' },
    { id: 'omzet-epc', name: 'Omzet EPC', type: 'in', costClass: null, color: '#43a047' },
    { id: 'overige-inkomsten', name: 'Overige inkomsten', type: 'in', costClass: null, color: '#66bb6a' },
    { id: 'verzekeringen', name: 'Verzekeringen', type: 'uit', costClass: 'vast', color: '#1565c0' },
    { id: 'ipt-pensioen', name: 'IPT en pensioen', type: 'uit', costClass: 'vast', color: '#00897b' },
    { id: 'sociaal-secretariaat', name: 'Sociaal secretariaat', type: 'uit', costClass: 'vast', color: '#1e88e5' },
    { id: 'leasing', name: 'Leasing', type: 'uit', costClass: 'vast', color: '#42a5f5' },
    { id: 'telecom', name: 'Telecom en abonnementen', type: 'uit', costClass: 'vast', color: '#64b5f6' },
    { id: 'loon', name: 'Loon', type: 'uit', costClass: 'vast', color: '#7986cb' },
    { id: 'belastingen', name: 'Belastingen en btw', type: 'uit', costClass: 'variabel', color: '#ef6c00' },
    { id: 'brandstof', name: 'Brandstof en laden', type: 'uit', costClass: 'variabel', color: '#f57c00' },
    { id: 'mobiliteit', name: 'Mobiliteit', type: 'uit', costClass: 'variabel', color: '#fb8c00' },
    { id: 'software', name: 'Software en IT', type: 'uit', costClass: 'variabel', color: '#ffa726' },
    { id: 'bankkosten', name: 'Bankkosten', type: 'uit', costClass: 'variabel', color: '#bf360c' },
    { id: 'horeca', name: 'Horeca', type: 'uit', costClass: 'discretionair', color: '#8e24aa' },
    { id: 'aankopen-divers', name: 'Aankopen divers', type: 'uit', costClass: 'discretionair', color: '#ab47bc' },
    { id: ONGECATEGORISEERD, name: 'Ongecategoriseerd', type: 'uit', costClass: 'variabel', color: '#9e9e9e' },
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
