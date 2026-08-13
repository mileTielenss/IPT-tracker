// IPT Tracker: één scherm dat toont of de polis op koers ligt (spec 1, 7).
import { zetDocument, el, leeg } from './dom.js';
import { maakMeldingen } from './meldingen.js';
import { laadParams, bewaarParams, laadKoersen, bewaarKoersen, paramsVolledig, nettoPerMaand, doelBruto, nettoRendement, gebruiktGemeten, controleVerouderd } from './opslag.js';
import { overzicht } from './reken.js';
import { haalKoersen } from './koersen.js';
import { grafiekSvg, waardeOpPunt } from './grafiek.js';
import { haalHistoriek, historischRendement, MINIMUM_MAANDEN } from './afleiden.js';
import { formatteerEuro, formatteerEuroPrecies, formatteerProcent, formatteerDatum } from './format.js';

// Wat je van je polis moet overtypen: vier velden, meer niet.
const PERSOONLIJKE_VELDEN = [
  ['premiePerMaand', 'Maandpremie hoofdwaarborg excl. taks (€)', 'getal'],
  ['doelNetto', 'Doelkapitaal netto (€)', 'getal'],
  ['startDatum', 'Startdatum premies', 'datum'],
  ['eindDatum', 'Einddatum polis', 'datum'],
];

// De eindtaxatie bepaalt het brutodoel; het rendement heeft een eigen blok
// omdat daar een keuze tussen meting en aanname bij hoort.
const AANNAME_VELDEN = [
  ['eindtaks', 'Eindtaxatie (%)', 'procent'],
];

// Zelden aan te raken; staan achter "Geavanceerd".
const PRODUCT_VELDEN = [
  ['instapkost', 'Instapkost (% per premie)', 'procent'],
  ['beheerskost', 'Beheerskost verzekeraar (% per jaar)', 'procent'],
  ['ter', 'TER van de ETF (% per jaar)', 'procent'],
  ['ticker', 'ETF-ticker (Yahoo Finance)', 'tekst'],
  ['isin', 'ETF ISIN', 'tekst'],
  ['internFonds', 'Intern fonds', 'tekst'],
  ['proxyUrl', 'Eigen CORS-proxy (leeg = publieke proxy)', 'tekst'],
];

// De bronlink voor de TER volgt de ingevulde ISIN.
function controles(params) {
  return [
    ['terGecontroleerd', 'TER van de ETF',
      `https://www.justetf.com/en/etf-profile.html?isin=${encodeURIComponent(params.isin)}`],
    ['beheerskostGecontroleerd', 'Beheerskost (beheersreglement)', 'https://www.vivium.be'],
    ['eindtaksGecontroleerd', 'Eindtaxatie (fiscale aanname)', null],
  ];
}

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
    if (zicht.bron === undefined) {
      return el('section', { class: 'status-vlak onbekend' },
        el('strong', { class: 'status-woord' }, 'NOG GEEN CIJFERS'),
        el('p', {}, 'Tik op "Koersen vernieuwen" om de ETF-koersen op te halen. ' +
          'Lukt dat niet, vul dan bij ⚙ je reserve van het laatste jaaroverzicht in — ' +
          'daarmee rekent de app ook zonder koersen.'));
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
      // Punt 0 is de nulstand vóór de eerste premie: daar hoort geen
      // gerealiseerde of verwachte waarde bij, alleen het doelpad.
      let extra = '';
      if (tapWaarde.werkelijk !== undefined) {
        extra = ` · werkelijk ${formatteerEuro(tapWaarde.werkelijk)}`;
      } else if (tapWaarde.verwacht !== undefined) {
        extra = ` · verwacht ${formatteerEuro(tapWaarde.verwacht)}`;
      }
      houder.append(el('p', { class: 'klein' },
        `${tapWaarde.jaar}: doelpad ${formatteerEuro(tapWaarde.pad)}${extra}`));
    }
    return houder;
  }

  function kerngetallen(params, zicht) {
    const rij = (naam, waarde, klasse = '') => el('div', { class: 'kerngetal' },
      el('span', { class: 'kern-naam' }, naam),
      el('strong', { class: klasse }, waarde));
    const sectie = el('section', { class: 'kerngetallen' },
      rij(zicht.bron === 'overzicht' ? 'Reserve (jouw overzicht)' : 'Reserve vandaag',
        formatteerEuro(zicht.reserve)),
      rij('Doelpad vandaag', formatteerEuro(zicht.padVandaag)),
      rij('Verschil', formatteerEuro(zicht.verschilVandaag),
        zicht.verschilVandaag >= 0 ? 'positief' : 'negatief'));
    // Het ijkpunt blijft zichtbaar als referentie, ook als de simulatie draait.
    if (params.echteReserve > 0) {
      sectie.append(rij(`Jouw overzicht (${formatteerDatum(params.echteReserveDatum)})`,
        formatteerEuro(params.echteReserve), 'klein'));
    }
    // De kernvraag in cijfers: wat moet het rendement zijn, en wat is het?
    if (zicht.vereist !== null) {
      sectie.append(rij('Nodig vanaf nu', `${formatteerProcent(zicht.vereist)} netto per jaar`,
        'tabel-cijfer'));
    }
    if (params.gemetenMaanden > 0) {
      sectie.append(rij(`Tracker deed (${Math.round(params.gemetenMaanden / 12)} jaar)`,
        `${formatteerProcent(params.gemetenRendement)} bruto per jaar`, 'tabel-cijfer'));
    }
    return sectie;
  }

  function verversSectie(params, cache) {
    const knop = el('button', {
      class: 'primair',
      onclick: async () => {
        knop.setAttribute('disabled', 'disabled');
        // Meteen ook de volledige historiek meten: het rendement dat de
        // tracker écht haalde is een feit, de aanname is dat niet.
        const historiek = await haalHistoriek((url) => venster.fetch(url), params);
        const gemeten = historiek === null ? null : historischRendement(historiek);
        if (gemeten !== null) {
          bewaarParams(opslag, {
            ...laadParams(opslag),
            gemetenRendement: gemeten.rendement,
            gemetenMaanden: gemeten.maanden,
            gemetenTot: gemeten.tot,
          });
        }
        try {
          // haalKoersen gooit al bij een leeg antwoord, dus hier is niets meer
          // te controleren; nieuwe koersen gaan over de bestaande heen zodat
          // één mislukte ophaling nooit historiek vernietigt.
          const verse = await haalKoersen((url) => venster.fetch(url), params,
            `${params.startDatum.slice(0, 7)}-01`, vandaag());
          bewaarKoersen(opslag, { ...cache.koersen, ...verse }, vandaag());
          meldingen.toonInfo('Koersen bijgewerkt.');
        } catch {
          meldingen.toonInfo('Koersen ophalen mislukt. De bestaande koersen blijven staan. Controleer je verbinding of stel een eigen proxy in bij ⚙.');
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
      // Percentages worden als fractie bewaard. 0,07 × 100 geeft in
      // zwevendekommarekenkunde 7.000000000000001; afronden op zes decimalen
      // houdt het veld leesbaar zonder echte precisie te verliezen.
      value: type === 'procent'
        ? (params[sleutel] === 0 ? '' : String(Number((params[sleutel] * 100).toFixed(6))))
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
    const sectie = el('section', { class: 'instellingen' },
      el('h2', {}, 'Jouw polis'),
      PERSOONLIJKE_VELDEN.map((veld) => veldRij(params, veld)),
      paramsVolledig(params) ? el('p', { class: 'klein' },
        `Netto belegd ${formatteerEuroPrecies(nettoPerMaand(params))} per maand · ` +
        `doel bruto ${formatteerEuro(doelBruto(params))} (nodig om na eindtaxatie ` +
        `${formatteerEuro(params.doelNetto)} netto over te houden).`) : null,
      el('h2', {}, 'Eindtaxatie'),
      ...AANNAME_VELDEN.map((veld) => veldRij(params, veld)));
    // Het rendement is meetbaar uit de koershistoriek; de TER niet — Yahoo
    // geeft die voor Europese ETF's niet vrij, dus daarvoor een bronlink.
    // Eén blok waarin zichtbaar is welk cijfer de app écht gebruikt.
    const gemetenActief = gebruiktGemeten(params);
    const rendementBlok = el('div', { class: 'keuze-lijst' });
    if (params.gemetenMaanden > 0) {
      rendementBlok.append(el('div', { class: `keuze ${gemetenActief ? 'actief' : ''}`.trim() },
        el('div', { class: 'keuze-kop' },
          el('strong', {}, `Gemeten: ${formatteerProcent(params.gemetenRendement)} bruto per jaar`),
          gemetenActief ? el('span', { class: 'badge-actief' }, 'in gebruik') : null),
        el('span', { class: 'klein' },
          `Werkelijk rendement van de tracker over ${Math.round(params.gemetenMaanden / 12)} ` +
          `jaar, tot ${params.gemetenTot}. Een korte, gunstige beursperiode is geen ` +
          'belofte voor veertig jaar.'),
        gemetenActief ? null : el('button', {
          onclick: () => bewaarEnRender({ ...params, gebruikGemeten: true }),
        }, 'Reken hiermee')));
    }
    const aannameInvoer = veldRij(params, ['rendementBruto', 'Verwacht rendement van de index (% per jaar)', 'procent']);
    rendementBlok.append(el('div', { class: `keuze ${gemetenActief ? '' : 'actief'}`.trim() },
      el('div', { class: 'keuze-kop' },
        el('strong', {}, 'Mijn eigen aanname'),
        gemetenActief ? null : el('span', { class: 'badge-actief' }, 'in gebruik')),
      aannameInvoer,
      params.gemetenMaanden === 0
        ? el('span', { class: 'klein' },
          'Nog niets gemeten. Ververs de koersen of meet hieronder; dan rekent de app ' +
          'met het werkelijke rendement van de tracker in plaats van met deze schatting.')
        : (gemetenActief ? el('button', {
          onclick: () => bewaarEnRender({ ...params, gebruikGemeten: false }),
        }, 'Reken hiermee') : null)));
    sectie.append(
      el('h2', {}, 'Rendement'),
      rendementBlok,
      el('p', { class: 'klein' },
        `De app rekent met ${formatteerProcent(nettoRendement(params))} netto per jaar: ` +
        `${formatteerProcent(gemetenActief ? params.gemetenRendement : params.rendementBruto)} ` +
        (gemetenActief ? 'gemeten' : 'aanname') + ', min ' +
        (gemetenActief ? '' : `${formatteerProcent(params.ter)} fondskosten en `) +
        `${formatteerProcent(params.beheerskost)} beheerskost` +
        (gemetenActief ? ' (de fondskosten zitten al in de gemeten koersen)' : '') + '.'));
    const meetKnop = el('button', {
      onclick: async () => {
        meetKnop.setAttribute('disabled', 'disabled');
        const historiek = await haalHistoriek((url) => venster.fetch(url), params);
        const gemeten = historiek === null ? null : historischRendement(historiek);
        if (gemeten === null) {
          meldingen.toonInfo('Geen bruikbare historiek gevonden voor deze ticker. ' +
            'Controleer de ticker of probeer het later opnieuw.');
          render();
          return;
        }
        meldingen.toonInfo(`Gemeten: ${formatteerProcent(gemeten.rendement)} bruto per jaar over ` +
          `${Math.round(gemeten.maanden / 12)} jaar.`);
        bewaarEnRender({
          ...params,
          gemetenRendement: gemeten.rendement,
          gemetenMaanden: gemeten.maanden,
          gemetenTot: gemeten.tot,
        });
      },
    }, 'Meet rendement uit de koershistoriek');
    sectie.append(
      el('div', { class: 'controle-rij' }, meetKnop),
      el('p', { class: 'klein' },
        `Meet het werkelijke rendement van deze ETF over haar volledige historiek ` +
        `(minstens ${MINIMUM_MAANDEN / 12} jaar nodig) en vult dat in als aanname. ` +
        'Let op: rendement uit het verleden is geen belofte voor de toekomst.'),
      el('h2', {}, 'Geavanceerd'),
      // append() neemt alleen knopen en strings; een array zou als één
      // tekstknoop belanden en de velden onzichtbaar maken.
      ...PRODUCT_VELDEN.map((veld) => veldRij(params, veld)),
      el('p', { class: 'klein' },
        'De instapkost en de beheerskost staan in je polis en het beheersreglement; de TER ' +
        'vind je op justETF (link hieronder). De TER telt alleen mee in de verwachting ' +
        'hierboven — in de historische simulatie niet, want die zit al in de opgehaalde koersen.'));
    sectie.append(el('h2', {}, 'Handmatige controles'));
    for (const [sleutel, label, link] of controles(params)) {
      const verouderd = controleVerouderd(params[sleutel], vandaag());
      sectie.append(el('div', { class: 'controle-rij' },
        el('div', { class: 'controle-tekst' },
          el('span', { class: verouderd ? 'controle-naam verouderd' : 'controle-naam' },
            `${verouderd ? '⚠️ ' : ''}${label}`),
          el('span', { class: 'klein' }, params[sleutel] === null
            ? 'nooit gecontroleerd'
            : `gecontroleerd op ${formatteerDatum(params[sleutel])}`)),
        el('div', { class: 'controle-acties' },
          link === null ? null : el('a', { href: link, target: '_blank', rel: 'noopener' }, 'Bron'),
          el('button', {
            onclick: () => bewaarEnRender({ ...params, [sleutel]: vandaag() }),
          }, 'Nagekeken'))));
    }
    sectie.append(el('h2', {}, 'Mijn reserve volgens het overzicht'));
    const ijkInvoer = el('input', { type: 'number', step: 'any', placeholder: 'Echte reserve (€)' });
    sectie.append(
      el('p', { class: 'klein' },
        'De app benadert je reserve; het jaaroverzicht van de verzekeraar is de waarheid. ' +
        'Vul die stand hier in: hij blijft als referentiepunt op het hoofdscherm staan, ' +
        'ijkt de simulatie (foutmarge < 2%), en dient als terugval zolang er geen koersen zijn.'),
      el('div', { class: 'controle-rij' },
        ijkInvoer,
        el('button', {
          onclick: () => {
            const echte = Number(ijkInvoer.value);
            if (!Number.isFinite(echte) || echte <= 0) {
              meldingen.toonInfo('Vul een geldig bedrag in.');
              return;
            }
            const nieuw = { ...params, echteReserve: echte, echteReserveDatum: vandaag() };
            // Zijn er koersen, dan ijkt dit bedrag meteen de simulatie. Delen
            // door de bestaande factor houdt het ijken idempotent.
            if (zicht !== null && zicht.koersBeschikbaar) {
              nieuw.ijkFactor = echte / (zicht.reserve / params.ijkFactor);
              nieuw.ijkDatum = vandaag();
              meldingen.toonInfo('Reserve bewaard en de simulatie is erop geijkt.');
            } else {
              meldingen.toonInfo('Reserve bewaard. Er wordt nu mee gerekend zolang er geen koersen zijn.');
            }
            bewaarEnRender(nieuw);
          },
        }, 'Bewaar reserve')),
    );
    if (params.echteReserve > 0) {
      sectie.append(el('p', { class: 'klein' },
        `Bewaard: ${formatteerEuro(params.echteReserve)} op ` +
        `${formatteerDatum(params.echteReserveDatum)}` +
        (params.ijkDatum === null ? '. ' : ` · simulatie geijkt (factor ${params.ijkFactor.toFixed(3)}). `),
        el('button', {
          class: 'link-knop',
          onclick: () => bewaarEnRender({
            ...params, echteReserve: 0, echteReserveDatum: null, ijkFactor: 1, ijkDatum: null,
          }),
        }, 'Wissen')));
    }
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
    if (zicht !== null && zicht.bron !== undefined) {
      if (zicht.koersBeschikbaar) scherm.append(grafiekSectie(zicht));
      scherm.append(kerngetallen(params, zicht));
      if (zicht.gemist > 0) {
        scherm.append(el('p', { class: 'klein' },
          `${zicht.gemist} maanden zonder koers; de laatst bekende koers werd gebruikt.`));
      }
      if (zicht.bron === 'overzicht') {
        scherm.append(el('p', { class: 'klein' },
          'Gerekend met de reserve van je jaaroverzicht; er zijn nog geen koersen ' +
          'opgehaald, dus er is geen grafiek van de opbouw.'));
      }
    }
    if (volledig) scherm.append(verversSectie(params, cache));
    // Nooit null aan append() geven: de browser maakt daar de tekst "null" van.
    if (instellingenOpen) scherm.append(instellingenSectie(params, zicht));
    if (!volledig && !instellingenOpen) {
      instellingenOpen = true;
      render();
    }
  }

  // Eerst tekenen, dan pas het netwerk: een trage verbinding mag nooit een
  // leeg scherm opleveren (spec 1 en 8).
  render();
  if (venster.navigator.storage) venster.navigator.storage.persist().catch(() => {});
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
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') controleerUpdate();
  });
  await controleerUpdate();
  return { render };
}
