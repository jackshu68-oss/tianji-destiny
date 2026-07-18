/* Same-origin AI interpretation UI. The API key remains on the server. */
(function () {
  'use strict';

  function cleanText(html) {
    const node = document.createElement('div');
    node.innerHTML = html || '';
    return (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12000);
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function listSection(parent, title, items) {
    if (!Array.isArray(items) || !items.length) return;
    const section = element('section', 'ai-result-section');
    section.appendChild(element('h5', '', title));
    const list = element('ul', 'ai-result-list');
    items.forEach(item => list.appendChild(element('li', '', String(item))));
    section.appendChild(list);
    parent.appendChild(section);
  }

  function renderResult(target, payload) {
    target.replaceChildren();
    const analysis = payload.analysis || {};
    const head = element('div', 'ai-result-head');
    head.appendChild(element('span', 'ai-live-dot'));
    head.appendChild(element('b', '', 'AI 深度解读'));
    head.appendChild(element('em', '', payload.cached ? '已使用缓存，不重复消耗额度' : '本次新生成'));
    target.appendChild(head);

    if (analysis.overview) {
      const section = element('section', 'ai-result-section');
      section.appendChild(element('h5', '', '核心判断'));
      section.appendChild(element('p', '', analysis.overview));
      target.appendChild(section);
    }
    listSection(target, '排盘依据', analysis.evidence);
    listSection(target, '阶段与变化', analysis.stages);
    listSection(target, '现实建议', analysis.actions);

    if (analysis.caveat) target.appendChild(element('p', 'ai-caveat', analysis.caveat));
    const meta = element('div', 'ai-result-meta');
    const tokens = payload.usage && payload.usage.total_tokens ? ` · ${payload.usage.total_tokens} tokens` : '';
    meta.textContent = `${payload.model || 'DeepSeek'}${tokens}`;
    target.appendChild(meta);
  }

  function mount(container, options) {
    if (!container) return;
    const existing = container.querySelector('.ai-insight');
    if (existing) existing.remove();
    const context = cleanText(options && options.body);
    if (context.length < 40 || /请先.+(?:生成|测算|加载)/.test(context)) return;

    const panel = element('div', 'ai-insight');
    const intro = element('div', 'ai-intro');
    const copy = element('div');
    copy.appendChild(element('span', 'ai-label', 'DEEPSEEK · 本地知识增强'));
    copy.appendChild(element('h4', '', '让 AI 继续拆解这份结果'));
    copy.appendChild(element('p', '', '排盘数据不会由 AI 重算。它只依据上面的确定性结果，补充关系、阶段与现实行动建议。'));
    intro.appendChild(copy);

    const button = element('button', 'ai-generate', '生成 AI 智能详解');
    button.type = 'button';
    intro.appendChild(button);
    panel.appendChild(intro);
    panel.appendChild(element('p', 'ai-privacy', '点击后，本次详解文本会发送至香港服务器的 DeepSeek 接口；不会读取或上传浏览器中的其他命盘。'));
    const output = element('div', 'ai-output');
    output.setAttribute('aria-live', 'polite');
    panel.appendChild(output);
    container.appendChild(panel);

    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = '正在综合分析...';
      output.className = 'ai-output loading';
      output.textContent = '正在核对排盘依据并组织详解，通常需要数秒。';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 55000);
      try {
        const response = await fetch('/api/ai/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          signal: controller.signal,
          body: JSON.stringify({ title: options.title || '传统术数详解', context })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(payload.message || 'AI 暂时没有返回结果');
        output.className = 'ai-output ready';
        renderResult(output, payload);
        button.textContent = payload.cached ? '已生成 · 使用缓存' : '重新生成';
      } catch (error) {
        output.className = 'ai-output error';
        output.textContent = error.name === 'AbortError' ? 'AI 响应超时，请稍后再试。' : (error.message || 'AI 服务暂时不可用。');
        button.textContent = '重新尝试';
      } finally {
        clearTimeout(timer);
        button.disabled = false;
      }
    });
  }

  window.TianjiAI = { mount };
})();
