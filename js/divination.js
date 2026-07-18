/* 梅花易数与奇门遁甲页面交互。计算和解释均在本地浏览器完成。 */
(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  let meihuaMethod = 'time';
  let lastMeihua = null;
  let lastQimen = null;
  let lastQimenMeta = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[char]);
  }
  function pad(value) { return String(value).padStart(2, '0'); }
  function nowLocalValue() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function parseWallClock(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || '');
    if (!match) throw new Error('请选择完整日期和时间');
    const p = match.slice(1).map(Number);
    const date = new Date(p[0], p[1]-1, p[2], p[3], p[4], 0);
    if (date.getFullYear() !== p[0] || date.getMonth() !== p[1]-1 || date.getDate() !== p[2]) throw new Error('日期无效，请重新选择');
    return date;
  }
  function toast(message) {
    let node = $('#toast');
    if (!node) {
      node = document.createElement('div'); node.id = 'toast'; node.className = 'toast'; document.body.appendChild(node);
    }
    node.textContent = message; node.classList.add('show');
    clearTimeout(node._timer); node._timer = setTimeout(() => node.classList.remove('show'), 2800);
  }
  function detail(title, body) {
    if (window.TianjiDetail && typeof window.TianjiDetail.open === 'function') window.TianjiDetail.open(title, body);
  }
  function source(type) { return window.TianjiKnowledge ? TianjiKnowledge.sourceBadge(type) : ''; }
  function section(title, html) { return `<div class="dm-sec"><h4>${title}</h4>${html}</div>`; }
  function list(items) { return `<ul class="dm-ul">${items.map(item => `<li>${item}</li>`).join('')}</ul>`; }

  function hexagramLines(hexagram, movingLine) {
    const rows = [];
    for (let index = 5; index >= 0; index--) {
      const yang = hexagram.code[index] === '1';
      rows.push(`<div class="gua-line ${yang ? 'yang' : 'yin'} ${movingLine === index + 1 ? 'moving' : ''}">
        <span class="line-no">${index + 1}</span><i></i><i></i>${movingLine === index + 1 ? '<b>动</b>' : ''}
      </div>`);
    }
    return rows.join('');
  }
  function hexagramCard(label, hexagram, movingLine) {
    return `<div class="gua-card">
      <div class="gua-label">${label}</div>
      <div class="gua-name">${esc(hexagram.name)}</div>
      <div class="gua-lines">${hexagramLines(hexagram, movingLine)}</div>
      <div class="gua-meta">上${hexagram.upperTrigram.name}${hexagram.upperTrigram.element} · 下${hexagram.lowerTrigram.name}${hexagram.lowerTrigram.element}</div>
      <div class="gua-nature">${esc(hexagram.nature)}</div>
    </div>`;
  }

  function initMeihua() {
    $('#mh-datetime').value = nowLocalValue();
    $$('[data-mh-method]').forEach(button => button.addEventListener('click', () => {
      meihuaMethod = button.dataset.mhMethod;
      $$('[data-mh-method]').forEach(item => item.classList.toggle('active', item === button));
      $('#mh-number-pair').classList.toggle('hidden', meihuaMethod !== 'number_pair');
    }));
    $('#btn-meihua').addEventListener('click', runMeihua);
    $('#mh-result').addEventListener('click', event => {
      if (event.target.closest('[data-mh-detail]') && lastMeihua) detail('梅花易数 · 完整详解', buildMeihuaDetail(lastMeihua));
    });
  }
  function runMeihua() {
    try {
      const result = MeihuaEngine.calculate({
        question: $('#mh-question').value,
        date: $('#mh-datetime').value,
        method: meihuaMethod,
        numbers: [Number($('#mh-number-a').value), Number($('#mh-number-b').value)]
      });
      lastMeihua = result;
      renderMeihua(result);
    } catch (error) {
      toast(error.message || '起卦失败，请检查输入');
    }
  }
  function renderMeihua(result) {
    const outcomeClass = result.judgement.outcome === '吉' ? 'good' : result.judgement.outcome === '凶' ? 'bad' : 'flat';
    const phaseNames = { use:'初段',body_mutual:'中段 · 体互',use_mutual:'中段 · 用互',changed:'后段' };
    $('#mh-result').innerHTML = `
      <div class="reading-summary ${outcomeClass}">
        <div class="reading-mark">${result.judgement.outcome}</div>
        <div><p>${esc(result.question)}</p><h3>${esc(result.judgement.summary)}</h3><span>${esc(result.meta.methodLabel)} · ${esc(result.ganZhi)}</span></div>
      </div>
      ${result.warning ? `<div class="reading-warning">${esc(result.warning)}</div>` : ''}
      <div class="gua-grid">
        ${hexagramCard('本卦 · 起因', result.mainHexagram, result.movingLine)}
        ${hexagramCard('互卦 · 过程', result.nuclearHexagram, null)}
        ${hexagramCard('变卦 · 后势', result.changedHexagram, null)}
      </div>
      <div class="body-use-grid">
        <div class="body-use-item"><span>体卦 · 自身</span><b>${result.bodyTrigram.symbol} ${result.bodyTrigram.name}${result.bodyTrigram.element}</b><em>月令${result.seasonalState.body}</em></div>
        <div class="body-use-arrow">${esc(result.bodyUseRelation.relation)}</div>
        <div class="body-use-item"><span>用卦 · 所问之事</span><b>${result.useTrigram.symbol} ${result.useTrigram.name}${result.useTrigram.element}</b><em>月令${result.seasonalState.use}</em></div>
      </div>
      <div class="phase-list">${result.interactionReadings.map(reading => `<div class="phase-item ${reading.favorable ? 'good' : 'bad'}"><span>${phaseNames[reading.stage]}</span><b>${esc(reading.relation)}</b><p>${esc(reading.summary)}</p></div>`).join('')}</div>
      <button type="button" class="detail-action" data-mh-detail>查看完整依据与 AI 逐段详解</button>
      ${source('meihua')}`;
    $('#mh-result').classList.remove('hidden');
    setTimeout(() => $('#mh-result').scrollIntoView({ behavior:'smooth', block:'start' }), 60);
  }
  function buildMeihuaDetail(result) {
    const relationText = TianjiKnowledge.MEIHUA_RELATION[result.bodyUseRelation.relation] || result.bodyUseRelation.summary;
    const phaseNames = { use:'初段 · 本卦体用',body_mutual:'中段 · 体互',use_mutual:'中段 · 用互',changed:'后段 · 变卦' };
    return section('问题与起卦依据', `<p><b>${esc(result.question)}</b></p><p>${esc(result.meta.methodLabel)}（${esc(result.meta.methodFamily)}）：${result.meta.inputs.map(esc).join('，')}；动爻为第 <b>${result.movingLine}</b> 爻。</p><p>干支：${esc(result.ganZhi)}</p>`)
      + section('三层卦象', list([
        `<b>本卦 ${result.mainHexagram.name}</b>：主题为“${result.mainHexagram.nature}”。${TianjiKnowledge.hexagramAction(result.mainHexagram.nature)}`,
        `<b>互卦 ${result.nuclearHexagram.name}</b>：反映事情内部结构与中段变化，主题为“${result.nuclearHexagram.nature}”。${TianjiKnowledge.hexagramAction(result.nuclearHexagram.nature)}`,
        `<b>变卦 ${result.changedHexagram.name}</b>：第${result.movingLine}爻变化后的后势，主题为“${result.changedHexagram.nature}”。${TianjiKnowledge.hexagramAction(result.changedHexagram.nature)}`,
        `<b>错卦 ${result.oppositeHexagram.name}</b>、<b>综卦 ${result.reversedHexagram.name}</b>：用于观察对立条件与换位视角，不单独作为吉凶结论。`
      ]))
      + section('体用主轴', `<p>体卦为 <b>${result.bodyTrigram.name}${result.bodyTrigram.element}</b>，代表自身或事情主体；用卦为 <b>${result.useTrigram.name}${result.useTrigram.element}</b>，代表环境或所问之事。当前为“<b>${result.bodyUseRelation.relation}</b>”：${relationText}</p>`)
      + section('月令旺衰', `<p>当前月支为 <b>${result.seasonalState.monthBranch}</b>。体卦为“<b>${result.seasonalState.body}</b>”：${TianjiKnowledge.SEASON[result.seasonalState.body]}；用卦为“<b>${result.seasonalState.use}</b>”：${TianjiKnowledge.SEASON[result.seasonalState.use]}。</p>`)
      + section('阶段推演', list(result.interactionReadings.map(reading => `<b>${phaseNames[reading.stage]}</b>：${reading.summary}`)))
      + section(`综合判断 · ${result.judgement.outcome}`, `<p>${esc(result.judgement.summary)}</p>${list(result.judgement.basis.map(esc))}`)
      + section('现实校验', `<p>先把卦象对应到可验证的问题：谁掌握资源、何时发生、有哪些约束、最小可行动作是什么。若现实信息与象义冲突，应以现实证据为准。</p>`)
      + source('meihua');
  }

  function initQimen() {
    $('#qm-datetime').value = nowLocalValue();
    $('#btn-qimen').addEventListener('click', runQimen);
    $('#qm-result').addEventListener('click', event => {
      const palace = event.target.closest('[data-qm-gong]');
      if (palace && lastQimen) detail(`${palace.dataset.qmGong}宫 · 奇门详解`, buildQimenPalaceDetail(lastQimen, palace.dataset.qmGong));
      if (event.target.closest('[data-qm-detail]') && lastQimen) detail('奇门遁甲 · 全局详解', buildQimenDetail(lastQimen, lastQimenMeta));
    });
  }
  function runQimen() {
    const question = $('#qm-question').value.trim();
    if (!question) { toast('请先写下要问的事情'); return; }
    try {
      const date = parseWallClock($('#qm-datetime').value);
      const purpose = $('#qm-purpose').value;
      const result = QimenCore.calculate(date, { method:'时家', type:'转盘', purpose, location:'本地时间' });
      if (!result || result.error) throw new Error(result && result.message ? result.message : '排局失败');
      lastQimen = result; lastQimenMeta = { question, purpose, date };
      renderQimen(result, lastQimenMeta);
    } catch (error) {
      console.error(error); toast(error.message || '排局失败，请检查时间');
    }
  }
  function luckClass(value) {
    if (value === 'da_ji' || value === 'xiao_ji' || value === 'ji') return 'good';
    if (value === 'da_xiong' || value === 'xiao_xiong' || value === 'xiong') return 'bad';
    return 'flat';
  }
  function palaceBadges(pan, gong) {
    const badges = [];
    if (String(pan.zhiFuGong) === gong) badges.push('<i class="key">值符</i>');
    if (String(pan.zhiShiGong) === gong) badges.push('<i class="key">值使</i>');
    if ((pan.kongWangGong || []).map(String).includes(gong)) badges.push('<i>空亡</i>');
    if (pan.maStar && String(pan.maStar.gong) === gong) badges.push('<i>驿马</i>');
    return badges.join('');
  }
  function palaceCard(pan, gong) {
    const item = pan.jiuGongAnalysis[gong] || {};
    const empty = gong === '5';
    return `<button type="button" class="qimen-palace ${luckClass(item.jiXiong)}" data-qm-gong="${gong}">
      <span class="palace-head"><b>${esc(item.gongName || QimenCore.JIU_GONG[gong].name)}${gong}</b><em>${esc(item.direction || QimenCore.JIU_GONG[gong].direction)}</em></span>
      <span class="palace-badges">${palaceBadges(pan, gong)}</span>
      <span class="palace-main"><strong>${esc(pan.baShen[gong] || '—')}</strong><strong>${esc(pan.jiuXing[gong] || (empty ? '天禽' : '—'))}</strong><strong>${esc(pan.baMen[gong] || '—')}</strong></span>
      <span class="palace-stems"><em>天 ${esc(pan.tianPan[gong] || '—')}</em><em>地 ${esc(pan.diPan[gong] || '—')}</em><em>暗 ${esc(pan.anGan[gong] || '—')}</em></span>
      <span class="palace-luck">${esc(item.jiXiongText || '平')}</span>
    </button>`;
  }
  function renderQimen(pan, meta) {
    const order = ['4','9','2','3','5','7','8','1','6'];
    const overall = pan.analysis || {};
    $('#qm-result').innerHTML = `
      <div class="reading-summary ${luckClass(overall.overallJiXiong)}">
        <div class="reading-mark">${esc(overall.overallJiXiongText || '平')}</div>
        <div><p>${esc(meta.question)}</p><h3>${esc(pan.juShu.fullName)}</h3><span>${esc(pan.siZhu.year)} · ${esc(pan.siZhu.month)} · ${esc(pan.siZhu.day)} · ${esc(pan.siZhu.time)}</span></div>
      </div>
      <div class="qimen-keyfacts">
        <div><span>节气</span><b>${esc(pan.juShu.jieQiName)}</b></div><div><span>旬首</span><b>${esc(pan.xunShou)}</b></div>
        <div><span>值符</span><b>${esc(pan.zhiFuXing)} · ${esc(pan.zhiFuGong)}宫</b></div><div><span>值使</span><b>${esc(pan.zhiShiMen)} · ${esc(pan.zhiShiGong)}宫</b></div>
      </div>
      <div class="qimen-board">${order.map(gong => palaceCard(pan, gong)).join('')}</div>
      <div class="rule-reading"><span>规则综合解读</span><p>${esc(overall.overallAnalysis || overall.summary || (overall.suggestions || []).slice(0,2).join(' ') || '请结合值符、值使及相关宫位查看。')}</p></div>
      <button type="button" class="detail-action" data-qm-detail>查看全局格局、用神与 AI 详解</button>
      ${source('qimen')}`;
    $('#qm-result').classList.remove('hidden');
    setTimeout(() => $('#qm-result').scrollIntoView({ behavior:'smooth', block:'start' }), 60);
  }
  function buildQimenPalaceDetail(pan, gong) {
    const item = pan.jiuGongAnalysis[gong] || {};
    const statuses = [];
    if (item.kongWang) statuses.push('空亡：该宫吉凶力量减弱，事情可能落空、延迟或需要补条件。');
    if (item.yiMa) statuses.push('驿马：变动、出行、迁移或节奏加快的象较明显。');
    if (item.menPo) statuses.push('门迫：门克宫，吉门减力、凶门更需谨慎。');
    if (!statuses.length) statuses.push('本宫未见空亡、驿马或门迫的额外标记。');
    const cleanExplain = String(item.explain || '').replace(/\(\)/g, '');
    return section(`${esc(item.gongName)}${gong}宫 · ${esc(item.direction)}`, `<p>综合等级：<b>${esc(item.jiXiongText || '平')}</b>。${esc(cleanExplain)}</p>`)
      + section('星 · 门 · 神', list([
        `<b>${esc(item.xing || '无星')}</b>${item.xingAlias ? `（${esc(item.xingAlias)}）` : ''}：${esc(item.xingFeature || '结合宫位五行参看。')}`,
        `<b>${esc(item.men || '中宫无门')}</b>：${esc(item.menFeature || '中宫寄宫参看。')}`,
        `<b>${esc(item.shen || '无神')}</b>：${esc(item.shenFeature || '结合全局参看。')}`
      ]))
      + section('天地盘与克应', `<p>天盘 <b>${esc(item.tianGan || '—')}</b> 加地盘 <b>${esc(item.diGan || '—')}</b>${item.anGan ? `，暗干 <b>${esc(item.anGan)}</b>` : ''}。${item.keYing ? `形成“<b>${esc(item.keYing.name)}</b>”：${esc(item.keYing.explain)}` : '本宫未触发单独列示的十干克应。'}</p>`)
      + section('宫位状态', list(statuses.map(esc)))
      + section('五行关系', `<p>星宫关系：<b>${esc(item.xingGongRel || '—')}</b>；门宫关系：<b>${esc(item.menGongRel || '—')}</b>。应结合所问事项与用神所在宫共同判断，不以单宫直接代替整盘。</p>`)
      + source('qimen');
  }
  function buildQimenDetail(pan, meta) {
    const overall = pan.analysis || {};
    const formations = (pan.geju || []).map(item => `<b>${esc(item.name)}</b>（${item.jiXiong === 'ji' ? '吉' : item.jiXiong === 'xiong' ? '凶' : '平'}）${item.gong ? ` · ${esc(item.gong)}宫` : ''}：${esc(item.explain || '')}`);
    const suggestions = (overall.suggestions || []).map(esc);
    const focus = TianjiKnowledge.QIMEN_PURPOSE[meta.purpose] || TianjiKnowledge.QIMEN_PURPOSE.综合;
    return section('问事与盘面', `<p><b>${esc(meta.question)}</b></p><p>${esc(pan.juShu.fullName)}，四柱 ${esc(pan.siZhu.year)}、${esc(pan.siZhu.month)}、${esc(pan.siZhu.day)}、${esc(pan.siZhu.time)}；旬首 <b>${esc(pan.xunShou)}</b>。</p>`)
      + section(`${esc(meta.purpose)}取用`, `<p>${esc(focus)}</p>${overall.yongShen ? `<p>本盘规则取用：<b>${esc(typeof overall.yongShen === 'string' ? overall.yongShen : JSON.stringify(overall.yongShen))}</b></p>` : ''}`)
      + section('值符与值使', `<p>值符星为 <b>${esc(pan.zhiFuXing)}</b>，落 ${esc(pan.zhiFuGong)} 宫，代表大局趋势与主要资源；值使门为 <b>${esc(pan.zhiShiMen)}</b>，落 ${esc(pan.zhiShiGong)} 宫，代表执行路径与事情落点。</p>`)
      + section('全局格局', formations.length ? list(formations) : '<p>本盘未触发单独列示的全局格局，宜回到值符、值使和用神宫判断。</p>')
      + section('规则建议', suggestions.length ? list(suggestions) : `<p>${esc(overall.overallAnalysis || '结合相关宫位谨慎判断。')}</p>`)
      + section('使用边界', `<p>奇门盘提供的是结构化观察框架。涉及健康、法律、投资或人身安全时，必须以专业意见和现实证据为准。</p>`)
      + source('qimen');
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (window.MeihuaEngine) initMeihua();
    if (window.QimenCore) initQimen();
  });
})();
