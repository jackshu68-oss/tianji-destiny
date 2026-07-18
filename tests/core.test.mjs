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

test('页面包含两种新增排盘和本地脚本', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="meihua"/);
  assert.match(html, /id="qimen"/);
  assert.match(html, /js\/meihua\.js/);
  assert.match(html, /js\/vendor\/qimen-core\.min\.js/);
  assert.match(html, /js\/divination\.js/);
  assert.match(html, /js\/ai\.js/);
  const aiSource = fs.readFileSync(new URL('../js/ai.js', import.meta.url), 'utf8');
  assert.match(aiSource, /\/api\/ai\/interpret/);
  assert.match(aiSource, /\/api\/ai\/result\//);
  assert.match(aiSource, /payload\.pending/);
  assert.doesNotMatch(aiSource, /Bearer\s|DEEPSEEK_API_KEY|api\.deepseek\.com/);
});
