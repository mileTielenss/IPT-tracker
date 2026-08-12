// JSON-backup, herstel en CSV-export (spec 11.4).
import { formatteerDatum } from './format.js';
import { categorieNaam, effectieveKlasse } from './categories.js';

export const SCHEMA_VERSIE = 1;

export function maakBackup(stores) {
  return {
    schemaVersie: SCHEMA_VERSIE,
    transactions: stores.transactions,
    categories: stores.categories,
    rules: stores.rules,
    ownAccounts: stores.ownAccounts,
    recurringCandidates: stores.recurringCandidates,
    settings: stores.settings,
  };
}

export function valideerBackup(data) {
  return data !== null && typeof data === 'object' && data.schemaVersie === SCHEMA_VERSIE &&
    [data.transactions, data.categories, data.rules, data.ownAccounts,
      data.recurringCandidates, data.settings].every(Array.isArray);
}

// CSV-veld voor puntkomma-gescheiden export met Belgische regio-instellingen.
function csvVeld(waarde) {
  const tekst = String(waarde);
  if (/[;"\n\r]/.test(tekst)) return `"${tekst.replaceAll('"', '""')}"`;
  return tekst;
}

function bedragMetKomma(centen) {
  const teken = centen < 0 ? '-' : '';
  const abs = Math.abs(centen);
  return `${teken}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

export function exporteerCsv(transacties, catMap) {
  const kop = ['id', 'rekening', 'boekdatum', 'valutadatum', 'bedrag', 'saldo', 'richting',
    'tegenpartij IBAN', 'tegenpartij naam', 'handelaar', 'omschrijving',
    'gestructureerde mededeling', 'vrije mededeling', 'categorie', 'kostenklasse',
    'intern', 'eenmalig'];
  const rijen = transacties.map((tx) => [
    tx.id, tx.accountIban, formatteerDatum(tx.bookingDate), formatteerDatum(tx.valueDate),
    bedragMetKomma(tx.amountCents), bedragMetKomma(tx.balanceCents), tx.direction,
    tx.counterpartyIban, tx.counterpartyName, tx.merchant, tx.description,
    tx.structuredRef, tx.freeRef, categorieNaam(catMap, tx.categoryId),
    tx.direction === 'uit' ? effectieveKlasse(tx, catMap) : '',
    tx.isInternal ? 'ja' : 'nee', tx.isOneOff ? 'ja' : 'nee',
  ]);
  return [kop, ...rijen].map((rij) => rij.map(csvVeld).join(';')).join('\r\n');
}
