// Regelbeheer (spec 6.5) en herkende vaste kosten (spec 10).
import { el, keuzelijst } from '../dom.js';
import { alles, bewaar, bewaarAlle, verwijder } from '../db.js';
import { categorieMap, categorieNaam, KLASSEN } from '../categories.js';
import { sorteerRegels, herclassificeer, verplaatsRegel, regelOmschrijving } from '../rules.js';
import { pasToe, bewaarRegelsMetTellers } from '../flows.js';
import { formatteerCenten } from '../format.js';

export async function renderRegels(ctx, wortel) {
  const regels = sorteerRegels(await alles(ctx.db, 'rules'));
  const alleTx = await alles(ctx.db, 'transactions');
  const categorieen = await alles(ctx.db, 'categories');
  const kandidaten = await alles(ctx.db, 'recurringCandidates');
  const catMap = categorieMap(categorieen);

  wortel.append(el('h1', {}, 'Regels'),
    el('button', {
      class: 'primair',
      onclick: async () => {
        const { bijgewerkt, veranderd } = herclassificeer(regels, alleTx);
        await ctx.bewaar(() => bewaarAlle(ctx.db, 'transactions', bijgewerkt));
        await bewaarRegelsMetTellers(ctx, regels, pasToe(alleTx, bijgewerkt));
        ctx.meldingen.toonInfo(`${veranderd} transacties veranderden van categorie.`);
        ctx.herlaad();
      },
    }, 'Alles herclassificeren'));

  const lijst = el('ul', { class: 'regel-lijst' });
  for (const regel of regels) {
    const actiefVak = el('input', {
      type: 'checkbox',
      checked: regel.active,
      onchange: async () => {
        await ctx.bewaar(() => bewaar(ctx.db, 'rules', { ...regel, active: actiefVak.checked }));
        ctx.herlaad();
      },
    });
    const klasseKeuze = keuzelijst(
      [['', 'Klasse: automatisch'], ...KLASSEN.map((k) => [k, k])],
      regel.costClass === null ? '' : regel.costClass,
      async () => {
        const waarde = klasseKeuze.value;
        await ctx.bewaar(() => bewaar(ctx.db, 'rules',
          { ...regel, costClass: waarde === '' ? null : waarde }));
        ctx.herlaad();
      });
    lijst.append(el('li', { class: 'regel-rij' },
      el('span', {}, `${regel.priority}. ${regelOmschrijving(regel)}`),
      el('span', {}, `→ ${categorieNaam(catMap, regel.categoryId)} · ${regel.hitCount} transacties`),
      klasseKeuze,
      el('label', {}, actiefVak, 'actief'),
      el('button', {
        'aria-label': 'Regel omhoog',
        onclick: async () => {
          await ctx.bewaar(() => bewaarAlle(ctx.db, 'rules', verplaatsRegel(regels, regel.id, -1)));
          ctx.herlaad();
        },
      }, '↑'),
      el('button', {
        'aria-label': 'Regel omlaag',
        onclick: async () => {
          await ctx.bewaar(() => bewaarAlle(ctx.db, 'rules', verplaatsRegel(regels, regel.id, 1)));
          ctx.herlaad();
        },
      }, '↓'),
      el('button', {
        onclick: async () => {
          if (!ctx.bevestig(`Regel "${regel.value}" verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return;
          await verwijder(ctx.db, 'rules', regel.id);
          const losgekoppeld = alleTx.filter((tx) => tx.ruleId === regel.id)
            .map((tx) => ({ ...tx, ruleId: null }));
          await ctx.bewaar(() => bewaarAlle(ctx.db, 'transactions', losgekoppeld));
          ctx.herlaad();
        },
      }, 'Verwijder')));
  }
  wortel.append(lijst);

  // Herkende vaste kosten: de app wijzigt nooit klassen zonder bevestiging.
  wortel.append(el('h2', {}, 'Herkende vaste kosten'));
  const openKandidaten = kandidaten.filter((k) => k.status === 'kandidaat');
  if (openKandidaten.length === 0) {
    wortel.append(el('p', { class: 'klein' }, 'Geen nieuwe kandidaten.'));
  }
  for (const kandidaat of openKandidaten) {
    wortel.append(el('div', { class: 'kandidaat' },
      el('span', {}, `${kandidaat.naam} · ${kandidaat.frequentie} · ` +
        `${formatteerCenten(kandidaat.mediaanCents)} ` +
        `(${formatteerCenten(kandidaat.maandbedragCents)} per maand)`),
      el('button', {
        class: 'primair',
        onclick: async () => {
          await ctx.bewaar(() => bewaar(ctx.db, 'recurringCandidates',
            { ...kandidaat, status: 'bevestigd' }));
          const bijgewerkt = alleTx.filter((tx) => kandidaat.txIds.includes(tx.id))
            .map((tx) => ({ ...tx, costClass: 'vast', manualClass: true }));
          await ctx.bewaar(() => bewaarAlle(ctx.db, 'transactions', bijgewerkt));
          ctx.herlaad();
        },
      }, 'Bevestig als vaste kost'),
      el('button', {
        onclick: async () => {
          await ctx.bewaar(() => bewaar(ctx.db, 'recurringCandidates',
            { ...kandidaat, status: 'verworpen' }));
          ctx.herlaad();
        },
      }, 'Verwerp')));
  }
}
