/* ==========================================================================
   道法自然 · 紫微斗数封装（基于 ziwei-gt）
   - 取 12 宫数据（宫职 / 干支 / 星曜）
   - 星曜分类着色（主星 / 吉星 / 煞星 / 杂曜）
   - 渲染传统方盘（4x4 网格，地支固定方位）
   ========================================================================== */
const ZiweiBoard = (function () {
  // 全局名兼容（ziwei-gt 浏览器版挂到 window.Ziwei）
  const GW = (typeof globalThis !== 'undefined' && globalThis.window) ? globalThis.window : (typeof window !== 'undefined' ? window : {});
  let ZGT = GW.Ziwei || GW.ZiWeiGT || {};
  // 兜底：扫描 window 顶层找含 Plate 构造器的对象
  if (!ZGT.Plate) {
    for (const k in GW) {
      try { if (GW[k] && GW[k].Plate && typeof GW[k].Plate === 'function') { ZGT = GW[k]; break; } } catch (e) {}
    }
  }
  const Plate = ZGT.Plate || GW.Plate || (typeof globalThis !== 'undefined' && globalThis.Plate);

  // 十四主星
  const MAIN = new Set(['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军']);
  // 吉星
  const AUS = new Set(['文昌', '文曲', '左辅', '右弼', '天魁', '天钺', '禄存', '天马', '红鸾', '天喜', '天巫', '天福', '三台', '八座', '恩光', '天贵', '台辅', '封诰', '龙池', '凤阁', '天才', '天寿', '解神', '天德', '月德', '孤辰', '破碎']);
  // 煞星 / 凶星
  const INA = new Set(['擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '天刑', '天姚', '阴煞', '劫煞', '寡宿', '大耗', '天虚', '天哭', '蜚廉', '破碎', '华盖', '咸池', '天空']);

  function starClass(name) {
    if (MAIN.has(name)) return 'main';
    if (AUS.has(name)) return 'aus';
    if (INA.has(name)) return 'ina';
    return 'neu';
  }

  // 四化（禄权科忌）飞星：依年干而定
  const SIHUA = {
    '甲': { 禄: '廉贞', 权: '破军', 科: '武曲', 忌: '太阳' },
    '乙': { 禄: '天机', 权: '天梁', 科: '紫微', 忌: '太阴' },
    '丙': { 禄: '天同', 权: '天机', 科: '文昌', 忌: '廉贞' },
    '丁': { 禄: '太阴', 权: '天同', 科: '天机', 忌: '巨门' },
    '戊': { 禄: '贪狼', 权: '太阴', 科: '右弼', 忌: '天机' },
    '己': { 禄: '武曲', 权: '贪狼', 科: '天梁', 忌: '文曲' },
    '庚': { 禄: '太阳', 权: '武曲', 科: '太阴', 忌: '天同' },
    '辛': { 禄: '巨门', 权: '太阳', 科: '文曲', 忌: '文昌' },
    '壬': { 禄: '天梁', 权: '紫微', 科: '左辅', 忌: '武曲' },
    '癸': { 禄: '破军', 权: '巨门', 科: '太阴', 忌: '贪狼' }
  };
  function fourHuaMap(yearGan) {
    const m = SIHUA[yearGan]; if (!m) return {};
    const rev = {};
    Object.keys(m).forEach(h => { rev[m[h]] = h; }); // starName -> 禄/权/科/忌
    return rev;
  }

  // 地支 → 4x4 方盘坐标（传统紫微盘方位）
  //     巳 午 未 申
  //     辰     酉
  //     卯     戌
  //     寅 丑 子 亥
  const BRANCH_POS = {
    子: [3, 2], 丑: [3, 1], 寅: [3, 0], 卯: [2, 0], 辰: [1, 0], 巳: [0, 0],
    午: [0, 1], 未: [0, 2], 申: [0, 3], 酉: [1, 3], 戌: [2, 3], 亥: [3, 3]
  };
  const DUTY_DESC = {
    命宫: '自我、性格、先天禀赋',
    兄弟: '手足、同辈、合伙',
    夫妻: '婚姻、伴侣、感情',
    子女: '子嗣、晚辈、桃花',
    财帛: '财运、理财、收入',
    疾厄: '健康、体质、隐患',
    迁移: '外出、人际、机遇',
    交友: '朋友、下属、人际',
    官禄: '事业、功名、职位',
    田宅: '房产、家宅、根基',
    福德: '福气、心态、精神',
    父母: '长辈、荫庇、学历'
  };

  // 取命盘 12 宫
  function getBoard(year, month, day, hour, minute, gender, yearGan) {
    const sex = gender === 'female' ? 1 : 0;
    const plate = new Plate({ year, month, day, hour, minute: minute || 0, second: 0, sex });
    const palaces = plate.getPalaces(); // 按地支顺序 子..亥
    const hua = fourHuaMap(yearGan);
    const cells = palaces.map((p, i) => ({
      index: i,
      branch: p.stemBranch.branch,
      stem: p.stemBranch.stem,
      duty: p.duty,
      isMing: p.duty === '命宫',
      stars: p.stars.map(s => ({
        name: s.name, cls: starClass(s.name), type: s.type,
        hua: hua[s.name] || ''
      }))
    }));
    return cells;
  }

  // 渲染方盘（返回 HTML 字符串）
  function renderBoard(cells) {
    // 构建 4x4 grid，空角用占位
    const grid = Array.from({ length: 4 }, () => Array(4).fill(null));
    cells.forEach(c => {
      const [r, col] = BRANCH_POS[c.branch];
      grid[r][col] = c;
    });
    let html = '<div class="zw-grid">';
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 4; col++) {
        const c = grid[r][col];
        if (!c) { html += '<div class="zw-cell empty"></div>'; continue; }
        const starsHtml = c.stars.map(s =>
          `<span class="zw-star ${s.cls}">${s.name}${s.hua ? `<i class="hua hua-${s.hua}">${s.hua}</i>` : ''}</span>`).join('');
        html += `<div class="zw-cell ${c.isMing ? 'ming' : ''}">
          <div class="zw-cap"><span class="zw-duty">${c.duty}</span><span class="zw-gz">${c.stem}${c.branch}</span></div>
          <div class="zw-stars">${starsHtml || '<span class="zw-star neu">空宫</span>'}</div>
        </div>`;
      }
    }
    html += '</div>';
    return html;
  }

  // 宫位详情（文字列表）
  function renderDetail(cells) {
    const order = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '官禄', '田宅', '福德', '父母'];
    let html = '';
    order.forEach(duty => {
      const c = cells.find(x => x.duty === duty);
      if (!c) return;
      const main = c.stars.filter(s => s.cls === 'main').map(s => s.name + (s.hua ? `(${s.hua})` : '')).join('、') || '无主星';
      const others = c.stars.filter(s => s.cls !== 'main').map(s => `<span class="zw-otag ${s.cls}">${s.name}${s.hua ? `(${s.hua})` : ''}</span>`).join('');
      html += `<div class="zw-row">
        <div class="zw-row-head"><b>${c.duty}</b><span class="zw-row-gz">${c.stem}${c.branch}</span></div>
        <div class="zw-row-main">主星：<b>${main}</b></div>
        <div class="zw-row-ot">${others}</div>
        <div class="zw-row-desc">${DUTY_DESC[duty] || ''}</div>
      </div>`;
    });
    return html;
  }

  return { getBoard, renderBoard, renderDetail, starClass, available: !!Plate };
})();
