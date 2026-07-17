/* ============================ 天機 · 前端交互 ============================ */
(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const SAVE_KEY = 'tianji_profile_v1';
  let chart = null;
  let viewDate = new Date();
  let gender = 'male';
  let calMode = 'solar';

  /* ---------- 星空背景 ---------- */
  function initStars() {
    const c = $('#stars'); const ctx = c.getContext('2d'); let stars = [];
    function resize() {
      c.width = innerWidth; c.height = innerHeight;
      const n = Math.floor((c.width * c.height) / 9000);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * c.width, y: Math.random() * c.height,
        r: Math.random() * 1.3 + 0.2, a: Math.random(), s: Math.random() * 0.015 + 0.003
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const st of stars) {
        st.a += st.s; const alpha = 0.35 + Math.sin(st.a) * 0.35;
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(217,185,120,${alpha})`; ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    resize(); addEventListener('resize', resize); draw();
  }

  /* ---------- 表单 ---------- */
  function initForm() {
    const sel = $('#in-hour');
    const sc = ['子','丑','丑','寅','寅','卯','卯','辰','辰','巳','巳','午','午','未','未','申','申','酉','酉','戌','戌','亥','亥','子'];
    for (let h = 0; h < 24; h++) {
      const o = document.createElement('option');
      o.value = h; o.textContent = `${String(h).padStart(2,'0')}:00 — ${String(h).padStart(2,'0')}:59 · ${sc[h]}时`;
      sel.appendChild(o);
    }
    sel.value = 12;
    $$('.g-btn').forEach(b => b.addEventListener('click', () => {
      $$('.g-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); gender = b.dataset.g;
    }));
    $('#btn-compute').addEventListener('click', onCompute);

    // 历法切换（阳历 / 农历）
    $$('.seg-btn').forEach(b => b.addEventListener('click', () => {
      $$('.seg-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      calMode = b.dataset.cal;
      $('#leap-wrap').classList.toggle('hidden', calMode !== 'lunar');
      $('#in-year').placeholder = calMode === 'lunar' ? '农历年(如1990)' : '1990';
    }));
  }

  // 农历 → 阳历（含闰月）
  function lunarToSolar(ly, lm, ld, isLeap) {
    const Lunar = window.Lunar;
    if (!isLeap) return Lunar.fromYmd(ly, lm, ld).getSolar();
    // 闰月在 lunar.js 中以负数月份表示（如闰五月 = -5）
    try {
      return Lunar.fromYmd(ly, -lm, ld).getSolar();
    } catch (e) {
      // 该年无闰月时回退普通月
      return Lunar.fromYmd(ly, lm, ld).getSolar();
    }
  }

  /* ---------- 排盘 ---------- */
  function onCompute() {
    let y = parseInt($('#in-year').value, 10), m = parseInt($('#in-month').value, 10),
        d = parseInt($('#in-day').value, 10), h = parseInt($('#in-hour').value, 10),
        mi = parseInt($('#in-minute').value, 10) || 0;
    if (!y || !m || !d || y < 1901 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) {
      alert('请填写正确的出生年月日。'); return;
    }
    let calNote = '';
    if (calMode === 'lunar') {
      try {
        const isLeap = $('#in-leap').checked;
        const solar = lunarToSolar(y, m, d, isLeap);
        calNote = `农历 ${y}年${m}月${d}日${isLeap ? '（闰月）' : ''}（即阳历 ${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日）`;
        y = solar.getYear(); m = solar.getMonth(); d = solar.getDay();
      } catch (e) { alert('农历日期转换出错，请检查。'); return; }
    }
    try { chart = TianjiEngine.buildChart(y, m, d, h, mi, gender); }
    catch (e) { alert('计算出错，请检查日期是否有效。'); console.error(e); return; }
    chart.calendarNote = calNote;
    saveProfile({ y, m, d, h, mi, gender, calMode, isLeap: $('#in-leap').checked });
    viewDate = new Date();
    renderAll();
    $('#result').classList.remove('hidden');
    setTimeout(() => $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  /* ---------- 存档 ---------- */
  function saveProfile(p) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch (e) {}
    refreshSavedBar();
  }
  function loadProfile() {
    try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function clearProfile() {
    localStorage.removeItem(SAVE_KEY); chart = null;
    $('#result').classList.add('hidden');
    $('#saved-bar').classList.add('hidden');
    refreshSavedBar();
    $('#compute').scrollIntoView({ behavior: 'smooth' });
  }
  function refreshSavedBar() {
    const p = loadProfile();
    const bar = $('#saved-bar');
    if (!p) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    $('#saved-text').textContent = `已保存命盘：生于 ${p.y}年${p.m}月${p.d}日 ${String(p.h).padStart(2,'0')}:${String(p.mi||0).padStart(2,'0')}（${p.gender === 'female' ? '坤造·女' : '乾造·男'}）`;
  }

  /* ---------- 自动加载（每日打开） ---------- */
  function autoLoad() {
    const p = loadProfile();
    if (!p) return false;
    try {
      chart = TianjiEngine.buildChart(p.y, p.m, p.d, p.h, p.mi, p.gender);
      chart.calendarNote = p.calMode === 'lunar' ? '（农历输入）' : '';
      viewDate = new Date();
      renderAll();
      $('#result').classList.remove('hidden');
      $('#save-status').textContent = '✓ 已自动载入你保存的命盘';
      return true;
    } catch (e) { console.error(e); return false; }
  }

  /* ---------- 渲染全部 ---------- */
  function renderAll() {
    renderChart();
    renderProfound();
    renderZiwei();
    renderDaily();
  }

  /* ---------- 命盘 ---------- */
  function renderChart() {
    $('#res-birth').textContent = `${chart.birthStr} · 农历${chart.lunarStr}`;
    if (chart.calendarNote) {
      const el = document.createElement('div');
      el.style.cssText = 'font-size:13px;color:var(--ink-mute);margin-top:8px;letter-spacing:.5px;';
      el.textContent = chart.calendarNote;
      $('#res-birth').appendChild(el);
    }
    $('#res-daymaster').textContent = `${chart.dayGan}${chart.dayWx}命`;
    const wxDesc = {
      木: '如木之仁，性情温和、富有生机与向上之力，重情义、爱成长。',
      火: '如火之礼，热情开朗、行动果决，光明磊落、感染力强。',
      土: '如土之信，敦厚踏实、包容稳重，重承诺、善经营根基。',
      金: '如金之义，果断刚毅、原则分明，重规矩、执行力强。',
      水: '如水之智，聪慧灵动、随机应变，善思考、洞察人心。'
    };
    $('#res-daymaster-desc').textContent = `你以「${chart.dayGan}」为日主，五行属${chart.dayWx}（${chart.dayGanYinYang}${chart.dayWx}）。${wxDesc[chart.dayWx]}`;
    $('#res-quicktags').innerHTML = [
      `生肖 <b>${chart.shengXiao}</b>`, `本命 <b>${chart.yearGanZhi}</b>`,
      `日主 <b>${chart.dayGan}${chart.dayWx}</b>`, `五行最旺 <b>${chart.strongest}</b>`,
      chart.lacking.length ? `五行缺 <b>${chart.lacking.join('、')}</b>` : `五行 <b>俱全</b>`
    ].map(t => `<span>${t}</span>`).join('');

    $('#res-pillars').innerHTML = chart.pillars.map(p => `
      <div class="pillar">
        <div class="p-label">${p.label}</div>
        <div class="p-gz" style="color:${p.color}">${p.gan}${p.zhi}</div>
        <div class="p-god">${p.god}</div>
        <div class="p-nayin">${p.naYin}</div>
        <div class="p-tag">${p.tag}</div>
      </div>`).join('');

    const maxWx = Math.max(...Object.values(chart.wx), 1);
    $('#res-wuxing').innerHTML = ['木','火','土','金','水'].map(w => `
      <div class="wx-row">
        <span class="wx-name" style="color:${TianjiEngine.WUXING_COLOR[w]}">${w}</span>
        <div class="wx-track"><div class="wx-fill" data-w="${chart.wx[w]/maxWx*100}" style="background:${TianjiEngine.WUXING_COLOR[w]}"></div></div>
        <span class="wx-count">${chart.wx[w]}</span>
      </div>`).join('');
    setTimeout(() => $$('.wx-fill').forEach(el => el.style.width = el.dataset.w + '%'), 60);

    const lackTxt = chart.lacking.length ? `你的八字中<b>缺${chart.lacking.join('、')}</b>，日常可多亲近对应元素以求平衡。` : `你的八字五行<b>俱全</b>，格局较为均衡。`;
    $('#res-wuxing-note').innerHTML = `八字五行以<b>${chart.strongest}</b>最旺。${lackTxt}五行讲究中和为贵，过旺宜泄、不足宜补，日常起居、色彩、方位皆可作调和。`;

    $('#res-qiyun').textContent = `${chart.startInfo.year}岁${chart.startInfo.month}个月起运`;
    const nowY = new Date().getFullYear();
    $('#res-dayun').innerHTML = chart.daYun.map(d => {
      const active = nowY >= d.startYear && nowY <= d.endYear ? 'active' : '';
      return `<div class="dayun-cell ${active}">
        <div class="dy-age">${d.startAge}-${d.endAge}岁</div>
        <div class="dy-gz" style="color:${d.color}">${d.ganZhi}</div>
        <div class="dy-god">${d.god}</div>
        <div class="dy-year">${d.startYear}-${d.endYear}</div>
      </div>`;
    }).join('');
    renderLiunian();
  }

  /* ---------- 八字专业细盘 ---------- */
  function renderProfound() {
    const d = TianjiEngine.analyze(chart);

    $('#pf-strength').innerHTML = `
      <div class="pf-card">
        <div class="pf-card-h">日主旺衰</div>
        <div class="pf-level"><span class="pf-badge lv-${d.level}">${d.level}</span><span class="pf-ratio">生扶比 ${d.ratio}%</span></div>
        <div class="pf-bar"><div class="pf-bar-fill" style="width:${d.ratio}%"></div></div>
        <div class="pf-desc">${d.levelDesc}</div>
      </div>`;

    $('#pf-yong').innerHTML = `
      <div class="pf-card">
        <div class="pf-card-h">用神 · 喜忌</div>
        <div class="pf-row"><span class="pf-k">喜用神</span><span class="pf-v yong">${d.yong.map(w => `<i>${w}</i>`).join('')}</span></div>
        <div class="pf-row"><span class="pf-k">忌神</span><span class="pf-v ji">${d.ji.map(w => `<i>${w}</i>`).join('')}</span></div>
        <div class="pf-desc">喜用五行：${d.yong.join('、')}；忌神五行：${d.ji.join('、')}。五行讲究扶抑得当，日常可多亲近喜用元素以助运。</div>
      </div>`;

    const maxE = Math.max(...Object.values(d.energy), 1);
    $('#pf-energy').innerHTML = `
      <div class="pf-card">
        <div class="pf-card-h">五行能量（含地支藏干）</div>
        <div class="pf-energy-bars">
          ${['木', '火', '土', '金', '水'].map(w => `<div class="wx-row"><span class="wx-name" style="color:${TianjiEngine.WUXING_COLOR[w]}">${w}</span><div class="wx-track"><div class="wx-fill" data-w="${d.energy[w] / maxE * 100}" style="background:${TianjiEngine.WUXING_COLOR[w]}"></div></div><span class="wx-count">${d.energy[w].toFixed(1)}</span></div>`).join('')}
        </div>
      </div>`;

    $('#pf-grid').innerHTML = `
      <div class="pf-card">
        <div class="pf-card-h">胎元 · 命宫 · 身宫 · 空亡</div>
        <div class="pf-mini"><span>胎元</span><b>${d.taiYuan}</b></div>
        <div class="pf-mini"><span>命宫</span><b>${d.mingGong}</b></div>
        <div class="pf-mini"><span>身宫</span><b>${d.shenGong}</b></div>
        <div class="pf-mini"><span>空亡</span><b>${d.kongWang}</b></div>
      </div>
      <div class="pf-card">
        <div class="pf-card-h">神煞（${d.shenSha.length}）</div>
        <div class="pf-sha">
          ${d.shenSha.map(s => `<div class="sha-item"><b>${s.name}</b><span class="sha-where">${s.where}</span><span class="sha-desc">${s.desc}</span></div>`).join('')}
        </div>
      </div>`;

    $('#pf-pillars').innerHTML = `
      <div class="pf-card pf-pillars-card">
        <div class="pf-card-h">四柱 · 地支藏干与十神</div>
        <div class="pf-table">
          ${d.pillars.map(p => `
            <div class="pf-tr">
              <div class="pf-td pf-pillar"><b style="color:${p.color}">${p.gan}${p.zhi}</b><span>${p.label} · ${p.god}</span></div>
              <div class="pf-td pf-cang">
                ${p.cang.map(c => `<span class="cang-item ${c.role === 1 ? 'ben' : ''}"><i class="cang-stem" style="color:${TianjiEngine.WUXING_COLOR[c.wx]}">${c.stem}</i><em>${c.tenGod}</em></span>`).join('')}
              </div>
              <div class="pf-td pf-xing">星运<b>${p.xing}</b>　自坐<b>${p.selfSeat}</b></div>
              <div class="pf-td pf-nayin">${p.naYin}</div>
            </div>`).join('')}
        </div>
        <div class="pf-foot">本气以粗体标示；星运为日主五行十二长生所临之位。</div>
      </div>`;

    setTimeout(() => $$('#pf-energy .wx-fill').forEach(el => el.style.width = el.dataset.w + '%'), 80);
  }

  /* ---------- 紫微斗数 ---------- */
  function renderZiwei() {
    const note = $('#zw-note');
    if (!ZiweiBoard.available) { note.textContent = '（紫微引擎未加载）'; return; }
    note.textContent = `${chart.gender === 'female' ? '坤造' : '乾造'} ${chart.birthStr}`;
    const cells = ZiweiBoard.getBoard(chart.y, chart.m, chart.d, chart.h, chart.mi || 0, chart.gender, chart.pillars[0].gan);
    $('#zw-board').innerHTML = ZiweiBoard.renderBoard(cells);
    $('#zw-detail').innerHTML = ZiweiBoard.renderDetail(cells);
  }

  /* ---------- 流年 ---------- */
  function renderLiunian() {
    const nowY = new Date().getFullYear(); const Solar = window.Solar; const cells = [];
    for (let y = nowY - 1; y <= nowY + 5; y++) {
      const lunar = Solar.fromYmd(y, 6, 1).getLunar();
      const gz = lunar.getYearInGanZhi();
      const god = computeTenGod(chart.dayGan, gz[0]);
      const cur = y === nowY ? 'current' : '';
      cells.push(`<div class="ln-cell ${cur}">
        <div class="ln-year">${y}年${y === nowY ? ' · 今年' : ''}</div>
        <div class="ln-gz">${gz} ${lunar.getYearShengXiao()}</div>
        <div class="ln-god">流年${god}</div>
        <div class="ln-tip">${liunianTip(god)}</div>
      </div>`);
    }
    $('#res-liunian').innerHTML = cells.join('');
  }
  function computeTenGod(dayGan, otherGan) {
    const GW = TianjiEngine.GAN_WUXING;
    const YY = { 甲:'阳',乙:'阴',丙:'阳',丁:'阴',戊:'阳',己:'阴',庚:'阳',辛:'阴',壬:'阳',癸:'阴' };
    const SHENG = { 木:'火',火:'土',土:'金',金:'水',水:'木' };
    const KE = { 木:'土',火:'金',土:'水',金:'木',水:'火' };
    const me = GW[dayGan], ot = GW[otherGan], same = YY[dayGan] === YY[otherGan];
    if (me === ot) return same ? '比肩' : '劫财';
    if (SHENG[me] === ot) return same ? '食神' : '伤官';
    if (KE[me] === ot) return same ? '偏财' : '正财';
    if (KE[ot] === me) return same ? '七杀' : '正官';
    if (SHENG[ot] === me) return same ? '偏印' : '正印';
    return '比肩';
  }
  function liunianTip(god) {
    const m = {
      正官:'利事业名声，宜循规守法、把握晋升机会。', 七杀:'压力与挑战并存，宜自律进取、化压力为动力。',
      正印:'贵人学业运佳，宜进修充电、多得长辈提携。', 偏印:'思维敏锐、偏门有得，宜专精技艺、防思虑过度。',
      正财:'正财稳进，宜勤恳务实、稳健理财置业。', 偏财:'机遇财源广，宜把握时机、忌投机贪快。',
      食神:'福气顺遂、才华得展，宜创作享受、广结善缘。', 伤官:'才华外露、变动较多，宜谨言慎行、化才为财。',
      比肩:'自主独立、朋辈助力，宜合作共赢、防破财口舌。', 劫财:'开拓有力但破耗易生，宜稳守财帛、慎于合伙。'
    };
    return m[god] || '运势平稳，宜按部就班。';
  }

  /* ---------- 每日运势 ---------- */
  function renderDaily() {
    const Solar = window.Solar;
    const dSolar = Solar.fromYmd(viewDate.getFullYear(), viewDate.getMonth() + 1, viewDate.getDate());
    const f = TianjiEngine.dailyFortune(chart, dSolar);

    $('#day-label').textContent = `${f.dateStr.slice(5)} ${f.week}`;
    $('#today-gz').innerHTML = `<b>${f.dayGanZhi}</b>日　农历${f.lunarStr}　纳音「${f.naYin}」　值神${f.god}`;
    $('#today-advice').textContent = f.advice;

    $('#score-value').textContent = f.score;
    const circ = 2 * Math.PI * 52;
    const ring = $('#score-ring-fg');
    ring.style.strokeDashoffset = circ * (1 - f.score / 100);
    const ringColor = f.score >= 75 ? '#6bc0a0' : f.score >= 55 ? '#d9b978' : '#e0655c';
    ring.style.stroke = ringColor; $('.score-num span').style.color = ringColor;

    const colorDots = f.luckyColor.map(c => `<span class="lucky-dot" style="background:${c}"></span>`).join('');
    $('#lucky-row').innerHTML = `
      <div class="lucky-item">幸运方位<b>${f.luckyDir}</b></div>
      <div class="lucky-item">喜用五行<b>${f.luckyWx.join('、')}</b></div>
      <div class="lucky-item">幸运色<span class="lucky-dots">${colorDots}</span></div>
      <div class="lucky-item">今日冲煞<b>${f.chong} 煞${f.sha}</b></div>`;

    const dimNames = { career: '事业', wealth: '财运', love: '感情', health: '健康' };
    $('#res-dims').innerHTML = Object.keys(dimNames).map(k => `
      <div class="dim"><div class="d-name">${dimNames[k]}</div>
        <div class="d-bar"><div class="d-fill" data-v="${f.dims[k]}"></div></div>
        <div class="d-val">${f.dims[k]}</div></div>`).join('');
    setTimeout(() => $$('.d-fill').forEach(el => el.style.width = el.dataset.v + '%'), 60);

    $('#yi-tags').innerHTML = (f.yi.length ? f.yi.slice(0, 10) : ['诸事不宜']).map(t => `<em>${t}</em>`).join('');
    $('#ji-tags').innerHTML = (f.ji.length ? f.ji.slice(0, 10) : ['百无禁忌']).map(t => `<em>${t}</em>`).join('');

    const hl = [
      ['值日星宿', f.xiu], ['吉神宜趋', f.jiShen.slice(0, 4).join('、') || '—'],
      ['凶煞宜忌', (f.xiongSha && f.xiongSha.length ? f.xiongSha.slice(0, 4).join('、') : '—')],
      ['彭祖百忌', f.pengZu.join('　')], ['今日胎神', f.taishen || '—'],
      ['今日冲煞', `${f.chong} · 煞${f.sha}`]
    ];
    $('#huangli-grid').innerHTML = hl.map(([k, v]) => `<div class="hl-item"><div class="hl-k">${k}</div><div class="hl-v">${v}</div></div>`).join('');
  }

  /* ---------- 日期切换 ---------- */
  function initDateNav() {
    $('#day-prev').addEventListener('click', () => { viewDate.setDate(viewDate.getDate() - 1); renderDaily(); });
    $('#day-next').addEventListener('click', () => { viewDate.setDate(viewDate.getDate() + 1); renderDaily(); });
    $('#day-today').addEventListener('click', () => { viewDate = new Date(); renderDaily(); });
  }

  /* ---------- 分享图片 + 微信直连 ---------- */
  function initShare() {
    const pop = $('#share-pop');
    $('#btn-share').addEventListener('click', (e) => { e.stopPropagation(); pop.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => {
      if (!pop.contains(e.target) && e.target.id !== 'btn-share') pop.classList.add('hidden');
    });
    pop.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const act = b.dataset.act;
      pop.classList.add('hidden');
      if (act === 'img') shareImage();
      else if (act === 'link') copyLink();
      else if (act === 'wechat') shareWechat();
    }));
    $('#btn-clear').addEventListener('click', clearProfile);
  }
  function copyLink() {
    const url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => toast('链接已复制，可粘贴到微信')).catch(() => toast('复制失败，请手动复制网址'));
    } else { toast('当前环境不支持自动复制，请手动复制网址'); }
  }
  function shareWechat() {
    const url = location.href;
    if (navigator.share) {
      navigator.share({ title: '天機 · 我的每日命理', text: '看看我的八字与紫微命盘', url }).catch(() => {});
    } else {
      shareImage();
      setTimeout(() => toast('图片已生成，长按保存后可发到微信'), 900);
    }
  }
  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function shareImage() {
    if (!chart) return;
    const stage = $('#share-stage');
    const dSolar = window.Solar.fromYmd(viewDate.getFullYear(), viewDate.getMonth() + 1, viewDate.getDate());
    const f = TianjiEngine.dailyFortune(chart, dSolar);
    const p = loadProfile() || {};
    stage.innerHTML = buildShareCard(chart, f, p);
    stage.classList.add('active');
    if (typeof html2canvas === 'undefined') { alert('分享组件未加载'); stage.classList.remove('active'); return; }
    html2canvas(stage.firstElementChild, { backgroundColor: '#0a0b0f', scale: 2, useCORS: true, logging: false })
      .then(canvas => {
        stage.classList.remove('active');
        const link = document.createElement('a');
        link.download = `天机_${f.dateStr}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      })
      .catch(e => { console.error(e); stage.classList.remove('active'); alert('生成图片失败，请重试。'); });
  }
  function buildShareCard(chart, f, p) {
    const zwCells = ZiweiBoard.available ? ZiweiBoard.getBoard(p.y, p.m, p.d, p.h, p.mi, chart.gender, chart.pillars[0].gan) : null;
    const zwHtml = zwCells ? ZiweiBoard.renderBoard(zwCells) : '';
    const yi = (f.yi.length ? f.yi.slice(0, 6) : ['—']).join(' · ');
    const ji = (f.ji.length ? f.ji.slice(0, 6) : ['—']).join(' · ');
    return `<div class="sc-card">
      <div class="sc-head">
        <div class="sc-brand">天機 · TIANJI</div>
        <div class="sc-date">${f.dateStr} ${f.week} · 农历${f.lunarStr}</div>
      </div>
      <div class="sc-ming">${chart.dayGan}${chart.dayWx}命　生肖${chart.shengXiao}　本命${chart.yearGanZhi}</div>
      <div class="sc-sizhu">
        ${chart.pillars.map(pl => `<div class="sc-pz"><span>${pl.label}</span><b style="color:${pl.color}">${pl.gan}${pl.zhi}</b><i>${pl.god}</i></div>`).join('')}
      </div>
      <div class="sc-score">
        <div class="sc-ring" style="--c:${f.score>=75?'#6bc0a0':f.score>=55?'#d9b978':'#e0655c'}">
          <span>${f.score}</span><em>今日运势</em>
        </div>
        <div class="sc-yiji">
          <div class="sc-yi"><b>宜</b>${yi}</div>
          <div class="sc-ji"><b>忌</b>${ji}</div>
          <div class="sc-lucky">幸运方位 ${f.luckyDir}　喜用 ${f.luckyWx.join('、')}　冲煞 ${f.chong}煞${f.sha}</div>
        </div>
      </div>
      <div class="sc-zwtitle">紫微斗数命盘</div>
      <div class="sc-zw">${zwHtml}</div>
      <div class="sc-foot">观天之机 · 知日之宜　｜　传统文化娱乐参考</div>
    </div>`;
  }

  /* ---------- 择吉 ---------- */
  function initZeji() {
    const today = new Date();
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    $('#zj-start').value = fmt(today);
    const later = new Date(today.getTime() + 30 * 86400000);
    $('#zj-end').value = fmt(later);
    $('#btn-zeji').addEventListener('click', runZeji);
  }
  function runZeji() {
    const event = $('#zj-event').value;
    const s = $('#zj-start').value, e = $('#zj-end').value;
    if (!s || !e) { alert('请选择起止日期'); return; }
    const parse = (str) => { const [y, m, d] = str.split('-').map(Number); return { y, m, d }; };
    let start = parse(s), end = parse(e);
    // 限制 90 天
    const days = Math.round((new Date(e) - new Date(s)) / 86400000) + 1;
    if (days > 90) { alert('为保证体验，择吉范围请控制在 90 天内。'); return; }
    const p = loadProfile();
    const avoidBranch = p ? chart.pillars[2].zhi : null; // 个人日支
    const results = TianjiEngine.zeji(event, start, end, avoidBranch);
    const best = results.filter(r => r.suitable);
    let html = `<div class="zj-summary">在 ${days} 天中，共找到 <b>${best.length}</b> 个「宜${event}」的吉日${avoidBranch ? '（已为你避开冲本命日支）' : ''}：</div>`;
    if (best.length === 0) {
      html += `<div class="zj-empty">该范围内没有「宜${event}」的日子，可尝试放宽日期范围，或参考下方分数较高的日期。</div>`;
    }
    html += '<div class="zj-list">';
    results.slice(0, 18).forEach((r, i) => {
      const level = !r.suitable ? 'none' : (r.score >= 80 ? 'top' : r.score >= 65 ? 'good' : 'ok');
      const tag = !r.suitable ? '不宜' : (r.score >= 80 ? '大吉' : r.score >= 65 ? '吉' : '平');
      html += `<div class="zj-item ${level}">
        <div class="zj-date">${r.dateStr}<br><span>${r.week}</span></div>
        <div class="zj-tag">${tag}</div>
        <div class="zj-info">
          <div class="zj-gz">${r.gz}（${r.naYin}）${r.zhiXing ? ' · '+r.zhiXing : ''}</div>
          <div class="zj-yi">宜：${(r.yi.length?r.yi.join('、'):'—')}</div>
          <div class="zj-ji">忌：${(r.ji.length?r.ji.join('、'):'—')}</div>
          ${r.clashSelf ? '<div class="zj-warn">⚠ 与本命日支相冲，慎选</div>' : ''}
          <div class="zj-detail">冲${r.chong} 煞${r.sha}　吉神：${r.jiShen.join('、')||'—'}</div>
        </div>
        <div class="zj-score">${r.score}<span>分</span></div>
      </div>`;
    });
    html += '</div>';
    $('#zj-result').innerHTML = html;
  }

  /* ---------- 浮动按钮 ---------- */
  function initFloat() {
    $('#back-top').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
    addEventListener('scroll', () => {
      $('#back-top').classList.toggle('show', scrollY > 500);
    });
    $('#saved-view').addEventListener('click', () => {
      if (autoLoad()) $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#saved-reset').addEventListener('click', () => $('#compute').scrollIntoView({ behavior: 'smooth' }));
  }

  /* ---------- 启动 ---------- */
  window.addEventListener('DOMContentLoaded', () => {
    initStars(); initForm(); initDateNav(); initShare(); initZeji(); initFloat();
    refreshSavedBar();
  });
})();
