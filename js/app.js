// IPT Tracker: één scherm dat toont of de polis op koers ligt (spec 1, 7).
// De vormgeving volgt docs/ui-ontwerp.md: één antwoord bovenaan, daaronder het
// bewijs, en alles wat onderhoud is achter een sheet.
import { zetDocument, el, leeg } from './dom.js';
import { maakMeldingen } from './meldingen.js';
import { laadParams, bewaarParams, laadKoersen, bewaarKoersen, paramsVolledig, nettoPerMaand, doelBruto, nettoRendement, gebruiktGemeten, controleVerouderd } from './opslag.js';
import { overzicht, nettoUitGemeten } from './reken.js';
import { haalKoersen, metTijdslimiet } from './koersen.js';
import { grafiekSvg, waardeOpPunt, legendeHtml, tabelRijen } from './grafiek.js';
import { historischRendement, MINIMUM_MAANDEN } from './afleiden.js';
import { formatteerEuro, formatteerEuroPrecies, formatteerProcent, formatteerPunten, formatteerDatum } from './format.js';

// Wat je van je polis moet overtypen: vier velden, meer niet.
const PERSOONLIJKE_VELDEN = [
  ['premiePerMaand', 'Maandpremie hoofdwaarborg excl. taks (€)', 'getal', 'bv. 350'],
  ['doelNetto', 'Doelkapitaal netto (€)', 'getal', 'bv. 250000'],
  ['startDatum', 'Startdatum premies', 'datum', ''],
  ['eindDatum', 'Einddatum polis', 'datum', ''],
];

// De eindtaxatie bepaalt het brutodoel; het rendement heeft een eigen blok
// omdat daar een keuze tussen meting en aanname bij hoort.
const AANNAME_VELDEN = [
  ['eindtaks', 'Eindtaxatie (%)', 'procent', 'bv. 17,5'],
];

// Zelden aan te raken; staan achter "Geavanceerd".
const PRODUCT_VELDEN = [
  ['instapkost', 'Instapkost (% per premie)', 'procent', ''],
  ['beheerskost', 'Beheerskost verzekeraar (% per jaar)', 'procent', ''],
  ['ter', 'TER van de ETF (% per jaar)', 'procent', ''],
  ['ticker', 'ETF-ticker (Yahoo Finance)', 'tekst', ''],
  ['isin', 'ETF ISIN', 'tekst', ''],
  ['internFonds', 'Intern fonds', 'tekst', ''],
  ['proxyUrl', 'Eigen CORS-proxy (alleen nodig bij een eigen ticker)', 'tekst', ''],
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

// Kleur is nooit het enige signaal: bij elke status hoort een glyph én een
// woord, en de doelmeter herhaalt hetzelfde antwoord als lengte.
const STATUS = {
  groen: { glyph: '✓', woord: 'GOED' },
  oranje: { glyph: '!', woord: 'NET NIET' },
  rood: { glyph: '×', woord: 'NIET GOED' },
};

// De meter loopt tot 115% zodat "ruim boven doel" niet tegen de rand plakt.
const METER_TOP = 115;

export async function startApp(venster) {
  const doc = venster.document;
  zetDocument(doc);
  const opslag = venster.localStorage;
  const meldingen = maakMeldingen(doc.getElementById('banners'), doc.getElementById('meldingen'));
  const scherm = doc.getElementById('scherm');
  const vandaag = () => new Date().toISOString().slice(0, 10);
  // De instellingen zijn een eigen pagina in de geschiedenis van de browser.
  // Zonder dat verlaat de terugveeg op iOS de hele app in plaats van het
  // paneel te sluiten, en verspringt een herlaad je terug naar het dashboard.
  const INSTELLINGEN_HASH = '#instellingen';
  let instellingenOpen = venster.location.hash === INSTELLINGEN_HASH;
  let eigenGeschiedenis = false;
  let tapWaarde = null;

  function zetInstellingen(open) {
    if (open) {
      if (venster.location.hash !== INSTELLINGEN_HASH) {
        venster.history.pushState({ instellingen: true }, '', INSTELLINGEN_HASH);
        eigenGeschiedenis = true;
      }
      instellingenOpen = true;
    } else {
      instellingenOpen = false;
      // Alleen terug als wíj die pagina hebben toegevoegd; anders zou "Klaar"
      // je uit de app gooien wanneer je rechtstreeks op #instellingen landt.
      if (eigenGeschiedenis) {
        eigenGeschiedenis = false;
        venster.history.back();
      } else if (venster.location.hash === INSTELLINGEN_HASH) {
        venster.history.replaceState({}, '', venster.location.pathname);
      }
    }
    render();
  }

  function bewaarEnRender(params) {
    bewaarParams(opslag, params);
    tapWaarde = null;
    render();
  }

  function leegVlak(glyph, woord, uitleg, knop = null) {
    return el('section', { class: 'status-vlak onbekend', role: 'status', 'aria-live': 'polite' },
      el('div', { class: 'status-kop' },
        el('span', { class: 'status-glyph', 'aria-hidden': 'true' }, glyph),
        el('strong', { class: 'status-woord' }, woord)),
      el('p', {}, uitleg),
      knop);
  }

  function statusVlak(params, zicht) {
    if (zicht === null) {
      return leegVlak('?', 'VUL JE GEGEVENS IN',
        'Tik op ⚙ en vul je maandpremie, doelkapitaal en de twee datums van je polis in. ' +
        'Daarna rekent de app. Alles blijft op dit toestel.',
        el('button', {
          class: 'primair',
          onclick: () => zetInstellingen(true),
        }, 'Gegevens invullen'));
    }
    if (zicht.bron === undefined) {
      return leegVlak('?', 'NOG GEEN CIJFERS',
        'Tik op "Koersen vernieuwen" om de ETF-koersen op te halen. Lukt dat niet, vul dan ' +
        'bij ⚙ je reserve van het laatste jaaroverzicht in — daarmee rekent de app ook ' +
        'zonder koersen.');
    }
    const { glyph, woord } = STATUS[zicht.kleur];
    // Het teken staat altijd expliciet vóór het bedrag, ook bij nul.
    const teken = zicht.deltaBruto >= 0 ? '+' : '−';
    const pct = Math.round((zicht.eindwaarde / zicht.doel) * 100);
    const vulling = Math.min(METER_TOP, Math.max(0, pct));
    const zonderKoersen = zicht.bron === 'overzicht';
    return el('section', {
      class: `status-vlak ${zicht.kleur}`, role: 'status', 'aria-live': 'polite',
    },
      el('div', { class: 'status-kop' },
        el('span', { class: 'status-glyph', 'aria-hidden': 'true' }, glyph),
        el('strong', { class: 'status-woord' },
          woord + (zonderKoersen ? ' · ZONDER KOERSEN' : ''))),
      el('span', { class: 'status-delta' },
        `${teken} ${formatteerEuro(Math.abs(zicht.deltaBruto))}`),
      el('span', { class: 'status-sub' },
        `verwacht ${formatteerEuro(zicht.eindwaarde)} op ${formatteerDatum(params.eindDatum)} · ` +
        `doel ${formatteerEuro(zicht.doel)}`),
      el('span', { class: 'status-netto' },
        `netto ${zicht.deltaNetto >= 0 ? '+' : '−'} ${formatteerEuro(Math.abs(zicht.deltaNetto))} ` +
        `${zicht.deltaNetto >= 0 ? 'boven' : 'onder'} je doel`),
      el('div', { class: 'meter', 'aria-hidden': 'true' },
        el('div', { class: 'meter-vulling', style: `width: ${(vulling / METER_TOP) * 100}%` }),
        el('div', { class: 'meter-streep', style: `left: ${(90 / METER_TOP) * 100}%` }),
        el('div', { class: 'meter-streep', style: `left: ${(100 / METER_TOP) * 100}%` })),
      el('span', { class: 'meter-bij' }, `${pct}% van je doel · streepjes op 90% en 100%`),
      // Zonder deze regel is een fors overschot een raadsel: het hangt volledig
      // aan het rendement waarmee de app doorrekent, en dat is standaard het
      // gemeten rendement van het fonds — niet de aanname van je makelaar.
      el('p', { class: 'status-basis' },
        `Doorgerekend met ${formatteerProcent(nettoRendement(params))} netto per jaar, ` +
        (gebruiktGemeten(params)
          ? `het gemeten rendement van het fonds over ${Math.round(params.gemetenMaanden / 12)} jaar.`
          : 'jouw eigen aanname.')),
      el('p', { class: 'status-zin' }, zonderKoersen
        ? `Gerekend met je jaaroverzicht van ${formatteerDatum(params.echteReserveDatum)}.`
        : `Je ligt ${formatteerProcent(Math.abs(zicht.pctVsPad))} ` +
          `${zicht.pctVsPad >= 0 ? 'voor' : 'achter'} op het doelpad.`));
  }

  function grafiekSectie(zicht) {
    const houder = el('section', { class: 'grafiek-kaart' });
    const grafiek = el('div', {
      class: 'grafiek',
      onclick: (gebeurtenis) => {
        // clientX en niet offsetX: in Safari is offsetX relatief tot het
        // geraakte kindelement, dus een tik op een lijn geeft een ander jaar.
        const vak = grafiek.getBoundingClientRect();
        tapWaarde = waardeOpPunt(zicht, (gebeurtenis.clientX - vak.left) / vak.width);
        render();
      },
    });
    grafiek.innerHTML = grafiekSvg(zicht, tapWaarde);
    const legende = el('div', { class: 'legende' });
    legende.innerHTML = legendeHtml(zicht);
    houder.append(grafiek, legende, tapRegel(), cijferTabel(zicht));
    return houder;
  }

  // Vaste hoogte en een hint vooraf: anders verspringt de halve pagina onder
  // je vinger zodra de regel voor het eerst verschijnt.
  function tapRegel() {
    if (tapWaarde === null) {
      return el('p', { class: 'tapregel leeg' }, 'Tik op de grafiek voor de waarden van dat jaar.');
    }
    const delen = [`${tapWaarde.jaar} · doelpad ${formatteerEuro(tapWaarde.pad)}`];
    // Punt 0 is de nulstand vóór de eerste premie: daar hoort geen
    // gerealiseerde of verwachte waarde bij, alleen het doelpad.
    if (tapWaarde.werkelijk !== undefined) {
      delen.push(`werkelijk ${formatteerEuro(tapWaarde.werkelijk)}`);
    } else if (tapWaarde.verwacht !== undefined) {
      delen.push(`verwacht ${formatteerEuro(tapWaarde.verwacht)}`);
    }
    const opLijn = tapWaarde.werkelijk ?? tapWaarde.verwacht;
    if (opLijn !== undefined) {
      const verschil = opLijn - tapWaarde.pad;
      delen.push(`${verschil >= 0 ? '+' : '−'} ${formatteerEuro(Math.abs(verschil))}`);
    }
    return el('p', { class: 'tapregel' }, delen.join(' · '));
  }

  // Elk cijfer ook zonder beeld beschikbaar, en gratis controleerbaar bij het ijken.
  function cijferTabel(zicht) {
    const lichaam = el('tbody', {});
    for (const rij of tabelRijen(zicht)) {
      const opLijn = rij.werkelijk ?? rij.verwacht;
      lichaam.append(el('tr', {},
        el('td', {}, String(rij.jaar)),
        el('td', {}, formatteerEuro(rij.pad)),
        el('td', {}, opLijn === undefined ? '—' : formatteerEuro(opLijn))));
    }
    return el('details', {},
      el('summary', {}, 'Cijfers per 10 jaar'),
      el('table', { class: 'cijfertabel' },
        el('thead', {}, el('tr', {},
          el('th', {}, 'Jaar'), el('th', {}, 'Doelpad'), el('th', {}, 'Jouw lijn'))),
        lichaam));
  }

  function kerngetallen(params, zicht) {
    const rij = (naam, waarde, klasse = '', waardeKlasse = '') => el('div', { class: `kerngetal ${klasse}`.trim() },
      el('span', { class: 'kern-naam' }, naam),
      el('strong', { class: waardeKlasse }, waarde));
    const sectie = el('section', { class: 'kerngetallen' },
      rij(zicht.bron === 'overzicht' ? 'Reserve (jouw overzicht)' : 'Reserve vandaag',
        formatteerEuro(zicht.reserve)),
      rij('Doelpad vandaag', formatteerEuro(zicht.padVandaag)),
      rij('Verschil',
        `${zicht.verschilVandaag >= 0 ? '+' : '−'} ${formatteerEuro(Math.abs(zicht.verschilVandaag))}`,
        '', zicht.verschilVandaag >= 0 ? 'positief' : 'negatief'));
    // Het ijkpunt blijft zichtbaar als referentie, ook als de simulatie draait.
    if (params.echteReserve > 0 && zicht.bron !== 'overzicht') {
      sectie.append(rij(`Jouw overzicht (${formatteerDatum(params.echteReserveDatum)})`,
        formatteerEuro(params.echteReserve), 'referentie'));
    }
    sectie.append(rendementTegels(params, zicht));
    if (zicht.gemist > 0) {
      sectie.append(el('p', { class: 'zwak' },
        `${zicht.gemist} maanden zonder koers; de laatst bekende koers werd gebruikt.`));
    }
    return sectie;
  }

  // De kernvraag van de app: wat is er nodig, en wat deed het fonds echt?
  // Naast elkaar, zodat je het verschil niet zelf moet uitrekenen.
  function rendementTegels(params, zicht) {
    const nodig = el('div', { class: 'tegel' },
      el('span', { class: 'tegel-kop' }, 'Nodig vanaf nu'),
      el('span', { class: 'tegel-waarde' },
        zicht.vereist === null ? '—' : formatteerProcent(zicht.vereist)),
      el('span', { class: 'tegel-bij' },
        zicht.vereist === null ? 'alle premies zijn betaald' : 'netto per jaar'));
    const gemeten = params.gemetenMaanden > 0;
    const fonds = el('div', { class: 'tegel' },
      el('span', { class: 'tegel-kop' }, gemeten
        ? `Fonds deed (${Math.round(params.gemetenMaanden / 12)} jaar)`
        : 'Fonds deed'),
      el('span', { class: 'tegel-waarde' },
        gemeten ? formatteerProcent(params.gemetenRendement) : '—'),
      gemeten
        ? el('span', { class: 'tegel-bij' }, 'bruto per jaar')
        : el('span', { class: 'tegel-bij' }, 'nog niet gemeten'));
    const blok = el('div', {}, el('div', { class: 'tegels' }, nodig, fonds));
    if (!gemeten) {
      fonds.append(verversKnop('Meet nu', ''));
      return blok;
    }
    if (zicht.vereist === null) return blok;
    // Appels met appels: het gemeten rendement is bruto, het vereiste netto.
    // De vergelijking gebeurt dus na de beheerskost van de verzekeraar.
    const netto = nettoUitGemeten(params, params.gemetenRendement);
    const verschil = netto - zicht.vereist;
    blok.append(el('p', { class: 'verdict' },
      `Na de beheerskost houdt het fonds ${formatteerProcent(netto)} netto over — `,
      el('strong', {}, formatteerPunten(Math.abs(verschil))),
      verschil >= 0 ? ' méér dan je nodig hebt.' : ' minder dan je nodig hebt.'));
    return blok;
  }

  // Eén ophaalpad, twee knoppen: de grote in de ververskaart en "Meet nu" in
  // de tegel. Beide doen hetzelfde, dus beide gebruiken deze fabriek.
  function verversKnop(label, klasse, statusEl = null) {
    const knop = el('button', {
      class: klasse,
      onclick: async () => {
        const params = laadParams(opslag);
        const cache = laadKoersen(opslag);
        // Zichtbaar aan het werk blijven: zonder terugkoppeling lijkt een
        // trage bron op een knop die niets doet.
        knop.setAttribute('disabled', 'disabled');
        knop.textContent = 'Koersen ophalen…';
        knop.append(el('span', { class: 'laadbalk' }));
        if (statusEl !== null) statusEl.textContent = 'Even geduld — meestal 2 tot 5 seconden.';
        meldingen.verwijderBanner('koersen-fout');
        const fetchFn = metTijdslimiet((url, opties) => venster.fetch(url, opties), venster);
        let bron = '';
        const melder = (poging, totaal, naam) => {
          bron = naam;
          if (statusEl !== null) statusEl.textContent = `Poging ${poging} van ${totaal}: ${naam}…`;
        };
        try {
          // Eén verzoek levert de volledige maandhistoriek: daaruit komen
          // zowel de koersen van de premiemaanden als het rendement van het
          // fonds. haalKoersen gooit al bij een leeg antwoord, en nieuwe
          // koersen gaan over de bestaande heen zodat één mislukte ophaling
          // nooit historiek vernietigt.
          const verse = await haalKoersen(fetchFn, params, melder);
          bewaarKoersen(opslag, { ...cache.koersen, ...verse }, vandaag());
          const gemeten = historischRendement(verse);
          if (gemeten !== null) {
            bewaarParams(opslag, {
              ...laadParams(opslag),
              gemetenRendement: gemeten.rendement,
              gemetenMaanden: gemeten.maanden,
              gemetenTot: gemeten.tot,
            });
          }
          const maanden = Object.keys(verse).length;
          meldingen.toonInfo(gemeten === null
            ? `Koersen uit ${bron}: ${maanden} maanden. Te weinig historiek om het ` +
              'rendement te meten.'
            : `Koersen uit ${bron}: ${maanden} maanden, rendement ` +
              `${formatteerProcent(gemeten.rendement)} per jaar.`);
        } catch {
          toonKoersenFout(params);
        }
        render();
      },
    }, label);
    return knop;
  }

  function verversSectie(cache) {
    const status = el('span', { class: 'klein', 'aria-live': 'polite' });
    const regel = el('div', { class: 'ververs-regel' });
    if (cache.opgehaald === null) {
      regel.append(el('span', { class: 'klein' }, 'Nog geen koersen opgehaald.'));
    } else {
      regel.append(el('span', { class: 'klein' }, `Laatste koers ${formatteerDatum(cache.opgehaald)}`));
      if (Date.parse(vandaag()) - Date.parse(cache.opgehaald) > 35 * 86400000) {
        regel.append(el('span', { class: 'badge-verouderd' }, 'verouderd'));
      }
    }
    regel.append(status);
    return el('section', { class: 'ververs' },
      verversKnop('Koersen vernieuwen', 'primair', status), regel);
  }

  // Een blijvende melding: een toast van zes seconden mis je te makkelijk.
  function toonKoersenFout(params) {
    meldingen.toonBanner('koersen-fout', el('div', { class: 'banner fout' },
      el('p', {}, el('strong', {}, 'Koersen ophalen lukt niet.')),
      el('p', { class: 'klein' },
        `Geen enkele bron gaf koersen voor ticker ${params.ticker}. Het maandbestand van de app ` +
        'bevat een ander fonds of ontbrak, en ook de doorgeefluiken antwoordden niet. Zet de ' +
        'ticker bij ⚙ terug op het gepubliceerde fonds, of vul je reserve van het jaaroverzicht ' +
        'in — dan rekent de app ook zonder koersen.'),
      el('div', { class: 'banner-acties' },
        el('button', {
          onclick: () => meldingen.verwijderBanner('koersen-fout'),
        }, 'Sluiten'))));
  }

  function veldRij(params, [sleutel, label, type, plaatshouder]) {
    const invoer = el('input', {
      type: type === 'datum' ? 'date' : (type === 'tekst' ? 'text' : 'number'),
      step: 'any',
      inputmode: type === 'getal' || type === 'procent' ? 'decimal' : 'text',
      placeholder: plaatshouder,
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

  // Eén keuzekaart voor het rendement. De hele kaart is aanraakbaar; de
  // inactieve kaart wordt niet gedimd, want dat brengt de tekst onder 4,5:1.
  function keuzeKaart(actief, titel, inhoud, kiezen) {
    return el('button', {
      class: `keuze ${actief ? 'actief' : ''}`.trim(),
      'aria-pressed': actief ? 'true' : 'false',
      onclick: kiezen,
    },
      el('span', { class: 'radio', 'aria-hidden': 'true' }),
      el('span', { class: 'keuze-tekst' },
        el('span', { class: 'keuze-kop' },
          el('span', { class: 'keuze-titel' }, titel),
          actief ? el('span', { class: 'badge-actief' }, 'in gebruik') : null),
        ...inhoud));
  }

  function rendementBlok(params) {
    const gemetenActief = gebruiktGemeten(params);
    const lijst = el('div', { class: 'keuze-lijst' });
    if (params.gemetenMaanden > 0) {
      lijst.append(keuzeKaart(gemetenActief, 'Gemeten uit de koersen', [
        el('span', { class: 'keuze-waarde' },
          `${formatteerProcent(params.gemetenRendement)} bruto per jaar`),
        el('span', { class: 'zwak' },
          `Over ${Math.round(params.gemetenMaanden / 12)} jaar, tot ${params.gemetenTot}. ` +
          'Een korte, gunstige beursperiode is geen belofte voor veertig jaar.'),
      ], () => bewaarEnRender({ ...params, gebruikGemeten: true })));
    }
    // Deze kaart bevat een invoerveld en is daarom geen knop: een tik in het
    // veld mag de keuze niet omzetten. Schakelen doet de knop eronder.
    lijst.append(el('div', { class: `keuze ${gemetenActief ? '' : 'actief'}`.trim() },
      el('span', { class: 'radio', 'aria-hidden': 'true' }),
      el('span', { class: 'keuze-tekst' },
        el('span', { class: 'keuze-kop' },
          el('span', { class: 'keuze-titel' }, 'Mijn eigen aanname'),
          gemetenActief ? null : el('span', { class: 'badge-actief' }, 'in gebruik')),
        veldRij(params, ['rendementBruto', 'Verwacht rendement van de index (% per jaar)', 'procent', 'bv. 7']),
        params.gemetenMaanden === 0
          ? el('span', { class: 'zwak' },
            `Nog niets gemeten: daarvoor is minstens ${MINIMUM_MAANDEN / 12} jaar koershistoriek ` +
            'van het fonds nodig. Tik op "Koersen vernieuwen"; lukt dat, dan rekent de app met ' +
            'het werkelijke rendement van het fonds in plaats van met deze schatting.')
          : (gemetenActief ? el('button', {
            onclick: () => bewaarEnRender({ ...params, gebruikGemeten: false }),
          }, 'Reken hiermee') : null))));
    return lijst;
  }

  function instellingenSheet(params, zicht) {
    const sheet = el('div', { class: 'sheet' },
      el('div', { class: 'sheet-kop' },
        el('h1', { tabindex: '-1' }, 'Instellingen'),
        el('button', {
          onclick: () => zetInstellingen(false),
        }, 'Klaar')));
    sheet.append(el('h2', {}, 'Jouw polis'));
    for (const veld of PERSOONLIJKE_VELDEN) sheet.append(veldRij(params, veld));
    if (paramsVolledig(params)) {
      sheet.append(el('p', { class: 'klein' },
        `Netto belegd ${formatteerEuroPrecies(nettoPerMaand(params))} per maand · ` +
        `doel bruto ${formatteerEuro(doelBruto(params))} (nodig om na eindtaxatie ` +
        `${formatteerEuro(params.doelNetto)} netto over te houden).`));
    } else {
      sheet.append(el('p', { class: 'klein' }, 'Vul deze vier velden in; daarna rekent de app.'));
    }
    // Het rendement is meetbaar uit de koershistoriek; de TER niet — Yahoo
    // geeft die voor Europese ETF's niet vrij, dus daarvoor een bronlink.
    const gemetenActief = gebruiktGemeten(params);
    sheet.append(
      el('h2', {}, 'Rendement'),
      rendementBlok(params),
      el('p', { class: 'klein' },
        `De app rekent met ${formatteerProcent(nettoRendement(params))} netto per jaar: ` +
        `${formatteerProcent(gemetenActief ? params.gemetenRendement : params.rendementBruto)} ` +
        (gemetenActief ? 'gemeten' : 'aanname') + ', min ' +
        (gemetenActief ? '' : `${formatteerProcent(params.ter)} fondskosten en `) +
        `${formatteerProcent(params.beheerskost)} beheerskost` +
        (gemetenActief ? ' (de fondskosten zitten al in de gemeten koersen)' : '') + '.'));
    sheet.append(el('h2', {}, 'Eindtaxatie'));
    for (const veld of AANNAME_VELDEN) sheet.append(veldRij(params, veld));
    sheet.append(el('h2', {}, 'Mijn reserve volgens het overzicht'));
    // Bedrag én datum, allebei bewerkbaar en voorgevuld met wat er staat: een
    // jaaroverzicht is per definitie van een dag in het verleden, en tegen de
    // simulatie van díé dag hoort het geijkt te worden.
    const ijkInvoer = el('input', {
      type: 'number',
      step: 'any',
      inputmode: 'decimal',
      placeholder: 'Echte reserve (€)',
      value: params.echteReserve > 0 ? String(params.echteReserve) : '',
    });
    const ijkDatumInvoer = el('input', {
      type: 'date',
      'aria-label': 'Datum van het overzicht',
      value: params.echteReserveDatum ?? vandaag(),
    });
    sheet.append(
      el('p', { class: 'klein' },
        'De app benadert je reserve; het jaaroverzicht van de verzekeraar is de waarheid. ' +
        'Vul die stand hier in met de datum die erop staat: hij blijft als referentiepunt op ' +
        'het hoofdscherm staan, ijkt de simulatie tegen die datum (foutmarge < 2%), en dient ' +
        'als terugval zolang er geen koersen zijn.'),
      el('label', { class: 'veld' }, 'Reserve volgens het overzicht (€)', ijkInvoer),
      el('label', { class: 'veld' }, 'Datum van dat overzicht', ijkDatumInvoer),
      el('div', { class: 'controle-rij' },
        el('button', {
          onclick: () => {
            const echte = Number(ijkInvoer.value);
            if (!Number.isFinite(echte) || echte <= 0) {
              meldingen.toonInfo('Vul een geldig bedrag in.');
              return;
            }
            const datum = ijkDatumInvoer.value === '' ? vandaag() : ijkDatumInvoer.value;
            const nieuw = { ...params, echteReserve: echte, echteReserveDatum: datum };
            // Zijn er koersen, dan ijkt dit bedrag meteen de simulatie — tegen
            // de stand van de opgegeven datum, niet die van vandaag. Delen door
            // de bestaande factor houdt het ijken idempotent.
            const opDatum = zicht === null
              ? null
              : overzicht(params, laadKoersen(opslag).koersen, datum);
            if (opDatum !== null && opDatum.koersBeschikbaar) {
              nieuw.ijkFactor = echte / (opDatum.reserve / params.ijkFactor);
              nieuw.ijkDatum = datum;
              meldingen.toonInfo('Reserve bewaard en de simulatie is erop geijkt.');
            } else {
              meldingen.toonInfo('Reserve bewaard. Er wordt nu mee gerekend zolang er geen koersen zijn.');
            }
            bewaarEnRender(nieuw);
          },
        }, 'Bewaar reserve')));
    if (params.echteReserve > 0) {
      sheet.append(el('p', { class: 'klein' },
        `Bewaard: ${formatteerEuro(params.echteReserve)} op ` +
        `${formatteerDatum(params.echteReserveDatum)}` +
        (params.ijkDatum === null
          ? '. '
          : ` · simulatie geijkt op ${formatteerDatum(params.ijkDatum)} ` +
            `(factor ${params.ijkFactor.toFixed(3)}). `),
        el('button', {
          class: 'link-knop',
          onclick: () => bewaarEnRender({
            ...params, echteReserve: 0, echteReserveDatum: null, ijkFactor: 1, ijkDatum: null,
          }),
        }, 'Wissen')));
    }
    sheet.append(el('h2', {}, 'Handmatig nagekeken'));
    for (const [sleutel, label, link] of controles(params)) {
      const verouderd = controleVerouderd(params[sleutel], vandaag());
      sheet.append(el('div', { class: 'controle-rij' },
        el('div', { class: 'controle-tekst' },
          el('span', { class: 'controle-naam' },
            verouderd ? el('span', { class: 'let-op', 'aria-hidden': 'true' }, '!') : null,
            label),
          el('span', { class: verouderd ? 'controle-datum verouderd' : 'controle-datum' },
            (params[sleutel] === null
              ? 'nooit nagekeken'
              : `nagekeken op ${formatteerDatum(params[sleutel])}`) +
            (verouderd && params[sleutel] !== null ? ' — ouder dan een jaar' : ''))),
        el('div', { class: 'controle-acties' },
          link === null ? null : el('a', { href: link, target: '_blank', rel: 'noopener' }, 'Bron ↗'),
          el('button', {
            onclick: () => bewaarEnRender({ ...params, [sleutel]: vandaag() }),
          }, 'Nagekeken'))));
    }
    const geavanceerd = el('details', {}, el('summary', {}, 'Geavanceerd'));
    for (const veld of PRODUCT_VELDEN) geavanceerd.append(veldRij(params, veld));
    geavanceerd.append(el('p', { class: 'klein' },
      'De instapkost en de beheerskost staan in je polis en het beheersreglement; de TER ' +
      'vind je op justETF (link hierboven). De TER telt alleen mee in je eigen aanname — ' +
      'in het gemeten rendement en de simulatie niet, want die zit al in de koersen.'));
    sheet.append(geavanceerd);
    return sheet;
  }

  function render() {
    const params = laadParams(opslag);
    const cache = laadKoersen(opslag);
    const volledig = paramsVolledig(params);
    const zicht = volledig ? overzicht(params, cache.koersen, vandaag()) : null;
    leeg(scherm);
    scherm.append(
      el('header', { class: 'kop' },
        el('span', { class: 'kop-titel' }, 'IPT Tracker'),
        el('button', {
          class: 'tandwiel',
          'aria-label': 'Instellingen openen',
          onclick: () => zetInstellingen(!instellingenOpen),
        }, '⚙')),
      statusVlak(params, zicht));
    if (zicht !== null && zicht.bron !== undefined) {
      scherm.append(grafiekSectie(zicht), kerngetallen(params, zicht));
    }
    if (volledig) scherm.append(verversSectie(cache));
    scherm.append(el('div', { class: 'voettekst' },
      el('p', {}, 'Geen financieel advies. Alles blijft op dit toestel.'),
      el('p', {}, 'Het Vivium-jaaroverzicht is de waarheid — ijk 1×/jaar.')));
    // Nooit null aan append() geven: de browser maakt daar de tekst "null" van.
    doc.body.className = instellingenOpen ? 'sheet-open' : '';
    if (instellingenOpen) scherm.append(instellingenSheet(params, zicht));
    // Zonder polisgegevens valt er niets te tonen: dan staat het paneel open
    // en blijft het open, ook na "Klaar".
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
  venster.addEventListener('popstate', () => {
    eigenGeschiedenis = false;
    instellingenOpen = venster.location.hash === INSTELLINGEN_HASH;
    render();
  });
  doc.addEventListener('keydown', (gebeurtenis) => {
    if (gebeurtenis.key === 'Escape' && instellingenOpen) zetInstellingen(false);
  });
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
      el('p', {}, 'Nieuwe versie beschikbaar.'),
      el('div', { class: 'banner-acties' },
        el('button', {
          class: 'primair',
          onclick: async () => {
            opslag.setItem('actieveVersie', beschikbaar);
            const registraties = await venster.navigator.serviceWorker.getRegistrations();
            for (const registratie of registraties) await registratie.unregister();
            for (const naam of await venster.caches.keys()) await venster.caches.delete(naam);
            venster.location.reload();
          },
        }, 'Nu bijwerken'))));
  }
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') controleerUpdate();
  });
  await controleerUpdate();
  return { render };
}
