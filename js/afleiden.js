// Wat de app zelf kan meten in plaats van te laten intikken: het werkelijke
// rendement van de ETF, berekend uit dezelfde koersen die ook de simulatie
// voeden. Er is dus geen apart verzoek voor. De TER staat bewust niet in dit
// bestand — Yahoo geeft die voor Europese ETF's niet vrij zonder
// sessiecookie, dus daarvoor toont de app een bronlink naar justETF.
// Contractuele voorwaarden en fiscale aannames hebben sowieso geen bron.
export function maandenTussenSleutels(vanSleutel, totSleutel) {
  const [vanJaar, vanMaand] = vanSleutel.split('-').map(Number);
  const [totJaar, totMaand] = totSleutel.split('-').map(Number);
  return (totJaar - vanJaar) * 12 + (totMaand - vanMaand);
}

// Samengesteld jaarrendement (CAGR) uit de maandkoersen. Minder dan drie
// jaar historiek zegt te weinig over een langetermijnaanname.
export const MINIMUM_MAANDEN = 36;

// Gemeten wordt er vanaf de start van de polis: dat is de enige periode die
// over deze belegging iets zegt. `vanaf` mag een maandsleutel of een volledige
// datum zijn — er wordt op de maand vergeleken, want '2026-01' < '2026-01-01'
// zou de januarikoers er net buiten laten vallen.
export function historischRendement(koersen, vanaf = '') {
  const grens = vanaf.slice(0, 7);
  const sleutels = Object.keys(koersen).filter((sleutel) => sleutel >= grens).sort();
  if (sleutels.length < 2) return null;
  const eerste = sleutels[0];
  const laatste = sleutels[sleutels.length - 1];
  const maanden = maandenTussenSleutels(eerste, laatste);
  if (maanden < MINIMUM_MAANDEN) return null;
  const begin = koersen[eerste];
  const eind = koersen[laatste];
  if (begin <= 0 || eind <= 0) return null;
  return { rendement: (eind / begin) ** (12 / maanden) - 1, maanden, van: eerste, tot: laatste };
}
