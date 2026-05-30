import { describe, it, expect } from 'vitest';
import { computeSince } from './since.mjs';

describe('computeSince', () => {
  it('取 lastSync 日期往前留 3 天缓冲（默认）', () => {
    expect(computeSince('2026-05-29T04:55:32.116Z')).toBe('2026-05-26');
  });

  it('只看日期部分，午间同步也只算到当天', () => {
    // 23:59 与 00:00 同属一天，结果一致
    expect(computeSince('2026-05-29T23:59:59Z')).toBe('2026-05-26');
    expect(computeSince('2026-05-29T00:00:00Z')).toBe('2026-05-26');
  });

  it('margin=0 时即 lastSync 当天', () => {
    expect(computeSince('2026-05-29T04:55:32Z', 0)).toBe('2026-05-29');
  });

  it('跨月边界正确回退', () => {
    expect(computeSince('2026-03-01T00:00:00Z', 3)).toBe('2026-02-26');
  });

  it('跨年边界正确回退', () => {
    expect(computeSince('2026-01-02T10:00:00Z', 3)).toBe('2025-12-30');
  });

  it('lastSync 缺失/空 → null（触发全量）', () => {
    expect(computeSince(undefined)).toBe(null);
    expect(computeSince('')).toBe(null);
    expect(computeSince(null)).toBe(null);
  });

  it('lastSync 非法 → null（降级全量，不抛）', () => {
    expect(computeSince('not-a-date')).toBe(null);
  });
});
