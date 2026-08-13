// Kleine DOM-helper: elementen bouwen zonder innerHTML (behalve voor de SVG-grafiek).
let doc = null;

export function zetDocument(d) {
  doc = d;
}

export function el(tag, props = {}, ...kinderen) {
  const knoop = doc.createElement(tag);
  for (const [naam, waarde] of Object.entries(props)) {
    if (naam === 'class') knoop.className = waarde;
    else if (naam.startsWith('on')) knoop.addEventListener(naam.slice(2), waarde);
    else if (naam === 'value') knoop.value = waarde;
    else knoop.setAttribute(naam, waarde);
  }
  for (const kind of kinderen.flat()) {
    if (kind === null) continue;
    knoop.append(kind);
  }
  return knoop;
}

export function leeg(knoop) {
  knoop.textContent = '';
}
