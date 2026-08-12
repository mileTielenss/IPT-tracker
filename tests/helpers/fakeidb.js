// Minimale IndexedDB-implementatie voor tests: precies wat js/db.js gebruikt.

class FakeVerzoek {
  constructor() {
    this.onsuccess = null;
    this.onerror = null;
    this.onupgradeneeded = null;
    this.result = undefined;
    this.error = null;
  }
  _slaag(resultaat) {
    this.result = resultaat;
    queueMicrotask(() => {
      if (this.onsuccess !== null) this.onsuccess();
    });
  }
  _faal(fout) {
    this.error = fout;
    queueMicrotask(() => {
      if (this.onerror !== null) this.onerror();
    });
  }
}

class FakeStore {
  constructor(db, naam, transactie) {
    this.db = db;
    this.naam = naam;
    this.transactie = transactie;
  }
  createIndex() {
    return {};
  }
  _verzoek(actie) {
    const verzoek = new FakeVerzoek();
    if (this.db.faalModus) {
      const fout = new Error('opslag mislukt');
      if (this.transactie !== null) this.transactie.error = fout;
      verzoek._faal(fout);
    } else {
      verzoek._slaag(actie());
    }
    return verzoek;
  }
  _data() {
    return this.db.data.get(this.naam);
  }
  put(item) {
    return this._verzoek(() => {
      this._data().set(item[this.db.keyPaths.get(this.naam)], structuredClone(item));
      return item[this.db.keyPaths.get(this.naam)];
    });
  }
  get(sleutel) {
    return this._verzoek(() => structuredClone(this._data().get(sleutel)));
  }
  getAll() {
    return this._verzoek(() => [...this._data().values()].map((item) => structuredClone(item)));
  }
  delete(sleutel) {
    return this._verzoek(() => {
      this._data().delete(sleutel);
    });
  }
  clear() {
    return this._verzoek(() => {
      this._data().clear();
    });
  }
}

class FakeTransactie {
  constructor(db) {
    this.db = db;
    this.oncomplete = null;
    this.onerror = null;
    this.error = null;
    setTimeout(() => {
      if (this.error !== null) {
        if (this.onerror !== null) this.onerror();
      } else if (this.oncomplete !== null) {
        this.oncomplete();
      }
    }, 0);
  }
  objectStore(naam) {
    return new FakeStore(this.db, naam, this);
  }
}

class FakeDb {
  constructor() {
    this.data = new Map();
    this.keyPaths = new Map();
    this.faalModus = false;
  }
  createObjectStore(naam, { keyPath }) {
    this.data.set(naam, new Map());
    this.keyPaths.set(naam, keyPath);
    return new FakeStore(this, naam, null);
  }
  transaction(naam) {
    return new FakeTransactie(this);
  }
}

export function maakFakeIndexedDB({ faalOpen = false } = {}) {
  // Eén database per factory, net als echte IndexedDB: een tweede open()
  // levert dezelfde opslag op en slaat de upgrade over.
  let db = null;
  return {
    open() {
      const verzoek = new FakeVerzoek();
      if (faalOpen) {
        verzoek._faal(new Error('IndexedDB niet beschikbaar'));
      } else {
        const eersteKeer = db === null;
        if (eersteKeer) db = new FakeDb();
        verzoek.result = db;
        queueMicrotask(() => {
          if (eersteKeer) verzoek.onupgradeneeded();
          verzoek.onsuccess();
        });
      }
      return verzoek;
    },
  };
}
