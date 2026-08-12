// Meldingen: banners, undo-toasts en de rode foutbalk met retry (spec 11.5).
import { el } from './dom.js';

export function maakMeldingen(bannerWortel, toastWortel) {
  const banners = new Map();

  function toonBanner(id, element) {
    verwijderBanner(id);
    banners.set(id, element);
    bannerWortel.append(element);
  }

  function verwijderBanner(id) {
    const bestaand = banners.get(id);
    if (bestaand !== undefined) {
      bestaand.remove();
      banners.delete(id);
    }
  }

  // Undo-toast van circa zes seconden voor frequente omkeerbare acties.
  function toonUndo(tekst, opUndo, ms = 6000) {
    const timer = setTimeout(sluit, ms);
    const balk = el('div', { class: 'toast' }, el('span', {}, tekst),
      el('button', { onclick: () => { sluit(); opUndo(); } }, 'Ongedaan maken'));
    function sluit() {
      clearTimeout(timer);
      balk.remove();
    }
    toastWortel.append(balk);
    return sluit;
  }

  function toonInfo(tekst, ms = 6000) {
    const balk = el('div', { class: 'toast info' }, tekst);
    toastWortel.append(balk);
    setTimeout(() => balk.remove(), ms);
  }

  // Rode balk die blijft staan tot de retry-knop wordt gebruikt.
  function toonFout(tekst, opnieuw) {
    const balk = el('div', { class: 'fout-balk' }, el('span', {}, tekst),
      el('button', { onclick: () => { balk.remove(); opnieuw(); } }, 'Opnieuw proberen'));
    toastWortel.append(balk);
  }

  return { toonBanner, verwijderBanner, toonUndo, toonInfo, toonFout };
}

// Blijf een schrijfactie herhalen tot ze slaagt; falen is zichtbaar, slagen stil.
export async function metRetry(actie, meldingen) {
  for (;;) {
    try {
      return await actie();
    } catch {
      await new Promise((klaar) => {
        meldingen.toonFout('Opslaan is mislukt. Maak ruimte vrij of herstart de app en probeer opnieuw.', klaar);
      });
    }
  }
}
