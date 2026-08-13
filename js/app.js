// IPT Tracker: één scherm dat toont of de polis op koers ligt (spec 1, 7).
import { zetDocument, el, leeg } from './dom.js';
import { maakMeldingen } from './meldingen.js';
import { laadParams, bewaarParams, laadKoersen, bewaarKoersen, paramsVolledig, nettoPerMaand, doelBruto, controleVerouderd } from './opslag.js';
import { overzicht } from './reken.js';
import { haalKoersen } from './koersen.js';
import { grafiekSvg, waardeOpPunt } from './grafiek.js';
import { formatteerEuro, formatteerEuroPrecies, formatteerProcent, formatteerDatum } from './format.js';

const PERSOONLIJKE_VELDEN = [
  ['premiePerMaand', 'Maandpremie excl. taks (€)', 'getal'],
  ['doelNetto', 'Doelkapitaal netto (€)', 'getal'],
  ['startDatum', 'Startdatum premies', 'datum'],
  ['eindDatum', 'Einddatum polis', 'datum'],
  ['eindtaks', 'Eindtaxatie (%)', 'procent'],
];

const PRODUCT_VELDEN = [
  ['instapkost', 'Instapkost (%)', 'procent'],
  ['beheerskost', 'Beheerskost verzekeraar (% per jaar)', 'procent'],
  ['ter', 'TER ETF (% per jaar, zit al in de koers)', 'procent'],
  ['rendementNetto', 'Verwacht rendement netto (% per jaar)', 'procent'],
  ['rendementBruto', 'Verwacht rendement bruto (% per jaar, ter info)', 'procent'],
  ['ticker', 'ETF-ticker (Yahoo Finance)', 'tekst'],
  ['proxyUrl', 'Eigen CORS-proxy (leeg = allorigins.win)', 'tekst'],
];

const CONTROLES = [
  ['terGecontroleerd', 'TER van de ETF', 'https://www.justetf.com/en/etf-profile.html?isin=IE00BYX2JD69'],
  ['beheerskostGecontroleerd', 'Beheerskost (beheersreglement)', 'https://www.vivium.be'],
  ['eindtaksGecontroleerd', 'Eindtaxatie (aanname makelaar)', null],
];

const STATUS_ZINNEN = { groen: 'GOED', oranje: 'NET NIET', rood: 'NIET GOED' };

export async function startApp(venster) {
  const doc = venster.document;
  zetDocument(doc);
  const opslag = venster.localStorage;
  const meldingen = maakMeldingen(doc.getElementById('banners'), doc.getElementById('meldingen'));
  const scherm = doc.getElementById('scherm');
  const vandaag = () => new Date().toISOString().slice(0, 10);
  let instellingenOpen = false;
  let tapWaarde = null;

  function bewaarEnRender(params) {
    bewaarParams(opslag, params);
    tapWaarde = null;
    render();
  }

  function statusVlak(params, zicht) {
    if (zicht === null) {
      return el('section', { class: 'status-vlak onbekend' },
        el('strong', { class: 'status-woord' }, 'VUL JE GEGEVENS IN'),
        el('p', {}, 'Tik op ⚙ en vul je maandpremie, doelkapitaal en de datums van de polis in. ' +
          'Alles blijft lokaal op dit toestel.'));
    }
    if (!zicht.koersBeschikbaar) {
      return el('section', { class: 'status-vlak onbekend' },
        el('strong', { class: 'status-woord' }, 'GEEN KOERSDATA'),
        el('p', {}, 'Tik op "Koersen vernieuwen" om de ETF-koersen op te halen.'));
    }
    const teken = zicht.deltaBruto >= 0 ? '+' : '−';
    return el('section', { class: `status-vlak ${zicht.kleur}` },
      el('strong', { class: 'status-woord' }, STATUS_ZINNEN[zicht.kleur]),
      el('span', { class: 'status-delta' },
        `${teken} ${formatteerEuro(Math.abs(zicht.deltaBruto))}`),
      el('span', { class: 'status-sub' },
        `t.o.v. doel ${formatteerEuro(zicht.doel)} bruto op ${formatteerDatum(params.eindDatum)} · ` +
        `netto ${zicht.deltaNetto >= 0 ? '+' : '−'} ${formatteerEuro(Math.abs(zicht.deltaNetto))}`),
      el('p', { class: 'status-zin' },
        `Je ligt ${formatteerProcent(Math.abs(zicht.pctVsPad))} ` +
        `${zicht.pctVsPad >= 0 ? 'voor' : 'achter'} op het pad.`));
  }

  function grafiekSectie(zicht) {
    const houder = el('section', { class: 'grafiek-kaart' });
    const grafiek = el('div', {
      class: 'grafiek',
      onclick: (gebeurtenis) => {
        const breedte = grafiek.getBoundingClientRect().width;
        tapWaarde = waardeOpPunt(zicht, (gebeurtenis.offsetX ?? 0) / breedte);
        render();
      },
    });
    grafiek.innerHTML = grafiekSvg(zicht);
    houder.append(grafiek);
    if (tapWaarde !== null) {
      const extra = tapWaarde.werkelijk !== undefined
        ? ` · werkelijk ${formatteerEuro(tapWaarde.werkelijk)}`
        : (tapWaarde.verwacht !== undefined ? ` · verwacht ${formatteerEuro(tapWaarde.verwacht)}` : '');
      houder.append(el('p', { class: 'klein' },
        `${tapWaarde.jaar}: doelpad ${formatteerEuro(tapWaarde.pad)}${extra}`));
    }
    return houder;
  }

  function kerngetallen(zicht) {
    const rij = (naam, waarde, klasse = '') => el('div', { class: 'kerngetal' },
      el('span', { class: 'kern-naam' }, naam),
      el('strong', { class: klasse }, waarde));
    return el('section', { class: 'kerngetallen' },
      rij('Reserve vandaag', formatteerEuro(zicht.reserve)),
      rij('Doelpad vandaag', formatteerEuro(zicht.padVandaag)),
      rij('Verschil', formatteerEuro(zicht.verschilVandaag),
        zicht.verschilVandaag >= 0 ? 'positief' : 'negatief'));
  }

  function verversSectie(params, cache) {
    const knop = el('button', {
      class: 'primair',
      onclick: async () => {
        knop.setAttribute('disabled', 'disabled');
        try {
          const koersen = await haalKoersen((url) => venster.fetch(url), params,
            `${params.startDatum.slice(0, 7)}-01`, vandaag());
          bewaarKoersen(opslag, koersen, vandaag());
          meldingen.toonInfo('Koersen bijgewerkt.');
        } catch {
          meldingen.toonInfo('Koersen ophalen mislukt. Controleer je verbinding of stel een eigen proxy in bij ⚙.');
        }
        render();
      },
    }, 'Koersen vernieuwen');
    const delen = [knop];
    if (cache.opgehaald === null) {
      delen.push(el('span', { class: 'klein' }, 'Nog geen koersen opgehaald.'));
    } else {
      delen.push(el('span', { class: 'klein' }, `Laatste koers: ${formatteerDatum(cache.opgehaald)}`));
      if (Date.parse(vandaag()) - Date.parse(cache.opgehaald) > 35 * 86400000) {
        delen.push(el('span', { class: 'badge-verouderd' }, 'verouderd'));
      }
    }
    return el('section', { class: 'ververs' }, delen);
  }

  function veldRij(params, [sleutel, label, type]) {
    const invoer = el('input', {
      type: type === 'datum' ? 'date' : (type === 'tekst' ? 'text' : 'number'),
      step: 'any',
      value: type === 'procent'
        ? (params[sleutel] === 0 ? '' : String(params[sleutel] * 100))
        : (params[sleutel] === 0 ? '' : String(params[sleutel])),
      onchange: () => {
        const nieuw = { ...params };
        if (type === 'tekst' || type === 'datum') nieuw[sleutel] = invoer.value.trim();
        else {
          const getal = Number(invoer.value);
          nieuw[sleutel] = Number.isFinite(getal) ? (type === 'procent' ? getal / 100 : getal) : 0;
        }
        bewaarEnRender(nieuw);
      },
    });
    return el('label', { class: 'veld' }, label, invoer);
  }

  function instellingenSectie(params, zicht) {
    if (!instellingenOpen) return null;
    const sectie = el('section', { class: 'instellingen' },
      el('h2', {}, 'Jouw polis'),
      PERSOONLIJKE_VELDEN.map((veld) => veldRij(params, veld)),
      paramsVolledig(params) ? el('p', { class: 'klein' },
        `Berekend: netto belegd ${formatteerEuroPrecies(nettoPerMaand(params))} per maand · ` +
        `doel bruto ${formatteerEuro(doelBruto(params))}.`) : null,
      el('h2', {}, 'Product en koersen'),
      PRODUCT_VELDEN.map((veld) => veldRij(params, veld)),
      el('p', { class: 'klein' }, `ISIN ${params.isin} · intern fonds ${params.internFonds}. ` +
        'De TER zit al in de ETF-koers en wordt niet dubbel geteld.'));
    sectie.append(el('h2', {}, 'Handmatige controles'));
    for (const [sleutel, label, link] of CONTROLES) {
      const verouderd = controleVerouderd(params[sleutel], vandaag());
      sectie.append(el('div', { class: 'controle-rij' },
        el('span', {}, `${verouderd ? '⚠️ ' : ''}${label}`),
        el('span', { class: 'klein' }, params[sleutel] === null
          ? 'nooit gecontroleerd'
          : `gecontroleerd ${formatteerDatum(params[sleutel])}`),
        link === null ? null : el('a', { href: link, target: '_blank', rel: 'noopener' }, 'bron'),
        el('button', {
          onclick: () => bewaarEnRender({ ...params, [sleutel]: vandaag() }),
        }, 'Vandaag gecontroleerd')));
    }
    sectie.append(el('h2', {}, 'IJk met het Vivium-overzicht'));
    const ijkInvoer = el('input', { type: 'number', step: 'any', placeholder: 'Echte reserve (€)' });
    sectie.append(
      el('p', { class: 'klein' },
        'De app benadert de reserve; het Vivium-jaaroverzicht is de waarheid. Vul één keer per ' +
        'jaar de echte reserve in en de simulatie wordt herschaald (foutmarge < 2%).'),
      el('div', { class: 'controle-rij' },
        ijkInvoer,
        el('button', {
          onclick: () => {
            const echte = Number(ijkInvoer.value);
            const ruweReserve = zicht !== null && zicht.koersBeschikbaar
              ? zicht.reserve / params.ijkFactor : 0;
            if (!Number.isFinite(echte) || echte <= 0 || ruweReserve <= 0) {
              meldingen.toonInfo('IJken kan pas met een geldig bedrag én opgehaalde koersen.');
              return;
            }
            bewaarEnRender({ ...params, ijkFactor: echte / ruweReserve, ijkDatum: vandaag() });
          },
        }, 'IJk reserve')),
      params.ijkDatum === null ? null : el('p', { class: 'klein' },
        `Geijkt op ${formatteerDatum(params.ijkDatum)} (factor ${params.ijkFactor.toFixed(3)}). `,
        el('button', {
          class: 'link-knop',
          onclick: () => bewaarEnRender({ ...params, ijkFactor: 1, ijkDatum: null }),
        }, 'Reset')));
    return sectie;
  }

  function render() {
    const params = laadParams(opslag);
    const cache = laadKoersen(opslag);
    const volledig = paramsVolledig(params);
    const zicht = volledig ? overzicht(params, cache.koersen, vandaag()) : null;
    leeg(scherm);
    scherm.append(
      el('header', { class: 'kop' },
        el('strong', {}, 'IPT Tracker'),
        el('button', {
          class: 'tandwiel',
          'aria-label': 'Instellingen',
          onclick: () => {
            instellingenOpen = !instellingenOpen;
            render();
          },
        }, '⚙')),
      statusVlak(params, zicht));
    if (zicht !== null && zicht.koersBeschikbaar) {
      scherm.append(grafiekSectie(zicht), kerngetallen(zicht));
      if (zicht.gemist > 0) {
        scherm.append(el('p', { class: 'klein' },
          `${zicht.gemist} maanden zonder koers; de laatst bekende koers werd gebruikt.`));
      }
    }
    if (volledig) scherm.append(verversSectie(params, cache));
    scherm.append(instellingenSectie(params, zicht));
    if (!volledig && !instellingenOpen) {
      instellingenOpen = true;
      render();
    }
  }

  // Service worker, persistente opslag en de updatebalk (nooit ongevraagd herladen).
  if (venster.navigator.storage) await venster.navigator.storage.persist();
  if (venster.navigator.serviceWorker) venster.navigator.serviceWorker.register('sw.js');
  async function controleerUpdate() {
    let tekst = null;
    try {
      const antwoord = await venster.fetch(`sw.js?nu=${Date.now()}`, { cache: 'no-store' });
      tekst = await antwoord.text();
    } catch {
      return; // offline: geen updatecheck mogelijk
    }
    const m = /VERSIE = '([^']+)'/.exec(tekst);
    if (m === null) return;
    const beschikbaar = m[1];
    const actief = opslag.getItem('actieveVersie');
    if (actief === null) {
      opslag.setItem('actieveVersie', beschikbaar);
      return;
    }
    if (actief === beschikbaar) return;
    meldingen.toonBanner('update', el('div', { class: 'banner update' },
      el('span', {}, 'Nieuwe versie beschikbaar. '),
      el('button', {
        class: 'primair',
        onclick: async () => {
          opslag.setItem('actieveVersie', beschikbaar);
          const registraties = await venster.navigator.serviceWorker.getRegistrations();
          for (const registratie of registraties) await registratie.unregister();
          for (const naam of await venster.caches.keys()) await venster.caches.delete(naam);
          venster.location.reload();
        },
      }, 'Nu bijwerken')));
  }
  await controleerUpdate();
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') controleerUpdate();
  });
  render();
  return { render };
}
