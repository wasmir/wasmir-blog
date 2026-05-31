# Spec：Token activity 的 cache / nocache 切换显示

**日期**：2026-05-31
**状态**：已批准，待实现

## 背景与动机

首页「Token activity」热力图当前只统计**不含 cache**的口径（`io_no_cache`），累计约 176M。
博客作为简历用，176M 显得偏小。希望加一个切换：在 TOKEN ACTIVITY 右侧用 `[ Total | No-cache ]`
开关切换「含缓存总量」与「纯输出」两套口径并重绘热力图与汇总数字。

实测：含 cache 累计 ≈ **14,743M（14.7B）**，是 nocache 的 ~84 倍。默认显示 **Total（含 cache）**。

口径定义（与原始日志字段对应）：
- **Claude**：`nocache = input + output`；`cache = nocache + cache_creation_input_tokens + cache_read_input_tokens`。
- **Codex**：`nocache = input - cached_input + output + reasoning`；`cache = input + output + reasoning`（即不减 cached）。
- 两口径只差「cache 项」，与现有 nocache 公式保持一致。

## A. 数据模型（`src/data/usage.json` 形状升级）

每个 tool 由单值改为双口径对象：
```jsonc
// 旧
"macbook": { "claude": 3253241, "codex": 1639019 }
// 新
"macbook": {
  "claude": { "nocache": 3253241, "cache": 298451200 },
  "codex":  { "nocache": 1639019, "cache": 52310400 }
}
```
`meta` 的 `metric: "io_no_cache"` 改为 `metrics: ["nocache", "cache"]`。

## B. 聚合 + 历史回填 + merge

- `scripts/aggregate-usage.py`：每条记录同时累计 `nocache` 与 `cache`，输出
  `{date: {claude:{nocache,cache}, codex:{nocache,cache}}}`。`_add` 接收两个增量。
- **一次性全量重扫两台机**（清空 `meta.lastSync` → `since=null` → 全量）：mac-mini 日志回溯到
  2025-09-18、macbook 到 2025-10-04，几乎覆盖 usage.json 全部历史天，直接补上 cache 口径。
- `scripts/merge.mjs`：按 tool 存 `{nocache,cache}`。**兼容旧标量**：若 existing 里某 tool 是 number，
  升级为 `{nocache:n, cache:n}`（两边都无日志、无法重扫的极少数远古天，cache 退化等于 nocache）。
- 增量逻辑（since 窗口、computeSince）不变，两口径一起走。

## C. 热力图分级（按口径各一套）+ M/B 格式化

`src/lib/usage.ts`：
- `gradeLevel(tokens, metric)`：
  - `nocache` 阈值不变：`<0.12 / <1 / <2 / <3 / ≥3`（M）。
  - `cache` 阈值（据每日 cache 分布 p25≈2.6 / p50≈22 / p75≈116 / p90≈500 M 定）：
    `<1 / <25 / <100 / <500 / ≥500`（M）。
- 新增 `formatTokens(n)`：`n >= 1e9` → `(n/1e9).toFixed(1)+"B"`；否则沿用 M（`formatM`）。
  累计→`14.7B`、峰值→`1.7B`、`cellTitle` tooltip 同步用它。
- `dayTotal(bucket, metric)`、`dailyTotals(byDay, metric)`、`computeMetrics(byDay, today, metric)`、
  `buildGrid(byDay, today, cutoff, metric)` 均加 `metric: 'nocache' | 'cache'` 参数。

## D. 切换 UI（SSR 优先，零依赖）

`src/components/TokenHeatmap.astro`：
- 构建时对两口径各算一套 `{cells(level+title), summary(4 数+单位)}`；几何（`monthLabels`、
  `dataLossBandWidth`、每格 date/empty/lost）与口径无关，只算一次。
- 默认渲染 **Total**；把两套 `{cellClass[], cellTitle[], summary[]}` 作 JSON 内嵌 `<script type="application/json">`。
- module-head 内、TOKEN ACTIVITY 右侧加分段开关 `[ Total | No-cache ]`（两个 button）。
- 内联 `<script>`：点击切换时遍历格子设 `className` + `title`，替换 4 个汇总数字与单位，切换按钮 `aria-pressed`/active 样式。
- **渐进增强**：无 JS 时静态展示默认 Total，不报错、不空白。
- CSS：分段开关样式（沿用设计 token：`--font-mono`、`--border`、`--radius-pill` 等），active 态用品牌 lime。

## E. 受影响文件 + 测试（TDD）

| 文件 | 改动 |
|---|---|
| `scripts/aggregate-usage.py` | 双口径累计 |
| `scripts/merge.mjs` | 新形状 + 旧标量升级 |
| `src/lib/usage.ts` | 类型 + metric 参数 + 双阈值 + formatTokens |
| `src/components/TokenHeatmap.astro` | 双视图 + 开关 + JS + CSS |
| `src/data/usage.json` | 全量重扫升级形状 |
| `.claude/skills/update-token-usage/SKILL.md` | 报数片段输出两套口径 |

测试：
- `test_aggregate_usage.py`：断言输出双口径、cache≥nocache、since 过滤仍生效。
- `merge.test.mjs`：新形状分桶；**旧标量升级为 {nocache,cache}**；历史/窗口内天保留。
- `usage.test.ts`：`gradeLevel` 双阈值边界；`formatTokens` 的 M/B 边界（999M→M、1000M→1.0B、14743M→14.7B）；
  `computeMetrics`/`dayTotal` 按 metric 取数。

## F. 同步更新 `/update-token-usage` skill

报数 node 片段改为分别按 nocache、cache 算并打印两行，口径/取整与页面一致（用 formatTokens 同款 M/B）。
DATA_START 注释维持指向 TokenHeatmap.astro。

## 诚实备注
含 cache 主要由 `cache_read`（每轮重读上下文）撑大，属「总吞吐」而非「净生产」。这是有意为之的展示口径，
两者皆可切换，纯输出口径仍保留。
