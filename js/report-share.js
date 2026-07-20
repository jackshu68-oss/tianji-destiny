/* Local report-image export and mobile sharing. Report content never leaves the browser unless the user shares it. */
(function (root) {
  'use strict';

  const SUPPORT_EMAIL = 'jackshu68@gmail.com';
  const AUTO_TARGETS = [
    '#astrology-result',
    '#rectify-result',
    '#comparison-result',
    '#backtest-result',
    '#zj-result',
    '#hh-result',
    '#mh-result',
    '#qm-result',
    '#tarot-result',
    '#lenormand-result',
    '#shared-result',
    '.ai-output.ready',
    '.dm-body'
  ];
  const TITLES = {
    'astrology-result': ['太阳星座报告', 'Sun Sign Report'],
    'rectify-result': ['出生时辰校正结果', 'Birth-Time Review'],
    'comparison-result': ['选项比较结果', 'Option Comparison'],
    'backtest-result': ['事件回测结果', 'Event Backtest'],
    'zj-result': ['择吉结果', 'Date Selection Results'],
    'hh-result': ['两人关系图谱', 'Relationship Report'],
    'mh-result': ['梅花易数结果', 'Meihua Reading'],
    'qm-result': ['奇门遁甲结果', 'Qimen Reading'],
    'tarot-result': ['塔罗牌结果', 'Tarot Reading'],
    'lenormand-result': ['雷诺曼结果', 'Lenormand Reading'],
    'shared-result': ['个人洞察摘要', 'Personal Insight Summary']
  };

  let observer = null;
  let scanTimer = null;
  let previewUrl = '';

  function isEnglish() {
    return root.TianjiUI && TianjiUI.getLanguage() === 'en';
  }

  function phrase(chinese, english) {
    return isEnglish() ? english : chinese;
  }

  function reportTitle(target, fallback) {
    if (fallback) return fallback;
    if (target.dataset.reportShareTitleZh || target.dataset.reportShareTitleEn) {
      return isEnglish() ? (target.dataset.reportShareTitleEn || target.dataset.reportShareTitleZh) : (target.dataset.reportShareTitleZh || target.dataset.reportShareTitleEn);
    }
    if (target.id && TITLES[target.id]) return isEnglish() ? TITLES[target.id][1] : TITLES[target.id][0];
    if (target.classList.contains('dm-body')) {
      const modalTitle = document.querySelector('#detail-modal .dm-title');
      if (modalTitle && modalTitle.textContent.trim()) return modalTitle.textContent.trim();
    }
    if (target.classList.contains('ai-output')) {
      const panelTitle = target.closest('.ai-insight') && target.closest('.ai-insight').querySelector('h4');
      if (panelTitle && panelTitle.textContent.trim()) return panelTitle.textContent.trim();
      return phrase('AI 详细报告', 'AI Detailed Report');
    }
    return phrase('个人洞察报告', 'Personal Insight Report');
  }

  function safeFilename(title) {
    const clean = String(title || phrase('个人报告', 'Personal Report'))
      .replace(/[\\/:*?"<>|\s]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 42) || 'DAOFA_Report';
    const date = new Date().toISOString().slice(0, 10);
    return `${clean}_${date}.png`;
  }

  function toast(message) {
    let node = document.getElementById('report-share-toast');
    if (!node) {
      node = document.createElement('div');
      node.id = 'report-share-toast';
      node.className = 'report-share-toast';
      node.setAttribute('role', 'status');
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('show'), 3200);
  }

  function setBusy(target, busy) {
    const actions = directActions(target);
    if (!actions) return;
    actions.classList.toggle('is-busy', busy);
    actions.querySelectorAll('button').forEach(button => { button.disabled = busy; });
  }

  function directActions(target) {
    return Array.from(target.children || []).find(child => child.classList && child.classList.contains('report-share-actions')) || null;
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function updateActionCopy(actions) {
    if (!actions) return;
    const label = actions.querySelector('.report-share-label');
    const save = actions.querySelector('[data-report-save]');
    const wechat = actions.querySelector('[data-report-wechat]');
    setText(label, phrase('分享这份结果', 'Share this result'));
    if (save) {
      setText(save.lastChild, phrase('保存图片', 'Save image'));
      save.title = phrase('保存高清报告图片', 'Save a high-resolution report image');
      save.setAttribute('aria-label', save.title);
    }
    if (wechat) {
      setText(wechat.lastChild, phrase('微信分享', 'Share'));
      wechat.title = phrase('将报告图片分享到微信', 'Share the report image');
      wechat.setAttribute('aria-label', wechat.title);
    }
  }

  function contentReady(target) {
    if (!target || !target.isConnected) return false;
    if (target.classList.contains('hidden')) return false;
    if (target.parentElement && target.parentElement.closest('.hidden')) return false;
    if (target.closest('.detail-modal.hidden')) return false;
    if (target.querySelector('.empty-state') && target.textContent.trim().length < 180) return false;
    const clone = target.cloneNode(true);
    clone.querySelectorAll('.report-share-actions').forEach(node => node.remove());
    return (clone.textContent || '').replace(/\s+/g, '').length >= 28;
  }

  function attach(target, options) {
    if (!contentReady(target)) return null;
    const existing = directActions(target);
    if (existing) {
      if (options && options.title) target.dataset.reportShareTitleZh = options.title;
      updateActionCopy(existing);
      return existing;
    }
    if (options && options.title) target.dataset.reportShareTitleZh = options.title;
    if (options && options.titleEn) target.dataset.reportShareTitleEn = options.titleEn;

    const actions = document.createElement('div');
    actions.className = 'report-share-actions';
    actions.dataset.noReportShare = 'true';

    const label = document.createElement('span');
    label.className = 'report-share-label';
    actions.appendChild(label);

    const save = document.createElement('button');
    save.type = 'button';
    save.dataset.reportSave = 'true';
    save.innerHTML = '<i aria-hidden="true">↓</i><span></span>';
    save.addEventListener('click', () => saveImage(target, { title: reportTitle(target) }));
    actions.appendChild(save);

    const wechat = document.createElement('button');
    wechat.type = 'button';
    wechat.dataset.reportWechat = 'true';
    wechat.innerHTML = '<i aria-hidden="true">↗</i><span></span>';
    wechat.addEventListener('click', () => shareImage(target, { title: reportTitle(target) }));
    actions.appendChild(wechat);

    target.appendChild(actions);
    updateActionCopy(actions);
    return actions;
  }

  function sanitiseClone(clone) {
    const selectors = [
      '.report-share-actions', '.ai-intro', '.ai-privacy', '.ai-access-actions',
      '.dm-trigger', '.detail-action', '.res-toolbar', '.share-pop', '.date-nav',
      '.form-error', '.compute-loader', '[data-no-report-share]'
    ];
    clone.querySelectorAll(selectors.join(',')).forEach(node => node.remove());
    clone.querySelectorAll('.hidden').forEach(node => node.remove());
    clone.querySelectorAll('details').forEach(node => { node.open = true; });
    clone.querySelectorAll('button').forEach(button => {
      button.disabled = true;
      button.tabIndex = -1;
    });
    clone.querySelectorAll('input, select, textarea').forEach(control => control.remove());
    clone.querySelectorAll('.ai-insight').forEach(panel => {
      if (!(panel.textContent || '').replace(/\s+/g, '')) panel.remove();
    });
    clone.removeAttribute('id');
    clone.classList.remove('hidden');
    clone.classList.add('report-export-content');
  }

  function createExportCard(target, title) {
    const stage = document.createElement('div');
    stage.className = 'report-export-stage';
    stage.dataset.theme = root.TianjiUI ? TianjiUI.getTheme() : (document.documentElement.dataset.theme || 'modern');

    const card = document.createElement('article');
    card.className = 'report-export-card';

    const header = document.createElement('header');
    header.className = 'report-export-header';
    const brand = document.createElement('div');
    brand.innerHTML = '<b>道法自然</b><span>DAOFA</span>';
    const heading = document.createElement('div');
    const kicker = document.createElement('span');
    kicker.textContent = phrase('个人洞察报告', 'PERSONAL INSIGHT REPORT');
    const name = document.createElement('h1');
    name.textContent = title;
    heading.append(kicker, name);
    header.append(brand, heading);

    const clone = target.cloneNode(true);
    sanitiseClone(clone);

    const footer = document.createElement('footer');
    footer.className = 'report-export-footer';
    const boundary = document.createElement('p');
    boundary.textContent = phrase('传统文化研究、自我观察与娱乐参考，不替代专业意见。', 'For traditional-culture study, self-reflection and entertainment; not professional advice.');
    const details = document.createElement('p');
    details.textContent = `${new Date().toLocaleString(isEnglish() ? 'en-CA' : 'zh-CN')} · daofainsight.com · ${phrase('客服', 'Support')} ${SUPPORT_EMAIL}`;
    footer.append(boundary, details);

    card.append(header, clone, footer);
    stage.appendChild(card);
    document.body.appendChild(stage);
    return { stage, card };
  }

  async function renderImage(target, options) {
    if (!target || typeof root.html2canvas !== 'function') throw new Error(phrase('图片组件尚未加载，请刷新后重试。', 'The image component has not loaded. Refresh and try again.'));
    const title = reportTitle(target, options && options.title);
    setBusy(target, true);
    const generated = createExportCard(target, title);
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const width = Math.max(720, generated.card.scrollWidth);
      const height = Math.max(500, generated.card.scrollHeight);
      const maxPixels = 12500000;
      const scale = Math.max(1, Math.min(2, Math.sqrt(maxPixels / (width * height))));
      const background = generated.stage.dataset.theme === 'classic' ? '#0a0b0f' : '#f4f0e7';
      const canvas = await root.html2canvas(generated.card, {
        backgroundColor: background,
        scale,
        useCORS: true,
        logging: false,
        imageTimeout: 12000,
        windowWidth: 760
      });
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG_FAILED')), 'image/png', 0.96));
      return { blob, title, filename: safeFilename(title) };
    } finally {
      generated.stage.remove();
      setBusy(target, false);
    }
  }

  function buildFile(image) {
    try { return new File([image.blob], image.filename, { type: 'image/png', lastModified: Date.now() }); }
    catch (_error) { return image.blob; }
  }

  function canShareFile(file) {
    return Boolean(typeof File !== 'undefined' && navigator.share && navigator.canShare && file instanceof File && navigator.canShare({ files: [file] }));
  }

  function isWechat() {
    return /MicroMessenger/i.test(navigator.userAgent || '');
  }

  function needsImagePreview() {
    return isWechat() || /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }

  function download(image) {
    const url = URL.createObjectURL(image.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = image.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function closePreview() {
    const modal = document.getElementById('report-share-preview');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('report-preview-open');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = '';
    }
  }

  function ensurePreview() {
    let modal = document.getElementById('report-share-preview');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'report-share-preview';
    modal.className = 'report-share-preview hidden';
    modal.innerHTML = `
      <div class="report-preview-backdrop" data-report-preview-close></div>
      <section class="report-preview-panel" role="dialog" aria-modal="true" aria-labelledby="report-preview-title">
        <header><div><span>DAOFA</span><h2 id="report-preview-title"></h2></div><button type="button" data-report-preview-close aria-label="关闭" title="关闭">×</button></header>
        <p class="report-preview-hint"></p>
        <div class="report-preview-image"><img alt="" /></div>
        <p class="report-preview-privacy"></p>
        <div class="report-preview-actions"><a download><i aria-hidden="true">↓</i><span></span></a><button type="button" data-preview-share><i aria-hidden="true">↗</i><span></span></button></div>
      </section>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-report-preview-close]').forEach(node => node.addEventListener('click', closePreview));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closePreview(); });
    return modal;
  }

  function showPreview(image, shareRequested) {
    const modal = ensurePreview();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(image.blob);
    const img = modal.querySelector('img');
    img.src = previewUrl;
    img.alt = image.title;
    modal.querySelector('#report-preview-title').textContent = image.title;
    modal.querySelector('.report-preview-hint').textContent = isWechat()
      ? phrase('请长按下方报告图片保存，再发送给微信好友或朋友圈。', 'Press and hold the image to save it, then send it in WeChat.')
      : phrase('图片已经生成。你可以下载原图，或使用系统分享面板发送。', 'Your image is ready. Download it or use the system share sheet.');
    modal.querySelector('.report-preview-privacy').textContent = phrase('分享前请检查图片是否包含你不希望公开的个人资料。', 'Before sharing, check the image for personal details you do not want to disclose.');
    const downloadLink = modal.querySelector('.report-preview-actions a');
    downloadLink.href = previewUrl;
    downloadLink.download = image.filename;
    downloadLink.querySelector('span').textContent = phrase('下载原图', 'Download image');
    const shareButton = modal.querySelector('[data-preview-share]');
    const file = buildFile(image);
    shareButton.hidden = !canShareFile(file);
    shareButton.querySelector('span').textContent = phrase('系统分享', 'Share');
    shareButton.onclick = async () => {
      try {
        await navigator.share({ title: image.title, text: phrase('道法自然生成的个人报告', 'Personal report generated by DAOFA'), files: [file] });
      } catch (error) {
        if (error && error.name !== 'AbortError') toast(phrase('系统分享没有完成，请下载图片后发送。', 'Sharing did not finish. Download the image and send it manually.'));
      }
    };
    modal.classList.remove('hidden');
    document.body.classList.add('report-preview-open');
    if (shareRequested && isWechat()) toast(phrase('微信内请长按报告图片保存。', 'Press and hold the report image to save it.'));
  }

  async function saveImage(target, options) {
    try {
      toast(phrase('正在生成高清报告图片…', 'Creating a high-resolution report image...'));
      const image = await renderImage(target, options || {});
      if (needsImagePreview()) showPreview(image, false);
      else {
        download(image);
        toast(phrase('报告图片已保存。', 'Report image saved.'));
      }
    } catch (error) {
      console.error(error);
      toast(error && error.message ? error.message : phrase('生成图片失败，请重试。', 'Could not create the image. Try again.'));
    }
  }

  async function shareImage(target, options) {
    try {
      toast(phrase('正在准备微信分享图片…', 'Preparing the report image...'));
      const image = await renderImage(target, options || {});
      const file = buildFile(image);
      if (canShareFile(file)) {
        try {
          await navigator.share({ title: image.title, text: phrase('道法自然生成的个人报告', 'Personal report generated by DAOFA'), files: [file] });
          return;
        } catch (error) {
          if (error && error.name === 'AbortError') return;
        }
      }
      showPreview(image, true);
    } catch (error) {
      console.error(error);
      toast(error && error.message ? error.message : phrase('分享图片生成失败，请重试。', 'Could not prepare the share image. Try again.'));
    }
  }

  function injectSupport() {
    if (document.querySelector('.support-mail-button')) return;
    const link = document.createElement('a');
    link.className = 'support-mail-button';
    link.href = new URL('/support/', root.location.origin).href;
    link.title = phrase('客服联系', 'Support');
    link.setAttribute('aria-label', link.title);
    link.innerHTML = `<span aria-hidden="true">@</span><b>${phrase('客服', 'Support')}</b>`;
    document.body.appendChild(link);
  }

  function scan() {
    AUTO_TARGETS.forEach(selector => document.querySelectorAll(selector).forEach(target => attach(target)));
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 30);
  }

  function refreshCopy() {
    document.querySelectorAll('.report-share-actions').forEach(updateActionCopy);
    const support = document.querySelector('.support-mail-button');
    if (support) {
      support.title = phrase('客服联系', 'Support');
      support.setAttribute('aria-label', support.title);
      setText(support.querySelector('b'), phrase('客服', 'Support'));
    }
  }

  function init() {
    injectSupport();
    scan();
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('tianji:language-changed', () => { refreshCopy(); scheduleScan(); });
  }

  root.TianjiReportShare = { attach, save: saveImage, share: shareImage, supportEmail: SUPPORT_EMAIL, supportPage: '/support/' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
