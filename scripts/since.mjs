// 纯函数：由 usage.json 的 meta.lastSync 推出增量聚合的起点 since（含缓冲）。
// 取 lastSync 的 UTC 日期，往前留 marginDays 天，返回 'YYYY-MM-DD'。
// lastSync 缺失/非法 => null（调用方据此降级为全量扫描）。
export function computeSince(lastSync, marginDays = 3) {
  if (!lastSync || typeof lastSync !== 'string') return null;
  const day = lastSync.slice(0, 10);
  const dt = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setUTCDate(dt.getUTCDate() - marginDays);
  return dt.toISOString().slice(0, 10);
}
