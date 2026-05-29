// 纯函数：把各机聚合结果按 machine→tool 分桶合并进 usage 数据。
// 覆盖式写入 => 重跑某台只改它自己的桶，天然幂等。
export function mergeUsage(existing, perMachine, lastSync) {
  const byDay = {};
  for (const [date, machines] of Object.entries(existing.byDay || {})) {
    byDay[date] = {};
    for (const [mid, tools] of Object.entries(machines)) {
      byDay[date][mid] = { claude: tools.claude || 0, codex: tools.codex || 0 };
    }
  }
  for (const [mid, dates] of Object.entries(perMachine)) {
    for (const [date, tools] of Object.entries(dates)) {
      if (!byDay[date]) byDay[date] = {};
      byDay[date][mid] = { claude: tools.claude || 0, codex: tools.codex || 0 };
    }
  }
  const machines = [
    ...new Set([...(existing.meta?.machines || []), ...Object.keys(perMachine)]),
  ].sort();
  return {
    meta: { lastSync, metric: 'io_no_cache', tools: ['claude', 'codex'], machines },
    byDay,
  };
}
