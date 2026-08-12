// Instellingen (spec 11.1): categorieën, eigen rekeningen, boekjaar en backup.
import { el, keuzelijst } from '../dom.js';
import { alles, bewaar, bewaarAlle, verwijder, leegStore, haalInstelling, bewaarInstelling, STORES } from '../db.js';
import { ONGECATEGORISEERD, KLASSEN, categorieMap } from '../categories.js';
import { maakBackup, valideerBackup, exporteerCsv } from '../backup.js';
import { zetInterneStatus } from '../flows.js';

function download(ctx, bestandsnaam, inhoud, type) {
  const blob = new ctx.venster.Blob([inhoud], { type });
  const url = ctx.venster.URL.createObjectURL(blob);
  el('a', { href: url, download: bestandsnaam }).click();
  ctx.venster.URL.revokeObjectURL(url);
}

const KLEUREN = ['#00695c', '#5d4037', '#c62828', '#6a1b9a', '#283593', '#00838f', '#9e9d24'];

function categorieSectie(ctx, wortel, categorieen) {
  wortel.append(el('h2', {}, 'Categorieën'));
  const lijst = el('ul', { class: 'categorie-lijst' });
  for (const categorie of categorieen) {
    const naamInvoer = el('input', {
      type: 'text',
      value: categorie.name,
      onchange: async () => {
        await ctx.bewaar(() => bewaar(ctx.db, 'categories', { ...categorie, name: naamInvoer.value }));
        ctx.herlaad();
      },
    });
    const rij = el('li', {}, naamInvoer, el('span', { class: 'klein' }, categorie.type));
    if (categorie.type === 'uit') {
      const klasseKeuze = keuzelijst(KLASSEN.map((k) => [k, k]), categorie.costClass, async () => {
        await ctx.bewaar(() => bewaar(ctx.db, 'categories', { ...categorie, costClass: klasseKeuze.value }));
        ctx.herlaad();
      });
      rij.append(klasseKeuze);
    }
    if (categorie.id !== ONGECATEGORISEERD) {
      rij.append(el('button', {
        onclick: async () => {
          const alleTx = await alles(ctx.db, 'transactions');
          const getroffen = alleTx.filter((tx) => tx.categoryId === categorie.id);
          if (!ctx.bevestig(`Categorie "${categorie.name}" verwijderen? ` +
            `${getroffen.length} transacties gaan terug naar Ongecategoriseerd.`)) return;
          await ctx.bewaar(async () => {
            await verwijder(ctx.db, 'categories', categorie.id);
            await bewaarAlle(ctx.db, 'transactions', getroffen.map((tx) => (
              { ...tx, categoryId: null, ruleId: null, manualCategory: false })));
            const regels = await alles(ctx.db, 'rules');
            for (const regel of regels.filter((r) => r.categoryId === categorie.id)) {
              await verwijder(ctx.db, 'rules', regel.id);
            }
          });
          ctx.herlaad();
        },
      }, 'Verwijder'));
    }
    lijst.append(rij);
  }
  const nieuwNaam = el('input', { type: 'text', placeholder: 'Nieuwe categorie' });
  const nieuwType = keuzelijst([['uit', 'Uitgave'], ['in', 'Inkomst']], 'uit', () => {});
  const nieuwKlasse = keuzelijst(KLASSEN.map((k) => [k, k]), 'variabel', () => {});
  wortel.append(lijst, el('div', { class: 'toevoegen' },
    nieuwNaam, nieuwType, nieuwKlasse,
    el('button', {
      onclick: async () => {
        if (nieuwNaam.value.trim() === '') return;
        const type = nieuwType.value;
        await ctx.bewaar(() => bewaar(ctx.db, 'categories', {
          id: crypto.randomUUID(),
          name: nieuwNaam.value.trim(),
          type,
          costClass: type === 'uit' ? nieuwKlasse.value : null,
          color: KLEUREN[categorieen.length % KLEUREN.length],
        }));
        ctx.herlaad();
      },
    }, 'Voeg toe')));
}

function eigenRekeningenSectie(ctx, wortel, rekeningen) {
  wortel.append(el('h2', {}, 'Eigen rekeningen'),
    el('p', { class: 'klein' }, 'Overschrijvingen van en naar deze IBAN’s tellen als intern en blijven buiten alle totalen.'));
  const lijst = el('ul', {});
  for (const rekening of rekeningen) {
    lijst.append(el('li', {},
      el('span', {}, `${rekening.iban} (${rekening.label})`),
      el('button', {
        onclick: async () => {
          await ctx.bewaar(() => verwijder(ctx.db, 'ownAccounts', rekening.iban));
          await zetInterneStatus(ctx, rekening.iban, false);
          ctx.herlaad();
        },
      }, 'Verwijder')));
  }
  const ibanInvoer = el('input', { type: 'text', placeholder: 'BE68539007547034' });
  const labelInvoer = el('input', { type: 'text', placeholder: 'Label' });
  wortel.append(lijst, el('div', { class: 'toevoegen' },
    ibanInvoer, labelInvoer,
    el('button', {
      onclick: async () => {
        const iban = ibanInvoer.value.replaceAll(' ', '');
        if (iban === '') return;
        await ctx.bewaar(() => bewaar(ctx.db, 'ownAccounts', { iban, label: labelInvoer.value }));
        await zetInterneStatus(ctx, iban, true);
        ctx.herlaad();
      },
    }, 'Voeg toe')));
}

function boekjaarSectie(ctx, wortel, startMaand) {
  const namen = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli',
    'augustus', 'september', 'oktober', 'november', 'december'];
  const keuze = keuzelijst(namen.map((naam, i) => [String(i + 1), naam]), String(startMaand),
    async () => {
      await ctx.bewaar(() => bewaarInstelling(ctx.db, 'boekjaarStartMaand', Number(keuze.value)));
      ctx.dashboardStand.boekjaar = null;
      ctx.herlaad();
    });
  wortel.append(el('h2', {}, 'Boekjaar'),
    el('label', {}, 'Startmaand van het boekjaar: ', keuze));
}

function backupSectie(ctx, wortel) {
  const herstelInvoer = el('input', {
    type: 'file', accept: '.json,application/json', class: 'verborgen',
    onchange: async () => {
      const bestand = herstelInvoer.files[0];
      let data = null;
      try {
        data = JSON.parse(await bestand.text());
      } catch {
        ctx.meldingen.toonInfo('Dit bestand is geen leesbare backup. Kies het JSON-bestand dat deze app zelf maakte.');
        return;
      }
      if (!valideerBackup(data)) {
        ctx.meldingen.toonInfo('Dit bestand heeft niet het verwachte backup-formaat of een andere schemaversie. Kies een backup van deze app.');
        return;
      }
      if (!ctx.bevestig('Dit vervangt alle huidige data. Doorgaan?')) return;
      await ctx.bewaar(async () => {
        for (const store of STORES) {
          await leegStore(ctx.db, store);
          await bewaarAlle(ctx.db, store, data[store]);
        }
      });
      ctx.meldingen.toonInfo('Backup teruggezet.');
      ctx.herlaad();
    },
  });
  wortel.append(el('h2', {}, 'Backup'),
    el('button', {
      class: 'primair',
      onclick: async () => {
        const stores = {};
        for (const store of STORES) stores[store] = await alles(ctx.db, store);
        download(ctx, 'kbc-cashflow-backup.json', JSON.stringify(maakBackup(stores)), 'application/json');
        await ctx.bewaar(() => bewaarInstelling(ctx.db, 'laatsteBackupMoment', Date.now()));
        ctx.meldingen.verwijderBanner('backup');
      },
    }, 'Backup downloaden'),
    el('button', { onclick: () => herstelInvoer.click() }, 'Backup terugzetten'),
    herstelInvoer,
    el('button', {
      onclick: async () => {
        const transacties = await alles(ctx.db, 'transactions');
        const catMap = categorieMap(await alles(ctx.db, 'categories'));
        download(ctx, 'kbc-cashflow-transacties.csv', exporteerCsv(transacties, catMap), 'text/csv');
      },
    }, 'Exporteer transacties als CSV'));
}

export async function renderInstellingen(ctx, wortel) {
  const categorieen = await alles(ctx.db, 'categories');
  const rekeningen = await alles(ctx.db, 'ownAccounts');
  const startMaand = await haalInstelling(ctx.db, 'boekjaarStartMaand', 1);
  wortel.append(el('h1', {}, 'Instellingen'));
  categorieSectie(ctx, wortel, categorieen);
  eigenRekeningenSectie(ctx, wortel, rekeningen);
  boekjaarSectie(ctx, wortel, startMaand);
  backupSectie(ctx, wortel);
}
