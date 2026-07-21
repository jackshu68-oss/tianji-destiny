(function () {
  'use strict';

  const current = document.querySelector('meta[name="app-build"]')?.content || '';
  if (!current || typeof fetch !== 'function') return;

  fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' })
    .then(response => response.ok ? response.json() : null)
    .then(payload => {
      const latest = payload && String(payload.build || '').trim();
      if (!latest || latest === current) return;
      const url = new URL(location.href);
      if (url.searchParams.get('build') === latest) return;
      url.searchParams.set('build', latest);
      location.replace(url.toString());
    })
    .catch(() => {});
})();
