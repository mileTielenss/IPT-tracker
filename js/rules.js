// Regelsysteem voor categorisatie (spec 6).

export const REGEL_VELDEN = ['counterpartyIban', 'counterpartyName', 'merchant', 'description'];
export const MATCH_TYPES = ['contains', 'startsWith', 'equals'];

// Menselijke labels: nergens in de interface ruwe veldnamen of Engels jargon.
export const VELD_NAMEN = {
  counterpartyIban: 'Tegenpartij-IBAN',
  counterpartyName: 'Tegenpartij-naam',
  merchant: 'Handelaar',
  description: 'Omschrijving',
};
export const MATCH_TYPE_NAMEN = {
  contains: 'bevat',
  startsWith: 'begint met',
  equals: 'is exact',
};

export function regelOmschrijving(regel) {
  return `${VELD_NAMEN[regel.field]} ${MATCH_TYPE_NAMEN[regel.matchType]} "${regel.value}"`;
}

export function regelMatcht(regel, tx) {
  const waarde = tx[regel.field].toLowerCase();
  const zoek = regel.value.toLowerCase();
  if (regel.matchType === 'equals') return waarde === zoek;
  if (regel.matchType === 'startsWith') return waarde.startsWith(zoek);
  return waarde.includes(zoek);
}

export function sorteerRegels(regels) {
  return [...regels].sort((a, b) => a.priority - b.priority);
}

// Oplopende priority, eerste match wint; alleen actieve regels tellen.
export function vindRegel(regels, tx) {
  for (const regel of sorteerRegels(regels)) {
    if (regel.active && regelMatcht(regel, tx)) return regel;
  }
  return null;
}

// Past de actuele regelset toe op transacties zonder handmatige categorie.
// Geeft de gewijzigde kopieën terug plus het aantal categoriewissels.
export function herclassificeer(regels, transacties) {
  const bijgewerkt = [];
  let veranderd = 0;
  for (const tx of transacties) {
    if (tx.manualCategory) continue;
    const regel = vindRegel(regels, tx);
    const categoryId = regel === null ? null : regel.categoryId;
    const ruleId = regel === null ? null : regel.id;
    let costClass = tx.costClass;
    if (!tx.manualClass) costClass = regel !== null && regel.costClass ? regel.costClass : null;
    if (tx.categoryId !== categoryId || tx.ruleId !== ruleId || tx.costClass !== costClass) {
      if (tx.categoryId !== categoryId) veranderd++;
      bijgewerkt.push({ ...tx, categoryId, ruleId, costClass });
    }
  }
  return { bijgewerkt, veranderd };
}

// hitCount = aantal transacties dat op dit moment door de regel gecategoriseerd is.
export function telHits(regels, transacties) {
  const telling = new Map(regels.map((r) => [r.id, 0]));
  for (const tx of transacties) {
    if (tx.ruleId !== null && telling.has(tx.ruleId)) {
      telling.set(tx.ruleId, telling.get(tx.ruleId) + 1);
    }
  }
  return regels.map((r) => ({ ...r, hitCount: telling.get(r.id) }));
}

// Nieuwe regel invoegen: standaard achteraan, maar IBAN-regels vóór tekstregels
// (spec 6.1). Alle prioriteiten worden hernummerd vanaf 1.
export function voegRegelToe(regels, nieuweRegel) {
  const gesorteerd = sorteerRegels(regels);
  if (nieuweRegel.field === 'counterpartyIban') {
    const eersteTekst = gesorteerd.findIndex((r) => r.field !== 'counterpartyIban');
    if (eersteTekst === -1) gesorteerd.push(nieuweRegel);
    else gesorteerd.splice(eersteTekst, 0, nieuweRegel);
  } else {
    gesorteerd.push(nieuweRegel);
  }
  return gesorteerd.map((r, i) => ({ ...r, priority: i + 1 }));
}

export function verplaatsRegel(regels, ruleId, richting) {
  const gesorteerd = sorteerRegels(regels);
  const index = gesorteerd.findIndex((r) => r.id === ruleId);
  const doel = index + richting;
  if (doel < 0 || doel >= gesorteerd.length) return gesorteerd;
  const [regel] = gesorteerd.splice(index, 1);
  gesorteerd.splice(doel, 0, regel);
  return gesorteerd.map((r, i) => ({ ...r, priority: i + 1 }));
}

// Beste matchveld voor een nieuwe regel vanuit een transactie (spec 6.3).
export function voorstelRegelVeld(tx) {
  if (tx.counterpartyIban !== '') return { field: 'counterpartyIban', value: tx.counterpartyIban };
  if (tx.merchant !== '') return { field: 'merchant', value: tx.merchant };
  if (tx.counterpartyName !== '') return { field: 'counterpartyName', value: tx.counterpartyName };
  return { field: 'description', value: tx.description.slice(0, 40).trim() };
}
