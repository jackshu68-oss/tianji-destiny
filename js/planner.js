/* Modern planning layer built on top of the deterministic chart engine. */
(function (root) {
  'use strict';

  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
  const YINYANG = { 甲: '阳', 乙: '阴', 丙: '阳', 丁: '阴', 戊: '阳', 己: '阴', 庚: '阳', 辛: '阴', 壬: '阳', 癸: '阴' };
  const CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
  const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  const WX_NATURE = {
    木: { drive: '成长与连接', strength: '建立长期关系、持续学习与推动新事物', watch: '目标过多时容易分散资源' },
    火: { drive: '表达与推动', strength: '把想法转化成行动并带动现场气氛', watch: '节奏过快时容易忽略校验' },
    土: { drive: '稳定与承接', strength: '搭建秩序、照顾执行细节与长期经营', watch: '过度求稳时可能延迟必要改变' },
    金: { drive: '判断与取舍', strength: '厘清标准、建立边界并完成复杂决策', watch: '标准过紧时容易压缩沟通空间' },
    水: { drive: '观察与适应', strength: '理解变化、整合信息并寻找弹性路径', watch: '信息过多时容易反复推演' }
  };

  function clamp(value, min, max) {
    return Math.max(min == null ? 0 : min, Math.min(max == null ? 100 : max, Math.round(value)));
  }

  function average(values) {
    const clean = values.filter(value => Number.isFinite(value));
    return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
  }

  function tenGod(dayGan, otherGan) {
    const ganWx = root.TianjiEngine.GAN_WUXING;
    const me = ganWx[dayGan];
    const other = ganWx[otherGan];
    const same = YINYANG[dayGan] === YINYANG[otherGan];
    if (me === other) return same ? '比肩' : '劫财';
    if (SHENG[me] === other) return same ? '食神' : '伤官';
    if (KE[me] === other) return same ? '偏财' : '正财';
    if (KE[other] === me) return same ? '七杀' : '正官';
    if (SHENG[other] === me) return same ? '偏印' : '正印';
    return '比肩';
  }

  function knowledgeFor(god) {
    if (root.TianjiKnowledge && root.TianjiKnowledge.tenGod) return root.TianjiKnowledge.tenGod(god);
    return { core: '阶段主题', career: '结合现实进度判断。', wealth: '控制成本并保留余地。', relation: '保持清楚沟通。' };
  }

  function currentDaYun(chart, year) {
    const targetYear = year || new Date().getFullYear();
    return (chart.daYun || []).find(item => targetYear >= item.startYear && targetYear <= item.endYear) || (chart.daYun || [])[0] || null;
  }

  function topicCards(chart) {
    const analysis = root.TianjiEngine.analyze(chart);
    const active = currentDaYun(chart);
    const activeKnowledge = knowledgeFor(active ? active.god : '比肩');
    const nature = WX_NATURE[chart.dayWx];
    const support = (analysis.yong || []).join('、') || '平衡';
    const restraint = (analysis.ji || []).join('、') || '过度用力';
    return [
      {
        key: 'talent', label: '性格与天赋', conclusion: nature.drive,
        evidence: `日主为${chart.dayGan}${chart.dayWx}，命局结构为${analysis.level}，喜用侧重${support}。`,
        reality: `较容易通过${nature.strength}形成优势。`,
        action: `把优势落实为一个可重复的工作方法，同时留意${nature.watch}。`
      },
      {
        key: 'career', label: '事业与工作', conclusion: activeKnowledge.core,
        evidence: active ? `目前处于${active.ganZhi}大运（${active.startYear}–${active.endYear}），十神主题为${active.god}。` : '当前大运资料不足。',
        reality: activeKnowledge.career,
        action: '把阶段主题拆成季度目标，并用职责、时间与交付物检验是否真正推进。'
      },
      {
        key: 'wealth', label: '财富与资源', conclusion: '先看资源结构，再看短期机会',
        evidence: `命局喜用为${support}，当前阶段主题为${active ? active.god : '待确认'}。`,
        reality: activeKnowledge.wealth,
        action: '区分稳定现金流、成长投入与高风险尝试，为每一类设置独立上限。'
      },
      {
        key: 'relation', label: '感情与关系', conclusion: '关系质量取决于表达与边界是否同步',
        evidence: `日支为${chart.pillars[2].zhi}，日主五行属${chart.dayWx}；阶段关系主题参考${active ? active.god : '本命结构'}。`,
        reality: activeKnowledge.relation,
        action: '讨论分歧时先说事实、感受和请求，再共同确认时间、金钱与责任分配。'
      },
      {
        key: 'family', label: '家庭与人际', conclusion: '稳定支持来自清楚角色与持续回应',
        evidence: `年柱${chart.pillars[0].ganZhi}与月柱${chart.pillars[1].ganZhi}分别作为根基及家庭、事业环境参考。`,
        reality: `对外承担与内在需要可能有不同节奏，${nature.watch}。`,
        action: '把默认期待改成可讨论的分工，重要承诺留下明确日期和复盘点。'
      },
      {
        key: 'timing', label: '当前运势与时机', conclusion: active ? `${active.ganZhi}阶段 · ${activeKnowledge.core}` : '阶段资料待补充',
        evidence: active ? `阶段从${active.startYear}年至${active.endYear}，天干五行属${active.wx}。` : '暂无可用大运。',
        reality: active && (analysis.yong || []).includes(active.wx) ? '阶段元素较容易提供支持，但仍需靠现实资源承接。' : active && (analysis.ji || []).includes(active.wx) ? '阶段更容易放大压力与偏科，节奏和风险边界尤其重要。' : '阶段影响较中性，应结合每年与每月窗口观察。',
        action: `未来三个月优先验证一项关键目标，避免在${restraint}相关议题上同时扩大投入。`
      }
    ];
  }

  function lifeTimeline(chart, year) {
    const nowYear = year || new Date().getFullYear();
    const analysis = root.TianjiEngine.analyze(chart);
    return (chart.daYun || []).map(item => {
      const knowledge = knowledgeFor(item.god);
      const supportive = (analysis.yong || []).includes(item.wx);
      const demanding = (analysis.ji || []).includes(item.wx);
      const status = nowYear >= item.startYear && nowYear <= item.endYear ? 'current' : (item.endYear < nowYear ? 'past' : 'future');
      return {
        ...item,
        status,
        theme: knowledge.core,
        career: knowledge.career,
        wealth: knowledge.wealth,
        relation: knowledge.relation,
        risk: supportive ? '机会增加时仍要确认资源是否跟得上。' : demanding ? '压力与偏科较容易放大，避免过度承诺或高杠杆。' : '整体需结合流年，不宜只凭十年主题下结论。',
        action: supportive ? '适合分阶段扩大已经验证有效的方法。' : demanding ? '先守住现金流、健康节奏与关键关系，再选择性推进。' : '保留弹性，用年度复盘决定加速或调整。'
      };
    });
  }

  function yearCards(chart, fromYear, count) {
    const first = fromYear || new Date().getFullYear();
    const total = count || 7;
    const dayBranch = chart.pillars[2].zhi;
    const active = currentDaYun(chart, first);
    const cards = [];
    for (let index = 0; index < total; index += 1) {
      const year = first + index;
      const lunar = root.Solar.fromYmd(year, 6, 1).getLunar();
      const ganZhi = lunar.getYearInGanZhi();
      const god = tenGod(chart.dayGan, ganZhi[0]);
      const knowledge = knowledgeFor(god);
      let relation = '与本命日支无直接六冲六合，仍需结合现实进度。';
      if (CHONG[dayBranch] === ganZhi[1]) relation = '流年支冲本命日支，关系、居所或生活节奏较容易出现调整。';
      else if (LIUHE[dayBranch] === ganZhi[1]) relation = '流年支与本命日支六合，协作与关系议题较容易成为重点。';
      cards.push({
        year, ganZhi, animal: lunar.getYearShengXiao(), god,
        theme: knowledge.core,
        career: knowledge.career,
        wealth: knowledge.wealth,
        relation,
        background: active ? `${active.ganZhi}大运提供十年背景` : '需结合大运背景',
        current: year === new Date().getFullYear()
      });
    }
    return cards;
  }

  function monthWindows(chart, startDate, count) {
    const start = startDate || new Date();
    const total = count || 6;
    const windows = [];
    for (let index = 0; index < total; index += 1) {
      const date = new Date(start.getFullYear(), start.getMonth() + index, 15);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const lunar = root.Solar.fromYmd(year, month, 15).getLunar();
      const ganZhi = lunar.getMonthInGanZhiExact ? lunar.getMonthInGanZhiExact() : lunar.getMonthInGanZhi();
      const god = tenGod(chart.dayGan, ganZhi[0]);
      const knowledge = knowledgeFor(god);
      const samples = [6, 15, 24].filter(day => day <= new Date(year, month, 0).getDate()).map(day => {
        const fortune = root.TianjiEngine.dailyFortune(chart, root.Solar.fromYmd(year, month, day));
        return average([fortune.dims.action, fortune.dims.communication, fortune.dims.finance, fortune.dims.relation, fortune.dims.state]);
      });
      const score = clamp(average(samples));
      windows.push({
        year, month, ganZhi, god, score,
        level: score >= 72 ? '推进窗口' : score >= 58 ? '稳步安排' : '校验与收束',
        theme: knowledge.core,
        best: score >= 72 ? '集中处理一项高价值目标' : score >= 58 ? '按既定节奏推进并留复盘点' : '整理资源、修正假设与控制风险',
        watch: score < 58 ? '避免在信息不足时同时开启多个承诺' : '机会增加不等于结果确定，仍要验证现实条件'
      });
    }
    return windows;
  }

  function calendarMonth(chart, year, month, customEvents) {
    const days = [];
    const total = new Date(year, month, 0).getDate();
    const events = Array.isArray(customEvents) ? customEvents : [];
    for (let day = 1; day <= total; day += 1) {
      const solar = root.Solar.fromYmd(year, month, day);
      const fortune = root.TianjiEngine.dailyFortune(chart, solar);
      const score = clamp(average([
        fortune.dims.action, fortune.dims.communication, fortune.dims.finance,
        fortune.dims.relation, fortune.dims.state
      ]));
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day, iso, week: solar.getWeek(), score,
        tone: score >= 72 ? 'high' : score >= 58 ? 'steady' : 'careful',
        clash: fortune.chongSelf,
        best: root.TianjiProfile.dailyDecision(fortune).best,
        avoid: root.TianjiProfile.dailyDecision(fortune).avoid,
        events: events.filter(event => event.date === iso)
      });
    }
    return { year, month, firstWeekday: new Date(year, month - 1, 1).getDay(), days };
  }

  function relationshipGraph(chartA, chartB, result) {
    const factors = result && Array.isArray(result.factors) ? result.factors : [];
    const factor = name => factors.find(item => item.name === name) || { good: 0, detail: '资料中性' };
    const zodiac = factor('生肖配对').good;
    const elements = factor('日主五行').good;
    const complement = factor('用神互补').good;
    const branches = factor('地支刑冲').good;
    const dimensions = [
      { key: 'emotion', label: '情绪理解', score: clamp(58 + elements * 14 + complement * 10), basis: factor('日主五行').detail },
      { key: 'communication', label: '沟通模式', score: clamp(56 + branches * 16 + elements * 7), basis: factor('地支刑冲').detail },
      { key: 'pace', label: '生活节奏', score: clamp(58 + zodiac * 15 + branches * 7), basis: factor('生肖配对').detail },
      { key: 'resources', label: '资源观念', score: clamp(55 + complement * 18 + factor('年命纳音').good * 7), basis: factor('用神互补').detail },
      { key: 'longterm', label: '长期磨合', score: 0, basis: '综合前四项与地支合冲观察' }
    ];
    dimensions[4].score = clamp(average(dimensions.slice(0, 4).map(item => item.score)) + branches * 5);
    dimensions.forEach(item => {
      item.level = item.score >= 72 ? '优势' : item.score >= 56 ? '可协作' : '重点磨合';
      item.action = item.score >= 72 ? '保留现有有效做法，并把默契转成清楚约定。' : item.score >= 56 ? '遇到分歧时先统一事实、目标与回应时间。' : '提前约定暂停机制，避免在情绪高点处理金钱与长期承诺。';
    });
    return {
      dimensions,
      strongest: [...dimensions].sort((a, b) => b.score - a.score)[0],
      friction: [...dimensions].sort((a, b) => a.score - b.score)[0],
      context: `${chartA.dayGan}${chartA.dayWx}与${chartB.dayGan}${chartB.dayWx}的结构比较只提供关系观察，不替代真实相处经验。`
    };
  }

  function crossValidate(chart, ziweiCells) {
    const analysis = root.TianjiEngine.analyze(chart);
    const active = currentDaYun(chart);
    const fortune = root.TianjiEngine.dailyFortune(chart, root.Solar.fromYmd(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()));
    const keyPalaces = Array.isArray(ziweiCells) ? ['命宫', '官禄', '财帛'].map(name => {
      const cell = ziweiCells.find(item => item.duty === name);
      if (!cell) return null;
      const stars = (cell.stars || []).filter(star => star.cls === 'main').map(star => star.name).slice(0, 2);
      return `${name}${stars.length ? `：${stars.join('、')}` : '：借对宫观察'}`;
    }).filter(Boolean) : [];
    const dailyAverage = clamp(average(Object.values(fortune.dims).slice(0, 5)));
    const sources = [
      { label: '本命结构', value: `${chart.dayGan}${chart.dayWx} · ${analysis.level} · 喜用${analysis.yong.join('、')}` },
      { label: '十年阶段', value: active ? `${active.ganZhi} · ${active.god} · ${knowledgeFor(active.god).core}` : '暂无大运资料' },
      { label: '紫微关键宫', value: chart.timeUnknown ? '时辰未知，本层停用' : (keyPalaces.join('；') || '紫微盘待载入') },
      { label: '今日节奏', value: `${dailyAverage} · ${root.TianjiProfile.dailyDecision(fortune).level}` }
    ];
    const agreements = [
      `本命喜用${analysis.yong.join('、')}与当前${active ? active.god : '阶段'}共同提示：先把资源集中到可验证的重点。`,
      `${WX_NATURE[chart.dayWx].drive}是较稳定的底层倾向，阶段变化主要影响表达方式和优先顺序。`
    ];
    const differences = dailyAverage < 58 && active ? ['长期阶段与今日短周期节奏并不相同：今天适合收束，不代表整个大运缺少机会。'] : ['各层结果没有明显冲突，但仍应以现实反馈持续校验。'];
    return { sources, agreements, differences };
  }

  function rectifyTime(input, answers) {
    const periods = {
      dawn: [4, 6], morning: [8, 10], noon: [12, 14], afternoon: [14, 16], evening: [18, 20], night: [22, 0, 2], unknown: []
    };
    const traitGods = {
      expressive: ['食神', '伤官', '偏财'], structured: ['正官', '正财', '正印'],
      decisive: ['七杀', '比肩', '劫财'], reflective: ['偏印', '正印', '食神']
    };
    const eventGods = {
      career: ['正官', '七杀', '正印'], finance: ['正财', '偏财', '食神'],
      relation: ['正财', '偏财', '正官'], study: ['正印', '偏印', '食神'], move: ['偏财', '伤官', '七杀']
    };
    const preferredHours = periods[answers.period] || [];
    const candidates = [];
    for (let hour = 0; hour < 24; hour += 2) {
      const chart = root.TianjiEngine.buildChart(input.y, input.m, input.d, hour, 0, input.gender || 'male');
      const timeGod = chart.pillars[3].god;
      let score = 42;
      const evidence = [];
      if (preferredHours.includes(hour)) { score += 20; evidence.push('符合所选大概时段'); }
      (answers.traits || []).forEach(trait => {
        if ((traitGods[trait] || []).includes(timeGod)) { score += 8; evidence.push(`时柱${timeGod}与所选特征相符`); }
      });
      if (answers.eventYear) {
        const lunar = root.Solar.fromYmd(Number(answers.eventYear), 6, 1).getLunar();
        const eventGod = tenGod(chart.dayGan, lunar.getYearInGanZhi()[0]);
        if ((eventGods[answers.eventType] || []).includes(eventGod)) { score += 12; evidence.push(`${answers.eventYear}年十神主题与事件类别可对应`); }
        if (CHONG[chart.pillars[3].zhi] === lunar.getYearInGanZhi()[1]) { score += 5; evidence.push('事件年触及时支变化信号'); }
      }
      candidates.push({ hour, branch: chart.pillars[3].zhi, ganZhi: chart.pillars[3].ganZhi, god: timeGod, score: clamp(score, 20, 95), evidence });
    }
    return candidates.sort((a, b) => b.score - a.score).slice(0, 4).map((item, index) => ({ ...item, rank: index + 1, confidence: index === 0 ? '优先核对' : '候选比较' }));
  }

  function compareOptions(chart, options) {
    const today = root.TianjiEngine.dailyFortune(chart, root.Solar.fromYmd(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()));
    const analysis = root.TianjiEngine.analyze(chart);
    const supportive = average((analysis.yong || []).map(wx => chart.wx[wx] || 0));
    const rows = (options || []).map(option => {
      const metrics = {
        timing: clamp(Number(option.timing) * 14 + today.dims.action * 0.3),
        risk: clamp((6 - Number(option.risk)) * 15 + today.dims.state * 0.2),
        stability: clamp(Number(option.stability) * 16 + today.dims.finance * 0.2),
        growth: clamp(Number(option.growth) * 15 + today.dims.communication * 0.25),
        fit: clamp(50 + supportive * 6 + (Number(option.growth) - Number(option.risk)) * 4)
      };
      const score = clamp(metrics.timing * 0.25 + metrics.risk * 0.2 + metrics.stability * 0.2 + metrics.growth * 0.2 + metrics.fit * 0.15);
      return { ...option, metrics, score };
    }).sort((a, b) => b.score - a.score);
    const gap = rows.length > 1 ? rows[0].score - rows[1].score : 0;
    return {
      rows,
      summary: gap >= 8 ? `${rows[0].name}在当前输入条件下相对更协调，但应先做小规模验证。` : '两个选项接近，差异不足以支持绝对结论，建议比较不可逆成本和退出机制。',
      caveat: '分数整合你的自评与当前节奏，只用于梳理取舍，不替你作决定。'
    };
  }

  function backtestEvent(chart, event) {
    const year = Number(event.year);
    const lunar = root.Solar.fromYmd(year, 6, 1).getLunar();
    const ganZhi = lunar.getYearInGanZhi();
    const god = tenGod(chart.dayGan, ganZhi[0]);
    const matches = {
      career: ['正官', '七杀', '正印'], finance: ['正财', '偏财', '食神'],
      relation: ['正财', '偏财', '正官'], study: ['正印', '偏印', '食神'], move: ['偏财', '伤官', '七杀']
    };
    const aligned = (matches[event.type] || []).includes(god);
    const branch = CHONG[chart.pillars[2].zhi] === ganZhi[1] ? '该年地支冲本命日支，变化感可能更明显。' : LIUHE[chart.pillars[2].zhi] === ganZhi[1] ? '该年地支与本命日支六合，关系与协作主题可能更突出。' : '该年地支没有直接触发本命日支六冲六合。';
    return {
      year, ganZhi, god,
      level: aligned ? '存在可解释对应' : '对应度有限',
      explanation: aligned ? `${year}年为${ganZhi}，对日主形成${god}主题，与所选事件类别有可讨论的结构对应。` : `${year}年为${ganZhi}，十神主题为${god}，与所选事件类别没有直接对应，不能为迎合结果强行解释。`,
      branch,
      caveat: '事件回测只能检查既有规则与经历是否有结构对应，不能反向证明出生时辰或预测未来。'
    };
  }

  function icsEscape(text) {
    return String(text || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }

  function buildIcs(events, calendarName) {
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DAOFA//Rhythm Calendar//ZH', `X-WR-CALNAME:${icsEscape(calendarName || '道法自然个人节奏')}`];
    (events || []).forEach((event, index) => {
      const date = String(event.date || '').replace(/-/g, '');
      if (!/^\d{8}$/.test(date)) return;
      lines.push('BEGIN:VEVENT', `UID:${date}-${index}-${Math.random().toString(36).slice(2, 9)}@daofa`, `DTSTAMP:${now}`, `DTSTART;VALUE=DATE:${date}`, `SUMMARY:${icsEscape(event.title)}`, `DESCRIPTION:${icsEscape(event.description || '')}`, 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  root.TianjiPlanner = {
    tenGod, currentDaYun, topicCards, lifeTimeline, yearCards, monthWindows,
    calendarMonth, relationshipGraph, crossValidate, rectifyTime, compareOptions,
    backtestEvent, buildIcs, clamp, average
  };
})(typeof window !== 'undefined' ? window : globalThis);
