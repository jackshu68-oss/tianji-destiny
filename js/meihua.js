/*
 * 梅花易数核心计算（浏览器版）
 * 算法结构参考 taibu-core/packages/core（MIT），保留经典时间起卦与两数报数法。
 */
const MeihuaEngine = (function () {
  const TRIGRAMS = {
    乾: { name: '乾', symbol: '☰', code: '111', number: 1, element: '金', image: '天', direction: '西北' },
    兑: { name: '兑', symbol: '☱', code: '110', number: 2, element: '金', image: '泽', direction: '正西' },
    离: { name: '离', symbol: '☲', code: '101', number: 3, element: '火', image: '火', direction: '正南' },
    震: { name: '震', symbol: '☳', code: '100', number: 4, element: '木', image: '雷', direction: '正东' },
    巽: { name: '巽', symbol: '☴', code: '011', number: 5, element: '木', image: '风', direction: '东南' },
    坎: { name: '坎', symbol: '☵', code: '010', number: 6, element: '水', image: '水', direction: '正北' },
    艮: { name: '艮', symbol: '☶', code: '001', number: 7, element: '土', image: '山', direction: '东北' },
    坤: { name: '坤', symbol: '☷', code: '000', number: 8, element: '土', image: '地', direction: '西南' }
  };
  const NUMBER_TRIGRAM = { 1:'乾',2:'兑',3:'离',4:'震',5:'巽',6:'坎',7:'艮',8:'坤' };
  const HEXAGRAM_ROWS = [
    ['乾为天','111111','金','刚健'],['坤为地','000000','土','柔顺'],['水雷屯','100010','水','初生'],['山水蒙','010001','土','启蒙'],
    ['水天需','111010','水','等待'],['天水讼','010111','金','争讼'],['地水师','010000','土','统帅'],['水地比','000010','水','亲比'],
    ['风天小畜','111011','木','蓄养'],['天泽履','110111','金','践行'],['地天泰','111000','土','通泰'],['天地否','000111','金','闭塞'],
    ['天火同人','101111','金','和同'],['火天大有','111101','火','大有'],['地山谦','001000','土','谦逊'],['雷地豫','000100','木','愉悦'],
    ['泽雷随','100110','金','随从'],['山风蛊','011001','土','整治'],['地泽临','110000','土','临近'],['风地观','000011','木','观察'],
    ['火雷噬嗑','100101','火','决断'],['山火贲','101001','土','文饰'],['山地剥','000001','土','剥落'],['地雷复','100000','土','复归'],
    ['天雷无妄','100111','金','无妄'],['山天大畜','111001','土','大畜'],['山雷颐','100001','土','颐养'],['泽风大过','011110','金','大过'],
    ['坎为水','010010','水','险陷'],['离为火','101101','火','附丽'],['泽山咸','001110','金','感应'],['雷风恒','011100','木','恒久'],
    ['天山遯','001111','金','退避'],['雷天大壮','111100','木','壮大'],['火地晋','000101','火','晋升'],['地火明夷','101000','土','晦暗'],
    ['风火家人','101011','木','家人'],['火泽睽','110101','火','乖离'],['水山蹇','001010','水','蹇难'],['雷水解','010100','木','解除'],
    ['山泽损','110001','土','减损'],['风雷益','100011','木','增益'],['泽天夬','111110','金','决断'],['天风姤','011111','金','遇合'],
    ['泽地萃','000110','金','聚集'],['地风升','011000','土','上升'],['泽水困','010110','金','困顿'],['水风井','011010','水','井养'],
    ['泽火革','101110','金','变革'],['火风鼎','011101','火','鼎新'],['震为雷','100100','木','震动'],['艮为山','001001','土','止静'],
    ['风山渐','001011','木','渐进'],['雷泽归妹','110100','木','归妹'],['雷火丰','101100','木','丰盛'],['火山旅','001101','火','旅行'],
    ['巽为风','011011','木','顺入'],['兑为泽','110110','金','喜悦'],['风水涣','010011','木','涣散'],['水泽节','110010','水','节制'],
    ['风泽中孚','110011','木','诚信'],['雷山小过','001100','木','小过'],['水火既济','101010','水','完成'],['火水未济','010101','火','未完']
  ];
  const HEXAGRAMS = Object.fromEntries(HEXAGRAM_ROWS.map(([name, code, element, nature]) => [code, { name, code, element, nature }]));
  const YEAR_NUMBER = { 鼠:1,牛:2,虎:3,兔:4,龙:5,蛇:6,马:7,羊:8,猴:9,鸡:10,狗:11,猪:12 };
  const SEASON = {
    寅:{木:'旺',火:'相',水:'休',金:'囚',土:'死'},卯:{木:'旺',火:'相',水:'休',金:'囚',土:'死'},
    辰:{土:'旺',金:'相',火:'休',木:'囚',水:'死'},巳:{火:'旺',土:'相',木:'休',水:'囚',金:'死'},
    午:{火:'旺',土:'相',木:'休',水:'囚',金:'死'},未:{土:'旺',金:'相',火:'休',木:'囚',水:'死'},
    申:{金:'旺',水:'相',土:'休',火:'囚',木:'死'},酉:{金:'旺',水:'相',土:'休',火:'囚',木:'死'},
    戌:{土:'旺',金:'相',火:'休',木:'囚',水:'死'},亥:{水:'旺',木:'相',金:'休',土:'囚',火:'死'},
    子:{水:'旺',木:'相',金:'休',土:'囚',火:'死'},丑:{土:'旺',金:'相',火:'休',木:'囚',水:'死'}
  };
  const SHENG = { 木:'火',火:'土',土:'金',金:'水',水:'木' };
  const KE = { 木:'土',火:'金',土:'水',金:'木',水:'火' };

  function mod(value, base) {
    const result = value % base;
    return result === 0 ? base : result;
  }
  function trigramByNumber(value) { return TRIGRAMS[NUMBER_TRIGRAM[mod(value, 8)]]; }
  function trigramByCode(code) { return Object.values(TRIGRAMS).find(item => item.code === code); }
  function parseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(value || ''));
    if (!match) throw new Error('请选择完整的起卦日期和时间');
    const parts = match.slice(1).map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], 0);
    if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) {
      throw new Error('起卦日期无效，请重新选择');
    }
    return { year:parts[0], month:parts[1], day:parts[2], hour:parts[3], minute:parts[4], date };
  }
  function hourNumber(hour) { return mod(Math.floor((hour + 1) / 2) + 1, 12); }
  function buildHexagram(code) {
    const row = HEXAGRAMS[code];
    if (!row) throw new Error('未找到对应卦象');
    return {
      ...row,
      lowerTrigram: trigramByCode(code.slice(0, 3)),
      upperTrigram: trigramByCode(code.slice(3, 6))
    };
  }
  function changedCode(code, line) {
    const chars = code.split('');
    chars[line - 1] = chars[line - 1] === '1' ? '0' : '1';
    return chars.join('');
  }
  function relation(body, other, label) {
    if (body === other) return { relation:'比和', favorable:true, summary:`${label}与体卦比和，主相助相成。` };
    if (SHENG[other] === body) return { relation:'用生体', favorable:true, summary:`${label}生体，主事情助我。` };
    if (SHENG[body] === other) return { relation:'体生用', favorable:false, summary:`体卦生${label}，主我去生事，多有耗泄。` };
    if (KE[body] === other) return { relation:'体克用', favorable:true, summary:`体卦克${label}，主我能制事。` };
    return { relation:'用克体', favorable:false, summary:`${label}克体，主事情反制于我。` };
  }
  function interaction(stage, label, body, other) {
    return { stage, stageLabel:label, ...relation(body, other, label) };
  }
  function buildJudgement(readings, seasonal, bodyElement, useElement, partyElements) {
    let weight = 0;
    const basis = [];
    readings.forEach(reading => {
      const delta = reading.stage === 'use' ? 2 : 1;
      weight += reading.favorable ? delta : -delta;
      basis.push(reading.summary);
    });
    if (['旺','相'].includes(seasonal.body)) { weight += 1; basis.push(`体卦月令${seasonal.body}，自身有力。`); }
    if (['囚','死'].includes(seasonal.body)) { weight -= 1; basis.push(`体卦月令${seasonal.body}，自身偏弱。`); }
    const bodyParty = partyElements.filter(x => x === bodyElement).length;
    const useParty = partyElements.filter(x => x === useElement).length;
    if (bodyParty > useParty) { weight += 1; basis.push('体党多而体势盛。'); }
    if (useParty > bodyParty) { weight -= 1; basis.push('用党多而体势衰。'); }
    const first = readings[0], last = readings[readings.length - 1];
    if (first.favorable && !last.favorable) return { outcome:'凶', summary:'先吉后阻，初段可行，后段宜留余地。', basis };
    if (!first.favorable && last.favorable) return { outcome:'吉', summary:'先阻后通，初段耐心，后势逐渐转开。', basis };
    if (weight >= 2) return { outcome:'吉', summary:'体用得势，事情整体具备推进条件。', basis };
    if (weight <= -2) return { outcome:'凶', summary:'体卦受制，事情阻力偏多，宜缓行再察。', basis };
    return { outcome:'平', summary:'吉凶互见，关键在执行节奏与后续变化。', basis };
  }

  function calculate(input) {
    const question = String(input.question || '').trim();
    if (!question) throw new Error('请先写下要问的事情');
    const wall = parseDate(input.date);
    const solar = window.Solar.fromYmdHms(wall.year, wall.month, wall.day, wall.hour, wall.minute, 0);
    const lunar = solar.getLunar();
    let upper, lower, movingLine, meta;
    if (input.method === 'number_pair') {
      const first = Number(input.numbers && input.numbers[0]);
      const second = Number(input.numbers && input.numbers[1]);
      if (!Number.isInteger(first) || first <= 0 || !Number.isInteger(second) || second <= 0) throw new Error('两个报数都必须是正整数');
      upper = trigramByNumber(first); lower = trigramByNumber(second); movingLine = mod(first + second, 6);
      meta = { method:'number_pair', methodLabel:'两数报数法', methodFamily:'现代扩展', inputs:[`第一数 ${first}`,`第二数 ${second}`] };
    } else {
      const yearNo = YEAR_NUMBER[lunar.getYearShengXiao()] || 1;
      const monthNo = Math.abs(lunar.getMonth());
      const dayNo = lunar.getDay();
      const hourNo = hourNumber(wall.hour);
      upper = trigramByNumber(yearNo + monthNo + dayNo);
      lower = trigramByNumber(yearNo + monthNo + dayNo + hourNo);
      movingLine = mod(yearNo + monthNo + dayNo + hourNo, 6);
      meta = { method:'time', methodLabel:'年月日時起卦', methodFamily:'经典时间法', inputs:[`年支数 ${yearNo}`,`农历月 ${monthNo}`,`农历日 ${dayNo}`,`时辰数 ${hourNo}`] };
    }
    const mainCode = lower.code + upper.code;
    const changed = changedCode(mainCode, movingLine);
    const nuclearSource = (mainCode === '111111' || mainCode === '000000') ? changed : mainCode;
    const nuclear = nuclearSource.slice(1, 4) + nuclearSource.slice(2, 5);
    const mainHexagram = buildHexagram(mainCode);
    const changedHexagram = buildHexagram(changed);
    const nuclearHexagram = buildHexagram(nuclear);
    const oppositeHexagram = buildHexagram(mainCode.split('').map(x => x === '1' ? '0' : '1').join(''));
    const reversedHexagram = buildHexagram(mainCode.split('').reverse().join(''));
    const bodyIsUpper = movingLine <= 3;
    const bodyTrigram = bodyIsUpper ? mainHexagram.upperTrigram : mainHexagram.lowerTrigram;
    const useTrigram = bodyIsUpper ? mainHexagram.lowerTrigram : mainHexagram.upperTrigram;
    const bodyMutualTrigram = bodyIsUpper ? nuclearHexagram.upperTrigram : nuclearHexagram.lowerTrigram;
    const useMutualTrigram = bodyIsUpper ? nuclearHexagram.lowerTrigram : nuclearHexagram.upperTrigram;
    const readings = [
      interaction('use','用卦',bodyTrigram.element,useTrigram.element),
      interaction('body_mutual','体互',bodyTrigram.element,bodyMutualTrigram.element),
      interaction('use_mutual','用互',bodyTrigram.element,useMutualTrigram.element),
      interaction('changed','变卦',bodyTrigram.element,changedHexagram.element)
    ];
    const monthBranch = lunar.getEightChar().getMonthZhi();
    const seasonal = {
      monthBranch,
      body:SEASON[monthBranch][bodyTrigram.element], use:SEASON[monthBranch][useTrigram.element],
      bodyMutual:SEASON[monthBranch][bodyMutualTrigram.element], useMutual:SEASON[monthBranch][useMutualTrigram.element],
      changed:SEASON[monthBranch][changedHexagram.element]
    };
    const judgement = buildJudgement(readings, seasonal, bodyTrigram.element, useTrigram.element, [bodyMutualTrigram.element,useMutualTrigram.element,changedHexagram.element]);
    return {
      question, date:wall, solar, lunar, meta, movingLine,
      ganZhi:`${lunar.getYearInGanZhi()}年 ${lunar.getMonthInGanZhi()}月 ${lunar.getDayInGanZhi()}日 ${lunar.getTimeInGanZhi()}时`,
      mainHexagram, changedHexagram, nuclearHexagram, oppositeHexagram, reversedHexagram,
      bodyTrigram, useTrigram, bodyMutualTrigram, useMutualTrigram,
      bodyUseRelation:readings[0], interactionReadings:readings, seasonalState:seasonal, judgement,
      warning:input.method === 'number_pair' ? '两数报数法属于常见现代扩展法，解释时与经典时间法分开标注。' : ''
    };
  }

  return { calculate, TRIGRAMS, HEXAGRAMS };
})();

window.MeihuaEngine = MeihuaEngine;
