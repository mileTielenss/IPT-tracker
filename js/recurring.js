// Vaste-kostendetectie (spec 10): groepen uitgaande transacties met
// regelmatige intervallen en stabiele bedragen worden kandidaat-vaste-kosten.
import { sha256Hex } from './normalize.js';
import { dagenTussen } from './periods.js';

export const BANDEN = [
  { frequentie: 'maandelijks', min: 28, max: 33, deler: 1 },
  { frequentie: 'driemaandelijks', min: 84, max: 98, deler: 3 },
  { frequentie: 'jaarlijks', min: 350, max: 380, deler: 12 },
];

export function mediaan(getallen) {
  const gesorteerd = [...getallen].sort((a, b) => a - b);
  const midden = Math.floor(gesorteerd.length / 2);
  if (gesorteerd.length % 2 === 1) return gesorteerd[midden];
  return Math.round((gesorteerd[midden - 1] + gesorteerd[midden]) / 2);
}

function bandVoorIntervallen(intervallen) {
  for (const band of BANDEN) {
    if (intervallen.every((d) => d >= band.min && d <= band.max)) return band;
  }
  return null;
}

export async function detecteerVasteKosten(transacties) {
  const groepen = new Map();
  for (const tx of transacties) {
    if (tx.direction !== 'uit' || tx.isInternal || tx.isOneOff) continue;
    const sleutel = `${tx.counterpartyIban}|${tx.merchant}`;
    if (sleutel === '|') continue;
    if (!groepen.has(sleutel)) groepen.set(sleutel, []);
    groepen.get(sleutel).push(tx);
  }
  const kandidaten = [];
  for (const [sleutel, groep] of groepen.entries()) {
    if (groep.length < 3) continue;
    groep.sort((a, b) => (a.bookingDate < b.bookingDate ? -1 : 1));
    const intervallen = [];
    for (let i = 1; i < groep.length; i++) {
      intervallen.push(dagenTussen(groep[i - 1].bookingDate, groep[i].bookingDate));
    }
    const band = bandVoorIntervallen(intervallen);
    if (band === null) continue;
    const bedragen = groep.map((tx) => -tx.amountCents);
    const med = mediaan(bedragen);
    if (!bedragen.every((b) => Math.abs(b - med) * 10 <= med)) continue;
    kandidaten.push({
      id: await sha256Hex(`vastekost|${sleutel}`),
      sleutel,
      naam: groep[0].merchant !== '' ? groep[0].merchant : groep[0].counterpartyName,
      frequentie: band.frequentie,
      mediaanCents: med,
      maandbedragCents: Math.round(med / band.deler),
      txIds: groep.map((tx) => tx.id),
      status: 'kandidaat',
    });
  }
  return kandidaten;
}

// Nieuwe detectie samenvoegen met opgeslagen kandidaten: een eerder
// bevestigde of verworpen reeks behoudt haar status, txIds worden ververst.
export function voegKandidatenSamen(bestaande, nieuwe) {
  const perId = new Map(bestaande.map((k) => [k.id, k]));
  return nieuwe.map((k) => {
    const oud = perId.get(k.id);
    return oud === undefined ? k : { ...k, status: oud.status };
  });
}
