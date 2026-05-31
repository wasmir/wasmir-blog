export type Tool = 'claude' | 'codex';
export type Metric = 'nocache' | 'cache';
// 每个 tool 两套口径：nocache=纯输出（不含 cache）；cache=含缓存总吞吐。
export interface MetricPair { nocache: number; cache: number; }
export type MachineBucket = Record<string, Partial<Record<Tool, MetricPair>>>;
export type ByDay = Record<string, MachineBucket>;

export interface UsageMeta {
  lastSync: string;
  metrics: string[];
  tools: string[];
  machines: string[];
}
export interface UsageData {
  meta: UsageMeta;
  byDay: ByDay;
}

export type Level = 0 | 1 | 2 | 3 | 4;
export interface Cell {
  date: string;
  tokens: number;
  level: Level;
  empty: boolean; // 今天之后的占位格（透明）
  lost: boolean;  // cutoff 之前：数据缺失（灰，盖在蒙版下）
}
export interface Metrics {
  cumulative: number;
  peak: number;
  thisMonth: number;
  streak: number;
}

// ---------- 日期工具（UTC，作用于 'YYYY-MM-DD'）----------
function toUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromUTC(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}
function addDays(date: string, n: number): string {
  const dt = toUTC(date);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}
function weekday(date: string): number {
  return toUTC(date).getUTCDay(); // 0=Sun .. 6=Sat
}

// ---------- 求和（按口径）----------
export function dayTotal(bucket: MachineBucket, metric: Metric): number {
  let sum = 0;
  for (const tools of Object.values(bucket)) {
    sum += (tools.claude?.[metric] ?? 0) + (tools.codex?.[metric] ?? 0);
  }
  return sum;
}
export function dailyTotals(byDay: ByDay, metric: Metric): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [date, bucket] of Object.entries(byDay)) {
    out[date] = dayTotal(bucket, metric);
  }
  return out;
}

// ---------- 分级（经典 GitHub 绿阶，按口径各一套固定阈值，单位 token）----------
// 上界数组：tokens < t[i] → 级 i；否则 4。
// nocache（M）：<0.12 · <1 · <2 · <3 · ≥3
// cache（M，据每日分布 p25≈2.6/p50≈22/p75≈116/p90≈500）：<1 · <25 · <100 · <500 · ≥500
const THRESHOLDS: Record<Metric, [number, number, number, number]> = {
  nocache: [0.12e6, 1e6, 2e6, 3e6],
  cache: [1e6, 25e6, 100e6, 500e6],
};
export function gradeLevel(tokens: number, metric: Metric): Level {
  const t = THRESHOLDS[metric];
  if (tokens < t[0]) return 0;
  if (tokens < t[1]) return 1;
  if (tokens < t[2]) return 2;
  if (tokens < t[3]) return 3;
  return 4;
}

// ---------- 派生指标 ----------
// streak = 最长「连续有记录」的天数（有任何 token 即算活跃）。
function longestStreak(totals: Record<string, number>): number {
  const active = Object.keys(totals).filter((d) => totals[d] > 0).sort();
  let best = 0, run = 0;
  let prev: string | null = null;
  for (const d of active) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}
export function computeMetrics(byDay: ByDay, today: string, metric: Metric): Metrics {
  const totals = dailyTotals(byDay, metric);
  const month = today.slice(0, 7);
  let cumulative = 0, peak = 0, thisMonth = 0;
  for (const [date, val] of Object.entries(totals)) {
    cumulative += val;
    if (val > peak) peak = val;
    if (date.slice(0, 7) === month) thisMonth += val;
  }
  return { cumulative, peak, thisMonth, streak: longestStreak(totals) };
}

// ---------- 53×7 网格（滚动一年窗口，列优先，周日在上）----------
// cutoff 之前的非未来格标记为 lost（数据缺失）；今天之后为 empty。
export function buildGrid(byDay: ByDay, today: string, cutoff: string | undefined, metric: Metric): Cell[] {
  const totals = dailyTotals(byDay, metric);
  const gridEnd = addDays(today, 6 - weekday(today));   // 本周周六
  const gridStart = addDays(gridEnd, -(53 * 7 - 1));    // 53 周前的周日
  const cells: Cell[] = [];
  let cur = gridStart;
  while (cur <= gridEnd) {
    const future = cur > today;
    const lost = !future && !!cutoff && cur < cutoff;
    const tokens = totals[cur] ?? 0;
    cells.push({
      date: cur,
      tokens,
      level: future || lost ? 0 : gradeLevel(tokens, metric),
      empty: future,
      lost,
    });
    cur = addDays(cur, 1);
  }
  return cells;
}

// 数据缺失蒙版宽度（px）：= 首个「存活」格所在列 × 列距(11) − 1（对齐 cutoff 列左缘）。
// 无 lost 格 → 0（不渲染蒙版）；全是 lost（暂无存活数据）→ 覆盖整张网格。
export function dataLossBandWidth(cells: Cell[], pitch = 11): number {
  if (!cells.some((c) => c.lost)) return 0;
  const cols = cells.length / 7;
  const firstAliveIdx = cells.findIndex((c) => !c.empty && !c.lost);
  const col = firstAliveIdx < 0 ? cols : Math.floor(firstAliveIdx / 7);
  return Math.max(0, col * pitch - 1);
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function monthLabels(cells: Cell[]): string[] {
  const cols = cells.length / 7;
  const labels: string[] = new Array(cols).fill('');
  let lastLabelCol = -3;
  let lastLabeledMonth = -1;
  for (let c = 0; c < cols; c++) {
    const top = cells[c * 7]; // 该列周日格
    const m = toUTC(top.date).getUTCMonth();
    if (m !== lastLabeledMonth && c - lastLabelCol >= 3) {
      labels[c] = MONTHS[m];
      lastLabelCol = c;
      lastLabeledMonth = m;
    }
  }
  return labels;
}

// ---------- 格式化（M/B 自适应）----------
// ≥1000M 进位为 B（恒 1 位小数）；否则按 decimals 显示 M。返回 {num, unit} 便于分开渲染单位。
export function formatTokens(tokens: number, decimals = 1): { num: string; unit: string } {
  if (tokens >= 1e9) return { num: (tokens / 1e9).toFixed(1), unit: 'B' };
  return { num: (tokens / 1e6).toFixed(decimals), unit: 'M' };
}
export function cellTitle(cell: Cell): string {
  if (cell.empty) return '';
  if (cell.lost) return `${cell.date} · 数据缺失`;
  if (cell.tokens <= 0) return `${cell.date} · 安静的一天`;
  const { num, unit } = formatTokens(cell.tokens, cell.tokens >= 0.1e6 ? 1 : 2);
  return `${cell.date} · ${num}${unit} tokens`;
}
