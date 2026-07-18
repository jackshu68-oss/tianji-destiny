import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lunar = require('../js/lunar.js');

function browserContext(extra = {}) {
  const context = { window: {}, console, Date, Intl, setTimeout, clearTimeout, ...extra };
  context.window.window = context.window;
  context.globalThis = context.window;
  vm.createContext(context);
  return context;
}

function plannerFixture() {
  const context = browserContext();
  context.window.Solar = lunar.Solar;
  for (const file of ['profile.js', 'knowledge.js', 'engine.js', 'planner.js']) {
    vm.runInContext(fs.readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8'), context);
  }
  const engine = context.window.TianjiEngine;
  const chart = engine.buildChart(1990, 6, 15, 10, 30, 'male');
  return { context, engine, planner: context.window.TianjiPlanner, chart };
}

test('梅花时间起卦复现观梅占基准', () => {
  const context = browserContext();
  context.window.Solar = lunar.Solar;
  vm.runInContext(fs.readFileSync(new URL('../js/meihua.js', import.meta.url), 'utf8'), context);
  const result = context.window.MeihuaEngine.calculate({ question: '观梅占测试', method: 'time', date: '2025-01-16T16:00' });
  assert.equal(result.mainHexagram.name, '泽火革');
  assert.equal(result.changedHexagram.name, '泽山咸');
  assert.equal(result.movingLine, 1);
  assert.equal(result.bodyTrigram.name, '兑');
  assert.equal(result.useTrigram.name, '离');
  assert.equal(result.bodyUseRelation.relation, '用克体');
});

test('梅花时间起卦复现牡丹占基准', () => {
  const context = browserContext();
  context.window.Solar = lunar.Solar;
  vm.runInContext(fs.readFileSync(new URL('../js/meihua.js', import.meta.url), 'utf8'), context);
  const result = context.window.MeihuaEngine.calculate({ question: '牡丹占测试', method: 'time', date: '2029-09-03T08:00' });
  assert.equal(result.mainHexagram.name, '泽山咸');
  assert.equal(result.changedHexagram.name, '雷山小过');
  assert.equal(result.movingLine, 5);
});

test('梅花两数起卦正确处理八的余数', () => {
  const context = browserContext();
  context.window.Solar = lunar.Solar;
  vm.runInContext(fs.readFileSync(new URL('../js/meihua.js', import.meta.url), 'utf8'), context);
  const result = context.window.MeihuaEngine.calculate({ question: '报数边界', method: 'number_pair', numbers: [8, 8], date: '2026-07-17T12:00' });
  assert.equal(result.mainHexagram.name, '坤为地');
  assert.equal(result.movingLine, 4);
});

test('奇门浏览器包复现阳遁六局基准', () => {
  const context = browserContext();
  vm.runInContext(fs.readFileSync(new URL('../js/vendor/qimen-core.min.js', import.meta.url), 'utf8'), context);
  const pan = context.window.QimenCore.calculate(new Date('2026-06-05T16:52:00'), { method: '时家' });
  assert.equal(pan.juShu.type, 'yang');
  assert.equal(pan.juShu.number, '6');
  assert.equal(pan.zhiFuXing, '天任');
  assert.equal(pan.zhiFuGong, '8');
  assert.equal(pan.zhiShiMen, '生门');
  assert.equal(pan.zhiShiGong, '8');
});

test('奇门浏览器包通过五个节气基准盘', () => {
  const context = browserContext();
  vm.runInContext(fs.readFileSync(new URL('../js/vendor/qimen-core.min.js', import.meta.url), 'utf8'), context);
  const fixtures = [
    ['2026-03-21T12:00:00','yang','3','天冲','2','伤门','9'],
    ['2026-06-09T12:00:00','yang','3','天冲','2','伤门','9'],
    ['2026-07-15T12:00:00','yin','5','天辅','1','杜门','2'],
    ['2026-09-23T12:00:00','yin','1','天英','6','景门','1'],
    ['2026-12-08T12:00:00','yin','7','天辅','4','杜门','4']
  ];
  for (const [date,type,number,star,zhiFuGong,gate,zhiShiGong] of fixtures) {
    const pan = context.window.QimenCore.calculate(new Date(date), { method: '时家' });
    assert.deepEqual([pan.juShu.type,pan.juShu.number,pan.zhiFuXing,pan.zhiFuGong,pan.zhiShiMen,pan.zhiShiGong], [type,number,star,zhiFuGong,gate,zhiShiGong]);
  }
});

test('塔罗与雷诺曼使用完整标准牌组并可无重复抽牌', () => {
  const context = browserContext();
  vm.runInContext(fs.readFileSync(new URL('../js/oracle.js', import.meta.url), 'utf8'), context);
  const oracle = context.window.TianjiOracle;
  assert.equal(oracle.TAROT_DECK.length, 78);
  assert.equal(new Set(oracle.TAROT_DECK.map(card => card.id)).size, 78);
  assert.equal(oracle.LENORMAND_DECK.length, 36);
  assert.equal(new Set(oracle.LENORMAND_DECK.map(card => card.id)).size, 36);
  const draw = oracle.drawCards(oracle.LENORMAND_DECK, 5, false);
  assert.equal(draw.length, 5);
  assert.equal(new Set(draw.map(item => item.card.id)).size, 5);
  assert.ok(draw.every(item => item.reversed === false));
});

test('出生资料模块校验日期、城市与夏令时间边界', () => {
  const context = browserContext();
  vm.runInContext(fs.readFileSync(new URL('../js/profile.js', import.meta.url), 'utf8'), context);
  const profile = context.window.TianjiProfile;
  assert.equal(profile.resolveCity('佛山，中国').timeZone, 'Asia/Shanghai');
  assert.equal(profile.resolveCity('Toronto').name, '多伦多');
  assert.equal(profile.validateSolarDate(2024, 2, 29, new Date('2026-01-01')).ok, true);
  assert.equal(profile.validateSolarDate(2025, 2, 29, new Date('2026-01-01')).ok, false);
  const toronto = profile.resolveCity('多伦多，加拿大');
  assert.equal(profile.inspectLocalTime({ y: 2026, m: 3, d: 8, h: 2, mi: 30 }, toronto).valid, false);
  assert.equal(profile.inspectLocalTime({ y: 2026, m: 11, d: 1, h: 1, mi: 30 }, toronto).ambiguous, true);
  const corrected = profile.applyTimeCorrection({ y: 2026, m: 7, d: 18, h: 12, mi: 0 }, profile.resolveCity('佛山，中国'), 'solar');
  assert.ok(corrected.correctionMinutes < 0);
  assert.match(corrected.note, /真太阳时校正/);
});

test('未知出生时辰只使用三柱并提供五维每日决策数据', () => {
  const context = browserContext();
  context.window.Solar = lunar.Solar;
  vm.runInContext(fs.readFileSync(new URL('../js/engine.js', import.meta.url), 'utf8'), context);
  const engine = vm.runInContext('TianjiEngine', context);
  const chart = engine.buildChart(1990, 1, 1, 12, 0, 'male', { timeUnknown: true });
  const analysis = engine.analyze(chart);
  const daily = engine.dailyFortune(chart, lunar.Solar.fromYmd(2026, 7, 18));
  assert.equal(chart.timeUnknown, true);
  assert.match(chart.birthStr, /时辰未知/);
  assert.equal(analysis.pillars.length, 3);
  assert.equal(analysis.mingGong, '时辰未知');
  assert.deepEqual(Object.keys(daily.dims).slice(0, 5), ['action', 'communication', 'finance', 'relation', 'state']);
});

test('现代工作台规划层输出完整时间轴、年度与流月窗口', () => {
  const { planner, chart } = plannerFixture();
  const timeline = planner.lifeTimeline(chart, 2026);
  const years = planner.yearCards(chart, 2026, 7);
  const months = planner.monthWindows(chart, new Date(2026, 6, 18), 6);
  assert.ok(timeline.length >= 8);
  assert.equal(timeline.filter(item => item.status === 'current').length, 1);
  assert.equal(years.length, 7);
  assert.equal(years[0].year, 2026);
  assert.equal(months.length, 6);
  assert.ok(months.every(item => item.score >= 0 && item.score <= 100));
});

test('节律日历、关系结构与决策工具返回可操作资料', () => {
  const { engine, planner, chart } = plannerFixture();
  const calendar = planner.calendarMonth(chart, 2026, 7, [{ date: '2026-07-18', title: '重要会议' }]);
  assert.equal(calendar.days.length, 31);
  assert.equal(calendar.days.find(item => item.iso === '2026-07-18').events.length, 1);

  const other = engine.buildChart(1992, 3, 8, 14, 0, 'female');
  const graph = planner.relationshipGraph(chart, other, engine.hehun(chart, other));
  assert.equal(graph.dimensions.length, 5);
  assert.ok(graph.dimensions.every(item => item.score >= 0 && item.score <= 100));

  const candidates = planner.rectifyTime(
    { y: 1990, m: 6, d: 15, gender: 'male' },
    { period: 'morning', traits: ['structured'], eventYear: 2020, eventType: 'career' }
  );
  assert.equal(candidates.length, 4);
  assert.equal(candidates[0].rank, 1);

  const comparison = planner.compareOptions(chart, [
    { name: '留任', timing: 3, risk: 2, stability: 5, growth: 2 },
    { name: '转职', timing: 4, risk: 4, stability: 2, growth: 5 }
  ]);
  assert.equal(comparison.rows.length, 2);
  assert.match(comparison.caveat, /不替你作决定/);

  const backtest = planner.backtestEvent(chart, { year: 2020, type: 'career' });
  assert.equal(backtest.year, 2020);
  assert.match(backtest.caveat, /不能反向证明/);

  const ics = planner.buildIcs([{ date: '2026-07-18', title: '重要会议' }], '个人节奏');
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260718/);
});

test('页面包含新增排盘、现代摘要、隐私入口和本地脚本', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="meihua"/);
  assert.match(html, /id="qimen"/);
  assert.match(html, /id="tarot"/);
  assert.match(html, /id="lenormand"/);
  assert.match(html, /id="music-toggle"/);
  assert.match(html, /id="core-grid"/);
  assert.match(html, /data-accuracy="unknown"/);
  assert.match(html, /id="in-city"/);
  assert.match(html, /id="insight-workspace"/);
  assert.match(html, /id="life-timeline-list"/);
  assert.match(html, /id="rhythm-calendar-grid"/);
  assert.match(html, /id="ai-question-panel"/);
  assert.match(html, /id="relationship-graph"/);
  assert.match(html, /id="sync-create"/);
  assert.match(html, /id="create-share-link"/);
  assert.match(html, /class="professional-details"/);
  assert.match(html, /privacy\.html/);
  assert.match(html, /js\/meihua\.js/);
  assert.match(html, /js\/vendor\/qimen-core\.min\.js/);
  assert.match(html, /js\/divination\.js/);
  assert.match(html, /js\/oracle\.js/);
  assert.match(html, /js\/ambient\.js/);
  assert.match(html, /js\/profile\.js/);
  assert.match(html, /js\/ai\.js/);
  assert.match(html, /js\/planner\.js/);
  assert.match(html, /js\/workspace\.js/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids.filter((id, index) => ids.indexOf(id) !== index), []);
  const aiSource = fs.readFileSync(new URL('../js/ai.js', import.meta.url), 'utf8');
  assert.match(aiSource, /\/api\/ai\/interpret/);
  assert.match(aiSource, /\/api\/ai\/result\//);
  assert.match(aiSource, /payload\.pending/);
  assert.doesNotMatch(aiSource, /Bearer\s|DEEPSEEK_API_KEY|api\.deepseek\.com/);
});

test('紫微十二宫支持键盘与点击打开宫位详情', () => {
  const context = browserContext();
  vm.runInContext(fs.readFileSync(new URL('../js/ziwei.js', import.meta.url), 'utf8'), context);
  const ziweiBoard = vm.runInContext('ZiweiBoard', context);
  const board = ziweiBoard.renderBoard([
    { branch: '巳', stem: '己', duty: '命宫', isMing: true, stars: [{ name: '紫微', cls: 'main', hua: '' }] }
  ]);
  assert.match(board, /role="button"/);
  assert.match(board, /tabindex="0"/);
  assert.match(board, /data-zw-duty="命宫"/);
});

test('SEO、匿名分享与私隐文件齐备', () => {
  const routes = ['about', 'auspicious-date', 'bazi', 'compatibility', 'daily', 'guide', 'privacy', 'ziwei'];
  for (const route of routes) {
    const html = fs.readFileSync(new URL(`../${route}/index.html`, import.meta.url), 'utf8');
    assert.match(html, /<title>.+<\/title>/);
    assert.match(html, /canonical|refresh/);
  }
  const shared = fs.readFileSync(new URL('../share.html', import.meta.url), 'utf8');
  assert.match(shared, /noindex,nofollow/);
  assert.match(shared, /不包含姓名、出生日期/);
  assert.match(fs.readFileSync(new URL('../robots.txt', import.meta.url), 'utf8'), /sitemap\.xml/i);
  assert.match(fs.readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8'), /<urlset/);
  const privacy = fs.readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
  assert.match(privacy, /AES-GCM/);
  assert.match(privacy, /180 天/);
});
