/* 塔罗与雷诺曼卡牌引擎。洗牌、抽牌和基础解释均在本地浏览器完成。 */
(function () {
  'use strict';

  const MAJOR_ARCANA = [
    ['0','愚者','The Fool','✦','新的开始、自由尝试与信任过程','准备不足、冲动冒险或方向飘忽','风'],
    ['I','魔术师','The Magician','✧','主动创造、整合资源与把想法落地','能力分散、沟通操控或尚欠准备','风'],
    ['II','女祭司','The High Priestess','☾','直觉、静观与尚未揭开的信息','忽略直觉、信息封闭或过度猜测','水'],
    ['III','皇后','The Empress','❀','滋养、丰盛、关系与创作成长','过度照顾、停滞或忽略自身需要','土'],
    ['IV','皇帝','The Emperor','♜','秩序、边界、责任与稳定领导','控制过强、僵化或权责不清','火'],
    ['V','教皇','The Hierophant','⌘','传统、学习、制度与可信指导','打破旧框架、质疑权威或价值冲突','土'],
    ['VI','恋人','The Lovers','♡','关系契合、价值选择与真诚承诺','价值不一致、犹豫或关系失衡','风'],
    ['VII','战车','The Chariot','➤','意志、推进、掌舵与克服分心','失去方向、急进或内在拉扯','水'],
    ['VIII','力量','Strength','♌','温柔的勇气、耐心与情绪整合','自我怀疑、压抑或用力过度','火'],
    ['IX','隐者','The Hermit','◇','独处、研究、内在答案与审慎前行','孤立、逃避交流或停留太久','土'],
    ['X','命运之轮','Wheel of Fortune','◉','周期转换、机会与顺势调整','重复旧循环、抗拒变化或时机未到','火'],
    ['XI','正义','Justice','⚖','公平、因果、证据与清楚决定','偏见、逃避责任或信息不完整','风'],
    ['XII','倒吊人','The Hanged Man','▽','暂停、换角度与有意识的放下','无谓牺牲、拖延或拒绝转念','水'],
    ['XIII','死神','Death','✢','结束旧阶段、转化与腾出空间','抗拒结束、停滞或依恋旧模式','水'],
    ['XIV','节制','Temperance','≈','调和、节奏、疗愈与持续优化','失衡、急躁或不同需求难以协调','火'],
    ['XV','恶魔','The Devil','♄','看见束缚、欲望与现实交换条件','松开依附、揭露限制或重夺选择权','土'],
    ['XVI','高塔','The Tower','ϟ','结构突变、真相显现与必要重建','延迟改变、内在震荡或勉强维持','火'],
    ['XVII','星星','The Star','✶','希望、复原、愿景与重新连结','信心不足、理想失焦或需要休息','风'],
    ['XVIII','月亮','The Moon','☽','潜意识、感受、模糊与深层想象','迷雾渐散、恐惧放大或情绪误读','水'],
    ['XIX','太阳','The Sun','☀','清晰、活力、成果与坦诚相见','喜悦延迟、过度乐观或需要调整期待','火'],
    ['XX','审判','Judgement','◎','觉醒、复盘、回应召唤与重新选择','自我否定、逃避复盘或迟迟不回应','火'],
    ['XXI','世界','The World','◌','完成、整合、阶段成果与迈向新循环','收尾未完、边界未闭合或成果延迟','土']
  ].map((row, index) => ({
    id: `major-${index}`,
    number: row[0], name: row[1], en: row[2], symbol: row[3],
    upright: row[4], reversed: row[5], element: row[6], family: '大阿卡纳'
  }));

  const SUITS = [
    { id:'wands', name:'权杖', en:'Wands', symbol:'♣', element:'火', focus:'行动、热情、创造与事业推动', caution:'急躁、耗竭或行动方向分散' },
    { id:'cups', name:'圣杯', en:'Cups', symbol:'♥', element:'水', focus:'情感、关系、直觉与内在满足', caution:'情绪淹没、依赖或逃避真实感受' },
    { id:'swords', name:'宝剑', en:'Swords', symbol:'♠', element:'风', focus:'思考、沟通、冲突与清楚决策', caution:'过度分析、言语伤害或压力累积' },
    { id:'pentacles', name:'星币', en:'Pentacles', symbol:'◆', element:'土', focus:'资源、金钱、身体与现实建设', caution:'只看结果、资源焦虑或进展过慢' }
  ];
  const RANKS = [
    { id:'ace', name:'首牌', en:'Ace', upright:'新的种子与可以把握的开端', reversed:'开端受阻或机会仍需准备' },
    { id:'2', name:'二', en:'Two', upright:'平衡两端、建立合作或作出选择', reversed:'摇摆、失衡或选择被拖延' },
    { id:'3', name:'三', en:'Three', upright:'扩展、协作与看见初步成果', reversed:'协作不顺或预期需要调整' },
    { id:'4', name:'四', en:'Four', upright:'稳定结构、守住成果与建立边界', reversed:'停滞、封闭或稳定感被打乱' },
    { id:'5', name:'五', en:'Five', upright:'差异、竞争与必须面对的摩擦', reversed:'冲突缓和或旧矛盾仍待处理' },
    { id:'6', name:'六', en:'Six', upright:'过渡、互助与阶段性推进', reversed:'进度反复或支持分配不均' },
    { id:'7', name:'七', en:'Seven', upright:'坚持立场、评估选项与守住重点', reversed:'信心动摇或策略失去焦点' },
    { id:'8', name:'八', en:'Eight', upright:'节奏加快、练习累积与持续行动', reversed:'延误、重复劳动或能量被卡住' },
    { id:'9', name:'九', en:'Nine', upright:'接近完成、保持韧性与独立判断', reversed:'疲惫、防御过强或最后阶段失焦' },
    { id:'10', name:'十', en:'Ten', upright:'一个周期的结果、责任与完整呈现', reversed:'负担过重、收尾困难或需要减法' },
    { id:'page', name:'侍从', en:'Page', upright:'学习、消息、好奇与新的表达', reversed:'经验不足、消息混乱或迟迟未行动' },
    { id:'knight', name:'骑士', en:'Knight', upright:'追求目标、移动与明确执行', reversed:'过快、过慢或行动缺乏一致性' },
    { id:'queen', name:'王后', en:'Queen', upright:'成熟承载、理解情境与稳定影响', reversed:'内耗、照顾失衡或感受难以表达' },
    { id:'king', name:'国王', en:'King', upright:'掌握全局、负责决策与稳定领导', reversed:'权力失衡、固执或责任边界模糊' }
  ];

  const MINOR_ARCANA = [];
  SUITS.forEach(suit => RANKS.forEach(rank => MINOR_ARCANA.push({
    id: `${suit.id}-${rank.id}`,
    number: rank.id,
    name: `${suit.name}${rank.name}`,
    en: `${rank.en} of ${suit.en}`,
    symbol: suit.symbol,
    element: suit.element,
    family: `小阿卡纳 · ${suit.name}`,
    upright: `${rank.upright}；主题落在${suit.focus}`,
    reversed: `${rank.reversed}；留意${suit.caution}`
  })));

  const TAROT_DECK = MAJOR_ARCANA.concat(MINOR_ARCANA);
  const LENORMAND_DECK = [
    [1,'骑士','Rider','♞','消息、来访与快速行动','留意消息是否准确，并确认谁负责下一步',1],
    [2,'四叶草','Clover','☘','小幸运、短暂机会与轻松转机','机会窗口较短，适合小步把握',1],
    [3,'船','Ship','⛵','远行、拓展、贸易与距离','变化需要时间，也要计算路程与成本',0],
    [4,'房屋','House','⌂','家庭、根基、安全与私人空间','先稳住基础，再考虑向外扩展',1],
    [5,'树','Tree','♧','成长、健康、根系与长期累积','进展缓慢但可持续，健康问题应咨询专业人士',0],
    [6,'云','Clouds','☁','模糊、变化与暂时看不清','资料不完整时不要仓促下结论',-1],
    [7,'蛇','Snake','⌁','复杂路径、策略与多重动机','注意绕路、嫉妒或表里不一',-1],
    [8,'棺材','Coffin','▰','结束、休止与必要转化','先承认一个阶段已经完结',-1],
    [9,'花束','Bouquet','✿','礼物、欣赏、邀请与愉快互动','接受善意，同时保持真实回应',1],
    [10,'镰刀','Scythe','⌁','突然决定、切割与快速转折','行动前先看风险，避免冲动伤害',-1],
    [11,'鞭子','Whip','〽','重复、训练、争执与高强度互动','打破无效循环，建立清楚沟通规则',-1],
    [12,'鸟','Birds','♬','对话、忙碌、传播与短暂焦虑','减少噪音，确认关键讯息',0],
    [13,'孩子','Child','☆','新开始、简单、好奇与小规模尝试','从最小可行步骤开始',1],
    [14,'狐狸','Fox','◇','工作、机敏、自利与现实判断','核对利益关系，不要只听表面承诺',-1],
    [15,'熊','Bear','♛','力量、资源、保护与影响力','资源有帮助，也要防止控制过度',0],
    [16,'星星','Stars','✶','方向、希望、网络与长期愿景','把愿景转成可检验的里程碑',1],
    [17,'鹳','Stork','⌃','改善、搬迁、更新与状态变化','为变化预留适应期',1],
    [18,'狗','Dog','♙','朋友、忠诚、支持与可靠关系','向可信的人求助，也要确认彼此边界',1],
    [19,'塔','Tower','▥','机构、独立、边界与长远视角','保持专业距离，避免把独立变成孤立',0],
    [20,'花园','Garden','❉','社交、公众、活动与群体网络','公开场合要注意信息边界',1],
    [21,'山','Mountain','▲','阻碍、延迟、距离与需要耐心','先判断障碍能否绕行或拆小',-1],
    [22,'十字路口','Crossroads','⑂','选择、岔路与多个可能方向','减少选项，并明确选择标准',0],
    [23,'老鼠','Mice','⋯','损耗、焦虑、细节流失与逐步减少','检查资源漏洞和持续消耗',-1],
    [24,'心','Heart','♥','爱、热情、真诚与内在喜好','表达真实感受，也要尊重现实条件',1],
    [25,'戒指','Ring','○','承诺、协议、循环与伙伴关系','把口头承诺落实成双方可执行的约定',1],
    [26,'书','Book','▤','学习、秘密、资料与尚未公开之事','继续调查，不要填补未知空白',0],
    [27,'信','Letter','✉','文件、文字、通知与正式沟通','保存记录并核对条款和时间',0],
    [28,'男人','Man','♂','关键人物、主动面与外在行动','结合现实人物判断，不以性别刻板推论',0],
    [29,'女人','Woman','♀','关键人物、回应面与内在感受','结合现实人物判断，不以性别刻板推论',0],
    [30,'百合','Lily','⚜','成熟、平和、伦理与长期和谐','用经验降速处理复杂问题',1],
    [31,'太阳','Sun','☀','成功、清晰、活力与公开成果','看见优势，同时避免过度乐观',1],
    [32,'月亮','Moon','☾','情绪、认可、创作与周期变化','区分感受、想象和可验证事实',0],
    [33,'钥匙','Key','⚿','确定、解锁、重要答案与可行入口','抓住核心条件，不必把所有问题同时解决',1],
    [34,'鱼','Fish','♓','金钱、流动、商业与自主资源','关注现金流与交换是否公平',1],
    [35,'锚','Anchor','⚓','稳定、工作、坚持与长期落点','稳定有价值，也要检查是否停留过久',1],
    [36,'十字架','Cross','✚','责任、考验、负担与意义课题','分清必要责任和不必独自承担的重量',-1]
  ].map(row => ({ number:row[0], id:`lenormand-${row[0]}`, name:row[1], en:row[2], symbol:row[3], keyword:row[4], advice:row[5], tone:row[6] }));

  const SPREADS = {
    tarot: {
      single: { name:'一张牌 · 当下讯息', positions:['当下讯息'] },
      timeline: { name:'三张牌 · 时间之流', positions:['过去影响','当前核心','下一步走向'] },
      action: { name:'三张牌 · 行动指引', positions:['现状','需要看清','行动建议'] }
    },
    lenormand: {
      single: { name:'一张牌 · 今日提示', positions:['核心提示'] },
      line3: { name:'三张牌 · 事件线', positions:['起因','核心','走向'] },
      line5: { name:'五张牌 · 完整路径', positions:['背景','阻力','核心','助力','趋势'] }
    }
  };

  function randomIndex(max) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      return values[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function drawCards(deck, count, allowReversed) {
    const copy = deck.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = randomIndex(index + 1);
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy.slice(0, count).map(card => ({ card, reversed: Boolean(allowReversed && randomIndex(2)) }));
  }

  const engine = { TAROT_DECK, LENORMAND_DECK, SPREADS, drawCards };
  if (typeof window !== 'undefined') window.TianjiOracle = engine;
  if (typeof document === 'undefined') return;

  const $ = selector => document.querySelector(selector);
  let lastTarot = null;
  let lastLenormand = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[char]);
  }
  function toast(message) {
    let node = $('#toast');
    if (!node) {
      node = document.createElement('div'); node.id = 'toast'; node.className = 'toast'; document.body.appendChild(node);
    }
    node.textContent = message; node.classList.add('show');
    clearTimeout(node._timer); node._timer = setTimeout(() => node.classList.remove('show'), 2800);
  }
  function source(type) { return window.TianjiKnowledge ? TianjiKnowledge.sourceBadge(type) : ''; }
  function section(title, html) { return `<div class="dm-sec"><h4>${title}</h4>${html}</div>`; }
  function detail(title, body) {
    if (window.TianjiDetail && typeof window.TianjiDetail.open === 'function') window.TianjiDetail.open(title, body);
  }

  function oracleCard(item, position, index, type) {
    const card = item.card;
    const reversed = Boolean(item.reversed);
    const meaning = type === 'tarot' ? (reversed ? card.reversed : card.upright) : card.keyword;
    return `<button type="button" class="oracle-card-wrap ${reversed ? 'reversed' : ''}" style="--card-index:${index}" data-oracle-card="${index}" aria-label="${esc(position)}：${esc(card.name)}${reversed ? '逆位' : ''}">
      <span class="oracle-position">${esc(position)}</span>
      <span class="oracle-card ${type}">
        <span class="oracle-card-back"><i></i><b>${type === 'tarot' ? 'TAROT' : 'LENORMAND'}</b><i></i></span>
        <span class="oracle-card-face">
          <span class="oracle-number">${esc(card.number)}</span>
          <span class="oracle-symbol">${esc(card.symbol)}</span>
          <strong>${esc(card.name)}</strong>
          <em>${esc(card.en)}</em>
          ${type === 'tarot' ? `<small>${reversed ? '逆位' : '正位'} · ${esc(card.element)}</small>` : `<small>${esc(card.keyword.split('、')[0])}</small>`}
        </span>
      </span>
      <span class="oracle-keyword">${esc(meaning)}</span>
    </button>`;
  }

  function tarotThread(reading) {
    return reading.draws.map((item, index) => {
      const meaning = item.reversed ? item.card.reversed : item.card.upright;
      return `${reading.spread.positions[index]}由「${item.card.name}${item.reversed ? '逆位' : '正位'}」提示：${meaning}`;
    }).join('；');
  }

  function lenormandThread(reading) {
    const names = reading.draws.map(item => item.card.name).join(' → ');
    const score = reading.draws.reduce((sum, item) => sum + item.card.tone, 0);
    const tone = score >= 2 ? '整体线索较顺，可在确认条件后稳步行动。' : score <= -2 ? '阻力与消耗较明显，先缩小目标并补足信息。' : '正反线索并存，关键在中间牌与现实条件。';
    return `牌面连接为「${names}」。${tone}`;
  }

  function renderReading(target, reading, type) {
    const tarot = type === 'tarot';
    const thread = tarot ? tarotThread(reading) : lenormandThread(reading);
    target.innerHTML = `
      <div class="oracle-summary ${type}">
        <div class="oracle-sigil">${tarot ? '✦' : '✶'}</div>
        <div><p>${esc(reading.question)}</p><h3>${esc(reading.spread.name)}</h3><span>${tarot ? '78 张完整牌组 · 含正逆位' : '36 张标准牌组 · 连线解读'}</span></div>
      </div>
      <div class="oracle-spread oracle-count-${reading.draws.length}">${reading.draws.map((item, index) => oracleCard(item, reading.spread.positions[index], index, type)).join('')}</div>
      <div class="oracle-thread"><span>${tarot ? '牌阵主线' : '牌面连线'}</span><p>${esc(thread)}</p></div>
      <button type="button" class="detail-action" data-oracle-detail>查看逐张依据与 AI 深度详解</button>
      ${source(type)}`;
    target.classList.remove('hidden');
    setTimeout(() => target.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
  }

  function buildTarotDetail(reading) {
    const cards = reading.draws.map((item, index) => `<li><b>${esc(reading.spread.positions[index])} · ${esc(item.card.name)}${item.reversed ? '逆位' : '正位'}</b>：${esc(item.reversed ? item.card.reversed : item.card.upright)}</li>`).join('');
    return section('问题与牌阵', `<p><b>${esc(reading.question)}</b></p><p>${esc(reading.spread.name)}；由完整 78 张牌随机洗牌后抽取，本次保留正位与逆位。</p>`)
      + section('逐张牌意', `<ul class="dm-ul">${cards}</ul>`)
      + section('牌阵主线', `<p>${esc(tarotThread(reading))}</p>`)
      + section('现实行动', '<p>把牌意转换成可以验证的问题：哪些事实已经发生、哪些只是担心、下一步最小行动是什么。牌面与现实证据冲突时，以现实证据为准。</p>')
      + section('使用边界', '<p>塔罗用于自我观察与娱乐参考，不预测确定事件，也不替代医疗、法律、投资或心理专业意见。</p>')
      + source('tarot');
  }

  function buildLenormandDetail(reading) {
    const cards = reading.draws.map((item, index) => `<li><b>${esc(reading.spread.positions[index])} · ${item.card.number} ${esc(item.card.name)}</b>：${esc(item.card.keyword)}。${esc(item.card.advice)}。</li>`).join('');
    return section('问题与牌阵', `<p><b>${esc(reading.question)}</b></p><p>${esc(reading.spread.name)}；从标准 36 张 Petit Lenormand 牌组随机抽取，不采用逆位。</p>`)
      + section('逐张线索', `<ul class="dm-ul">${cards}</ul>`)
      + section('相邻连线', `<p>${esc(lenormandThread(reading))}</p><p>由左至右观察起因、核心与趋势；相邻牌用于补充语境，不把单张牌直接当作确定结论。</p>`)
      + section('现实行动', '<p>将人物、消息、资源、阻力与时间逐项对应到现实资料，再决定需要确认谁、补哪份信息、何时复盘。</p>')
      + section('使用边界', '<p>雷诺曼卡牌用于文化研究、自我整理与娱乐参考，不替代任何专业判断。</p>')
      + source('lenormand');
  }

  function singleCardDetail(reading, index, type) {
    const item = reading.draws[index];
    if (!item) return;
    const position = reading.spread.positions[index];
    if (type === 'tarot') {
      detail(`塔罗牌 · ${item.card.name}`, section(position, `<p><b>${esc(item.card.name)} · ${item.reversed ? '逆位' : '正位'}</b></p><p>${esc(item.reversed ? item.card.reversed : item.card.upright)}</p><p>所属：${esc(item.card.family)}；元素：${esc(item.card.element)}。</p>`) + source('tarot'));
    } else {
      detail(`雷诺曼 · ${item.card.name}`, section(position, `<p><b>${item.card.number} · ${esc(item.card.name)}</b></p><p>${esc(item.card.keyword)}。</p><p>${esc(item.card.advice)}。</p>`) + source('lenormand'));
    }
  }

  function runTarot() {
    const question = $('#tarot-question').value.trim();
    if (!question) { toast('请先写下要问的事情'); return; }
    const spread = SPREADS.tarot[$('#tarot-spread').value] || SPREADS.tarot.timeline;
    lastTarot = { question, spread, draws:drawCards(TAROT_DECK, spread.positions.length, true), createdAt:Date.now() };
    renderReading($('#tarot-result'), lastTarot, 'tarot');
  }

  function runLenormand() {
    const question = $('#lenormand-question').value.trim();
    if (!question) { toast('请先写下要问的事情'); return; }
    const spread = SPREADS.lenormand[$('#lenormand-spread').value] || SPREADS.lenormand.line3;
    lastLenormand = { question, spread, draws:drawCards(LENORMAND_DECK, spread.positions.length, false), createdAt:Date.now() };
    renderReading($('#lenormand-result'), lastLenormand, 'lenormand');
  }

  function init() {
    $('#btn-tarot').addEventListener('click', runTarot);
    $('#btn-lenormand').addEventListener('click', runLenormand);
    $('#tarot-result').addEventListener('click', event => {
      const card = event.target.closest('[data-oracle-card]');
      if (card && lastTarot) singleCardDetail(lastTarot, Number(card.dataset.oracleCard), 'tarot');
      if (event.target.closest('[data-oracle-detail]') && lastTarot) detail('塔罗牌 · 完整牌阵详解', buildTarotDetail(lastTarot));
    });
    $('#lenormand-result').addEventListener('click', event => {
      const card = event.target.closest('[data-oracle-card]');
      if (card && lastLenormand) singleCardDetail(lastLenormand, Number(card.dataset.oracleCard), 'lenormand');
      if (event.target.closest('[data-oracle-detail]') && lastLenormand) detail('雷诺曼 · 完整连线详解', buildLenormandDetail(lastLenormand));
    });
  }

  window.addEventListener('DOMContentLoaded', init);
})();
