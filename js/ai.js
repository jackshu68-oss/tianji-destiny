/* Same-origin AI interpretation UI. The API key remains on the server. */
(function () {
  'use strict';

  function isEnglish() {
    return window.TianjiUI && TianjiUI.getLanguage() === 'en';
  }

  function copy(chinese, english) {
    return isEnglish() ? english : chinese;
  }

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
    head.appendChild(element('b', '', copy('AI 深度解读', 'AI DEEP INTERPRETATION')));
    head.appendChild(element('em', '', payload.cached ? copy('已使用缓存，不重复消耗额度', 'Cached result, no duplicate token use') : copy('本次新生成', 'Newly generated')));
    target.appendChild(head);

    if (analysis.overview) {
      const section = element('section', 'ai-result-section');
      section.appendChild(element('h5', '', copy('核心判断', 'Core view')));
      section.appendChild(element('p', '', analysis.overview));
      target.appendChild(section);
    }
    listSection(target, copy('排盘依据', 'Chart evidence'), analysis.evidence);
    listSection(target, copy('现实表现', 'In practice'), analysis.reality);
    listSection(target, copy('当前时机', 'Current timing'), analysis.timing || analysis.stages);
    listSection(target, copy('风险提示', 'Risks and limits'), analysis.risks);
    listSection(target, copy('行动建议', 'Actions'), analysis.actions);

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

  function billingHeaders() {
    return window.TianjiBilling ? window.TianjiBilling.authHeaders() : {};
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
          headers: billingHeaders(),
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
          headers: Object.assign({ 'Content-Type': 'application/json' }, billingHeaders()),
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

  function mountQuestion(container, options) {
    if (!container) return;
    container.replaceChildren();
    const form = element('div', 'ai-question-form');
    const textarea = element('textarea');
    textarea.maxLength = 300;
    textarea.placeholder = copy('例如：未来三个月，我在工作上更适合主动争取，还是先整理现有项目？', 'For example: Over the next three months, should I actively pursue a new role or consolidate my current projects?');
    textarea.setAttribute('aria-label', copy('输入命盘问题', 'Enter a chart question'));
    form.appendChild(textarea);

    const suggestions = element('div', 'ai-question-suggestions');
    (isEnglish() ? [
      'What should I prioritise at work over the next three months?',
      'What matters most in my relationship communication?',
      'Is this a time to expand or consolidate?'
    ] : [
      '未来三个月的工作重点是什么？',
      '我在关系沟通上最需要注意什么？',
      '目前适合扩大投入还是先稳住？'
    ]).forEach(text => {
      const suggestion = element('button', '', text);
      suggestion.type = 'button';
      suggestion.addEventListener('click', () => { textarea.value = text; textarea.focus(); });
      suggestions.appendChild(suggestion);
    });
    form.appendChild(suggestions);

    const button = element('button', 'ai-question-submit', copy('根据我的命盘回答', 'Answer from my chart'));
    button.type = 'button';
    form.appendChild(button);
    const privacy = element('p', 'ai-privacy', copy('只有本次问题及上方列明的命盘依据会发送至香港服务器；不会读取命盘库、日历备注或其他装置资料。', 'Only this question and the chart evidence listed above are sent to the Hong Kong server. Chart libraries, calendar notes and other device data are not read.'));
    const output = element('div', 'ai-output');
    output.setAttribute('aria-live', 'polite');
    container.appendChild(form);
    container.appendChild(privacy);
    container.appendChild(output);

    button.addEventListener('click', async () => {
      const question = textarea.value.trim();
      const chartContext = options && typeof options.getContext === 'function' ? options.getContext() : '';
      if (question.length < 6) {
        output.className = 'ai-output error';
        output.textContent = copy('请把问题写得更具体一些，例如说明时间范围或现实选项。', 'Make the question more specific by adding a time range or real-world options.');
        return;
      }
      if (String(chartContext).length < 40) {
        output.className = 'ai-output error';
        output.textContent = copy('请先生成命盘，再使用 AI 命盘问答。', 'Create a chart before using AI chart Q&A.');
        return;
      }
      button.disabled = true;
      button.textContent = copy('正在根据命盘整理…', 'Reviewing your chart...');
      output.className = 'ai-output loading';
      output.textContent = copy('正在提交问题并检查命盘依据。', 'Submitting the question and checking chart evidence.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 115000);
      try {
        const requestOptions = { title: `AI命盘问答 · ${question}` };
        const context = `用户问题：${question}\n\n确定性命盘资料：\n${chartContext}`.slice(0, 12000);
        const payload = await generateInterpretation(requestOptions, context, controller.signal, output);
        output.className = 'ai-output ready';
        renderResult(output, payload);
        button.textContent = payload.cached ? copy('已回答 · 使用缓存', 'Answered · cached') : copy('重新提问', 'Ask again');
      } catch (error) {
        output.className = 'ai-output error';
        output.textContent = error.name === 'AbortError' ? '等待时间已到，后台任务可能仍在处理。稍后再按一次会优先读取已完成结果。' : (error.message || 'AI 服务暂时不可用，请稍后重试。');
        button.textContent = copy('重新尝试', 'Try again');
      } finally {
        clearTimeout(timer);
        button.disabled = false;
      }
    });
  }

  function mountReport(container, options) {
    if (!container) return null;
    container.replaceChildren();

    const panel = element('div', 'ai-insight ai-report-insight');
    const sourceTitle = element('div', 'ai-report-source-title');
    sourceTitle.appendChild(element('b', '', copy('本次报告资料', 'Sources for this report')));
    sourceTitle.appendChild(element('span', '', copy('已生成的结果会纳入，未生成的项目会清楚标示。', 'Generated results are included; unavailable modules are clearly marked.')));
    panel.appendChild(sourceTitle);
    const sourcesNode = element('div', 'ai-report-sources');
    panel.appendChild(sourcesNode);

    const intro = element('div', 'ai-intro ai-report-intro');
    const introCopy = element('div');
    introCopy.appendChild(element('span', 'ai-label', 'DEEPSEEK · LOCAL KNOWLEDGE'));
    introCopy.appendChild(element('h4', '', copy('生成综合全盘报告', 'Generate an integrated chart report')));
    introCopy.appendChild(element('p', '', copy('只保留一种清晰报告格式：先列共同主题和依据，再说分歧、时机、风险与未来 30 天行动。', 'One clear format: shared themes and evidence first, followed by differences, timing, risks and 30-day actions.')));
    intro.appendChild(introCopy);
    const button = element('button', 'ai-generate ai-report-generate', copy('生成综合全盘报告', 'Generate integrated report'));
    button.type = 'button';
    intro.appendChild(button);
    panel.appendChild(intro);
    panel.appendChild(element('p', 'ai-privacy', copy('点击后，仅会把上方已生成结果的摘要发送至香港服务器的 DeepSeek 接口；不包含姓名、出生日期、城市、命盘库备注或其他浏览器资料。', 'After you click, only summaries of the generated results above are sent to the DeepSeek endpoint on the Hong Kong server. Names, birth dates, cities, chart-library notes and unrelated browser data are excluded.')));
    const output = element('div', 'ai-output ai-report-output');
    output.setAttribute('aria-live', 'polite');
    panel.appendChild(output);
    container.appendChild(panel);

    function refreshSources() {
      const sources = options && typeof options.getSources === 'function' ? options.getSources() : [];
      sourcesNode.replaceChildren();
      sources.forEach(source => {
        const item = element('span', `ai-source-chip ${source.ready ? 'ready' : 'missing'}`);
        item.appendChild(element('i', '', source.ready ? '✓' : '−'));
        item.appendChild(element('b', '', source.label));
        item.appendChild(element('em', '', source.ready ? copy('已纳入', 'Included') : copy('未生成', 'Not generated')));
        sourcesNode.appendChild(item);
      });
    }

    refreshSources();
    button.addEventListener('click', async () => {
      refreshSources();
      const context = options && typeof options.getContext === 'function' ? String(options.getContext() || '') : '';
      if (context.length < 80) {
        output.className = 'ai-output ai-report-output error';
        output.textContent = copy('请先生成命盘，再建立综合报告。', 'Create a chart before generating an integrated report.');
        return;
      }
      button.disabled = true;
      button.textContent = copy('正在整合全盘…', 'Integrating all results...');
      output.className = 'ai-output ai-report-output loading';
      output.textContent = copy('正在整理各模块的共同主题、分歧与时间尺度。', 'Organising shared themes, differences and time horizons across the available modules.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 115000);
      try {
        const payload = await generateInterpretation({ title: '综合全盘分析报告' }, context.slice(0, 12000), controller.signal, output);
        output.className = 'ai-output ai-report-output ready';
        renderResult(output, payload);
        button.textContent = payload.cached ? copy('已生成 · 使用缓存', 'Generated · cached') : copy('重新生成报告', 'Regenerate report');
      } catch (error) {
        output.className = 'ai-output ai-report-output error';
        output.textContent = error.name === 'AbortError'
          ? copy('本页等待时间已到，但服务器任务不会因此中断。稍后再按一次即可读取结果。', 'This page stopped waiting, but the server task continues. Press again shortly to retrieve the result.')
          : (error.message || copy('AI 服务暂时不可用，请稍后重试。', 'AI is temporarily unavailable. Please try again shortly.'));
        button.textContent = copy('重新尝试', 'Try again');
      } finally {
        clearTimeout(timer);
        button.disabled = false;
      }
    });

    return { refreshSources };
  }

  window.TianjiAI = { mount, mountQuestion, mountReport };
})();
