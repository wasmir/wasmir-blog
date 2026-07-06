import { describe, it, expect } from 'vitest';
import { mergeBaseForScan } from './collect-base.mjs';

const existing = {
  meta: { machines: ['macbook', 'mac-mini'], lastSync: '2026-05-29T00:00:00.000Z' },
  byDay: {
    '2026-01-01': { macbook: { claude: { nocache: 1, cache: 10 } } },
  },
};

describe('mergeBaseForScan', () => {
  it('增量扫描保留既有 byDay 作为合并基底', () => {
    expect(mergeBaseForScan(existing, '2026-05-26')).toBe(existing);
  });

  it('全量扫描清空 byDay，避免旧口径历史残留', () => {
    expect(mergeBaseForScan(existing, null)).toEqual({
      meta: { machines: ['macbook', 'mac-mini'] },
      byDay: {},
    });
  });
});
