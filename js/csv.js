// Eigen CSV-parser voor puntkomma-gescheiden KBC-exports.
// Quoted velden volgens RFC 4180: dubbele aanhalingstekens, "" als escape,
// puntkomma's en regelovergangen binnen quotes blijven deel van het veld.

export function parseCsv(tekst) {
  const rijen = [];
  let rij = [];
  let veld = '';
  let inQuotes = false;
  for (let i = 0; i < tekst.length; i++) {
    const teken = tekst[i];
    if (inQuotes) {
      if (teken === '"') {
        if (tekst[i + 1] === '"') {
          veld += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        veld += teken;
      }
    } else if (teken === '"') {
      inQuotes = true;
    } else if (teken === ';') {
      rij.push(veld);
      veld = '';
    } else if (teken === '\n' || teken === '\r') {
      if (teken === '\r' && tekst[i + 1] === '\n') i++;
      rij.push(veld);
      rijen.push(rij);
      rij = [];
      veld = '';
    } else {
      veld += teken;
    }
  }
  if (veld !== '' || rij.length > 0) {
    rij.push(veld);
    rijen.push(rij);
  }
  // Volledig lege regels (bv. een afsluitende regelovergang) tellen niet mee.
  return rijen.filter((r) => r.length > 1 || r[0] !== '');
}

// Probeer UTF-8; bij decodeerfouten terugvallen op Windows-1252.
export function decodeerCsv(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}
