import { describe, it, expect } from 'vitest';
import { mergeUsage } from './merge.mjs';

const EMPTY = { meta: {}, byDay: {} };
const SYNC = '2026-05-29T12:00:00.000Z';
const pair = (nc, ca) => ({ nocache: nc, cache: ca });

describe('mergeUsage（双口径 {nocache,cache}）', () => {
  it('按 machine→tool 分桶写入，meta.metrics 标双口径', () => {
    const out = mergeUsage(EMPTY, {
      macbook: { '2026-05-01': { claude: pair(100, 900), codex: pair(0, 0) } },
    }, SYNC);
    expect(out.byDay['2026-05-01'].macbook).toEqual({ claude: pair(100, 900), codex: pair(0, 0) });
    expect(out.meta.metrics).toEqual(['nocache', 'cache']);
    expect(out.meta.machines).toEqual(['macbook']);
    expect(out.meta.lastSync).toBe(SYNC);
  });

  it('两台机同一天并存，互不覆盖', () => {
    const a = mergeUsage(EMPTY, { macbook: { '2026-05-01': { claude: pair(100, 900) } } }, SYNC);
    const b = mergeUsage(a, { 'mac-mini': { '2026-05-01': { codex: pair(50, 500) } } }, SYNC);
    expect(b.byDay['2026-05-01'].macbook).toEqual({ claude: pair(100, 900), codex: pair(0, 0) });
    expect(b.byDay['2026-05-01']['mac-mini']).toEqual({ claude: pair(0, 0), codex: pair(50, 500) });
    expect(b.meta.machines.sort()).toEqual(['mac-mini', 'macbook']);
  });

  it('重跑同一台机幂等（覆盖而非累加）', () => {
    const a = mergeUsage(EMPTY, { macbook: { '2026-05-01': { claude: pair(100, 900) } } }, SYNC);
    const again = mergeUsage(a, { macbook: { '2026-05-01': { claude: pair(100, 900) } } }, SYNC);
    expect(again.byDay['2026-05-01'].macbook).toEqual({ claude: pair(100, 900), codex: pair(0, 0) });
  });

  it('perMachine 不含某历史天时，该天完整保留（增量不丢历史）', () => {
    const a = mergeUsage(EMPTY, { macbook: { '2026-01-01': { claude: pair(42, 420), codex: pair(7, 70) } } }, SYNC);
    const b = mergeUsage(a, { macbook: { '2026-05-05': { claude: pair(9, 90) } } }, SYNC);
    expect(b.byDay['2026-01-01'].macbook).toEqual({ claude: pair(42, 420), codex: pair(7, 70) });
    expect(b.byDay['2026-05-05'].macbook).toEqual({ claude: pair(9, 90), codex: pair(0, 0) });
  });

  it('窗口内、本次无产出的天不回退为零（增量不塌陷）', () => {
    const a = mergeUsage(EMPTY, { macbook: { '2026-05-27': { claude: pair(500, 5000) } } }, SYNC);
    const b = mergeUsage(a, { macbook: { '2026-05-29': { claude: pair(10, 100) } } }, SYNC);
    expect(b.byDay['2026-05-27'].macbook).toEqual({ claude: pair(500, 5000), codex: pair(0, 0) });
    expect(b.byDay['2026-05-29'].macbook).toEqual({ claude: pair(10, 100), codex: pair(0, 0) });
  });

  // 迁移契约：旧版 usage.json 里 tool 是裸数字（仅 nocache）；升级时 cache 暂等于 nocache。
  it('旧标量自动升级为 {nocache:n, cache:n}', () => {
    const legacy = { meta: { machines: ['macbook'] }, byDay: { '2025-09-18': { macbook: { claude: 42, codex: 7 } } } };
    const out = mergeUsage(legacy, { macbook: { '2026-05-30': { claude: pair(9, 90) } } }, SYNC);
    expect(out.byDay['2025-09-18'].macbook).toEqual({ claude: pair(42, 42), codex: pair(7, 7) });
    expect(out.byDay['2026-05-30'].macbook).toEqual({ claude: pair(9, 90), codex: pair(0, 0) });
  });
});
