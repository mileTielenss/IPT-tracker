// Importflow: preview, bevestiging, wegschrijven en nazorg (spec 3 en 5).
import { el } from '../dom.js';
import { decodeerCsv } from '../csv.js';
import { verwerkBestand, continuiteitsWaarschuwing, eigenRekeningKandidaten } from '../import.js';
import { alles, bewaar, bewaarAlle, haalInstelling, bewaarInstelling } from '../db.js';
import { herclassificeer } from '../rules.js';
import { pasToe, bewaarRegelsMetTellers, verversVasteKosten, zetInterneStatus } from '../flows.js';
import { formatteerCenten, formatteerDatum } from '../format.js';

function korteNaam(tx) {
  if (tx.counterpartyName !== '') return tx.counterpartyName;
  if (tx.merchant !== '') return tx.merchant;
  return tx.description.slice(0, 40);
}

export async function importeerBestand(ctx, bestand) {
  const tekst = decodeerCsv(await bestand.arrayBuffer());
  const bestaande = await alles(ctx.db, 'transactions');
  const resultaat = await verwerkBestand(tekst, bestaande.map((tx) => tx.id));
  if (!resultaat.geldig) {
    ctx.meldingen.toonBanner('import-fout', el('div', { class: 'banner fout' },
      el('p', {}, resultaat.foutmelding),
      el('p', { class: 'klein' }, `Gevonden kolomkoppen: ${resultaat.gevondenHeader}`),
      el('button', { onclick: () => ctx.meldingen.verwijderBanner('import-fout') }, 'Sluiten')));
    return;
  }
  const { preview } = resultaat;
  const overlay = el('div', { class: 'overlay' });
  overlay.append(el('div', { class: 'dialoog' },
    el('h2', {}, 'Import bevestigen'),
    el('p', {}, `${preview.aantal} rijen: ${resultaat.nieuwe.length} nieuw, ` +
      `${resultaat.dubbel} dubbel, ${resultaat.foutief} foutief.`),
    preview.datumVan === null ? null
      : el('p', {}, `Periode: ${formatteerDatum(preview.datumVan)} – ${formatteerDatum(preview.datumTot)}`),
    el('ul', {}, preview.eersteVijf.map((tx) => el('li', {},
      `${formatteerDatum(tx.bookingDate)} · ${korteNaam(tx)} · ${formatteerCenten(tx.amountCents)}`))),
    el('button', {
      class: 'primair',
      onclick: async () => {
        overlay.remove();
        await voerImportUit(ctx, resultaat, bestaande);
      },
    }, 'Importeren'),
    el('button', { onclick: () => overlay.remove() }, 'Annuleren')));
  ctx.doc.body.append(overlay);
}

async function voerImportUit(ctx, resultaat, bestaande) {
  const eigen = new Set((await alles(ctx.db, 'ownAccounts')).map((r) => r.iban));
  const regels = await alles(ctx.db, 'rules');
  let nieuwe = resultaat.nieuwe.map((tx) => ({ ...tx, isInternal: eigen.has(tx.counterpartyIban) }));
  nieuwe = pasToe(nieuwe, herclassificeer(regels, nieuwe).bijgewerkt);
  await ctx.bewaar(() => bewaarAlle(ctx.db, 'transactions', nieuwe));
  let alleTx = [...bestaande, ...nieuwe];
  await bewaarRegelsMetTellers(ctx, regels, alleTx);
  alleTx = await verversVasteKosten(ctx, alleTx);
  const waarschuwing = continuiteitsWaarschuwing(bestaande, nieuwe);
  if (waarschuwing !== null) {
    ctx.meldingen.toonBanner('continuiteit', el('div', { class: 'banner waarschuwing' },
      el('p', {}, waarschuwing),
      el('button', { onclick: () => ctx.meldingen.verwijderBanner('continuiteit') }, 'Sluiten')));
  }
  ctx.meldingen.toonInfo(`Import klaar: ${nieuwe.length} nieuw, ` +
    `${resultaat.dubbel} dubbel, ${resultaat.foutief} foutief.`);
  const verworpen = await haalInstelling(ctx.db, 'verworpenEigenIbans', []);
  const kandidaten = eigenRekeningKandidaten(nieuwe, resultaat.houderNaam,
    new Set([...eigen, ...verworpen]));
  if (kandidaten.length > 0) toonEigenRekeningVoorstel(ctx, kandidaten);
  ctx.herlaad();
}

// De app stelt kandidaten voor; de gebruiker bevestigt of verwerpt per
// kandidaat en de app voegt nooit zelf een IBAN toe (spec 5).
function toonEigenRekeningVoorstel(ctx, kandidaten) {
  const banner = el('div', { class: 'banner voorstel' },
    el('p', {}, el('strong', {}, 'Is dit een rekening van de zaak?')),
    el('p', { class: 'klein' },
      'Overschrijvingen tussen rekeningen van de vennootschap zelf (bv. een spaarrekening) ' +
      'tellen niet mee als omzet of kosten. Is dit je privérekening? Kies dan "Nee, privé" — ' +
      'loon dat je naar privé overschrijft blijft dan gewoon een kost van de zaak.'));
  for (const kandidaat of kandidaten) {
    const rij = el('div', { class: 'voorstel-rij' },
      el('span', {}, `${kandidaat.iban} (${kandidaat.naam})`),
      el('div', { class: 'banner-acties' },
        el('button', {
          class: 'primair',
          onclick: async () => {
            await ctx.bewaar(() => bewaar(ctx.db, 'ownAccounts',
              { iban: kandidaat.iban, label: kandidaat.naam }));
            await zetInterneStatus(ctx, kandidaat.iban, true);
            rij.remove();
            ctx.herlaad();
          },
        }, 'Ja, rekening van de zaak'),
        el('button', {
          onclick: async () => {
            const lijst = await haalInstelling(ctx.db, 'verworpenEigenIbans', []);
            await ctx.bewaar(() => bewaarInstelling(ctx.db, 'verworpenEigenIbans',
              [...lijst, kandidaat.iban]));
            rij.remove();
          },
        }, 'Nee, privé')));
    banner.append(rij);
  }
  banner.append(el('button', { onclick: () => ctx.meldingen.verwijderBanner('eigen-rekening') }, 'Sluiten'));
  ctx.meldingen.toonBanner('eigen-rekening', banner);
}
