/* ============================ 出生资料、时间校正与现代摘要 ============================ */
(function (root) {
  const CITIES = [
    { name: '北京', country: '中国', timeZone: 'Asia/Shanghai', longitude: 116.4074, baseOffset: 8, aliases: ['Beijing'] },
    { name: '上海', country: '中国', timeZone: 'Asia/Shanghai', longitude: 121.4737, baseOffset: 8, aliases: ['Shanghai'] },
    { name: '广州', country: '中国', timeZone: 'Asia/Shanghai', longitude: 113.2644, baseOffset: 8, aliases: ['Guangzhou'] },
    { name: '佛山', country: '中国', timeZone: 'Asia/Shanghai', longitude: 113.1214, baseOffset: 8, aliases: ['Foshan'] },
    { name: '深圳', country: '中国', timeZone: 'Asia/Shanghai', longitude: 114.0579, baseOffset: 8, aliases: ['Shenzhen'] },
    { name: '香港', country: '中国', timeZone: 'Asia/Hong_Kong', longitude: 114.1694, baseOffset: 8, aliases: ['Hong Kong', 'Hongkong'] },
    { name: '澳门', country: '中国', timeZone: 'Asia/Macau', longitude: 113.5439, baseOffset: 8, aliases: ['Macau', 'Macao'] },
    { name: '成都', country: '中国', timeZone: 'Asia/Shanghai', longitude: 104.0665, baseOffset: 8, aliases: ['Chengdu'] },
    { name: '重庆', country: '中国', timeZone: 'Asia/Shanghai', longitude: 106.5516, baseOffset: 8, aliases: ['Chongqing'] },
    { name: '武汉', country: '中国', timeZone: 'Asia/Shanghai', longitude: 114.3054, baseOffset: 8, aliases: ['Wuhan'] },
    { name: '杭州', country: '中国', timeZone: 'Asia/Shanghai', longitude: 120.1551, baseOffset: 8, aliases: ['Hangzhou'] },
    { name: '南京', country: '中国', timeZone: 'Asia/Shanghai', longitude: 118.7969, baseOffset: 8, aliases: ['Nanjing'] },
    { name: '西安', country: '中国', timeZone: 'Asia/Shanghai', longitude: 108.9398, baseOffset: 8, aliases: ["Xi'an", 'Xian'] },
    { name: '长沙', country: '中国', timeZone: 'Asia/Shanghai', longitude: 112.9388, baseOffset: 8, aliases: ['Changsha'] },
    { name: '济南', country: '中国', timeZone: 'Asia/Shanghai', longitude: 117.1201, baseOffset: 8, aliases: ['Jinan'] },
    { name: '青岛', country: '中国', timeZone: 'Asia/Shanghai', longitude: 120.3826, baseOffset: 8, aliases: ['Qingdao'] },
    { name: '厦门', country: '中国', timeZone: 'Asia/Shanghai', longitude: 118.0894, baseOffset: 8, aliases: ['Xiamen'] },
    { name: '福州', country: '中国', timeZone: 'Asia/Shanghai', longitude: 119.2965, baseOffset: 8, aliases: ['Fuzhou'] },
    { name: '昆明', country: '中国', timeZone: 'Asia/Shanghai', longitude: 102.8329, baseOffset: 8, aliases: ['Kunming'] },
    { name: '贵阳', country: '中国', timeZone: 'Asia/Shanghai', longitude: 106.6302, baseOffset: 8, aliases: ['Guiyang'] },
    { name: '南宁', country: '中国', timeZone: 'Asia/Shanghai', longitude: 108.3669, baseOffset: 8, aliases: ['Nanning'] },
    { name: '海口', country: '中国', timeZone: 'Asia/Shanghai', longitude: 110.1983, baseOffset: 8, aliases: ['Haikou'] },
    { name: '哈尔滨', country: '中国', timeZone: 'Asia/Shanghai', longitude: 126.6424, baseOffset: 8, aliases: ['Harbin'] },
    { name: '沈阳', country: '中国', timeZone: 'Asia/Shanghai', longitude: 123.4315, baseOffset: 8, aliases: ['Shenyang'] },
    { name: '大连', country: '中国', timeZone: 'Asia/Shanghai', longitude: 121.6147, baseOffset: 8, aliases: ['Dalian'] },
    { name: '长春', country: '中国', timeZone: 'Asia/Shanghai', longitude: 125.3235, baseOffset: 8, aliases: ['Changchun'] },
    { name: '天津', country: '中国', timeZone: 'Asia/Shanghai', longitude: 117.2009, baseOffset: 8, aliases: ['Tianjin'] },
    { name: '郑州', country: '中国', timeZone: 'Asia/Shanghai', longitude: 113.6254, baseOffset: 8, aliases: ['Zhengzhou'] },
    { name: '石家庄', country: '中国', timeZone: 'Asia/Shanghai', longitude: 114.5149, baseOffset: 8, aliases: ['Shijiazhuang'] },
    { name: '合肥', country: '中国', timeZone: 'Asia/Shanghai', longitude: 117.2272, baseOffset: 8, aliases: ['Hefei'] },
    { name: '南昌', country: '中国', timeZone: 'Asia/Shanghai', longitude: 115.8582, baseOffset: 8, aliases: ['Nanchang'] },
    { name: '乌鲁木齐', country: '中国', timeZone: 'Asia/Shanghai', longitude: 87.6168, baseOffset: 8, aliases: ['Urumqi'] },
    { name: '拉萨', country: '中国', timeZone: 'Asia/Shanghai', longitude: 91.1409, baseOffset: 8, aliases: ['Lhasa'] },
    { name: '台北', country: '中国', timeZone: 'Asia/Taipei', longitude: 121.5654, baseOffset: 8, aliases: ['Taipei'] },
    { name: '多伦多', country: '加拿大', timeZone: 'America/Toronto', longitude: -79.3832, baseOffset: -5, aliases: ['Toronto'] },
    { name: '温哥华', country: '加拿大', timeZone: 'America/Vancouver', longitude: -123.1207, baseOffset: -8, aliases: ['Vancouver'] },
    { name: '蒙特利尔', country: '加拿大', timeZone: 'America/Toronto', longitude: -73.5673, baseOffset: -5, aliases: ['Montreal'] },
    { name: '纽约', country: '美国', timeZone: 'America/New_York', longitude: -74.006, baseOffset: -5, aliases: ['New York'] },
    { name: '洛杉矶', country: '美国', timeZone: 'America/Los_Angeles', longitude: -118.2437, baseOffset: -8, aliases: ['Los Angeles'] },
    { name: '伦敦', country: '英国', timeZone: 'Europe/London', longitude: -0.1276, baseOffset: 0, aliases: ['London'] },
    { name: '巴黎', country: '法国', timeZone: 'Europe/Paris', longitude: 2.3522, baseOffset: 1, aliases: ['Paris'] },
    { name: '悉尼', country: '澳大利亚', timeZone: 'Australia/Sydney', longitude: 151.2093, baseOffset: 10, aliases: ['Sydney'] },
    { name: '新加坡', country: '新加坡', timeZone: 'Asia/Singapore', longitude: 103.8198, baseOffset: 8, aliases: ['Singapore'] },
    { name: '东京', country: '日本', timeZone: 'Asia/Tokyo', longitude: 139.6917, baseOffset: 9, aliases: ['Tokyo'] },
    { name: '首尔', country: '韩国', timeZone: 'Asia/Seoul', longitude: 126.978, baseOffset: 9, aliases: ['Seoul'] },
    { name: '曼谷', country: '泰国', timeZone: 'Asia/Bangkok', longitude: 100.5018, baseOffset: 7, aliases: ['Bangkok'] },
    { name: '吉隆坡', country: '马来西亚', timeZone: 'Asia/Kuala_Lumpur', longitude: 101.6869, baseOffset: 8, aliases: ['Kuala Lumpur'] }
  ].map(city => ({ ...city, label: `${city.name}，${city.country}` }));

  function normalized(value) {
    return String(value || '').trim().toLowerCase().replace(/[，,\s]+/g, '');
  }

  function resolveCity(value) {
    const needle = normalized(value);
    if (!needle) return null;
    return CITIES.find(city => {
      const names = [city.name, city.label].concat(city.aliases || []);
      return names.some(name => normalized(name) === needle);
    }) || null;
  }

  function validateSolarDate(year, month, day, now) {
    if (![year, month, day].every(Number.isInteger)) return { ok: false, message: '请完整填写出生年月日。' };
    if (year < 1901 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
      return { ok: false, message: '出生日期需在 1901 至 2099 年之间。' };
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
      return { ok: false, message: '这个日期不存在，请检查月份、日期或闰年。' };
    }
    const today = now || new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    if (date.getTime() > todayUtc) return { ok: false, message: '出生日期不能晚于今天。' };
    return { ok: true, date };
  }

  function zoneParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    const parts = {};
    formatter.formatToParts(date).forEach(part => {
      if (part.type !== 'literal') parts[part.type] = Number(part.value);
    });
    return { y: parts.year, m: parts.month, d: parts.day, h: parts.hour, mi: parts.minute, s: parts.second };
  }

  function offsetAt(date, timeZone) {
    const p = zoneParts(date, timeZone);
    const represented = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s || 0);
    return Math.round((represented - date.getTime()) / 60000);
  }

  function inspectLocalTime(input, city) {
    if (!city || !input || input.unknown) return { valid: true, ambiguous: false, offsets: [] };
    const wall = Date.UTC(input.y, input.m - 1, input.d, input.h, input.mi || 0, 0);
    const offsets = new Set();
    [-36, -12, 0, 12, 36].forEach(hours => {
      offsets.add(offsetAt(new Date(wall + hours * 3600000), city.timeZone));
    });
    const matches = [];
    offsets.forEach(offset => {
      const instant = new Date(wall - offset * 60000);
      const p = zoneParts(instant, city.timeZone);
      if (p.y === input.y && p.m === input.m && p.d === input.d && p.h === input.h && p.mi === (input.mi || 0)) {
        matches.push({ offset, instant });
      }
    });
    return {
      valid: matches.length > 0,
      ambiguous: matches.length > 1,
      offsets: matches.map(match => match.offset),
      instant: matches.length ? matches[0].instant : null
    };
  }

  function dayOfYear(year, month, day) {
    return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000);
  }

  function equationOfTime(year, month, day) {
    const b = 2 * Math.PI * (dayOfYear(year, month, day) - 81) / 364;
    return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  }

  function applyTimeCorrection(input, city, mode) {
    const original = { y: input.y, m: input.m, d: input.d, h: input.h, mi: input.mi || 0 };
    if (input.unknown || mode !== 'solar' || !city) {
      return { ...original, correctionMinutes: 0, note: input.unknown ? '出生时辰未知，使用日间基准生成简化分析。' : '采用出生地民用标准时间。' };
    }
    const inspected = inspectLocalTime(input, city);
    const actualOffset = inspected.offsets.length ? inspected.offsets[0] : city.baseOffset * 60;
    const daylightMinutes = actualOffset - city.baseOffset * 60;
    const longitudeMinutes = 4 * (city.longitude - city.baseOffset * 15);
    const correction = Math.round(-daylightMinutes + longitudeMinutes + equationOfTime(input.y, input.m, input.d));
    const corrected = new Date(Date.UTC(input.y, input.m - 1, input.d, input.h, input.mi || 0) + correction * 60000);
    const sign = correction >= 0 ? '+' : '';
    return {
      y: corrected.getUTCFullYear(), m: corrected.getUTCMonth() + 1, d: corrected.getUTCDate(),
      h: corrected.getUTCHours(), mi: corrected.getUTCMinutes(), correctionMinutes: correction,
      note: `真太阳时校正 ${sign}${correction} 分钟（经度与均时差，已处理夏令时）。`
    };
  }

  const TRAITS = {
    木: ['成长与连接', '重视成长、关系与长期积累，通常会先寻找可以持续发展的路径。'],
    火: ['表达与推动', '倾向以热情和行动带动事情，适合把想法转化成可见成果。'],
    土: ['稳定与承载', '擅长建立秩序、承担责任，并把分散资源整理成可靠基础。'],
    金: ['判断与执行', '重视标准、效率与边界，面对复杂问题时倾向先厘清规则。'],
    水: ['观察与适应', '善于收集信息、理解变化，并在不同情境之间调整方法。']
  };
  const STAGE_WORDS = {
    比肩: ['自主建立', '适合建立自己的节奏，同时留意协作中的边界。'], 劫财: ['资源重整', '合作与竞争同时增加，宜先把分工及成本说清楚。'],
    食神: ['稳定输出', '创作、表达与生活品质较值得投入。'], 伤官: ['突破表达', '改变方法的动力增强，重要沟通宜保留余地。'],
    正财: ['务实累积', '更适合用稳定行动换取可衡量成果。'], 偏财: ['机会连接', '外部机会增加时，仍要先验证条件与风险。'],
    正官: ['结构进阶', '规则、责任与职业位置成为阶段重点。'], 七杀: ['压力转化', '挑战感上升，清晰优先级比盲目加速更重要。'],
    正印: ['学习沉淀', '适合补足知识、建立方法及接受可靠支持。'], 偏印: ['专精探索', '适合深入冷门或专业问题，也要避免封闭思考。']
  };

  function buildCoreSummary(chart, analysis, currentYear) {
    const trait = TRAITS[chart.dayWx] || TRAITS.土;
    const active = (chart.daYun || []).find(item => currentYear >= item.startYear && currentYear <= item.endYear) || (chart.daYun || [])[0];
    const stage = active && STAGE_WORDS[active.god] ? STAGE_WORDS[active.god] : ['稳步整理', '先确认现实条件，再逐步推进重要事项。'];
    const yong = analysis && analysis.yong ? analysis.yong.join('、') : chart.dayWx;
    const caution = analysis && analysis.ji ? analysis.ji.join('、') : chart.strongest;
    const level = analysis && analysis.level ? analysis.level : '基础结构';
    const keywords = active ? `${stage[0]} · ${active.god} · ${yong}元素` : `${trait[0]} · 稳定 · 观察`;
    return [
      { key: 'trait', label: '底层特质', title: trait[0], detail: trait[1] },
      { key: 'strength', label: '核心优势', title: `${level}结构`, detail: `目前较容易从${yong}相关的学习、资源或行动方式获得支持。` },
      { key: 'caution', label: '需要注意', title: '避免单一用力', detail: `${caution}相关议题较容易过度或失衡，重要决定宜加入事实校验。` },
      { key: 'stage', label: '目前人生阶段', title: active ? `${active.ganZhi} · ${stage[0]}` : stage[0], detail: stage[1] },
      { key: 'next', label: '未来90日关键词', title: keywords, detail: '关键词表示较值得观察的方向，不代表确定事件；每月可结合现实进度重新检查。' }
    ];
  }

  function dailyDecision(fortune) {
    const bestByGod = {
      正官: '整理流程、确认责任与完成正式事项', 七杀: '处理最重要的难题，并为行动设置边界',
      正印: '学习、复盘与向可靠的人请教', 偏印: '集中研究一个需要深度思考的问题',
      正财: '推进可量化的工作与稳健财务安排', 偏财: '拓展联系，但先核实机会条件',
      食神: '创作、表达与完成可持续的小成果', 伤官: '提出改进方案，并留意表达方式',
      比肩: '独立推进重点任务，同时同步关键伙伴', 劫财: '重新确认分工、成本与共同目标'
    };
    const level = fortune.score >= 75 ? '顺势推进' : fortune.score >= 55 ? '稳中有进' : fortune.score >= 40 ? '先稳后动' : '降低负荷';
    return {
      level,
      best: bestByGod[fortune.god] || '完成一件最重要且可验证的小事',
      avoid: fortune.chongSelf ? '避免在情绪高点作重大决定或正面冲突' : '避免同时开启太多任务，分散注意力',
      reminder: fortune.heSelf ? '适合修复关系或确认合作共识。' : `保持节奏，重要事项以现实证据为准；可留意${fortune.luckyDir}相关动线。`
    };
  }

  root.TianjiProfile = {
    CITIES, resolveCity, validateSolarDate, inspectLocalTime, applyTimeCorrection,
    buildCoreSummary, dailyDecision, equationOfTime
  };
})(typeof window !== 'undefined' ? window : globalThis);
