// Hash-routing tussen de hoofdschermen (spec 11.1).

export function parseHash(hash) {
  const zonder = hash.replace(/^#\/?/, '');
  const [pad, queryDeel] = zonder.split('?');
  const query = {};
  if (queryDeel !== undefined) {
    for (const paar of queryDeel.split('&')) {
      const [sleutel, waarde] = paar.split('=');
      query[sleutel] = decodeURIComponent(waarde ?? '');
    }
  }
  const delen = pad.split('/').filter((d) => d !== '');
  if (delen[0] === 'transactie' && delen.length > 1) {
    return { naam: 'transactie', id: delen[1], query };
  }
  if (['prognose', 'transacties', 'regels', 'instellingen', 'werklijst'].includes(delen[0])) {
    return { naam: delen[0], query };
  }
  return { naam: 'dashboard', query };
}

export function startRouter(venster, handler) {
  const voerUit = () => handler(parseHash(venster.location.hash));
  venster.addEventListener('hashchange', voerUit);
  voerUit();
}
