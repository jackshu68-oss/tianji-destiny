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

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function requestError(message, retryable) {
    const error = new Error(message);
    error.retryable = Boolean(retryable);
    return error;
  }

  async function readApiResponse(response) {
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch (_error) {
      throw requestError('服务器连接被中途打断，正在尝试重新连接。', true);
    }
    if (!response.ok || !payload.ok) {
      throw requestError(payload.message || `AI 服务返回错误（${response.status}）`, response.status >= 500);
    }
    return payload;
  }

  async function pollJob(jobId, signal, output, firstWait) {
    const deadline = Date.now() + 105000;
    let delay = Math.max(800, Number(firstWait) || 1600);
    let transientFailures = 0;

    while (Date.now() < deadline) {
      await wait(delay);
      try {
        const response = await fetch(`/api/ai/result/${encodeURIComponent(jobId)}`, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal
        });
        const payload = await readApiResponse(response);
        transientFailures = 0;
        if (response.status === 202 || payload.pending) {
          delay = Math.max(800, Number(payload.poll_after_ms) || 1600);
          continue;
        }
        return payload;
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        const retryable = error.retryable || error instanceof TypeError;
        transientFailures += 1;
        if (!retryable || transientFailures > 5) throw error;
        output.textContent = '手机网络有短暂波动，正在重新连接后台任务，生成不会中断。';
        delay = Math.min(3500, 1200 + transientFailures * 400);
      }
    }
    throw requestError('AI 仍在后台处理，但本页等待时间已到。请稍后再按一次，系统会优先读取已完成的结果。', false);
  }

  async function generateInterpretation(options, context, signal, output) {
    const body = JSON.stringify({ title: options.title || '传统术数详解', context });
    let payload;
    let lastError;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch('/api/ai/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          signal,
          body
        });
        payload = await readApiResponse(response);
        break;
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        lastError = error;
        const retryable = error.retryable || error instanceof TypeError;
        if (!retryable || attempt === 1) throw error;
        output.textContent = '正在重新连接服务器，已提交的任务不会重复生成。';
        await wait(1200);
      }
    }

    if (!payload) throw lastError || requestError('AI 任务未能建立，请稍后重试。', false);
    if (!payload.pending) return payload;

    output.textContent = 'AI 已接单，正在后台生成。即使手机网络短暂中断，服务器也会继续处理。';
    return pollJob(payload.job_id, signal, output, payload.poll_after_ms);
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
      output.textContent = '正在提交 AI 详解任务。';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 115000);
      try {
        const payload = await generateInterpretation(options, context, controller.signal, output);
        output.className = 'ai-output ready';
        renderResult(output, payload);
        button.textContent = payload.cached ? '已生成 · 使用缓存' : '重新生成';
      } catch (error) {
        output.className = 'ai-output error';
        output.textContent = error.name === 'AbortError'
          ? '本页等待时间已到，但服务器任务不会因此中断。请稍后再按一次读取结果。'
          : (error.message || 'AI 服务暂时不可用，请稍后重试。');
        button.textContent = '重新尝试';
      } finally {
        clearTimeout(timer);
        button.disabled = false;
      }
    });
  }

  window.TianjiAI = { mount };
})();
