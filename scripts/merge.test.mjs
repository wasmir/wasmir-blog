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

  // 增量更新的安全契约：聚合只产出最近几天时，更早的历史天必须原样保留。
  it('perMachine 不含某历史天时，该天完整保留（增量不丢历史）', () => {
    const a = mergeUsage(EMPTY, {
      macbook: { '2026-01-01': { claude: 42, codex: 7 } },
    }, SYNC);
    // 后续只重算 05-05（模拟 since 窗口），历史 01-01 不在 perMachine 里
    const b = mergeUsage(a, { macbook: { '2026-05-05': { claude: 9 } } }, SYNC);
    expect(b.byDay['2026-01-01'].macbook).toEqual({ claude: 42, codex: 7 });
    expect(b.byDay['2026-05-05'].macbook).toEqual({ claude: 9, codex: 0 });
  });

  // 更尖锐的契约：since 窗口「之内」的某天，本机这次没产出（日志被轮转/清理），
  // 旧值也必须保留、绝不回退为零。防止日后把 merge 改成「以 perMachine 为准、缺失即清零」。
  it('窗口内、本次无产出的天不回退为零（增量不塌陷）', () => {
    const a = mergeUsage(EMPTY, { macbook: { '2026-05-27': { claude: 500 } } }, SYNC);
    const b = mergeUsage(a, { macbook: { '2026-05-29': { claude: 10 } } }, SYNC);
    expect(b.byDay['2026-05-27'].macbook).toEqual({ claude: 500, codex: 0 });
    expect(b.byDay['2026-05-29'].macbook).toEqual({ claude: 10, codex: 0 });
  });
});
