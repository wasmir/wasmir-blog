// 纯函数：把各机聚合结果按 machine→tool 分桶合并进 usage 数据。
// 覆盖式写入 => 重跑某台只改它自己的桶，天然幂等。
// 每个 tool 存双口径 {nocache, cache}；兼容旧版裸数字（升级为 {nocache:n, cache:n}）。
function one(v) {
  if (typeof v === 'number') return { nocache: v, cache: v }; // 旧标量升级
  return { nocache: v?.nocache || 0, cache: v?.cache || 0 };
}
function normTools(tools) {
  const t = tools || {};
  return { claude: one(t.claude), codex: one(t.codex) };
}

export function mergeUsage(existing, perMachine, lastSync) {
  const byDay = {};
  for (const [date, machines] of Object.entries(existing.byDay || {})) {
    byDay[date] = {};
    for (const [mid, tools] of Object.entries(machines)) {
      byDay[date][mid] = normTools(tools);
    }
  }
  for (const [mid, dates] of Object.entries(perMachine)) {
    for (const [date, tools] of Object.entries(dates)) {
      if (!byDay[date]) byDay[date] = {};
      byDay[date][mid] = normTools(tools);
    }
  }
  const machines = [
    ...new Set([...(existing.meta?.machines || []), ...Object.keys(perMachine)]),
  ].sort();
  return {
    meta: { lastSync, metrics: ['nocache', 'cache'], tools: ['claude', 'codex'], machines },
    byDay,
  };
}
