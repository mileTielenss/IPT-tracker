// Minimale DOM-, window- en localStorage-implementatie voor tests:
// precies wat js/dom.js en de app gebruiken.

export class FakeElement {
  constructor(doc, tag) {
    this.doc = doc;
    this.tagName = tag;
    this.children = [];
    this.parentNode = null;
    this.attributen = new Map();
    this.luisteraars = new Map();
    this.className = '';
    this.value = '';
    this._html = '';
  }
  get textContent() {
    return this.children.map((kind) => (typeof kind === 'string' ? kind : kind.textContent)).join('');
  }
  // append() neemt volgens de DOM-spec alleen knopen en strings; al het andere
  // wordt tot string gemaakt en als tekstknoop ingevoegd. Dat wordt hier
  // nagebootst, zodat een array die per ongeluk aan append() wordt gegeven
  // zichtbaar wordt als rommeltekst in plaats van stilletjes te werken.
  static naarKnoop(item) {
    return (typeof item === 'string' || item instanceof FakeElement) ? item : String(item);
  }
  set textContent(waarde) {
    this.children = [];
    if (waarde !== '') this.children.push(String(waarde));
  }
  get innerHTML() {
    return this._html;
  }
  set innerHTML(waarde) {
    this.children = [];
    this._html = waarde;
  }
  append(...items) {
    for (const rauw of items) {
      const item = FakeElement.naarKnoop(rauw);
      if (typeof item === 'string') {
        this.children.push(item);
      } else {
        item.parentNode = this;
        this.children.push(item);
      }
    }
  }
  remove() {
    if (this.parentNode !== null) {
      const index = this.parentNode.children.indexOf(this);
      if (index !== -1) this.parentNode.children.splice(index, 1);
      this.parentNode = null;
    }
  }
  setAttribute(naam, waarde) {
    this.attributen.set(naam, String(waarde));
  }
  getAttribute(naam) {
    return this.attributen.get(naam) ?? null;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 360, height: 200 };
  }
  addEventListener(type, fn) {
    if (!this.luisteraars.has(type)) this.luisteraars.set(type, []);
    this.luisteraars.get(type).push(fn);
  }
  async dispatch(type, gebeurtenis = {}) {
    for (const fn of this.luisteraars.get(type) ?? []) await fn(gebeurtenis);
  }
  click() {
    return this.dispatch('click');
  }
}

export function zoekAlle(wortel, test, resultaat = []) {
  for (const kind of wortel.children) {
    if (typeof kind === 'string') continue;
    if (test(kind)) resultaat.push(kind);
    zoekAlle(kind, test, resultaat);
  }
  return resultaat;
}

export function zoekKnop(wortel, tekst) {
  return zoekAlle(wortel, (e) => e.tagName === 'button' && e.textContent.includes(tekst))[0];
}

export function zoekTag(wortel, tag) {
  return zoekAlle(wortel, (e) => e.tagName === tag);
}

export function maakFakeDocument() {
  const perId = new Map();
  const luisteraars = new Map();
  const doc = {
    visibilityState: 'visible',
    createElement(tag) {
      return new FakeElement(doc, tag);
    },
    getElementById(id) {
      return perId.get(id);
    },
    addEventListener(type, fn) {
      if (!luisteraars.has(type)) luisteraars.set(type, []);
      luisteraars.get(type).push(fn);
    },
    async dispatch(type, gebeurtenis = {}) {
      for (const fn of luisteraars.get(type) ?? []) await fn(gebeurtenis);
    },
  };
  doc.body = new FakeElement(doc, 'body');
  for (const id of ['banners', 'scherm', 'meldingen']) {
    const element = new FakeElement(doc, 'div');
    element.setAttribute('id', id);
    doc.body.append(element);
    perId.set(id, element);
  }
  return doc;
}

export function maakFakeOpslag() {
  const data = new Map();
  return {
    getItem: (sleutel) => (data.has(sleutel) ? data.get(sleutel) : null),
    setItem: (sleutel, waarde) => data.set(sleutel, String(waarde)),
    removeItem: (sleutel) => data.delete(sleutel),
  };
}

export function maakFakeVenster(opties = {}) {
  const doc = maakFakeDocument();
  const venster = {
    document: doc,
    localStorage: maakFakeOpslag(),
    herladen: 0,
    swBijgewerkt: false,
    cacheVerwijderd: [],
    fetchLog: [],
    // standaardantwoorden; per test aanpasbaar
    fetchTekst: opties.fetchTekst ?? "const VERSIE = '2.0.0';",
    fetchJson: opties.fetchJson ?? null,
    fetchFout: opties.fetchFout ?? false,
    fetchHandler: opties.fetchHandler ?? null,
    location: {
      pathname: '/',
      hash: opties.hash ?? '',
      reload() {
        venster.herladen++;
      },
    },
    // Geschiedenisstapel met popstate, zodat de terugknop/terugveeg getest kan
    // worden: het instellingenpaneel is een eigen pagina.
    geschiedenis: [''],
    history: {
      pushState(_staat, _titel, url) {
        venster.geschiedenis.push(url);
        venster.location.hash = url.startsWith('#') ? url : '';
      },
      replaceState(_staat, _titel, url) {
        venster.geschiedenis[venster.geschiedenis.length - 1] = url;
        venster.location.hash = url.startsWith('#') ? url : '';
      },
      back() {
        venster.geschiedenis.pop();
        const vorige = venster.geschiedenis[venster.geschiedenis.length - 1];
        venster.location.hash = vorige.startsWith('#') ? vorige : '';
        return venster.dispatch('popstate');
      },
    },
    vensterLuisteraars: new Map(),
    addEventListener(type, fn) {
      if (!venster.vensterLuisteraars.has(type)) venster.vensterLuisteraars.set(type, []);
      venster.vensterLuisteraars.get(type).push(fn);
    },
    async dispatch(type, gebeurtenis = {}) {
      for (const fn of venster.vensterLuisteraars.get(type) ?? []) await fn(gebeurtenis);
    },
    async fetch(url) {
      venster.fetchLog.push(url);
      if (venster.fetchHandler !== null) return venster.fetchHandler(url);
      if (venster.fetchFout) throw new Error('offline');
      return {
        ok: true,
        text: async () => venster.fetchTekst,
        json: async () => venster.fetchJson,
      };
    },
    navigator: {
      storage: { persist: async () => true },
      serviceWorker: {
        luisteraars: new Map(),
        addEventListener(type, fn) {
          const lijst = venster.navigator.serviceWorker.luisteraars;
          if (!lijst.has(type)) lijst.set(type, []);
          lijst.get(type).push(fn);
        },
        async register(url) {
          venster.swGeregistreerd = url;
          return {
            async update() {
              venster.swBijgewerkt = true;
              // De nieuwe worker neemt de pagina over, tenzij de test dat
              // uitzet om de tijdslimiet te beproeven.
              if (!opties.zonderOvername) {
                for (const fn of venster.navigator.serviceWorker.luisteraars.get('controllerchange') ?? []) fn();
              }
            },
          };
        },
      },
    },
    caches: {
      keys: async () => ['ipt-tracker-1.9.9'],
      delete: async (naam) => {
        venster.cacheVerwijderd.push(naam);
      },
    },
  };
  if (opties.zonderStorage) delete venster.navigator.storage;
  if (opties.zonderServiceWorker) delete venster.navigator.serviceWorker;
  return venster;
}

export function spoel(rondes = 6) {
  let belofte = Promise.resolve();
  for (let i = 0; i < rondes; i++) {
    belofte = belofte.then(() => new Promise((klaar) => setTimeout(klaar, 0)));
  }
  return belofte;
}
