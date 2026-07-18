/* ==========================================================================
   道法自然 · 命理计算引擎
   基于 lunar-javascript，封装出：四柱八字 / 五行分布 / 十神 / 大运 / 流年 /
   每日黄历宜忌 / 个性化每日运势评分
   ========================================================================== */

const TianjiEngine = (function () {
  const Solar = window.Solar;

  // 天干五行
  const GAN_WUXING = {
    甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
    己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水'
  };
  // 地支主气五行
  const ZHI_WUXING = {
    子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
    午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水'
  };
  const GAN_YINYANG = {
    甲: '阳', 乙: '阴', 丙: '阳', 丁: '阴', 戊: '阳',
    己: '阴', 庚: '阳', 辛: '阴', 壬: '阳', 癸: '阴'
  };

  const WUXING_COLOR = { 木: '#4ea87b', 火: '#d9534f', 土: '#c9a15a', 金: '#d6c9a8', 水: '#5b8fb9' };

  // 五行生克
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 我生
  const KE = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };   // 我克

  // 十神：以日主(dayGan)为我，判断另一天干的十神
  function tenGod(dayGan, otherGan) {
    const meWx = GAN_WUXING[dayGan];
    const otWx = GAN_WUXING[otherGan];
    const meYy = GAN_YINYANG[dayGan];
    const otYy = GAN_YINYANG[otherGan];
    const same = meYy === otYy;
    if (meWx === otWx) return same ? '比肩' : '劫财';
    if (SHENG[meWx] === otWx) return same ? '食神' : '伤官'; // 我生
    if (KE[meWx] === otWx) return same ? '偏财' : '正财';   // 我克
    if (KE[otWx] === meWx) return same ? '七杀' : '正官';   // 克我
    if (SHENG[otWx] === meWx) return same ? '偏印' : '正印'; // 生我
    return '';
  }

  // 关系类别（用于每日运势判断）：以日主五行 vs 目标五行
  function relation(dayWx, targetWx) {
    if (dayWx === targetWx) return '比劫';      // 同类，助力
    if (SHENG[targetWx] === dayWx) return '印'; // 生我，扶持
    if (SHENG[dayWx] === targetWx) return '食伤'; // 我生，付出/表达
    if (KE[dayWx] === targetWx) return '财';    // 我克，得财
    if (KE[targetWx] === dayWx) return '官杀';  // 克我，压力
    return '';
  }

  // 统计五行分布（8个字，天干各1，地支主气各1）
  function countWuXing(gans, zhis) {
    const c = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    gans.forEach(g => { if (GAN_WUXING[g]) c[GAN_WUXING[g]]++; });
    zhis.forEach(z => { if (ZHI_WUXING[z]) c[ZHI_WUXING[z]]++; });
    return c;
  }

  /* ---------- 主计算：根据出生信息生成命盘 ---------- */
  function buildChart(year, month, day, hour, minute, gender, options) {
    const opts = options || {};
    const timeUnknown = Boolean(opts.timeUnknown);
    const effectiveHour = timeUnknown ? 12 : hour;
    const effectiveMinute = timeUnknown ? 0 : (minute || 0);
    const solar = Solar.fromYmdHms(year, month, day, effectiveHour, effectiveMinute, 0);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();

    const gans = [ec.getYearGan(), ec.getMonthGan(), ec.getDayGan(), ec.getTimeGan()];
    const zhis = [ec.getYearZhi(), ec.getMonthZhi(), ec.getDayZhi(), ec.getTimeZhi()];
    const dayGan = ec.getDayGan();
    const dayWx = GAN_WUXING[dayGan];

    const pillars = [
      { label: '年柱', gan: gans[0], zhi: zhis[0], ganZhi: ec.getYear(), naYin: ec.getYearNaYin(), tag: '祖上/根基' },
      { label: '月柱', gan: gans[1], zhi: zhis[1], ganZhi: ec.getMonth(), naYin: ec.getMonthNaYin(), tag: '父母/事业' },
      { label: '日柱', gan: gans[2], zhi: zhis[2], ganZhi: ec.getDay(), naYin: ec.getDayNaYin(), tag: '自身/配偶' },
      { label: '时柱', gan: gans[3], zhi: zhis[3], ganZhi: ec.getTime(), naYin: ec.getTimeNaYin(), tag: '子女/晚年' }
    ];
    // 各柱天干十神
    pillars.forEach(p => { p.god = (p.gan === dayGan) ? '日主' : tenGod(dayGan, p.gan); p.color = WUXING_COLOR[GAN_WUXING[p.gan]]; });

    const wx = countWuXing(timeUnknown ? gans.slice(0, 3) : gans, timeUnknown ? zhis.slice(0, 3) : zhis);
    // 缺失/最弱五行
    const wxEntries = Object.entries(wx).sort((a, b) => a[1] - b[1]);
    const lacking = wxEntries.filter(e => e[1] === 0).map(e => e[0]);
    const strongest = Object.entries(wx).sort((a, b) => b[1] - a[1])[0][0];

    // 大运
    const g = gender === 'female' ? 0 : 1;
    const yun = ec.getYun(g);
    const daYunArr = yun.getDaYun();
    const daYun = [];
    for (let i = 1; i < daYunArr.length && i <= 9; i++) {
      const d = daYunArr[i];
      const gz = d.getGanZhi();
      if (!gz) continue;
      daYun.push({
        ganZhi: gz,
        startYear: d.getStartYear(),
        endYear: d.getEndYear(),
        startAge: d.getStartAge(),
        endAge: d.getEndAge(),
        god: tenGod(dayGan, gz[0]),
        wx: GAN_WUXING[gz[0]],
        color: WUXING_COLOR[GAN_WUXING[gz[0]]]
      });
    }
    const startInfo = { year: yun.getStartYear(), month: yun.getStartMonth() };

    return {
      solar, lunar, ec,
      y: year, m: month, d: day, h: timeUnknown ? null : hour, mi: timeUnknown ? null : minute,
      birthStr: timeUnknown ? `${year}年${month}月${day}日（时辰未知）` : `${year}年${month}月${day}日 ${String(hour).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}`,
      lunarStr: lunar.getYearInChinese() + '年' + lunar.getMonthInChinese() + '月' + lunar.getDayInChinese(),
      gender, timeUnknown,
      dayGan, dayWx,
      dayGanYinYang: GAN_YINYANG[dayGan],
      shengXiao: lunar.getYearShengXiao(),
      yearGanZhi: lunar.getYearInGanZhi(),
      pillars, wx, lacking, strongest,
      daYun, startInfo
    };
  }

  /* ---------- 每日运势：结合个人日主 + 当日黄历 ---------- */
  function dailyFortune(chart, dSolar) {
    const dLunar = dSolar.getLunar();
    const dayGanZhi = dLunar.getDayInGanZhi();
    const dGan = dLunar.getDayGan();
    const dZhi = dLunar.getDayZhi();
    const dGanWx = GAN_WUXING[dGan];
    const dZhiWx = ZHI_WUXING[dZhi];

    // 关系判断
    const relGan = relation(chart.dayWx, dGanWx);
    const relZhi = relation(chart.dayWx, dZhiWx);
    const god = tenGod(chart.dayGan, dGan);

    // 评分：印/比劫加分，财适中偏好，食伤中性，官杀减分
    const scoreMap = { 印: 22, 比劫: 16, 财: 14, 食伤: 6, 官杀: -8 };
    let score = 62 + (scoreMap[relGan] || 0) + (scoreMap[relZhi] || 0) * 0.6;
    // 冲日主地支：减分
    const dayZhi = chart.pillars[2].zhi;
    const CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
    let chongSelf = false;
    if (CHONG[dayZhi] === dZhi) { score -= 12; chongSelf = true; }
    // 三合/六合 加分
    const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
    let heSelf = false;
    if (LIUHE[dayZhi] === dZhi) { score += 8; heSelf = true; }
    score = Math.max(30, Math.min(98, Math.round(score)));

    // 五维每日决策卡：行动、沟通、财务、关系、状态
    const base = score;
    const dims = {
      action: clamp(base + offsetFor(god, 'career')),
      communication: clamp(base + offsetFor(god, 'communication')),
      finance: clamp(base + offsetFor(god, 'wealth')),
      relation: clamp(base + offsetFor(god, 'love')),
      state: clamp(base + offsetFor(god, 'health'))
    };
    dims.career = dims.action;
    dims.wealth = dims.finance;
    dims.love = dims.relation;
    dims.health = dims.state;

    // 幸运五行/方位/颜色：取能生扶日主者（印+比劫）
    const luckyWx = [chart.dayWx, invSheng(chart.dayWx)]; // 同类 + 生我
    const DIR = { 木: '东方', 火: '南方', 土: '中央', 金: '西方', 水: '北方' };
    const luckyDir = DIR[invSheng(chart.dayWx)];
    const luckyColor = luckyWx.map(w => WUXING_COLOR[w]);

    // 个性化建议文本
    const advice = buildAdvice(god, relGan, chongSelf, heSelf, chart.dayWx);

    return {
      solar: dSolar,
      dateStr: `${dSolar.getYear()}年${dSolar.getMonth()}月${dSolar.getDay()}日`,
      week: '星期' + '日一二三四五六'.charAt(dSolar.getWeek()),
      lunarStr: dLunar.getMonthInChinese() + '月' + dLunar.getDayInChinese(),
      dayGanZhi,
      god,
      score, dims,
      yi: dLunar.getDayYi(),
      ji: dLunar.getDayJi(),
      chong: dLunar.getDayChongDesc(),
      sha: dLunar.getDaySha(),
      jiShen: dLunar.getDayJiShen(),
      xiongSha: dLunar.getDayXiongSha ? dLunar.getDayXiongSha() : [],
      naYin: dLunar.getDayNaYin(),
      pengZu: [dLunar.getPengZuGan(), dLunar.getPengZuZhi()],
      xiu: dLunar.getXiu() + dLunar.getZheng() + dLunar.getAnimal(),
      taishen: dLunar.getDayPositionTai ? dLunar.getDayPositionTai() : '',
      luckyDir, luckyColor, luckyWx,
      chongSelf, heSelf,
      advice
    };
  }

  function clamp(v) { return Math.max(28, Math.min(99, Math.round(v))); }
  function invSheng(wx) { // 生我者
    for (const k in SHENG) if (SHENG[k] === wx) return k;
    return wx;
  }
  function offsetFor(god, dim) {
    const t = {
      career: { 正官: 10, 七杀: 8, 正印: 6, 偏印: 4, 比肩: 3, 劫财: -2, 伤官: -4, 食神: 2, 正财: 4, 偏财: 5 },
      communication: { 正官: 2, 七杀: -3, 正印: 4, 偏印: 1, 比肩: 3, 劫财: -4, 伤官: 10, 食神: 9, 正财: 2, 偏财: 5 },
      wealth: { 正财: 12, 偏财: 14, 食神: 6, 伤官: 5, 比肩: -3, 劫财: -6, 正官: 3, 七杀: 1, 正印: 2, 偏印: 0 },
      love: { 正财: 8, 正官: 6, 偏财: 4, 食神: 5, 伤官: -3, 七杀: -2, 比肩: 0, 劫财: -4, 正印: 3, 偏印: -1 },
      health: { 正印: 10, 偏印: 6, 比肩: 5, 食神: 4, 劫财: -2, 七杀: -8, 正官: -3, 伤官: -4, 正财: 1, 偏财: 0 }
    };
    return (t[dim] && t[dim][god]) || 0;
  }

  function buildAdvice(god, relGan, chong, he, dayWx) {
    const map = {
      印: '今日气场生扶你的日主，贵人运与学习运较旺，适合处理需要智慧与耐心的事，多接受长辈或专业人士的建议。',
      比劫: '今日与你同气相求，行动力与自信心提升，适合主动出击、拓展人脉，但注意与人合作时的分寸，避免因争胜而伤和气。',
      财: '今日财气临身，利于洽谈、交易与理财规划，主动争取机会易有实质收获，但切忌因贪快而冒进。',
      食伤: '今日适合表达与创造，灵感与口才俱佳，宜做展示、沟通、创作类的事；情绪上要留意言多必失，谨言慎行。',
      官杀: '今日外部压力偏大，宜守不宜攻，遇事沉住气、按规矩办，避免与权威、上司正面冲突，稳中求进为上。'
    };
    let s = map[relGan] || '今日运势平稳，宜按部就班、稳步推进。';
    if (chong) s += '　⚠️ 今日地支冲你本命日支，情绪与人际易起波动，重大决定建议缓一缓，出行注意安全。';
    if (he) s += '　✦ 今日与你本命相合，人际和谐、易得助力，是化解旧结、修复关系的好时机。';
    return s;
  }

  /* ---------- 择吉：扫描日期范围内最宜某事项的日子 ---------- */
  function zeji(event, start, end, avoidBranch) {
    const Solar = window.Solar;
    const eventTerms = Array.isArray(event) ? event.filter(Boolean) : [event];
    const DAY = 86400000;
    let t = new Date(start.y, start.m - 1, start.d).getTime();
    const tEnd = new Date(end.y, end.m - 1, end.d).getTime();
    const out = [];
    let count = 0;
    while (t <= tEnd && count < 140) {
      const d = new Date(t);
      const y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate();
      const solar = Solar.fromYmd(y, m, dd);
      const lunar = solar.getLunar();
      const yi = lunar.getDayYi();
      const ji = lunar.getDayJi();
      const gz = lunar.getDayInGanZhi();
      const dayZhi = gz[1];
      const chong = lunar.getDayChong ? lunar.getDayChong() : '';
      const chongDesc = lunar.getDayChongDesc();
      const sha = lunar.getDaySha();
      const jiShen = lunar.getDayJiShen();
      const xiong = lunar.getDayXiongSha ? lunar.getDayXiongSha() : [];
      const naYin = lunar.getDayNaYin();
      const zhiXing = lunar.getDayZhiXing ? lunar.getDayZhiXing() : '';
      const matchedYi = eventTerms.filter(term => yi.indexOf(term) >= 0);
      const matchedJi = eventTerms.filter(term => ji.indexOf(term) >= 0);
      const suitable = matchedYi.length > 0;
      const forbidden = matchedJi.length > 0;

      let score = 48;
      if (suitable) score += 32;
      if (forbidden) score -= 26;
      score += Math.min(jiShen.length, 5) * 3;
      score -= Math.min(xiong.length, 5) * 3;
      let clashSelf = false;
      if (avoidBranch && chong === avoidBranch) { score -= 28; clashSelf = true; }
      score = Math.max(2, Math.min(100, score));

      out.push({
        dateStr: `${y}年${m}月${dd}日`,
        week: '星期' + '日一二三四五六'.charAt(solar.getWeek()),
        gz, naYin,
        yi: yi.slice(0, 10),
        ji: ji.slice(0, 10),
        chong: chongDesc, sha,
        zhiXing,
        suitable, forbidden, clashSelf, matchedYi, matchedJi,
        score: Math.round(score),
        jiShen: jiShen.slice(0, 4),
        xiong: xiong.slice(0, 4)
      });
      t += DAY; count++;
    }
    // 排序：宜该事项优先，分数高优先
    out.sort((a, b) => {
      if (a.suitable !== b.suitable) return a.suitable ? -1 : 1;
      return b.score - a.score;
    });
    return out;
  }

  /* ===================== 八字专业细盘（对标问真八字） ===================== */
  const GAN_ARR = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const ZHI_ARR = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  // 地支藏干（本气/中气/余气）
  const CANG = {
    子: [['癸', 1]], 丑: [['己', 1], ['癸', 2], ['辛', 3]], 寅: [['甲', 1], ['丙', 2], ['戊', 3]],
    卯: [['乙', 1]], 辰: [['戊', 1], ['乙', 2], ['癸', 3]], 巳: [['丙', 1], ['庚', 2], ['戊', 3]],
    午: [['丁', 1], ['己', 2]], 未: [['己', 1], ['丁', 2], ['乙', 3]], 申: [['庚', 1], ['壬', 2], ['戊', 3]],
    酉: [['辛', 1]], 戌: [['戊', 1], ['辛', 2], ['丁', 3]], 亥: [['壬', 1], ['甲', 2]]
  };
  const CHANGSHENG = { 木: '亥', 火: '寅', 土: '寅', 金: '巳', 水: '申' };
  const STAGES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  const WUHU = { 甲: 2, 己: 2, 乙: 4, 庚: 4, 丙: 6, 辛: 6, 丁: 8, 壬: 8, 戊: 0, 癸: 0 };
  const SHEN_OFFSET = { 1: 0, 2: 1, 3: 8, 4: 6, 5: 4, 6: 2, 7: 0, 8: 1, 9: 8, 10: 6, 11: 4, 12: 2 };

  function zIdx(z) { return ZHI_ARR.indexOf(z); }
  function hourToChen(h) { return Math.floor(((h + 1) % 24) / 2) + 1; }
  function xingYun(dayWx, zhi) { return STAGES[(zIdx(zhi) - zIdx(CHANGSHENG[dayWx]) + 12) % 12]; }
  function zhiGan(yearGan, zhi) {
    const off = (zIdx(zhi) - 2 + 12) % 12;
    return GAN_ARR[(WUHU[yearGan] + off) % 10];
  }
  function mingGongZhi(month, chen) {
    const m = (2 - (month - 1) + 12) % 12;
    return ZHI_ARR[(m + (chen - 1)) % 12];
  }
  function isSupport(dayWx, x) { return x === dayWx || SHENG[x] === dayWx; }
  function keWo(wx) { for (const k in KE) if (KE[k] === wx) return k; return wx; }

  function calcShenSha(chart) {
    const dayGan = chart.dayGan, yearZhi = chart.pillars[0].zhi, dayZhi = chart.pillars[2].zhi;
    const out = [];
    const TIANYI = { 甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['卯', '巳'], 癸: ['卯', '巳'], 辛: ['寅', '午'] };
    const WENCHANG = { 甲: '巳', 乙: '午', 丙: '申', 戊: '申', 丁: '酉', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
    const TAOHUA = { 寅: '卯', 午: '卯', 戌: '卯', 申: '酉', 子: '酉', 辰: '酉', 亥: '子', 卯: '子', 未: '子', 巳: '午', 酉: '午', 丑: '午' };
    const YIMA = { 寅: '申', 午: '申', 戌: '申', 申: '寅', 子: '寅', 辰: '寅', 亥: '巳', 卯: '巳', 未: '巳', 巳: '亥', 酉: '亥', 丑: '亥' };
    const HUAGAI = { 寅: '戌', 午: '戌', 戌: '戌', 申: '辰', 子: '辰', 辰: '辰', 亥: '未', 卯: '未', 未: '未', 巳: '丑', 酉: '丑', 丑: '丑' };
    const YANGREN = { 甲: '卯', 乙: '辰', 丙: '午', 戊: '午', 丁: '未', 己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑' };
    const LU = { 甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
    if (TIANYI[dayGan]) out.push({ name: '天乙贵人', where: TIANYI[dayGan].join('、'), desc: '传统上用于观察支持、协助与人际资源。' });
    if (WENCHANG[dayGan]) out.push({ name: '文昌贵人', where: WENCHANG[dayGan], desc: '传统上用于观察学习、表达与文书主题。' });
    if (TAOHUA[yearZhi]) out.push({ name: '桃花', where: TAOHUA[yearZhi], desc: '传统上用于观察社交、吸引力与关系议题。' });
    if (YIMA[yearZhi]) out.push({ name: '驿马', where: YIMA[yearZhi], desc: '传统上用于观察变动、远行与环境转换。' });
    if (HUAGAI[yearZhi]) out.push({ name: '华盖', where: HUAGAI[yearZhi], desc: '传统上用于观察独立思考、技艺与精神兴趣。' });
    if (YANGREN[dayGan]) out.push({ name: '羊刃', where: YANGREN[dayGan], desc: '传统上用于观察行动强度、边界与冲突管理。' });
    if (LU[dayGan]) out.push({ name: '禄神', where: LU[dayGan], desc: '传统上用于观察职责、资源与稳定经营。' });
    if (TAOHUA[dayZhi]) out.push({ name: '日坐桃花', where: TAOHUA[dayZhi], desc: '传统上用于观察个人表达与亲密关系需要。' });
    return out;
  }

  function analyze(chart) {
    const dayGan = chart.dayGan, dayWx = chart.dayWx, lunar = chart.lunar;
    const sourcePillars = chart.timeUnknown ? chart.pillars.slice(0, 3) : chart.pillars;
    const chen = chart.timeUnknown ? null : hourToChen(chart.h);

    // 四柱藏干 + 十神 + 十二长生(星运) + 自坐 + 空亡
    const pillars = sourcePillars.map(p => {
      const zhi = p.zhi;
      const cang = (CANG[zhi] || []).map(([stem, role]) => ({
        stem, role, tenGod: tenGod(dayGan, stem), wx: GAN_WUXING[stem]
      }));
      return {
        ...p, cang,
        xing: xingYun(dayWx, zhi),
        selfSeat: tenGod(dayGan, cang[0].stem),
        kong: lunar.getDayXunKong ? lunar.getDayXunKong() : ''
      };
    });

    // 五行能量（加权：天干1，本气0.5，中气0.3，余气0.2）
    const energy = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
    sourcePillars.forEach(p => {
      energy[GAN_WUXING[p.gan]] += 1;
      (CANG[p.zhi] || []).forEach(([stem, role]) => {
        energy[GAN_WUXING[stem]] += role === 1 ? 0.5 : role === 2 ? 0.3 : 0.2;
      });
    });

    // 日主旺衰
    let sup = 0, tot = 0;
    sourcePillars.forEach(p => {
      tot += 1; if (isSupport(dayWx, GAN_WUXING[p.gan])) sup += 1;
      (CANG[p.zhi] || []).forEach(([stem, role]) => {
        const w = role === 1 ? 0.5 : role === 2 ? 0.3 : 0.2;
        tot += w; if (isSupport(dayWx, GAN_WUXING[stem])) sup += w;
      });
    });
    const ratio = sup / tot;
    let level, levelDesc;
    if (ratio < 0.30) { level = '弱'; levelDesc = '日主偏弱，帮扶之力不足，宜赖印比生扶。'; }
    else if (ratio < 0.42) { level = '偏弱'; levelDesc = '日主偏弱，宜得生扶而发。'; }
    else if (ratio < 0.58) { level = '中和'; levelDesc = '日主中和，不偏不倚，随运而发。'; }
    else if (ratio < 0.70) { level = '偏旺'; levelDesc = '日主偏旺，宜泄耗克制为美。'; }
    else { level = '旺'; levelDesc = '日主过旺，宜泄其秀、耗其气、制其势。'; }

    // 用神 / 喜忌
    let yong = [], ji = [];
    if (level === '弱' || level === '偏弱') { yong.push(dayWx, invSheng(dayWx)); ji.push(SHENG[dayWx], KE[dayWx], keWo(dayWx)); }
    else if (level === '旺' || level === '偏旺') { yong.push(SHENG[dayWx], KE[dayWx], keWo(dayWx)); ji.push(dayWx, invSheng(dayWx)); }
    else { yong.push(dayWx, invSheng(dayWx)); ji.push(SHENG[dayWx], KE[dayWx]); }
    const yongU = [...new Set(yong)], jiU = [...new Set(ji)];

    // 胎元 / 命宫 / 身宫
    const monthGan = chart.pillars[1].gan, monthZhi = chart.pillars[1].zhi, yearGan = chart.pillars[0].gan;
    const taiYuan = GAN_ARR[(GAN_ARR.indexOf(monthGan) + 1) % 10] + ZHI_ARR[(ZHI_ARR.indexOf(monthZhi) + 3) % 12];
    const mgZhi = chart.timeUnknown ? null : mingGongZhi(chart.m, chen);
    const mingGong = chart.timeUnknown ? '时辰未知' : zhiGan(yearGan, mgZhi) + mgZhi;
    const sgZhi = chart.timeUnknown ? null : ZHI_ARR[(zIdx(mgZhi) + (SHEN_OFFSET[chen] || 0)) % 12];
    const shenGong = chart.timeUnknown ? '时辰未知' : zhiGan(yearGan, sgZhi) + sgZhi;

    return {
      pillars, energy,
      ratio: Math.round(ratio * 100), level, levelDesc,
      yong: yongU, ji: jiU,
      shenSha: calcShenSha(chart),
      taiYuan, mingGong, shenGong,
      kongWang: lunar.getDayXunKong ? lunar.getDayXunKong() : ''
    };
  }

  /* ---------- 八字合婚 ---------- */
  const LIUHE = [['子','丑'],['寅','亥'],['卯','戌'],['辰','酉'],['巳','申'],['午','未']];
  const SANHE = [['申','子','辰'],['亥','卯','未'],['寅','午','戌'],['巳','酉','丑']];
  const LIUCHONG = [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']];
  const XIANGHAI = [['子','未'],['丑','午'],['寅','巳'],['卯','辰'],['申','亥'],['酉','戌']];
  const SANXING = [['寅','巳','申'],['丑','戌','未']];
  const ZIWUXING = ['子','卯'];      // 无礼之刑
  const ZIXING = ['辰','午','酉','亥']; // 自刑

  function inPair(z1, z2, pairs) {
    return pairs.some(p => (p[0] === z1 && p[1] === z2) || (p[0] === z2 && p[1] === z1));
  }
  function inTriple(z1, z2, triples) {
    return triples.some(t => t.includes(z1) && t.includes(z2) && z1 !== z2);
  }
  // 地支两两关系：返回 {label, good}
  function branchPairRel(z1, z2) {
    if (inPair(z1, z2, LIUHE)) return { label: '六合', good: 1 };
    if (inTriple(z1, z2, SANHE)) return { label: '三合', good: 1 };
    if (inPair(z1, z2, LIUCHONG)) return { label: '六冲', good: -1 };
    if (inPair(z1, z2, XIANGHAI)) return { label: '相害', good: -1 };
    if (inTriple(z1, z2, SANXING)) return { label: '相刑', good: -1 };
    if (ZIWUXING.includes(z1) && ZIWUXING.includes(z2) && z1 !== z2) return { label: '相刑', good: -1 };
    if (z1 === z2 && ZIXING.includes(z1)) return { label: '自刑', good: -1 };
    return { label: '普通', good: 0 };
  }
  // 五行关系：保留传统生克结构，由展示层转化为协作与磨合语言。
  function elementRel(x, y) {
    if (x === y) return { label: '比和', good: 1 };
    if (SHENG[x] === y) return { label: '相生(' + x + '生' + y + ')', good: 1 };
    if (SHENG[y] === x) return { label: '相生(' + y + '生' + x + ')', good: 1 };
    if (KE[x] === y) return { label: '相克(' + x + '克' + y + ')', good: -1 };
    if (KE[y] === x) return { label: '相克(' + y + '克' + x + ')', good: -1 };
    return { label: '无关', good: 0 };
  }
  // 用神互补度 0~1：对方八字五行能量是否补足本方喜用神
  function complement(yong, energy) {
    if (!yong || !yong.length) return 0.5;
    let s = 0;
    yong.forEach(e => { s += Math.min(1, (energy[e] || 0) / 1.2); });
    return s / yong.length;
  }
  // 八字合婚：输入两张命盘（buildChart 结果）
  function hehun(a, b) {
    const A = analyze(a), B = analyze(b);
    const factors = [];
    let score = 50;

    // 1. 生肖（年支）
    const zbA = a.pillars[0].zhi, zbB = b.pillars[0].zhi;
    const zr = branchPairRel(zbA, zbB);
    factors.push({ name: '生肖配对', detail: `生肖 ${zbA} 与 ${zbB}：${zr.label}`, good: zr.good, weight: 12 });
    score += zr.good * 12;

    // 2. 年命纳音
    const nA = (a.pillars[0].naYin || '').slice(-1);
    const nB = (b.pillars[0].naYin || '').slice(-1);
    const nr = elementRel(nA, nB);
    factors.push({ name: '年命纳音', detail: `年柱纳音 ${nA} 与 ${nB}：${nr.label}`, good: nr.good, weight: 10 });
    score += nr.good * 10;

    // 3. 日主五行
    const dr = elementRel(a.dayWx, b.dayWx);
    factors.push({ name: '日主五行', detail: `日主 ${a.dayWx} 与 ${b.dayWx}：${dr.label}`, good: dr.good, weight: 12 });
    score += dr.good * 12;

    // 4. 用神互补
    const comp = (complement(A.yong, B.energy) + complement(B.yong, A.energy)) / 2;
    const compGood = comp > 0.6 ? 1 : comp > 0.35 ? 0 : -1;
    factors.push({ name: '用神互补', detail: `喜用神互补度 ${Math.round(comp * 100)}%`, good: compGood, weight: 14 });
    score += compGood * 14;

    // 5. 地支刑冲统计（8 支两两配对）
    const zhisA = a.pillars.map(p => p.zhi), zhisB = b.pillars.map(p => p.zhi);
    let he = 0, chong = 0, xing = 0, hai = 0;
    zhisA.forEach(za => zhisB.forEach(zb => {
      const r = branchPairRel(za, zb);
      if (r.label === '六合' || r.label === '三合') he++;
      else if (r.label === '六冲') chong++;
      else if (r.label === '相刑') xing++;
      else if (r.label === '相害') hai++;
    }));
    const branchScore = he * 3 - chong * 4 - xing * 3 - hai * 2;
    const bGood = branchScore > 0 ? 1 : branchScore < 0 ? -1 : 0;
    factors.push({
      name: '地支刑冲',
      detail: `合局 ${he} 处 · 六冲 ${chong} 处 · 相刑 ${xing} 处 · 相害 ${hai} 处`,
      good: bGood, weight: 12
    });
    score += Math.max(-12, Math.min(12, branchScore));

    score = Math.max(5, Math.min(100, Math.round(score)));
    const verdict = score >= 80 ? '结构协调度较高' :
                    score >= 65 ? '有多项可协作优势' :
                    score >= 50 ? '优势与摩擦并存' :
                    score >= 35 ? '需要重点讨论差异' : '结构分歧较多';
    return { score, factors, verdict };
  }

  return { buildChart, dailyFortune, zeji, analyze, hehun, WUXING_COLOR, GAN_WUXING, ZHI_WUXING };
})();

// The modern workspace is loaded as a separate classic script and reads the
// deterministic engine through an explicit browser API.
window.TianjiEngine = TianjiEngine;
