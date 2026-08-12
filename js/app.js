// App-shell: opstart, navigatie, service worker, updatecheck en
// backup-herinnering (spec 11).
import { openDb, alles, bewaarAlle, haalInstelling, bewaarInstelling } from './db.js';
import { standaardCategorieen } from './categories.js';
import { zetDocument, el, leeg } from './dom.js';
import { maakMeldingen, metRetry } from './meldingen.js';
import { startRouter } from './router.js';
import { renderDashboard } from './views/dashboard.js';
import { renderTransacties } from './views/transacties.js';
import { renderDetail } from './views/detail.js';
import { renderRegels } from './views/regels.js';
import { renderInstellingen } from './views/instellingen.js';
import { renderWerklijst } from './views/werklijst.js';

const VIEWS = {
  dashboard: renderDashboard,
  transacties: renderTransacties,
  transactie: renderDetail,
  regels: renderRegels,
  instellingen: renderInstellingen,
  werklijst: renderWerklijst,
};

export async function controleerUpdate(ctx) {
  let tekst = null;
  try {
    const antwoord = await ctx.venster.fetch(`sw.js?nu=${Date.now()}`, { cache: 'no-store' });
    tekst = await antwoord.text();
  } catch {
    return; // offline: geen updatecheck mogelijk, de app werkt gewoon door
  }
  const m = /VERSIE = '([^']+)'/.exec(tekst);
  if (m === null) return;
  const beschikbaar = m[1];
  const actief = await haalInstelling(ctx.db, 'actieveVersie', null);
  if (actief === null) {
    await bewaarInstelling(ctx.db, 'actieveVersie', beschikbaar);
    return;
  }
  if (actief === beschikbaar) return;
  // Nooit ongevraagd herladen: alleen een balk met een knop (spec 11.3).
  ctx.meldingen.toonBanner('update', el('div', { class: 'banner update' },
    el('span', {}, 'Nieuwe versie beschikbaar. '),
    el('button', {
      class: 'primair',
      onclick: async () => {
        await bewaarInstelling(ctx.db, 'actieveVersie', beschikbaar);
        const registraties = await ctx.venster.navigator.serviceWorker.getRegistrations();
        for (const registratie of registraties) await registratie.unregister();
        for (const naam of await ctx.venster.caches.keys()) await ctx.venster.caches.delete(naam);
        ctx.venster.location.reload();
      },
    }, 'Nu bijwerken')));
}

export async function controleerBackupHerinnering(ctx) {
  const transacties = await alles(ctx.db, 'transactions');
  if (transacties.length === 0) return;
  const maand = 31 * 24 * 60 * 60 * 1000;
  const nu = Date.now();
  const laatste = await haalInstelling(ctx.db, 'laatsteBackupMoment', 0);
  const herinnerd = await haalInstelling(ctx.db, 'backupHerinnerdMoment', 0);
  if (nu - laatste < maand || nu - herinnerd < maand) return;
  ctx.meldingen.toonBanner('backup', el('div', { class: 'banner backup' },
    el('span', {}, 'Maak een backup: iOS kan lokale data van weinig gebruikte apps opruimen. '),
    el('a', { href: '#/instellingen' }, 'Naar backup'),
    el('button', {
      onclick: async () => {
        await bewaarInstelling(ctx.db, 'backupHerinnerdMoment', Date.now());
        ctx.meldingen.verwijderBanner('backup');
      },
    }, 'Later')));
}

export async function startApp(venster) {
  const doc = venster.document;
  zetDocument(doc);
  const db = await openDb(venster.indexedDB);
  // Ontbrekende standaardcategorieën aanvullen: zaait een lege opslag en
  // voegt bij bestaande installaties nieuw toegevoegde categorieën toe,
  // zonder ooit bestaande (eventueel hernoemde) categorieën te overschrijven.
  const bekendeCategorieen = new Set((await alles(db, 'categories')).map((c) => c.id));
  const ontbrekend = standaardCategorieen().filter((c) => !bekendeCategorieen.has(c.id));
  if (ontbrekend.length > 0) {
    await bewaarAlle(db, 'categories', ontbrekend);
  }
  const meldingen = maakMeldingen(doc.getElementById('banners'), doc.getElementById('meldingen'));
  const scherm = doc.getElementById('scherm');
  let huidigeRoute = { naam: 'dashboard', query: {} };
  async function render(route) {
    huidigeRoute = route;
    leeg(scherm);
    await VIEWS[route.naam](ctx, scherm, route);
  }
  const ctx = {
    venster,
    doc,
    db,
    meldingen,
    bevestig: (tekst) => venster.confirm(tekst),
    bewaar: (actie) => metRetry(actie, meldingen),
    navigeer: (hash) => {
      venster.location.hash = hash;
    },
    herlaad: () => render(huidigeRoute),
    dashboardStand: { modus: 'maand', maand: null, boekjaar: null },
  };
  const navigatie = doc.getElementById('navigatie');
  for (const [hash, tekst] of [['#/', 'Dashboard'], ['#/transacties', 'Transacties'],
    ['#/regels', 'Regels'], ['#/instellingen', 'Instellingen']]) {
    navigatie.append(el('a', { href: hash }, tekst));
  }
  // Eerste gebruik: persistente opslag vragen; het resultaat is geen garantie.
  if (venster.navigator.storage) await venster.navigator.storage.persist();
  if (venster.navigator.serviceWorker) venster.navigator.serviceWorker.register('sw.js');
  await controleerUpdate(ctx);
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'visible') controleerUpdate(ctx);
  });
  await controleerBackupHerinnering(ctx);
  startRouter(venster, render);
  return ctx;
}
