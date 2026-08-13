// Categoriekeuze voor één transactie: alleen deze, of via een nieuwe regel
// (spec 6.3), plus de suggestieflow uit de herkenningslijst (spec 6.4).
import { el, keuzelijst } from '../dom.js';
import { alles, bewaar, bewaarAlle } from '../db.js';
import { ONGECATEGORISEERD, categorieNaam } from '../categories.js';
import { REGEL_VELDEN, MATCH_TYPES, VELD_NAMEN, MATCH_TYPE_NAMEN, regelMatcht, voegRegelToe, herclassificeer, voorstelRegelVeld } from '../rules.js';
import { suggereerCategorie } from '../suggestions.js';
import { pasToe, bewaarRegelsMetTellers } from '../flows.js';

// Maakt een regel aan, past hem direct toe op alle niet-handmatige
// transacties en werkt de hitCounts bij.
export async function maakRegel(ctx, regelVelden, alleTx) {
  const nieuweRegel = {
    id: crypto.randomUUID(),
    costClass: null,
    priority: 0,
    active: true,
    hitCount: 0,
    ...regelVelden,
  };
  const regels = voegRegelToe(await alles(ctx.db, 'rules'), nieuweRegel);
  const { bijgewerkt } = herclassificeer(regels, alleTx);
  await ctx.bewaar(() => bewaarAlle(ctx.db, 'transactions', bijgewerkt));
  await bewaarRegelsMetTellers(ctx, regels, pasToe(alleTx, bijgewerkt));
  return bijgewerkt.length;
}

export async function maakRegelVoorTransactie(ctx, tx, categoryId, alleTx) {
  const voorstel = voorstelRegelVeld(tx);
  return maakRegel(ctx, {
    field: voorstel.field,
    matchType: voorstel.field === 'counterpartyIban' ? 'equals' : 'contains',
    value: voorstel.value,
    categoryId,
  }, alleTx);
}

async function alleenDeze(ctx, tx, categoryId, naKlaar) {
  const nieuw = { ...tx, categoryId, manualCategory: categoryId !== null, ruleId: null };
  await ctx.bewaar(() => bewaar(ctx.db, 'transactions', nieuw));
  ctx.meldingen.toonUndo('Categorie aangepast.', async () => {
    await ctx.bewaar(() => bewaar(ctx.db, 'transactions', tx));
    naKlaar();
  });
  naKlaar();
}

function regelFormulier(ctx, tx, categoryId, alleTx, naKlaar) {
  const voorstel = voorstelRegelVeld(tx);
  const stand = {
    field: voorstel.field,
    matchType: voorstel.field === 'counterpartyIban' ? 'equals' : 'contains',
    value: voorstel.value,
  };
  const teller = el('span', { class: 'klein' });
  function telRaak() {
    const aantal = alleTx.filter((t) => !t.manualCategory && regelMatcht(stand, t)).length;
    teller.textContent = `Deze regel raakt ${aantal} bestaande transacties.`;
  }
  const veldKeuze = keuzelijst(REGEL_VELDEN.map((v) => [v, VELD_NAMEN[v]]), stand.field, () => {
    stand.field = veldKeuze.value;
    telRaak();
  });
  const typeKeuze = keuzelijst(MATCH_TYPES.map((t) => [t, MATCH_TYPE_NAMEN[t]]), stand.matchType, () => {
    stand.matchType = typeKeuze.value;
    telRaak();
  });
  const waardeInvoer = el('input', {
    type: 'text',
    value: stand.value,
    oninput: () => {
      stand.value = waardeInvoer.value;
      telRaak();
    },
  });
  telRaak();
  return el('div', { class: 'regel-formulier' },
    veldKeuze, typeKeuze, waardeInvoer, teller,
    el('button', {
      class: 'primair',
      onclick: async () => {
        const aantal = await maakRegel(ctx, { ...stand, categoryId }, alleTx);
        ctx.meldingen.toonInfo(`Regel aangemaakt; ${aantal} transacties bijgewerkt.`);
        naKlaar();
      },
    }, 'Regel bevestigen'));
}

// Paneel met categoriekiezer en de keuze "alleen deze" of "regel aanmaken".
export function categoriePaneel(ctx, tx, categorieen, alleTx, naKlaar) {
  const paneel = el('div', { class: 'categorie-paneel' });
  const opties = [['', '(ongecategoriseerd)'], ...categorieen
    .filter((c) => c.type === tx.direction && c.id !== ONGECATEGORISEERD)
    .map((c) => [c.id, c.name])];
  const vervolg = el('div', {});
  const kiezer = keuzelijst(opties, tx.categoryId ?? '', () => {
    const keuze = kiezer.value;
    vervolg.textContent = '';
    if (keuze === '') {
      alleenDeze(ctx, tx, null, naKlaar);
      return;
    }
    vervolg.append(
      el('button', { onclick: () => alleenDeze(ctx, tx, keuze, naKlaar) }, 'Alleen deze transactie'),
      el('button', { onclick: () => {
        vervolg.textContent = '';
        vervolg.append(regelFormulier(ctx, tx, keuze, alleTx, naKlaar));
      } }, 'Regel aanmaken'),
      el('span', { class: 'klein' },
        'Een regel categoriseert ook alle volgende gelijkaardige transacties automatisch.'));
  });
  paneel.append(kiezer, vervolg);
  return paneel;
}

// Suggestie met één bevestigingsknop en één knop "Andere categorie".
export function suggestieVoorstel(ctx, tx, categorieen, catMap, alleTx, naKlaar) {
  const categoryId = suggereerCategorie(tx);
  const paneel = el('div', { class: 'suggestie' });
  const anders = () => {
    paneel.textContent = '';
    paneel.append(categoriePaneel(ctx, tx, categorieen, alleTx, naKlaar));
  };
  if (categoryId === null) {
    anders();
    return paneel;
  }
  paneel.append(
    el('p', {}, `Suggestie: ${categorieNaam(catMap, categoryId)}`),
    el('button', {
      class: 'primair',
      onclick: async () => {
        const aantal = await maakRegelVoorTransactie(ctx, tx, categoryId, alleTx);
        ctx.meldingen.toonInfo(`Regel aangemaakt; ${aantal} transacties bijgewerkt.`);
        naKlaar();
      },
    }, 'Bevestig suggestie'),
    el('button', { onclick: anders }, 'Andere categorie'));
  return paneel;
}
