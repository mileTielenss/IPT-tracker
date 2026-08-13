// Centrale formattering (nl-BE).
const heleEuro = new Intl.NumberFormat('nl-BE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});
const preciesEuro = new Intl.NumberFormat('nl-BE', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const procent = new Intl.NumberFormat('nl-BE', { style: 'percent', maximumFractionDigits: 1 });

export function formatteerEuro(bedrag) {
  return heleEuro.format(bedrag);
}

export function formatteerEuroPrecies(bedrag) {
  return preciesEuro.format(bedrag);
}

export function formatteerProcent(fractie) {
  return procent.format(fractie);
}

export function formatteerDatum(iso) {
  const [jaar, maand, dag] = iso.split('-');
  return `${dag}/${maand}/${jaar}`;
}
