/* Personal dashboard, library, calendar and decision tools. */
(function () {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const KEYS = {
    library: 'tianji_profiles_v2', events: 'tianji_events_v1', backtests: 'tianji_backtests_v1',
    ui: 'tianji_workspace_ui_v1', sync: 'tianji_sync_meta_v1', shares: 'tianji_share_records_v1'
  };
  const state = {
    chart: null, profile: null, analysis: null, ziwei: null,
    calendarDate: new Date(), selectedDate: null, editingProfileId: null
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_error) {
      notify('本机存储空间不足，请先导出备份或清理浏览器资料。');
      return false;
    }
  }

  function notify(message) {
    if (window.TianjiApp && TianjiApp.toast) TianjiApp.toast(message);
  }

  function makeId(prefix) {
    const bytes = new Uint8Array(8);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else bytes.forEach((_value, index) => { bytes[index] = Math.floor(Math.random() * 256); });
    return `${prefix}_${Array.from(bytes).map(value => value.toString(16).padStart(2, '0')).join('')}`;
  }

  function profileFingerprint(profile) {
    return [profile.y, profile.m, profile.d, profile.h == null ? 'x' : profile.h, profile.mi || 0, profile.gender].join('-');
  }

  function loadLibrary() { return read(KEYS.library, []); }
  function loadEvents() { return read(KEYS.events, []); }
  function loadBacktests() { return read(KEYS.backtests, []); }
  function loadShares() { return read(KEYS.shares, []); }

  function ensureFirstProfile() {
    if (!state.profile) return;
    const library = loadLibrary();
    const fingerprint = profileFingerprint(state.profile);
    const existing = library.find(item => item.fingerprint === fingerprint);
    if (existing) {
      existing.data = state.profile;
      existing.updatedAt = new Date().toISOString();
      write(KEYS.library, library);
      return;
    }
    if (!library.length) {
      library.push({
        id: makeId('profile'), fingerprint, nickname: '我的命盘', relation: '本人', note: '',
        data: state.profile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      });
      write(KEYS.library, library);
    }
  }

  function switchTab(name, shouldScroll) {
    $$('.workspace-tab, .mobile-workspace-nav button').forEach(button => button.classList.toggle('active', button.dataset.wsTab === name));
    $$('.workspace-panel').forEach(panel => panel.classList.toggle('hidden', panel.dataset.wsPanel !== name));
    const ui = read(KEYS.ui, {});
    ui.tab = name;
    write(KEYS.ui, ui);
    if (shouldScroll && $('#insight-workspace')) $('#insight-workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setMode(mode) {
    const professional = mode === 'professional';
    document.body.classList.toggle('professional-mode', professional);
    $$('.mode-btn').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
    const details = $('details.professional-details');
    if (details) details.open = professional;
    const ui = read(KEYS.ui, {});
    ui.mode = mode;
    write(KEYS.ui, ui);
  }

  function renderDashboard() {
    const today = TianjiEngine.dailyFortune(state.chart, Solar.fromYmd(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()));
    const decision = TianjiProfile.dailyDecision(today);
    const month = TianjiPlanner.monthWindows(state.chart, new Date(), 1)[0];
    const year = TianjiPlanner.yearCards(state.chart, new Date().getFullYear(), 1)[0];
    $('#dashboard-profile-name').textContent = activeProfileName();
    $('#dashboard-cards').innerHTML = `
      <article class="dashboard-card dashboard-today">
        <span>今天 · ${escapeHtml(decision.level)}</span><h3>${escapeHtml(decision.best)}</h3>
        <p>${escapeHtml(decision.reminder)}</p><small>避免：${escapeHtml(decision.avoid)}</small>
      </article>
      <article class="dashboard-card">
        <span>本月 · ${escapeHtml(month.ganZhi)} ${escapeHtml(month.god)}</span><h3>${escapeHtml(month.level)}</h3>
        <p>${escapeHtml(month.best)}</p><small>${escapeHtml(month.watch)}</small>
      </article>
      <article class="dashboard-card">
        <span>今年 · ${escapeHtml(year.ganZhi)} ${escapeHtml(year.god)}</span><h3>${escapeHtml(year.theme)}</h3>
        <p>${escapeHtml(year.career)}</p><small>${escapeHtml(year.relation)}</small>
      </article>`;

    const validation = TianjiPlanner.crossValidate(state.chart, state.ziwei);
    $('#cross-sources').innerHTML = validation.sources.map(source => `<div><span>${escapeHtml(source.label)}</span><b>${escapeHtml(source.value)}</b></div>`).join('');
    $('#cross-agreements').innerHTML = validation.agreements.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    $('#cross-differences').innerHTML = validation.differences.map(item => `<li>${escapeHtml(item)}</li>`).join('');
  }

  function renderTopics() {
    const topics = TianjiPlanner.topicCards(state.chart);
    $('#life-topic-grid').innerHTML = topics.map(topic => `
      <article class="life-topic-card">
        <span>${escapeHtml(topic.label)}</span><h3>${escapeHtml(topic.conclusion)}</h3>
        <dl>
          <div><dt>依据</dt><dd>${escapeHtml(topic.evidence)}</dd></div>
          <div><dt>现实表现</dt><dd>${escapeHtml(topic.reality)}</dd></div>
          <div><dt>行动建议</dt><dd>${escapeHtml(topic.action)}</dd></div>
        </dl>
      </article>`).join('');
  }

  function renderTimeline() {
    const timeline = TianjiPlanner.lifeTimeline(state.chart);
    $('#life-timeline-list').innerHTML = timeline.map(item => `
      <article class="timeline-stage ${item.status}">
        <div class="timeline-marker"><span></span></div>
        <div class="timeline-stage-head"><span>${item.startAge}–${item.endAge}岁</span><b>${escapeHtml(item.ganZhi)} · ${escapeHtml(item.god)}</b><em>${item.startYear}–${item.endYear}${item.status === 'current' ? ' · 当前阶段' : ''}</em></div>
        <h3>${escapeHtml(item.theme)}</h3>
        <div class="timeline-stage-grid">
          <p><b>事业</b>${escapeHtml(item.career)}</p><p><b>财富</b>${escapeHtml(item.wealth)}</p>
          <p><b>关系</b>${escapeHtml(item.relation)}</p><p><b>风险</b>${escapeHtml(item.risk)}</p>
        </div><div class="timeline-action">${escapeHtml(item.action)}</div>
      </article>`).join('');

    $('#year-card-grid').innerHTML = TianjiPlanner.yearCards(state.chart, new Date().getFullYear() - 1, 7).map(item => `
      <article class="year-card ${item.current ? 'current' : ''}">
        <span>${item.year}${item.current ? ' · 今年' : ''}</span><h3>${escapeHtml(item.ganZhi)} · ${escapeHtml(item.god)}</h3>
        <b>${escapeHtml(item.theme)}</b><p>${escapeHtml(item.career)}</p><small>${escapeHtml(item.relation)}</small>
      </article>`).join('');

    $('#month-window-grid').innerHTML = TianjiPlanner.monthWindows(state.chart, new Date(), 6).map(item => `
      <article class="month-window ${item.score >= 72 ? 'high' : item.score < 58 ? 'careful' : ''}">
        <span>${item.year}.${String(item.month).padStart(2, '0')} · ${escapeHtml(item.ganZhi)}</span>
        <h3>${escapeHtml(item.level)}</h3><b>${escapeHtml(item.theme)}</b><p>${escapeHtml(item.best)}</p><small>${escapeHtml(item.watch)}</small>
      </article>`).join('');
  }

  function renderCalendar() {
    if (!state.chart) return;
    const year = state.calendarDate.getFullYear();
    const month = state.calendarDate.getMonth() + 1;
    const data = TianjiPlanner.calendarMonth(state.chart, year, month, loadEvents());
    $('#calendar-label').textContent = `${year}年${month}月`;
    const blanks = Array.from({ length: data.firstWeekday }, () => '<span class="calendar-blank"></span>').join('');
    $('#rhythm-calendar-grid').innerHTML = blanks + data.days.map(day => `
      <button type="button" class="calendar-day ${day.tone} ${day.clash ? 'clash' : ''} ${day.events.length ? 'has-event' : ''} ${state.selectedDate === day.iso ? 'selected' : ''}" data-date="${day.iso}">
        <span>${day.day}</span><b>${day.score}</b><i></i>
      </button>`).join('');
    $$('#rhythm-calendar-grid .calendar-day').forEach(button => button.addEventListener('click', () => selectCalendarDay(button.dataset.date, data)));
    const selected = data.days.find(day => day.iso === state.selectedDate) || data.days.find(day => day.iso === todayIso()) || data.days[0];
    selectCalendarDay(selected.iso, data, false);
    renderEventList(year, month);
  }

  function selectCalendarDay(iso, data, rerender) {
    state.selectedDate = iso;
    const monthData = data || TianjiPlanner.calendarMonth(state.chart, Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), loadEvents());
    const day = monthData.days.find(item => item.iso === iso);
    if (!day) return;
    if (rerender !== false) {
      $$('#rhythm-calendar-grid .calendar-day').forEach(button => button.classList.toggle('selected', button.dataset.date === iso));
    }
    $('#calendar-detail').innerHTML = `<span>${escapeHtml(day.iso)} · 个人节奏 ${day.score}</span><h3>${escapeHtml(day.best)}</h3><p>需要留意：${escapeHtml(day.avoid)}</p>${day.clash ? '<small>本日地支与本命日支相冲，重要决定宜增加现实校验。</small>' : '<small>趋势只表示当天节奏，不代表确定事件。</small>'}`;
    $('#event-date').value = iso;
  }

  function renderEventList(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const events = loadEvents().filter(event => event.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date));
    $('#calendar-events').innerHTML = events.length ? events.map(event => `<div class="calendar-event"><span>${escapeHtml(event.date)}</span><b>${escapeHtml(event.title)}</b><button type="button" data-event-id="${event.id}" aria-label="删除事项">×</button></div>`).join('') : '<p class="empty-state">本月尚未加入自订事项。</p>';
    $$('#calendar-events [data-event-id]').forEach(button => button.addEventListener('click', () => {
      write(KEYS.events, loadEvents().filter(event => event.id !== button.dataset.eventId));
      renderCalendar();
    }));
  }

  function addEvent() {
    const date = $('#event-date').value;
    const title = $('#event-title').value.trim();
    if (!date || !title) { notify('请选择日期并填写事项名称。'); return; }
    const events = loadEvents();
    events.push({ id: makeId('event'), date, title: title.slice(0, 80), createdAt: new Date().toISOString() });
    if (write(KEYS.events, events)) {
      $('#event-title').value = '';
      state.calendarDate = new Date(`${date}T12:00:00`);
      renderCalendar();
      notify('事项已加入个人节奏日历。');
    }
  }

  function exportCalendar() {
    const year = state.calendarDate.getFullYear();
    const month = state.calendarDate.getMonth() + 1;
    const data = TianjiPlanner.calendarMonth(state.chart, year, month, loadEvents());
    const recommendations = [...data.days].sort((a, b) => b.score - a.score).slice(0, 5).map(day => ({ date: day.iso, title: `个人节奏：${day.best}`, description: `节奏分 ${day.score}。避免：${day.avoid}` }));
    const custom = loadEvents().filter(event => event.date.startsWith(`${year}-${String(month).padStart(2, '0')}`)).map(event => ({ date: event.date, title: event.title, description: '道法自然 · 自订事项' }));
    downloadText(`道法自然_${year}-${String(month).padStart(2, '0')}.ics`, TianjiPlanner.buildIcs([...recommendations, ...custom], '道法自然个人节奏'), 'text/calendar;charset=utf-8');
  }

  function activeProfileName() {
    if (!state.profile) return '当前命盘';
    const fingerprint = profileFingerprint(state.profile);
    const found = loadLibrary().find(item => item.fingerprint === fingerprint);
    return found ? found.nickname : '当前命盘';
  }

  function renderProfiles() {
    const library = loadLibrary();
    const currentFingerprint = state.profile ? profileFingerprint(state.profile) : '';
    $('#profile-library-grid').innerHTML = library.length ? library.map(item => `
      <article class="profile-library-card ${item.fingerprint === currentFingerprint ? 'active' : ''}">
        <span>${escapeHtml(item.relation)}</span><h3>${escapeHtml(item.nickname)}</h3>
        <p>${escapeHtml(item.data.cityLabel || item.data.city || '未设置城市')} · ${item.data.timeUnknown ? '时辰未知' : '时辰已记录'}</p>
        <small>${escapeHtml(item.note || '暂无备注')}</small>
        <div><button type="button" data-profile-use="${item.id}">使用</button><button type="button" data-profile-edit="${item.id}">编辑</button><button type="button" class="danger-link" data-profile-delete="${item.id}">删除</button></div>
      </article>`).join('') : '<p class="empty-state">资料库为空。生成命盘后可把当前资料加入这里。</p>';
    $$('[data-profile-use]').forEach(button => button.addEventListener('click', () => useProfile(button.dataset.profileUse)));
    $$('[data-profile-edit]').forEach(button => button.addEventListener('click', () => editProfile(button.dataset.profileEdit)));
    $$('[data-profile-delete]').forEach(button => button.addEventListener('click', () => deleteProfile(button.dataset.profileDelete)));
  }

  function saveCurrentProfile() {
    if (!state.profile) { notify('请先生成一张命盘。'); return; }
    const nickname = $('#profile-nickname').value.trim() || '未命名命盘';
    const relation = $('#profile-relation').value;
    const note = $('#profile-note').value.trim().slice(0, 180);
    const library = loadLibrary();
    const fingerprint = profileFingerprint(state.profile);
    const existing = state.editingProfileId ? library.find(item => item.id === state.editingProfileId) : library.find(item => item.fingerprint === fingerprint);
    if (existing) {
      Object.assign(existing, { nickname, relation, note, fingerprint, data: state.profile, updatedAt: new Date().toISOString() });
    } else {
      library.push({ id: makeId('profile'), nickname, relation, note, fingerprint, data: state.profile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    if (write(KEYS.library, library)) {
      state.editingProfileId = null;
      $('#profile-nickname').value = '';
      $('#profile-note').value = '';
      $('#save-current-profile').textContent = '保存当前命盘';
      renderProfiles(); renderDashboard();
      notify('命盘资料已保存到本机资料库。');
    }
  }

  function useProfile(id) {
    const item = loadLibrary().find(profile => profile.id === id);
    if (!item || !window.TianjiApp) return;
    TianjiApp.activateProfile(item.data);
    switchTab('today', true);
  }

  function editProfile(id) {
    const item = loadLibrary().find(profile => profile.id === id);
    if (!item) return;
    state.editingProfileId = id;
    $('#profile-nickname').value = item.nickname;
    $('#profile-relation').value = item.relation;
    $('#profile-note').value = item.note || '';
    $('#save-current-profile').textContent = '更新资料';
    $('#profile-nickname').focus();
  }

  function deleteProfile(id) {
    const item = loadLibrary().find(profile => profile.id === id);
    if (!item || !confirm(`确定删除“${item.nickname}”吗？此操作只删除本机资料库记录。`)) return;
    write(KEYS.library, loadLibrary().filter(profile => profile.id !== id));
    renderProfiles();
  }

  function renderRectification() {
    const input = state.profile || {};
    $('#rectify-year').value = input.inputY || input.y || '';
    $('#rectify-month').value = input.inputM || input.m || '';
    $('#rectify-day').value = input.inputD || input.d || '';
  }

  function runRectification() {
    const input = {
      y: Number($('#rectify-year').value), m: Number($('#rectify-month').value), d: Number($('#rectify-day').value),
      gender: state.profile ? state.profile.gender : 'male'
    };
    const checked = TianjiProfile.validateSolarDate(input.y, input.m, input.d);
    if (!checked.ok) { notify(checked.message); return; }
    const answers = {
      period: $('#rectify-period').value,
      traits: $$('#rectify-traits input:checked').map(inputEl => inputEl.value),
      eventYear: Number($('#rectify-event-year').value) || null,
      eventType: $('#rectify-event-type').value
    };
    const results = TianjiPlanner.rectifyTime(input, answers);
    $('#rectify-result').innerHTML = `<div class="speculative-note">候选结果只用于缩小时段范围，不能证明真实出生时辰。</div>${results.map(item => `
      <article><span>候选 ${item.rank}</span><h3>${String(item.hour).padStart(2, '0')}:00 · ${escapeHtml(item.ganZhi)} ${escapeHtml(item.god)}</h3><b>${item.score} · ${escapeHtml(item.confidence)}</b><p>${escapeHtml(item.evidence.join('；') || '现有回答不足，建议补充家庭记录或更多已发生事件。')}</p><button type="button" data-use-hour="${item.hour}">以此时辰重新排盘</button></article>`).join('')}`;
    $$('[data-use-hour]').forEach(button => button.addEventListener('click', () => useCandidateHour(Number(button.dataset.useHour))));
  }

  function useCandidateHour(hour) {
    if (!state.profile || !window.TianjiApp) return;
    const next = { ...state.profile, h: hour, mi: 0, inputH: hour, inputMi: 0, timeUnknown: false, timeAccuracy: 'approx', correctionNote: '时辰校正候选值，属于推测性分析。' };
    TianjiApp.activateProfile(next);
    notify('已按候选时辰重新排盘，结果会保留“大约”标注。');
    switchTab('analysis', true);
  }

  function readOption(prefix) {
    return {
      name: $(`#${prefix}-name`).value.trim() || (prefix === 'option-a' ? '选项 A' : '选项 B'),
      timing: Number($(`#${prefix}-timing`).value), risk: Number($(`#${prefix}-risk`).value),
      stability: Number($(`#${prefix}-stability`).value), growth: Number($(`#${prefix}-growth`).value)
    };
  }

  function runComparison() {
    const result = TianjiPlanner.compareOptions(state.chart, [readOption('option-a'), readOption('option-b')]);
    const labels = { timing: '时机', risk: '风险缓冲', stability: '稳定性', growth: '成长空间', fit: '个人倾向' };
    $('#comparison-result').innerHTML = `${result.rows.map(row => `<article><span>综合 ${row.score}</span><h3>${escapeHtml(row.name)}</h3>${Object.entries(row.metrics).map(([key, value]) => `<div><b>${labels[key]}</b><i><em style="width:${value}%"></em></i><strong>${value}</strong></div>`).join('')}</article>`).join('')}<p class="comparison-summary">${escapeHtml(result.summary)}</p><small>${escapeHtml(result.caveat)}</small>`;
  }

  function runBacktest() {
    const event = { year: Number($('#backtest-year').value), type: $('#backtest-type').value, note: $('#backtest-note').value.trim().slice(0, 120) };
    if (!event.year || event.year < 1901 || event.year > new Date().getFullYear()) { notify('请输入已经发生事件的正确年份。'); return; }
    const result = TianjiPlanner.backtestEvent(state.chart, event);
    const records = loadBacktests();
    records.unshift({ id: makeId('backtest'), event, result, createdAt: new Date().toISOString() });
    write(KEYS.backtests, records.slice(0, 20));
    renderBacktests();
  }

  function renderBacktests() {
    const records = loadBacktests();
    $('#backtest-result').innerHTML = records.length ? records.map(record => `<article><span>${record.result.year} · ${escapeHtml(record.result.ganZhi)} ${escapeHtml(record.result.god)}</span><h3>${escapeHtml(record.result.level)}</h3><p>${escapeHtml(record.result.explanation)}</p><small>${escapeHtml(record.result.branch)} ${escapeHtml(record.result.caveat)}</small><button type="button" data-backtest-delete="${record.id}" aria-label="删除回测记录">×</button></article>`).join('') : '<p class="empty-state">加入一项已经发生的事件，系统会诚实显示有无结构对应。</p>';
    $$('[data-backtest-delete]').forEach(button => button.addEventListener('click', () => {
      write(KEYS.backtests, loadBacktests().filter(record => record.id !== button.dataset.backtestDelete));
      renderBacktests();
    }));
  }

  function buildAiContext() {
    if (!state.chart) return '';
    const active = TianjiPlanner.currentDaYun(state.chart);
    const topics = TianjiPlanner.topicCards(state.chart);
    const months = TianjiPlanner.monthWindows(state.chart, new Date(), 3);
    return [
      `时间准确度：${state.chart.timeUnknown ? '未知时辰，只可使用年月日三柱' : (state.profile.timeAccuracy || '准确')}`,
      `日主：${state.chart.dayGan}${state.chart.dayWx}；四柱：${state.chart.pillars.slice(0, state.chart.timeUnknown ? 3 : 4).map(item => item.ganZhi).join('、')}`,
      `结构：${state.analysis.level}；喜用：${state.analysis.yong.join('、')}；需节制：${state.analysis.ji.join('、')}`,
      active ? `当前大运：${active.ganZhi} ${active.startYear}-${active.endYear}，十神${active.god}` : '当前大运资料不足',
      `已生成的人生问题结论：${topics.map(item => `${item.label}=${item.conclusion}；依据=${item.evidence}`).join(' | ')}`,
      `未来三个月窗口：${months.map(item => `${item.year}-${item.month} ${item.ganZhi}${item.god} ${item.level} ${item.best}`).join(' | ')}`,
      '回答必须引用以上具体资料；如果问题超出这些资料，请明确说明无法判断。'
    ].join('\n');
  }

  function mountAiQuestion() {
    if (!window.TianjiAI || !TianjiAI.mountQuestion) return;
    TianjiAI.mountQuestion($('#ai-question-panel'), { getContext: buildAiContext });
  }

  function storageSnapshot() {
    return { version: 2, exportedAt: new Date().toISOString(), library: loadLibrary(), events: loadEvents(), backtests: loadBacktests() };
  }

  function exportBackup() {
    downloadText(`道法自然_本机资料_${todayIso()}.json`, JSON.stringify(storageSnapshot(), null, 2), 'application/json;charset=utf-8');
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.library) || !Array.isArray(data.events)) throw new Error('INVALID');
        if (!confirm('导入会替换当前装置的命盘资料库、日历事项和回测记录，是否继续？')) return;
        write(KEYS.library, data.library);
        write(KEYS.events, data.events);
        write(KEYS.backtests, Array.isArray(data.backtests) ? data.backtests : []);
        renderProfiles(); renderCalendar(); renderBacktests();
        notify('本机资料备份已恢复。');
      } catch (_error) {
        notify('备份文件格式不正确，未修改现有资料。');
      }
    };
    reader.readAsText(file);
  }

  function downloadText(filename, content, type) {
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 800);
  }

  async function cryptoKey(passphrase, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 180000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  function b64(bytes) {
    const values = new Uint8Array(bytes);
    let binary = '';
    for (let index = 0; index < values.length; index += 0x8000) {
      binary += String.fromCharCode(...values.subarray(index, index + 0x8000));
    }
    return btoa(binary);
  }
  function fromB64(value) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }

  async function encryptSnapshot(passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await cryptoKey(passphrase, salt);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(storageSnapshot())));
    return { version: 1, salt: b64(salt), iv: b64(iv), ciphertext: b64(ciphertext) };
  }

  async function decryptSnapshot(payload, passphrase) {
    const salt = fromB64(payload.salt);
    const iv = fromB64(payload.iv);
    const key = await cryptoKey(passphrase, salt);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromB64(payload.ciphertext));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async function api(path, options) {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.message || '服务器暂时不可用。');
    return payload;
  }

  async function createSync() {
    const passphrase = $('#sync-passphrase').value;
    if (!window.crypto || !crypto.subtle) { notify('当前浏览器不支持加密同步，请使用最新版浏览器。'); return; }
    if (passphrase.length < 8) { notify('同步密码至少需要 8 个字符，并请妥善保存。'); return; }
    setSyncStatus('正在浏览器内加密资料…');
    try {
      const encrypted = await encryptSnapshot(passphrase);
      const result = await api('/api/sync/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: encrypted }) });
      const meta = { code: result.code, revokeToken: result.revoke_token, updatedAt: new Date().toISOString() };
      write(KEYS.sync, meta);
      $('#sync-code').value = result.code;
      setSyncStatus(`同步码 ${result.code} 已建立。服务器只保存密文；密码遗失将无法恢复。`);
    } catch (error) { setSyncStatus(error.message, true); }
  }

  async function updateSync() {
    const meta = read(KEYS.sync, null);
    const passphrase = $('#sync-passphrase').value;
    if (!meta || !meta.code || !meta.revokeToken) { await createSync(); return; }
    if (passphrase.length < 8) { notify('请输入建立同步时使用的密码。'); return; }
    setSyncStatus('正在重新加密并同步…');
    try {
      const encrypted = await encryptSnapshot(passphrase);
      await api('/api/sync/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: meta.code, revoke_token: meta.revokeToken, payload: encrypted }) });
      meta.updatedAt = new Date().toISOString(); write(KEYS.sync, meta);
      setSyncStatus(`同步码 ${meta.code} 已更新。`);
    } catch (error) { setSyncStatus(error.message, true); }
  }

  async function restoreSync() {
    const code = $('#sync-code').value.trim().toUpperCase();
    const passphrase = $('#sync-passphrase').value;
    if (!code || passphrase.length < 8) { notify('请输入同步码和至少 8 个字符的同步密码。'); return; }
    setSyncStatus('正在下载密文并在本机解密…');
    try {
      const response = await api(`/api/sync/${encodeURIComponent(code)}`);
      const data = await decryptSnapshot(response.payload, passphrase);
      if (!data || !Array.isArray(data.library) || !Array.isArray(data.events)) throw new Error('解密内容格式无效。');
      if (!confirm('恢复会替换当前装置的资料库和日历事项，是否继续？')) { setSyncStatus('已取消恢复。'); return; }
      write(KEYS.library, data.library); write(KEYS.events, data.events); write(KEYS.backtests, data.backtests || []);
      renderProfiles(); renderCalendar(); renderBacktests();
      setSyncStatus('加密资料已在本机恢复。若这是新装置，请从资料库选择要使用的命盘。');
    } catch (_error) { setSyncStatus('无法解密。请检查同步码、密码或资料是否已过期。', true); }
  }

  async function revokeSync() {
    const meta = read(KEYS.sync, null);
    if (!meta || !confirm('确定撤销服务器上的加密同步资料吗？本机资料不会删除。')) return;
    try {
      await api('/api/sync/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: meta.code, revoke_token: meta.revokeToken }) });
      localStorage.removeItem(KEYS.sync);
      $('#sync-code').value = '';
      setSyncStatus('服务器同步资料已撤销，本机资料保留。');
    } catch (error) { setSyncStatus(error.message, true); }
  }

  function setSyncStatus(message, error) {
    const box = $('#sync-status');
    box.textContent = message;
    box.classList.toggle('error', Boolean(error));
  }

  async function createShare() {
    if (!state.chart) return;
    const expiry = Number($('#share-expiry').value);
    const core = TianjiPlanner.topicCards(state.chart).slice(0, 3).map(item => ({ label: item.label, conclusion: item.conclusion, action: item.action }));
    const fortune = TianjiEngine.dailyFortune(state.chart, Solar.fromYmd(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()));
    const decision = TianjiProfile.dailyDecision(fortune);
    const payload = { brand: '道法自然', core, today: { level: decision.level, best: decision.best, avoid: decision.avoid, reminder: decision.reminder }, created: todayIso() };
    $('#share-preview').innerHTML = `<span>分享预览 · 不含姓名与出生日期</span>${core.map(item => `<div><b>${escapeHtml(item.label)}</b><p>${escapeHtml(item.conclusion)}</p><small>${escapeHtml(item.action)}</small></div>`).join('')}<div><b>今日提醒</b><p>${escapeHtml(decision.best)}</p><small>${escapeHtml(decision.reminder)}</small></div>`;
    try {
      const result = await api('/api/share/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload, expires_hours: expiry }) });
      const records = loadShares();
      records.unshift({ code: result.code, revokeToken: result.revoke_token, expiresAt: result.expires_at, createdAt: new Date().toISOString() });
      write(KEYS.shares, records.slice(0, 20));
      renderShareRecords();
      notify('匿名分享链接已建立。');
    } catch (error) { notify(error.message); }
  }

  function renderShareRecords() {
    const records = loadShares();
    $('#share-records').innerHTML = records.length ? records.map(record => {
      const url = `${location.origin}/share.html?code=${encodeURIComponent(record.code)}`;
      return `<div class="share-record"><span>${escapeHtml(record.code)}</span><a href="${url}" target="_blank" rel="noopener">打开</a><button type="button" data-share-copy="${url}">复制</button><button type="button" class="danger-link" data-share-revoke="${record.code}">撤销</button><small>有效至 ${escapeHtml(record.expiresAt)}</small></div>`;
    }).join('') : '<p class="empty-state">尚未建立匿名分享链接。</p>';
    $$('[data-share-copy]').forEach(button => button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(button.dataset.shareCopy); notify('分享链接已复制。'); } catch (_error) { notify('复制失败，请打开链接后手动复制。'); }
    }));
    $$('[data-share-revoke]').forEach(button => button.addEventListener('click', () => revokeShare(button.dataset.shareRevoke)));
  }

  async function revokeShare(code) {
    const records = loadShares();
    const record = records.find(item => item.code === code);
    if (!record || !confirm(`确定撤销分享码 ${code} 吗？`)) return;
    try {
      await api('/api/share/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, revoke_token: record.revokeToken }) });
      write(KEYS.shares, records.filter(item => item.code !== code));
      renderShareRecords();
      notify('分享链接已撤销。');
    } catch (error) { notify(error.message); }
  }

  function onChartReady(event) {
    const detail = event.detail || {};
    state.chart = detail.chart;
    state.profile = detail.profile || {};
    state.analysis = detail.analysis || TianjiEngine.analyze(state.chart);
    state.ziwei = detail.ziwei || null;
    ensureFirstProfile();
    $('#insight-workspace').classList.remove('hidden');
    $('#mobile-workspace-nav').classList.remove('hidden');
    renderDashboard(); renderTopics(); renderTimeline(); renderCalendar(); renderProfiles();
    renderRectification(); renderBacktests(); renderShareRecords(); mountAiQuestion();
  }

  function todayIso() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function bindControls() {
    $$('.workspace-tab, .mobile-workspace-nav button').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.wsTab, button.closest('.mobile-workspace-nav') != null)));
    $$('.mode-btn').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
    $('#calendar-prev').addEventListener('click', () => { state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1); state.selectedDate = null; renderCalendar(); });
    $('#calendar-next').addEventListener('click', () => { state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1); state.selectedDate = null; renderCalendar(); });
    $('#calendar-today').addEventListener('click', () => { state.calendarDate = new Date(); state.selectedDate = todayIso(); renderCalendar(); });
    $('#add-calendar-event').addEventListener('click', addEvent);
    $('#export-calendar').addEventListener('click', exportCalendar);
    $('#save-current-profile').addEventListener('click', saveCurrentProfile);
    $('#run-rectification').addEventListener('click', runRectification);
    $('#run-comparison').addEventListener('click', runComparison);
    $('#run-backtest').addEventListener('click', runBacktest);
    $('#export-backup').addEventListener('click', exportBackup);
    $('#import-backup-file').addEventListener('change', event => importBackup(event.target.files[0]));
    $('#sync-create').addEventListener('click', createSync);
    $('#sync-update').addEventListener('click', updateSync);
    $('#sync-restore').addEventListener('click', restoreSync);
    $('#sync-revoke').addEventListener('click', revokeSync);
    $('#create-share-link').addEventListener('click', createShare);
    $$('[data-range-output]').forEach(input => input.addEventListener('input', () => { const output = document.getElementById(input.dataset.rangeOutput); if (output) output.textContent = input.value; }));
  }

  document.addEventListener('tianji:chart-ready', onChartReady);
  document.addEventListener('tianji:chart-cleared', () => {
    state.chart = null; state.profile = null;
    $('#insight-workspace').classList.add('hidden');
    $('#mobile-workspace-nav').classList.add('hidden');
  });
  document.addEventListener('tianji:hehun-ready', event => {
    if (!event.detail || !event.detail.a || !event.detail.b) return;
    const graph = TianjiPlanner.relationshipGraph(event.detail.a, event.detail.b, event.detail.result);
    const target = $('#relationship-graph');
    if (!target) return;
    target.innerHTML = `<div class="relationship-summary"><div><span>关系优势</span><b>${escapeHtml(graph.strongest.label)}</b><p>${escapeHtml(graph.strongest.action)}</p></div><div><span>主要摩擦</span><b>${escapeHtml(graph.friction.label)}</b><p>${escapeHtml(graph.friction.action)}</p></div></div><div class="relationship-dimensions">${graph.dimensions.map(item => `<article><span>${escapeHtml(item.label)}</span><b>${item.score}</b><i><em style="width:${item.score}%"></em></i><strong>${escapeHtml(item.level)}</strong><p>${escapeHtml(item.basis)}</p><small>${escapeHtml(item.action)}</small></article>`).join('')}</div><p class="relationship-context">${escapeHtml(graph.context)}</p>`;
  });

  window.addEventListener('DOMContentLoaded', () => {
    bindControls();
    const ui = read(KEYS.ui, {});
    setMode(ui.mode || 'simple');
    switchTab(ui.tab || 'today', false);
    const sync = read(KEYS.sync, null);
    if (sync && sync.code) $('#sync-code').value = sync.code;
    const existing = window.TianjiApp && TianjiApp.getChart ? TianjiApp.getChart() : null;
    if (existing) onChartReady({ detail: { chart: existing, profile: TianjiApp.getProfile(), analysis: TianjiEngine.analyze(existing), ziwei: TianjiApp.getZiweiCells() } });
  });
})();
