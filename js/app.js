/* ============================ 道法自然 · 前端交互 ============================ */
(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const SAVE_KEY = 'tianji_profile_v1';
  let chart = null;
  let viewDate = new Date();
  let gender = 'male';
  let calMode = 'solar';
  let lastZiweiCells = null;

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
    lastZiweiCells = cells;
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
      navigator.share({ title: '道法自然 · 我的每日命理', text: '看看我的八字与紫微命盘', url }).catch(() => {});
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
        link.download = `道法自然_${f.dateStr}.png`;
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
        <div class="sc-brand">道法自然 · DAOFA</div>
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
      <div class="sc-foot">观天之道 · 知日之宜　｜　传统文化娱乐参考</div>
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

  /* ---------- 八字合婚 ---------- */
  let genderA = 'male', genderB = 'male';
  let lastHehun = null;

  function initHehun() {
    const sc = ['子','丑','丑','寅','寅','卯','卯','辰','辰','巳','巳','午','午','未','未','申','申','酉','酉','戌','戌','亥','亥','子'];
    ['a','b'].forEach(who => {
      const sel = $('#hh-hour-' + who);
      for (let h = 0; h < 24; h++) {
        const o = document.createElement('option');
        o.value = h; o.textContent = `${String(h).padStart(2,'0')}:00 — ${String(h).padStart(2,'0')}:59 · ${sc[h]}时`;
        sel.appendChild(o);
      }
      sel.value = 12;
    });
    $$('.hh-g-btn').forEach(b => b.addEventListener('click', () => {
      const who = b.dataset.who;
      $$(`.hh-g-btn[data-who="${who}"]`).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      if (who === 'a') genderA = b.dataset.g; else genderB = b.dataset.g;
    }));
    $('#btn-hehun').addEventListener('click', onHehun);
  }

  function readPerson(who) {
    const y = parseInt($('#hh-year-' + who).value, 10),
          m = parseInt($('#hh-month-' + who).value, 10),
          d = parseInt($('#hh-day-' + who).value, 10),
          h = parseInt($('#hh-hour-' + who).value, 10),
          mi = parseInt($('#hh-minute-' + who).value, 10) || 0;
    return { y, m, d, h, mi, ok: y && m && d && y >= 1901 && y <= 2099 && m >= 1 && m <= 12 && d >= 1 && d <= 31 };
  }

  function onHehun() {
    const A = readPerson('a'), B = readPerson('b');
    if (!A.ok) { alert('请填写甲方正确的出生年月日。'); return; }
    if (!B.ok) { alert('请填写乙方正确的出生年月日。'); return; }
    let ca, cb;
    try { ca = TianjiEngine.buildChart(A.y, A.m, A.d, A.h, A.mi, genderA); } catch (e) { alert('甲方日期无效，请检查。'); return; }
    try { cb = TianjiEngine.buildChart(B.y, B.m, B.d, B.h, B.mi, genderB); } catch (e) { alert('乙方日期无效，请检查。'); return; }
    const res = TianjiEngine.hehun(ca, cb);
    lastHehun = { a: ca, b: cb, result: res };
    renderHehun(res);
    $('#hh-result').classList.remove('hidden');
    setTimeout(() => $('#hh-result').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  function renderHehun(res) {
    const C = 2 * Math.PI * 52;
    const off = C * (1 - res.score / 100);
    const factors = res.factors.map(f => {
      const cls = f.good > 0 ? 'good' : f.good < 0 ? 'bad' : 'flat';
      const tag = f.good > 0 ? '吉' : f.good < 0 ? '凶' : '平';
      return `<div class="hh-factor ${cls}">
        <div class="hf-name">${f.name} · ${tag}</div>
        <div class="hf-detail">${f.detail}</div>
      </div>`;
    }).join('');
    $('#hh-result').innerHTML = `
      <div class="hh-score-wrap">
        <div class="hh-ring">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" class="ring-bg"></circle>
            <circle cx="60" cy="60" r="52" class="ring-fg" style="stroke-dasharray:${C};stroke-dashoffset:${C}"></circle>
          </svg>
          <div class="hh-num"><span>${res.score}</span><em>分</em></div>
        </div>
        <div>
          <div class="hh-verdict">${res.verdict}</div>
          <div class="hh-verdict-sub">综合生肖、纳音、日主五行、喜用神互补与地支刑冲五维测算</div>
        </div>
      </div>
      <div class="hh-factors">${factors}</div>
      <div class="disclaimer">八字合婚源自传统民俗，仅供文化娱乐参考，婚姻幸福更在于彼此的理解与经营。</div>
    `;
    requestAnimationFrame(() => {
      const fg = $('#hh-result').querySelector('.ring-fg');
      if (fg) fg.style.strokeDashoffset = off;
    });
  }

  /* ---------- 全站「详解」弹层 ---------- */
  const TEN_GOD_DESC = {
    比肩: '与日主同五行、同阴阳，主兄弟姐妹、朋友、自我意识与独立。',
    劫财: '与日主同五行、异阴阳，主合作也主争夺、破耗。',
    食神: '日主所生且同阴阳，主才华、口福、享受与子女缘。',
    伤官: '日主所生且异阴阳，主才艺与表现，亦主叛逆不服管束。',
    正财: '日主所克且异阴阳，主稳定收入、务实与妻子（女命论夫）。',
    偏财: '日主所克且同阴阳，主横财、机遇、应酬与风流。',
    正官: '克日主且异阴阳，主事业、名望、规则与丈夫（女命）。',
    七杀: '克日主且同阴阳，主压力、权威、挑战与魄力。',
    正印: '生日主且异阴阳，主长辈、学识、庇护与贵人。',
    偏印: '生日主且同阴阳，主偏门技艺、冷门才华，亦主思虑孤僻。'
  };
  const WX_DESC = {
    木: '仁 · 生发、条达，对应肝、春、东方。',
    火: '礼 · 炎热、向上，对应心、夏、南方。',
    土: '信 · 承载、化生，对应脾胃、长夏、中央。',
    金: '义 · 肃杀、收敛，对应肺、秋、西方。',
    水: '智 · 润下、流动，对应肾、冬、北方。'
  };

  function sec(title, html) { return `<div class="dm-sec"><h4>${title}</h4>${html}</div>`; }
  function ul(items) { return `<ul class="dm-ul">${items.map(i => `<li>${i}</li>`).join('')}</ul>`; }
  function wxColor(w) { return TianjiEngine.WUXING_COLOR[w]; }

  const Detail = {
    overview(c, a) {
      return sec('你是这张命盘的中心', `<p>八字以「日柱天干」代表你自己，称为<b>日主 / 命主</b>。你生于 ${c.birthStr}，日主为 <b style="color:${wxColor(c.dayWx)}">${c.dayGan}</b>，五行属 <b>${c.dayWx}</b>（${c.dayGanYinYang}${c.dayWx}）。${WX_DESC[c.dayWx]}</p>`)
        + sec('旺衰与喜忌', `<p>经综合四柱生克测算，你的日主为「<b>${a.level}</b>」：${a.levelDesc}</p>
          <p>喜用神（对你有助的五行）：<b style="color:var(--jade)">${a.yong.join('、')}</b>；忌神（对你不利的五行）：<b style="color:var(--red)">${a.ji.join('、')}</b>。日常可多亲近喜用元素以助运。</p>`)
        + sec('上方标签的含义', ul([
            `生肖 <b>${c.shengXiao}</b>：年柱地支所代表的属相，主先天根基与祖上气场。`,
            `本命 <b>${c.yearGanZhi}</b>：出生年的干支，也叫「年命」。`,
            `日主 <b>${c.dayGan}${c.dayWx}</b>：代表「我」的核心五行。`,
            `五行最旺 <b style="color:${wxColor(c.strongest)}">${c.strongest}</b>：八字中能量最强的五行。`,
            c.lacking.length ? `五行缺 <b>${c.lacking.join('、')}</b>：该五行在八字中完全不现，宜后天补益。` : `五行 <b>俱全</b>：格局相对均衡。`
          ]));
    },
    bazi(c, a) {
      const roles = [
        ['年柱', c.pillars[0], '祖上 · 根基 · 幼年'],
        ['月柱', c.pillars[1], '父母 · 兄弟 · 事业（月令为提纲）'],
        ['日柱', c.pillars[2], '自身 · 配偶 · 中年'],
        ['时柱', c.pillars[3], '子女 · 晚年 · 事业结果']
      ];
      const cards = roles.map(([label, p, tag]) => `
        <div class="dm-pillar">
          <div class="dm-p-label">${label}</div>
          <div class="dm-p-gz" style="color:${p.color}">${p.gan}${p.zhi}</div>
          <div class="dm-p-god">${p.god}</div>
          <div class="dm-p-sub">${tag}</div>
          <div class="dm-p-nayin">纳音：${p.naYin}</div>
        </div>`).join('');
      const godList = Object.keys(TEN_GOD_DESC).map(g => `<li><b>${g}</b>：${TEN_GOD_DESC[g]}</li>`).join('');
      return sec('四柱是什么', `<p>「四柱」即年、月、日、时四组干支，每组一「天干」一「地支」，共八个字，故称八字。天干为显、地支为藏，干支组合构成推演的基础。</p>`)
        + sec('你的四柱', `<div class="dm-pillars">${cards}</div>`)
        + sec('天干十神（以你日主为「我」）', `<p>十神是日主与其他天干的生克关系，揭示人事角色。${a.pillars.map(p => `<b style="color:${p.color}">${p.gan}${p.zhi}</b> 之天干为「${p.god}」`).join('；')}。</p><ul class="dm-ul">${godList}</ul>`)
        + sec('纳音', `<p>纳音是干支的五行化气（如「海中金」「炉中火」），常用作年命配对与性情补充参考，上方每柱已标注其纳音。</p>`);
    },
    profound(c, a) {
      const sha = a.shenSha.length ? a.shenSha.map(s => `<li><b style="color:var(--gold)">${s.name}</b>（${s.where}）：${s.desc}</li>`).join('') : '<li>本命未触发常见神煞。</li>';
      return sec('日主旺衰', `<p>以日主五行对照四柱天干与地支藏干，统计「生我、同我」的助力占比为 <b>${a.ratio}%</b>，故判定日主为「<b>${a.level}</b>」。</p><p>${a.levelDesc}</p>`)
        + sec('用神 · 喜忌', `<p>「用神」是命局中最能平衡日主、补偏救弊的五行；「喜神」辅助用神，「忌神」则加重偏颇。你的喜用为 <b style="color:var(--jade)">${a.yong.join('、')}</b>，忌神为 <b style="color:var(--red)">${a.ji.join('、')}</b>。</p>`)
        + sec('五行能量（含地支藏干）', `<p>此处能量按「天干1、本气0.5、中气0.3、余气0.2」加权统计，比只看八个字更贴近真实强弱。${['木','火','土','金','水'].map(w => `<b style="color:${wxColor(w)}">${w} ${a.energy[w].toFixed(1)}</b>`).join('　')}</p>`)
        + sec('胎元 · 命宫 · 身宫 · 空亡', `<p>胎元（受胎之月干支）、命宫（先天格局与性格）、身宫（后天作为与归宿）、空亡（旬空之地，力量减弱）是细盘的重要坐标：</p>
          <ul class="dm-ul">
            <li>胎元：<b>${a.taiYuan}</b></li>
            <li>命宫：<b>${a.mingGong}</b></li>
            <li>身宫：<b>${a.shenGong}</b></li>
            <li>空亡：<b>${a.kongWang}</b></li>
          </ul>`)
        + sec('神煞（${a.shenSha.length}）', `<p>神煞是古人对特殊干支组合的象义归纳，可作性情与机遇的旁证：</p><ul class="dm-ul">${sha}</ul>`)
        + sec('地支藏干与十神', `<p>每个地支内藏一至三天干（本气·中气·余气），它们与日主同样构成十神关系，是判断格局深浅的关键。本气以粗体标示于上方细盘表格。</p>`);
    },
    ziwei(c) {
      const cells = lastZiweiCells;
      if (!cells || !cells.length) return '<p class="dm-empty">紫微命盘尚未加载，请先生成命盘。</p>';
      const order = ['命宫', '夫妻', '财帛', '官禄', '福德', '迁移'];
      const rows = order.map(duty => {
        const cell = cells.find(x => x.duty === duty); if (!cell) return '';
        const mains = cell.stars.filter(s => s.cls === 'main');
        const mainTxt = mains.length ? mains.map(s => `${s.name}${s.hua ? `（${s.hua}）` : ''}`).join('、') : '无主星（借星安宫）';
        return `<div class="dm-zw-row"><b>${cell.duty}</b><span class="dm-zw-gz">${cell.stem}${cell.branch}</span><span class="dm-zw-main">${mainTxt}</span></div>`;
      }).join('');
      return sec('紫微斗数是什么', `<p>紫微斗数以出生时刻排出十二人事宫（命宫、兄弟、夫妻……父母），再将南北斗十四主星与众多辅星落入各宫，并依<b>年干</b>飞出「禄、权、科、忌」四化，借星曜庙旺与四化流转论吉凶。</p>`)
        + sec('你的关键宫位（主星）', `<p>以下为几个核心宫位的主星（括号内为四化飞星）。命宫主星尤其影响性格与先天禀赋。</p><div class="dm-zw-list">${rows}</div>`)
        + sec('四化飞星', `<p>四化依你年干（${c.pillars[0].gan}）而定，是能量流动的「开关」：<b>禄</b>主生发福泽，<b>权</b>主掌权变动，<b>科</b>主声名才学，<b>忌</b>主执滞纠缠。结合上方命盘中的四化标记一起参看。</p>`);
    },
    wuxing(c, a) {
      return sec('五行生克', `<p>五行相生：木生火、火生土、土生金、金生水、水生木；五行相克：木克土、土克水、水克火、火克金、金克木。命理以「中和为贵」——过旺宜泄耗，不足宜生扶。</p>`)
        + sec('你的五行格局', `<p>八字（四个天干＋四个地支本气）中，以 <b style="color:${wxColor(c.strongest)}">${c.strongest}</b> 最旺。${c.lacking.length ? `你<b>缺${c.lacking.join('、')}</b>，日常可多亲近对应元素以求平衡。` : `你的五行<b>俱全</b>，格局较为均衡。`}</p>`)
        + sec('各元素意象', `<ul class="dm-ul">${['木','火','土','金','水'].map(w => `<li><b style="color:${wxColor(w)}">${w}</b>：${WX_DESC[w]}</li>`).join('')}</ul>`);
    },
    daily(c) {
      const dSolar = window.Solar.fromYmd(viewDate.getFullYear(), viewDate.getMonth() + 1, viewDate.getDate());
      const f = TianjiEngine.dailyFortune(c, dSolar);
      const scoreWord = f.score >= 75 ? '上吉' : f.score >= 55 ? '中吉' : f.score >= 40 ? '平顺' : '谨慎';
      return sec('今日分数怎么来', `<p>分数结合「你的日主五行」与「当日干支」的生克关系：遇<b>印</b>（生我）、<b>比劫</b>（同我）为吉而加分；遇<b>官杀</b>（克我）则减分。若当日地支<b>冲</b>你本命日支则再减分，<b>六合</b>则加分。基础分约 62 分上下浮动，最终落在 30–98 之间。</p>`)
        + sec('今日概况（${f.dateStr}）', `<p>当日干支 <b>${f.dayGanZhi}</b>，十神为「<b>${f.god}</b>」：${TEN_GOD_DESC[f.god] || ''}</p>
          <p>评分 <b style="color:${wxColor(c.dayWx)}">${f.score}</b> 分，属「${scoreWord}」。${f.advice}</p>`)
        + sec('宜 / 忌与黄历', `<p>宜忌取自当日黄历：宜 <b style="color:var(--green)">${(f.yi.length ? f.yi.join('、') : '诸事不宜')}</b>；忌 <b style="color:var(--red)">${(f.ji.length ? f.ji.join('、') : '百无禁忌')}</b>。</p>
          <p>值神 <b>${f.god}</b>；今日冲煞 <b>${f.chong} 煞${f.sha}</b>；吉神宜趋：${f.jiShen.slice(0,4).join('、') || '—'}；凶煞：${(f.xiongSha && f.xiongSha.length ? f.xiongSha.slice(0,4).join('、') : '—')}。</p>`)
        + sec('幸运指引', `<p>幸运方位 <b>${f.luckyDir}</b>；喜用五行 <b>${f.luckyWx.join('、')}</b>；幸运色见上方色块。这些是「生扶你日主」的五行，用作择色、择向的参考。</p>`);
    },
    dayun(c) {
      const nowY = new Date().getFullYear();
      const analysis = TianjiEngine.analyze(c);
      const cells = c.daYun.map(d => {
        const active = nowY >= d.startYear && nowY <= d.endYear ? ' <b style="color:var(--gold)">（当前大运）</b>' : '';
        const knowledge = window.TianjiKnowledge ? TianjiKnowledge.tenGod(d.god) : null;
        const detail = knowledge ? `主题为${knowledge.core}。事业：${knowledge.career} 财务：${knowledge.wealth}` : (TEN_GOD_DESC[d.god] || '结合命局喜忌参看。');
        const support = (analysis.yong || []).includes(d.wx) ? '此运天干五行属于喜用，整体更易借力。' : (analysis.ji || []).includes(d.wx) ? '此运天干五行属于忌神，宜控制风险和节奏。' : '此运需结合地支与流年共同判断。';
        return `<li><b style="color:${d.color}">${d.ganZhi}</b>　${d.startAge}–${d.endAge}岁（${d.startYear}–${d.endYear}）· 十神「${d.god}」${active}<br><span>${detail} ${support}</span></li>`;
      }).join('');
      return sec('什么是大运', `<p>大运是十年一变的运势阶段，由出生月柱顺逆排布。你约 <b>${c.startInfo.year}岁${c.startInfo.month}个月</b> 起运，之后每十年换一柱大运。</p>`)
        + sec('你的大运轨迹', `<ul class="dm-ul">${cells}</ul>`)
        + sec('怎么看', `<p>大运干支与日主生克，决定这十年的整体气场；天干常作为显性主题，地支还要结合藏干、刑冲合害和每年流年。上面的解释是阶段提示，不代表十年内每件事都会相同。</p>`);
    },
    liunian(c) {
      const Solar = window.Solar; const nowY = new Date().getFullYear();
      const items = [];
      for (let y = nowY - 1; y <= nowY + 5; y++) {
        const lunar = Solar.fromYmd(y, 6, 1).getLunar();
        const gz = lunar.getYearInGanZhi();
        const god = (function (dayGan, otherGan) {
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
        })(c.dayGan, gz[0]);
        const cur = y === nowY ? ' <b style="color:var(--gold)">（今年）</b>' : '';
        const knowledge = window.TianjiKnowledge ? TianjiKnowledge.tenGod(god) : null;
        const yearZhi = gz[1], selfZhi = c.pillars[2].zhi;
        const chong = { 子:'午',午:'子',丑:'未',未:'丑',寅:'申',申:'寅',卯:'酉',酉:'卯',辰:'戌',戌:'辰',巳:'亥',亥:'巳' };
        const liuhe = { 子:'丑',丑:'子',寅:'亥',亥:'寅',卯:'戌',戌:'卯',辰:'酉',酉:'辰',巳:'申',申:'巳',午:'未',未:'午' };
        const branchNote = chong[selfZhi] === yearZhi ? '流年支冲本命日支，关系、居所或节奏更易变化。' : liuhe[selfZhi] === yearZhi ? '流年支与本命日支六合，人际协作与关系议题更突出。' : '流年支与本命日支无直接六冲六合，仍需结合当前大运。';
        const detail = knowledge ? `主题为${knowledge.core}。${knowledge.career} ${knowledge.wealth}` : (TEN_GOD_DESC[god] || '结合大运参看。');
        items.push(`<li><b>${y}</b>年（${gz} ${lunar.getYearShengXiao()}）· 流年十神「${god}」${cur}<br><span>${detail} ${branchNote}</span></li>`);
      }
      return sec('什么是流年', `<p>流年即「当年的太岁干支」，是每一年叠加在大运之上的气场。流年十神是相对于你日主（${c.dayGan}）而论的生克关系，用来判断该年事业、财情、健康的主题。</p>`)
        + sec('近年流年', `<ul class="dm-ul">${items.join('')}</ul>`)
        + sec('判断次序', `<p>先看当前十年大运提供的背景，再看流年干支如何触发本命。流年主题只表示当年更容易出现的议题，具体选择仍应以现实条件和风险承受能力为准。</p>`);
    },
    hehunPrinciple() {
      return sec('测算原理', `<p>八字合婚从五个维度综合评分，基础分 50 分，各维度按吉凶加减，最终落在 5–100 分：</p>
        <ul class="dm-ul">
          <li><b>生肖配对（±12）</b>：看双方年支的六合、三合、六冲、相害、相刑。</li>
          <li><b>年命纳音（±10）</b>：双方年柱纳音五行的生克比和。</li>
          <li><b>日主五行（±12）</b>：双方日主五行的相生、比和或相克。</li>
          <li><b>用神互补（±14）</b>：对方八字五行能量，是否补足你方的喜用神。</li>
          <li><b>地支刑冲（±12）</b>：双方八个地支两两配对，统计合局、六冲、相刑、相害。</li>
        </ul>`)
        + sec('分数与判语', `<p>≥80 天作之合；≥65 上等姻缘；≥50 中平相配；≥35 略有波折；<35 缘分较浅。分数仅供文化娱乐参考，婚姻幸福更在于彼此的理解与经营。</p>`);
    },
    hehun(data) {
      if (!data) return Detail.hehunPrinciple() + sec('本次结果', '<p>请先填写甲乙双方生辰并完成测算，随后这里会显示双方逐项详解。</p>');
      const A = TianjiEngine.analyze(data.a), B = TianjiEngine.analyze(data.b), result = data.result;
      const label = good => good > 0 ? '有利' : good < 0 ? '需磨合' : '中性';
      const factors = result.factors.map(f => {
        const advice = f.name === '生肖配对' ? '生肖只代表年支层面，权重低于双方现实沟通与共同目标。' :
          f.name === '年命纳音' ? '纳音作辅助象义，不应替代日主、用神与地支整体关系。' :
          f.name === '日主五行' ? '相生也要看是否一方长期耗泄；相克也可通过角色分工形成制衡。' :
          f.name === '用神互补' ? '互补高表示双方元素可彼此补位，仍要落实到生活方式和责任分配。' :
          '合局利协作，刑冲常表现为节奏、表达或生活习惯差异，可通过规则和沟通减轻。';
        return `<b>${f.name} · ${label(f.good)}</b>：${f.detail}。${advice}`;
      });
      return sec('本次合婚概览', `<p>综合分 <b>${result.score}</b>，判语为“<b>${result.verdict}</b>”。甲方日主 ${data.a.dayGan}${data.a.dayWx}、喜用 ${A.yong.join('、')}；乙方日主 ${data.b.dayGan}${data.b.dayWx}、喜用 ${B.yong.join('、')}。</p>`)
        + sec('五个维度逐项解释', `<ul class="dm-ul">${factors.map(item => `<li>${item}</li>`).join('')}</ul>`)
        + sec('双方相处提示', `<ul class="dm-ul"><li><b>甲方表达重点</b>：日主${data.a.dayWx}，当前命局${A.level}，在关系中宜把需求说成可执行的请求。</li><li><b>乙方表达重点</b>：日主${data.b.dayWx}，当前命局${B.level}，在关系中宜明确边界与回应时间。</li><li><b>共同校验</b>：把分歧落到金钱、时间、家庭责任、居住与长期目标五个现实议题逐一讨论。</li></ul>`)
        + Detail.hehunPrinciple();
    }
  };

  function buildDetail(type) {
    if (type === 'hehun') return Detail.hehun(lastHehun) + (window.TianjiKnowledge ? TianjiKnowledge.sourceBadge('bazi') : '');
    if (!chart) return '<p class="dm-empty">请先生成命盘后再查看详解。</p>';
    const a = TianjiEngine.analyze(chart);
    const map = {
      overview: () => Detail.overview(chart, a),
      bazi: () => Detail.bazi(chart, a),
      profound: () => Detail.profound(chart, a),
      ziwei: () => Detail.ziwei(chart),
      wuxing: () => Detail.wuxing(chart, a),
      daily: () => Detail.daily(chart),
      dayun: () => Detail.dayun(chart),
      liunian: () => Detail.liunian(chart)
    };
    const body = (map[type] && map[type]()) || '<p class="dm-empty">暂无详解。</p>';
    return body + (window.TianjiKnowledge ? TianjiKnowledge.sourceBadge('bazi') : '');
  }

  function openCustomDetail(title, body) {
    $('#detail-modal .dm-title').textContent = title || '详解';
    $('#detail-modal .dm-body').innerHTML = body || '<p class="dm-empty">暂无详解。</p>';
    if (window.TianjiAI) window.TianjiAI.mount($('#detail-modal .dm-body'), { title, body });
    $('#detail-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function openDetail(type) {
    const titles = {
      overview: '命主概览 · 详解', bazi: '四柱八字 · 详解', profound: '八字精批 · 详解',
      ziwei: '紫微斗数 · 详解', wuxing: '五行分布 · 详解', daily: '每日运势 · 详解',
      dayun: '大运流转 · 详解', liunian: '流年运程 · 详解', hehun: '八字合婚 · 测算原理'
    };
    const body = buildDetail(type);
    if (body === null) return;
    openCustomDetail(titles[type] || '详解', body);
  }
  function closeDetail() {
    $('#detail-modal').classList.add('hidden');
    document.body.style.overflow = '';
  }

  window.TianjiDetail = { open: openCustomDetail, close: closeDetail };

  function injectDetailButtons() {
    $$('[data-detail]').forEach(sec => {
      if (sec.querySelector(':scope > .dm-trigger')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dm-trigger';
      btn.textContent = '详解 · AI ›';
      btn.addEventListener('click', (e) => { e.stopPropagation(); openDetail(sec.dataset.detail); });
      sec.appendChild(btn);
    });
  }

  function initDetailModal() {
    $$('#detail-modal [data-close]').forEach(el => el.addEventListener('click', closeDetail));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetail(); });
  }

  function initQuickNav() {
    $$('.quick-nav [data-jump]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.jump;
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    const brand = $('.brand');
    if (brand) brand.style.cursor = 'pointer';
    if (brand) brand.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ---------- 启动 ---------- */
  window.addEventListener('DOMContentLoaded', () => {
    initStars(); initForm(); initDateNav(); initShare(); initZeji(); initFloat(); initHehun();
    injectDetailButtons(); initDetailModal(); initQuickNav();
    refreshSavedBar();
  });
})();
