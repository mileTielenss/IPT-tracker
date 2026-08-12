// Ingebouwde herkenningslijst van Belgische tegenpartijen (spec 6.4).
// Matcht op counterpartyName, merchant of description: contains, case-insensitief.

export const HERKENNINGSLIJST = [
  { zoek: 'telenet', categoryId: 'telecom' },
  { zoek: 'liantis', categoryId: 'sociaal-secretariaat' },
  { zoek: 'dkv', categoryId: 'verzekeringen' },
  { zoek: 'vivium', categoryId: 'verzekeringen' },
  { zoek: 'nn insurance', categoryId: 'verzekeringen' },
  { zoek: 'dats 24', categoryId: 'brandstof' },
  { zoek: 'fastned', categoryId: 'brandstof' },
  { zoek: 'nmbs', categoryId: 'mobiliteit' },
  { zoek: 'btw-ontvangsten', categoryId: 'belastingen' },
  { zoek: 'belastingen', categoryId: 'belastingen' },
  { zoek: 'leasing', categoryId: 'leasing' },
  { zoek: 'edenred', categoryId: 'loon' },
  { zoek: 'anthropic', categoryId: 'software' },
  { zoek: 'mollie', categoryId: 'software' },
  { zoek: 'teamleader', categoryId: 'software' },
];

export function suggereerCategorie(tx) {
  const velden = [tx.counterpartyName, tx.merchant, tx.description];
  for (const item of HERKENNINGSLIJST) {
    if (velden.some((v) => v.toLowerCase().includes(item.zoek))) return item.categoryId;
  }
  return null;
}
