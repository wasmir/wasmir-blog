import { describe, it, expect } from 'vitest';
import {
  dayTotal, dailyTotals, gradeLevel, computeMetrics,
  buildGrid, dataLossBandWidth, monthLabels, formatM, cellTitle,
  type ByDay,
} from './usage';

const SAMPLE: ByDay = {
  '2026-05-26': { macbook: { claude: 3_000_000, codex: 200_000 }, 'mac-mini': { claude: 0, codex: 0 } },
  '2026-05-27': { macbook: { claude: 900_000 } },
  '2026-05-28': { macbook: { claude: 2_500_000 }, 'mac-mini': { codex: 100_000 } },
  '2026-05-29': { macbook: { claude: 3_000_000 } },
};

describe('dayTotal / dailyTotals', () => {
  it('跨机器+工具求和', () => {
    expect(dayTotal(SAMPLE['2026-05-26'])).toBe(3_200_000);
    expect(dailyTotals(SAMPLE)).toEqual({
      '2026-05-26': 3_200_000,
      '2026-05-27': 900_000,
      '2026-05-28': 2_600_000,
      '2026-05-29': 3_000_000,
    });
  });
});

describe('gradeLevel（GitHub 绿阶，固定阈值 0.12/1/2/3 M）', () => {
  it('按阈值落级，单调不降', () => {
    expect(gradeLevel(0)).toBe(0);
    expect(gradeLevel(0.05e6)).toBe(0); // <0.12 → 安静/空
    expect(gradeLevel(0.5e6)).toBe(1);
    expect(gradeLevel(1.5e6)).toBe(2);
    expect(gradeLevel(2.5e6)).toBe(3);
    expect(gradeLevel(3.0e6)).toBe(4);
    expect(gradeLevel(9e6)).toBe(4);
  });
});

describe('computeMetrics', () => {
  it('累计/峰值/本月/streak 正确（streak = 连续有记录的天）', () => {
    const m = computeMetrics(SAMPLE, '2026-05-29');
    expect(m.cumulative).toBe(9_700_000);
    expect(m.peak).toBe(3_200_000);
    expect(m.thisMonth).toBe(9_700_000);
    expect(m.streak).toBe(4);
  });
});

describe('buildGrid（整年 53 列窗口 + 数据缺失）', () => {
  it('371 格、列优先、起于周日，今天之后为 empty', () => {
    const cells = buildGrid(SAMPLE, '2026-05-29', '2026-04-16');
    expect(cells.length).toBe(53 * 7);
    expect(new Date(cells[0].date + 'T00:00:00Z').getUTCDay()).toBe(0);
    expect(cells.find((c) => c.date === '2026-05-29')!.empty).toBe(false);
    const future = cells.filter((c) => c.date > '2026-05-29');
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((c) => c.empty && !c.lost)).toBe(true);
  });

  it('cutoff 之前的非未来格标记为 lost（level 0），之后为存活格', () => {
    const cells = buildGrid(SAMPLE, '2026-05-29', '2026-04-16');
    const lost = cells.filter((c) => c.lost);
    expect(lost.length).toBeGreaterThan(0);
    expect(lost.every((c) => c.date < '2026-04-16' && !c.empty && c.level === 0)).toBe(true);
    expect(cells.filter((c) => !c.empty && !c.lost).every((c) => c.date >= '2026-04-16')).toBe(true);
  });

  it('不传 cutoff 时没有 lost 格', () => {
    expect(buildGrid(SAMPLE, '2026-05-29').some((c) => c.lost)).toBe(false);
  });
});

describe('dataLossBandWidth', () => {
  it('= 首个存活格所在列 × 11 − 1；无 lost 时为 0', () => {
    const cells = buildGrid(SAMPLE, '2026-05-29', '2026-04-16');
    const firstAlive = cells.findIndex((c) => !c.empty && !c.lost);
    expect(dataLossBandWidth(cells)).toBe(Math.floor(firstAlive / 7) * 11 - 1);
    expect(dataLossBandWidth(cells)).toBeGreaterThan(0);
    expect(dataLossBandWidth(buildGrid(SAMPLE, '2026-05-29'))).toBe(0);
  });
});

describe('monthLabels', () => {
  it('整年标签：非空者为三字母大写月名', () => {
    const labels = monthLabels(buildGrid(SAMPLE, '2026-05-29', '2026-04-16'));
    expect(labels.length).toBe(53);
    const nonEmpty = labels.filter(Boolean);
    expect(nonEmpty.length).toBeGreaterThan(3);
    expect(nonEmpty.every((m) => /^[A-Z]{3}$/.test(m))).toBe(true);
  });
});

describe('formatM / cellTitle', () => {
  it('格式化与 tooltip：存活/安静/缺失/未来', () => {
    expect(formatM(3_200_000, 1)).toBe('3.2');
    expect(formatM(180_000_000, 0)).toBe('180');
    expect(cellTitle({ date: '2026-05-29', tokens: 3_000_000, level: 4, empty: false, lost: false }))
      .toBe('2026-05-29 · 3.0M tokens');
    expect(cellTitle({ date: '2026-04-16', tokens: 7_114, level: 1, empty: false, lost: false }))
      .toBe('2026-04-16 · 0.01M tokens');
    expect(cellTitle({ date: '2026-03-02', tokens: 500_000, level: 0, empty: false, lost: true }))
      .toBe('2026-03-02 · 数据缺失');
    expect(cellTitle({ date: '2026-04-16', tokens: 0, level: 0, empty: false, lost: false }))
      .toBe('2026-04-16 · 安静的一天');
    expect(cellTitle({ date: '2026-06-02', tokens: 0, level: 0, empty: true, lost: false })).toBe('');
  });
});
