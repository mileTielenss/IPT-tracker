// Zelf getekende gestapelde balkgrafiek als SVG (spec 8.2, geen bibliotheek).
import { KLASSEN, KLASSE_KLEUREN } from './categories.js';

export function gestapeldeBalken(buckets, breedte = 360, hoogte = 180) {
  const marge = 18;
  const grafiekHoogte = hoogte - marge;
  const maxTotaal = Math.max(1, ...buckets.map((b) => b.vast + b.variabel + b.discretionair));
  const stap = breedte / buckets.length;
  const balkBreedte = Math.min(48, stap * 0.7);
  const delen = [];
  buckets.forEach((bucket, i) => {
    const x = i * stap + (stap - balkBreedte) / 2;
    let y = grafiekHoogte;
    for (const klasse of KLASSEN) {
      const waarde = bucket[klasse];
      if (waarde === 0) continue;
      const h = (waarde / maxTotaal) * (grafiekHoogte - 8);
      y -= h;
      delen.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${balkBreedte.toFixed(1)}" ` +
        `height="${h.toFixed(1)}" fill="${KLASSE_KLEUREN[klasse]}"><title>${klasse}</title></rect>`);
    }
    delen.push(`<text x="${(i * stap + stap / 2).toFixed(1)}" y="${hoogte - 4}" ` +
      `text-anchor="middle" class="grafiek-label">${bucket.label}</text>`);
  });
  return `<svg viewBox="0 0 ${breedte} ${hoogte}" role="img" aria-label="Uitgaven per kostenklasse">` +
    `${delen.join('')}</svg>`;
}
