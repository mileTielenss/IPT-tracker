// De grafiek als SVG-string (spec 6, docs/ui-ontwerp.md §4). Een lijn zonder
// assen zegt niet of je op € 12.000 of € 120.000 zit; daarom y-as met
// bedragen, x-as met jaartallen, een vandaag-markering en een doellijn.
import { formatteerEuro } from './format.js';

export const KLEUREN = { groen: '#3ed8a0', oranje: '#ffb020', rood: '#ff5f6b' };

// Tekenvlak. De plot loopt van x 52 tot 328 en van y 14 tot 192; links is er
// ruimte voor de bedraglabels, onder voor de jaartallen.
export const VLAK = { x0: 52, x1: 328, y0: 14, y1: 192, basis: 208, breedte: 336, hoogte: 220 };

const KAART = '#151a22';
const GRID = '#232a35';
const AS = '#39424f';
const ZWAK = '#8892a3';
const ZACHT = '#a6b0c0';
const PAD_GRIJS = '#7a8698';
const CHIP = '#c8d0dc';
const FONT = '-apple-system, system-ui, sans-serif';

// Vier of vijf gridlijnen boven de nullijn: meer wordt op 178 px een ladder.
// Van beide tickaantallen wordt de mooiste stap gezocht ({1, 2, 2,5, 5} × 10^k)
// en daarvan wint de krapste bovengrens — zo blijft er geen halve grafiek leeg.
const MOOI = [1, 2, 2.5, 5, 10];

export function asVerdeling(ruw) {
  const doel = ruw > 0 ? ruw : 1;
  let beste = null;
  for (const ticks of [4, 5]) {
    const grof = doel / ticks;
    const macht = 10 ** Math.floor(Math.log10(grof));
    for (const factor of MOOI) {
      const stap = factor * macht;
      if (stap * ticks >= doel) {
        if (beste === null || stap * ticks < beste.top) beste = { stap, ticks, top: stap * ticks };
        break;
      }
    }
  }
  return beste;
}

// Bedragen op de as: kort genoeg om links 52 px te laten volstaan.
export function kortBedrag(waarde) {
  if (waarde === 0) return '0';
  if (waarde < 100000) return `${String(Number((waarde / 1000).toFixed(1))).replace('.', ',')}k`;
  if (waarde < 1000000) return `${Math.round(waarde / 1000)}k`;
  return `${String(Number((waarde / 1e6).toFixed(1))).replace('.', ',')} mln`;
}

// Achtenveertig jaar geeft 577 punten op 276 px. Elk derde punt (plus altijd
// het laatste) is op die schaal visueel identiek en scheelt tweederde string.
export function dun(waarden, stap) {
  const uit = [];
  for (let i = 0; i < waarden.length; i += stap) uit.push([i, waarden[i]]);
  const laatste = waarden.length - 1;
  if (uit.length === 0 || uit[uit.length - 1][0] !== laatste) uit.push([laatste, waarden[laatste]]);
  return uit;
}

function tekst(x, y, inhoud, opties = '') {
  return `<text x="${x}" y="${y}" ${opties}>${inhoud}</text>`;
}

// Welke decennia krijgen een label? Start- en eindjaar staan er altijd. Een
// jaartal van vier cijfers is op 11 px ongeveer 24 px breed, dus het midden
// van een decenniumlabel moet minstens 36 px van de rand liggen om niet in
// het start- of eindlabel te lopen. Zit het dichterbij, dan blijft de tick
// staan en verdwijnt alleen het label.
export const LABEL_MARGE = 36;

export function jaarLabels(startJaar, eindJaar, xVan) {
  const labels = [{ jaar: startJaar, x: VLAK.x0, anker: 'start' }];
  for (let jaar = Math.ceil(startJaar / 10) * 10; jaar < eindJaar; jaar += 10) {
    const x = xVan(jaar);
    if (x - VLAK.x0 >= LABEL_MARGE && VLAK.x1 - x >= LABEL_MARGE) labels.push({ jaar, x, anker: 'middle' });
  }
  labels.push({ jaar: eindJaar, x: VLAK.x1, anker: 'end' });
  return labels;
}

export function grafiekSvg(zicht, tap = null) {
  const { pad, totaal, betaald } = zicht;
  const doel = zicht.doel ?? 0;
  const heeftLijn = zicht.projectie !== undefined;
  const kleur = KLEUREN[zicht.kleur] ?? PAD_GRIJS;
  const as = asVerdeling(Math.max(pad[pad.length - 1], doel,
    heeftLijn ? zicht.eindwaarde : 0) * 1.06);
  const x = (m) => VLAK.x0 + (m / totaal) * (VLAK.x1 - VLAK.x0);
  const y = (waarde) => VLAK.y1 - (waarde / as.top) * (VLAK.y1 - VLAK.y0);
  const punten = (paren) => paren.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const startJaar = zicht.startJaar;
  const eindJaar = startJaar + Math.round(totaal / 12);
  const delen = [];

  // 1. raster: horizontaal per tick, verticaal per decennium.
  const raster = [];
  for (let i = 1; i <= as.ticks; i++) {
    const yLijn = y(as.stap * i).toFixed(1);
    raster.push(`<line x1="${VLAK.x0}" y1="${yLijn}" x2="${VLAK.x1}" y2="${yLijn}"/>`);
  }
  for (let jaar = Math.ceil(startJaar / 10) * 10; jaar < eindJaar; jaar += 10) {
    const xLijn = x((jaar - startJaar) * 12).toFixed(1);
    raster.push(`<line x1="${xLijn}" y1="${VLAK.y0}" x2="${xLijn}" y2="${VLAK.y1}"/>`);
  }
  delen.push(`<g stroke="${GRID}" stroke-width="1">${raster.join('')}</g>`);
  delen.push(`<line x1="${VLAK.x0}" y1="${VLAK.y1}" x2="${VLAK.x1}" y2="${VLAK.y1}" ` +
    `stroke="${AS}" stroke-width="1"/>`);

  // 2. as-labels. Alleen de bovenste tick draagt het euroteken.
  const labels = [tekst(46, VLAK.y1, '0', 'dy=".32em" text-anchor="end"')];
  for (let i = 1; i <= as.ticks; i++) {
    const waarde = as.stap * i;
    labels.push(tekst(46, y(waarde).toFixed(1),
      (i === as.ticks ? '€' : '') + kortBedrag(waarde), 'dy=".32em" text-anchor="end"'));
  }
  for (const label of jaarLabels(startJaar, eindJaar, (jaar) => x((jaar - startJaar) * 12))) {
    labels.push(tekst(label.x.toFixed(1), VLAK.basis, label.jaar, `text-anchor="${label.anker}"`));
  }
  delen.push(`<g fill="${ZWAK}" font-size="11" font-family="${FONT}">${labels.join('')}</g>`);

  // 3. het vlak tussen doelpad en werkelijke opbouw: voorsprong of achterstand
  // als oppervlak, met de grijze lijn als scheiding.
  const echt = zicht.reeks ?? [];
  if (echt.length > 1) {
    const heen = dun(echt, 1).map(([i, v]) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`);
    const terug = [];
    for (let m = echt.length; m >= 1; m--) terug.push(`${x(m).toFixed(1)},${y(pad[m]).toFixed(1)}`);
    delen.push(`<path d="M${heen.join(' L')} L${terug.join(' L')} Z" fill="${kleur}" ` +
      'fill-opacity=".14"/>');
  }

  // 4. doellijn met chip.
  if (doel > 0) {
    const doelY = y(doel);
    delen.push(`<line x1="${VLAK.x0}" y1="${doelY.toFixed(1)}" x2="${VLAK.x1}" ` +
      `y2="${doelY.toFixed(1)}" stroke="${ZACHT}" stroke-width="1.5" stroke-dasharray="6 4"/>`);
    // Boven de lijn, behalve als die tegen de bovenrand plakt: dan eronder.
    const chipY = doelY < 34 ? doelY + 15 : doelY - 6;
    delen.push(tekst(326, chipY.toFixed(1), `doel ${kortBedrag(doel)}`,
      `text-anchor="end" font-size="11" font-weight="700" font-family="${FONT}" ` +
      `fill="${CHIP}" stroke="${KAART}" stroke-width="3" paint-order="stroke"`));
  }

  // 5. doelpad: de neutrale referentie.
  delen.push(`<polyline points="${punten(dun(pad, 3))}" fill="none" stroke="${PAD_GRIJS}" ` +
    'stroke-width="2" stroke-linejoin="round"/>');

  // 6. vandaag: scheidt wat gemeten is van wat geprojecteerd wordt.
  const xNu = x(betaald);
  delen.push(`<line x1="${xNu.toFixed(1)}" y1="${VLAK.y0}" x2="${xNu.toFixed(1)}" ` +
    `y2="${VLAK.y1}" stroke="${ZWAK}" stroke-width="1" stroke-dasharray="2 3"/>`);
  if (heeftLijn) {
    // Voorbij driekwart van de plot zou het bijschrift buiten beeld vallen.
    const naarLinks = xNu > VLAK.x0 + 0.75 * (VLAK.x1 - VLAK.x0);
    const xTekst = (naarLinks ? xNu - 4 : xNu + 4).toFixed(1);
    const anker = naarLinks ? 'end' : 'start';
    delen.push(`<g font-family="${FONT}" fill="${ZACHT}" text-anchor="${anker}">` +
      tekst(xTekst, 26, 'nu', 'font-size="11" font-weight="700"') +
      tekst(xTekst, 40, formatteerEuro(zicht.reserve), 'font-size="11"') + '</g>');
  }

  // 7. de gemeten en geprojecteerde reeksen.
  if (heeftLijn) {
    delen.push(`<polyline points="${punten(dun(zicht.projectie, 3)
      .map(([i, v]) => [i + betaald, v]))}" fill="none" stroke="${kleur}" stroke-width="2" ` +
      'stroke-dasharray="6 5"/>');
    if (echt.length > 1) {
      delen.push(`<polyline points="${echt.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`)
        .join(' ')}" fill="none" stroke="${kleur}" stroke-width="3" stroke-linecap="round" ` +
        'stroke-linejoin="round"/>');
    }
    // Verschilstaafje: in de eerste jaren is het verschil met het doelpad één
    // pixel. Een minimumlengte van 6 px maakt het toch afleesbaar.
    const yNu = y(zicht.reserve);
    const yPad = y(zicht.padVandaag);
    const half = Math.max(3, Math.abs(yNu - yPad) / 2);
    // In de eerste jaren zit het midden bijna op de nullijn; dan zou de helft
    // van het staafje onder de as uitsteken. Schuif het binnen het plotvlak.
    const midden = Math.min(VLAK.y1 - half, Math.max(VLAK.y0 + half, (yNu + yPad) / 2));
    delen.push(`<line x1="${xNu.toFixed(1)}" y1="${(midden - half).toFixed(1)}" ` +
      `x2="${xNu.toFixed(1)}" y2="${(midden + half).toFixed(1)}" stroke="${kleur}" ` +
      'stroke-width="3" stroke-linecap="round"/>');
    delen.push(`<circle cx="${VLAK.x1}" cy="${y(zicht.eindwaarde).toFixed(1)}" r="3.5" ` +
      `fill="${kleur}" stroke="${KAART}" stroke-width="2"/>`);
    delen.push(`<circle cx="${xNu.toFixed(1)}" cy="${yNu.toFixed(1)}" r="4.5" fill="${kleur}" ` +
      `stroke="${KAART}" stroke-width="2.5"/>`);
  }

  // 8. de selectie van de laatste tap.
  if (tap !== null) {
    const xTap = x(tap.index);
    delen.push(`<line x1="${xTap.toFixed(1)}" y1="${VLAK.y0}" x2="${xTap.toFixed(1)}" ` +
      `y2="${VLAK.y1}" stroke="#f2f5fa" stroke-opacity=".55" stroke-width="1"/>`);
    delen.push(`<circle cx="${xTap.toFixed(1)}" cy="${y(tap.pad).toFixed(1)}" r="3.5" ` +
      `fill="${PAD_GRIJS}" stroke="${KAART}" stroke-width="2"/>`);
    const opLijn = tap.werkelijk ?? tap.verwacht;
    if (opLijn !== undefined) {
      delen.push(`<circle cx="${xTap.toFixed(1)}" cy="${y(opLijn).toFixed(1)}" r="4" ` +
        `fill="${kleur}" stroke="${KAART}" stroke-width="2"/>`);
    }
  }

  const titel = `Opbouw tegenover doelpad, ${startJaar}–${eindJaar}`;
  const uitleg = heeftLijn
    ? `Vandaag ${formatteerEuro(zicht.reserve)}, doelpad ${formatteerEuro(zicht.padVandaag)}, ` +
      `verwacht ${formatteerEuro(zicht.eindwaarde)} tegenover een doel van ${formatteerEuro(doel)}.`
    : 'Alleen het doelpad; er zijn nog geen cijfers over je eigen opbouw.';
  return `<svg viewBox="0 0 ${VLAK.breedte} ${VLAK.hoogte}" width="100%" role="img" ` +
    'aria-labelledby="g-titel g-uitleg" focusable="false">' +
    `<title id="g-titel">${titel}</title><desc id="g-uitleg">${uitleg}</desc>` +
    `${delen.join('')}</svg>`;
}

// Tap op de grafiek: welk jaar en welke waarden horen bij dit punt?
export function waardeOpPunt(zicht, fractie) {
  const index = Math.min(zicht.totaal, Math.max(0, Math.round(fractie * zicht.totaal)));
  const punt = { index, jaar: zicht.startJaar + Math.floor(index / 12), pad: zicht.pad[index] };
  if (zicht.projectie === undefined) return punt;
  // De werkelijke lijn wordt vanaf index 1 getekend: reeks[i] is de stand ná
  // premie i+1. Index 0 is de nulstand vóór de eerste premie.
  if (index === 0) return punt;
  if (index <= zicht.betaald) {
    // Met een bewaarde reserve maar zonder koersen is er wel een projectie
    // maar geen historische lijn; dan blijft alleen het doelpad over.
    return zicht.reeks.length === 0 ? punt : { ...punt, werkelijk: zicht.reeks[index - 1] };
  }
  return { ...punt, verwacht: zicht.projectie[index - zicht.betaald] };
}

// De grafiek in cijfers, voor wie ze niet ziet en voor wie ze wil narekenen.
export function tabelRijen(zicht) {
  const rijen = [];
  for (let m = 0; m <= zicht.totaal; m += 120) {
    const punt = waardeOpPunt(zicht, m / zicht.totaal);
    rijen.push(punt);
  }
  const laatste = waardeOpPunt(zicht, 1);
  if (rijen[rijen.length - 1].index !== laatste.index) rijen.push(laatste);
  return rijen;
}

// De legende staat als HTML onder de SVG: zo wrapt ze op smalle schermen en
// schaalt ze mee met de tekstinstelling van het toestel. De sleuteltjes zijn
// SVG met exact dezelfde streek als in de grafiek, vandaar opnieuw een string.
export function legendeHtml(zicht) {
  const kleur = KLEUREN[zicht.kleur] ?? PAD_GRIJS;
  const sleutel = (opties) => `<svg width="18" height="8" aria-hidden="true">` +
    `<line x1="1" y1="4" x2="17" y2="4" ${opties}/></svg>`;
  const items = [];
  if ((zicht.reeks ?? []).length > 1) {
    items.push([sleutel(`stroke="${kleur}" stroke-width="3" stroke-linecap="round"`), 'jouw opbouw']);
  } else if (zicht.projectie !== undefined) {
    items.push([`<svg width="18" height="8" aria-hidden="true"><circle cx="9" cy="4" r="3.5" ` +
      `fill="${kleur}"/></svg>`, 'jouw overzicht']);
  }
  if (zicht.projectie !== undefined) {
    items.push([sleutel(`stroke="${kleur}" stroke-width="2" stroke-dasharray="4 3"`), 'projectie']);
  }
  items.push([sleutel(`stroke="${PAD_GRIJS}" stroke-width="2"`), 'doelpad']);
  if ((zicht.doel ?? 0) > 0) {
    items.push([sleutel(`stroke="${ZACHT}" stroke-width="1.5" stroke-dasharray="4 3"`),
      `doel ${kortBedrag(zicht.doel)}`]);
  }
  return items.map(([teken, naam]) => `<span>${teken}${naam}</span>`).join('');
}
