(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const code = String(params.get('code') || '').trim().toUpperCase();
  const loading = document.getElementById('shared-loading');
  const result = document.getElementById('shared-result');
  const errorBox = document.getElementById('shared-error');

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function showError() {
    loading.classList.add('hidden');
    result.classList.add('hidden');
    errorBox.classList.remove('hidden');
  }

  async function loadShare() {
    if (!/^[A-Z2-9]{8,24}$/.test(code)) { showError(); return; }
    try {
      const response = await fetch(`/api/share/${encodeURIComponent(code)}`, { cache: 'no-store', credentials: 'same-origin' });
      const body = await response.json();
      if (!response.ok || !body.ok || !body.payload) throw new Error('NOT_FOUND');
      const payload = body.payload;
      document.getElementById('shared-code').textContent = `分享码 ${code} · 有效至 ${body.expires_at}`;
      const core = document.getElementById('shared-core');
      core.replaceChildren();
      (payload.core || []).forEach(item => {
        const article = node('article');
        article.appendChild(node('span', '', item.label));
        article.appendChild(node('h2', '', item.conclusion));
        article.appendChild(node('p', '', item.action));
        core.appendChild(article);
      });
      const today = payload.today || {};
      const todayCard = document.getElementById('shared-today');
      todayCard.replaceChildren(node('span', '', `今日节奏 · ${today.level || '观察'}`), node('h2', '', today.best || '按现实条件稳步安排'), node('p', '', `避免：${today.avoid || '信息不足时仓促决定'}`), node('small', '', today.reminder || '趋势不代表确定事件。'));
      loading.classList.add('hidden');
      result.classList.remove('hidden');
    } catch (_error) {
      showError();
    }
  }

  loadShare();
})();
