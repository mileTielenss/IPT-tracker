// Eén lijngrafiek als SVG-string (spec 6): grijs doelpad, dikke lijn voor de
// werkelijke reserve, stippellijn voor de projectie, markering op het doel.

const KLEUREN = { groen: '#34c77b', oranje: '#f2a33c', rood: '#f05252' };

function lijnPunten(waarden, vanIndex, totaal, maxWaarde, breedte, hoogte) {
  return waarden.map((waarde, i) => {
    const x = ((vanIndex + i) / totaal) * breedte;
    const y = hoogte - (waarde / maxWaarde) * hoogte;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function grafiekSvg(zicht, breedte = 360, hoogte = 200) {
  const { pad, totaal, doel } = zicht;
  const marge = 16;
  const grafiekHoogte = hoogte - marge;
  const top = Math.max(pad[pad.length - 1], doel,
    zicht.koersBeschikbaar ? zicht.eindwaarde : 0) * 1.08;
  const delen = [];
  const doelY = grafiekHoogte - (doel / top) * grafiekHoogte;
  delen.push(`<line x1="0" y1="${doelY.toFixed(1)}" x2="${breedte}" y2="${doelY.toFixed(1)}" ` +
    'stroke="#8b93a3" stroke-width="1" stroke-dasharray="2 3"/>');
  delen.push(`<polyline points="${lijnPunten(pad, 0, totaal, top, breedte, grafiekHoogte)}" ` +
    'fill="none" stroke="#5a6272" stroke-width="1.5"/>');
  if (zicht.koersBeschikbaar) {
    const kleur = KLEUREN[zicht.kleur];
    if (zicht.reeks.length > 1) {
      delen.push(`<polyline points="${lijnPunten(zicht.reeks, 1, totaal, top, breedte, grafiekHoogte)}" ` +
        `fill="none" stroke="${kleur}" stroke-width="3" stroke-linecap="round"/>`);
    }
    delen.push(`<polyline points="${lijnPunten(zicht.projectie, zicht.betaald, totaal, top, breedte, grafiekHoogte)}" ` +
      `fill="none" stroke="${kleur}" stroke-width="2" stroke-dasharray="5 4"/>`);
  }
  const startJaar = zicht.startJaar;
  const eindJaar = startJaar + Math.ceil(totaal / 12);
  for (let jaar = Math.ceil(startJaar / 10) * 10; jaar < eindJaar; jaar += 10) {
    const x = (((jaar - startJaar) * 12) / totaal) * breedte;
    delen.push(`<text x="${x.toFixed(1)}" y="${hoogte - 3}" class="grafiek-label" ` +
      `text-anchor="middle">${jaar}</text>`);
  }
  return `<svg viewBox="0 0 ${breedte} ${hoogte}" role="img" ` +
    `aria-label="Reserve tegenover doelpad">${delen.join('')}</svg>`;
}

// Tap op de grafiek: welk jaar en welke waarden horen bij dit punt?
export function waardeOpPunt(zicht, fractie) {
  const index = Math.min(zicht.totaal, Math.max(0, Math.round(fractie * zicht.totaal)));
  const punt = { index, jaar: zicht.startJaar + Math.floor(index / 12), pad: zicht.pad[index] };
  if (!zicht.koersBeschikbaar) return punt;
  if (index < zicht.betaald) return { ...punt, werkelijk: zicht.reeks[index] ?? 0 };
  return { ...punt, verwacht: zicht.projectie[index - zicht.betaald] };
}
