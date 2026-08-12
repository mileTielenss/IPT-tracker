// Dunne promise-wrapper rond IndexedDB (spec 11.2); geen Dexie.

export const DB_NAAM = 'kbc-cashflow';
export const STORES = ['transactions', 'categories', 'rules', 'ownAccounts', 'recurringCandidates', 'settings'];

export function openDb(factory) {
  return new Promise((resolve, reject) => {
    const verzoek = factory.open(DB_NAAM, 1);
    verzoek.onupgradeneeded = () => {
      const db = verzoek.result;
      const transacties = db.createObjectStore('transactions', { keyPath: 'id' });
      transacties.createIndex('bookingDate', 'bookingDate');
      transacties.createIndex('categoryId', 'categoryId');
      transacties.createIndex('counterpartyIban', 'counterpartyIban');
      transacties.createIndex('isInternal', 'isInternal');
      transacties.createIndex('isOneOff', 'isOneOff');
      db.createObjectStore('categories', { keyPath: 'id' });
      db.createObjectStore('rules', { keyPath: 'id' }).createIndex('priority', 'priority');
      db.createObjectStore('ownAccounts', { keyPath: 'iban' });
      db.createObjectStore('recurringCandidates', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'sleutel' });
    };
    verzoek.onsuccess = () => resolve(verzoek.result);
    verzoek.onerror = () => reject(verzoek.error);
  });
}

function afwachten(verzoek) {
  return new Promise((resolve, reject) => {
    verzoek.onsuccess = () => resolve(verzoek.result);
    verzoek.onerror = () => reject(verzoek.error);
  });
}

export function alles(db, storeNaam) {
  return afwachten(db.transaction(storeNaam, 'readonly').objectStore(storeNaam).getAll());
}

export function haal(db, storeNaam, sleutel) {
  return afwachten(db.transaction(storeNaam, 'readonly').objectStore(storeNaam).get(sleutel));
}

export function bewaar(db, storeNaam, item) {
  return afwachten(db.transaction(storeNaam, 'readwrite').objectStore(storeNaam).put(item));
}

export function verwijder(db, storeNaam, sleutel) {
  return afwachten(db.transaction(storeNaam, 'readwrite').objectStore(storeNaam).delete(sleutel));
}

// Meerdere items in één transactie wegschrijven.
export function bewaarAlle(db, storeNaam, items) {
  return new Promise((resolve, reject) => {
    const transactie = db.transaction(storeNaam, 'readwrite');
    const store = transactie.objectStore(storeNaam);
    for (const item of items) store.put(item);
    transactie.oncomplete = () => resolve();
    transactie.onerror = () => reject(transactie.error);
  });
}

export function leegStore(db, storeNaam) {
  return afwachten(db.transaction(storeNaam, 'readwrite').objectStore(storeNaam).clear());
}

export async function haalInstelling(db, sleutel, standaard) {
  const rij = await haal(db, 'settings', sleutel);
  return rij === undefined ? standaard : rij.waarde;
}

export function bewaarInstelling(db, sleutel, waarde) {
  return bewaar(db, 'settings', { sleutel, waarde });
}
