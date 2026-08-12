// Normalisatie van een KBC-CSV-rij naar het interne transactiemodel.
import { laatsteDag } from './periods.js';

export const KOLOMMEN = ['Rekeningnummer', 'Rubrieknaam', 'Naam', 'Munt', 'Afschriftnummer',
  'Datum', 'Omschrijving', 'Valuta', 'Bedrag', 'Saldo', 'Credit', 'Debet',
  'Rekening tegenpartij', 'BIC code tegenpartij', 'Naam tegenpartij', 'Adres tegenpartij',
  'gestructureerde mededeling', 'vrije mededeling'];

// KBC sluit datarijen (en soms de header) af met een puntkomma; die lege
// extra slotkolom telt niet mee als kolom.
export function zonderSlotkolom(rij) {
  if (rij.length === KOLOMMEN.length + 1 && rij[rij.length - 1] === '') return rij.slice(0, -1);
  return rij;
}

export function valideerHeader(rij) {
  const kolommen = zonderSlotkolom(rij);
  if (kolommen.length !== KOLOMMEN.length) return false;
  return KOLOMMEN.every((naam, i) => kolommen[i].trim().toLowerCase() === naam.toLowerCase());
}

// Bedrag met decimale komma, zonder duizendtallenscheiding, naar integer-centen.
export function parseBedrag(tekst) {
  const m = /^(-?)(\d+)(?:,(\d{1,2}))?$/.exec(tekst);
  if (m === null) return null;
  const centen = Number(m[2]) * 100 + Number((m[3] ?? '00').padEnd(2, '0'));
  return m[1] === '-' ? -centen : centen;
}

// dd/mm/jjjj naar ISO 8601, met echte kalendervalidatie.
export function parseDatumBE(tekst) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(tekst);
  if (m === null) return null;
  const dag = Number(m[1]);
  const maand = Number(m[2]);
  const jaar = Number(m[3]);
  if (maand < 1 || maand > 12 || dag < 1 || dag > laatsteDag(jaar, maand)) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Handelaarsextractie voor kaartbetalingen zonder tegenpartij-IBAN (spec 3.4).
const KAART_PREFIXEN = ['BETALING VIA DEBIT MASTERCARD', 'BETALING VIA BANCONTACT'];

export function extraheerHandelaar(omschrijving) {
  if (!KAART_PREFIXEN.some((p) => omschrijving.startsWith(p))) return '';
  const uurIndex = omschrijving.indexOf('UUR ');
  if (uurIndex === -1) return '';
  const rest = omschrijving.slice(uurIndex + 4);
  const beMatch = /BE\d{4}/.exec(rest);
  if (beMatch !== null) return rest.slice(0, beMatch.index).trim();
  const metIndex = rest.indexOf(' MET ');
  if (metIndex === -1) return '';
  return rest.slice(0, metIndex).trim();
}

export async function sha256Hex(tekst) {
  const data = new TextEncoder().encode(tekst);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Eén geldige CSV-rij naar een transactie; null bij onbruikbare rij (spec 3.2).
export async function normaliseerRij(velden) {
  const bookingDate = parseDatumBE(velden[5].trim());
  const amountCents = parseBedrag(velden[8].trim());
  const balanceCents = parseBedrag(velden[9].trim());
  if (bookingDate === null || amountCents === null || balanceCents === null) return null;
  const valueDate = parseDatumBE(velden[7].trim()) ?? bookingDate;
  const accountIban = velden[0].replaceAll(' ', '');
  const counterpartyIban = velden[12].replaceAll(' ', '');
  const description = velden[6];
  const id = await sha256Hex(
    `${accountIban}|${bookingDate}|${amountCents}|${balanceCents}|${description}`,
  );
  return {
    id,
    accountIban,
    bookingDate,
    valueDate,
    amountCents,
    balanceCents,
    direction: amountCents > 0 ? 'in' : 'uit',
    counterpartyIban,
    counterpartyName: velden[14].trim(),
    description,
    merchant: counterpartyIban === '' ? extraheerHandelaar(description) : '',
    structuredRef: velden[16].trim(),
    freeRef: velden[17].trim(),
    categoryId: null,
    costClass: null,
    manualClass: false,
    isInternal: false,
    isOneOff: false,
    manualCategory: false,
    ruleId: null,
  };
}
