import { describe, it, expect } from 'vitest';
import { mergeUsage } from './merge.mjs';

const EMPTY = { meta: {}, byDay: {} };
const SYNC = '2026-05-29T12:00:00.000Z';

describe('mergeUsage', () => {
  it('按 machine→tool 分桶写入', () => {
    const out = mergeUsage(EMPTY, {
      macbook: { '2026-05-01': { claude: 100, codex: 0 } },
    }, SYNC);
    expect(out.byDay['2026-05-01'].macbook).toEqual({ claude: 100, codex: 0 });
    expect(out.meta.machines).toEqual(['macbook']);
    expect(out.meta.lastSync).toBe(SYNC);
  });

  it('两台机同一天并存，互不覆盖', () => {
    const a = mergeUsage(EMPTY, { macbook: { '2026-05-01': { claude: 100 } } }, SYNC);
    const b = mergeUsage(a, { 'mac-mini': { '2026-05-01': { codex: 50 } } }, SYNC);
    expect(b.byDay['2026-05-01'].macbook).toEqual({ claude: 100, codex: 0 });
    expect(b.byDay['2026-05-01']['mac-mini']).toEqual({ claude: 0, codex: 50 });
    expect(b.meta.machines.sort()).toEqual(['mac-mini', 'macbook']);
  });

  it('重跑同一台机幂等（覆盖而非累加）', () => {
    const a = mergeUsage(EMPTY, { macbook: { '2026-05-01': { claude: 100 } } }, SYNC);
    const again = mergeUsage(a, { macbook: { '2026-05-01': { claude: 100 } } }, SYNC);
    expect(again.byDay['2026-05-01'].macbook).toEqual({ claude: 100, codex: 0 });
  });
});
