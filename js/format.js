// Centrale formattering: alle geldbedragen en datums passeren hier.
const geldFormat = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' });
const procentFormat = new Intl.NumberFormat('nl-BE', { style: 'percent', maximumFractionDigits: 1 });

export function formatteerCenten(centen) {
  return geldFormat.format(centen / 100);
}

export function formatteerDatum(iso) {
  const [jaar, maand, dag] = iso.split('-');
  return `${dag}/${maand}/${jaar}`;
}

export function formatteerProcent(fractie) {
  return procentFormat.format(fractie);
}

// Verschil tegenover een vorige periode, in euro en procent.
// Geeft lege string als er geen vorige waarde is om mee te vergelijken.
export function formatteerVerschil(huidigCenten, vorigCenten) {
  if (vorigCenten === null) return '';
  const verschil = huidigCenten - vorigCenten;
  const teken = verschil >= 0 ? '+' : '';
  const euro = `${teken}${formatteerCenten(verschil)}`;
  if (vorigCenten === 0) return euro;
  const procent = `${teken}${formatteerProcent(verschil / Math.abs(vorigCenten))}`;
  return `${euro} (${procent})`;
}
