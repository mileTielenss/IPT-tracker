// Meldingen: banners (zoals de updatebalk) en korte infoberichten.
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

  function toonInfo(tekst, ms = 6000) {
    const balk = el('div', { class: 'toast' }, tekst);
    toastWortel.append(balk);
    setTimeout(() => balk.remove(), ms);
  }

  return { toonBanner, verwijderBanner, toonInfo };
}
