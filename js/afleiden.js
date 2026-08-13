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

// Het meetvenster mag ingekort worden: de volledige historiek van een fonds is
// niet per se de meest representatieve periode. `vanaf` mag een maandsleutel
// of een volledige datum zijn — er wordt op de maand vergeleken, want
// '2026-01' < '2026-01-01' zou de januarikoers er net buiten laten vallen.
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

// Een maandsleutel n maanden verschoven.
export function maandVerschuif(sleutel, maanden) {
  const totaal = Number(sleutel.slice(0, 4)) * 12 + (Number(sleutel.slice(5, 7)) - 1) + maanden;
  return `${Math.floor(totaal / 12)}-${String((totaal % 12) + 1).padStart(2, '0')}`;
}

// Hetzelfde fonds over verschillende vensters. Het antwoord hangt sterk af van
// waar je begint te meten, en dat hoort zichtbaar te zijn voor je een venster
// kiest: op deze tracker scheelt tien jaar tegenover vijf jaar procentpunten.
export const VENSTERS = [120, 60, 36];

export function rendementVensters(koersen) {
  const volledig = historischRendement(koersen);
  if (volledig === null) return [];
  const rijen = [{ label: 'volledige historiek', ...volledig }];
  for (const maanden of VENSTERS) {
    if (maanden >= volledig.maanden) continue;
    const meting = historischRendement(koersen, maandVerschuif(volledig.tot, -maanden));
    if (meting !== null) rijen.push({ label: `${maanden / 12} jaar`, ...meting });
  }
  return rijen;
}
