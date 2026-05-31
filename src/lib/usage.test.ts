import { describe, it, expect } from 'vitest';
import {
  dayTotal, dailyTotals, gradeLevel, computeMetrics,
  buildGrid, dataLossBandWidth, monthLabels, formatTokens, cellTitle,
  type ByDay,
} from './usage';

// 新形状：每个 tool 是 {nocache, cache} 双口径。
const SAMPLE: ByDay = {
  '2026-05-26': {
    macbook: { claude: { nocache: 3_000_000, cache: 32_000_000 }, codex: { nocache: 200_000, cache: 2_000_000 } },
    'mac-mini': { claude: { nocache: 0, cache: 0 }, codex: { nocache: 0, cache: 0 } },
  },
  '2026-05-27': { macbook: { claude: { nocache: 900_000, cache: 9_000_000 } } },
  '2026-05-28': { macbook: { claude: { nocache: 2_500_000, cache: 26_000_000 } }, 'mac-mini': { codex: { nocache: 100_000, cache: 1_000_000 } } },
  '2026-05-29': { macbook: { claude: { nocache: 3_000_000, cache: 600_000_000 } } },
};

describe('dayTotal / dailyTotals（按 metric 取数）', () => {
  it('nocache：跨机器+工具求和', () => {
    expect(dayTotal(SAMPLE['2026-05-26'], 'nocache')).toBe(3_200_000);
    expect(dailyTotals(SAMPLE, 'nocache')).toEqual({
      '2026-05-26': 3_200_000, '2026-05-27': 900_000, '2026-05-28': 2_600_000, '2026-05-29': 3_000_000,
    });
  });
  it('cache：取 cache 口径求和', () => {
    expect(dayTotal(SAMPLE['2026-05-26'], 'cache')).toBe(34_000_000);
    expect(dailyTotals(SAMPLE, 'cache')).toEqual({
      '2026-05-26': 34_000_000, '2026-05-27': 9_000_000, '2026-05-28': 27_000_000, '2026-05-29': 600_000_000,
    });
  });
});

describe('gradeLevel（按口径各一套固定阈值）', () => {
  it('nocache：0.12/1/2/3 M', () => {
    expect(gradeLevel(0, 'nocache')).toBe(0);
    expect(gradeLevel(0.05e6, 'nocache')).toBe(0);
    expect(gradeLevel(0.5e6, 'nocache')).toBe(1);
    expect(gradeLevel(1.5e6, 'nocache')).toBe(2);
    expect(gradeLevel(2.5e6, 'nocache')).toBe(3);
    expect(gradeLevel(3.0e6, 'nocache')).toBe(4);
  });
  it('cache：1/25/100/500 M', () => {
    expect(gradeLevel(0, 'cache')).toBe(0);
    expect(gradeLevel(0.5e6, 'cache')).toBe(0);
    expect(gradeLevel(10e6, 'cache')).toBe(1);
    expect(gradeLevel(50e6, 'cache')).toBe(2);
    expect(gradeLevel(200e6, 'cache')).toBe(3);
    expect(gradeLevel(500e6, 'cache')).toBe(4);
    expect(gradeLevel(1685e6, 'cache')).toBe(4);
  });
});

describe('computeMetrics（按 metric）', () => {
  it('nocache 口径', () => {
    const m = computeMetrics(SAMPLE, '2026-05-29', 'nocache');
    expect(m.cumulative).toBe(9_700_000);
    expect(m.peak).toBe(3_200_000);
    expect(m.thisMonth).toBe(9_700_000);
    expect(m.streak).toBe(4);
  });
  it('cache 口径', () => {
    const m = computeMetrics(SAMPLE, '2026-05-29', 'cache');
    expect(m.cumulative).toBe(670_000_000);
    expect(m.peak).toBe(600_000_000);
    expect(m.thisMonth).toBe(670_000_000);
    expect(m.streak).toBe(4);
  });
});

describe('buildGrid（按 metric 着色）', () => {
  it('371 格、列优先、起于周日，今天之后 empty', () => {
    const cells = buildGrid(SAMPLE, '2026-05-29', '2026-04-16', 'nocache');
    expect(cells.length).toBe(53 * 7);
    expect(new Date(cells[0].date + 'T00:00:00Z').getUTCDay()).toBe(0);
    const future = cells.filter((c) => c.date > '2026-05-29');
    expect(future.every((c) => c.empty && !c.lost)).toBe(true);
  });
  it('同一天 cache 口径着色更高（600M → l4）', () => {
    const nc = buildGrid(SAMPLE, '2026-05-29', '2026-04-16', 'nocache').find((c) => c.date === '2026-05-29')!;
    const ca = buildGrid(SAMPLE, '2026-05-29', '2026-04-16', 'cache').find((c) => c.date === '2026-05-29')!;
    expect(nc.level).toBe(4); // 3.0M
    expect(ca.level).toBe(4); // 600M
    expect(ca.tokens).toBe(600_000_000);
  });
  it('cutoff 之前为 lost，不传 cutoff 无 lost', () => {
    const cells = buildGrid(SAMPLE, '2026-05-29', '2026-04-16', 'nocache');
    expect(cells.filter((c) => c.lost).every((c) => c.date < '2026-04-16' && !c.empty && c.level === 0)).toBe(true);
    expect(buildGrid(SAMPLE, '2026-05-29', undefined, 'nocache').some((c) => c.lost)).toBe(false);
  });
});

describe('dataLossBandWidth / monthLabels（与口径无关）', () => {
  it('蒙版宽度 = 首个存活格列 × 11 − 1', () => {
    const cells = buildGrid(SAMPLE, '2026-05-29', '2026-04-16', 'nocache');
    const firstAlive = cells.findIndex((c) => !c.empty && !c.lost);
    expect(dataLossBandWidth(cells)).toBe(Math.floor(firstAlive / 7) * 11 - 1);
    expect(dataLossBandWidth(buildGrid(SAMPLE, '2026-05-29', undefined, 'nocache'))).toBe(0);
  });
  it('月份标签整年 53 列、三字母大写', () => {
    const labels = monthLabels(buildGrid(SAMPLE, '2026-05-29', '2026-04-16', 'nocache'));
    expect(labels.length).toBe(53);
    expect(labels.filter(Boolean).every((m) => /^[A-Z]{3}$/.test(m))).toBe(true);
  });
});

describe('formatTokens（M/B 自适应）', () => {
  it('M 区间按 decimals 取整', () => {
    expect(formatTokens(176_000_000, 0)).toEqual({ num: '176', unit: 'M' });
    expect(formatTokens(11_175_496, 1)).toEqual({ num: '11.2', unit: 'M' });
    expect(formatTokens(999_000_000, 0)).toEqual({ num: '999', unit: 'M' });
  });
  it('≥1000M 进位为 B（恒 1 位小数）', () => {
    expect(formatTokens(1_000_000_000)).toEqual({ num: '1.0', unit: 'B' });
    expect(formatTokens(14_743_000_000, 0)).toEqual({ num: '14.7', unit: 'B' });
    expect(formatTokens(1_685_300_000, 1)).toEqual({ num: '1.7', unit: 'B' });
  });
});

describe('cellTitle（tooltip，含 B）', () => {
  it('存活/安静/缺失/未来 + 十亿级', () => {
    expect(cellTitle({ date: '2026-05-29', tokens: 3_000_000, level: 4, empty: false, lost: false }))
      .toBe('2026-05-29 · 3.0M tokens');
    expect(cellTitle({ date: '2026-04-16', tokens: 7_114, level: 1, empty: false, lost: false }))
      .toBe('2026-04-16 · 0.01M tokens');
    expect(cellTitle({ date: '2026-05-29', tokens: 1_685_300_000, level: 4, empty: false, lost: false }))
      .toBe('2026-05-29 · 1.7B tokens');
    expect(cellTitle({ date: '2026-03-02', tokens: 500_000, level: 0, empty: false, lost: true }))
      .toBe('2026-03-02 · 数据缺失');
    expect(cellTitle({ date: '2026-04-16', tokens: 0, level: 0, empty: false, lost: false }))
      .toBe('2026-04-16 · 安静的一天');
    expect(cellTitle({ date: '2026-06-02', tokens: 0, level: 0, empty: true, lost: false })).toBe('');
  });
});
