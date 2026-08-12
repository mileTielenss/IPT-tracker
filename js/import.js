// Importverwerking: parsen, valideren, normaliseren, dedupliceren (spec 3).
import { parseCsv } from './csv.js';
import { valideerHeader, normaliseerRij, KOLOMMEN } from './normalize.js';

export const FORMAAT_FOUT = 'Dit bestand heeft niet het verwachte KBC-formaat. ' +
  'Exporteer in KBC Mobile of Touch via Rekening, Zoeken, CSV en probeer opnieuw.';

// Verwerkt de tekst van een CSV-bestand tot een importvoorstel.
// Schrijft niets weg; de aanroeper toont eerst de preview (spec 3.2).
export async function verwerkBestand(tekst, bestaandeIds) {
  const rijen = parseCsv(tekst);
  if (rijen.length === 0 || !valideerHeader(rijen[0])) {
    return {
      geldig: false,
      foutmelding: FORMAAT_FOUT,
      gevondenHeader: rijen.length === 0 ? '(leeg bestand)' : rijen[0].join(';'),
    };
  }
  const nieuwe = [];
  const gezien = new Set(bestaandeIds);
  let dubbel = 0;
  let foutief = 0;
  let houderNaam = '';
  for (const rij of rijen.slice(1)) {
    if (rij.length !== KOLOMMEN.length) {
      foutief++;
      continue;
    }
    const tx = await normaliseerRij(rij);
    if (tx === null) {
      foutief++;
      continue;
    }
    houderNaam = rij[2].trim();
    if (gezien.has(tx.id)) {
      dubbel++;
      continue;
    }
    gezien.add(tx.id);
    nieuwe.push(tx);
  }
  const datums = nieuwe.map((tx) => tx.bookingDate).sort();
  return {
    geldig: true,
    nieuwe,
    dubbel,
    foutief,
    houderNaam,
    preview: {
      aantal: nieuwe.length + dubbel + foutief,
      datumVan: datums.length === 0 ? null : datums[0],
      datumTot: datums.length === 0 ? null : datums[datums.length - 1],
      eersteVijf: nieuwe.slice(0, 5),
    },
  };
}

// Continuïteitscheck (spec 3.5): klopt het saldo van de eerste nieuwe rij
// met het laatst bekende saldo van dezelfde rekening?
export function continuiteitsWaarschuwing(bestaande, nieuwe) {
  for (const rekening of new Set(nieuwe.map((tx) => tx.accountIban))) {
    const oud = bestaande.filter((tx) => tx.accountIban === rekening)
      .sort((a, b) => (a.bookingDate < b.bookingDate ? -1 : 1));
    if (oud.length === 0) continue;
    const laatste = oud[oud.length - 1];
    const vers = nieuwe.filter((tx) => tx.accountIban === rekening)
      .sort((a, b) => (a.bookingDate < b.bookingDate ? -1 : 1))
      .filter((tx) => tx.bookingDate >= laatste.bookingDate);
    if (vers.length === 0) continue;
    const eerste = vers[0];
    if (eerste.balanceCents - eerste.amountCents !== laatste.balanceCents) {
      return 'Mogelijk ontbreken er transacties tussen ' +
        `${laatste.bookingDate} en ${eerste.bookingDate}. ` +
        'Exporteer die periode bij KBC en laad ze op.';
    }
  }
  return null;
}

// Kandidaten voor eigen rekeningen (spec 5): tegenpartijnaam lijkt op de
// achternaam van de rekeninghouder. De app voegt zelf nooit een IBAN toe.
export function eigenRekeningKandidaten(transacties, houderNaam, bekendeIbans) {
  const woorden = houderNaam.trim().split(/\s+/);
  const achternaam = woorden[woorden.length - 1].toLowerCase();
  if (achternaam === '') return [];
  const kandidaten = new Map();
  for (const tx of transacties) {
    if (tx.counterpartyIban === '' || bekendeIbans.has(tx.counterpartyIban)) continue;
    if (tx.counterpartyName.toLowerCase().includes(achternaam)) {
      kandidaten.set(tx.counterpartyIban, { iban: tx.counterpartyIban, naam: tx.counterpartyName });
    }
  }
  return [...kandidaten.values()];
}
