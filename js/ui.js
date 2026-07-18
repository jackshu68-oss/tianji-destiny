/* Theme and bilingual interface preferences shared by every page. */
(function (root) {
  'use strict';

  const LANGUAGE_KEY = 'tianji_language_v1';
  const THEME_KEY = 'tianji_theme_v1';
  const MESSAGES = {
    zh: {
      'theme.modern': '切换到现代雅白风格',
      'theme.classic': '切换到经典黑金风格',
      'language.english': 'Switch to English',
      'language.chinese': '切换到中文',
      'daily.kicker': '我的每日万年历',
      'daily.title': '{name} · 今日节奏',
      'daily.current': '当前每日首页命盘',
      'daily.change': '切换命盘',
      'daily.full': '查看完整命盘',
      'daily.new': '新增命盘',
      'daily.today': '回到今天',
      'daily.previous': '前一天',
      'daily.next': '后一天',
      'daily.solar': '阳历',
      'daily.lunar': '农历',
      'daily.almanac': '万年历',
      'daily.yearPillar': '年柱',
      'daily.monthPillar': '月柱',
      'daily.dayPillar': '日柱',
      'daily.zodiac': '生肖',
      'daily.rhythm': '今日节奏',
      'daily.best': '最适合',
      'daily.avoid': '要避免',
      'daily.reminder': '今日提醒',
      'daily.yi': '今日宜',
      'daily.ji': '今日忌',
      'daily.yiMark': '宜',
      'daily.jiMark': '忌',
      'daily.dim.action': '行动',
      'daily.dim.communication': '沟通',
      'daily.dim.finance': '财务',
      'daily.dim.relation': '关系',
      'daily.dim.state': '状态',
      'profile.active': '每日首页',
      'profile.setActive': '设为每日首页',
      'profile.current': '当前首页',
      'profile.savedActive': '已保存并设为每日首页。',
      'profile.unknownCity': '未设置城市',
      'profile.unknownTime': '时辰未知',
      'profile.recordedTime': '时辰已记录',
      'profile.noNote': '暂无备注',
      'profile.use': '使用',
      'profile.edit': '编辑',
      'profile.delete': '删除',
      'dashboard.today': '今天 · {level}',
      'dashboard.month': '本月 · {ganZhi} {god}',
      'dashboard.year': '今年 · {ganZhi} {god}',
      'dashboard.avoid': '避免：{text}',
      'daily.scoreNote': '由五个生活维度综合，不代表确定吉凶',
      'daily.luckyDirection': '幸运方位',
      'daily.supportingElements': '喜用五行',
      'daily.luckyColors': '幸运色',
      'daily.clash': '今日冲煞',
      'daily.dayInfo': '{ganZhi}日　农历{lunar}　纳音「{naYin}」　值神{god}',
      'common.day': '日',
      'common.none': '—'
    },
    en: {
      'theme.modern': 'Switch to Modern Light',
      'theme.classic': 'Switch to Classic Black & Gold',
      'language.english': 'Switch to English',
      'language.chinese': '切换到中文',
      'daily.kicker': 'MY DAILY ALMANAC',
      'daily.title': 'Daily Rhythm · {name}',
      'daily.current': 'Active chart for your daily home',
      'daily.change': 'Switch chart',
      'daily.full': 'Full chart',
      'daily.new': 'New chart',
      'daily.today': 'Today',
      'daily.previous': 'Previous day',
      'daily.next': 'Next day',
      'daily.solar': 'Solar',
      'daily.lunar': 'Lunar',
      'daily.almanac': 'Chinese Almanac',
      'daily.yearPillar': 'Year pillar',
      'daily.monthPillar': 'Month pillar',
      'daily.dayPillar': 'Day pillar',
      'daily.zodiac': 'Zodiac',
      'daily.rhythm': "Today's rhythm",
      'daily.best': 'Best focus',
      'daily.avoid': 'Avoid',
      'daily.reminder': 'Reminder',
      'daily.yi': 'Favourable',
      'daily.ji': 'Avoid today',
      'daily.yiMark': 'DO',
      'daily.jiMark': 'NO',
      'daily.dim.action': 'Action',
      'daily.dim.communication': 'Communication',
      'daily.dim.finance': 'Finance',
      'daily.dim.relation': 'Relationships',
      'daily.dim.state': 'Wellbeing',
      'profile.active': 'DAILY HOME',
      'profile.setActive': 'Set as daily home',
      'profile.current': 'Current home',
      'profile.savedActive': 'Saved and set as your daily home.',
      'profile.unknownCity': 'City not set',
      'profile.unknownTime': 'Birth time unknown',
      'profile.recordedTime': 'Birth time recorded',
      'profile.noNote': 'No notes',
      'profile.use': 'Use',
      'profile.edit': 'Edit',
      'profile.delete': 'Delete',
      'dashboard.today': 'Today · {level}',
      'dashboard.month': 'This month · {ganZhi} {god}',
      'dashboard.year': 'This year · {ganZhi} {god}',
      'dashboard.avoid': 'Avoid: {text}',
      'daily.scoreNote': 'A five-area rhythm indicator, not a prediction of certain outcomes',
      'daily.luckyDirection': 'Supportive direction',
      'daily.supportingElements': 'Supportive elements',
      'daily.luckyColors': 'Supportive colours',
      'daily.clash': 'Daily clash',
      'daily.dayInfo': '{ganZhi} day · Lunar {lunar} · Na Yin {naYin} · Ten God {god}',
      'common.day': 'Day',
      'common.none': '—'
    }
  };

  const ENGLISH_PHRASES = {
    '排盘': 'Chart', '合婚': 'Compatibility', '梅花': 'Meihua', '奇门': 'Qimen', '塔罗': 'Tarot', '雷诺曼': 'Lenormand', '择吉': 'Date Finder', '界面偏好': 'Interface preferences', '播放舒缓音乐': 'Play ambient music', '回到顶部': 'Back to top',
    '道法自然 · 个人洞察工具': 'DAOFA · PERSONAL INSIGHT', '看懂自己': 'Understand Yourself', '把握时机': 'Move With the Moment',
    '输入出生资料，快速了解你的性格底层、事业财运、关系模式，': 'Enter birth details to explore your underlying traits, career and wealth patterns, relationships,',
    '以及目前所处的人生阶段。': 'and the life stage you are moving through now.', '免费生成我的人生图谱': 'Create My Life Map',
    '出生资料只保存在你的装置中，不会自动上传': 'Birth details stay on this device and are never uploaded automatically',
    '结合八字、紫微与流年，以现代方式解读传统智慧': 'BaZi, Zi Wei and timing cycles translated into modern language',
    '你将看到': 'WHAT YOU WILL SEE', '先给答案，再看依据': 'Start With the Answer, Then See the Evidence',
    '30 秒读懂重点，需要时再展开专业命盘。': 'Understand the essentials in 30 seconds, then open the technical chart when useful.',
    '核心性格与天赋': 'Core Traits and Talents', '理解你的底层驱动力、优势与惯常反应。': 'Understand your drivers, strengths and habitual responses.',
    '事业与财富模式': 'Career and Wealth Patterns', '看见适合你的工作节奏、资源使用与风险点。': 'See your working rhythm, use of resources and risk points.',
    '感情与人际倾向': 'Relationship Tendencies', '整理关系需求、沟通方式与容易摩擦的位置。': 'Clarify relationship needs, communication styles and recurring friction.',
    '当前大运阶段': 'Current Ten-Year Phase', '把十年背景转化成当下值得关注的人生主题。': 'Turn the ten-year backdrop into themes worth watching now.',
    '本年与本月重点': 'Year and Month Focus', '以趋势语言提示机会窗口与需要控制的风险。': 'Identify opportunity windows and risks using trend-based language.',
    '今日行动建议': "Today's Action", '只突出最适合、要避免与一项现实提醒。': 'See one best focus, one thing to avoid and one practical reminder.',
    '已为你保存命盘': 'Your chart is saved', '查看我的每日运势': 'Open Daily Reading', '重新排盘': 'New Chart',
    '我的每日万年历': 'MY DAILY ALMANAC', '当前每日首页命盘': 'Active chart for your daily home', '切换命盘': 'Switch chart', '查看完整命盘': 'Full chart', '新增命盘': 'New chart', '回到今天': 'Today',
    '万年历': 'Chinese Almanac', '年柱': 'Year pillar', '月柱': 'Month pillar', '日柱': 'Day pillar', '生肖': 'Zodiac', '今日节奏': "Today's rhythm", '今日宜': 'Favourable', '今日忌': 'Avoid today',
    '个人工作台': 'PERSONAL WORKSPACE', '当前命盘': 'Current Chart', '先看今天与当前阶段，再按需要进入时间轴、日历和工具。': 'Start with today and your current phase, then open the timeline, calendar or tools.',
    '阅读模式': 'Reading mode', '简洁': 'Simple', '专业': 'Professional', '今日': 'Today', '人生分析': 'Life Analysis', '时间轴': 'Timeline', '日历': 'Calendar', '决策工具': 'Decision Tools', '我的资料': 'My Data',
    '多层交叉整理': 'CROSS-CHECKED LAYERS', '一致、分歧与依据': 'Agreements, Differences and Evidence',
    '分别展示本命、十年阶段、紫微关键宫与短周期节奏，不把不同时间尺度混成一个结论。': 'Natal structure, ten-year phase, key Zi Wei palaces and short-term rhythm are kept separate instead of being forced into one conclusion.',
    '一致提示': 'Shared signals', '需要区分': 'Keep distinct', '按人生问题阅读': 'READ BY LIFE QUESTION', '结论、依据、现实表现与行动建议': 'Conclusion, Evidence, Reality and Action',
    '每一项都保留推导依据，避免只给一段无法校验的笼统描述。': 'Each item keeps its reasoning so the result can be checked rather than accepted as a vague statement.',
    'AI 命盘问答': 'AI CHART Q&A', '只根据你的命盘回答': 'Answers Grounded in Your Chart',
    '回答会引用日主、结构、大运和未来三个月窗口；资料不足时必须明确说明限制。': 'Answers cite your day master, structure, ten-year phase and next three months, and state limitations when evidence is insufficient.',
    '人生时间轴': 'LIFE TIMELINE', '十年阶段的主题与现实管理': 'Ten-Year Themes and Practical Management',
    '年度卡': 'YEAR CARDS', '近七年观察窗口': 'Seven-Year Observation Window', '流月窗口': 'MONTHLY WINDOWS', '未来六个月的推进与收束节奏': 'Momentum and consolidation over the next six months',
    '个人节奏日历': 'PERSONAL RHYTHM CALENDAR', '上个月': 'Previous month', '下个月': 'Next month', '自订事项': 'Custom event', '例如：重要会议': 'e.g. Important meeting',
    '加入日历': 'Add to calendar', '导出 Apple / Google 日历': 'Export Apple / Google Calendar',
    '推测性工具': 'EXPLORATORY TOOL', '出生时辰校正': 'Birth-Time Rectification', '选项比较器': 'OPTION COMPARATOR', '事件回测': 'EVENT BACKTEST',
    '多人命盘库': 'CHART LIBRARY', '本人、伴侣、家人和合作伙伴': 'Self, Partner, Family and Collaborators',
    '昵称': 'Nickname', '例如：妈妈': 'e.g. Mum', '关系': 'Relationship', '备注': 'Notes', '只保存在本机': 'Stored on this device only', '保存当前命盘': 'Save Current Chart',
    '本人': 'Self', '伴侣': 'Partner', '子女': 'Child', '父母': 'Parent', '合作伙伴': 'Collaborator', '朋友': 'Friend', '其他': 'Other',
    '匿名分享': 'ANONYMOUS SHARING', '分享结论，不分享出生资料': 'Share Conclusions, Not Birth Details', '有效期': 'Expiry', '24 小时': '24 hours', '7 天': '7 days', '30 天': '30 days', '预览并建立分享链接': 'Preview and Create Link',
    '双模式存储': 'TWO STORAGE MODES', '本机私隐模式 / 端到端加密同步': 'Local Privacy / End-to-End Encrypted Sync', '同步码': 'Sync code', '同步密码': 'Sync passphrase',
    '新建后自动生成': 'Generated when created', '至少 8 个字符': 'At least 8 characters', '建立加密同步': 'Create Encrypted Sync', '更新云端密文': 'Update Encrypted Data', '在本机恢复': 'Restore Here', '撤销云端资料': 'Revoke Cloud Data',
    '默认仍为本机私隐模式。': 'Local privacy mode remains the default.', '本机备份': 'LOCAL BACKUP', '导出或恢复资料文件': 'Export or Restore Your Data', '导出 JSON 备份': 'Export JSON Backup', '选择备份文件': 'Choose Backup File',
    '第一步': 'FIRST STEP', '输入你的生辰': 'Enter Your Birth Details', '按你知道的程度填写。即使不知道出生时辰，也可以先生成清楚标注范围的简化分析。': 'Enter what you know. If the birth time is unknown, you can still create a clearly limited three-pillar analysis.',
    '选择生日历法': 'Choose Calendar Type', '阳历或农历': 'Solar or lunar calendar', '生日历法': 'Calendar type', '阳历': 'Solar', '农历': 'Lunar', '闰月': 'Leap month',
    '填写出生日期与时间': 'Enter Date and Time', '系统会即时检查日期及当地夏令时间': 'The system checks the date and local daylight-saving rules', '出生年份': 'Birth year', '月': 'Month', '日': 'Day', '分': 'Minute',
    '出生时间准确度': 'Birth-time accuracy', '准确': 'Exact', '知道具体时间': 'I know the time', '大约': 'Approximate', '时间可能有偏差': 'The time may be imprecise', '不知道': 'Unknown', '生成简化分析': 'Create a limited analysis', '时（24小时制）': 'Hour (24-hour)',
    '准确时辰可启用紫微斗数与时柱分析。': 'An exact time enables Zi Wei and hour-pillar analysis.', '选择出生地与性别': 'Choose Birthplace and Sex', '出生地用于时区、夏令时及可选真太阳时校正': 'Birthplace determines time zone, daylight saving and optional true-solar-time correction',
    '出生城市': 'Birth city', '输入城市，例如：佛山 / Toronto': 'Enter a city, e.g. Foshan / Toronto', '请选择搜索结果中的城市。': 'Choose a city from the suggestions.', '性别': 'Sex', '乾造 · 男': 'Male chart', '坤造 · 女': 'Female chart',
    '高级设置': 'Advanced settings', '出生时间校正': 'Birth-time correction', '标准时间': 'Civil time', '真太阳时': 'True solar time', '默认采用出生地当时的民用时间。': 'Civil time at the birthplace is used by default.',
    '生成我的命盘 ✦': 'Create My Chart ✦', '正在校正历法': 'Checking calendar data', '校正历法': 'Calendar check', '生成四柱': 'Build four pillars', '建立紫微十二宫': 'Build Zi Wei palaces', '分析五行与十神': 'Analyse elements and Ten Gods', '生成大运流年': 'Build timing cycles',
    '资料只在当前浏览器计算并保存在本机。AI 功能只会在你主动点击时发送当前详解文本。': 'Calculations and saved profiles stay in this browser. Detailed text is sent to AI only when you explicitly request an AI interpretation.',
    '✓ 已保存到本机': '✓ Saved on this device', '↺ 重新排盘': '↺ New chart', '📅 去择吉': 'Date finder', '💞 去合婚': 'Compatibility', '📤 分享': 'Share', '清除存档': 'Clear saved chart',
    '30 秒看懂': '30-SECOND SUMMARY', '你是谁，你在哪，下一步看什么': 'Who You Are, Where You Are, What to Do Next', '先看结论，再按需要展开依据。': 'Read the conclusion first, then open the evidence when needed.',
    '展开专业细盘': 'Open Technical Chart', '四柱、十神、藏干、紫微十二宫与五行依据': 'Four pillars, Ten Gods, hidden stems, Zi Wei palaces and element evidence',
    '四柱八字': 'Four Pillars · BaZi', '八字精批 · 专业细盘': 'Technical BaZi Analysis', '紫微斗数命盘': 'Zi Wei Dou Shu Chart', '主星': 'Major stars', '吉星': 'Supportive stars', '煞星': 'Challenging stars', '杂曜': 'Minor stars', '四化飞星': 'Four Transformations', '五行分布': 'Five-Element Balance',
    '每日运势': 'Daily Rhythm', '前一天': 'Previous day', '后一天': 'Next day', '生成命盘后查看': 'Create a chart to view', '最适合': 'Best focus', '要避免': 'Avoid', '今日提醒': 'Reminder', '查看传统黄历宜忌': 'View Traditional Almanac', '宜': 'Favourable', '忌': 'Avoid',
    '大运流转': 'Ten-Year Cycles', '流年运程': 'Annual Cycles', '传统文化 · 娱乐参考': 'Traditional culture · For reflection and entertainment',
    '选个好日子': 'Find a Supportive Date', '择吉事项': 'Purpose', '起始日期': 'Start date', '结束日期（最多90天）': 'End date (up to 90 days)', '开始择吉 ✦': 'Find Dates ✦',
    '八字合婚': 'BaZi Compatibility', '两人生辰 · 关系结构': 'Two Birth Charts · Relationship Structure', '甲方': 'Person A', '乙方': 'Person B', '生成关系图谱 ✦': 'Create Relationship Map ✦',
    '梅花易数': 'Meihua Yishu', '一念起卦 · 观体用消长': 'Cast a Hexagram · Observe Change', '时间起卦': 'Cast by time', '两数起卦': 'Cast by two numbers', '所问之事': 'Question', '起卦时间': 'Casting time', '第一数': 'First number', '第二数': 'Second number', '任意正整数': 'Any positive integer', '生成梅花卦 ✦': 'Cast Meihua Hexagram ✦',
    '奇门遁甲': 'Qimen Dunjia', '时家转盘 · 九宫观局': 'Rotating Qimen · Nine-Palace View', '起局时间': 'Chart time', '问事类别': 'Question category', '综合': 'General', '事业': 'Career', '财运': 'Wealth', '感情': 'Relationships', '出行': 'Travel', '健康': 'Wellbeing', '生成奇门局 ✦': 'Create Qimen Chart ✦',
    '塔罗牌': 'Tarot', '静心抽牌 · 看见当下线索': 'Draw With Intention · See the Present Pattern', '选择牌阵': 'Choose a spread', '洗牌并抽取 ✦': 'Shuffle and Draw ✦',
    '吉卜赛雷诺曼': 'Lenormand', '三十六象 · 连线读牌': 'Thirty-Six Symbols · Read the Connections', '洗牌并展开 ✦': 'Shuffle and Reveal ✦',
    '关于 · 道法自然': 'ABOUT · DAOFA', '隐私政策': 'Privacy', '使用条款': 'Terms', '更新记录': 'Updates', '分析': 'Analysis', '我的': 'My Data', '关闭': 'Close', '详解': 'Details', '详解 · AI ›': 'Details · AI ›',
    '依据': 'Evidence', '现实表现': 'In practice', '行动建议': 'Action', '财富': 'Wealth', '风险': 'Risk', '当前阶段': 'Current phase', '关系优势': 'Relationship strength', '主要摩擦': 'Main friction', '阅读模式': 'Reading mode', '个人工作台': 'Personal workspace', '手机工作台导航': 'Mobile workspace navigation'
  };

  const TERM_EN = {
    木: 'Wood', 火: 'Fire', 土: 'Earth', 金: 'Metal', 水: 'Water', 东方: 'East', 南方: 'South', 中央: 'Centre', 西方: 'West', 北方: 'North',
    鼠: 'Rat', 牛: 'Ox', 虎: 'Tiger', 兔: 'Rabbit', 龙: 'Dragon', 蛇: 'Snake', 马: 'Horse', 羊: 'Goat', 猴: 'Monkey', 鸡: 'Rooster', 狗: 'Dog', 猪: 'Pig',
    星期日: 'Sunday', 星期一: 'Monday', 星期二: 'Tuesday', 星期三: 'Wednesday', 星期四: 'Thursday', 星期五: 'Friday', 星期六: 'Saturday',
    偏强: 'Relatively strong', 偏弱: 'Relatively weak', 中和: 'Balanced', 基础结构: 'Base structure',
    顺势推进: 'Move forward', 稳中有进: 'Steady progress', 先稳后动: 'Stabilise first', 降低负荷: 'Reduce the load',
    正官: 'Direct Officer', 七杀: 'Seven Killings', 正印: 'Direct Resource', 偏印: 'Indirect Resource', 正财: 'Direct Wealth', 偏财: 'Indirect Wealth', 食神: 'Eating God', 伤官: 'Hurting Officer', 比肩: 'Peer', 劫财: 'Rob Wealth',
    祭祀: 'Rituals', 祈福: 'Prayer', 求嗣: 'Family planning', 开光: 'Consecration', 出行: 'Travel', 解除: 'Release obligations', 修造: 'Renovation', 动土: 'Groundwork', 安床: 'Set a bed', 入宅: 'Move in', 移徙: 'Relocate', 栽种: 'Planting', 纳畜: 'Livestock', 入殓: 'Encoffining', 破土: 'Break ground', 安葬: 'Burial', 开市: 'Open business', 交易: 'Trade', 立券: 'Contracts', 挂匾: 'Install signage', 纳财: 'Receive funds', 嫁娶: 'Marriage', 结婚: 'Marriage', 纳采: 'Engagement', 订盟: 'Agreement', 会亲友: 'Meet friends', 入学: 'Study', 求职: 'Job search', 上梁: 'Raise a beam', 竖柱: 'Set columns', 安门: 'Install doors', 扫舍: 'Cleaning', 沐浴: 'Bathing', 理发: 'Haircut', 作灶: 'Set a stove', 安香: 'Set incense', 冠笄: 'Ceremony', 裁衣: 'Tailoring', 行丧: 'Mourning rites', 词讼: 'Legal disputes', 诸事不宜: 'Avoid major undertakings', 百无禁忌: 'No major restriction'
  };

  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  let language = readPreference(LANGUAGE_KEY, 'zh') === 'en' ? 'en' : 'zh';
  let theme = readPreference(THEME_KEY, 'modern') === 'classic' ? 'classic' : 'modern';

  function readPreference(key, fallback) {
    try { return root.localStorage ? root.localStorage.getItem(key) || fallback : fallback; }
    catch (_error) { return fallback; }
  }

  function writePreference(key, value) {
    try { if (root.localStorage) root.localStorage.setItem(key, value); }
    catch (_error) { /* Preferences can safely fall back to the current session. */ }
  }

  function interpolate(template, variables) {
    return String(template).replace(/\{(\w+)\}/g, (_match, key) => variables && variables[key] != null ? variables[key] : '');
  }

  function t(key, variables) {
    const table = MESSAGES[language] || MESSAGES.zh;
    return interpolate(table[key] || MESSAGES.zh[key] || key, variables);
  }

  function translateTerm(value) {
    if (language !== 'en') return String(value == null ? '' : value);
    return TERM_EN[value] || String(value == null ? '' : value);
  }

  function normalize(value) { return String(value || '').trim().replace(/\s+/g, ' '); }

  function translateTextNode(node) {
    if (!originalText.has(node)) originalText.set(node, node.nodeValue || '');
    const source = originalText.get(node);
    if (language !== 'en') { node.nodeValue = source; return; }
    const translated = ENGLISH_PHRASES[normalize(source)];
    if (!translated) { node.nodeValue = source; return; }
    const leading = (source.match(/^\s*/) || [''])[0];
    const trailing = (source.match(/\s*$/) || [''])[0];
    node.nodeValue = `${leading}${translated}${trailing}`;
  }

  function translateAttributes(element) {
    const names = ['placeholder', 'title', 'aria-label'];
    if (!originalAttributes.has(element)) {
      const saved = {};
      names.forEach(name => { if (element.hasAttribute(name)) saved[name] = element.getAttribute(name); });
      originalAttributes.set(element, saved);
    }
    const saved = originalAttributes.get(element);
    Object.keys(saved).forEach(name => {
      const value = language === 'en' ? ENGLISH_PHRASES[normalize(saved[name])] || saved[name] : saved[name];
      element.setAttribute(name, value);
    });
  }

  function translateTree(target) {
    if (!target || typeof document === 'undefined') return;
    const rootElement = target.nodeType === 9 ? target.documentElement : (target.nodeType === 1 ? target : target.parentElement);
    if (target.nodeType === 3) translateTextNode(target);
    const scope = target.nodeType === 1 || target.nodeType === 9 ? target : rootElement;
    const walker = document.createTreeWalker(scope, 4);
    let node;
    while ((node = walker.nextNode())) translateTextNode(node);
    if (rootElement) {
      translateAttributes(rootElement);
      rootElement.querySelectorAll('[placeholder],[title],[aria-label]').forEach(translateAttributes);
    }
  }

  function updateControls() {
    if (typeof document === 'undefined') return;
    const languageButton = document.getElementById('language-toggle');
    if (languageButton) {
      languageButton.textContent = language === 'zh' ? 'EN' : '中';
      languageButton.title = language === 'zh' ? t('language.english') : t('language.chinese');
      languageButton.setAttribute('aria-label', languageButton.title);
    }
    const themeButton = document.getElementById('theme-toggle');
    if (themeButton) {
      themeButton.textContent = theme === 'modern' ? '◐' : '◑';
      themeButton.title = theme === 'modern' ? t('theme.classic') : t('theme.modern');
      themeButton.setAttribute('aria-label', themeButton.title);
    }
  }

  function applyLanguage() {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language === 'en' ? 'en-CA' : 'zh-CN';
    document.title = language === 'en' ? 'DAOFA | Daily Chinese Almanac & Personal Insight' : '道法自然｜看懂自己，把握时机';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = language === 'en'
      ? 'A private, bilingual daily Chinese almanac and personal insight tool combining BaZi, Zi Wei and timing cycles.'
      : '输入出生资料，快速了解性格底层、事业财运、关系模式与目前人生阶段。结合八字、紫微与流年，以现代方式解读传统智慧。';
    translateTree(document);
    updateControls();
  }

  function setLanguage(next, announce) {
    language = next === 'en' ? 'en' : 'zh';
    writePreference(LANGUAGE_KEY, language);
    applyLanguage();
    if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('tianji:language-changed', { detail: { language, announce: announce !== false } }));
  }

  function applyTheme() {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = theme;
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.content = theme === 'classic' ? '#0a0b0f' : '#f4f0e7';
    updateControls();
  }

  function setTheme(next) {
    theme = next === 'classic' ? 'classic' : 'modern';
    writePreference(THEME_KEY, theme);
    applyTheme();
    if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('tianji:theme-changed', { detail: { theme } }));
  }

  function init() {
    applyTheme();
    applyLanguage();
    const languageButton = document.getElementById('language-toggle');
    const themeButton = document.getElementById('theme-toggle');
    if (languageButton) languageButton.addEventListener('click', () => setLanguage(language === 'zh' ? 'en' : 'zh'));
    if (themeButton) themeButton.addEventListener('click', () => setTheme(theme === 'modern' ? 'classic' : 'modern'));
    const observer = new MutationObserver(mutations => {
      if (language !== 'en') return;
      mutations.forEach(mutation => mutation.addedNodes.forEach(node => translateTree(node)));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  root.TianjiUI = {
    t,
    translateTerm,
    translateTree,
    getLanguage: () => language,
    getTheme: () => theme,
    setLanguage,
    setTheme
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
