// Gedeelde dataflows: regels toepassen, tellers bijwerken, vaste kosten
// verversen, interne status en eenmalig-markering aanpassen.
import { alles, bewaar, bewaarAlle, leegStore } from './db.js';
import { telHits } from './rules.js';
import { detecteerVasteKosten, voegKandidatenSamen } from './recurring.js';

// Bijgewerkte kopieën terug in de volledige lijst schuiven.
export function pasToe(alleTx, bijgewerkt) {
  const kaart = new Map(bijgewerkt.map((tx) => [tx.id, tx]));
  return alleTx.map((tx) => kaart.get(tx.id) ?? tx);
}

export async function bewaarRegelsMetTellers(ctx, regels, alleTx) {
  await ctx.bewaar(() => bewaarAlle(ctx.db, 'rules', telHits(regels, alleTx)));
}

// Detectie draait na elke import; bevestigde reeksen krijgen (ook voor
// nieuwe leden) de klasse-overschrijving vast (spec 10).
export async function verversVasteKosten(ctx, alleTx) {
  const bestaand = await alles(ctx.db, 'recurringCandidates');
  const samengevoegd = voegKandidatenSamen(bestaand, await detecteerVasteKosten(alleTx));
  await ctx.bewaar(async () => {
    await leegStore(ctx.db, 'recurringCandidates');
    await bewaarAlle(ctx.db, 'recurringCandidates', samengevoegd);
  });
  const bevestigdeIds = new Set(samengevoegd
    .filter((k) => k.status === 'bevestigd')
    .flatMap((k) => k.txIds));
  const bijgewerkt = alleTx
    .filter((tx) => bevestigdeIds.has(tx.id) && !(tx.costClass === 'vast' && tx.manualClass))
    .map((tx) => ({ ...tx, costClass: 'vast', manualClass: true }));
  if (bijgewerkt.length > 0) {
    await ctx.bewaar(() => bewaarAlle(ctx.db, 'transactions', bijgewerkt));
  }
  return pasToe(alleTx, bijgewerkt);
}

// Eigen rekening toegevoegd of verwijderd: interne vlag met terugwerkende
// kracht bijwerken (spec 5).
export async function zetInterneStatus(ctx, iban, waarde) {
  const alleTx = await alles(ctx.db, 'transactions');
  const bijgewerkt = alleTx
    .filter((tx) => tx.counterpartyIban === iban && tx.isInternal !== waarde)
    .map((tx) => ({ ...tx, isInternal: waarde }));
  if (bijgewerkt.length > 0) {
    await ctx.bewaar(() => bewaarAlle(ctx.db, 'transactions', bijgewerkt));
  }
}

// Eenmalig markeren of ontmarkeren: frequent en omkeerbaar, dus undo-toast.
export async function zetEenmalig(ctx, tx, waarde) {
  await ctx.bewaar(() => bewaar(ctx.db, 'transactions', { ...tx, isOneOff: waarde }));
  ctx.meldingen.toonUndo(
    waarde ? 'Gemarkeerd als eenmalig.' : 'Eenmalig-markering verwijderd.',
    async () => {
      await ctx.bewaar(() => bewaar(ctx.db, 'transactions', tx));
      ctx.herlaad();
    },
  );
  ctx.herlaad();
}
